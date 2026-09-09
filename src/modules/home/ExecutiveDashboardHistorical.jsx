import React,{useCallback,useEffect,useMemo,useRef,useState} from "react";
import ExecutiveDashboard from "./ExecutiveDashboard.jsx";
import {APPS_SCRIPT_URL} from "../../config/app.js";
import {fetchAction} from "../../services/appsScriptApi.js";
import {writeCachedSource} from "../../services/appCache.js";
import {registerRefreshTask} from "../../services/refreshManager.js";
import {C,PageLoadingMotoniveladora,dmNormalizeAssignedProject,dmProjectMatches} from "../../components/ui/index.jsx";
import {resolveEquipmentCodeAlias} from "../equipment/equipmentCode.js";

const safe=v=>Array.isArray(v)?v:[];
const DASHBOARD_CACHE_VERSION=7;
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

function operationalMonthKey(value){
  const m=String(value||"").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(!m)return"";
  let year=Number(m[1]),month=Number(m[2]);
  const day=Number(m[3]);
  if(day>=26){
    month+=1;
    if(month===13){month=1;year+=1;}
  }
  return`${year}-${String(month).padStart(2,"0")}`;
}

function historicalDistribution(rows){
  const out={};
  safe(rows).forEach(r=>{
    if(r?._excluded)return;
    const period=operationalMonthKey(r?.fecha);
    if(!period)return;
    if(!out[period])out[period]={rows:0,hours:0};
    out[period].rows+=1;
    const h=Number(r?.horas||0);
    if(Number.isFinite(h)&&h>0)out[period].hours+=h;
  });
  return out;
}

function validateSnapshot(response,year){
  if(!response?.ok||response?.action!=="dashboard_snapshot"){
    throw new Error("El backend no devolvió el snapshot completo del Dashboard.");
  }

  const backendVersion=String(response?.backendVersion||"");
  if(!backendVersion.includes(SNAPSHOT_BACKEND_MARK)){
    throw new Error(
      "BACKEND_DESACTUALIZADO: falta publicar el Apps Script con DASHBOARD-SNAPSHOT-V1. "+
      `Versión recibida: ${backendVersion||"sin versión"}.`
    );
  }

  if(!Array.isArray(response?.rop02)||!Array.isArray(response?.rma15)){
    throw new Error("El snapshot llegó sin ROP02/RMA15 completos.");
  }

  const ropCount=Number(response?.stats?.rop02??response.rop02.length)||0;
  const rmaCount=Number(response?.stats?.rma15??response.rma15.length)||0;
  const valued=Number(response?.stats?.rma15Valorizados||0);
  const ropMin=String(response?.coverage?.rop02Min||"");
  const ropMax=String(response?.coverage?.rop02Max||"");
  const distribution=historicalDistribution(response.rop02);

  if(year===2026){
    if(ropCount<5000)throw new Error(`ROP02 incompleto: ${ropCount} registros. Se requieren más de 5.000 para 2026.`);
    if(rmaCount<1000)throw new Error(`RMA15 incompleto: ${rmaCount} registros. Se requieren más de 1.000 para 2026.`);
    if(!ropMin||ropMin>"2026-02-01")throw new Error(`Cobertura ROP02 incompleta: inicia en ${ropMin||"S/D"}.`);
    if(!ropMax||ropMax<"2026-08-01")throw new Error(`Cobertura ROP02 incompleta: termina en ${ropMax||"S/D"}.`);

    // No alcanza con tener miles de filas: exigimos distribución histórica real.
    // Esto impide que una respuesta concentrada en agosto/septiembre se acepte como año completo.
    ["2026-02","2026-03","2026-04","2026-05","2026-06","2026-07","2026-08"].forEach(period=>{
      const p=distribution[period];
      if(!p||p.rows<20||p.hours<=0){
        throw new Error(`HISTORICO_INCOMPLETO: el período ${period} no contiene registros/horas productivas suficientes.`);
      }
    });

    if(Number(response?.stats?.rma15ConCodigos||0)>0&&valued<=0){
      throw new Error("RMA15 tiene insumos pero el backend no valorizó ningún mantenimiento.");
    }
  }

  return{response,distribution};
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
    distribution:null,
  });

  const loadSnapshot=useCallback(async({background=false}={})=>{
    const sequence=++sequenceRef.current;
    setState(prev=>({...prev,loading:!background,refreshing:background,error:""}));

    try{
      // IMPORTANTE: el Dashboard ya NO abre desde IndexedDB/cache local.
      // Siempre espera un snapshot fresco y validado del Apps Script antes de mostrar números.
      const checked=validateSnapshot(
        await fetchAction(APPS_SCRIPT_URL,"dashboard_snapshot",{
          force:true,
          compact:false,
          retries:1,
          timeoutMs:55000,
        }),
        currentYear,
      );
      const response=checked.response;

      const rop02=applyScope(aliasRows(response.rop02),scope);
      const rma15=applyScope(aliasRows(response.rma15),scope);
      if(!rop02.length)throw new Error("El snapshot no contiene ROP02 para el alcance del usuario.");
      if(!rma15.length)throw new Error("El snapshot no contiene RMA15 para el alcance del usuario.");

      // Validación adicional DESPUÉS de aplicar el alcance del usuario.
      // Oficina Técnica/gerencia es GLOBAL, por lo que julio debe contener horas reales.
      const scopedDistribution=historicalDistribution(rop02);
      if(currentYear===2026&&scope.global){
        const july=scopedDistribution["2026-07"];
        if(!july||july.rows<20||july.hours<=0){
          throw new Error("JULIO_2026_INCOMPLETO: el snapshot recibido no contiene las horas reales del 26/06 al 25/07.");
        }
      }

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
        distribution:scopedDistribution,
      };

      // Se escribe cache sólo como respaldo diagnóstico; nunca se usa para pintar la carga inicial.
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
        distribution:scopedDistribution,
      });
      return cachedValue;
    }catch(error){
      if(!mountedRef.current||sequence!==sequenceRef.current)throw error;
      const message=String(error?.message||error||"No se pudo cargar el Dashboard completo.");
      setState(prev=>({
        ...prev,
        loading:false,
        refreshing:false,
        ready:false,
        error:message,
        rop02:[],
        rma15:[],
      }));
      throw error;
    }
  },[cacheKey,currentYear,scope]);

  useEffect(()=>{
    mountedRef.current=true;
    loadSnapshot({background:false}).catch(()=>{});
    return()=>{
      mountedRef.current=false;
      sequenceRef.current+=1;
    };
  },[loadSnapshot]);

  useEffect(()=>registerRefreshTask(
    "dashboard-verified-snapshot",
    ()=>loadSnapshot({background:state.ready}),
    {views:["dashboard"],priority:10},
  ),[loadSnapshot,state.ready]);

  if(!state.ready&&state.loading){
    return <PageLoadingMotoniveladora label="Cargando y validando histórico completo 2026..."/>;
  }

  if(!state.ready&&state.error){
    return <div style={{maxWidth:900,margin:"48px auto",padding:20,borderRadius:12,border:`1px solid ${C.red}66`,background:C.redDim,color:C.text}}>
      <div style={{fontSize:16,fontWeight:900,color:C.red,marginBottom:8}}>Dashboard bloqueado para evitar datos falsos o parciales</div>
      <div style={{fontSize:12,lineHeight:1.55,color:C.textSub,marginBottom:14}}>{state.error}</div>
      <button type="button" onClick={()=>loadSnapshot({background:false}).catch(()=>{})} style={{border:`1px solid ${C.accent}66`,background:C.accentDim,color:C.accent,borderRadius:8,padding:"8px 13px",fontWeight:800,cursor:"pointer"}}>Reintentar carga verificada</button>
    </div>;
  }

  return <>
    {state.refreshing&&<div style={{marginBottom:8,fontSize:10,color:C.textMuted}}>Actualizando snapshot histórico verificado…</div>}
    <ExecutiveDashboard {...props} rop02All={state.rop02} rma15={state.rma15}/>
  </>;
}
