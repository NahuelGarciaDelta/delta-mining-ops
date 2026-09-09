import React,{useCallback,useEffect,useMemo,useRef,useState} from "react";
import ExecutiveDashboard from "./ExecutiveDashboard.jsx";
import {APPS_SCRIPT_URL} from "../../config/app.js";
import {fetchAction} from "../../services/appsScriptApi.js";
import {readCachedSource,writeCachedSource} from "../../services/appCache.js";
import {registerRefreshTask} from "../../services/refreshManager.js";
import {C,PageLoadingMotoniveladora,dmNormalizeAssignedProject,dmProjectMatches} from "../../components/ui/index.jsx";
import {resolveEquipmentCodeAlias} from "../equipment/equipmentCode.js";

const safe=v=>Array.isArray(v)?v:[];
const DASHBOARD_CACHE_VERSION=6;
const SNAPSHOT_BACKEND_MARK="DASHBOARD-SNAPSHOT-V1";

const normText=v=>String(v??"")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"")
  .replace(/\s+/g," ")
  .trim()
  .toUpperCase();

function dashboardScope(){
  if(typeof window==="undefined")return{global:true,project:"TODO",scopeKey:"server"};
  const area=normText(window.sessionStorage?.getItem("dm_area")||"");
  const role=normText(window.sessionStorage?.getItem("dm_role")||"");
  const project=dmNormalizeAssignedProject(window.sessionStorage?.getItem("dm_project")||"TODO");
  const global=
    area.includes("OFICINA TECNICA")||
    role.includes("GERENTE")||
    role.includes("ADMINISTRADOR")||
    role.includes("PRESIDENTE")||
    project==="TODO";
  return{global,project,scopeKey:global?"GLOBAL":normText(project).replace(/[^A-Z0-9]+/g,"_")};
}

function applyScope(rows,scope){
  if(scope?.global)return safe(rows);
  return safe(rows).filter(r=>dmProjectMatches(
    r?.proyecto??r?.Proyecto??r?.PROYECTO??r?.lugar??r?.Lugar??"",
    scope?.project||"TODO",
  ));
}

function aliasRows(rows){
  return safe(rows).map(r=>({
    ...r,
    maquina:resolveEquipmentCodeAlias(r?.maquina||r?.interno||""),
  }));
}

function validateSnapshot(response,year){
  if(!response?.ok||response?.action!=="dashboard_snapshot"){
    throw new Error("El backend no devolvió el snapshot completo del Dashboard.");
  }
  const backendVersion=String(response?.backendVersion||"");
  if(!backendVersion.includes(SNAPSHOT_BACKEND_MARK)){
    throw new Error(
      "BACKEND_DESACTUALIZADO: falta publicar el Apps Script con DASHBOARD-SNAPSHOT-V1. " +
      `Versión recibida: ${backendVersion||"sin versión"}.`
    );
  }
  if(!Array.isArray(response?.rop02)||!Array.isArray(response?.rma15)){
    throw new Error("El snapshot del Dashboard llegó sin ROP02/RMA15 completos.");
  }

  const ropCount=Number(response?.stats?.rop02??response.rop02.length)||0;
  const rmaCount=Number(response?.stats?.rma15??response.rma15.length)||0;
  const valued=Number(response?.stats?.rma15Valorizados||0);
  const ropMin=String(response?.coverage?.rop02Min||"");
  const ropMax=String(response?.coverage?.rop02Max||"");

  // Validación fuerte para el histórico 2026 real. Si no se cumplen estos mínimos,
  // se bloquea la vista en vez de volver a mostrar ceros o un período parcial.
  if(year===2026){
    if(ropCount<5000)throw new Error(`ROP02 incompleto: ${ropCount} registros. Se requieren más de 5.000 para 2026.`);
    if(rmaCount<1000)throw new Error(`RMA15 incompleto: ${rmaCount} registros. Se requieren más de 1.000 para 2026.`);
    if(!ropMin||ropMin>"2026-02-01")throw new Error(`Cobertura ROP02 incompleta: inicia en ${ropMin||"S/D"}.`);
    if(!ropMax||ropMax<"2026-08-01")throw new Error(`Cobertura ROP02 incompleta: termina en ${ropMax||"S/D"}.`);
    if(Number(response?.stats?.rma15ConCodigos||0)>0&&valued<=0){
      throw new Error("RMA15 tiene insumos pero el backend no valorizó ningún mantenimiento.");
    }
  }

  return response;
}

function usableCache(value,year){
  if(!value?.ok||Number(value?.cacheVersion)!==DASHBOARD_CACHE_VERSION)return false;
  if(Number(value?.year)!==year)return false;
  if(!Array.isArray(value?.rop02)||!Array.isArray(value?.rma15))return false;
  if(year===2026){
    if(value.rop02.length<5000||value.rma15.length<1000)return false;
    if(String(value?.coverage?.rop02Min||"")>"2026-02-01")return false;
  }
  return true;
}

export default function ExecutiveDashboardHistorical(props){
  const currentYear=useMemo(()=>new Date().getFullYear(),[]);
  const scope=useMemo(()=>dashboardScope(),[]);
  const cacheKey=useMemo(
    ()=>`dashboard-snapshot-v${DASHBOARD_CACHE_VERSION}-${currentYear}-${scope.scopeKey}`,
    [currentYear,scope.scopeKey],
  );
  const mountedRef=useRef(true);
  const sequenceRef=useRef(0);
  const [state,setState]=useState({
    loading:true,
    refreshing:false,
    ready:false,
    error:"",
    rop02:[],
    rma15:[],
    stats:null,
    coverage:null,
  });

  const loadSnapshot=useCallback(async({background=false}={})=>{
    const sequence=++sequenceRef.current;
    setState(prev=>({...prev,loading:!background,refreshing:background,error:""}));

    try{
      const response=validateSnapshot(
        await fetchAction(APPS_SCRIPT_URL,"dashboard_snapshot",{
          force:true,
          compact:false,
          retries:1,
          timeoutMs:55000,
        }),
        currentYear,
      );

      const rop02=applyScope(aliasRows(response.rop02),scope);
      const rma15=applyScope(aliasRows(response.rma15),scope);
      if(!rop02.length)throw new Error("El snapshot no contiene ROP02 para el alcance del usuario.");
      if(!rma15.length)throw new Error("El snapshot no contiene RMA15 para el alcance del usuario.");

      const cachedValue={
        ok:true,
        cacheVersion:DASHBOARD_CACHE_VERSION,
        year:currentYear,
        scopeKey:scope.scopeKey,
        updatedAt:new Date().toISOString(),
        backendVersion:response.backendVersion,
        rop02,
        rma15,
        stats:response.stats||null,
        coverage:response.coverage||null,
      };

      await writeCachedSource(cacheKey,cachedValue).catch(()=>{});
      if(!mountedRef.current||sequence!==sequenceRef.current)return cachedValue;

      setState({
        loading:false,
        refreshing:false,
        ready:true,
        error:"",
        rop02,
        rma15,
        stats:cachedValue.stats,
        coverage:cachedValue.coverage,
      });
      return cachedValue;
    }catch(error){
      if(!mountedRef.current||sequence!==sequenceRef.current)throw error;
      const message=String(error?.message||error||"No se pudo cargar el Dashboard completo.");
      setState(prev=>({
        ...prev,
        loading:false,
        refreshing:false,
        error:message,
      }));
      throw error;
    }
  },[cacheKey,currentYear,scope]);

  useEffect(()=>{
    mountedRef.current=true;
    let cancelled=false;

    (async()=>{
      const cached=await readCachedSource(cacheKey).catch(()=>null);
      const value=cached?.data??cached?.value??null;
      const usable=usableCache(value,currentYear);
      if(cancelled||!mountedRef.current)return;

      if(usable){
        setState({
          loading:false,
          refreshing:true,
          ready:true,
          error:"",
          rop02:value.rop02,
          rma15:value.rma15,
          stats:value.stats||null,
          coverage:value.coverage||null,
        });
      }

      loadSnapshot({background:usable}).catch(()=>{});
    })();

    return()=>{
      cancelled=true;
      mountedRef.current=false;
      sequenceRef.current+=1;
    };
  },[cacheKey,currentYear,loadSnapshot]);

  useEffect(()=>registerRefreshTask(
    "dashboard-verified-snapshot",
    ()=>loadSnapshot({background:state.ready}),
    {views:["dashboard"],priority:10},
  ),[loadSnapshot,state.ready]);

  if(!state.ready&&state.loading){
    return <PageLoadingMotoniveladora label="Validando histórico completo ROP02 / RMA15..."/>;
  }

  if(!state.ready&&state.error){
    return <div style={{maxWidth:900,margin:"48px auto",padding:20,borderRadius:12,border:`1px solid ${C.red}66`,background:C.redDim,color:C.text}}>
      <div style={{fontSize:16,fontWeight:900,color:C.red,marginBottom:8}}>Dashboard bloqueado para evitar datos parciales</div>
      <div style={{fontSize:12,lineHeight:1.55,color:C.textSub,marginBottom:14}}>{state.error}</div>
      <button type="button" onClick={()=>loadSnapshot({background:false}).catch(()=>{})} style={{border:`1px solid ${C.accent}66`,background:C.accentDim,color:C.accent,borderRadius:8,padding:"8px 13px",fontWeight:800,cursor:"pointer"}}>Reintentar carga verificada</button>
    </div>;
  }

  return <>
    {state.error&&<div style={{marginBottom:10,padding:"9px 12px",borderRadius:8,border:`1px solid ${C.yellow}55`,background:C.yellowDim,color:C.textSub,fontSize:11}}>{state.error} Se mantienen los últimos datos completos verificados.</div>}
    {state.refreshing&&<div style={{marginBottom:8,fontSize:10,color:C.textMuted}}>Actualizando snapshot histórico verificado…</div>}
    <ExecutiveDashboard {...props} rop02All={state.rop02} rma15={state.rma15}/>
  </>;
}
