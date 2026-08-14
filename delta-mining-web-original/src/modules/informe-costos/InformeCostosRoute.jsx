import React from "react";
import { InformeCostosBoundary, InformeCostosLoading } from "./components/InformeCostosBoundary.jsx";
import {getRma15,getRma15EquipmentUniverse,getRop02} from "../../data/historicalDataService.js";
import {normalizeRMA15,normalizeROP02} from "../../shared/domain/index.jsx";

const LazyInformeCostosView = React.lazy(() =>
  import("./InformeCostosView.jsx").then((module) => ({ default: module.MemoViewCostosMant })),
);

const STATE_KEY="delta_costos_mant_state_v1";
const today=()=>new Date().toISOString().slice(0,10);
function readQuerySpec(){
  let state={};try{state=JSON.parse(window.localStorage.getItem(STATE_KEY)||"{}");}catch(_){}
  const tab=state.tab||"t1",historical=tab==="t9"||tab==="t10",monthly=["t4","t5","t6","t8"].includes(tab);
  if(historical)return{desde:state.fechaHistoricaDesde||"2026-01-01",hasta:state.fechaHistoricaHasta||today(),tab};
  if(monthly)return{desde:state.fechaDCostoMensual||"2026-01-01",hasta:state.fechaHCostoMensual||today(),tab};
  if(state.modoFecha==="dia"&&state.fechaDia)return{desde:state.fechaDia,hasta:state.fechaDia,tab};
  return{desde:state.fechaD||"2026-01-01",hasta:state.fechaH||today(),tab};
}

function InformeCostosRoute(props) {
  const [querySpec,setQuerySpec]=React.useState(readQuerySpec);
  const [remote,setRemote]=React.useState({rma15:null,rop02:null,equipmentUniverse:null,loading:true});
  React.useEffect(()=>{const update=()=>setQuerySpec(readQuerySpec());window.addEventListener("dm-costos-mant-state-updated",update);return()=>window.removeEventListener("dm-costos-mant-state-updated",update);},[]);
  React.useEffect(()=>{
    let alive=true;setRemote(previous=>({...previous,loading:true}));
    Promise.allSettled([
      getRma15({desde:querySpec.desde,hasta:querySpec.hasta,limit:"all",sortBy:"fecha",sortDirection:"asc"}),
      getRop02({desde:querySpec.desde,hasta:querySpec.hasta,limit:"all",sortBy:"fecha",sortDirection:"asc"}),
      getRma15EquipmentUniverse({year:"2026"}),
    ]).then(([rmaResult,ropResult,universeResult])=>{
      if(!alive)return;
      const rma=rmaResult.status==="fulfilled"?rmaResult.value:null,rop=ropResult.status==="fulfilled"?ropResult.value:null,universe=universeResult.status==="fulfilled"?universeResult.value:null;
      setRemote({rma15:rma?(rma.data||[]).map(row=>normalizeRMA15({...row,_proyectoForzado:row.Proyecto||row.proyecto||"S/D"},props.insumos||{})):null,rop02:rop?normalizeROP02(rop.data||[]):null,equipmentUniverse:Array.isArray(universe?.data)?new Set(universe.data):null,loading:false});
    });
    return()=>{alive=false;};
  },[querySpec.desde,querySpec.hasta,props.insumos]);
  const viewProps={...props,rma15:remote.rma15??props.rma15??[],rop02:remote.rop02??props.rop02??[],equipmentUniverse:remote.equipmentUniverse};
  return (
    <InformeCostosBoundary>
      <React.Suspense fallback={<InformeCostosLoading />}>
        <LazyInformeCostosView {...viewProps} />
      </React.Suspense>
    </InformeCostosBoundary>
  );
}

export default InformeCostosRoute;
