import React,{useCallback,useEffect,useMemo,useRef,useState} from "react";
import ExecutiveDashboard from "./ExecutiveDashboard.jsx";
import {APPS_SCRIPT_URL} from "../../config/app.js";
import {fetchAction} from "../../services/appsScriptApi.js";
import {readCachedSource,writeCachedSource} from "../../services/appCache.js";
import {registerRefreshTask} from "../../services/refreshManager.js";
import {C,PageLoadingMotoniveladora} from "../../components/ui/index.jsx";
import {resolveEquipmentCodeAlias} from "../equipment/equipmentCode.js";
import {
  DASHBOARD_SNAPSHOT_CACHE_VERSION,
  resolveDashboardScope,
  validateDashboardSnapshotResponse,
  validateCachedDashboardSnapshot,
} from "./dashboardSnapshotPolicy.js";

const safe=value=>Array.isArray(value)?value:[];

function aliasRows(rows){
  return safe(rows).map(row=>({
    ...row,
    maquina:resolveEquipmentCodeAlias(row?.maquina||row?.interno||""),
  }));
}

function currentDashboardScope(){
  if(typeof window==="undefined")return resolveDashboardScope("TODO");
  return resolveDashboardScope(window.sessionStorage?.getItem("dm_project")||"TODO");
}

export default function ExecutiveDashboardHistorical(props){
  const currentYear=useMemo(()=>new Date().getFullYear(),[]);
  const scope=useMemo(()=>currentDashboardScope(),[]);
  const cacheKey=useMemo(
    ()=>`dashboard-atomic-snapshot-v${DASHBOARD_SNAPSHOT_CACHE_VERSION}-${currentYear}-${scope.scopeKey}`,
    [currentYear,scope.scopeKey],
  );
  const mountedRef=useRef(true);
  const sequenceRef=useRef(0);
  const [state,setState]=useState({
    loading:true,
    refreshing:false,
    ready:false,
    stale:false,
    error:"",
    rop02:[],
    rma15:[],
    stats:null,
    coverage:null,
    distribution:null,
    projectStats:null,
    updatedAt:"",
    source:"",
  });

  const publishDiagnostics=useCallback(snapshot=>{
    if(typeof window==="undefined"||!snapshot)return;
    window.__dmDashboardSnapshotDiagnostics={
      source:snapshot.source||"",
      updatedAt:snapshot.updatedAt||"",
      scope:{global:scope.global,projects:[...scope.projects],requiredSources:[...scope.requiredSources],scopeKey:scope.scopeKey},
      rop02:snapshot.rop02?.length||0,
      rma15:snapshot.rma15?.length||0,
      projectStats:snapshot.projectStats||null,
      coverage:snapshot.coverage||null,
      distribution:snapshot.distribution||null,
      backendVersion:snapshot.backendVersion||"",
    };
  },[scope]);

  const loadSnapshot=useCallback(async({background=false}={})=>{
    const sequence=++sequenceRef.current;
    setState(prev=>({
      ...prev,
      loading:prev.ready?false:!background,
      refreshing:prev.ready||background,
      error:"",
    }));

    try{
      // El endpoint dashboard_snapshot arma ROP02 + RMA15 como una única respuesta.
      // La respuesta NO se publica hasta que la política comprueba todos los
      // proyectos requeridos y la cobertura histórica. Así el Dashboard nunca
      // ve "JM nuevo + FDS faltante" ni cualquier otra combinación parcial.
      const response=await fetchAction(APPS_SCRIPT_URL,"dashboard_snapshot",{
        force:true,
        compact:false,
        retries:1,
        timeoutMs:55000,
      });
      const checked=validateDashboardSnapshotResponse(response,currentYear,scope);
      const rop02=aliasRows(checked.rop02);
      const rma15=aliasRows(checked.rma15);
      const updatedAt=new Date().toISOString();

      const cachedValue={
        ok:true,
        cacheVersion:DASHBOARD_SNAPSHOT_CACHE_VERSION,
        year:currentYear,
        scopeKey:scope.scopeKey,
        updatedAt,
        backendVersion:checked.backendVersion,
        rop02,
        rma15,
        stats:checked.stats,
        coverage:checked.coverage,
        distribution:checked.distribution,
        projectStats:checked.projectStats,
      };

      // Este cache es un SNAPSHOT COMPUESTO ya validado, no cuatro caches ROP02
      // independientes. Se escribe solamente después de validar la transacción.
      await writeCachedSource(cacheKey,cachedValue).catch(()=>{});
      if(!mountedRef.current||sequence!==sequenceRef.current)return cachedValue;

      const next={
        loading:false,
        refreshing:false,
        ready:true,
        stale:false,
        error:"",
        rop02,
        rma15,
        stats:checked.stats,
        coverage:checked.coverage,
        distribution:checked.distribution,
        projectStats:checked.projectStats,
        updatedAt,
        source:"network",
        backendVersion:checked.backendVersion,
      };
      setState(next);
      publishDiagnostics(next);
      return cachedValue;
    }catch(error){
      if(!mountedRef.current||sequence!==sequenceRef.current)throw error;
      const message=String(error?.message||error||"No se pudo actualizar el Dashboard completo.");

      // CRÍTICO: un refresh fallido JAMÁS borra el último snapshot válido.
      // Si ya hay uno visible se conserva entero y sólo se informa la falla.
      setState(prev=>{
        if(prev.ready){
          const next={...prev,loading:false,refreshing:false,stale:true,error:message};
          publishDiagnostics(next);
          return next;
        }
        return {...prev,loading:false,refreshing:false,ready:false,error:message};
      });
      throw error;
    }
  },[cacheKey,currentYear,publishDiagnostics,scope]);

  useEffect(()=>{
    mountedRef.current=true;
    let cancelled=false;

    const bootstrap=async()=>{
      let usedCache=false;
      try{
        const record=await readCachedSource(cacheKey).catch(()=>null);
        const cached=validateCachedDashboardSnapshot(record?.value??record?.data,currentYear,scope);
        if(!cancelled&&mountedRef.current&&cached){
          const next={
            loading:false,
            refreshing:true,
            ready:true,
            stale:true,
            error:"",
            rop02:aliasRows(cached.rop02),
            rma15:aliasRows(cached.rma15),
            stats:cached.stats||null,
            coverage:cached.coverage||null,
            distribution:cached.distribution||null,
            projectStats:cached.projectStats||null,
            updatedAt:cached.updatedAt||"",
            source:"validated-cache",
            backendVersion:cached.backendVersion||"",
          };
          usedCache=true;
          setState(next);
          publishDiagnostics(next);
        }
      }catch(_){}

      // El cache sólo acelera/aporta continuidad. Siempre se fuerza una
      // revalidación real contra backend al montar el Dashboard.
      if(!cancelled&&mountedRef.current){
        loadSnapshot({background:usedCache}).catch(()=>{});
      }
    };

    bootstrap();
    return()=>{
      cancelled=true;
      mountedRef.current=false;
      sequenceRef.current+=1;
    };
  },[cacheKey,currentYear,loadSnapshot,publishDiagnostics,scope]);

  useEffect(()=>registerRefreshTask(
    "dashboard-atomic-snapshot",
    ()=>loadSnapshot({background:true}),
    {views:["dashboard"],priority:10},
  ),[loadSnapshot]);

  if(!state.ready&&state.loading){
    return <PageLoadingMotoniveladora label={`Cargando snapshot completo ${currentYear}...`}/>;
  }

  if(!state.ready&&state.error){
    return <div style={{maxWidth:900,margin:"48px auto",padding:20,borderRadius:12,border:`1px solid ${C.red}66`,background:C.redDim,color:C.text}}>
      <div style={{fontSize:16,fontWeight:900,color:C.red,marginBottom:8}}>Dashboard bloqueado para evitar datos falsos o parciales</div>
      <div style={{fontSize:12,lineHeight:1.55,color:C.textSub,marginBottom:14}}>{state.error}</div>
      <button type="button" onClick={()=>loadSnapshot({background:false}).catch(()=>{})} style={{border:`1px solid ${C.accent}66`,background:C.accentDim,color:C.accent,borderRadius:8,padding:"8px 13px",fontWeight:800,cursor:"pointer"}}>Reintentar carga verificada</button>
    </div>;
  }

  return <>
    {state.refreshing&&<div style={{marginBottom:8,fontSize:10,color:C.textMuted}}>Actualizando snapshot histórico completo sin retirar los datos visibles…</div>}
    {state.ready&&state.error&&<div role="alert" style={{marginBottom:8,padding:"8px 10px",borderRadius:8,border:`1px solid ${C.yellow}55`,background:C.yellowDim,color:C.textSub,fontSize:10,lineHeight:1.45}}>
      No se pudo completar la última actualización. Se conserva íntegro el último snapshot validado{state.updatedAt?` (${new Date(state.updatedAt).toLocaleString("es-AR")})`:""}. {state.error}
    </div>}
    <ExecutiveDashboard {...props} rop02All={state.rop02} rma15={state.rma15}/>
  </>;
}
