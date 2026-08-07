import React, {useEffect, useMemo, useState} from "react";
import { Icon } from "../../components/ui/index.jsx";
import { APP_BUILD_LABEL } from "../../app/version.js";

const norm=v=>String(v??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
const getVal=(row,cands)=>{const keys=Object.keys(row||{});for(const cand of cands){const w=norm(cand);for(const k of keys){const nk=norm(k);if(nk===w||nk.includes(w)||w.includes(nk))return row[k];}}return "";};
const toNum=v=>{const n=Number(String(v??"").replace(/\./g,"").replace(",",".").replace(/[^0-9.-]/g,""));return Number.isFinite(n)?n:0;};
const codeOf=r=>String(getVal(r,["Maquina","Máquina","Interno","Código Interno","Codigo nuevo","Código nuevo","Codigo de Drusila","Código de Drusila","Codigo Int"])||"").trim().toUpperCase().replace(/-JM$/i,"");
const dateOf=r=>{const raw=getVal(r,["Fecha","Fecha OT","Fecha del Parte Diario","Fecha de solicitud"]);if(!raw)return null;const s=String(raw);const d=/^\d{4}-\d{2}-\d{2}/.test(s)?new Date(`${s.slice(0,10)}T12:00:00`):new Date(s);return Number.isNaN(d.getTime())?null:d;};

function MiniIcon({name,color="#fff",bg="rgba(255,255,255,.08)"}){return <span style={{width:44,height:44,borderRadius:14,display:"inline-flex",alignItems:"center",justifyContent:"center",background:bg,flex:"0 0 auto"}}><Icon name={name} size={23} color={color}/></span>;}

export default function ViewBienvenida({onOpenModule,rawSources={},rma15=[],listaEquipos=[],rop02All=[],nombreUsuario="Usuario",areaUsuario="OFICINA TÉCNICA",onOpenProfile,onLogout,esAdministrativo=false}){
  const [now,setNow]=useState(()=>new Date());
  const [weather,setWeather]=useState({sanJuan:null,batidero:null});
  useEffect(()=>{const id=setInterval(()=>setNow(new Date()),30000);return()=>clearInterval(id);},[]);
  useEffect(()=>{
    let alive=true;
    const ctrl=new AbortController();
    const fetchWeather=async({lat,lon})=>{
      const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=America%2FArgentina%2FSan_Juan`;
      const res=await fetch(url,{signal:ctrl.signal});
      if(!res.ok)return null;
      const json=await res.json();
      return json?.current?{temp:Math.round(json.current.temperature_2m),code:json.current.weather_code}:null;
    };
    Promise.all([
      fetchWeather({lat:-31.5375,lon:-68.5364}),
      // Coordenadas centrales del proyecto Josemaría (Iglesia), usadas como referencia para Campamento Batidero.
      fetchWeather({lat:-28.52377,lon:-69.53643}),
    ]).then(([sanJuan,batidero])=>{if(alive)setWeather({sanJuan,batidero});}).catch(()=>{});
    return()=>{alive=false;ctrl.abort();};
  },[]);

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
    try{
      const stockRows=JSON.parse(window.localStorage.getItem("dm_control_stock_excel_v1")||"[]");
      if(Array.isArray(stockRows)&&stockRows.length){
        stockCritico=stockRows.filter(r=>{
          const deposito=String(r?.descripcionDeposito||"").trim().toUpperCase();
          if(deposito&&!(["DEPOSITO CENTRAL","DEPOSITO BATIDERO","DEPOSITO FILO DEL SOL"].includes(deposito)))return false;
          const saldo=toNum(r?.saldoControlStock);
          const minimo=toNum(r?.stockMinimo);
          return minimo>0&&saldo<minimo;
        }).length;
      }
    }catch(_){stockCritico=null;}
    return {...operativos,disponibilidad,otAbiertas:abiertas,stockCritico};
  },[listaEquipos,rop02All,rma15,rawSources]);

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
  const nav=quick.map(q=>({...q,short:q.label}));
  const firstName=String(nombreUsuario||"Usuario").trim().split(/\s+/)[0].toUpperCase();
  const dateTop=now.toLocaleDateString("es-AR",{day:"numeric",month:"long",year:"numeric"});
  const weekday=now.toLocaleDateString("es-AR",{weekday:"long"});
  const hour=now.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit",hour12:false});
  const turno=now.getHours()>=7&&now.getHours()<19?"Turno Día":"Turno Noche";

  return <div style={{position:"relative",height:"100vh",minHeight:720,overflow:"hidden",background:"#071018",fontFamily:"Inter,Arial,sans-serif",color:"#fff"}}>
    <img src="/img/embedded/home-welcome-b80067ac.jpg" alt="Delta Mining" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",objectPosition:"center",filter:"brightness(.78) saturate(.86)"}}/>
    <div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,rgba(3,12,20,.28) 0 12%,rgba(3,10,17,.22) 27%,rgba(3,10,17,.12) 64%,rgba(3,10,17,.42) 100%)"}}/>
    <div style={{position:"absolute",inset:0,background:"linear-gradient(0deg,rgba(3,11,18,.94) 0%,rgba(3,11,18,.05) 42%,rgba(3,11,18,.18) 100%)"}}/>

    <aside style={{position:"absolute",left:0,top:0,bottom:0,width:196,background:"rgba(22,22,22,0.55)",borderRight:"1px solid rgba(120,120,120,.20)",display:"flex",flexDirection:"column",zIndex:5,boxShadow:"12px 0 36px rgba(0,0,0,.18)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)"}}>
      <div style={{height:150,display:"flex",alignItems:"center",justifyContent:"center",borderBottom:"1px solid rgba(255,255,255,.04)"}}><img src="/img/embedded/app-logo-7fab0f62.webp" alt="Delta Mining" style={{width:92,height:"auto"}}/></div>
      <div style={{padding:"10px 0",flex:1}}>
        <button style={navStyle(true)}><Icon name="dashboard" size={19} color="#ef233c"/><span>Inicio</span></button>
        {nav.map(item=><button key={item.label} onClick={()=>onOpenModule?.(item.module,item.view)} style={navStyle(false)}><Icon name={item.icon} size={19} color="#d6dde3"/><span>{item.short}</span></button>)}
      </div>
      <div style={{padding:"14px 16px 16px",borderTop:"1px solid rgba(255,255,255,.05)"}}>
        <button onClick={onOpenProfile} title="Abrir configuración de perfil" style={{width:"100%",display:"flex",gap:10,alignItems:"center",marginBottom:16,padding:0,border:"none",background:"transparent",color:"#fff",cursor:"pointer",textAlign:"left"}}><div style={{width:34,height:34,borderRadius:"50%",background:"rgba(41,51,61,.82)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,border:"1px solid rgba(255,255,255,.08)"}}>{String(nombreUsuario||"NG").split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase()}</div><div style={{minWidth:0,flex:1}}><div style={{fontSize:12,fontWeight:800,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{nombreUsuario}</div><div style={{fontSize:10,color:"#aab4bc",marginTop:2}}>{String(areaUsuario||"Oficina Técnica").replace(/_/g," ")}</div></div><Icon name="chevronRight" size={14} color="#9aa5ae"/></button>
        <button onClick={onLogout} style={{width:"100%",padding:"11px 12px",border:"1px solid rgba(255,255,255,.07)",borderRadius:8,background:"rgba(5,15,23,.34)",color:"#e8edf1",display:"flex",alignItems:"center",gap:9,cursor:"pointer",fontSize:12,fontWeight:700,backdropFilter:"blur(8px)"}}><Icon name="chevronRight" size={17} color="#e8edf1"/>Cerrar sesión</button>
      </div>
    </aside>

    <main style={{position:"absolute",left:196,right:0,top:0,bottom:0,zIndex:2,padding:"30px 48px 26px",display:"grid",gridTemplateRows:"auto 1fr auto auto auto",gap:14}}>
      <div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:22,minHeight:48}}>
        <TopInfo icon="☁" value={weather.sanJuan?`${weather.sanJuan.temp}°C`:"—°C"} sub="San Juan, ARG"/>
        <Sep/><TopInfo icon="☁" value={weather.batidero?`${weather.batidero.temp}°C`:"—°C"} sub="Camp. Batidero · Iglesia"/>
        <Sep/><TopInfo icon="▣" value={dateTop} sub={weekday.charAt(0).toUpperCase()+weekday.slice(1)}/>
        <Sep/><TopInfo icon="◷" value={hour} sub={turno}/>
      </div>

      <section style={{position:"relative",display:"flex",alignItems:"center",minHeight:0}}>
        <div style={{maxWidth:600,marginLeft:54,marginTop:-12}}>
          <div style={{fontSize:"clamp(28px,3vw,48px)",fontWeight:500,letterSpacing:".01em",lineHeight:1}}>BIENVENIDO</div>
          <div style={{fontSize:"clamp(52px,5vw,86px)",fontWeight:900,letterSpacing:".025em",lineHeight:1.04,marginTop:8,textShadow:"0 4px 24px rgba(0,0,0,.35)"}}>{firstName}</div>
          <div style={{marginTop:20,fontSize:18,fontWeight:700,letterSpacing:".07em",color:"#f0f2f4"}}>ABRIENDO CAMINOS, CONSTRUYENDO FUTURO.</div>
          <div style={{width:46,height:3,background:"#ef233c",margin:"18px 0 18px"}}/>
          <div style={{fontSize:18,lineHeight:1.5,color:"rgba(255,255,255,.88)",maxWidth:500}}>Accedé a la información y herramientas<br/>que impulsan cada proyecto, cada equipo<br/>y cada logro.</div>
        </div>

        <div style={{position:"absolute",right:0,top:"50%",transform:"translateY(-45%)",width:252,borderRadius:10,background:"rgba(5,18,29,.62)",border:"1px solid rgba(255,255,255,.10)",boxShadow:"0 18px 45px rgba(0,0,0,.26)",overflow:"hidden",backdropFilter:"blur(18px) saturate(115%)",WebkitBackdropFilter:"blur(18px) saturate(115%)"}}>
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
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,fontSize:13,fontWeight:900,letterSpacing:".035em"}}><span style={{width:3,height:21,background:"#ef233c",display:"inline-block"}}/>ACCESOS RÁPIDOS</div>
        <div style={{display:"grid",gridTemplateColumns:`repeat(${quick.length},minmax(0,1fr))`,gap:10}}>{quick.map(item=><QuickCard key={item.label} {...item} onClick={()=>onOpenModule?.(item.module,item.view)}/>)}</div>
      </section>

      <div style={{height:54,borderRadius:8,background:"rgba(5,18,29,.86)",border:"1px solid rgba(255,255,255,.06)",display:"flex",alignItems:"center",gap:18,padding:"0 18px",fontSize:12,boxShadow:"0 12px 30px rgba(0,0,0,.18)"}}><span style={{width:28,height:28,borderRadius:"50%",background:"rgba(239,35,60,.13)",display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name="warn" size={16} color="#ef233c"/></span><strong>NOVEDADES</strong><span style={{width:1,height:22,background:"rgba(255,255,255,.08)"}}/><span style={{color:"#d4dbe1",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>Delta Mining OPS operativo · información centralizada para proyectos, equipos y gestión.</span><span style={{marginLeft:"auto",color:"#9ba6ae"}}>{APP_BUILD_LABEL}</span></div>
      <footer style={{textAlign:"center",fontSize:11,color:"rgba(255,255,255,.4)",paddingTop:2}}>DELTA MINING © {now.getFullYear()} · Todos los derechos reservados</footer>
    </main>
  </div>;
}

const navStyle=active=>({width:"100%",height:54,border:"none",borderLeft:active?"3px solid #ef233c":"3px solid transparent",background:active?"rgba(239,35,60,.035)":"transparent",color:active?"#fff":"#d8dee4",display:"flex",alignItems:"center",gap:13,padding:"0 17px",fontSize:14,fontWeight:active?800:700,cursor:"pointer",textAlign:"left"});
function TopInfo({icon,value,sub}){return <div style={{display:"flex",alignItems:"center",gap:10}}><div style={{fontSize:27,lineHeight:1,color:"#eef2f5"}}>{icon}</div><div><div style={{fontSize:15,fontWeight:700,whiteSpace:"nowrap"}}>{value}</div><div style={{fontSize:11,color:"rgba(255,255,255,.72)",marginTop:2,textTransform:"capitalize"}}>{sub}</div></div></div>;}
function Sep(){return <div style={{width:1,height:30,background:"rgba(255,255,255,.34)"}}/>;}
function SummaryRow({icon,color,label,value}){return <div style={{display:"flex",alignItems:"center",gap:12,padding:"9px 0"}}><MiniIcon name={icon} color={color}/><div style={{flex:1}}><div style={{fontSize:11,fontWeight:700,color:"#e7edf1"}}>{label}</div><div style={{fontSize:25,lineHeight:1.1,marginTop:2}}>{value}</div></div></div>;}
function QuickCard({label,desc,icon,color,onClick}){return <button onClick={onClick} style={{height:112,borderRadius:9,border:`1px solid ${color}44`,background:"linear-gradient(135deg,rgba(12,31,45,.93),rgba(7,20,31,.88))",color:"#fff",display:"grid",gridTemplateColumns:"46px 1fr 22px",gap:10,alignItems:"start",padding:"17px 14px",textAlign:"left",cursor:"pointer",boxShadow:"0 16px 34px rgba(0,0,0,.18)",transition:"transform .16s ease,border-color .16s ease"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.borderColor=color+"aa";}} onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.borderColor=color+"44";}}><MiniIcon name={icon} color={color} bg={`${color}18`}/><div><div style={{fontSize:13,fontWeight:900,marginTop:2}}>{label}</div><div style={{fontSize:10.5,lineHeight:1.45,color:"#c6d0d8",marginTop:9}}>{desc}</div></div><div style={{fontSize:25,alignSelf:"end",color:"#fff"}}>→</div></button>;}
