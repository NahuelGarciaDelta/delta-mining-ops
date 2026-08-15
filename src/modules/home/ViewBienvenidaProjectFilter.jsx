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

const projectOf=row=>normalizeRop02Project(
  row?.proyecto??row?.Proyecto??row?.lugar??row?.Lugar??row?.["Proyecto/Lugar"]??""
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

  React.useLayoutEffect(()=>{
    window.__dmHomeSummaryProject=project;
    try{window.localStorage.setItem(STORAGE_KEY,project);}catch(_){}
    return()=>{
      if(window.__dmHomeSummaryProject===project)window.__dmHomeSummaryProject="TODOS";
    };
  },[project]);

  React.useEffect(()=>{
    let frame=0;
    const findHost=()=>{
      const host=document.querySelector(".dm-home-summary > div:first-child");
      if(host){setPortalHost(host);return;}
      frame=window.requestAnimationFrame(findHost);
    };
    findHost();
    return()=>window.cancelAnimationFrame(frame);
  },[project]);

  const filteredProps=React.useMemo(()=>{
    if(project==="TODOS")return props;
    const filterRows=rows=>Array.isArray(rows)?rows.filter(row=>projectOf(row)===project):rows;
    return {
      ...props,
      rop02All:filterRows(props.rop02All),
      rma15:filterRows(props.rma15),
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
    <ViewBienvenida key={`home_${project}`} {...filteredProps}/>
    {control}
  </>;
}
