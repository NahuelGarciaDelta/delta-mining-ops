import React from "react";
import { createPortal } from "react-dom";
import ViewBienvenida from "./ViewBienvenida.jsx";
import { collectProjects, projectFromRow, projectLabel } from "../../shared/projects.js";
import { APPS_SCRIPT_URL } from "../../config/app.js";
import { fetchAction } from "../../services/appsScriptApi.js";
import { readCachedSource, writeCachedSource } from "../../services/appCache.js";
import { PageLoadingMotoniveladora } from "../../components/ui/index.jsx";
import { resolveEquipmentCodeAlias } from "../equipment/equipmentCode.js";
import {
  DASHBOARD_SNAPSHOT_CACHE_VERSION,
  resolveDashboardScope,
  validateDashboardSnapshotResponse,
  validateCachedDashboardSnapshot,
} from "./dashboardSnapshotPolicy.js";

const STORAGE_KEY="dm_home_summary_project_v3";
const LEGACY_PROJECTS=new Set(["JOSE MARIA","FILO DEL SOL","FILO SUR","EL ZORRO"]);
const EMPTY_RMA_SENTINEL={__dmHomeEmptyProject:true};
const normalizeDateKey=value=>{
  if(value instanceof Date&&!Number.isNaN(value.getTime()))return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`;
  const raw=String(value??"").trim();
  if(!raw)return "";
  let match=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(match)return `${match[1]}-${String(match[2]).padStart(2,"0")}-${String(match[3]).padStart(2,"0")}`;
  match=raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})/);
  if(match){let year=Number(match[3]);if(year<100)year+=2000;return `${year}-${String(match[2]).padStart(2,"0")}-${String(match[1]).padStart(2,"0")}`;}
  const parsed=new Date(raw);
  return Number.isNaN(parsed.getTime())?"":`${parsed.getFullYear()}-${String(parsed.getMonth()+1).padStart(2,"0")}-${String(parsed.getDate()).padStart(2,"0")}`;
};
const dateFromRop02Row=row=>{
  if(!row||typeof row!=="object")return "";
  const direct=row.fecha??row.Fecha??row.FECHA??row.ultimaFecha??row.ULTIMA_FECHA;
  if(direct)return normalizeDateKey(direct);
  const key=Object.keys(row).find(k=>String(k).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").includes("fecha"));
  return key?normalizeDateKey(row[key]):"";
};
const formatDayLabel=iso=>/^\d{4}-\d{2}-\d{2}$/.test(String(iso||""))?`${iso.slice(8,10)}/${iso.slice(5,7)}/${iso.slice(0,4)}`:"Sin fecha";
const aliasDashboardRows=rows=>(Array.isArray(rows)?rows:[]).map(row=>({...row,maquina:resolveEquipmentCodeAlias(row?.maquina||row?.interno||"")}));

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
        if(clean.length===LEGACY_PROJECTS.size&&clean.every(v=>LEGACY_PROJECTS.has(v)))return null;
        return clean;
      }
    }
  }catch(_){}
  return null;
}

export default function ViewBienvenidaProjectFilter(props){
  const [selection,setSelection]=React.useState(readInitialSelection);
  const [selectedDay,setSelectedDay]=React.useState("");
  const [portalHost,setPortalHost]=React.useState(null);
  const [open,setOpen]=React.useState(false);
  const [dashboardHost,setDashboardHost]=React.useState(null);
  const [dashboardReloadToken,setDashboardReloadToken]=React.useState(0);
  const [dashboardSnapshot,setDashboardSnapshot]=React.useState({ready:false,loading:false,refreshing:false,error:"",rop02:[],rma15:[],updatedAt:"",source:""});
  const dashboardRequestRef=React.useRef(0);
  const controlRef=React.useRef(null);
  const dashboardVisible=Boolean(dashboardHost);
  const dashboardYear=React.useMemo(()=>new Date().getFullYear(),[]);
  const dashboardScope=React.useMemo(()=>resolveDashboardScope(typeof window!=="undefined"?window.sessionStorage?.getItem("dm_project")||"TODO":"TODO"),[]);
  const dashboardCacheKey=React.useMemo(()=>`dashboard-atomic-snapshot-v${DASHBOARD_SNAPSHOT_CACHE_VERSION}-${dashboardYear}-${dashboardScope.scopeKey}`,[dashboardYear,dashboardScope.scopeKey]);

  const projectValues=React.useMemo(()=>collectProjects(props.rop02All,props.rop05,props.rma15),[props.rop02All,props.rop05,props.rma15]);
  const projectItems=React.useMemo(()=>[{value:"TODOS",label:"Todos"},...projectValues.map(value=>({value,label:projectLabel(value)}))],[projectValues]);
  const selectedValues=React.useMemo(()=>{
    if(selection===null)return projectValues;
    const available=new Set(projectValues);
    const valid=selection.filter(v=>available.has(v));
    return valid.length?valid:projectValues;
  },[selection,projectValues]);
  const allSelected=selection===null||selectedValues.length===projectValues.length;
  const selectedSet=React.useMemo(()=>new Set(selectedValues),[selectedValues]);
  const projectFilteredRop02=React.useMemo(()=>{
    const source=Array.isArray(props.rop02All)?props.rop02All:[];
    return allSelected?source:source.filter(row=>selectedSet.has(projectFromRow(row)));
  },[props.rop02All,allSelected,selectedSet]);
  const availableDays=React.useMemo(()=>[...new Set(projectFilteredRop02.map(dateFromRop02Row).filter(Boolean))].sort((a,b)=>b.localeCompare(a)),[projectFilteredRop02]);
  const effectiveDay=selectedDay&&availableDays.includes(selectedDay)?selectedDay:(availableDays[0]||"");

  if(typeof window!=="undefined"){
    window.__dmHomeSummaryExternalFilter=true;
    window.__dmHomeSummaryProject="TODOS";
  }
  React.useEffect(()=>{try{window.localStorage.setItem(STORAGE_KEY,JSON.stringify(selection===null?"TODOS":selection));}catch(_){}},[selection]);
  React.useEffect(()=>()=>{if(typeof window!=="undefined"){window.__dmHomeSummaryExternalFilter=false;window.__dmHomeSummaryProject="TODOS";}},[]);
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
    document.addEventListener("mousedown",close);document.addEventListener("keydown",onKey);
    return()=>{document.removeEventListener("mousedown",close);document.removeEventListener("keydown",onKey);};
  },[open]);
  React.useEffect(()=>{
    // ViewBienvenida usa el mismo prop rop02All para el Resumen General y su
    // Dashboard interno. Detectamos la vista para que el Resumen conserve su
    // filtro diario mientras el Dashboard cambia a un snapshot atómico propio.
    const syncDashboardHost=()=>{
      const host=document.querySelector(".dm-home-dashboard-shell");
      setDashboardHost(current=>current===host?current:(host||null));
    };
    syncDashboardHost();
    const observer=new MutationObserver(syncDashboardHost);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[]);

  React.useEffect(()=>{
    if(!dashboardVisible)return;
    const requestId=++dashboardRequestRef.current;
    let alive=true;

    const publish=(snapshot,source)=>{
      if(!alive||requestId!==dashboardRequestRef.current)return;
      const next={
        ready:true,loading:false,refreshing:source==="validated-cache",error:"",
        rop02:aliasDashboardRows(snapshot.rop02),rma15:aliasDashboardRows(snapshot.rma15),
        updatedAt:snapshot.updatedAt||"",source,
        projectStats:snapshot.projectStats||null,coverage:snapshot.coverage||null,distribution:snapshot.distribution||null,
        backendVersion:snapshot.backendVersion||"",
      };
      setDashboardSnapshot(next);
      if(typeof window!=="undefined")window.__dmDashboardSnapshotDiagnostics={...next,scope:dashboardScope};
    };

    const run=async()=>{
      let hasValid=false;
      try{
        const record=await readCachedSource(dashboardCacheKey).catch(()=>null);
        const cached=validateCachedDashboardSnapshot(record?.value??record?.data,dashboardYear,dashboardScope);
        if(cached){hasValid=true;publish(cached,"validated-cache");}
      }catch(_){}

      if(!alive||requestId!==dashboardRequestRef.current)return;
      setDashboardSnapshot(prev=>({...prev,loading:!prev.ready&&!hasValid,refreshing:prev.ready||hasValid,error:""}));

      try{
        const response=await fetchAction(APPS_SCRIPT_URL,"dashboard_snapshot",{force:true,compact:false,retries:1,timeoutMs:55000});
        const checked=validateDashboardSnapshotResponse(response,dashboardYear,dashboardScope);
        const updatedAt=new Date().toISOString();
        const cachedValue={
          ok:true,cacheVersion:DASHBOARD_SNAPSHOT_CACHE_VERSION,year:dashboardYear,scopeKey:dashboardScope.scopeKey,updatedAt,
          backendVersion:checked.backendVersion,rop02:aliasDashboardRows(checked.rop02),rma15:aliasDashboardRows(checked.rma15),
          stats:checked.stats||null,coverage:checked.coverage||null,distribution:checked.distribution||null,projectStats:checked.projectStats||null,
        };
        await writeCachedSource(dashboardCacheKey,cachedValue).catch(()=>{});
        publish(cachedValue,"network");
      }catch(error){
        if(!alive||requestId!==dashboardRequestRef.current)return;
        const message=String(error?.message||error||"No se pudo actualizar el snapshot completo.");
        setDashboardSnapshot(prev=>prev.ready?{...prev,loading:false,refreshing:false,error:message}:{...prev,ready:false,loading:false,refreshing:false,error:message,rop02:[],rma15:[]});
      }
    };

    run();
    return()=>{alive=false;};
  },[dashboardVisible,dashboardReloadToken,dashboardCacheKey,dashboardScope,dashboardYear]);

  const filteredProps=React.useMemo(()=>{
    const filterRows=rows=>Array.isArray(rows)?(allSelected?rows:rows.filter(row=>selectedSet.has(projectFromRow(row)))):rows;
    const filteredRma=filterRows(props.rma15);
    const dailySummaryRop02=effectiveDay?projectFilteredRop02.filter(row=>dateFromRop02Row(row)===effectiveDay):projectFilteredRop02;

    // La selección de proyecto/día de RESUMEN GENERAL no puede recortar el
    // Dashboard Gerencial. En Dashboard se usa exclusivamente el alcance de
    // permisos del usuario aplicado al snapshot atómico validado.
    if(dashboardVisible){
      return {
        ...props,
        rop02All:dashboardSnapshot.ready?dashboardSnapshot.rop02:[],
        rop05:Array.isArray(props.rop05)?props.rop05:[],
        rma15:dashboardSnapshot.ready?dashboardSnapshot.rma15:[],
        summaryDayFiltered:false,
      };
    }

    return {
      ...props,
      rop02All:dailySummaryRop02,
      rop05:filterRows(props.rop05),
      rma15:Array.isArray(filteredRma)&&filteredRma.length?filteredRma:[EMPTY_RMA_SENTINEL],
      summaryDayFiltered:Boolean(effectiveDay),
    };
  },[props,allSelected,selectedSet,projectFilteredRop02,effectiveDay,dashboardVisible,dashboardSnapshot]);

  const toggleProject=value=>{
    setSelectedDay("");
    if(value==="TODOS"){setSelection(null);return;}
    setSelection(current=>{
      const base=current===null?[...projectValues]:[...current];
      if(base.includes(value)){const next=base.filter(item=>item!==value);return next.length?next:base;}
      const next=[...base,value];return next.length>=projectValues.length?null:next;
    });
  };
  const summaryLabel=allSelected?"Todos":projectItems.filter(item=>item.value!=="TODOS"&&selectedSet.has(item.value)).map(item=>item.label).join(" + ");

  const control=portalHost?createPortal(
    <div ref={controlRef} style={{position:"relative",marginLeft:"auto",width:124,maxWidth:"42%",minWidth:0,display:"flex",flexDirection:"column",gap:5,alignItems:"stretch",boxSizing:"border-box"}} onClick={event=>event.stopPropagation()}>
      <button type="button" aria-label="Filtrar resumen general por proyecto" aria-expanded={open} title="Filtrar resumen general por proyecto" onClick={()=>setOpen(value=>!value)} style={{width:"100%",minWidth:0,height:28,padding:"0 8px",boxSizing:"border-box",borderRadius:7,border:"1px solid rgba(255,255,255,.16)",background:"rgba(10,24,36,.92)",color:"#fff",fontSize:10,fontWeight:800,outline:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",gap:6}}>
        <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{summaryLabel||"Todos"}</span><span style={{fontSize:9,opacity:.8,flex:"0 0 auto"}}>▾</span>
      </button>
      <select aria-label="Filtrar resumen general por día" title="Día ROP02 del resumen" value={effectiveDay} onChange={event=>setSelectedDay(event.target.value)} disabled={!availableDays.length} style={{width:"100%",minWidth:0,height:26,padding:"0 7px",boxSizing:"border-box",borderRadius:7,border:"1px solid rgba(255,255,255,.16)",background:"rgba(10,24,36,.92)",color:"#fff",fontSize:9,fontWeight:800,outline:"none",cursor:availableDays.length?"pointer":"default"}}>
        {!availableDays.length&&<option value="">Sin registros</option>}
        {availableDays.map(day=><option key={day} value={day}>{formatDayLabel(day)}</option>)}
      </select>
      {open&&<div style={{position:"absolute",right:0,top:34,zIndex:80,width:178,maxWidth:"min(178px, 80vw)",maxHeight:300,overflowY:"auto",padding:6,boxSizing:"border-box",borderRadius:9,border:"1px solid rgba(255,255,255,.14)",background:"rgba(5,18,29,.98)",boxShadow:"0 16px 36px rgba(0,0,0,.38)",backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)"}}>
        {projectItems.map(item=>{const checked=item.value==="TODOS"?allSelected:selectedSet.has(item.value);return <label key={item.value} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 8px",borderRadius:6,cursor:"pointer",fontSize:10,fontWeight:800,color:"#e8edf1",background:checked?"rgba(255,255,255,.06)":"transparent"}}><input type="checkbox" checked={checked} onChange={()=>toggleProject(item.value)} style={{margin:0,accentColor:"#ef233c",cursor:"pointer"}}/><span>{item.label}</span></label>;})}
      </div>}
    </div>,portalHost):null;

  const dashboardGuard=dashboardHost?createPortal(
    !dashboardSnapshot.ready?(
      <div style={{position:"absolute",inset:0,zIndex:120,display:"grid",placeItems:"center",background:"rgba(7,13,19,.96)",borderRadius:14}}>
        {dashboardSnapshot.error?(
          <div style={{maxWidth:620,padding:20,textAlign:"center",color:"#fff"}}>
            <div style={{fontWeight:900,fontSize:15,marginBottom:8,color:"#ff6b74"}}>Dashboard bloqueado para evitar ROP02 parcial</div>
            <div style={{fontSize:11,lineHeight:1.5,color:"#cbd5e1",marginBottom:12}}>{dashboardSnapshot.error}</div>
            <button type="button" onClick={()=>setDashboardReloadToken(value=>value+1)} style={{border:"1px solid #ef233c88",background:"#ef233c22",color:"#fff",borderRadius:8,padding:"8px 12px",fontWeight:800,cursor:"pointer"}}>Reintentar carga completa</button>
          </div>
        ):<PageLoadingMotoniveladora label={`Cargando snapshot completo ${dashboardYear}...`}/>} 
      </div>
    ):dashboardSnapshot.error?(
      <div style={{position:"absolute",left:10,right:10,top:8,zIndex:120,padding:"7px 10px",borderRadius:7,border:"1px solid #eab30866",background:"rgba(80,58,5,.94)",color:"#fef3c7",fontSize:10,lineHeight:1.4}}>
        Se conserva el último snapshot completo porque la actualización no terminó correctamente. {dashboardSnapshot.error}
      </div>
    ):null,
    dashboardHost
  ):null;

  React.useEffect(()=>{
    if(!dashboardHost)return;
    const previous=dashboardHost.style.position;
    if(!previous||previous==="static")dashboardHost.style.position="relative";
    return()=>{dashboardHost.style.position=previous;};
  },[dashboardHost]);

  return <><ViewBienvenida {...filteredProps}/>{control}{dashboardGuard}</>;
}
