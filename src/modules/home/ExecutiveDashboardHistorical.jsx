import React,{useEffect,useMemo,useRef,useState} from "react";
import ExecutiveDashboard from "./ExecutiveDashboard.jsx";
import {APPS_SCRIPT_URL} from "../../config/app.js";
import {fetchSource,runWithConcurrency_} from "../../services/appsScriptApi.js";
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

const ROP02_SOURCES=[
  {key:"rop02_jm",project:"JOSE MARIA"},
  {key:"rop02_fs",project:"FILO DEL SOL"},
  {key:"rop02_filosur",project:"FILO SUR"},
  {key:"rop02_zorro",project:"EL ZORRO"},
];
const RMA15_SOURCES=[
  {key:"rma15_jm",project:"JOSE MARIA"},
  {key:"rma15_fs",project:"FILO DEL SOL"},
];
const REQUIRED_SOURCES=[...ROP02_SOURCES,...RMA15_SOURCES,{key:"insumos",project:""}];

function assignedProject(){
  if(typeof window==="undefined")return"TODO";
  return dmNormalizeAssignedProject(window.sessionStorage?.getItem("dm_project")||"TODO");
}

function scopeRows(rows){
  const assigned=assignedProject();
  return safe(rows).filter(r=>dmProjectMatches(
    r?.proyecto??r?.Proyecto??r?.PROYECTO??r?.lugar??r?.Lugar??"",
    assigned,
  ));
}

function isCompleteSource(source){
  return !!(
    source?.ok&&
    Array.isArray(source?.data)&&
    source?.meta?.hasMore!==true&&
    source?.hasMore!==true
  );
}

function buildInsumosMap(rows){
  const map={};
  safe(rows).forEach(r=>{
    const codigo=normalizeInsumoCode(getValue(r,["CODIGO","Codigo","Código","codigo","código","Cod","cod"])||"");
    if(!codigo)return;
    const descripcion=String(getValue(r,["DESCRIPCIÓN","DESCRIPCION","Descripción","Descripcion","descripcion","Artículo","Articulo","ARTICULO","Insumo","Nombre"])||"").trim();
    map[codigo]={
      descripcion,
      descripcionAdicional:getInsumoExtra(r,descripcion),
      costoUnitario:toMoneyNumber(getValue(r,["COSTO UNITARIO","Costo Unitario","Costo unitario","Precio unitario con IVA","PRECIO UNITARIO CON IVA","precio unitario con IVA","Precio unitario","PRECIO UNITARIO","Precio","PRECIO","Costo","COSTO"])),
    };
  });
  return map;
}

// Normalización específica del Dashboard. Usa toNumber para cantidades porque RMA15
// contiene decimales con coma (por ejemplo 0,5); parseFloat + eliminación de coma
// convertía 0,5 en 5 y multiplicaba costos por diez.
function normalizeRma15Dashboard(row,project,insumosMap){
  const fecha=normDate(getValue(row,["Fecha de OT","Fecha"]));
  const maquina=resolveEquipmentCodeAlias(cleanMachine(getValue(row,["CODIGO N° INTERNO","Codigo N° Interno","Codigo interno","Interno"])));
  if(!fecha||!maquina)return null;

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
    proyecto:project,
    tipoEquipo:dmNormalizeTipoEquipo(getValue(row,["EQUIPO","Equipo","Tipo Equipo"])||""),
    turno:String(getValue(row,["TURNO EN QUE SE HIZO LA OT","Turno"])||"").trim(),
    tipoMant:String(getValue(row,["TIPO DE MANTENIMIENTO","Tipo de mantenimiento","Tipo Mantenimiento"])||"").trim(),
    kmHs:toNumber(getValue(row,["Km / hs","Km/hs","Km hs"])),
    intervencion:String(getValue(row,["INTERVENCIÓN O REPARACIÓN REALIZADA","INTERVENCION O REPARACION REALIZADA","Intervencion","Reparacion"])||"").trim(),
    operativo:String(getValue(row,["¿EQUIPO QUEDO OPERATIVO?","EQUIPO QUEDO OPERATIVO","Operativo"])||"").trim().toUpperCase()==="SI",
    observaciones:String(getValue(row,["OBSERVACIONES","Observaciones","Observacion"])||"").trim(),
    insumos,
    costoTotal:insumos.reduce((sum,item)=>sum+item.costoTotal,0),
  };
}

function buildNormalizedSnapshot(sources){
  const insumosMap=buildInsumosMap(sources.insumos?.data);
  if(!Object.keys(insumosMap).length)throw new Error("La base de costos no devolvió artículos valorizados.");

  const rop02=[];
  ROP02_SOURCES.forEach(source=>{
    const rows=normalizeROP02(safe(sources[source.key]?.data),source.project)
      .map(r=>({...r,maquina:resolveEquipmentCodeAlias(r.maquina)}));
    rop02.push(...rows);
  });

  const rma15=[];
  RMA15_SOURCES.forEach(source=>{
    safe(sources[source.key]?.data).forEach(row=>{
      const normalized=normalizeRma15Dashboard(row,source.project,insumosMap);
      if(normalized)rma15.push(normalized);
    });
  });

  const scopedRop=scopeRows(rop02);
  const scopedRma=scopeRows(rma15);
  if(!scopedRop.length)throw new Error("ROP02 no devolvió registros para el alcance del usuario.");
  if(!scopedRma.length)throw new Error("RMA15 no devolvió registros para el alcance del usuario.");

  return{rop02:scopedRop,rma15:scopedRma,insumosMap};
}

async function fetchCompleteSource(key,rawSources){
  try{
    const response=await fetchSource(APPS_SCRIPT_URL,key,{
      force:true,
      retries:0,
      timeoutMs:key.startsWith("rop02_")?60000:45000,
    });
    if(!isCompleteSource(response))throw new Error(`${key}: respuesta incompleta`);
    return response;
  }catch(error){
    const local=rawSources?.[key];
    if(isCompleteSource(local))return local;
    throw error;
  }
}

export default function ExecutiveDashboardHistorical(props){
  const mountedRef=useRef(true);
  const [reloadToken,setReloadToken]=useState(0);
  const [state,setState]=useState({loading:true,ready:false,error:"",rop02:[],rma15:[]});

  useEffect(()=>{
    mountedRef.current=true;
    let cancelled=false;

    const load=async()=>{
      setState(prev=>({...prev,loading:true,error:""}));
      const results=await runWithConcurrency_(REQUIRED_SOURCES,2,source=>fetchCompleteSource(source.key,props?.rawSources||{}));
      if(cancelled||!mountedRef.current)return;

      const failures=results
        .map((result,index)=>({result,source:REQUIRED_SOURCES[index]}))
        .filter(({result})=>result.status!=="fulfilled");

      if(failures.length){
        const detail=failures.map(({source,result})=>`${source.key}: ${String(result.reason?.message||result.reason||"sin respuesta")}`).join(" · ");
        setState(prev=>({...prev,loading:false,error:`No se cargó el Dashboard completo. ${detail}`}));
        return;
      }

      try{
        const sources={};
        results.forEach((result,index)=>{sources[REQUIRED_SOURCES[index].key]=result.value;});
        const snapshot=buildNormalizedSnapshot(sources);
        setState({loading:false,ready:true,error:"",rop02:snapshot.rop02,rma15:snapshot.rma15});
      }catch(error){
        setState(prev=>({...prev,loading:false,error:String(error?.message||error)}));
      }
    };

    load();
    return()=>{cancelled=true;mountedRef.current=false;};
  },[reloadToken]);

  const effectiveRop02=useMemo(()=>state.rop02,[state.rop02]);
  const effectiveRma15=useMemo(()=>state.rma15,[state.rma15]);

  if(!state.ready&&state.loading){
    return <PageLoadingMotoniveladora label="Cargando Dashboard con datos completos..."/>;
  }

  if(!state.ready&&state.error){
    return <div style={{maxWidth:760,margin:"48px auto",padding:20,borderRadius:12,border:`1px solid ${C.red}66`,background:C.redDim,color:C.text}}>
      <div style={{fontSize:16,fontWeight:900,color:C.red,marginBottom:8}}>No se muestran indicadores parciales</div>
      <div style={{fontSize:12,lineHeight:1.55,color:C.textSub,marginBottom:14}}>{state.error}</div>
      <button type="button" onClick={()=>setReloadToken(v=>v+1)} style={{border:`1px solid ${C.accent}66`,background:C.accentDim,color:C.accent,borderRadius:8,padding:"8px 13px",fontWeight:800,cursor:"pointer"}}>Reintentar carga completa</button>
    </div>;
  }

  return <>
    {state.error&&<div style={{marginBottom:10,padding:"9px 12px",borderRadius:8,border:`1px solid ${C.yellow}55`,background:C.yellowDim,color:C.textSub,fontSize:11}}>{state.error} Se mantienen los últimos datos completos cargados.</div>}
    <ExecutiveDashboard {...props} rop02All={effectiveRop02} rma15={effectiveRma15}/>
  </>;
}
