import React,{useEffect,useMemo,useState} from "react";
import EquipmentProfileView from "./EquipmentProfileView.jsx";
import {canonicalEquipmentCode,cleanEquipmentCode} from "./equipmentCode.js";

const sourceCode=row=>String(row?.maquina||row?.interno||row?.codigo||row?.["Codigo Int"]||row?.["Código Interno del Equipo"]||"").trim();
const norm=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]/g,"");
const pick=(row,names)=>{
  const keys=Object.keys(row||{});
  for(const name of names){const wanted=norm(name),key=keys.find(k=>norm(k)===wanted);if(key)return row[key];}
  for(const name of names){const wanted=norm(name),key=keys.find(k=>norm(k).includes(wanted)||wanted.includes(norm(k)));if(key)return row[key];}
  return "";
};
const MASTER_CODE_HEADERS=["Codigo nuevo","Código nuevo","Codigo de Drusila","Código de Drusila","Interno","Código interno","Codigo Int","Código viejo","Codigo viejo"];
const masterCodes=row=>MASTER_CODE_HEADERS.map(header=>String(pick(row,[header])||"").trim()).filter(Boolean);
const isoDate=value=>{
  const raw=String(value||"").trim();
  if(!raw)return "";
  const iso=raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(iso)return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const latin=raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(latin)return `${latin[3]}-${latin[2].padStart(2,"0")}-${latin[1].padStart(2,"0")}`;
  const parsed=new Date(raw);
  if(Number.isNaN(parsed.getTime()))return "";
  return `${parsed.getFullYear()}-${String(parsed.getMonth()+1).padStart(2,"0")}-${String(parsed.getDate()).padStart(2,"0")}`;
};
const fmtDate=iso=>/^\d{4}-\d{2}-\d{2}$/.test(String(iso||""))?`${iso.slice(8,10)}/${iso.slice(5,7)}/${iso.slice(0,4)}`:"—";

export default function EquipmentProfileWithLastRop02(props){
  const [selectedCode,setSelectedCode]=useState(()=>cleanEquipmentCode(props.initialCode||""));

  useEffect(()=>{
    if(props.initialCode)setSelectedCode(cleanEquipmentCode(props.initialCode));
  },[props.initialCode]);

  const latestByEquipment=useMemo(()=>{
    const latest=new Map();
    for(const row of Array.isArray(props.rop02All)?props.rop02All:[]){
      const code=canonicalEquipmentCode(sourceCode(row));
      const date=isoDate(row?.fecha);
      if(!code||!date)continue;
      const current=latest.get(code);
      if(!current||date>current.date)latest.set(code,{date,project:String(row?.proyecto||row?.lugar||row?.Proyecto||row?.Lugar||"").trim()});
    }
    return latest;
  },[props.rop02All]);

  const masterByEquipment=useMemo(()=>{
    const map=new Map();
    for(const row of Array.isArray(props.listaEquipos)?props.listaEquipos:[]){
      for(const rawCode of masterCodes(row)){
        const code=canonicalEquipmentCode(rawCode);
        if(code&&!map.has(code))map.set(code,row);
      }
    }
    return map;
  },[props.listaEquipos]);

  const selectedKey=canonicalEquipmentCode(selectedCode);
  const latest=latestByEquipment.get(selectedKey)||null;
  const latestDate=latest?.date||"";
  const latestProject=String(latest?.project||"").trim();
  const selectedMaster=masterByEquipment.get(selectedKey)||null;
  const rentalPlace=String(pick(selectedMaster||{},["Lugar de alquiler","Lugar alquiler","Ubicación de alquiler","Ubicacion de alquiler"])||"").trim();
  const displayPlace=useMemo(()=>{
    const base=rentalPlace||latestProject||"—";
    if(!latestProject||norm(base)===norm(latestProject))return base;
    return `${base} (${latestProject})`;
  },[rentalPlace,latestProject]);

  // Actualiza sólo los dos textos del encabezado una vez por cambio de equipo.
  // No se usa MutationObserver para evitar loops de DOM y congelamientos.
  useEffect(()=>{
    let cancelled=false;
    const apply=()=>{
      if(cancelled)return;
      const header=document.querySelector(".dm-equipment-profile .dm-equipment-header");
      if(!header)return;
      const left=header.firstElementChild;
      if(!left)return;

      let node=left.querySelector("[data-dm-last-rop02]");
      if(!node){
        node=document.createElement("div");
        node.setAttribute("data-dm-last-rop02","1");
        node.style.marginTop="7px";
        node.style.fontSize="11px";
        node.style.fontWeight="700";
        node.style.color="#9ca3af";
        left.appendChild(node);
      }
      const nextText=`Último registro ROP02: ${latestDate?fmtDate(latestDate):"Sin registros"}`;
      if(node.textContent!==nextText)node.textContent=nextText;

      const metaRows=[...left.querySelectorAll(":scope > div")].filter(el=>el.querySelectorAll(":scope > span").length>=4);
      const metaRow=metaRows[metaRows.length-1];
      if(metaRow){
        const spans=metaRow.querySelectorAll(":scope > span");
        const placeSpan=spans[spans.length-1];
        if(placeSpan&&placeSpan.textContent!==displayPlace)placeSpan.textContent=displayPlace;
      }
    };
    const raf=window.requestAnimationFrame(()=>window.requestAnimationFrame(apply));
    return()=>{cancelled=true;window.cancelAnimationFrame(raf);};
  },[latestDate,displayPlace,selectedCode]);

  const captureEquipmentChange=event=>{
    const target=event.target;
    if(target?.tagName!=="SELECT")return;
    if(!target.closest?.(".dm-equipment-filter-panel"))return;
    const value=String(target.value||"").trim();
    setSelectedCode(value?cleanEquipmentCode(value):"");
  };

  return <div onChangeCapture={captureEquipmentChange}><EquipmentProfileView {...props}/></div>;
}
