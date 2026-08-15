import React, { Suspense, useMemo } from "react";

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
  const routedProps=useMemo(()=>{
    if(!atrasoView)return props;
    return {...props,deps:buildAtrasoDeps(props.deps,{readOnly:readOnlyAtraso})};
  },[props,atrasoView,readOnlyAtraso]);

  return <Suspense fallback={Fallback?<Fallback label="Cargando Oficina Técnica..."/>:null}>
    <LazyOficinaTecnica {...routedProps}/>
  </Suspense>;
}
