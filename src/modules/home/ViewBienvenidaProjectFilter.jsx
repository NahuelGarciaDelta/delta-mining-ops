import React from "react";
import { createPortal } from "react-dom";
import ViewBienvenida from "./ViewBienvenida.jsx";
import { normalizeRop02Project } from "./homeAvailability.js";

const STORAGE_KEY="dm_home_summary_project_v1";
const PROJECTS=[
  {value:"TODOS",label:"Todos"},
  {value:"JOSE MARIA",label:"JM"},
  {value:"FILO DEL SOL",label:"FDS"},
  {value:"FILO SUR",label:"Filo Sur"},
  {value:"EL ZORRO",label:"El Zorro"},
];

const EMPTY_RMA_SENTINEL={__dmHomeEmptyProject:true};

const projectOf=row=>normalizeRop02Project(
  row?.proyecto??row?.Proyecto??row?.lugar??row?.Lugar??row?.["Proyecto/Lugar"]??row?._proyectoForzado??""
);

function readInitialProject(){
  try{
    const saved=String(window.localStorage.getItem(STORAGE_KEY)||"TODOS").trim().toUpperCase();
    return PROJECTS.some(item=>item.value===saved)?saved:"TODOS";
  }catch(_){
    return "TODOS";
  }
}

export default function ViewBienvenidaProjectFilter(props){
  const [project,setProject]=React.useState(readInitialProject);
  const [portalHost,setPortalHost]=React.useState(null);

  // El filtrado lo resuelve este wrapper sobre los datasets ya cargados. Se evita
  // que ViewBienvenida vuelva a pedir snapshots resumidos porque eso obligaba a
  // remontar toda la pantalla para cambiar de proyecto y generaba el "vibrado".
  if(typeof window!=="undefined"){
    window.__dmHomeSummaryExternalFilter=true;
    window.__dmHomeSummaryProject="TODOS";
  }

  React.useEffect(()=>{
    try{window.localStorage.setItem(STORAGE_KEY,project);}catch(_){}
  },[project]);

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

  const filteredProps=React.useMemo(()=>{
    if(project==="TODOS")return props;
    const filterRows=rows=>Array.isArray(rows)?rows.filter(row=>projectOf(row)===project):rows;
    const filteredRma=filterRows(props.rma15);
    return {
      ...props,
      rop02All:filterRows(props.rop02All),
      // Un proyecto sin RMA15 es un resultado válido: el sentinel evita que la
      // tarjeta OT abiertas quede eternamente en "Cargando…" y el cálculo lo
      // ignora por no tener interno/fecha, mostrando 0.
      rma15:Array.isArray(filteredRma)&&filteredRma.length?filteredRma:[EMPTY_RMA_SENTINEL],
    };
  },[props,project]);

  const control=portalHost?createPortal(
    <select
      aria-label="Filtrar resumen general por proyecto"
      title="Filtrar resumen general por proyecto"
      value={project}
      onChange={event=>setProject(event.target.value)}
      onClick={event=>event.stopPropagation()}
      style={{
        marginLeft:"auto",
        width:82,
        minWidth:82,
        height:28,
        padding:"0 7px",
        borderRadius:7,
        border:"1px solid rgba(255,255,255,.16)",
        background:"rgba(10,24,36,.92)",
        color:"#fff",
        fontSize:10,
        fontWeight:800,
        outline:"none",
        cursor:"pointer",
      }}
    >
      {PROJECTS.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
    </select>,
    portalHost,
  ):null;

  return <>
    <ViewBienvenida {...filteredProps}/>
    {control}
  </>;
}
