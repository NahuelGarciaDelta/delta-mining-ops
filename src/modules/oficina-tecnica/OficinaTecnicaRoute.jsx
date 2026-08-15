import React, { Suspense, useMemo } from "react";

const LazyOficinaTecnica = React.lazy(()=>import("./OficinaTecnicaModule.jsx").then(m=>({default:m.OficinaTecnicaView})));

function textContent(node){
  if(node===null||node===undefined||typeof node==="boolean")return "";
  if(typeof node==="string"||typeof node==="number")return String(node);
  if(Array.isArray(node))return node.map(textContent).join(" ");
  if(React.isValidElement(node))return textContent(node.props?.children);
  return "";
}

function isAdministrativeAtraso(props){
  if(typeof window==="undefined")return false;
  const role=String(window.sessionStorage.getItem("dm_role")||"").trim().toUpperCase();
  if(role!=="ADMINISTRATIVO")return false;
  if(props?.view==="atrasoROP02")return true;
  return props?.view==="controlROP02"&&props?.stControlROP02?.tab==="atraso";
}

function buildReadOnlyAtrasoDeps(deps){
  if(!deps)return deps;
  const BaseCard=deps.Card;
  const BaseTable=deps.Table;
  const BaseStatCard=deps.StatCard;
  const BaseAlertBanner=deps.AlertBanner;

  const ReadOnlyCard=BaseCard?function ReadOnlyAtrasoCard(props){
    const title=String(props?.title||"").trim().toLowerCase();
    if(title.startsWith("equipos aceptados"))return null;
    return <BaseCard {...props}/>;
  }:BaseCard;

  const ReadOnlyTable=BaseTable?function ReadOnlyAtrasoTable(props){
    const cols=Array.isArray(props?.cols)
      ? props.cols.filter(col=>String(col?.label||"").trim().toLowerCase()!=="acción")
      : props?.cols;
    // Un administrativo no debe ver filas que ya fueron aceptadas/justificadas.
    // Atrasos pendientes ya vienen sin ellas; esta guarda también limpia Saltos.
    const rows=Array.isArray(props?.rows)
      ? props.rows.filter(row=>!row?.admitido)
      : props?.rows;
    return <BaseTable {...props} cols={cols} rows={rows}/>;
  }:BaseTable;

  const ReadOnlyStatCard=BaseStatCard?function ReadOnlyAtrasoStatCard(props){
    const label=String(props?.label||"").trim().toLowerCase();
    if(label==="atrasos aceptados")return null;
    return <BaseStatCard {...props}/>;
  }:BaseStatCard;

  const ReadOnlyAlertBanner=BaseAlertBanner?function ReadOnlyAtrasoAlertBanner(props){
    const text=textContent(props?.children).toLowerCase();
    if(text.includes("presioná")&&text.includes("justificar"))return null;
    if(text.includes("equipos justificados")&&text.includes("equipos aceptados"))return null;
    return <BaseAlertBanner {...props}/>;
  }:BaseAlertBanner;

  return {
    ...deps,
    Card:ReadOnlyCard,
    Table:ReadOnlyTable,
    StatCard:ReadOnlyStatCard,
    AlertBanner:ReadOnlyAlertBanner,
  };
}

export function OficinaTecnicaRoute(props){
  const Fallback=props?.deps?.BlockingDataLoader;
  const readOnlyAtraso=isAdministrativeAtraso(props);
  const routedProps=useMemo(()=>{
    if(!readOnlyAtraso)return props;
    return {...props,deps:buildReadOnlyAtrasoDeps(props.deps)};
  },[props,readOnlyAtraso]);

  return <Suspense fallback={Fallback?<Fallback label="Cargando Oficina Técnica..."/>:null}>
    <LazyOficinaTecnica {...routedProps}/>
  </Suspense>;
}
