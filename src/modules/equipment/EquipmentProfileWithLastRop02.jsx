import React,{useEffect,useMemo,useState} from "react";
import EquipmentProfileView from "./EquipmentProfileView.jsx";
import {canonicalEquipmentCode,cleanEquipmentCode} from "./equipmentCode.js";

const sourceCode=row=>String(row?.maquina||row?.interno||row?.codigo||row?.["Codigo Int"]||row?.["Código Interno del Equipo"]||"").trim();
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
      if(code&&date&&(!latest.has(code)||date>latest.get(code)))latest.set(code,date);
    }
    return latest;
  },[props.rop02All]);

  const latestDate=latestByEquipment.get(canonicalEquipmentCode(selectedCode))||"";

  // Solo se actualiza una vez después de cada cambio de equipo/fecha. El observer
  // anterior observaba el mismo nodo que modificaba y podía generar un loop infinito
  // de MutationObserver, congelando la ficha en equipos sin ROP02 como AG600JG/CAR0073.
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
    };
    const raf=window.requestAnimationFrame(()=>window.requestAnimationFrame(apply));
    return()=>{cancelled=true;window.cancelAnimationFrame(raf);};
  },[latestDate,selectedCode]);

  const captureEquipmentChange=event=>{
    const target=event.target;
    if(target?.tagName!=="SELECT")return;
    if(!target.closest?.(".dm-equipment-filter-panel"))return;
    const value=String(target.value||"").trim();
    setSelectedCode(value?cleanEquipmentCode(value):"");
  };

  return <div onChangeCapture={captureEquipmentChange}><EquipmentProfileView {...props}/></div>;
}
