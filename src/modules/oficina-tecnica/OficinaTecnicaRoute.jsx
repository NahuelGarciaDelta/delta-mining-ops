import React, { Suspense, useEffect, useMemo, useState } from "react";
import { getRop02, refreshHistoricalDataset, HISTORICAL_DATASET_UPDATED_EVENT } from "../../data/historicalDataService.js";
import { registerRefreshTask } from "../../services/refreshManager.js";
import { normalizeROP02 } from "../../shared/domain/index.jsx";
import { normalizeRop02Project } from "../home/homeAvailability.js";
import TallerCentralMovements from "../taller-central/TallerCentralMovements.jsx";

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
  const raw=String(value||"").trim().toUpperCase().replace(/\s*\(.*?\)/g,"").replace(/[-_\s]+JM$/i,"");
  const match=raw.match(/^([A-Z]{2,4})[-_\s]?(\d{1,4})$/);
  if(!match)return raw;
  return `${match[1]}-${match[2].padStart(4,"0")}`;
}

function isoFromDisplayDate(value){
  const raw=String(value||"").trim();
  const m=raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m?`${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`:"";
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
        return {...col,render:(value,row,...rest)=>{const formatted=formatAtrasoEquipmentCode(value);return typeof originalRender==="function"?originalRender(formatted,row,...rest):formatted;}};
      });
      if(readOnly)cols=cols.filter(col=>String(col?.label||"").trim().toLowerCase()!=="acción");
    }
    const rows=readOnly&&Array.isArray(props?.rows)?props.rows.filter(row=>!row?.admitido):props?.rows;
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

  return {...deps,Card:AtrasoCard,Table:AtrasoTable,StatCard:AtrasoStatCard,AlertBanner:AtrasoAlertBanner};
}

function buildOperationalPeriodDeps(deps){
  if(!deps?.OperationalPeriodMonthYear)return deps;
  return {...deps,PeriodMonthYear:deps.OperationalPeriodMonthYear};
}

function mergeRop02Sources(baseRows,remoteRows){
  const base=Array.isArray(baseRows)?baseRows:[];
  const remote=Array.isArray(remoteRows)?remoteRows:[];
  if(!remote.length)return base;
  if(!base.length)return remote;
  const merged=[];
  const seen=new Set();
  for(const row of [...remote,...base]){
    const key=JSON.stringify([row?.fecha||"",row?.maquina||row?._internoRaw||"",row?.proyecto||row?.lugar||"",row?.turno||"",row?.parte||row?.nParte||row?.numeroParte||"",row?.operador||"",row?.supervisor||"",row?.hi??"",row?.hf??"",row?.horas??"",row?.combustible??"",row?.estado||"",row?.tarea||row?.descripcion||""]);
    if(seen.has(key))continue;
    seen.add(key);merged.push(row);
  }
  return merged;
}

function isFullRop02Query(params={}){
  return String(params?.limit||"").toLowerCase()==="all"&&!String(params?.desde||"").trim()&&!String(params?.hasta||"").trim()&&String(params?.sortBy||"fecha")==="fecha"&&String(params?.sortDirection||"asc").toLowerCase()==="desc";
}

export function OficinaTecnicaRoute(props){
  const Fallback=props?.deps?.BlockingDataLoader;
  const atrasoView=isAtrasoView(props);
  const readOnlyAtraso=isAdministrativeAtraso(props);
  const [equiposRop02,setEquiposRop02]=useState(null);
  const [rop02ViewRevision,setRop02ViewRevision]=useState(0);
  const [tallerTab,setTallerTab]=useState("RESUMEN");

  useEffect(()=>{if(props?.view!=="tallerCentral")setTallerTab("RESUMEN");},[props?.view]);

  useEffect(()=>{
    if(!atrasoView||readOnlyAtraso)return;
    let raf=0;
    let active=true;
    const rows=Array.isArray(props?.rop02All)?props.rop02All:[];
    const appAlert=props?.deps?.appAlert||((message)=>window.alert(message));

    const validateAndPublish=(card)=>{
      if(!active||!card)return;
      const selects=[...card.querySelectorAll("select")];
      const reasonSelect=selects[0];
      const projectSelect=selects[1];
      const isChange=String(reasonSelect?.value||"")==="Cambio de proyecto";
      let block=card.querySelector("[data-dm-project-internal-link]");
      if(!isChange){if(block)block.remove();window.__dmPendingEquipmentMovementLink=null;return;}
      if(!projectSelect)return;
      const info=[...card.querySelectorAll("div")].find(el=>String(el.textContent||"").includes("Equipo:")&&String(el.textContent||"").includes("Última carga:"));
      const infoText=String(info?.textContent||"");
      const sourceMatch=infoText.match(/Equipo:\s*([^·]+)/i);
      const dateMatch=infoText.match(/Última carga:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
      const sourceCode=formatAtrasoEquipmentCode(sourceMatch?.[1]||"");
      const lastOrigin=isoFromDisplayDate(dateMatch?.[1]||"");
      const destinationProject=normalizeRop02Project(projectSelect.value||"");

      if(!block){
        block=document.createElement("div");
        block.setAttribute("data-dm-project-internal-link","1");
        block.style.display="flex";block.style.flexDirection="column";block.style.gap="12px";
        block.innerHTML=`<label style="display:flex;flex-direction:column;gap:7px;font-size:12px;font-weight:800;color:#a3a3a3">Interno en proyecto destino<select data-dm-link-mode style="background:#171717;border:1px solid #404040;color:#fff;border-radius:8px;padding:10px 12px"><option value="MISMO">Mantiene el mismo interno</option><option value="NUEVO">Cambió de interno</option></select></label><label data-dm-new-code-wrap style="display:none;flex-direction:column;gap:7px;font-size:12px;font-weight:800;color:#a3a3a3">Nuevo interno<input data-dm-new-code placeholder="Ej.: TOP-0067" autocomplete="off" style="background:#171717;border:1px solid #404040;color:#fff;border-radius:8px;padding:10px 12px;text-transform:uppercase" /><span data-dm-link-status style="font-size:11px;font-weight:800"></span></label>`;
        projectSelect.closest("label")?.insertAdjacentElement("afterend",block);
        const mode=block.querySelector("[data-dm-link-mode]");
        const input=block.querySelector("[data-dm-new-code]");
        mode?.addEventListener("change",()=>validateAndPublish(card));
        input?.addEventListener("input",()=>{input.value=input.value.toUpperCase();validateAndPublish(card);});
      }

      const mode=block.querySelector("[data-dm-link-mode]");
      const wrap=block.querySelector("[data-dm-new-code-wrap]");
      const input=block.querySelector("[data-dm-new-code]");
      const status=block.querySelector("[data-dm-link-status]");
      const same=String(mode?.value||"MISMO")==="MISMO";
      if(wrap)wrap.style.display=same?"none":"flex";
      if(same){window.__dmPendingEquipmentMovementLink={valid:true,mode:"MISMO",sourceCode,destinationCode:sourceCode,destinationProject,firstDestinationDate:""};return;}

      const requested=formatAtrasoEquipmentCode(input?.value||"");
      const matches=rows.filter(row=>{const rowCode=formatAtrasoEquipmentCode(row?.maquina||row?._internoRaw||"");const rowProject=normalizeRop02Project(row?.proyecto||row?.lugar||"");const rowDate=String(row?.fecha||"").slice(0,10);return requested&&rowCode===requested&&rowProject===destinationProject&&(!lastOrigin||rowDate>=lastOrigin);}).sort((a,b)=>String(a?.fecha||"").localeCompare(String(b?.fecha||"")));
      const firstDate=String(matches[0]?.fecha||"").slice(0,10);
      const valid=Boolean(requested&&destinationProject&&firstDate&&requested!==sourceCode);
      if(status){status.style.color=valid?"#10b981":"#ef4444";status.textContent=!requested?"Ingresá el interno nuevo.":requested===sourceCode?"Ese es el mismo interno actual.":valid?`✓ Verificado en ROP02 ${destinationProject} · primera carga posterior: ${firstDate.slice(8,10)}/${firstDate.slice(5,7)}/${firstDate.slice(0,4)}`:`No se encontró una carga posterior de ${requested} en ${destinationProject||"el proyecto destino"}.`;}
      window.__dmPendingEquipmentMovementLink={valid,mode:"NUEVO",sourceCode,destinationCode:requested,destinationProject,firstDestinationDate:firstDate};
    };

    const scan=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{if(!active)return;const title=[...document.querySelectorAll("div")].find(el=>String(el.textContent||"").trim()==="Justificar ausencia de equipo");const card=title?.parentElement;if(card)validateAndPublish(card);});};
    const onChange=(event)=>{const card=event.target?.closest?.("div");const title=card&&[...card.querySelectorAll("div")].find(el=>String(el.textContent||"").trim()==="Justificar ausencia de equipo");if(title)scan();};
    const onClickCapture=(event)=>{
      const button=event.target?.closest?.("button");
      if(!button||String(button.textContent||"").trim()!=="Aceptar")return;
      const card=button.parentElement?.parentElement;
      if(!card||![...card.querySelectorAll("div")].some(el=>String(el.textContent||"").trim()==="Justificar ausencia de equipo"))return;
      const reason=card.querySelector("select")?.value;
      if(reason!=="Cambio de proyecto")return;
      validateAndPublish(card);
      const pending=window.__dmPendingEquipmentMovementLink;
      if(!pending?.valid){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation?.();appAlert("Verificá el proyecto destino y el interno nuevo antes de aceptar el cambio de proyecto.");}
    };

    const observer=new MutationObserver(scan);
    observer.observe(document.body,{childList:true,subtree:true});
    document.addEventListener("change",onChange,true);
    document.addEventListener("click",onClickCapture,true);
    scan();
    return()=>{active=false;cancelAnimationFrame(raf);observer.disconnect();document.removeEventListener("change",onChange,true);document.removeEventListener("click",onClickCapture,true);window.__dmPendingEquipmentMovementLink=null;};
  },[atrasoView,readOnlyAtraso,props?.rop02All,props?.deps]);

  useEffect(()=>{
    const onHistoricalUpdated=(event)=>{const detail=event?.detail||{};if(detail.dataset!=="rop02"||!isFullRop02Query(detail.params))return;setRop02ViewRevision(value=>value+1);};
    window.addEventListener(HISTORICAL_DATASET_UPDATED_EVENT,onHistoricalUpdated);
    return()=>window.removeEventListener(HISTORICAL_DATASET_UPDATED_EVENT,onHistoricalUpdated);
  },[]);

  useEffect(()=>registerRefreshTask("oficina-rop02-full-refresh",async()=>refreshHistoricalDataset("rop02",{limit:"all",sortBy:"fecha",sortDirection:"desc"}),{views:["rop02"],priority:20}),[]);

  useEffect(()=>{
    if(props?.view!=="listaEquipos")return;
    let active=true;
    (async()=>{try{const result=await getRop02({limit:"all",sortBy:"fecha",sortDirection:"asc"});if(!active)return;const raw=Array.isArray(result?.data)?result.data:[];if(raw.length)setEquiposRop02(normalizeROP02(raw));}catch(error){console.warn("No se pudo actualizar ROP02 para Lista de Equipos; se conserva la fuente cargada.",error);}})();
    return()=>{active=false;};
  },[props?.view]);

  const rop02Equipos=useMemo(()=>{if(props?.view!=="listaEquipos")return props?.rop02All;return mergeRop02Sources(props?.rop02All,equiposRop02);},[props?.view,props?.rop02All,equiposRop02]);

  const routedProps=useMemo(()=>{
    let nextProps=props;
    if(props?.view==="listaEquipos")nextProps={...nextProps,rop02All:rop02Equipos};
    if(props?.view==="horometros"||props?.view==="chc")nextProps={...nextProps,deps:buildOperationalPeriodDeps(nextProps.deps)};
    if(atrasoView)nextProps={...nextProps,deps:buildAtrasoDeps(nextProps.deps,{readOnly:readOnlyAtraso})};
    return nextProps;
  },[props,rop02Equipos,atrasoView,readOnlyAtraso]);

  const moduleKey=props?.view==="rop02"?`rop02-cache-${rop02ViewRevision}`:undefined;
  const tcColor=props?.deps?.C||{};

  return <Suspense fallback={Fallback?<Fallback label="Cargando Oficina Técnica..."/>:null}>
    {props?.view==="tallerCentral"?<div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",gap:8}}><button onClick={()=>setTallerTab("RESUMEN")} style={{border:`1px solid ${tallerTab==="RESUMEN"?(tcColor.teal||"#14b8a6"):(tcColor.border||"#3f3f46")}`,background:tallerTab==="RESUMEN"?(tcColor.tealDim||"rgba(20,184,166,.12)"):"#191919",color:tallerTab==="RESUMEN"?(tcColor.teal||"#14b8a6"):(tcColor.textSub||"#a3a3a3"),borderRadius:8,padding:"9px 14px",fontWeight:800,cursor:"pointer"}}>Resumen</button><button onClick={()=>setTallerTab("MOVIMIENTOS")} style={{border:`1px solid ${tallerTab==="MOVIMIENTOS"?(tcColor.accent||"#ef233c"):(tcColor.border||"#3f3f46")}`,background:tallerTab==="MOVIMIENTOS"?(tcColor.redDim||"rgba(239,35,60,.12)"):"#191919",color:tallerTab==="MOVIMIENTOS"?(tcColor.accent||"#ef233c"):(tcColor.textSub||"#a3a3a3"),borderRadius:8,padding:"9px 14px",fontWeight:800,cursor:"pointer"}}>Movimiento de equipos</button></div>
      {tallerTab==="RESUMEN"?<LazyOficinaTecnica key={moduleKey} {...routedProps}/>:<TallerCentralMovements listaEquipos={props?.listaEquipos||[]} rop02All={props?.rop02All||[]}/>} 
    </div>:<LazyOficinaTecnica key={moduleKey} {...routedProps}/>} 
  </Suspense>;
}
