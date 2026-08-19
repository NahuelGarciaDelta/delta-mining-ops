import React from "react";
import { InformeCostosBoundary, InformeCostosLoading } from "./components/InformeCostosBoundary.jsx";
import {getRma15,getRop02} from "../../data/historicalDataService.js";
import {getValue,normalizeRMA15,normalizeROP02} from "../../shared/domain/index.jsx";

const LazyInformeCostosView = React.lazy(() =>
  import("./InformeCostosView.jsx").then((module) => ({ default: module.MemoViewCostosMant })),
);

const STATE_KEY="delta_costos_mant_state_v1";
const today=()=>new Date().toISOString().slice(0,10);
function readQuerySpec(){
  let state={};try{state=JSON.parse(window.localStorage.getItem(STATE_KEY)||"{}");}catch(_){}
  const tab=state.tab||"t1",historical=tab==="t9"||tab==="t10",monthly=["t4","t5","t6","t8"].includes(tab);
  if(historical)return{desde:state.fechaHistoricaDesde||"2026-01-01",hasta:state.fechaHistoricaHasta||today(),tab};
  if(monthly)return{desde:state.fechaDCostoMensual||state.fechaD||"2026-01-01",hasta:state.fechaHCostoMensual||state.fechaH||today(),tab};
  if(state.modoFecha==="dia"&&state.fechaDia)return{desde:state.fechaDia,hasta:state.fechaDia,tab};
  return{desde:state.fechaD||"2026-01-01",hasta:state.fechaH||today(),tab};
}

function canonicalizeRma15Row(row){
  const r=row||{};
  const out={...r};
  out["Fecha de OT"]=getValue(r,["Fecha de OT","FECHA DE OT","Fecha OT","Fecha","FECHA"]);
  out["CODIGO N° INTERNO"]=getValue(r,[
    "CODIGO N° INTERNO","CODIGO NÂ° INTERNO","CÓDIGO N° INTERNO","CÓDIGO Nº INTERNO",
    "Codigo N° Interno","Codigo Nº Interno","Codigo N Interno","Código Interno",
    "Codigo Interno","Codigo interno del equipo","Código interno del equipo","Codigo Int","Interno"
  ]);
  out["EQUIPO"]=getValue(r,["EQUIPO","Equipo","Tipo Equipo","Tipo de equipo"]);
  out["TURNO EN QUE SE HIZO LA OT"]=getValue(r,["TURNO EN QUE SE HIZO LA OT","Turno en que se hizo la OT","Turno","TURNO"]);
  out["TIPO DE MANTENIMIENTO"]=getValue(r,["TIPO DE MANTENIMIENTO","Tipo de mantenimiento","Tipo Mantenimiento","TIPO MANTENIMIENTO"]);
  out["Km / hs"]=getValue(r,["Km / hs","KM / HS","Km/hs","Km Hs","Horómetro","Horometro","Horas"]);
  out["INTERVENCIÓN O REPARACIÓN REALIZADA (Si es PM, especificar cual) LOS SOPLETEOS DE FILTROS VAN EN ESTA SECCION O CUALQUIER SERVICIO QUE SE REALICE)"]=getValue(r,[
    "INTERVENCIÓN O REPARACIÓN REALIZADA (Si es PM, especificar cual) LOS SOPLETEOS DE FILTROS VAN EN ESTA SECCION O CUALQUIER SERVICIO QUE SE REALICE)",
    "Intervención o reparación realizada","Intervencion o reparacion realizada","Intervención","Intervencion","Reparación","Reparacion"
  ]);
  out["¿EQUIPO QUEDO OPERATIVO?"]=getValue(r,[
    "¿EQUIPO QUEDO OPERATIVO?","¿EQUIPO QUEDÓ OPERATIVO?","EQUIPO QUEDO OPERATIVO",
    "EQUIPO QUEDÓ OPERATIVO","Operativo","Estado operativo","Estado"
  ]);
  out["OBSERVACIONES"]=getValue(r,["OBSERVACIONES","Observaciones","Observación","Observacion"]);
  for(let i=1;i<=10;i++){
    out[`cantidad ${i}`]=getValue(r,[`cantidad ${i}`,`Cantidad ${i}`,`CANTIDAD ${i}`,`cant ${i}`,`Cant ${i}`]);
    out[`codigo ${i}`]=getValue(r,[`codigo ${i}`,`Código ${i}`,`Codigo ${i}`,`CODIGO ${i}`,`CÓDIGO ${i}`]);
    out[`nombre ${i}`]=getValue(r,[`nombre ${i}`,`Nombre ${i}`,`NOMBRE ${i}`,`descripcion ${i}`,`Descripción ${i}`]);
  }
  return out;
}

function rmaKey(row){
  return JSON.stringify([
    String(row?.fecha||"").slice(0,10),String(row?.maquina||"").trim().toUpperCase(),
    String(row?.tipoMant||"").trim().toUpperCase(),String(row?.turno||"").trim().toUpperCase(),
    String(row?.kmHs??""),String(row?.intervencion||"").trim().toUpperCase(),
  ]);
}
function rmaRichness(row){
  const ins=Array.isArray(row?.insumos)?row.insumos:[];
  return ins.length*10+ins.filter(x=>Number(x?.costoTotal)>0).length*100+(Number(row?.costoTotal)>0?1000:0);
}
function mergeRma15(baseRows,remoteRows){
  const map=new Map();
  for(const row of [...(Array.isArray(baseRows)?baseRows:[]),...(Array.isArray(remoteRows)?remoteRows:[])]){
    if(!row?.fecha||!row?.maquina)continue;
    const key=rmaKey(row),prev=map.get(key);
    if(!prev||rmaRichness(row)>=rmaRichness(prev))map.set(key,row);
  }
  return [...map.values()].sort((a,b)=>String(a?.fecha||"").localeCompare(String(b?.fecha||"")));
}
function ropKey(row){
  return JSON.stringify([row?.fecha||"",row?.maquina||row?._internoRaw||"",row?.proyecto||"",row?.turno||"",row?.parte||"",row?.operario||"",row?.horometroInicial??"",row?.horometroFinal??"",row?.horas??""]);
}
function mergeRop02(baseRows,remoteRows){
  const map=new Map();
  for(const row of [...(Array.isArray(baseRows)?baseRows:[]),...(Array.isArray(remoteRows)?remoteRows:[])]){
    if(!row?.fecha||!row?.maquina)continue;
    map.set(ropKey(row),row);
  }
  return [...map.values()].sort((a,b)=>String(a?.fecha||"").localeCompare(String(b?.fecha||"")));
}

function InformeCostosRoute(props) {
  const [querySpec,setQuerySpec]=React.useState(readQuerySpec);
  const [remote,setRemote]=React.useState({rma15:null,rop02:null,loading:true});
  React.useEffect(()=>{const update=()=>setQuerySpec(readQuerySpec());window.addEventListener("dm-costos-mant-state-updated",update);return()=>window.removeEventListener("dm-costos-mant-state-updated",update);},[]);
  React.useEffect(()=>{
    let alive=true;setRemote(previous=>({...previous,loading:true}));
    Promise.allSettled([
      getRma15({desde:querySpec.desde,hasta:querySpec.hasta,limit:"all",sortBy:"fecha",sortDirection:"asc"}),
      getRop02({desde:querySpec.desde,hasta:querySpec.hasta,limit:"all",sortBy:"fecha",sortDirection:"asc"}),
    ]).then(([rmaResult,ropResult])=>{
      if(!alive)return;
      const rma=rmaResult.status==="fulfilled"?rmaResult.value:null,rop=ropResult.status==="fulfilled"?ropResult.value:null;
      const normalizedRma=rma?(rma.data||[])
        .map(row=>canonicalizeRma15Row({...row,_proyectoForzado:row.Proyecto||row.proyecto||"S/D"}))
        .map(row=>normalizeRMA15(row,props.insumos||{}))
        .filter(row=>row.fecha&&row.maquina):null;
      setRemote({rma15:normalizedRma,rop02:rop?normalizeROP02(rop.data||[]):null,loading:false});
    });
    return()=>{alive=false;};
  },[querySpec.desde,querySpec.hasta,props.insumos]);

  // La consulta histórica puede devolver sólo el rango actualmente pedido. Nunca debe
  // reemplazar la base RMA15 que ya tiene cargada la app: se fusionan ambas fuentes.
  // Para registros duplicados se conserva la versión con mayor detalle/costo de insumos.
  const mergedRma15=React.useMemo(()=>mergeRma15(props.rma15||[],remote.rma15||[]),[props.rma15,remote.rma15]);
  const mergedRop02=React.useMemo(()=>mergeRop02(props.rop02||[],remote.rop02||[]),[props.rop02,remote.rop02]);

  // IMPORTANTE: el universo visible se deriva del RMA15 fusionado dentro de la vista.
  // No usamos get_rma15_equipment_universe como filtro autoritativo porque una respuesta
  // parcial del endpoint puede reducir el informe a unos pocos internos aunque existan
  // registros RMA15 válidos ya cargados en la aplicación.
  const viewProps={...props,rma15:mergedRma15,rop02:mergedRop02,equipmentUniverse:null};
  return (
    <InformeCostosBoundary>
      <React.Suspense fallback={<InformeCostosLoading />}>
        <LazyInformeCostosView {...viewProps} />
      </React.Suspense>
    </InformeCostosBoundary>
  );
}

export default InformeCostosRoute;
