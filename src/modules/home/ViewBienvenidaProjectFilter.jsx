import React from "react";
import { createPortal } from "react-dom";
import ViewBienvenida from "./ViewBienvenida.jsx";
import { collectProjects, projectFromRow, projectLabel } from "../../shared/projects.js";

const STORAGE_KEY="dm_home_summary_project_v3";
const LEGACY_PROJECTS=new Set(["JOSE MARIA","FILO DEL SOL","FILO SUR","EL ZORRO"]);
const EMPTY_RMA_SENTINEL={__dmHomeEmptyProject:true};

function readInitialSelection(){
  try{
    const saved=window.localStorage.getItem(STORAGE_KEY);
    if(saved){
      const parsed=JSON.parse(saved);
      if(parsed==="TODOS"||parsed?.all===true)return null;
      if(Array.isArray(parsed))return parsed.map(v=>String(v||"").trim().toUpperCase()).filter(Boolean);
    }
    const old=window.localStorage.getItem("dm_home_summary_project_v2");
    if(old){
      const parsed=JSON.parse(old);
      if(Array.isArray(parsed)){
        const clean=[...new Set(parsed.map(v=>String(v||"").trim().toUpperCase()).filter(Boolean))];
        // La selección histórica con los cuatro proyectos existentes equivalía a “Todos”.
        // Se migra a modo dinámico para que futuros proyectos entren automáticamente.
        if(clean.length===LEGACY_PROJECTS.size&&clean.every(v=>LEGACY_PROJECTS.has(v)))return null;
        return clean;
      }
    }
  }catch(_){}
  return null;
}

export default function ViewBienvenidaProjectFilter(props){
  // null = Todos. De esta forma, si mañana Apps Script agrega un proyecto nuevo,
  // entra automáticamente sin requerir modificar React ni el localStorage del usuario.
  const [selection,setSelection]=React.useState(readInitialSelection);
  const [portalHost,setPortalHost]=React.useState(null);
  const [open,setOpen]=React.useState(false);
  const controlRef=React.useRef(null);

  const projectValues=React.useMemo(()=>collectProjects(props.rop02All,props.rop05,props.rma15),[props.rop02All,props.rop05,props.rma15]);
  const projectItems=React.useMemo(()=>[
    {value:"TODOS",label:"Todos"},
    ...projectValues.map(value=>({value,label:projectLabel(value)})),
  ],[projectValues]);

  // Si una selección explícita contiene proyectos que ya no están en los datasets,
  // se limpia sin impedir que nuevos proyectos aparezcan en el selector.
  const selectedValues=React.useMemo(()=>{
    if(selection===null)return projectValues;
    const available=new Set(projectValues);
    const valid=selection.filter(v=>available.has(v));
    return valid.length?valid:projectValues;
  },[selection,projectValues]);
  const allSelected=selection===null||selectedValues.length===projectValues.length;
  const selectedSet=React.useMemo(()=>new Set(selectedValues),[selectedValues]);

  if(typeof window!=="undefined"){
    window.__dmHomeSummaryExternalFilter=true;
    window.__dmHomeSummaryProject="TODOS";
  }

  React.useEffect(()=>{
    try{window.localStorage.setItem(STORAGE_KEY,JSON.stringify(selection===null?"TODOS":selection));}catch(_){}
  },[selection]);

  React.useEffect(()=>()=>{
    if(typeof window!=="undefined"){
      window.__dmHomeSummaryExternalFilter=false;
      window.__dmHomeSummaryProject="TODOS";
    }
  },[]);

  React.useEffect(()=>{
    let frame=0;
    const findHost=()=>{
      const host=document.querySelector(".dm-home-summary > div:first-child");
      if(host){setPortalHost(host);return;}
      frame=window.requestAnimationFrame(findHost);
    };
    findHost();
    return()=>window.cancelAnimationFrame(frame);
  },[]);

  React.useEffect(()=>{
    if(!open)return;
    const close=event=>{if(controlRef.current&&!controlRef.current.contains(event.target))setOpen(false);};
    const onKey=event=>{if(event.key==="Escape")setOpen(false);};
    document.addEventListener("mousedown",close);
    document.addEventListener("keydown",onKey);
    return()=>{document.removeEventListener("mousedown",close);document.removeEventListener("keydown",onKey);};
  },[open]);

  const filteredProps=React.useMemo(()=>{
    if(allSelected)return props;
    const filterRows=rows=>Array.isArray(rows)?rows.filter(row=>selectedSet.has(projectFromRow(row))):rows;
    const filteredRma=filterRows(props.rma15);
    return {
      ...props,
      rop02All:filterRows(props.rop02All),
      rop05:filterRows(props.rop05),
      rma15:Array.isArray(filteredRma)&&filteredRma.length?filteredRma:[EMPTY_RMA_SENTINEL],
    };
  },[props,allSelected,selectedSet]);

  const toggleProject=value=>{
    if(value==="TODOS"){setSelection(null);return;}
    setSelection(current=>{
      const base=current===null?[...projectValues]:[...current];
      if(base.includes(value)){
        const next=base.filter(item=>item!==value);
        return next.length?next:base;
      }
      const next=[...base,value];
      return next.length>=projectValues.length?null:next;
    });
  };

  const summaryLabel=allSelected
    ? "Todos"
    : projectItems.filter(item=>item.value!=="TODOS"&&selectedSet.has(item.value)).map(item=>item.label).join(" + ");

  const control=portalHost?createPortal(
    <div ref={controlRef} style={{position:"relative",marginLeft:"auto"}} onClick={event=>event.stopPropagation()}>
      <button type="button" aria-label="Filtrar resumen general por proyecto" aria-expanded={open} title="Filtrar resumen general por proyecto" onClick={()=>setOpen(value=>!value)} style={{minWidth:88,maxWidth:160,height:28,padding:"0 8px",borderRadius:7,border:"1px solid rgba(255,255,255,.16)",background:"rgba(10,24,36,.92)",color:"#fff",fontSize:10,fontWeight:800,outline:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",gap:6}}>
        <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{summaryLabel||"Todos"}</span><span style={{fontSize:9,opacity:.8}}>▾</span>
      </button>
      {open&&<div style={{position:"absolute",right:0,top:34,zIndex:80,width:178,maxHeight:300,overflowY:"auto",padding:6,borderRadius:9,border:"1px solid rgba(255,255,255,.14)",background:"rgba(5,18,29,.98)",boxShadow:"0 16px 36px rgba(0,0,0,.38)",backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)"}}>
        {projectItems.map(item=>{
          const checked=item.value==="TODOS"?allSelected:selectedSet.has(item.value);
          return <label key={item.value} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 8px",borderRadius:6,cursor:"pointer",fontSize:10,fontWeight:800,color:"#e8edf1",background:checked?"rgba(255,255,255,.06)":"transparent"}}>
            <input type="checkbox" checked={checked} onChange={()=>toggleProject(item.value)} style={{margin:0,accentColor:"#ef233c",cursor:"pointer"}}/><span>{item.label}</span>
          </label>;
        })}
      </div>}
    </div>,portalHost):null;

  return <><ViewBienvenida {...filteredProps}/>{control}</>;
}
