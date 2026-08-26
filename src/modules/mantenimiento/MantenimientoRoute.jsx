import React from "react";
import { PageLoadingMotoniveladora } from "../../components/ui/index.jsx";
import {createHistoricalPagedController,fetchAllDatasetPages} from "../../data/historicalDataService.js";
import {normalizeRMA15} from "../../shared/domain/index.jsx";
import DesgasteView from "./DesgasteView.jsx";

const LazyMantenimientoModule = React.lazy(() => import("./MantenimientoModule.jsx"));
const WEAR_FLAG="dm_rma15_subview";

function cloneRma15Rows(rows){
  return (Array.isArray(rows)?rows:[]).map(row=>{
    if(!row||typeof row!=="object")return row;
    const copy={...row};
    if(Array.isArray(row.insumos))copy.insumos=row.insumos.map(item=>item&&typeof item==="object"?{...item}:item);
    return copy;
  });
}

function normalizeRemoteRows(rows,insumos){
  return (Array.isArray(rows)?rows:[]).map(row=>normalizeRMA15({...row,_proyectoForzado:row.Proyecto||row.proyecto||"S/D"},insumos||{}));
}

function installWearSidebarButton_(openWear){
  const install=()=>{
    const buttons=[...document.querySelectorAll("nav button")];
    const mant=buttons.find(b=>String(b.textContent||"").trim()==="Mantenimiento");
    if(!mant||document.getElementById("dm-sidebar-desgaste"))return;
    const btn=mant.cloneNode(true);
    btn.id="dm-sidebar-desgaste";
    const label=[...btn.querySelectorAll("span")].find(s=>String(s.textContent||"").trim()==="Mantenimiento");
    if(label)label.textContent="Desgaste";
    btn.title="Desgaste";
    btn.onclick=e=>{e.preventDefault();e.stopPropagation();openWear();};
    mant.parentNode.insertBefore(btn,mant.nextSibling);
  };
  install();
  const observer=new MutationObserver(install);
  observer.observe(document.body,{childList:true,subtree:true});
  return()=>observer.disconnect();
}

export default function MantenimientoRoute(props){
  const controllerRef=React.useRef(null);
  const requestRef=React.useRef(0);
  const [remote,setRemote]=React.useState(null);
  const [wearMode,setWearMode]=React.useState(()=>sessionStorage.getItem(WEAR_FLAG)==="desgaste");

  React.useEffect(()=>installWearSidebarButton_(()=>{sessionStorage.setItem(WEAR_FLAG,"desgaste");setWearMode(true);}),[]);
  React.useEffect(()=>{
    const handler=e=>{
      const btn=e.target?.closest?.("nav button");
      if(!btn||btn.id==="dm-sidebar-desgaste")return;
      if(String(btn.textContent||"").trim()==="Mantenimiento"){
        sessionStorage.removeItem(WEAR_FLAG);
        setWearMode(false);
      }
    };
    document.addEventListener("click",handler,true);
    return()=>document.removeEventListener("click",handler,true);
  },[]);
  React.useEffect(()=>{
    if(!wearMode)return;
    const h=[...document.querySelectorAll("h1")].find(x=>String(x.textContent||"").trim()==="Mantenimiento");
    if(h)h.textContent="Desgaste";
  },[wearMode]);

  if(!controllerRef.current)controllerRef.current=createHistoricalPagedController();
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
    sortBy:mainSort?.key||"fecha",sortDirection:mainSort?.dir||"desc"
  }),[state.modo,state.fechaDia,state.fechaD,state.fechaH,state.proyecto,state.maquina,state.tipoMant,mainSort?.key,mainSort?.dir]);
  const hasRemoteFilter=React.useMemo(()=>Boolean(params.desde||params.hasta||params.proyecto||params.equipo||params.tipo),[params.desde,params.hasta,params.proyecto,params.equipo,params.tipo]);

  React.useEffect(()=>{
    if(wearMode||props.mode!=="mantenimiento"||!hasRemoteFilter){++requestRef.current;setRemote(null);return;}
    const requestId=++requestRef.current;let alive=true;setRemote(null);
    controllerRef.current.loadFirst("rma15",params).then(result=>{
      if(!alive||requestId!==requestRef.current||result.stale)return;
      setRemote({rows:cloneRma15Rows(normalizeRemoteRows(result.rows,props.insumos)),total:result.total,hasMore:result.hasMore,requestId});
    }).catch(()=>{});
    return()=>{alive=false;};
  },[wearMode,props.mode,hasRemoteFilter,params,props.insumos]);

  const loadMore=React.useCallback(()=>{
    if(!hasRemoteFilter)return Promise.resolve(null);
    const requestId=requestRef.current;
    return controllerRef.current.loadMore("rma15",params).then(result=>{
      if(requestId!==requestRef.current||result.stale)return result;
      setRemote({rows:cloneRma15Rows(normalizeRemoteRows(result.rows,props.insumos)),total:result.total,hasMore:result.hasMore,requestId});return result;
    });
  },[hasRemoteFilter,params,props.insumos]);

  const exportAll=React.useCallback(async()=>{
    if(!hasRemoteFilter)return cloneRma15Rows(baseRma15);
    const rows=[];await fetchAllDatasetPages("rma15",params,page=>{rows.push(...page);});return cloneRma15Rows(normalizeRemoteRows(rows,props.insumos));
  },[hasRemoteFilter,baseRma15,params,props.insumos]);

  const effective=React.useMemo(()=>{
    const isolatedProps={...props,rma15:baseRma15};
    if(props.mode!=="mantenimiento"||!hasRemoteFilter||!remote)return isolatedProps;
    return {...isolatedProps,rma15:cloneRma15Rows(remote.rows),remoteTotal:remote.total,remoteHasMore:remote.hasMore,onRemoteMore:loadMore,onRemoteExport:exportAll};
  },[props,baseRma15,hasRemoteFilter,remote,loadMore,exportAll]);

  if(props.mode==="mantenimiento"&&wearMode)return <DesgasteView rma15={baseRma15}/>;
  return <React.Suspense fallback={<PageLoadingMotoniveladora label="Cargando Mantenimiento..."/>}><LazyMantenimientoModule {...effective}/></React.Suspense>;
}
