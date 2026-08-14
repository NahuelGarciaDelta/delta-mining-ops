import React, { useEffect, useMemo, useState } from "react";
import { C, Icon } from "../../components/ui/index.jsx";
import { APPS_SCRIPT_URL } from "../../config/app.js";
import { fetchAction } from "../../services/appsScriptApi.js";
import { fetchStockData } from "../../services/stockService.js";
import { PM_INITIAL_SEED } from "../mantenimiento/pmInitialSeed.js";
import FleetUtilizationPanel from "./FleetUtilizationPanel.jsx";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS={green:C.green,blue:C.blue,purple:C.purple,yellow:C.yellow,teal:C.teal,red:C.red};
const norm=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toUpperCase();
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0;};
const safe=v=>Array.isArray(v)?v:[];
const code=r=>String(r?.maquina||r?.interno||r?.codigo||r?.["Código Interno del Equipo"]||r?.["Codigo Int"]||"").trim();
const fmt=n=>Number(n||0).toLocaleString("es-AR",{maximumFractionDigits:0});
const fmt1=n=>Number(n||0).toLocaleString("es-AR",{minimumFractionDigits:1,maximumFractionDigits:1});
const fmtMoney=n=>`USD ${Number(n||0).toLocaleString("es-AR",{maximumFractionDigits:0})}`;
const ymd=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const monthStart=d=>new Date(d.getFullYear(),d.getMonth(),1);
const monthEnd=d=>new Date(d.getFullYear(),d.getMonth()+1,0);
const periodMonthKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
const reportingPeriodForMonth=month=>{
  const [yy,mm]=String(month||"").split("-").map(Number);
  if(!yy||!mm)return null;
  const start=new Date(yy,mm-2,26,12);
  const end=new Date(yy,mm-1,25,12);
  return{start:ymd(start),end:ymd(end),startDate:start,endDate:end};
};
const previousReportingMonth=month=>{
  const [yy,mm]=String(month||"").split("-").map(Number);
  if(!yy||!mm)return"";
  const d=new Date(yy,mm-2,1,12);
  return periodMonthKey(d);
};
const reportingMonthForDate=d=>{
  const x=new Date(d);
  if(Number.isNaN(x.getTime()))return"";
  // El mes seleccionado representa el período 26 del mes anterior → 25 del mes corriente.
  // Desde el día 26, la fecha pertenece al período etiquetado con el mes siguiente.
  if(x.getDate()>=26)x.setMonth(x.getMonth()+1);
  return periodMonthKey(x);
};
const dateKey=v=>{
  if(v instanceof Date&&!Number.isNaN(v.getTime()))return ymd(v);
  const raw=String(v??"").trim();
  if(!raw)return"";
  let m=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(m)return`${m[1]}-${String(m[2]).padStart(2,"0")}-${String(m[3]).padStart(2,"0")}`;
  m=raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})/);
  if(m){let yy=Number(m[3]);if(yy<100)yy+=2000;return`${yy}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`;}
  const d=new Date(raw);return Number.isNaN(d.getTime())?"":ymd(d);
};
const rowDate=r=>dateKey(r?.fecha??r?.date??r?.fechaOT??r?.fechaSolicitud??r?.createdAt);
const monthKey=s=>dateKey(s).slice(0,7);
const inRange=(r,a,b)=>{const f=rowDate(r);return !!f&&(!a||f>=a)&&(!b||f<=b);};
const projectKey=v=>{const n=norm(v);if(n.includes("JOSE")&&n.includes("MARIA"))return"JM";if(n.includes("FILO")&&n.includes("SOL"))return"FS";return n||"S/D";};
const stateKey=r=>{
  // Regla gerencial: si el registro tiene horas trabajadas, el día es operativo.
  // Solo cuando las horas son 0 se respeta el estado OD / FS / EM informado por ROP02.
  if(num(r?.horas)>0)return"TRABAJO";
  const s=norm(r?.estado||r?.status||r?.operativo||r?.horasRaw);
  if(s==="FS"||s.includes("FUERA"))return"FS";
  if(s==="EM"||s.includes("MANT"))return"EM";
  if(s==="OD"||s.includes("DISPOSIC"))return"OD";
  if(s==="TRABAJO"||s.includes("TRABAJO")||s==="OPERATIVO")return"TRABAJO";
  return"S/D";
};
const ropHorometer=r=>Math.max(num(r?.horometroFinal),num(r?.horometroInicial),num(r?.hf),num(r?.hi));
const pmNorm=v=>String(v??"").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Z0-9]+/g,"").trim();
const pmStatus=(actual,ultimo,cfg={})=>{
  const intervalo=num(cfg.intervalo)||250, alerta=num(cfg.alertaDesde)||200, atrasado=num(cfg.atrasadoDesde)||350;
  const transcurridas=ultimo>0?Math.max(0,actual-ultimo):0;
  const margenUrgente=Math.max(20,Math.min(50,atrasado-intervalo));
  let estado="AL DÍA";
  if(!ultimo)estado="SIN BASE";
  else if(transcurridas>=atrasado)estado="PM ATRASADO";
  else if(transcurridas>=intervalo||transcurridas>=atrasado-margenUrgente)estado="PM URGENTE";
  else if(transcurridas>=alerta)estado="PM PRÓXIMO";
  return{estado,transcurridas,intervalo,alertaDesde:alerta,atrasadoDesde:atrasado};
};
const maintType=r=>{const t=norm(r?.tipoMant||r?.tipoMantenimiento||r?.tipo||r?.mantenimiento);if(t.includes("PREV"))return"PREV";if(t.includes("CORR"))return"CORR";return"OTRO";};
const maintCost=r=>num(r?.costoTotal??r?.costo_total??r?.costoUSD??r?.costoUsd??0);
const pct=(a,b)=>b>0?a/b*100:0;
const delta=(cur,prev)=>prev?((cur-prev)/Math.abs(prev))*100:null;
const prevRange=(from,to)=>{const a=new Date(`${from}T12:00:00`),b=new Date(`${to}T12:00:00`);const days=Math.max(1,Math.round((b-a)/86400000)+1);const prevTo=new Date(a);prevTo.setDate(prevTo.getDate()-1);const prevFrom=new Date(prevTo);prevFrom.setDate(prevFrom.getDate()-days+1);return[ymd(prevFrom),ymd(prevTo)];};

function Help({text}){return <span className="dm-help" tabIndex={0} data-tip={text||"Información del indicador"}>?</span>}
function Panel({title,action,help,children,style}){return <section className="dm-panel" style={{background:"linear-gradient(180deg,rgba(45,52,59,.88),rgba(31,38,45,.84))",border:`1px solid rgba(255,255,255,.14)`,borderRadius:12,overflow:"visible",boxShadow:"0 8px 22px rgba(0,0,0,.16)",...style}}><div style={{padding:"11px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,borderBottom:`1px solid rgba(255,255,255,.12)`}}><div style={{display:"flex",alignItems:"center",gap:7}}><strong style={{fontSize:12,color:C.text}}>{title}</strong><Help text={help||`Información sobre ${title}`}/></div>{action}</div>{children}</section>}
function Tip({active,payload,label}){if(!active||!payload?.length)return null;return <div style={{background:"#111",border:`1px solid ${C.borderLight}`,borderRadius:8,padding:"8px 10px",boxShadow:"0 8px 24px #0008",fontSize:11}}><div style={{fontWeight:800,marginBottom:5}}>{label}</div>{payload.map((p,i)=><div key={i} style={{color:p.color||C.textSub,marginTop:2}}>{p.name}: <strong>{Number(p.value||0).toLocaleString("es-AR",{maximumFractionDigits:1})}</strong></div>)}</div>}
function Delta({value,unit="%"}){if(value==null||!Number.isFinite(value))return <span style={{color:C.textMuted}}>Sin comparación</span>;const up=value>=0;return <span style={{color:up?C.green:C.red,fontWeight:700}}>{up?"↑":"↓"} {Math.abs(value).toLocaleString("es-AR",{maximumFractionDigits:1})}{unit}</span>}
function Kpi({icon,label,value,sub,deltaValue,color=C.blue,help}){return <div style={{minWidth:0,padding:"14px 14px 12px",borderRadius:12,border:`1px solid ${color}55`,background:`linear-gradient(145deg,${color}18,rgba(12,20,27,.78))`,boxShadow:"0 8px 24px rgba(0,0,0,.12)"}}><div style={{display:"flex",gap:9,alignItems:"center",minHeight:30}}><span style={{width:31,height:31,borderRadius:"50%",display:"grid",placeItems:"center",background:`${color}18`,border:`1px solid ${color}70`,flexShrink:0}}><Icon name={icon} size={15} color={color}/></span><span style={{fontSize:10,color:C.textSub,lineHeight:1.25,fontWeight:700,display:"inline-flex",alignItems:"center",gap:6}}>{label}<Help text={help||`Información sobre ${label}`}/></span></div><div style={{fontSize:24,fontWeight:900,letterSpacing:"-.03em",marginTop:9,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{value}</div><div style={{fontSize:9.5,color:C.textMuted,marginTop:6,display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}><Delta value={deltaValue}/>{sub&&<span>vs {sub}</span>}</div></div>}
function AlertRow({icon,color,title,description,count,onClick}){return <button type="button" onClick={onClick} style={{width:"100%",border:0,borderBottom:`1px solid ${C.border}`,background:"transparent",color:C.text,padding:"10px 12px",display:"grid",gridTemplateColumns:"34px 1fr auto 16px",gap:9,alignItems:"center",textAlign:"left",cursor:"pointer"}}><span style={{width:30,height:30,borderRadius:8,display:"grid",placeItems:"center",background:`${color}18`}}><Icon name={icon} size={16} color={color}/></span><span><strong style={{display:"block",fontSize:11}}>{title}</strong><span style={{fontSize:9,color:C.textMuted,lineHeight:1.35}}>{description}</span></span><strong style={{fontSize:20,color}}>{count}</strong><span style={{color:C.textMuted,fontSize:18}}>›</span></button>}

export default function ExecutiveDashboard({rop02All=[],rop05=[],rma15=[],rawSources={},usdRate=1,onNavigate}){
  const today=new Date();
  const usdRateSafe=useMemo(()=>{
    const prop=Number(usdRate);
    if(Number.isFinite(prop)&&prop>1)return prop;
    try{
      const saved=JSON.parse(window.localStorage.getItem("delta_costos_mant_state_v1")||"{}");
      const configured=Number(saved?.usdRate2);
      if(Number.isFinite(configured)&&configured>1)return configured;
    }catch(_){}
    return 1400;
  },[usdRate]);
  const maintCostUsd=r=>{
    // RMA15 almacena el costo de mantenimiento en ARS. El dashboard siempre lo expresa en USD.
    const ars=maintCost(r);
    return ars>0?ars/usdRateSafe:0;
  };
  const [selectedMonth,setSelectedMonth]=useState(()=>reportingMonthForDate(today));
  const [comparisonMonth,setComparisonMonth]=useState(()=>previousReportingMonth(reportingMonthForDate(today)));
  const initialPeriod=reportingPeriodForMonth(reportingMonthForDate(today));
  const [from,setFrom]=useState(()=>initialPeriod?.start||ymd(monthStart(today)));
  const [to,setTo]=useState(()=>initialPeriod?.end||ymd(monthEnd(today)));
  const applyMonth=month=>{
    setSelectedMonth(month);
    const p=reportingPeriodForMonth(month);
    if(p){setFrom(p.start);setTo(p.end);}
    setComparisonMonth(previousReportingMonth(month));
  };
  const [remote,setRemote]=useState({pm:null,states:null,stock:null,raba:null});
  const [stateEquipment,setStateEquipment]=useState("");
  useEffect(()=>{let alive=true;Promise.allSettled([
    fetchAction(APPS_SCRIPT_URL,"mantenimiento_programado"),
    fetchAction(APPS_SCRIPT_URL,"estados_solicitudes"),
    fetchStockData(APPS_SCRIPT_URL),
    fetchAction(APPS_SCRIPT_URL,"raba03",{force:true,compact:false}),
  ]).then(([pm,states,stock,raba])=>{if(!alive)return;setRemote({pm:pm.status==="fulfilled"&&pm.value?.ok?pm.value:null,states:states.status==="fulfilled"&&states.value?.ok?states.value:null,stock:stock.status==="fulfilled"&&stock.value?.ok?stock.value:null,raba:raba.status==="fulfilled"&&(raba.value?.ok||raba.value?.sources)?raba.value:null});});return()=>{alive=false};},[]);

  const [prevFrom,prevTo]=useMemo(()=>{
    const chosen=reportingPeriodForMonth(comparisonMonth);
    if(chosen)return[chosen.start,chosen.end];
    return prevRange(from,to);
  },[from,to,comparisonMonth]);
  const current=useMemo(()=>safe(rop02All).filter(r=>inRange(r,from,to)&&!r?._excluded),[rop02All,from,to]);
  const previous=useMemo(()=>safe(rop02All).filter(r=>inRange(r,prevFrom,prevTo)&&!r?._excluded),[rop02All,prevFrom,prevTo]);
  const maintNow=useMemo(()=>safe(rma15).filter(r=>inRange(r,from,to)),[rma15,from,to]);
  const maintPrev=useMemo(()=>safe(rma15).filter(r=>inRange(r,prevFrom,prevTo)),[rma15,prevFrom,prevTo]);

  const metrics=useMemo(()=>{
    const calc=rows=>{
      const byDay=new Map();
      rows.forEach(r=>{const d=rowDate(r),eq=pmNorm(code(r));if(!d||!eq)return;const k=`${eq}|${d}`;const x=byDay.get(k)||{hours:0,states:[]};x.hours+=num(r?.horas);x.states.push(stateKey(r));byDay.set(k,x);});
      const states=[...byDay.values()].map(x=>x.hours>0?"TRABAJO":x.states.includes("FS")?"FS":x.states.includes("EM")?"EM":x.states.includes("OD")?"OD":"S/D").filter(s=>["TRABAJO","OD","FS","EM"].includes(s));
      const working=states.filter(s=>s==="TRABAJO").length,available=states.filter(s=>s==="TRABAJO"||s==="OD").length;
      return{hours:rows.reduce((s,r)=>s+num(r?.horas),0),availability:pct(available,states.length),utilization:pct(working,states.length)};
    };
    const a=calc(current),b=calc(previous);const cost=maintNow.reduce((s,r)=>s+maintCostUsd(r),0),costPrev=maintPrev.reduce((s,r)=>s+maintCostUsd(r),0);return{...a,cost,costHour:a.hours?cost/a.hours:0,dHours:delta(a.hours,b.hours),dAvail:a.availability-b.availability,dUtil:a.utilization-b.utilization,dCost:delta(cost,costPrev),dCostHour:delta(a.hours?cost/a.hours:0,b.hours?costPrev/b.hours:0)};
  },[current,previous,maintNow,maintPrev,usdRateSafe]);

  const pm=useMemo(()=>{
    // Replica la lógica de Mantenimiento Programado, pero calculada al cierre del filtro "Hasta".
    // Así un PM vencido no depende del estado actual del backend sino del horómetro disponible en el período.
    const configs=safe(remote.pm?.config);
    const registros=safe(remote.pm?.registros);
    const merged=new Map();
    PM_INITIAL_SEED.forEach(x=>merged.set(pmNorm(x.interno),{intervalo:250,alertaDesde:200,atrasadoDesde:350,activo:"SI",...x}));
    configs.forEach(x=>{const k=pmNorm(x?.interno);if(k)merged.set(k,{...(merged.get(k)||{}),...x});});

    const activeCodes=new Set(current.map(code).map(pmNorm).filter(Boolean));
    const latestH=new Map();
    safe(rop02All).forEach(r=>{
      const d=rowDate(r),k=pmNorm(code(r));
      if(!d||d>to||!k||!activeCodes.has(k))return;
      const h=ropHorometer(r);if(h<=0)return;
      const prev=latestH.get(k);
      if(!prev||d>prev.date||(d===prev.date&&h>prev.h))latestH.set(k,{date:d,h});
    });

    const lastPmFor=(k,cfg)=>{
      const events=[];
      if(dateKey(cfg?.fechaUltimoPM)&&dateKey(cfg.fechaUltimoPM)<=to&&num(cfg?.horometroUltimoPM)>0)events.push({date:dateKey(cfg.fechaUltimoPM),h:num(cfg.horometroUltimoPM)});
      registros.forEach(r=>{if(pmNorm(r?.interno)!==k)return;const d=dateKey(r?.fecha);if(d&&d<=to&&num(r?.horometro)>0)events.push({date:d,h:num(r.horometro)});});
      events.sort((a,b)=>a.date.localeCompare(b.date)||a.h-b.h);
      return events.at(-1)||null;
    };

    const equipos=[];
    activeCodes.forEach(k=>{
      const cfg=merged.get(k);if(!cfg||String(cfg?.activo??"SI").toUpperCase()==="NO")return;
      const actual=latestH.get(k)?.h||0,last=lastPmFor(k,cfg);
      if(!actual)return;
      const st=pmStatus(actual,last?.h||0,cfg);
      equipos.push({interno:k,actual,ultimo:last?.h||0,...st});
    });
    const critical=equipos.filter(x=>x.estado==="PM ATRASADO"||x.estado==="PM URGENTE").length;
    const realizados=safe(registros).filter(r=>inRange(r,from,to)&&activeCodes.has(pmNorm(r?.interno))).length;
    const previstos=realizados+critical;
    return{total:equipos.length,critical,realizados,compliance:previstos?pct(realizados,previstos):(equipos.length?100:null),equipos};
  },[remote.pm,rop02All,current,from,to]);
  const prevPmCompliance=null;

  const stateEquipmentOptions=useMemo(()=>{
    const set=new Set();
    safe(rop02All).forEach(r=>{if(!inRange(r,from,to)||r?._excluded)return;const c=code(r);if(c)set.add(c);});
    return [...set].sort((a,b)=>a.localeCompare(b,"es",{numeric:true,sensitivity:"base"}));
  },[rop02All,from,to]);
  useEffect(()=>{
    if(stateEquipmentOptions.length===0){if(stateEquipment)setStateEquipment("");return;}
    if(!stateEquipmentOptions.includes(stateEquipment))setStateEquipment(stateEquipmentOptions[0]);
  },[stateEquipmentOptions,stateEquipment]);

  // Estado diario global: se conserva para las alertas generales del dashboard.
  const dayStates=useMemo(()=>{
    const rows=safe(rop02All).filter(r=>inRange(r,from,to)&&!r?._excluded);
    const map=new Map();
    rows.forEach(r=>{
      const d=rowDate(r);if(!d)return;
      const prev=map.get(d)||{date:d,hours:0,states:[]};
      prev.hours+=num(r?.horas);
      prev.states.push(stateKey(r));
      map.set(d,prev);
    });
    return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(x=>{
      let state="S/D";
      if(x.hours>0)state="TRABAJO";
      else if(x.states.includes("FS"))state="FS";
      else if(x.states.includes("EM"))state="EM";
      else if(x.states.includes("OD"))state="OD";
      return{...x,state};
    });
  },[rop02All,from,to]);

  // Estado diario del equipo elegido en la card. Este cálculo NO altera las métricas globales.
  const equipmentDayStates=useMemo(()=>{
    if(!stateEquipment)return[];
    const rows=safe(rop02All).filter(r=>inRange(r,from,to)&&!r?._excluded&&code(r)===stateEquipment);
    const map=new Map();
    rows.forEach(r=>{
      const d=rowDate(r);if(!d)return;
      const prev=map.get(d)||{date:d,hours:0,states:[]};
      prev.hours+=num(r?.horas);
      prev.states.push(stateKey(r));
      map.set(d,prev);
    });
    return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(x=>{
      let state="S/D";
      if(x.hours>0)state="TRABAJO";
      else if(x.states.includes("FS"))state="FS";
      else if(x.states.includes("EM"))state="EM";
      else if(x.states.includes("OD"))state="OD";
      return{...x,state};
    });
  },[rop02All,from,to,stateEquipment]);

  const projects=useMemo(()=>["JM","FS"].map(key=>{
    const rows=current.filter(r=>projectKey(r?.proyecto)===key);
    const projectDaysMap=new Map();
    rows.forEach(r=>{const d=rowDate(r);if(!d)return;const x=projectDaysMap.get(d)||{hours:0,states:[]};x.hours+=num(r?.horas);x.states.push(stateKey(r));projectDaysMap.set(d,x);});
    const days=[...projectDaysMap.values()].map(x=>x.hours>0?"TRABAJO":x.states.includes("FS")?"FS":x.states.includes("EM")?"EM":x.states.includes("OD")?"OD":"S/D").filter(s=>["TRABAJO","OD","FS","EM"].includes(s));
    const work=days.filter(s=>s==="TRABAJO").length;const avail=days.filter(s=>s==="TRABAJO"||s==="OD").length;
    const mr=maintNow.filter(r=>projectKey(r?.proyecto)===key);const cost=mr.reduce((s,r)=>s+maintCostUsd(r),0);const hours=rows.reduce((s,r)=>s+num(r?.horas),0);
    return{key,name:key==="JM"?"José María":"Filo del Sol",availability:pct(avail,days.length),utilization:pct(work,days.length),hours,cost,costHour:hours?cost/hours:0};
  }),[current,maintNow,dayStates,usdRateSafe]);

  const alerts=useMemo(()=>{
    // FS: contar EQUIPOS distintos que tengan al menos un registro FS con 0 h dentro del rango.
    // No se usa el estado global por día porque cualquier otro equipo trabajando ese día ocultaba el FS.
    const fsCodes=new Set();
    current.forEach(r=>{if(num(r?.horas)<=0&&stateKey(r)==="FS"){const c=pmNorm(code(r));if(c)fsCodes.add(c);}});
    const fs=fsCodes.size;

    // Solicitudes atrasadas: se toma la base RABA03 y se cuentan solicitudes abiertas con más de 5 días
    // al cierre del filtro. estados_solicitudes solo contiene cierres/rechazos; no representa por sí solo
    // todas las solicitudes abiertas, por eso antes el contador podía quedar siempre en 0.
    const stateRows=safe(remote.states?.data);
    const closedNumbers=new Set();
    stateRows.forEach(r=>{
      const st=norm(r?.ESTADO??r?.estado);
      if(!(st.includes("CERRAD")||st.includes("RECHAZ")))return;
      const n=norm(r?.N_SOLICITUD??r?.nSolicitud??r?.numeroSolicitud??r?.solicitud);
      if(n)closedNumbers.add(n);
    });
    const rabaRows=safe(remote.raba?.data?.length?remote.raba.data:remote.raba?.sources?.raba03?.data);
    const get=(r,names)=>{for(const wanted of names){const wk=norm(wanted);const key=Object.keys(r||{}).find(k=>norm(k)===wk);if(key!=null)return r[key];}return "";};
    const cutoffMs=new Date(`${to}T23:59:59`).getTime();
    const ageLimitMs=cutoffMs-5*86400000;
    const delayedKeys=new Set();
    rabaRows.forEach((r,idx)=>{
      const d=dateKey(get(r,["Fecha de solicitud","Fecha solicitud","F. Sol.","FECHA_SOLICITUD","fechaSolicitud"]));
      if(!d||d>to)return;
      const t=new Date(`${d}T12:00:00`).getTime();
      if(!Number.isFinite(t)||t>ageLimitMs)return;
      const n=String(get(r,["N° de solicitud","Nº de solicitud","N de solicitud","Numero de solicitud","Número de solicitud","Solicitud","N_SOLICITUD","nSolicitud"])||"").trim();
      const pedido=String(get(r,["N° de pedido","Nº de pedido","N de pedido","Numero de pedido","Número de pedido"])||"").trim();
      const requestId=n||pedido||`${d}|${String(get(r,["Pedido por","Solicitante"])||"").trim()}|${idx}`;
      if(closedNumbers.has(norm(n||pedido)))return;
      delayedKeys.add(requestId);
    });
    const delayed=delayedKeys.size;

    const noRop=0;
    // Stock es una foto actual sin historial fechado; se mantiene como estado vigente y no se mezcla con cálculos históricos.
    const stock=safe(remote.stock?.rows).filter(r=>num(r?.stockMinimo)>0&&num(r?.saldoControlStock)<num(r?.stockMinimo)).length;
    return{delayed,fs,noRop,stock,pm:pm.critical};
  },[remote.states,remote.raba,remote.stock,current,pm.critical,to]);

  // Evolución gerencial por períodos operativos: cada “mes” corre del día 26 al día 25 del mes siguiente.
  // Se conserva el contexto anual, pero cada punto/barra respeta exactamente ese corte operativo.
  const monthly=useMemo(()=>{
    const anchor=selectedMonth||reportingMonthForDate(new Date(`${to||from}T12:00:00`));
    const year=Number(String(anchor).slice(0,4))||today.getFullYear();
    const rows=safe(rop02All).filter(r=>!r?._excluded);
    const out=[];
    for(let m=1;m<=12;m+=1){
      const month=`${year}-${String(m).padStart(2,"0")}`;
      const period=reportingPeriodForMonth(month);
      let JM=0,FS=0,total=0,records=0;
      rows.forEach(r=>{
        const d=rowDate(r);
        if(!d||d<period.start||d>period.end)return;
        const h=num(r?.horas);total+=h;records+=1;
        const p=projectKey(r?.proyecto);if(p==="JM")JM+=h;if(p==="FS")FS+=h;
      });
      out.push({month,JM,FS,total,records,label:new Date(year,m-1,1,12).toLocaleDateString("es-AR",{month:"short"}).replace(".",""),periodLabel:`${period.start.slice(8,10)}/${period.start.slice(5,7)} – ${period.end.slice(8,10)}/${period.end.slice(5,7)}`});
    }
    // Evita meses futuros completamente vacíos, pero mantiene todos los períodos hasta el último mes con datos o el seleccionado.
    let lastData=out.reduce((idx,x,i)=>x.records?i:idx,-1);
    const selectedIndex=Math.max(0,Math.min(11,Number(String(anchor).slice(5,7))-1));
    const last=Math.max(lastData,selectedIndex);
    return out.slice(0,last+1);
  },[rop02All,selectedMonth,from,to]);

  const maintSplit=useMemo(()=>{let prev=0,corr=0,other=0;maintNow.forEach(r=>{const c=maintCostUsd(r);const t=maintType(r);if(t==="PREV")prev+=c;else if(t==="CORR")corr+=c;else other+=c;});return[{name:"Preventivo",value:prev,color:C.green},{name:"Correctivo",value:corr,color:C.red},{name:"Otros",value:other,color:C.textMuted}].filter(x=>x.value>0);},[maintNow,usdRateSafe]);
  const stateHours=useMemo(()=>{const m={TRABAJO:0,OD:0,EM:0,FS:0,"S/D":0};equipmentDayStates.forEach(r=>{m[m[r.state]!=null?r.state:"S/D"]+=1;});return m;},[equipmentDayStates]);
  const stateTotal=useMemo(()=>["TRABAJO","OD","EM","FS"].reduce((a,k)=>a+stateHours[k],0),[stateHours]);
  const topEquipment=useMemo(()=>{const m={};current.forEach(r=>{const c=code(r);if(!c)return;if(!m[c])m[c]={hours:0,project:r?.proyecto||"S/D"};m[c].hours+=num(r?.horas);});return Object.entries(m).sort((a,b)=>b[1].hours-a[1].hours).slice(0,5).map(([name,d])=>({name,...d}));},[current]);
  const maintTotal=maintSplit.reduce((s,x)=>s+x.value,0);

  const comparisonLabel=comparisonMonth
    ? new Date(`${comparisonMonth}-01T12:00:00`).toLocaleDateString("es-AR",{month:"long",year:"numeric"})
    : new Date(`${prevFrom}T12:00:00`).toLocaleDateString("es-AR",{month:"long",year:"numeric"});
  return <div className="fade-in dm-exec-dashboard" style={{display:"flex",flexDirection:"column",gap:16}}>
    <style>{`.dm-exec-dashboard{font-family:Inter,sans-serif}.dm-exec-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:16px}.dm-exec-main{display:grid;grid-template-columns:minmax(0,2.2fr) minmax(280px,.9fr);gap:16px}.dm-exec-triple{display:grid;grid-template-columns:1.25fr .9fr .9fr;gap:16px}.dm-exec-bottom{display:grid;grid-template-columns:1fr 1.05fr 1.15fr;gap:16px}.dm-panel{backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}.dm-help{position:relative;width:16px;height:16px;border:1px solid rgba(255,255,255,.28);border-radius:50%;display:inline-grid;place-items:center;font-size:10px;font-weight:800;color:#cbd5df;cursor:help;line-height:1}.dm-help:after{content:attr(data-tip);position:absolute;left:50%;top:22px;transform:translateX(-50%);width:230px;padding:8px 10px;border-radius:7px;background:#111820;color:#e7edf4;border:1px solid rgba(255,255,255,.18);box-shadow:0 8px 24px rgba(0,0,0,.45);font-size:10px;font-weight:500;line-height:1.35;opacity:0;pointer-events:none;z-index:50;transition:.15s}.dm-help:hover:after,.dm-help:focus:after{opacity:1}.dm-exec-table{width:100%;border-collapse:separate;border-spacing:0;font-size:10px;background:rgba(255,255,255,.035);border-radius:8px;overflow:hidden}.dm-exec-table th{background:rgba(255,255,255,.075);color:#cbd5df;font-weight:800}.dm-exec-table th,.dm-exec-table td{padding:9px 10px;border-bottom:1px solid rgba(255,255,255,.10)}.dm-exec-table tbody tr:nth-child(even){background:rgba(255,255,255,.025)}.dm-exec-table tbody tr:hover{background:rgba(255,255,255,.055)}@media(max-width:1350px){.dm-exec-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.dm-exec-main{grid-template-columns:1fr}.dm-exec-triple,.dm-exec-bottom{grid-template-columns:1fr 1fr}.dm-exec-triple>*:first-child{grid-column:1/-1}}@media(max-width:800px){.dm-exec-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.dm-exec-triple,.dm-exec-bottom{grid-template-columns:1fr}.dm-exec-triple>*:first-child{grid-column:auto}}@media(max-width:520px){.dm-exec-kpis{grid-template-columns:1fr}}`}</style>

    <div style={{display:"flex",justifyContent:"space-between",gap:14,alignItems:"center",flexWrap:"wrap",padding:"4px 2px 2px"}}>
      <div><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:20}}>♛</span><h2 style={{fontSize:20,margin:0}}>Dashboard Gerencial</h2></div><div style={{fontSize:11,color:C.textMuted,marginTop:3}}>Resumen ejecutivo de operaciones · foco en indicadores y excepciones</div></div>
      <div style={{display:"flex",gap:9,alignItems:"end",flexWrap:"wrap"}}><label style={{fontSize:9,color:C.textMuted}}>Mes<input type="month" value={selectedMonth} onChange={e=>applyMonth(e.target.value)} onClick={e=>e.currentTarget.showPicker?.()} title="Elegir mes" style={{display:"block",marginTop:4,background:C.surface,border:`1px solid ${C.borderLight}`,color:C.text,borderRadius:8,padding:"7px 36px 7px 9px",fontSize:11,cursor:"pointer",colorScheme:"dark",backgroundImage:'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'18\' height=\'18\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Crect x=\'3\' y=\'5\' width=\'18\' height=\'16\' rx=\'2\'/%3E%3Cline x1=\'16\' y1=\'3\' x2=\'16\' y2=\'7\'/%3E%3Cline x1=\'8\' y1=\'3\' x2=\'8\' y2=\'7\'/%3E%3Cline x1=\'3\' y1=\'11\' x2=\'21\' y2=\'11\'/%3E%3C/svg%3E")',backgroundRepeat:"no-repeat",backgroundPosition:"right 10px center",backgroundSize:"16px 16px"}}/></label><label style={{fontSize:9,color:C.textMuted}}>Desde<input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={{display:"block",marginTop:4,background:C.surface,border:`1px solid ${C.borderLight}`,color:C.text,borderRadius:8,padding:"7px 9px",fontSize:11}}/></label><label style={{fontSize:9,color:C.textMuted}}>Hasta<input type="date" value={to} min={from} onChange={e=>setTo(e.target.value)} style={{display:"block",marginTop:4,background:C.surface,border:`1px solid ${C.borderLight}`,color:C.text,borderRadius:8,padding:"7px 9px",fontSize:11}}/></label><label style={{fontSize:9,color:C.textMuted}}>Comparar con<input type="month" value={comparisonMonth} onChange={e=>setComparisonMonth(e.target.value)} onClick={e=>e.currentTarget.showPicker?.()} title="Elegir mes de comparación" style={{display:"block",marginTop:4,background:C.surface,border:`1px solid ${C.borderLight}`,color:C.text,borderRadius:8,padding:"7px 36px 7px 9px",fontSize:11,cursor:"pointer",colorScheme:"dark",backgroundImage:'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'18\' height=\'18\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Crect x=\'3\' y=\'5\' width=\'18\' height=\'16\' rx=\'2\'/%3E%3Cline x1=\'16\' y1=\'3\' x2=\'16\' y2=\'7\'/%3E%3Cline x1=\'8\' y1=\'3\' x2=\'8\' y2=\'7\'/%3E%3Cline x1=\'3\' y1=\'11\' x2=\'21\' y2=\'11\'/%3E%3C/svg%3E")',backgroundRepeat:"no-repeat",backgroundPosition:"right 10px center",backgroundSize:"16px 16px"}}/><span style={{display:"block",marginTop:3,fontSize:8,color:C.textMuted,textTransform:"capitalize"}}>{comparisonLabel}</span></label></div>
    </div>

    <div className="dm-exec-kpis">
      <Kpi icon="equip" label="Disponibilidad de Flota" help="Porcentaje de días disponibles dentro del rango Desde/Hasta seleccionado." value={`${fmt1(metrics.availability)}%`} deltaValue={metrics.dAvail} sub="período anterior" color={C.green}/>
      <Kpi icon="barChart" label="Utilización de Flota" help="Porcentaje de días con trabajo efectivo dentro del rango Desde/Hasta seleccionado." value={`${fmt1(metrics.utilization)}%`} deltaValue={metrics.dUtil} sub="período anterior" color={C.blue}/>
      <Kpi icon="hours" label="Horas Trabajadas" help="Suma de horas ROP02 exclusivamente dentro del rango Desde/Hasta seleccionado." value={`${fmt(metrics.hours)} h`} deltaValue={metrics.dHours} sub="período anterior" color={C.purple}/>
      <Kpi icon="prod" label="Costo Mantenimiento" help={`Costo RMA15 del rango ${from} a ${to}, convertido de ARS a USD con TC ${fmt1(usdRateSafe)} ARS/USD.`} value={fmtMoney(metrics.cost)} deltaValue={metrics.dCost} sub="período anterior" color={C.yellow}/>
      <Kpi icon="badgeDollarSign" label="Costo Mant. USD/h" help="Costo de mantenimiento en USD dividido por las horas trabajadas del mismo rango seleccionado." value={fmt1(metrics.costHour)} deltaValue={metrics.dCostHour} sub="período anterior" color={C.teal}/>
      <Kpi icon="wrench" label="Cumplimiento PM" help="Cumplimiento de mantenimiento preventivo calculado al cierre de la fecha Hasta seleccionada." value={pm.compliance==null?"—":`${fmt1(pm.compliance)}%`} deltaValue={pm.compliance==null||prevPmCompliance==null?null:pm.compliance-prevPmCompliance} sub="flota configurada" color={C.red}/>
    </div>

    <div className="dm-exec-main">
      <Panel title="Comparativo por Proyecto" help="Compara los indicadores del rango Desde/Hasta entre José María, Filo del Sol y el total general."><div style={{padding:"0 12px 10px",overflowX:"auto"}}><table className="dm-exec-table" style={{minWidth:640}}><thead><tr>{["Indicador","José María","Filo del Sol","Total General"].map(h=><th key={h} style={{textAlign:h==="Indicador"?"left":"right",padding:"11px 8px",color:h==="José María"?C.green:h==="Filo del Sol"?C.blue:C.textSub,borderBottom:`1px solid ${C.border}`}}>{h}</th>)}</tr></thead><tbody>{[
        ["Disponibilidad",p=>`${fmt1(p.availability)}%`,`${fmt1(metrics.availability)}%`],
        ["Utilización",p=>`${fmt1(p.utilization)}%`,`${fmt1(metrics.utilization)}%`],
        ["Horas Trabajadas",p=>`${fmt(p.hours)} h`,`${fmt(metrics.hours)} h`],
        ["Costo Mantenimiento",p=>fmtMoney(p.cost),fmtMoney(metrics.cost)],
        ["Costo Mant. USD/h",p=>fmt1(p.costHour),fmt1(metrics.costHour)],
        ["Cumplimiento PM",()=>pm.compliance==null?"—":`${fmt1(pm.compliance)}%`,pm.compliance==null?"—":`${fmt1(pm.compliance)}%`],
      ].map(([label,get,total])=><tr key={label}><td style={{padding:"10px 8px",color:C.textSub,borderBottom:`1px solid ${C.border}`}}>{label}</td>{projects.map(p=><td key={p.key} style={{padding:"10px 8px",textAlign:"right",fontWeight:800,borderBottom:`1px solid ${C.border}`}}>{get(p)}</td>)}<td style={{padding:"10px 8px",textAlign:"right",fontWeight:900,borderBottom:`1px solid ${C.border}`}}>{total}</td></tr>)}</tbody></table></div></Panel>
      <Panel title="Excepciones y Alertas Críticas" help="Alertas que requieren atención. Los indicadores con historial se calculan para el rango seleccionado." action={<button onClick={()=>onNavigate?.("pmGestion")} style={{border:0,background:"transparent",color:C.blue,fontSize:10,cursor:"pointer"}}>Ver todas</button>}><AlertRow icon="warn" color={C.red} title="PM Vencidos" description="Equipos con mantenimiento preventivo urgente o atrasado" count={alerts.pm} onClick={()=>onNavigate?.("pmGestion")}/><AlertRow icon="hours" color={C.yellow} title="Solicitudes Atrasadas" description="Solicitudes abiertas con más de 5 días" count={alerts.delayed} onClick={()=>onNavigate?.("abastecimientoPendientes")}/><AlertRow icon="warn" color={C.yellow} title="Equipos Fuera de Servicio" description="Equipos con estado FS en el período" count={alerts.fs} onClick={()=>onNavigate?.("rop02")}/><AlertRow icon="fileBarChart" color={C.purple} title="Sin ROP02" description="Control diario disponible desde Control de ROP02" count={alerts.noRop} onClick={()=>onNavigate?.("controlErrores")}/><AlertRow icon="parts" color={C.red} title="Stock Crítico" description="Artículos por debajo del stock mínimo" count={alerts.stock} onClick={()=>onNavigate?.("abastecimientoStock")}/></Panel>
    </div>

    <div className="dm-exec-triple">
      <Panel title="Evolución Mensual — Horas Trabajadas" help="Cada punto representa el período operativo del mes: desde el día 26 de ese mes hasta el día 25 del mes siguiente. El selector Mes aplica automáticamente ese mismo corte; Desde/Hasta siguen siendo editables."><div style={{padding:"12px 8px 6px",height:245}}><ResponsiveContainer width="100%" height="100%"><AreaChart data={monthly} margin={{left:-15,right:8,top:6,bottom:0}}><defs><linearGradient id="execG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.blue} stopOpacity={.35}/><stop offset="95%" stopColor={C.blue} stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/><XAxis dataKey="label" tick={{fill:C.textMuted,fontSize:9}} axisLine={false} tickLine={false}/><YAxis tick={{fill:C.textMuted,fontSize:9}} axisLine={false} tickLine={false}/><Tooltip content={<Tip/>}/><Area type="monotone" dataKey="total" name="Horas" stroke={C.blue} strokeWidth={2} fill="url(#execG)"/></AreaChart></ResponsiveContainer><div style={{fontSize:8.5,color:C.textMuted,marginTop:-1,textAlign:"right"}}>Cada mes: 26 → 25 del mes siguiente</div></div></Panel>
      <Panel title="Preventivo vs Correctivo" help="Distribución del costo de mantenimiento RMA15 dentro del rango Desde/Hasta seleccionado."><div style={{height:245,padding:8,display:"grid",gridTemplateColumns:"1fr 1fr",alignItems:"center"}}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={maintSplit} dataKey="value" nameKey="name" innerRadius={48} outerRadius={73} paddingAngle={2}>{maintSplit.map((x,i)=><Cell key={i} fill={x.color}/>)}</Pie><Tooltip content={<Tip/>}/></PieChart></ResponsiveContainer><div style={{fontSize:10}}><div style={{fontSize:12,fontWeight:900,marginBottom:10}}>{fmtMoney(maintTotal)}</div>{maintSplit.map(x=><div key={x.name} style={{display:"flex",justifyContent:"space-between",gap:8,margin:"8px 0",color:C.textSub}}><span><i style={{display:"inline-block",width:7,height:7,borderRadius:"50%",background:x.color,marginRight:5}}/>{x.name}</span><strong style={{color:x.color}}>{fmt1(pct(x.value,maintTotal))}%</strong></div>)}</div></div></Panel>
      <Panel title="Horas por Estado de Flota · clasificación diaria" help={`Seleccioná un equipo. El cálculo usa únicamente sus registros ROP02 dentro del filtro ${from} a ${to}: con horas > 0 = Trabajo; con 0 h se clasifica como OD, EM o FS según el estado informado.`}>
        <div style={{padding:"12px 14px 14px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:14}}>
            <span style={{fontSize:10,color:C.textSub,fontWeight:700}}>Equipo</span>
            <select value={stateEquipment} onChange={e=>setStateEquipment(e.target.value)} style={{minWidth:170,maxWidth:"70%",height:30,borderRadius:7,border:`1px solid ${C.borderLight}`,background:"rgba(8,14,20,.86)",color:C.text,padding:"0 9px",fontSize:10,fontWeight:700,outline:"none"}}>
              {stateEquipmentOptions.length===0?<option value="">Sin equipos en el período</option>:stateEquipmentOptions.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{display:"flex",height:22,borderRadius:6,overflow:"hidden",background:C.border}}>{[["TRABAJO",C.green],["OD",C.yellow],["EM",C.purple],["FS",C.red]].map(([s,c])=><div key={s} title={`${s}: ${fmt(stateHours[s])} días`} style={{width:`${pct(stateHours[s],stateTotal)}%`,background:c,minWidth:stateHours[s]>0?2:0}}/>)}</div>
          <div style={{marginTop:14,display:"grid",gap:8}}>{[["Operativo / Trabajo","TRABAJO",C.green],["Operativo a disposición","OD",C.yellow],["En mantenimiento","EM",C.purple],["Fuera de servicio","FS",C.red]].map(([l,s,c])=><div key={s} style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:8,fontSize:10,color:C.textSub}}><span><i style={{display:"inline-block",width:7,height:7,borderRadius:2,background:c,marginRight:6}}/>{l}</span><strong style={{color:C.text}}>{fmt1(pct(stateHours[s],stateTotal))}%</strong><span style={{minWidth:76,textAlign:"right"}}>{fmt(stateHours[s])} días</span></div>)}</div>
          {stateEquipment&&<div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",fontSize:9.5,color:C.textMuted}}><span>{stateEquipment}</span><span>{fmt(stateTotal)} días con registro en el período</span></div>}
        </div>
      </Panel>
    </div>

    <FleetUtilizationPanel rows={rop02All} from={from} to={to}/>

    <div className="dm-exec-bottom">
      <Panel title="Top 5 Equipos por Horas Trabajadas" help="Ranking de los cinco equipos con más horas dentro del rango Desde/Hasta seleccionado."><div style={{padding:"10px 12px 12px",overflowX:"auto"}}>{topEquipment.length?<table className="dm-exec-table"><thead><tr><th style={{textAlign:"left"}}>Equipo</th><th style={{textAlign:"left"}}>Proyecto</th><th style={{textAlign:"right"}}>Horas (h)</th><th style={{textAlign:"right"}}>% del total</th></tr></thead><tbody>{topEquipment.map(x=><tr key={x.name}><td style={{fontWeight:800}}>{x.name}</td><td>{projectKey(x.project)==="JM"?"José María":projectKey(x.project)==="FS"?"Filo del Sol":x.project||"S/D"}</td><td style={{textAlign:"right",fontWeight:800}}>{fmt(x.hours)}</td><td style={{textAlign:"right"}}>{fmt1(pct(x.hours,metrics.hours))}%</td></tr>)}<tr><td colSpan={2} style={{fontWeight:900}}>Total Top 5</td><td style={{textAlign:"right",fontWeight:900}}>{fmt(topEquipment.reduce((s,x)=>s+x.hours,0))}</td><td style={{textAlign:"right",fontWeight:900}}>{fmt1(pct(topEquipment.reduce((s,x)=>s+x.hours,0),metrics.hours))}%</td></tr></tbody></table>:<div style={{padding:20,color:C.textMuted,fontSize:11}}>Sin datos en el período.</div>}</div></Panel>
      <Panel title="Distribución de Horas — José María vs Filo del Sol" help="Compara José María y Filo del Sol por período operativo mensual, usando para cada mes el corte 26 del mes al 25 del mes siguiente."><div style={{height:220,padding:"10px 8px 4px"}}><ResponsiveContainer width="100%" height="100%"><BarChart data={monthly} margin={{left:-15,right:8,top:5,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/><XAxis dataKey="label" tick={{fill:C.textMuted,fontSize:9}} axisLine={false} tickLine={false}/><YAxis tick={{fill:C.textMuted,fontSize:9}} axisLine={false} tickLine={false}/><Tooltip content={<Tip/>}/><Bar dataKey="JM" name="José María" fill={C.green} radius={[3,3,0,0]}/><Bar dataKey="FS" name="Filo del Sol" fill={C.blue} radius={[3,3,0,0]}/></BarChart></ResponsiveContainer><div style={{fontSize:8.5,color:C.textMuted,marginTop:-1,textAlign:"right"}}>Cada mes: 26 → 25 del mes siguiente</div></div></Panel>
      <Panel title="Cumplimiento PM — Estado Actual" help="Estado del mantenimiento preventivo calculado con el horómetro disponible hasta la fecha Hasta seleccionada."><div style={{padding:"18px 16px"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}><strong style={{fontSize:30,color:pm.compliance!=null&&pm.compliance>=90?C.green:pm.compliance!=null&&pm.compliance>=75?C.yellow:C.red}}>{pm.compliance==null?"—":`${fmt1(pm.compliance)}%`}</strong><span style={{fontSize:10,color:C.textMuted}}>{pm.total?`${pm.total-pm.critical} de ${pm.total} al día`:"Sin configuración PM"}</span></div><div style={{height:8,borderRadius:999,background:C.border,overflow:"hidden",marginTop:15}}><div style={{height:"100%",width:`${Math.min(100,Math.max(0,pm.compliance||0))}%`,background:pm.compliance!=null&&pm.compliance>=90?C.green:pm.compliance!=null&&pm.compliance>=75?C.yellow:C.red}}/></div><div style={{marginTop:16,padding:"10px 11px",borderRadius:8,background:C.redDim,border:`1px solid ${C.red}33`,display:"flex",justifyContent:"space-between",fontSize:10}}><span style={{color:C.textSub}}>PM urgentes / atrasados</span><strong style={{color:C.red}}>{pm.critical}</strong></div></div></Panel>
    </div>

    <div style={{fontSize:9,color:C.textMuted,padding:"2px 4px 6px",display:"flex",alignItems:"center",gap:6}}><Icon name="consist" size={11} color={C.textMuted}/> Los indicadores se calculan con los registros del período seleccionado. La clasificación de estado se calcula por equipo seleccionado y por día dentro del período: con horas &gt; 0 = operativo; con 0 h se clasifica como OD, FS o EM según ROP02. Los costos corresponden a RMA15 del mismo período y se convierten de ARS a USD con la cotización configurada en la app.</div>
  </div>;
}
