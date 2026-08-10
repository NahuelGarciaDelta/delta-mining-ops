import React, {useEffect, useMemo, useState} from "react";
import { Icon } from "../../components/ui/index.jsx";
import { APP_BUILD_LABEL } from "../../app/version.js";
import { APPS_SCRIPT_URL } from "../../config/app.js";
import { fetchAction } from "../../services/appsScriptApi.js";
import { fetchStockData } from "../../services/stockService.js";
import WeatherModule,{useBatideroWeather} from "../weather/WeatherModule.jsx";

const norm=v=>String(v??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
const getVal=(row,cands)=>{const keys=Object.keys(row||{});for(const cand of cands){const w=norm(cand);for(const k of keys){const nk=norm(k);if(nk===w||nk.includes(w)||w.includes(nk))return row[k];}}return "";};
const toNum=v=>{const n=Number(String(v??"").replace(/\./g,"").replace(",",".").replace(/[^0-9.-]/g,""));return Number.isFinite(n)?n:0;};
const codeOf=r=>String(getVal(r,["Maquina","Máquina","Interno","Código Interno","Codigo nuevo","Código nuevo","Codigo de Drusila","Código de Drusila","Codigo Int"])||"").trim().toUpperCase().replace(/-JM$/i,"");
const dateOf=r=>{const raw=getVal(r,["Fecha","Fecha OT","Fecha del Parte Diario","Fecha de solicitud"]);if(!raw)return null;const s=String(raw);const d=/^\d{4}-\d{2}-\d{2}/.test(s)?new Date(`${s.slice(0,10)}T12:00:00`):new Date(s);return Number.isNaN(d.getTime())?null:d;};

function MiniIcon({name,color="#fff",bg="rgba(255,255,255,.08)"}){return <span style={{width:44,height:44,borderRadius:14,display:"inline-flex",alignItems:"center",justifyContent:"center",background:bg,flex:"0 0 auto"}}><Icon name={name} size={23} color={color}/></span>;}

export default function ViewBienvenida({onOpenModule,onNavigate,rawSources={},rma15=[],listaEquipos=[],rop02All=[],nombreUsuario="Usuario",areaUsuario="OFICINA TÉCNICA",onOpenProfile,onLogout,esAdministrativo=false}){
  const [now,setNow]=useState(()=>new Date());
  const {data:weatherData}=useBatideroWeather();
  const [sharedStockRows,setSharedStockRows]=useState([]);
  useEffect(()=>{const id=setInterval(()=>setNow(new Date()),30000);return()=>clearInterval(id);},[]);
  useEffect(()=>{let alive=true;fetchStockData(APPS_SCRIPT_URL).then(r=>{if(alive)setSharedStockRows(Array.isArray(r.rows)?r.rows:[]);}).catch(()=>{});return()=>{alive=false;};},[]);

  const stats=useMemo(()=>{
    const equipos=Array.isArray(listaEquipos)?listaEquipos:[];
    const rop=Array.isArray(rop02All)?rop02All:[];
    const rma=Array.isArray(rma15)?rma15:[];
    const seven=new Date();seven.setDate(seven.getDate()-7);seven.setHours(0,0,0,0);

    const normalizeCode=v=>String(v||"").trim().toUpperCase().replace(/\s+/g,"").replace(/-JM$/i,"");
    const listaByCode=new Map();
    equipos.forEach(row=>{
      const codes=[
        getVal(row,["Codigo nuevo","Código nuevo"]),
        getVal(row,["Codigo de Drusila","Código de Drusila"]),
        getVal(row,["Interno","Código Interno","Codigo Interno"]),
      ].map(normalizeCode).filter(Boolean);
      codes.forEach(c=>{if(!listaByCode.has(c))listaByCode.set(c,row);});
    });
    const classifyActive=code=>{
      const row=listaByCode.get(normalizeCode(code))||{};
      const familia=norm(getVal(row,["Familia","Tipo","Tipo de máquina","Tipo de maquina","Equipo"]));
      const modelo=norm(getVal(row,["Modelo","Marca"]));
      const c=normalizeCode(code);
      if(familia.includes("camioneta")||familia.includes("pick")||modelo.includes("hilux")||/^CTA/.test(c)||/^(AG|AH|AI)[0-9A-Z]/.test(c))return "camioneta";
      if((familia.includes("camion")||familia.includes("camión"))&&!familia.includes("camioneta"))return "camion";
      return "vial";
    };

    const activos=new Set();
    rop.forEach(r=>{const d=dateOf(r);const c=codeOf(r);if(c&&d&&d>=seven)activos.add(normalizeCode(c));});
    const operativos={viales:0,camiones:0,camionetas:0};
    activos.forEach(c=>{const type=classifyActive(c);if(type==="camioneta")operativos.camionetas++;else if(type==="camion")operativos.camiones++;else operativos.viales++;});

    const latest=new Map();rma.forEach(r=>{const c=normalizeCode(codeOf(r));const d=dateOf(r);if(!c||!d)return;const prev=latest.get(c);if(!prev||d>prev.d)latest.set(c,{d,row:r});});
    let oper=0,total=0,abiertas=0;latest.forEach(({row})=>{const op=norm(getVal(row,["Operativo","Estado operativo","Estado"]));if(op){total++;if(["si","sí","operativo","true","1"].includes(op))oper++;else if(["no","fuera de servicio","false","0"].includes(op))abiertas++;}});
    const disponibilidad=total?Math.round(oper/total*100):null;
    let stockCritico=null;
      if(sharedStockRows.length){
        stockCritico=sharedStockRows.filter(r=>{
          const deposito=String(r?.descripcionDeposito||"").trim().toUpperCase();
          if(deposito&&!(["DEPOSITO CENTRAL","DEPOSITO BATIDERO","DEPOSITO FILO DEL SOL"].includes(deposito)))return false;
          const saldo=toNum(r?.saldoControlStock);
          const minimo=toNum(r?.stockMinimo);
          return minimo>0&&saldo<minimo;
        }).length;
      }
    return {...operativos,disponibilidad,otAbiertas:abiertas,stockCritico};
  },[listaEquipos,rop02All,rma15,rawSources,sharedStockRows]);

  const quick=esAdministrativo?[
    {label:"Control",desc:"Errores, consistencia y solicitudes.",icon:"shieldCheck",color:"#3b82f6",module:"administrativoErrores",view:"controlErrores"},
    {label:"Solicitudes",desc:"Seguimiento operativo de abastecimiento.",icon:"clipboardList",color:"#f59e0b",module:"administrativoSolicitudes",view:"abastecimiento"},
  ]:[
    {label:"Oficina Técnica",desc:"Planes, ROP, productividad y documentación técnica.",icon:"fileBarChart",color:"#2388ff",module:"oficina",view:"rop02"},
    {label:"Mantenimiento",desc:"OT, preventivos, costos y disponibilidad.",icon:"wrench",color:"#f2a500",module:"mantenimiento",view:"mant"},
    {label:"Calidad",desc:"Inspecciones, no conformidades y KPI.",icon:"shieldCheck",color:"#22c55e",module:"calidad",view:"chc"},
    {label:"Abastecimiento",desc:"RABA, remitos, stock y abastecimiento.",icon:"package",color:"#a855f7",module:"abastecimiento",view:"abastecimiento"},
    {label:"Taller Central",desc:"Equipos, repuestos y servicios internos.",icon:"gear",color:"#f97316",module:"tallerCentral",view:"tallerCentral"},
    {label:"Licitaciones",desc:"Ofertas, proyectos y seguimiento.",icon:"fileSpreadsheet",color:"#22d3ee",module:"licitaciones",view:"licitaciones"},
  ];
  const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
  const [activeView,setActiveView]=useState(()=>{const requested=sessionStorage.getItem("dm_home_requested_view");sessionStorage.removeItem("dm_home_requested_view");return requested==="weather"?"weather":"home";});
  useEffect(()=>{const open=()=>setActiveView("weather");window.addEventListener("dm-open-weather",open);return()=>window.removeEventListener("dm-open-weather",open);},[]);
  const [agendaMonth,setAgendaMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));
  const [agendaData,setAgendaData]=useState({programaciones:[],licitaciones:[],loading:true,error:""});
  useEffect(()=>{
    let alive=true;
    Promise.allSettled([
      fetchAction(APPS_SCRIPT_URL,"mantenimiento_programado"),
      fetchAction(APPS_SCRIPT_URL,"licitaciones_compartidas"),
    ]).then(([pm,lic])=>{
      if(!alive)return;
      const errors=[pm,lic].filter(result=>result.status==="rejected").map(result=>result.reason?.message||String(result.reason));
      setAgendaData({
        programaciones:Array.isArray(pm.value?.programaciones)?pm.value.programaciones:[],
        licitaciones:Array.isArray(lic.value?.data)?lic.value.data:[],
        loading:false,
        error:errors.join(" · "),
      });
    });
    return()=>{alive=false;};
  },[]);
  const favoriteOptions=[
    {id:"rop02",label:"ROP02",icon:"fileBarChart",color:"#38bdf8"},
    {id:"rma15CtrlEquipo",label:"RMA15",icon:"wrench",color:"#f59e0b"},
    {id:"costosMant",label:"Informe de costos",icon:"barChart",color:"#a78bfa"},
    {id:"equipmentProfile",label:"Ficha única",icon:"person",color:"#22c55e"},
    {id:"dashboard",label:"Dashboard ejecutivo",icon:"dashboard",color:"#60a5fa"},
    {id:"licitaciones",label:"Licitaciones",icon:"fileSpreadsheet",color:"#22d3ee"},
    {id:"pmProgramacion",label:"Mantenimiento programado",icon:"calendar",color:"#f97316"},
  ];
  const [favorites,setFavorites]=useState(()=>{try{const saved=JSON.parse(localStorage.getItem("dm_home_favorites_v1")||"[]");return Array.isArray(saved)?saved.filter(id=>favoriteOptions.some(x=>x.id===id)):[];}catch(_){return [];}});
  useEffect(()=>{try{localStorage.setItem("dm_home_favorites_v1",JSON.stringify(favorites));}catch(_){}},[favorites]);
  const toggleFavorite=id=>setFavorites(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id]);
  const openView=id=>onNavigate?.(id);
  const favoritesBadge=favorites.length;
  const sidebarSectionsBase=[
    {key:"home",label:"Inicio",icon:"dashboard",active:activeView==="home",badge:null,action:()=>setActiveView("home")},
    {key:"favorites",label:"Favoritos",icon:"barChart",active:activeView==="favorites",badge:favoritesBadge>0?favoritesBadge:null,action:()=>setActiveView("favorites")},
    {key:"agenda",label:"Agenda",icon:"calendar",active:activeView==="agenda",badge:null,action:()=>setActiveView("agenda")},
    {key:"weather",label:"Clima",icon:"alert",active:activeView==="weather",badge:null,action:()=>setActiveView("weather")},
    {key:"dashboard",label:"Dashboard",icon:"barChart",active:false,badge:null,action:()=>openView("dashboard")},
    {key:"docs",label:"Documentos",icon:"fileBarChart",active:activeView==="docs",badge:null,action:()=>setActiveView("docs")},
    {key:"profile",label:"Mi Perfil",icon:"person",active:activeView==="profile",badge:null,action:()=>onOpenProfile?.()},
  ];
  const sidebarSections=esAdministrativo
    ? sidebarSectionsBase.filter(item=>["home","weather","profile"].includes(item.key))
    : sidebarSectionsBase;
  const firstName=String(nombreUsuario||"Usuario").trim().split(/\s+/)[0].toUpperCase();
  const dateTop=now.toLocaleDateString("es-AR",{day:"numeric",month:"long",year:"numeric"});
  const weekday=now.toLocaleDateString("es-AR",{weekday:"long"});
  const hour=now.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit",hour12:false});
  const turno=now.getHours()>=7&&now.getHours()<19?"Turno Día":"Turno Noche";

  const renderPanel=(title,subtitle,body,accent="#ef233c")=><section style={{display:"flex",alignItems:"flex-start",justifyContent:"center",minHeight:0}}><div className="dm-panel-shell" style={{width:"100%",maxWidth:1400,padding:"28px 30px",borderRadius:22,background:"rgba(5,18,29,.74)",border:`1px solid ${accent}22`,boxShadow:"0 18px 42px rgba(0,0,0,.24)",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)"}}><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}><span style={{width:10,height:10,borderRadius:"50%",background:accent}}/><span style={{fontSize:12,fontWeight:900,letterSpacing:".16em",color:"#9ba6ae"}}>{title.toUpperCase()}</span></div><div style={{fontSize:30,fontWeight:900,color:"#fff",marginBottom:8}}>{title}</div><div style={{fontSize:13,lineHeight:1.6,color:"rgba(255,255,255,.72)",marginBottom:20}}>{subtitle}</div><div style={{display:"grid",gap:12,minWidth:0}}>{body}</div></div></section>;
  const actionGrid=(items)=><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:10}}>{items.map(item=><ActionCard key={item.label} {...item} onClick={()=>openView(item.view)}/>)}</div>;

  const renderCentralContent=()=>{
    if(activeView==="favorites")return renderPanel("Favoritos","Persisten en este dispositivo. Agregá o quitá cualquier vista operativa y abrila sin recargar la aplicación.",<>{favorites.length?actionGrid(favoriteOptions.filter(item=>favorites.includes(item.id)).map(item=>({...item,view:item.id,detail:"Abrir módulo",trailing:"Quitar",onTrailing:()=>toggleFavorite(item.id)}))):<div style={{color:"rgba(255,255,255,.72)",fontSize:13}}>Todavía no agregaste favoritos.</div>}<div style={{fontSize:12,fontWeight:900,color:"#9ba6ae",letterSpacing:".12em",marginTop:4}}>VISTAS DISPONIBLES</div>{actionGrid(favoriteOptions.filter(item=>!favorites.includes(item.id)).map(item=>({...item,view:item.id,detail:"Agregar a favoritos",trailing:"Agregar",onTrailing:()=>toggleFavorite(item.id)})))}</>, "#38bdf8");
    if(activeView==="agenda")return renderPanel("Agenda operativa","Calendario mensual con programaciones de mantenimiento y fechas de licitación disponibles en los servicios existentes.",<OperationalAgenda month={agendaMonth} onMonthChange={setAgendaMonth} data={agendaData} onNavigate={openView}/>, "#22c55e");
    if(activeView==="weather")return renderPanel("Clima operacional","Pronóstico para Campamento Batidero orientado a condiciones relevantes para la operación minera.",<WeatherModule/>, "#38bdf8");
    if(activeView==="docs")return renderPanel("Documentos","Se reutilizan los informes, planillas y fichas ya disponibles en los módulos operativos; no se creó una biblioteca paralela.",actionGrid([{label:"Ficha única de equipo",view:"equipmentProfile",icon:"person",color:"#22c55e",detail:"Abrir ficha"},{label:"Informe de costos",view:"costosMant",icon:"barChart",color:"#a78bfa",detail:"Abrir informe"},{label:"Planillas de licitación",view:"licitaciones",icon:"fileSpreadsheet",color:"#22d3ee",detail:"Abrir licitaciones"},{label:"Documentación técnica",view:"listaEquipos",icon:"fileBarChart",color:"#60a5fa",detail:"Abrir lista maestra"}]), "#3b82f6");
    return null;
  };

  return <div className="dm-home" style={{position:"relative",minHeight:"100dvh",background:"#071018",fontFamily:"Inter,Arial,sans-serif",color:"#fff"}}>
    <style>{`html,body,#root{min-width:0;min-height:100%;overflow-x:hidden}.dm-home{display:grid;grid-template-columns:218px minmax(0,1fr)}.dm-home>aside{position:sticky!important;height:100dvh;grid-column:1}.dm-home>main{position:relative!important;inset:auto!important;grid-column:2;min-width:0;min-height:100dvh;overflow-y:auto}.dm-home>main>div:first-child{flex-wrap:wrap}.dm-home-quick{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))!important}.dm-home-hero{display:grid!important;grid-template-columns:minmax(0,1fr) 252px;gap:24px}.dm-home-summary{position:relative!important;inset:auto!important;transform:none!important;width:100%!important}.dm-panel-shell{padding:clamp(14px,2.2vw,30px)!important}@media(max-width:980px){.dm-home{grid-template-columns:84px minmax(0,1fr)}.dm-home>aside{width:84px!important}.dm-home>main{padding:20px!important}.dm-home-hero{grid-template-columns:1fr}.dm-home-summary{max-width:none}.dm-home>main>div:first-child{justify-content:flex-start!important}}@media(max-width:620px){.dm-home{display:block;padding-bottom:68px}.dm-home>aside{position:fixed!important;left:0!important;right:0!important;top:auto!important;bottom:0!important;width:100%!important;height:64px!important;z-index:20}.dm-home>aside>div:first-child,.dm-home>aside>div:last-child{display:none!important}.dm-home>aside>div:nth-child(2){height:64px;padding:6px!important;display:flex!important;flex-direction:row!important;overflow-x:auto}.dm-home>aside button{min-width:52px!important;height:50px!important;padding:0!important;justify-content:center!important}.dm-home>main{padding:14px!important;min-height:auto!important}.dm-home>main>div:first-child{gap:10px!important}.dm-home>main>div:first-child>*:nth-child(n+4){display:none}.dm-home-hero-copy{padding:28px 4px 16px}.dm-home-hero-copy br{display:none}.dm-home-quick{grid-template-columns:1fr 1fr!important}.dm-home-quick button{height:auto!important;min-height:112px}.dm-panel-shell{border-radius:14px!important}}@media(max-width:390px){.dm-home-quick{grid-template-columns:1fr!important}}`}</style>
    <style>{`@media(max-width:620px){.dm-home>main>div:first-child>*{display:flex!important}.dm-home>main>div:first-child{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));align-items:center}.dm-home>main>div:first-child>div{min-width:0}.dm-home>main>div:first-child>div:nth-of-type(3){grid-column:1/-1}.dm-home>main>div:first-child>div:nth-of-type(3)>div:last-child{white-space:normal!important}.dm-home-hero-copy{margin:0!important;max-width:100%!important}.dm-home-summary>div:last-child{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 12px}.dm-home-summary>div:last-child>div{min-width:0}.dm-agenda{width:100%;max-width:100%;min-width:0}.dm-agenda-main>*{min-width:0}.dm-agenda-day{min-width:0}.dm-agenda-event{max-width:100%}}`}</style>
    <img src="/img/embedded/home-welcome-b80067ac.jpg" alt="Delta Mining" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",objectPosition:"center",filter:"brightness(.78) saturate(.86)"}}/>
    <div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,rgba(3,12,20,.28) 0 12%,rgba(3,10,17,.22) 27%,rgba(3,10,17,.12) 64%,rgba(3,10,17,.42) 100%)"}}/>
    <div style={{position:"absolute",inset:0,background:"linear-gradient(0deg,rgba(3,11,18,.94) 0%,rgba(3,11,18,.05) 42%,rgba(3,11,18,.18) 100%)"}}/>

    <aside style={{position:"absolute",left:0,top:0,bottom:0,width:sidebarCollapsed?84:218,background:"rgba(10,16,24,.72)",borderRight:"1px solid rgba(255,255,255,.08)",display:"flex",flexDirection:"column",zIndex:5,boxShadow:"12px 0 36px rgba(0,0,0,.18)",backdropFilter:"blur(18px) saturate(115%)",WebkitBackdropFilter:"blur(18px) saturate(115%)",transition:"width .24s ease"}}>
      <div style={{height:150,display:"flex",alignItems:"center",justifyContent:"center",borderBottom:"1px solid rgba(255,255,255,.05)",padding:"0 12px"}}><img src="/img/embedded/app-logo-7fab0f62.webp" alt="Delta Mining" style={{width:sidebarCollapsed?44:92,height:"auto",transition:"width .24s ease"}}/></div>
      <div style={{padding:"10px 8px",flex:1,display:"flex",flexDirection:"column",gap:6,overflowY:"auto"}}>
        {sidebarSections.map(item=><button key={item.key} onClick={item.action} title={sidebarCollapsed?item.label:""} style={{...navStyle(item.active),padding:sidebarCollapsed?"0 0 0 0":"0 12px",justifyContent:sidebarCollapsed?"center":"flex-start",height:46,borderRadius:10,background:item.active?"rgba(239,35,60,.12)":"rgba(255,255,255,.03)",border:item.active?"1px solid rgba(239,35,60,.28)":"1px solid transparent",boxShadow:item.active?"0 8px 24px rgba(0,0,0,.16)":"none",position:"relative",transition:"all .2s ease"}} onMouseEnter={e=>{if(!item.active){e.currentTarget.style.background="rgba(255,255,255,.06)";e.currentTarget.style.borderColor="rgba(255,255,255,.08)";}}} onMouseLeave={e=>{if(!item.active){e.currentTarget.style.background="rgba(255,255,255,.03)";e.currentTarget.style.borderColor="transparent";}}}><span style={{position:"absolute",left:0,top:8,bottom:8,width:3,borderRadius:999,background:item.active?"#e30613":"transparent"}}/>{item.active&&<span style={{position:"absolute",left:0,top:0,bottom:0,width:"100%",background:"linear-gradient(90deg,rgba(227,6,19,.18),rgba(227,6,19,.04))",pointerEvents:"none",borderRadius:10}}/>}{sidebarCollapsed?<div style={{display:"flex",alignItems:"center",justifyContent:"center",width:"100%"}}><Icon name={item.icon} size={18} color={item.active?"#fff":"#d8dee4"}/>{item.badge!==null&&item.badge!==undefined&&item.badge>0?<span style={{position:"absolute",top:4,right:8,width:16,height:16,borderRadius:"50%",background:"#e30613",color:"#fff",fontSize:10,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{item.badge}</span>:null}</div>:<><Icon name={item.icon} size={18} color={item.active?"#fff":"#d8dee4"}/><span style={{flex:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.label}</span>{item.badge!==null&&item.badge!==undefined&&item.badge>0?<span style={{padding:"2px 7px",borderRadius:999,background:"rgba(227,6,19,.2)",color:"#ff7b7b",fontSize:10,fontWeight:800}}>{item.badge}</span>:null}</>}</button>)}
      </div>
      <div style={{padding:"12px 10px 14px",borderTop:"1px solid rgba(255,255,255,.05)"}}>
        <button onClick={onOpenProfile} title={sidebarCollapsed?"Mi Perfil":""} style={{width:"100%",display:"flex",gap:10,alignItems:"center",marginBottom:12,padding:"9px 10px",border:"1px solid rgba(255,255,255,.08)",background:"rgba(255,255,255,.04)",borderRadius:10,color:"#fff",cursor:"pointer",textAlign:"left",backdropFilter:"blur(10px)"}}><div style={{width:34,height:34,borderRadius:"50%",background:"rgba(41,51,61,.82)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,border:"1px solid rgba(255,255,255,.08)",flexShrink:0}}>{String(nombreUsuario||"NG").split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase()}</div>{!sidebarCollapsed&&<div style={{minWidth:0,flex:1}}><div style={{fontSize:12,fontWeight:800,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{nombreUsuario}</div><div style={{fontSize:10,color:"#aab4bc",marginTop:2}}>{String(areaUsuario||"Oficina Técnica").replace(/_/g," ")}</div></div>}</button>
        <button onClick={onLogout} style={{width:"100%",padding:"10px 12px",border:"1px solid rgba(255,255,255,.07)",borderRadius:10,background:"rgba(5,15,23,.34)",color:"#e8edf1",display:"flex",alignItems:"center",justifyContent:sidebarCollapsed?"center":"flex-start",gap:9,cursor:"pointer",fontSize:12,fontWeight:700,backdropFilter:"blur(8px)"}}>{sidebarCollapsed?<Icon name="close" size={16} color="#e8edf1"/>:<><Icon name="chevronRight" size={17} color="#e8edf1"/>Cerrar sesión</>}</button>
      </div>
    </aside>

    <main style={{position:"absolute",left:sidebarCollapsed?84:218,right:0,top:0,bottom:0,zIndex:2,padding:"30px 48px 26px",display:"grid",gridTemplateRows:"auto 1fr auto auto auto",gap:14,transition:"left .24s ease"}}>
      <div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:22,minHeight:48}}>
        <TopInfo icon="☁" value={weatherData?.current?`${Math.round(weatherData.current.temperature_2m)}°C`:"—°C"} sub="Camp. Batidero · Iglesia"/>
        <Sep/><TopInfo icon="▣" value={dateTop} sub={weekday.charAt(0).toUpperCase()+weekday.slice(1)}/>
        <Sep/><TopInfo icon="◷" value={hour} sub={turno}/>
      </div>

      {activeView==="home"?(
        <>
          <section className="dm-home-hero" style={{position:"relative",display:"flex",alignItems:"center",minHeight:0}}>
            <div className="dm-home-hero-copy" style={{maxWidth:600,marginLeft:54,marginTop:-12}}>
              <div style={{fontSize:"clamp(28px,3vw,48px)",fontWeight:500,letterSpacing:".01em",lineHeight:1}}>BIENVENIDO</div>
              <div style={{fontSize:"clamp(52px,5vw,86px)",fontWeight:900,letterSpacing:".025em",lineHeight:1.04,marginTop:8,textShadow:"0 4px 24px rgba(0,0,0,.35)"}}>{firstName}</div>
              <div style={{marginTop:20,fontSize:18,fontWeight:700,letterSpacing:".07em",color:"#f0f2f4"}}>ABRIENDO CAMINOS, CONSTRUYENDO FUTURO.</div>
              <div style={{width:46,height:3,background:"#ef233c",margin:"18px 0 18px"}}/>
              <div style={{fontSize:18,lineHeight:1.5,color:"rgba(255,255,255,.88)",maxWidth:500}}>Accedé a la información y herramientas<br/>que impulsan cada proyecto, cada equipo<br/>y cada logro.</div>
            </div>

            <div className="dm-home-summary" style={{position:"absolute",right:0,top:"50%",transform:"translateY(-45%)",width:252,borderRadius:10,background:"rgba(5,18,29,.62)",border:"1px solid rgba(255,255,255,.10)",boxShadow:"0 18px 45px rgba(0,0,0,.26)",overflow:"hidden",backdropFilter:"blur(18px) saturate(115%)",WebkitBackdropFilter:"blur(18px) saturate(115%)"}}>
              <div style={{padding:"17px 18px",fontSize:14,fontWeight:900,borderBottom:"1px solid rgba(255,255,255,.07)",display:"flex",alignItems:"center",gap:8}}><Icon name="dashboard" size={16} color="#fff"/>RESUMEN GENERAL</div>
              <div style={{padding:"9px 14px 13px"}}>
                <SummaryRow icon="truck" color="#e7edf2" label="Equipos viales operativos" value={stats.viales??"—"}/>
                <SummaryRow icon="truck" color="#60a5fa" label="Camiones operativos" value={stats.camiones??"—"}/>
                <SummaryRow icon="car" color="#22d3ee" label="Camionetas operativas" value={stats.camionetas??"—"}/>
                <SummaryRow icon="hours" color="#22d3ee" label="Disponibilidad" value={stats.disponibilidad==null?"—":`${stats.disponibilidad}%`}/>
                <SummaryRow icon="wrench" color="#e7edf2" label="OT abiertas" value={stats.otAbiertas??"—"}/>
                <SummaryRow icon="package" color="#f5a000" label="Stock crítico" value={stats.stockCritico??"—"}/>
              </div>
            </div>
          </section>

          <section style={{margin:"0 0 0 0"}}>
            <style>{`.dm-home-quick{width:100%;max-width:100%;min-width:0;grid-template-columns:repeat(6,minmax(0,1fr))!important;align-items:stretch}.dm-home-quick>*{min-width:0;height:100%}@media(max-width:1199px){.dm-home-quick{grid-template-columns:repeat(3,minmax(0,1fr))!important}}@media(max-width:799px){.dm-home-quick{grid-template-columns:repeat(2,minmax(0,1fr))!important}}@media(max-width:499px){.dm-home-quick{grid-template-columns:minmax(0,1fr)!important}}`}</style>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,fontSize:13,fontWeight:900,letterSpacing:".035em"}}><span style={{width:3,height:21,background:"#ef233c",display:"inline-block"}}/>ACCESOS RÁPIDOS</div>
            <div className="dm-home-quick" style={{display:"grid",gridTemplateColumns:`repeat(${quick.length},minmax(0,1fr))`,gap:10}}>{quick.map(item=><QuickCard key={item.label} {...item} onClick={()=>onOpenModule?.(item.module,item.view)}/>)}</div>
          </section>

          <div style={{height:54,borderRadius:8,background:"rgba(5,18,29,.86)",border:"1px solid rgba(255,255,255,.06)",display:"flex",alignItems:"center",gap:18,padding:"0 18px",fontSize:12,boxShadow:"0 12px 30px rgba(0,0,0,.18)"}}><span style={{width:28,height:28,borderRadius:"50%",background:"rgba(239,35,60,.13)",display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name="warn" size={16} color="#ef233c"/></span><strong>NOVEDADES</strong><span style={{width:1,height:22,background:"rgba(255,255,255,.08)"}}/><span style={{color:"#d4dbe1",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>Delta Mining OPS operativo · información centralizada para proyectos, equipos y gestión.</span><span style={{marginLeft:"auto",color:"#9ba6ae"}}>{APP_BUILD_LABEL}</span></div>
        </>
      ):renderCentralContent()}
      <footer style={{textAlign:"center",fontSize:11,color:"rgba(255,255,255,.4)",paddingTop:2}}>DELTA MINING © {now.getFullYear()} · Todos los derechos reservados</footer>
    </main>
  </div>;
}

const navStyle=active=>({width:"100%",height:46,border:"none",color:active?"#fff":"#d8dee4",display:"flex",alignItems:"center",gap:12,padding:"0 12px",fontSize:13,fontWeight:active?800:700,cursor:"pointer",textAlign:"left",position:"relative",overflow:"hidden"});
function TopInfo({icon,value,sub}){return <div style={{display:"flex",alignItems:"center",gap:10}}><div style={{fontSize:27,lineHeight:1,color:"#eef2f5"}}>{icon}</div><div><div style={{fontSize:15,fontWeight:700,whiteSpace:"nowrap"}}>{value}</div><div style={{fontSize:11,color:"rgba(255,255,255,.72)",marginTop:2,textTransform:"capitalize"}}>{sub}</div></div></div>;}
function Sep(){return <div style={{width:1,height:30,background:"rgba(255,255,255,.34)"}}/>;}
function SummaryRow({icon,color,label,value}){return <div style={{display:"flex",alignItems:"center",gap:12,padding:"9px 0"}}><MiniIcon name={icon} color={color}/><div style={{flex:1}}><div style={{fontSize:11,fontWeight:700,color:"#e7edf1"}}>{label}</div><div style={{fontSize:25,lineHeight:1.1,marginTop:2}}>{value}</div></div></div>;}
function OperationalAgenda({month,onMonthChange,data,onNavigate}){
  const year=month.getFullYear(),monthIndex=month.getMonth();
  const toDateKey=value=>{const text=String(value||"").trim();return /^\d{4}-\d{2}-\d{2}/.test(text)?text.slice(0,10):"";};
  const tenderDates=t=>[
    ...(Array.isArray(t?.fechas)?t.fechas.map((item,index)=>({date:toDateKey(item?.fecha),description:item?.descripcion,id:item?.id||index})):[]),
    ...[["fechaOferta","Oferta"],["fechaVencimiento","Vencimiento"],["fechaEntrega","Entrega"],["deadline","Fecha límite"]].map(([field,description])=>({date:toDateKey(t?.[field]),description,id:field})),
  ].filter(item=>item.date);
  const events=useMemo(()=>[
    ...(data.programaciones||[]).filter(p=>String(p?.estado||"").toUpperCase()!=="CERRADO").map((p,index)=>({id:p.id||`pm-${index}`,date:toDateKey(p.fecha),time:p.hora||"",type:"PM",module:"PM",title:p.interno||p.equipo||"PM programado",description:p.observaciones||p.equipo||"",priority:p.prioridad||"",status:p.estado||"",meta:[p.turno,p.tecnico,p.ubicacion].filter(Boolean),view:"pmProgramacion",color:"#eab308"})),
    ...(data.licitaciones||[]).flatMap((t,tenderIndex)=>tenderDates(t).map(item=>({id:`${t.id||tenderIndex}-${item.id}`,date:item.date,time:"",type:"Licitación",module:"Licitaciones",title:t.nombre||t.titulo||t.id||"Licitación",description:item.description||"",priority:t.prioridad||"",status:t.estado||"",meta:[t.cliente,t.proyecto].filter(Boolean),view:"licitacionesControl",color:"#ef4444"}))),
  ].filter(event=>event.date),[data]);
  const sorted=useMemo(()=>[...events].sort((a,b)=>`${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)),[events]);
  const eventsByDay=useMemo(()=>sorted.reduce((map,event)=>{(map[event.date]||=[]).push(event);return map;},{}),[sorted]);
  const first=new Date(year,monthIndex,1), last=new Date(year,monthIndex+1,0);
  const leading=(first.getDay()+6)%7;
  const days=Array.from({length:Math.ceil((leading+last.getDate())/7)*7},(_,index)=>index-leading+1);
  const monthLabel=month.toLocaleDateString("es-AR",{month:"long",year:"numeric"});
  const todayObj=new Date(),today=`${todayObj.getFullYear()}-${String(todayObj.getMonth()+1).padStart(2,"0")}-${String(todayObj.getDate()).padStart(2,"0")}`;
  const tomorrowObj=new Date(todayObj.getFullYear(),todayObj.getMonth(),todayObj.getDate()+1),tomorrow=`${tomorrowObj.getFullYear()}-${String(tomorrowObj.getMonth()+1).padStart(2,"0")}-${String(tomorrowObj.getDate()).padStart(2,"0")}`;
  const weekEndObj=new Date(todayObj.getFullYear(),todayObj.getMonth(),todayObj.getDate()+6),weekEnd=`${weekEndObj.getFullYear()}-${String(weekEndObj.getMonth()+1).padStart(2,"0")}-${String(weekEndObj.getDate()).padStart(2,"0")}`;
  const upcoming=sorted.filter(event=>event.date>=today);
  const groups=[
    ["HOY",upcoming.filter(event=>event.date===today)],
    ["MAÑANA",upcoming.filter(event=>event.date===tomorrow)],
    ["ESTA SEMANA",upcoming.filter(event=>event.date>tomorrow&&event.date<=weekEnd)],
    ["ESTE MES",upcoming.filter(event=>event.date>weekEnd&&event.date.slice(0,7)===today.slice(0,7))],
  ].filter(([,items])=>items.length);
  const monthEvents=events.filter(event=>event.date.slice(0,7)===`${year}-${String(monthIndex+1).padStart(2,"0")}`);
  const pmProgramados=events.filter(event=>event.type==="PM"&&event.status.toUpperCase()==="PROGRAMADO").length;
  const pmOverdue=events.filter(event=>event.type==="PM"&&event.date<today).length;
  const tenderUpcoming=upcoming.filter(event=>event.type==="Licitación").length;
  const tooltip=event=>[event.date,event.time,event.module,event.description,event.priority&&`Prioridad: ${event.priority}`,event.status&&`Estado: ${event.status}`,...event.meta].filter(Boolean).join(" · ");
  return <div className="dm-agenda">
    <style>{`.dm-agenda,.dm-agenda-main,.dm-agenda-main>*{width:100%;max-width:100%;min-width:0}@media(max-width:1050px){.dm-agenda-main{grid-template-columns:1fr!important}.dm-agenda-upcoming{max-height:360px!important}}@media(max-width:720px){.dm-agenda-main{gap:10px!important}.dm-agenda-day{min-height:68px!important;padding:3px!important;border-radius:6px!important}.dm-agenda-day>div:first-child{font-size:9px!important}.dm-agenda-event{font-size:7px!important;padding:2px!important;border-left-width:2px!important}.dm-agenda-kpis{grid-template-columns:repeat(2,minmax(0,1fr))!important}}@media(max-width:390px){.dm-agenda-day{min-height:58px!important}.dm-agenda-event{font-size:0!important;height:5px!important;padding:0!important;margin-block:2px!important;border-radius:999px!important}}`}</style>
    {data.loading&&<div style={{fontSize:12,color:"#aab4bc"}}>Sincronizando fuentes operativas…</div>}
    {data.error&&<div role="alert" style={{padding:"10px 12px",borderRadius:10,border:"1px solid #ef444455",background:"#ef444412",color:"#fca5a5",fontSize:12}}>No se pudo cargar una fuente de Agenda: {data.error}</div>}
    <div className="dm-agenda-main" style={{display:"grid",gridTemplateColumns:"minmax(0,7fr) minmax(260px,3fr)",gap:16,alignItems:"start"}}>
      <section style={agendaPanelStyle}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:10,flexWrap:"wrap"}}><button type="button" aria-label="Mes anterior" onClick={()=>onMonthChange(new Date(year,monthIndex-1,1))} style={agendaButtonStyle}>‹</button><div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",justifyContent:"center"}}><strong style={{fontSize:17,textTransform:"capitalize"}}>{monthLabel}</strong><button type="button" onClick={()=>onMonthChange(new Date(new Date().getFullYear(),new Date().getMonth(),1))} style={{...agendaButtonStyle,width:"auto",fontSize:10,fontWeight:900,padding:"0 9px"}}>Hoy</button></div><button type="button" aria-label="Mes siguiente" onClick={()=>onMonthChange(new Date(year,monthIndex+1,1))} style={agendaButtonStyle}>›</button></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",gap:5}}>{["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map(day=><div key={day} style={{fontSize:10,fontWeight:900,color:"#9ba6ae",textAlign:"center",padding:"5px 0"}}>{day}</div>)}{days.map((day,index)=>{const valid=day>0&&day<=last.getDate(),key=valid?`${year}-${String(monthIndex+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`:"",isToday=key===today,isPast=valid&&key<today;return <div className="dm-agenda-day" key={index} style={{minHeight:96,padding:6,borderRadius:10,border:`1px solid ${isToday?"#ef233c":"rgba(255,255,255,.08)"}`,background:isToday?"rgba(239,35,60,.09)":valid?"rgba(255,255,255,.035)":"rgba(0,0,0,.12)",opacity:valid?(isPast?.72:1):.28}}>{valid&&<><div style={{display:"flex",justifyContent:"space-between",fontSize:11,fontWeight:isToday?900:700,color:isToday?"#ff8a92":"#dce4ea",marginBottom:4}}><span>{day}</span>{isToday&&<span style={{fontSize:8,letterSpacing:".08em"}}>HOY</span>}</div>{(eventsByDay[key]||[]).slice(0,3).map(event=><button className="dm-agenda-event" key={event.id} type="button" title={tooltip(event)} onClick={()=>onNavigate?.(event.view)} style={{display:"block",width:"100%",border:0,borderLeft:`3px solid ${event.color}`,borderRadius:4,background:`${event.color}20`,color:isPast?"#94a3b8":"#eaf1f5",fontSize:9,lineHeight:1.25,textAlign:"left",padding:"4px 5px",marginBottom:3,cursor:"pointer",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textDecoration:isPast?"line-through":"none"}}>{event.type} · {event.title}</button>)}{(eventsByDay[key]||[]).length>3&&<div style={{fontSize:9,color:"#9ba6ae"}}>+{eventsByDay[key].length-3} más</div>}</>}</div>;})}</div>
      </section>
      <aside className="dm-agenda-upcoming" style={{...agendaPanelStyle,maxHeight:590,overflowY:"auto"}}><div style={{fontSize:12,fontWeight:900,letterSpacing:".12em",color:"#e2e8f0",marginBottom:12}}>PRÓXIMOS EVENTOS</div>{groups.length?groups.map(([label,items])=><div key={label} style={{marginBottom:16}}><div style={{fontSize:9,fontWeight:900,letterSpacing:".14em",color:"#94a3b8",marginBottom:7}}>{label}</div>{items.map(event=><button key={event.id} type="button" title={tooltip(event)} onClick={()=>onNavigate?.(event.view)} style={{width:"100%",display:"grid",gridTemplateColumns:"42px 1fr",gap:9,padding:"10px",marginBottom:7,border:`1px solid ${event.color}35`,borderRadius:10,background:"rgba(255,255,255,.035)",color:"#fff",cursor:"pointer",textAlign:"left"}}><span style={{fontSize:10,fontWeight:900,color:event.color}}>{event.time||new Date(`${event.date}T12:00:00`).toLocaleDateString("es-AR",{day:"2-digit",month:"short"}).toUpperCase()}</span><span><strong style={{display:"block",fontSize:11}}>{event.title}</strong><span style={{display:"block",fontSize:9,color:"#94a3b8",marginTop:3}}>Módulo: {event.module}{event.priority?` · ${event.priority}`:""}</span></span></button>)}</div>):<div style={{fontSize:12,color:"#94a3b8",lineHeight:1.6}}>No hay próximos eventos disponibles en las fuentes actuales.</div>}</aside>
    </div>
    <div className="dm-agenda-kpis" style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:10,marginTop:14}}>{[["PM programados",pmProgramados,"#eab308"],["Licitaciones próximas",tenderUpcoming,"#ef4444"],["Preventivos vencidos",pmOverdue,"#22c55e"],["Eventos del mes",monthEvents.length,"#60a5fa"]].map(([label,value,color])=><div key={label} style={{...agendaPanelStyle,padding:14,borderColor:`${color}35`}}><div style={{fontSize:22,fontWeight:900,color}}>{value}</div><div style={{fontSize:10,color:"#aab4bc",marginTop:4}}>{label}</div></div>)}</div>
  </div>;
}
const agendaButtonStyle={width:32,height:30,borderRadius:8,border:"1px solid rgba(255,255,255,.15)",background:"rgba(255,255,255,.05)",color:"#fff",fontSize:22,cursor:"pointer",lineHeight:1};
const agendaPanelStyle={padding:14,borderRadius:16,border:"1px solid rgba(255,255,255,.09)",background:"rgba(7,18,29,.72)",boxShadow:"0 16px 36px rgba(0,0,0,.22)",backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)"};
function ActionCard({label,value,detail,icon,color="#38bdf8",onClick,trailing,onTrailing}){return <div role="button" tabIndex={0} onClick={onClick} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();onClick?.();}}} style={{minHeight:116,padding:"15px",borderRadius:13,border:`1px solid ${color}55`,background:"rgba(255,255,255,.045)",color:"#fff",cursor:"pointer",textAlign:"left",display:"grid",gridTemplateColumns:"40px 1fr",gap:11,alignItems:"start"}}><MiniIcon name={icon} color={color} bg={`${color}18`}/><span style={{minWidth:0}}><span style={{display:"block",fontSize:13,fontWeight:900}}>{label}</span>{value!==undefined&&<span style={{display:"block",fontSize:22,fontWeight:900,color,marginTop:5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{value}</span>}<span style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginTop:7,fontSize:11,color:"rgba(255,255,255,.7)"}}>{detail}<span role="button" tabIndex={0} onClick={event=>{event.stopPropagation();onTrailing?.();}} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();event.stopPropagation();onTrailing?.();}}} style={onTrailing?{color,cursor:"pointer",fontWeight:800}:{color}}>{trailing||"→"}</span></span></span></div>;}
function QuickCard({label,desc,icon,color,onClick}){return <button onClick={onClick} style={{position:"relative",boxSizing:"border-box",width:"100%",minWidth:0,minHeight:122,overflow:"hidden",borderRadius:9,border:`1px solid ${color}44`,background:"linear-gradient(135deg,rgba(12,31,45,.93),rgba(7,20,31,.88))",color:"#fff",display:"flex",flexDirection:"column",gap:10,padding:"16px 14px 13px",textAlign:"left",cursor:"pointer",boxShadow:"0 16px 34px rgba(0,0,0,.18)",transition:"transform .16s ease,border-color .16s ease"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.borderColor=color+"aa";}} onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.borderColor=color+"44";}}><span style={{display:"flex",alignItems:"flex-start",gap:10,width:"100%",minWidth:0,flex:1}}><MiniIcon name={icon} color={color} bg={`${color}18`}/><span style={{display:"block",minWidth:0,flex:1}}><span style={{display:"block",fontSize:13,fontWeight:900,lineHeight:1.25,marginTop:2,whiteSpace:"normal",overflowWrap:"anywhere",wordBreak:"normal"}}>{label}</span><span style={{display:"block",fontSize:10.5,lineHeight:1.45,color:"#c6d0d8",marginTop:7,whiteSpace:"normal",overflowWrap:"anywhere",wordBreak:"normal"}}>{desc}</span></span></span><span aria-hidden="true" style={{display:"block",alignSelf:"flex-end",flexShrink:0,fontSize:23,lineHeight:1,color:"#fff",marginTop:"auto",paddingLeft:8}}>→</span></button>;}
