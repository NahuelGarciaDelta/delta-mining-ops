import React from "react";
import { PageLoadingMotoniveladora } from "../../components/ui/index.jsx";
import {createHistoricalPagedController,fetchAllDatasetPages} from "../../data/historicalDataService.js";
import {normalizeRMA15} from "../../shared/domain/index.jsx";
const LazyMantenimientoModule = React.lazy(() => import("./MantenimientoModule.jsx"));
export default function MantenimientoRoute(props){
  const controllerRef=React.useRef(null),[remote,setRemote]=React.useState(null);
  if(!controllerRef.current)controllerRef.current=createHistoricalPagedController();
  const state=props.extState||{},single=value=>Array.isArray(value)?(value.length===1?value[0]:""):value;
  const mainSort=state.rma15Sorts?.ordenesPeriodo;
  const params=React.useMemo(()=>({desde:state.modo==="dia"?(state.fechaDia||""):(state.fechaD||""),hasta:state.modo==="dia"?(state.fechaDia||""):(state.fechaH||""),proyecto:single(state.proyecto)!=="todos"?single(state.proyecto):"",equipo:single(state.maquina)!=="todas"?single(state.maquina):"",tipo:single(state.tipoMant)!=="todos"?single(state.tipoMant):"",sortBy:mainSort?.key||"fecha",sortDirection:mainSort?.dir||"desc"}),[state.modo,state.fechaDia,state.fechaD,state.fechaH,state.proyecto,state.maquina,state.tipoMant,mainSort?.key,mainSort?.dir]);
  React.useEffect(()=>{if(props.mode!=="mantenimiento")return;let alive=true;controllerRef.current.loadFirst("rma15",params).then(result=>{if(!alive||result.stale)return;setRemote({rows:(result.rows||[]).map(row=>normalizeRMA15({...row,_proyectoForzado:row.Proyecto||row.proyecto||"S/D"},props.insumos||{})),total:result.total,hasMore:result.hasMore});}).catch(()=>{});return()=>{alive=false;};},[props.mode,params,props.insumos]);
  const loadMore=React.useCallback(()=>controllerRef.current.loadMore("rma15",params).then(result=>{if(!result.stale)setRemote({rows:(result.rows||[]).map(row=>normalizeRMA15({...row,_proyectoForzado:row.Proyecto||row.proyecto||"S/D"},props.insumos||{})),total:result.total,hasMore:result.hasMore});}),[params,props.insumos]);
  const exportAll=React.useCallback(async()=>{const rows=[];await fetchAllDatasetPages("rma15",params,page=>{rows.push(...page);});return rows.map(row=>normalizeRMA15({...row,_proyectoForzado:row.Proyecto||row.proyecto||"S/D"},props.insumos||{}));},[params,props.insumos]);
  const effective=props.mode==="mantenimiento"&&remote?{...props,rma15:remote.rows,remoteTotal:remote.total,remoteHasMore:remote.hasMore,onRemoteMore:loadMore,onRemoteExport:exportAll}:props;
  return <React.Suspense fallback={<PageLoadingMotoniveladora label="Cargando Mantenimiento..."/>}><LazyMantenimientoModule {...effective}/></React.Suspense>;
}
