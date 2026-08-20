import React from "react";
import { PageLoadingMotoniveladora } from "../../components/ui/index.jsx";
import {createHistoricalPagedController,fetchAllDatasetPages} from "../../data/historicalDataService.js";
import {normalizeRMA15} from "../../shared/domain/index.jsx";

const LazyMantenimientoModule = React.lazy(() => import("./MantenimientoModule.jsx"));

function cloneRma15Rows(rows){
  return (Array.isArray(rows)?rows:[]).map(row=>{
    if(!row||typeof row!=="object")return row;
    const copy={...row};
    if(Array.isArray(row.insumos))copy.insumos=row.insumos.map(item=>item&&typeof item==="object"?{...item}:item);
    return copy;
  });
}

function normalizeRemoteRows(rows,insumos){
  return (Array.isArray(rows)?rows:[]).map(row=>normalizeRMA15({
    ...row,
    _proyectoForzado:row.Proyecto||row.proyecto||"S/D"
  },insumos||{}));
}

export default function MantenimientoRoute(props){
  const controllerRef=React.useRef(null);
  const requestRef=React.useRef(0);
  const [remote,setRemote]=React.useState(null);

  if(!controllerRef.current)controllerRef.current=createHistoricalPagedController();

  // Boundary de datos propio de Mantenimiento. Nunca se entregan al módulo las
  // mismas referencias que usa App/Informe de Costos.
  const baseRma15=React.useMemo(()=>cloneRma15Rows(props.rma15),[props.rma15]);

  const state=props.extState||{};
  const single=value=>Array.isArray(value)?(value.length===1?value[0]:""):value;
  const mainSort=state.rma15Sorts?.ordenesPeriodo;
  const params=React.useMemo(()=>({
    desde:state.modo==="dia"?(state.fechaDia||""):(state.fechaD||""),
    hasta:state.modo==="dia"?(state.fechaDia||""):(state.fechaH||""),
    proyecto:single(state.proyecto)!=="todos"?single(state.proyecto):"",
    equipo:single(state.maquina)!=="todas"?single(state.maquina):"",
    tipo:single(state.tipoMant)!=="todos"?single(state.tipoMant):"",
    sortBy:mainSort?.key||"fecha",
    sortDirection:mainSort?.dir||"desc"
  }),[state.modo,state.fechaDia,state.fechaD,state.fechaH,state.proyecto,state.maquina,state.tipoMant,mainSort?.key,mainSort?.dir]);

  // Sin filtros visibles, Mantenimiento debe trabajar con TODO el RMA15 ya
  // hidratado en App. No se consulta la primera página remota porque esa página
  // (habitualmente 250 filas) no representa el universo completo y hacía caer
  // los KPIs de ~1.200 OT a 250 OT unos segundos después de entrar.
  const hasRemoteFilter=React.useMemo(()=>Boolean(
    params.desde||params.hasta||params.proyecto||params.equipo||params.tipo
  ),[params.desde,params.hasta,params.proyecto,params.equipo,params.tipo]);

  React.useEffect(()=>{
    if(props.mode!=="mantenimiento"||!hasRemoteFilter){
      ++requestRef.current;
      setRemote(null);
      return;
    }

    const requestId=++requestRef.current;
    let alive=true;

    // No conservar resultados filtrados de una consulta anterior mientras llega
    // la nueva. Esto evita saltos de totales causados por respuestas tardías.
    setRemote(null);

    controllerRef.current.loadFirst("rma15",params).then(result=>{
      if(!alive||requestId!==requestRef.current||result.stale)return;
      setRemote({
        rows:cloneRma15Rows(normalizeRemoteRows(result.rows,props.insumos)),
        total:result.total,
        hasMore:result.hasMore,
        requestId
      });
    }).catch(()=>{});

    return()=>{alive=false;};
  },[props.mode,hasRemoteFilter,params,props.insumos]);

  const loadMore=React.useCallback(()=>{
    if(!hasRemoteFilter)return Promise.resolve(null);
    const requestId=requestRef.current;
    return controllerRef.current.loadMore("rma15",params).then(result=>{
      if(requestId!==requestRef.current||result.stale)return result;
      setRemote({
        rows:cloneRma15Rows(normalizeRemoteRows(result.rows,props.insumos)),
        total:result.total,
        hasMore:result.hasMore,
        requestId
      });
      return result;
    });
  },[hasRemoteFilter,params,props.insumos]);

  const exportAll=React.useCallback(async()=>{
    if(!hasRemoteFilter)return cloneRma15Rows(baseRma15);
    const rows=[];
    await fetchAllDatasetPages("rma15",params,page=>{rows.push(...page);});
    return cloneRma15Rows(normalizeRemoteRows(rows,props.insumos));
  },[hasRemoteFilter,baseRma15,params,props.insumos]);

  const effective=React.useMemo(()=>{
    const isolatedProps={...props,rma15:baseRma15};
    if(props.mode!=="mantenimiento"||!hasRemoteFilter||!remote)return isolatedProps;
    return {
      ...isolatedProps,
      rma15:cloneRma15Rows(remote.rows),
      remoteTotal:remote.total,
      remoteHasMore:remote.hasMore,
      onRemoteMore:loadMore,
      onRemoteExport:exportAll
    };
  },[props,baseRma15,hasRemoteFilter,remote,loadMore,exportAll]);

  return (
    <React.Suspense fallback={<PageLoadingMotoniveladora label="Cargando Mantenimiento..."/>}>
      <LazyMantenimientoModule {...effective}/>
    </React.Suspense>
  );
}
