import React,{useEffect,useMemo,useState} from "react";
import EquipmentProfileView from "./EquipmentProfileView.jsx";
import {canonicalEquipmentCode,cleanEquipmentCode} from "./equipmentCode.js";
import {useEquipmentMovements} from "../../services/equipmentMovements.js";
import {buildEquipmentMovementAliasMap} from "../../services/equipmentMovementsDomain.js";

const sourceCode=row=>String(row?.maquina||row?.interno||row?.codigo||row?.["Codigo Int"]||row?.["Código Interno del Equipo"]||"").trim();
const norm=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]/g,"");
const pick=(row,names)=>{
  const keys=Object.keys(row||{});
  for(const name of names){const wanted=norm(name),key=keys.find(k=>norm(k)===wanted);if(key)return row[key];}
  for(const name of names){const wanted=norm(name),key=keys.find(k=>norm(k).includes(wanted)||wanted.includes(norm(k)));if(key)return row[key];}
  return "";
};
const MASTER_CODE_HEADERS=["Codigo nuevo","Código nuevo","Codigo de Drusila","Código de Drusila","Código Drusila","Codigo Drusila","Interno","Código interno","Codigo Int","Código viejo","Codigo viejo"];
const masterCodes=row=>MASTER_CODE_HEADERS.map(header=>String(pick(row,[header])||"").trim()).filter(Boolean).filter((value,index,array)=>array.findIndex(other=>canonicalEquipmentCode(other)===canonicalEquipmentCode(value))===index);

export default function EquipmentProfileWithLastRop02(props){
  const [selectedCode,setSelectedCode]=useState(()=>cleanEquipmentCode(props.initialCode||""));
  const {movements:sharedMovements}=useEquipmentMovements(props.rop02All,["equipmentProfile"]);

  // Una fila de Lista Maestra puede contener código nuevo, Drusila, interno y viejo.
  // Todos esos identificadores representan UN solo equipo. El primer código de la
  // fila (Código nuevo) es la identidad preferida de la ficha.
  const codeAliases=useMemo(()=>{
    const aliases=new Map();
    for(const row of Array.isArray(props.listaEquipos)?props.listaEquipos:[]){
      const codes=masterCodes(row);
      if(!codes.length)continue;
      const preferred=cleanEquipmentCode(codes[0]);
      for(const raw of codes){
        const key=canonicalEquipmentCode(raw);
        if(key)aliases.set(key,preferred);
      }
    }
    return aliases;
  },[props.listaEquipos]);
  const movementAliases=useMemo(()=>buildEquipmentMovementAliasMap(sharedMovements),[sharedMovements]);

  const resolveCode=React.useCallback(raw=>{
    let current=cleanEquipmentCode(raw);
    const seen=new Set();
    for(let i=0;i<10;i++){
      const key=canonicalEquipmentCode(current);
      if(!key||seen.has(key))break;
      seen.add(key);
      const masterPreferred=codeAliases.get(key)||current;
      const masterKey=canonicalEquipmentCode(masterPreferred);
      const moved=movementAliases.get(masterKey)||movementAliases.get(key);
      const next=cleanEquipmentCode(moved||masterPreferred);
      if(!next||canonicalEquipmentCode(next)===key){current=next||current;break;}
      current=next;
    }
    return current;
  },[codeAliases,movementAliases]);

  // Normalizamos las fuentes antes de entregarlas a EquipmentProfileView. Así el
  // historial ROP02/ROP05/RMA15 de códigos viejos se combina bajo el mismo interno
  // y el selector no crea dos opciones visuales para la misma máquina.
  const normalizeRows=React.useCallback(rows=>(Array.isArray(rows)?rows:[]).map(row=>{
    const raw=sourceCode(row);
    const preferred=resolveCode(raw);
    if(!raw||canonicalEquipmentCode(raw)===canonicalEquipmentCode(preferred))return row;
    return {...row,maquina:preferred,interno:preferred,codigo:preferred,"Codigo Int":preferred,"Código Interno del Equipo":preferred};
  }),[resolveCode]);

  const normalizedRop02=useMemo(()=>normalizeRows(props.rop02All),[props.rop02All,normalizeRows]);
  const normalizedRop05=useMemo(()=>normalizeRows(props.rop05),[props.rop05,normalizeRows]);
  const normalizedRma15=useMemo(()=>normalizeRows(props.rma15),[props.rma15,normalizeRows]);
  const normalizedInitialCode=resolveCode(props.initialCode||"");

  useEffect(()=>{
    if(props.initialCode)setSelectedCode(normalizedInitialCode);
  },[props.initialCode,normalizedInitialCode]);

  const latestByEquipment=useMemo(()=>{
    const latest=new Map();
    for(const row of normalizedRop02){
      const code=canonicalEquipmentCode(sourceCode(row));
      const raw=String(row?.fecha||"").trim();
      const iso=raw.match(/^(\d{4})-(\d{2})-(\d{2})/)?.slice(1,4).join("-")||(()=>{const m=raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);return m?`${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`:"";})();
      if(!code||!iso)continue;
      const current=latest.get(code);
      if(!current||iso>current.date)latest.set(code,{date:iso,project:String(row?.proyecto||row?.lugar||row?.Proyecto||row?.Lugar||"").trim()});
    }
    return latest;
  },[normalizedRop02]);

  const masterByEquipment=useMemo(()=>{
    const map=new Map();
    for(const row of Array.isArray(props.listaEquipos)?props.listaEquipos:[]){
      for(const rawCode of masterCodes(row)){
        const preferred=resolveCode(rawCode);
        const code=canonicalEquipmentCode(preferred);
        if(code&&!map.has(code))map.set(code,row);
      }
    }
    return map;
  },[props.listaEquipos,resolveCode]);

  const selectedKey=canonicalEquipmentCode(resolveCode(selectedCode));
  const latest=latestByEquipment.get(selectedKey)||null;
  const latestProject=String(latest?.project||"").trim();
  const selectedMaster=masterByEquipment.get(selectedKey)||null;
  const rentalPlace=String(pick(selectedMaster||{},["Lugar de alquiler","Lugar alquiler","Ubicación de alquiler","Ubicacion de alquiler"])||"").trim();
  const displayPlace=useMemo(()=>{
    const base=rentalPlace||latestProject||"—";
    if(!latestProject||norm(base)===norm(latestProject))return base;
    return `${base} (${latestProject})`;
  },[rentalPlace,latestProject]);

  // Conserva únicamente la corrección del lugar actual. El texto duplicado
  // "Último registro ROP02" ya pertenece al encabezado nativo de la ficha.
  useEffect(()=>{
    let cancelled=false;
    const apply=()=>{
      if(cancelled)return;
      const header=document.querySelector(".dm-equipment-profile .dm-equipment-header");
      if(!header)return;
      const left=header.firstElementChild;
      if(!left)return;
      left.querySelector("[data-dm-last-rop02]")?.remove();
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
  },[displayPlace,selectedCode]);

  const captureEquipmentChange=event=>{
    const target=event.target;
    if(target?.tagName!=="SELECT")return;
    if(!target.closest?.(".dm-equipment-filter-panel"))return;
    const value=String(target.value||"").trim();
    setSelectedCode(value?resolveCode(value):"");
  };

  const normalizedProps={...props,initialCode:normalizedInitialCode,rop02All:normalizedRop02,rop05:normalizedRop05,rma15:normalizedRma15};
  return <div onChangeCapture={captureEquipmentChange}><EquipmentProfileView {...normalizedProps}/></div>;
}
