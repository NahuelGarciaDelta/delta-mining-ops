import React from "react";
import { PageLoadingMotoniveladora } from "../../components/ui/index.jsx";
import DesgasteView from "./DesgasteView.jsx";
import {WEAR_FLAG,WEAR_ACTIVE_EVENT,WEAR_CLOSE_EVENT} from "./wearSidebarBridge.js";

const LazyMantenimientoModule = React.lazy(() => import("./MantenimientoModule.jsx"));
const LEGACY_PERIOD_MIGRATION_KEY="dm_mantenimiento_periodo_operativo_v1";

function cloneRma15Rows(rows){
  return (Array.isArray(rows)?rows:[]).map(row=>{
    if(!row||typeof row!=="object")return row;
    const copy={...row};
    if(Array.isArray(row.insumos))copy.insumos=row.insumos.map(item=>item&&typeof item==="object"?{...item}:item);
    return copy;
  });
}

function isoDate_(date){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

function migrateCalendarMonthToOperationalPeriod_(desde,hasta){
  const match=String(desde||"").match(/^(\d{4})-(\d{2})-01$/);
  if(!match)return null;
  const year=Number(match[1]),month=Number(match[2]);
  if(!year||month<1||month>12)return null;
  const calendarEnd=new Date(year,month,0,12);
  if(String(hasta||"")!==isoDate_(calendarEnd))return null;
  const operationalStart=new Date(year,month-2,26,12);
  const operationalEnd=new Date(year,month-1,25,12);
  return{desde:isoDate_(operationalStart),hasta:isoDate_(operationalEnd)};
}

export default function MantenimientoRoute(props){
  const [wearMode,setWearMode]=React.useState(()=>props.mode==="mantenimiento"&&sessionStorage.getItem(WEAR_FLAG)==="desgaste");

  React.useEffect(()=>{
    const openWear=()=>{if(props.mode==="mantenimiento")setWearMode(true);};
    const closeWear=()=>setWearMode(false);
    window.addEventListener(WEAR_ACTIVE_EVENT,openWear);
    window.addEventListener(WEAR_CLOSE_EVENT,closeWear);
    return()=>{
      window.removeEventListener(WEAR_ACTIVE_EVENT,openWear);
      window.removeEventListener(WEAR_CLOSE_EVENT,closeWear);
    };
  },[props.mode]);

  React.useEffect(()=>{
    if(props.mode!=="mantenimiento"){
      setWearMode(false);
      return;
    }
    const h=[...document.querySelectorAll(".dm-app-content h1")].find(Boolean);
    if(h)h.textContent=wearMode?"Desgaste":"Mantenimiento";
    return()=>{
      const current=[...document.querySelectorAll(".dm-app-content h1")].find(Boolean);
      if(current&&current.textContent==="Desgaste")current.textContent="Mantenimiento";
    };
  },[wearMode,props.mode]);

  // Migración única del selector mensual anterior (1 → fin de mes) al período
  // operativo corporativo (26 del mes anterior → 25 del mes seleccionado).
  // Esto evita que un filtro guardado como "Agosto" siga mostrando 01/08–31/08
  // mientras el Dashboard usa 26/07–25/08.
  React.useEffect(()=>{
    if(props.mode!=="mantenimiento"||props.extState?.modo!=="periodo"||typeof props.setExtState!=="function")return;
    try{
      if(window.localStorage.getItem(LEGACY_PERIOD_MIGRATION_KEY)==="1")return;
      const migrated=migrateCalendarMonthToOperationalPeriod_(props.extState?.fechaD,props.extState?.fechaH);
      window.localStorage.setItem(LEGACY_PERIOD_MIGRATION_KEY,"1");
      if(migrated){
        props.setExtState(prev=>({...prev,fechaD:migrated.desde,fechaH:migrated.hasta}));
      }
    }catch(_){}
  },[props.mode,props.extState?.modo,props.extState?.fechaD,props.extState?.fechaH,props.setExtState]);

  // Mantenimiento y Dashboard deben calcular sobre EXACTAMENTE la misma base RMA15.
  // La app ya carga rma15_fs + rma15_jm completos en App.jsx. La consulta histórica
  // adicional que se hacía al tocar filtros duplicaba la descarga, demoraba la vista
  // y podía terminar reemplazando temporalmente la base por otra respuesta paginada.
  // Desde ahora el filtrado queda local sobre la base compartida y cacheable.
  const baseRma15=React.useMemo(()=>cloneRma15Rows(props.rma15),[props.rma15]);
  const effective=React.useMemo(()=>({...props,rma15:baseRma15}),[props,baseRma15]);

  if(props.mode==="mantenimiento"&&wearMode)return <DesgasteView rma15={baseRma15} usdRate={props.usdRate}/>;
  return <React.Suspense fallback={<PageLoadingMotoniveladora label="Cargando Mantenimiento..."/>}><LazyMantenimientoModule {...effective}/></React.Suspense>;
}
