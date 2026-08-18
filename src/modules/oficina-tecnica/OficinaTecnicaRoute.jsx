import React, { Suspense, useEffect, useMemo, useState } from "react";
import { getRop02 } from "../../data/historicalDataService.js";
import { normalizeROP02 } from "../../shared/domain/index.jsx";

const LazyOficinaTecnica = React.lazy(()=>import("./OficinaTecnicaModule.jsx").then(m=>({default:m.OficinaTecnicaView})));

function textContent(node){
  if(node===null||node===undefined||typeof node==="boolean")return "";
  if(typeof node==="string"||typeof node==="number")return String(node);
  if(Array.isArray(node))return node.map(textContent).join(" ");
  if(React.isValidElement(node))return textContent(node.props?.children);
  return "";
}

function isAtrasoView(props){
  if(props?.view==="atrasoROP02")return true;
  return props?.view==="controlROP02"&&props?.stControlROP02?.tab==="atraso";
}

function isAdministrativeAtraso(props){
  if(typeof window==="undefined")return false;
  const role=String(window.sessionStorage.getItem("dm_role")||"").trim().toUpperCase();
  return role==="ADMINISTRATIVO"&&isAtrasoView(props);
}

function formatAtrasoEquipmentCode(value){
  const raw=String(value||"")
    .trim()
    .toUpperCase()
    .replace(/\s*\(.*?\)/g,"")
    .replace(/[-_\s]+JM$/i,"");
  const match=raw.match(/^([A-Z]{2,4})[-_\s]?(\d{1,4})$/);
  if(!match)return raw;
  return `${match[1]}-${match[2].padStart(4,"0")}`;
}

function buildAtrasoDeps(deps,{readOnly=false}={}){
  if(!deps)return deps;
  const BaseCard=deps.Card;
  const BaseTable=deps.Table;
  const BaseStatCard=deps.StatCard;
  const BaseAlertBanner=deps.AlertBanner;

  const AtrasoCard=BaseCard?function AtrasoCard(props){
    const title=String(props?.title||"").trim().toLowerCase();
    if(readOnly&&title.startsWith("equipos aceptados"))return null;
    return <BaseCard {...props}/>;
  }:BaseCard;

  const AtrasoTable=BaseTable?function AtrasoTable(props){
    let cols=Array.isArray(props?.cols)?props.cols:props?.cols;
    if(Array.isArray(cols)){
      cols=cols.map(col=>{
        if(String(col?.label||"").trim().toLowerCase()!=="equipo")return col;
        const originalRender=col?.render;
        return {
          ...col,
          render:(value,row,...rest)=>{
            const formatted=formatAtrasoEquipmentCode(value);
            return typeof originalRender==="function"
              ? originalRender(formatted,row,...rest)
              : formatted;
          },
        };
      });
      if(readOnly)cols=cols.filter(col=>String(col?.label||"").trim().toLowerCase()!=="acción");
    }
    const rows=readOnly&&Array.isArray(props?.rows)
      ? props.rows.filter(row=>!row?.admitido)
      : props?.rows;
    return <BaseTable {...props} cols={cols} rows={rows}/>;
  }:BaseTable;

  const AtrasoStatCard=BaseStatCard?function AtrasoStatCard(props){
    const label=String(props?.label||"").trim().toLowerCase();
    if(readOnly&&label==="atrasos aceptados")return null;
    return <BaseStatCard {...props}/>;
  }:BaseStatCard;

  const AtrasoAlertBanner=BaseAlertBanner?function AtrasoAlertBanner(props){
    if(readOnly){
      const text=textContent(props?.children).toLowerCase();
      if(text.includes("presioná")&&text.includes("justificar"))return null;
      if(text.includes("equipos justificados")&&text.includes("equipos aceptados"))return null;
    }
    return <BaseAlertBanner {...props}/>;
  }:BaseAlertBanner;

  return {
    ...deps,
    Card:AtrasoCard,
    Table:AtrasoTable,
    StatCard:AtrasoStatCard,
    AlertBanner:AtrasoAlertBanner,
  };
}

function mergeRop02Sources(baseRows,remoteRows){
  const base=Array.isArray(baseRows)?baseRows:[];
  const remote=Array.isArray(remoteRows)?remoteRows:[];
  if(!remote.length)return base;
  if(!base.length)return remote;

  // La hidratación general y la consulta remota pueden actualizarse en momentos
  // distintos. Nunca reemplazar una por la otra: se unen y se eliminan duplicados
  // para que una carga nueva recibida por "Actualizar" no quede tapada por un
  // snapshot remoto anterior de la pestaña Equipos.
  const merged=[];
  const seen=new Set();
  for(const row of [...remote,...base]){
    const key=JSON.stringify([
      row?.fecha||"",row?.maquina||row?._internoRaw||"",row?.proyecto||row?.lugar||"",
      row?.turno||"",row?.parte||row?.nParte||row?.numeroParte||"",row?.operador||"",
      row?.supervisor||"",row?.hi??"",row?.hf??"",row?.horas??"",row?.combustible??"",
      row?.estado||"",row?.tarea||row?.descripcion||""
    ]);
    if(seen.has(key))continue;
    seen.add(key);
    merged.push(row);
  }
  return merged;
}

export function OficinaTecnicaRoute(props){
  const Fallback=props?.deps?.BlockingDataLoader;
  const atrasoView=isAtrasoView(props);
  const readOnlyAtraso=isAdministrativeAtraso(props);
  const [equiposRop02,setEquiposRop02]=useState(null);

  useEffect(()=>{
    if(props?.view!=="listaEquipos")return;
    let active=true;
    (async()=>{
      try{
        const result=await getRop02({limit:"all",sortBy:"fecha",sortDirection:"asc"});
        if(!active)return;
        const raw=Array.isArray(result?.data)?result.data:[];
        if(raw.length)setEquiposRop02(normalizeROP02(raw));
      }catch(error){
        console.warn("No se pudo actualizar ROP02 para Equipos; se conserva la fuente cargada.",error);
      }
    })();
    return()=>{active=false;};
  },[props?.view]);

  const rop02Equipos=useMemo(()=>{
    if(props?.view!=="listaEquipos")return props?.rop02All;
    return mergeRop02Sources(props?.rop02All,equiposRop02);
  },[props?.view,props?.rop02All,equiposRop02]);

  const routedProps=useMemo(()=>{
    let nextProps=props;
    if(props?.view==="listaEquipos"){
      nextProps={...nextProps,rop02All:rop02Equipos};
    }
    if(atrasoView){
      nextProps={...nextProps,deps:buildAtrasoDeps(props.deps,{readOnly:readOnlyAtraso})};
    }
    return nextProps;
  },[props,rop02Equipos,atrasoView,readOnlyAtraso]);

  return <Suspense fallback={Fallback?<Fallback label="Cargando Oficina Técnica..."/>:null}>
    <LazyOficinaTecnica {...routedProps}/>
  </Suspense>;
}
