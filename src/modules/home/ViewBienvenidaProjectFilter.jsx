import React from "react";
import { createPortal } from "react-dom";
import ViewBienvenida from "./ViewBienvenida.jsx";
import { normalizeRop02Project } from "./homeAvailability.js";

const STORAGE_KEY="dm_home_summary_project_v2";
const PROJECTS=[
  {value:"TODOS",label:"Todos"},
  {value:"JOSE MARIA",label:"JM"},
  {value:"FILO DEL SOL",label:"FDS"},
  {value:"FILO SUR",label:"Filo Sur"},
  {value:"EL ZORRO",label:"El Zorro"},
];
const PROJECT_VALUES=PROJECTS.filter(item=>item.value!=="TODOS").map(item=>item.value);
const EMPTY_RMA_SENTINEL={__dmHomeEmptyProject:true};

const projectOf=row=>normalizeRop02Project(
  row?.proyecto??row?.Proyecto??row?.lugar??row?.Lugar??row?.["Proyecto/Lugar"]??row?._proyectoForzado??""
);

function sanitizeSelection(values){
  const valid=Array.from(new Set((Array.isArray(values)?values:[]).map(value=>String(value||"").trim().toUpperCase()).filter(value=>PROJECT_VALUES.includes(value))));
  return valid.length?valid:PROJECT_VALUES;
}

function readInitialProjects(){
  try{
    const saved=window.localStorage.getItem(STORAGE_KEY);
    if(saved){
      const parsed=JSON.parse(saved);
      return sanitizeSelection(parsed);
    }
    const legacy=String(window.localStorage.getItem("dm_home_summary_project_v1")||"TODOS").trim().toUpperCase();
    if(legacy!=="TODOS"&&PROJECT_VALUES.includes(legacy))return [legacy];
  }catch(_){}
  return PROJECT_VALUES;
}

export default function ViewBienvenidaProjectFilter(props){
  const [projects,setProjects]=React.useState(readInitialProjects);
  const [portalHost,setPortalHost]=React.useState(null);
  const [open,setOpen]=React.useState(false);
  const controlRef=React.useRef(null);

  // El filtrado lo resuelve este wrapper sobre los datasets ya cargados. Se evita
  // que ViewBienvenida vuelva a pedir snapshots resumidos y que la pantalla se remonte.
  if(typeof window!=="undefined"){
    window.__dmHomeSummaryExternalFilter=true;
    window.__dmHomeSummaryProject="TODOS";
  }

  React.useEffect(()=>{
    try{window.localStorage.setItem(STORAGE_KEY,JSON.stringify(projects));}catch(_){}
  },[projects]);

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
    const close=event=>{
      if(controlRef.current&&!controlRef.current.contains(event.target))setOpen(false);
    };
    const onKey=event=>{if(event.key==="Escape")setOpen(false);};
    document.addEventListener("mousedown",close);
    document.addEventListener("keydown",onKey);
    return()=>{
      document.removeEventListener("mousedown",close);
      document.removeEventListener("keydown",onKey);
    };
  },[open]);

  const allSelected=projects.length===PROJECT_VALUES.length;
  const selectedSet=React.useMemo(()=>new Set(projects),[projects]);

  const filteredProps=React.useMemo(()=>{
    if(allSelected)return props;
    const filterRows=rows=>Array.isArray(rows)?rows.filter(row=>selectedSet.has(projectOf(row))):rows;
    const filteredRma=filterRows(props.rma15);
    return {
      ...props,
      rop02All:filterRows(props.rop02All),
      // Una combinación de proyectos sin RMA15 es un resultado válido: el sentinel
      // hace que OT abiertas muestre 0 en vez de quedar en "Cargando…".
      rma15:Array.isArray(filteredRma)&&filteredRma.length?filteredRma:[EMPTY_RMA_SENTINEL],
    };
  },[props,allSelected,selectedSet]);

  const toggleProject=value=>{
    if(value==="TODOS"){
      setProjects(PROJECT_VALUES);
      return;
    }
    setProjects(current=>{
      if(current.includes(value)){
        const next=current.filter(item=>item!==value);
        return next.length?next:current;
      }
      return [...current,value];
    });
  };

  const summaryLabel=allSelected
    ? "Todos"
    : PROJECTS.filter(item=>selectedSet.has(item.value)).map(item=>item.label).join(" + ");

  const control=portalHost?createPortal(
    <div ref={controlRef} style={{position:"relative",marginLeft:"auto"}} onClick={event=>event.stopPropagation()}>
      <button
        type="button"
        aria-label="Filtrar resumen general por proyecto"
        aria-expanded={open}
        title="Filtrar resumen general por proyecto"
        onClick={()=>setOpen(value=>!value)}
        style={{
          minWidth:88,
          maxWidth:138,
          height:28,
          padding:"0 8px",
          borderRadius:7,
          border:"1px solid rgba(255,255,255,.16)",
          background:"rgba(10,24,36,.92)",
          color:"#fff",
          fontSize:10,
          fontWeight:800,
          outline:"none",
          cursor:"pointer",
          display:"flex",
          alignItems:"center",
          justifyContent:"space-between",
          gap:6,
        }}
      >
        <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{summaryLabel}</span>
        <span style={{fontSize:9,opacity:.8}}>▾</span>
      </button>
      {open&&<div style={{
        position:"absolute",
        right:0,
        top:34,
        zIndex:80,
        width:154,
        padding:6,
        borderRadius:9,
        border:"1px solid rgba(255,255,255,.14)",
        background:"rgba(5,18,29,.98)",
        boxShadow:"0 16px 36px rgba(0,0,0,.38)",
        backdropFilter:"blur(14px)",
        WebkitBackdropFilter:"blur(14px)",
      }}>
        {PROJECTS.map(item=>{
          const checked=item.value==="TODOS"?allSelected:selectedSet.has(item.value);
          return <label key={item.value} style={{
            display:"flex",
            alignItems:"center",
            gap:8,
            padding:"7px 8px",
            borderRadius:6,
            cursor:"pointer",
            fontSize:10,
            fontWeight:800,
            color:"#e8edf1",
            background:checked?"rgba(255,255,255,.06)":"transparent",
          }}>
            <input
              type="checkbox"
              checked={checked}
              onChange={()=>toggleProject(item.value)}
              style={{margin:0,accentColor:"#ef233c",cursor:"pointer"}}
            />
            <span>{item.label}</span>
          </label>;
        })}
      </div>}
    </div>,
    portalHost,
  ):null;

  return <>
    <ViewBienvenida {...filteredProps}/>
    {control}
  </>;
}
