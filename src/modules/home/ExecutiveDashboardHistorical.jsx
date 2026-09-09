import React,{useCallback,useEffect,useMemo,useRef,useState} from "react";
import ExecutiveDashboard from "./ExecutiveDashboard.jsx";
import {APPS_SCRIPT_URL} from "../../config/app.js";
import {fetchDatasetQuery,runWithConcurrency_} from "../../services/appsScriptApi.js";
import {readCachedSource,writeCachedSource} from "../../services/appCache.js";
import {registerRefreshTask} from "../../services/refreshManager.js";
import {C,PageLoadingMotoniveladora,dmNormalizeAssignedProject,dmProjectMatches} from "../../components/ui/index.jsx";
import {
  cleanMachine,
  dmNormalizeTipoEquipo,
  getInsumoExtra,
  getValue,
  normDate,
  normalizeInsumoCode,
  normalizeROP02,
  toMoneyNumber,
  toNumber,
} from "../../shared/domain/index.jsx";
import {resolveEquipmentCodeAlias} from "../equipment/equipmentCode.js";

const safe=v=>Array.isArray(v)?v:[];
const PAGE_SIZE=2000;
const PAGE_TIMEOUT_MS=52000;
const DASHBOARD_CACHE_VERSION=4;

const normText=v=>String(v??"")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"")
  .replace(/\s+/g," ")
  .trim()
  .toUpperCase();

const pad=n=>String(n).padStart(2,"0");
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

function reportingPeriodForMonth(month){
  const [yy,mm]=String(month||"").split("-").map(Number);
  if(!yy||!mm)return null;
  const start=new Date(yy,mm-2,26,12);
  const end=new Date(yy,mm-1,25,12);
  return{start:ymd(start),end:ymd(end)};
}

function reportingYearRange(year){
  const first=reportingPeriodForMonth(`${year}-01`);
  const last=reportingPeriodForMonth(`${year}-12`);
  return first&&last?{start:first.start,end:last.end}:null;
}

function dashboardScope(){
  if(typeof window==="undefined")return{global:true,project:"TODO",scopeKey:"server"};
  const area=normText(window.sessionStorage?.getItem("dm_area")||"");
  const role=normText(window.sessionStorage?.getItem("dm_role")||"");
  const project=dmNormalizeAssignedProject(window.sessionStorage?.getItem("dm_project")||"TODO");

  // El Dashboard es una vista gerencial transversal para Oficina Técnica y roles de gestión.
  // Esos usuarios deben comparar todos los proyectos, aun cuando su sesión conserve un
  // proyecto operativo seleccionado para las pantallas de carga/control.
  const global=
    area.includes("OFICINA TECNICA")||
    role.includes("GERENTE")||
    role.includes("ADMINISTRADOR")||
    role.includes("PRESIDENTE")||
    project==="TODO";

  return{global,project,scopeKey:global?"GLOBAL":normText(project).replace(/[^A-Z0-9]+/g,"_")};
}

function applyDashboardScope(rows,scope){
  if(scope?.global)return safe(rows);
  return safe(rows).filter(r=>dmProjectMatches(
    r?.proyecto??r?.Proyecto??r?.PROYECTO??r?.lugar??r?.Lugar??"",
    scope?.project||"TODO",
  ));
}

function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}

async function queryPage(dataset,params,attempt=0){
  try{
    const response=await fetchDatasetQuery(APPS_SCRIPT_URL,{
      dataset,
      ...params,
    },{timeoutMs:PAGE_TIMEOUT_MS});
    if(!response?.ok||!Array.isArray(response?.data))throw new Error(`${dataset}: respuesta inválida`);
    return response;
  }catch(error){
    if(attempt<1){
      await sleep(900);
      return queryPage(dataset,params,attempt+1);
    }
    throw error;
  }
}

async function fetchDatasetAllPaged(dataset,{desde="",hasta="",sortBy="fecha",sortDirection="asc"}={}){
  const base={
    limit:PAGE_SIZE,
    offset:0,
    sortBy,
    sortDirection,
  };
  if(desde)base.desde=desde;
  if(hasta)base.hasta=hasta;

  const first=await queryPage(dataset,base);
  const total=Math.max(0,Number(first.total??first.rowsFiltered??first.data.length)||0);
  const rows=[...first.data];

  if(total>rows.length){
    const offsets=[];
    for(let offset=PAGE_SIZE;offset<total;offset+=PAGE_SIZE)offsets.push(offset);
    const pages=await runWithConcurrency_(offsets,2,offset=>queryPage(dataset,{...base,offset}));
    const failures=pages.filter(result=>result.status!=="fulfilled");
    if(failures.length)throw failures[0].reason||new Error(`${dataset}: no se pudieron cargar todas las páginas`);
    pages.forEach(result=>rows.push(...safe(result.value?.data)));
  }

  if(rows.length!==total){
    throw new Error(`${dataset}: carga incompleta (${rows.length} de ${total} registros)`);
  }

  return{rows,total,versions:first.versions||{},backendMs:Number(first.backendMs||0)};
}

function buildInsumosMap(rows){
  const map={};
  safe(rows).forEach(r=>{
    const codigo=normalizeInsumoCode(getValue(r,["CODIGO","Codigo","Código","codigo","código","Cod","cod"])||"");
    if(!codigo)return;
    const descripcion=String(getValue(r,["DESCRIPCIÓN","DESCRIPCION","Descripción","Descripcion","descripcion","Artículo","Articulo","ARTICULO","Insumo","Nombre"])||"").trim();
    const costoUnitario=toMoneyNumber(getValue(r,[
      "COSTO UNITARIO","Costo Unitario","Costo unitario",
      "Precio unitario con IVA","PRECIO UNITARIO CON IVA","precio unitario con IVA",
      "Precio unitario","PRECIO UNITARIO","Precio","PRECIO","Costo","COSTO"
    ]));
    map[codigo]={
      descripcion,
      descripcionAdicional:getInsumoExtra(r,descripcion),
      costoUnitario,
    };
  });
  return map;
}

function normalizeRma15Dashboard(row,insumosMap){
  const fecha=normDate(getValue(row,["Fecha de OT","Fecha"]));
  const maquina=resolveEquipmentCodeAlias(cleanMachine(getValue(row,[
    "CODIGO N° INTERNO","CODIGO NÂ° INTERNO","Codigo N° Interno","Codigo N Interno","Codigo interno","Interno"
  ])));
  if(!fecha||!maquina)return null;

  const proyecto=String(getValue(row,[
    "Proyecto","proyecto","PROYECTO","LUGAR DONDE ESTAN LOS EQUIPOS","Lugar","LUGAR"
  ])||"S/D").trim();

  const insumos=[];
  for(let i=1;i<=10;i+=1){
    const cantidad=toNumber(getValue(row,[`cantidad ${i}`,`Cantidad ${i}`]));
    const codigo=normalizeInsumoCode(getValue(row,[`codigo ${i}`,`Código ${i}`,`Codigo ${i}`])||"");
    const nombre=String(getValue(row,[`nombre ${i}`,`Nombre ${i}`])||"").trim();
    if(!codigo&&cantidad<=0)continue;
    const info=insumosMap[codigo]||{};
    const costoUnitario=Number(info.costoUnitario||0);
    insumos.push({
      cantidad,
      codigo,
      nombre:nombre||info.descripcion||codigo,
      costoUnitario,
      costoTotal:cantidad*costoUnitario,
    });
  }

  return{
    fecha,
    maquina,
    proyecto,
    tipoEquipo:dmNormalizeTipoEquipo(getValue(row,["EQUIPO","Equipo","Tipo Equipo"])||""),
    turno:String(getValue(row,["TURNO EN QUE SE HIZO LA OT","Turno"])||"").trim(),
    tipoMant:String(getValue(row,["TIPO DE MANTENIMIENTO","Tipo de mantenimiento","Tipo Mantenimiento"])||"").trim(),
    kmHs:toNumber(getValue(row,["Km / hs","Km/hs","Km hs"])),
    intervencion:String(getValue(row,[
      "INTERVENCIÓN O REPARACIÓN REALIZADA",
      "INTERVENCION O REPARACION REALIZADA",
      "Intervencion","Reparacion"
    ])||"").trim(),
    operativo:String(getValue(row,["¿EQUIPO QUEDO OPERATIVO?","EQUIPO QUEDO OPERATIVO","Operativo"])||"").trim().toUpperCase()==="SI",
    observaciones:String(getValue(row,["OBSERVACIONES","Observaciones","Observacion"])||"").trim(),
    insumos,
    costoTotal:insumos.reduce((sum,item)=>sum+item.costoTotal,0),
  };
}

function dedupeRop02(rows){
  const map=new Map();
  safe(rows).forEach((r,index)=>{
    const key=[r.fecha,r.maquina,r.proyecto,r.turno,r.parte,r.horometroInicial,r.horometroFinal,index].join("|");
    // El índice solo se usa cuando el registro no tiene número de parte; con parte real
    // se elimina para que una eventual página repetida no duplique horas.
    const stable=r.parte?[r.fecha,r.maquina,r.proyecto,r.turno,r.parte].join("|"):key;
    if(!map.has(stable))map.set(stable,r);
  });
  return[...map.values()];
}

function dedupeRma15(rows){
  const map=new Map();
  safe(rows).forEach((r,index)=>{
    const stable=[r.fecha,r.maquina,r.proyecto,r.turno,r.tipoMant,r.intervencion].join("|")||String(index);
    if(!map.has(stable))map.set(stable,r);
  });
  return[...map.values()];
}

function normalizeCompleteSnapshot({ropRaw,rmaRaw,insumosRaw,scope}){
  const insumosMap=buildInsumosMap(insumosRaw);
  const pricedCount=Object.values(insumosMap).filter(item=>Number(item?.costoUnitario)>0).length;
  if(pricedCount===0)throw new Error("La base de costos no devolvió precios unitarios válidos.");

  const rop02=dedupeRop02(
    normalizeROP02(ropRaw,"")
      .map(r=>({...r,maquina:resolveEquipmentCodeAlias(r.maquina)}))
  );

  const rma15=dedupeRma15(
    safe(rmaRaw)
      .map(row=>normalizeRma15Dashboard(row,insumosMap))
      .filter(Boolean)
  );

  const scopedRop=applyDashboardScope(rop02,scope);
  const scopedRma=applyDashboardScope(rma15,scope);

  if(!scopedRop.length)throw new Error("ROP02 no devolvió registros para el alcance del Dashboard.");
  if(!scopedRma.length)throw new Error("RMA15 no devolvió registros para el alcance del Dashboard.");

  const rawRmaWithCodes=safe(rmaRaw).some(row=>{
    for(let i=1;i<=10;i+=1){
      if(String(getValue(row,[`codigo ${i}`,`Código ${i}`,`Codigo ${i}`])||"").trim())return true;
    }
    return false;
  });
  const valuedRmaCount=scopedRma.filter(r=>Number(r.costoTotal)>0).length;
  if(rawRmaWithCodes&&valuedRmaCount===0){
    throw new Error("RMA15 contiene insumos pero ninguno pudo valorizarse con la base de costos.");
  }

  return{
    rop02:scopedRop,
    rma15:scopedRma,
    stats:{
      rop02:scopedRop.length,
      rma15:scopedRma.length,
      pricedCount,
      valuedRmaCount,
    },
  };
}

function isUsableCachedSnapshot(value){
  return !!(
    value?.ok&&
    Number(value?.cacheVersion)===DASHBOARD_CACHE_VERSION&&
    Array.isArray(value?.rop02)&&value.rop02.length&&
    Array.isArray(value?.rma15)&&value.rma15.length
  );
}

export default function ExecutiveDashboardHistorical(props){
  const currentYear=useMemo(()=>new Date().getFullYear(),[]);
  const yearRange=useMemo(()=>reportingYearRange(currentYear),[currentYear]);
  const scope=useMemo(()=>dashboardScope(),[]);
  const cacheKey=useMemo(()=>`dashboard-full-v${DASHBOARD_CACHE_VERSION}-${currentYear}-${scope.scopeKey}`,[currentYear,scope.scopeKey]);
  const mountedRef=useRef(true);
  const loadSequenceRef=useRef(0);
  const [state,setState]=useState({
    loading:true,
    refreshing:false,
    ready:false,
    error:"",
    rop02:[],
    rma15:[],
    stats:null,
  });

  const loadComplete=useCallback(async({background=false}={})=>{
    const sequence=++loadSequenceRef.current;
    if(!background)setState(prev=>({...prev,loading:true,error:""}));
    else setState(prev=>({...prev,refreshing:true,error:""}));

    try{
      if(!yearRange)throw new Error("No se pudo determinar el período anual del Dashboard.");

      // ROP02 es el dataset más grande. Se pagina de a 2.000 filas para no depender
      // de respuestas gigantes del proxy/Vercel. Cada página se valida contra total.
      const ropResult=await fetchDatasetAllPaged("rop02",{
        desde:yearRange.start,
        hasta:yearRange.end,
        sortBy:"fecha",
        sortDirection:"asc",
      });

      // RMA15 y Costos son bastante menores; se cargan juntos luego de asegurar ROP02.
      const [rmaResult,insumosResult]=await Promise.all([
        fetchDatasetAllPaged("rma15",{
          desde:yearRange.start,
          hasta:yearRange.end,
          sortBy:"fecha",
          sortDirection:"asc",
        }),
        fetchDatasetAllPaged("insumos",{sortBy:"Codigo",sortDirection:"asc"}),
      ]);

      const snapshot=normalizeCompleteSnapshot({
        ropRaw:ropResult.rows,
        rmaRaw:rmaResult.rows,
        insumosRaw:insumosResult.rows,
        scope,
      });

      const cachedValue={
        ok:true,
        cacheVersion:DASHBOARD_CACHE_VERSION,
        year:currentYear,
        scopeKey:scope.scopeKey,
        updatedAt:new Date().toISOString(),
        rop02:snapshot.rop02,
        rma15:snapshot.rma15,
        stats:{
          ...snapshot.stats,
          rop02Raw:ropResult.total,
          rma15Raw:rmaResult.total,
          insumosRaw:insumosResult.total,
        },
      };

      await writeCachedSource(cacheKey,cachedValue).catch(()=>{});
      if(!mountedRef.current||sequence!==loadSequenceRef.current)return cachedValue;
      setState({
        loading:false,
        refreshing:false,
        ready:true,
        error:"",
        rop02:cachedValue.rop02,
        rma15:cachedValue.rma15,
        stats:cachedValue.stats,
      });
      return cachedValue;
    }catch(error){
      if(!mountedRef.current||sequence!==loadSequenceRef.current)throw error;
      const message=String(error?.message||error||"No se pudo cargar el Dashboard completo.");
      setState(prev=>({
        ...prev,
        loading:false,
        refreshing:false,
        error:message,
      }));
      throw error;
    }
  },[cacheKey,currentYear,scope,yearRange]);

  useEffect(()=>{
    mountedRef.current=true;
    let cancelled=false;
    (async()=>{
      const cached=await readCachedSource(cacheKey).catch(()=>null);
      const value=cached?.data??cached?.value??null;
      const usable=isUsableCachedSnapshot(value);
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
        });
      }

      loadComplete({background:usable}).catch(()=>{});
    })();

    return()=>{
      cancelled=true;
      mountedRef.current=false;
      loadSequenceRef.current+=1;
    };
  },[cacheKey,loadComplete]);

  useEffect(()=>registerRefreshTask(
    "dashboard-complete-history",
    ()=>loadComplete({background:state.ready}),
    {views:["dashboard"],priority:10},
  ),[loadComplete,state.ready]);

  const effectiveRop02=useMemo(()=>state.rop02,[state.rop02]);
  const effectiveRma15=useMemo(()=>state.rma15,[state.rma15]);

  if(!state.ready&&state.loading){
    return <PageLoadingMotoniveladora label="Cargando Dashboard completo..."/>;
  }

  if(!state.ready&&state.error){
    return <div style={{maxWidth:820,margin:"48px auto",padding:20,borderRadius:12,border:`1px solid ${C.red}66`,background:C.redDim,color:C.text}}>
      <div style={{fontSize:16,fontWeight:900,color:C.red,marginBottom:8}}>No se muestran indicadores parciales</div>
      <div style={{fontSize:12,lineHeight:1.55,color:C.textSub,marginBottom:14}}>{state.error}</div>
      <button type="button" onClick={()=>loadComplete({background:false}).catch(()=>{})} style={{border:`1px solid ${C.accent}66`,background:C.accentDim,color:C.accent,borderRadius:8,padding:"8px 13px",fontWeight:800,cursor:"pointer"}}>Reintentar carga completa</button>
    </div>;
  }

  return <>
    {state.error&&<div style={{marginBottom:10,padding:"9px 12px",borderRadius:8,border:`1px solid ${C.yellow}55`,background:C.yellowDim,color:C.textSub,fontSize:11}}>{state.error} Se mantienen los últimos datos completos verificados.</div>}
    {state.refreshing&&<div style={{marginBottom:8,fontSize:10,color:C.textMuted}}>Actualizando historial completo del Dashboard en segundo plano…</div>}
    <ExecutiveDashboard {...props} rop02All={effectiveRop02} rma15={effectiveRma15}/>
  </>;
}
