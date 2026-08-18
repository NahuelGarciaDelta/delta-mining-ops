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
    // Un administrativo no debe ver filas que ya fueron aceptadas/justificadas.
    // Atrasos pendientes ya vienen sin ellas; esta guarda también limpia Saltos.
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

export function OficinaTecnicaRoute(props){
  const Fallback=props?.deps?.BlockingDataLoader;
  const atrasoView=isAtrasoView(props);
  const readOnlyAtraso=isAdministrativeAtraso(props);
  const [equiposRop02,setEquiposRop02]=useState(null);

  // Lista de Equipos no debe depender de la copia ROP02 de la hidratación inicial,
  // porque esa fuente puede quedar atrasada mientras Control por Equipo/Atraso ya
  // consultan los datos remotos actuales. Al entrar a Equipos se solicita el ROP02
  // completo y se conserva la información existente hasta que llegue la actualización.
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
        console.warn("No se pudo actualizar ROP02 para Lista de Equipos; se conserva la fuente cargada.",error);
      }
    })();
    return()=>{active=false;};
  },[props?.view]);

  const routedProps=useMemo(()=>{
    let nextProps=props;
    if(props?.view==="listaEquipos"&&Array.isArray(equiposRop02)&&equiposRop02.length){
      nextProps={...nextProps,rop02All:equiposRop02};
    }
    if(atrasoView){
      nextProps={...nextProps,deps:buildAtrasoDeps(props.deps,{readOnly:readOnlyAtraso})};
    }
    return nextProps;
  },[props,equiposRop02,atrasoView,readOnlyAtraso]);

  return <Suspense fallback={Fallback?<Fallback label="Cargando Oficina Técnica..."/>:null}>
    <LazyOficinaTecnica {...routedProps}/>
  </Suspense>;
}
