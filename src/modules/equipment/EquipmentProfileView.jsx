import React, { useEffect, useMemo, useState } from "react";
import { C, Card, StatCard, Table, Icon, DateIn, PeriodMonthYear, normalizeMultiValue, multiDefault } from "../../components/ui/index.jsx";
import { APPS_SCRIPT_URL } from "../../config/app.js";
import { fetchAction } from "../../services/appsScriptApi.js";
import { registerRefreshTask } from "../../services/refreshManager.js";
import { byDateFilter } from "../../shared/domain/index.jsx";
import { cleanEquipmentCode, canonicalEquipmentCode } from "./equipmentCode.js";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";

function norm(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]/g,"");}
function pick(row,names){const keys=Object.keys(row||{});for(const n of names){const nn=norm(n);const exact=keys.find(k=>norm(k)===nn);if(exact)return row[exact];}for(const n of names){const nn=norm(n);const partial=keys.find(k=>norm(k).includes(nn)||nn.includes(norm(k)));if(partial)return row[partial];}return"";}
const MASTER_CODE_HEADERS=["Codigo nuevo","Código nuevo","Código de Drusila","Codigo de Drusila","Código Drusila","Codigo Drusila","Interno","Código interno","Codigo Int","Código viejo","Codigo viejo"];
function codesOfMaster(row){const out=[];for(const h of MASTER_CODE_HEADERS){const v=String(pick(row,[h])||"").trim();const key=canonicalEquipmentCode(v);if(v&&key&&!out.some(x=>canonicalEquipmentCode(x)===key))out.push(v);}return out;}
function sourceCode(row){return String(row?.maquina||row?.interno||row?.codigo||row?.["Codigo Int"]||row?.["Código Interno del Equipo"]||"").trim();}
function fmt(v,digits=1){const n=Number(v);return Number.isFinite(n)?n.toLocaleString("es-AR",{maximumFractionDigits:digits}):"—";}
function monthKey(v){const d=new Date(`${String(v||"").slice(0,10)}T12:00:00`);return Number.isNaN(d.getTime())?"":`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;}
function shortDate(v){if(!v)return"";const d=new Date(`${String(v).slice(0,10)}T12:00:00`);return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit"});}
function looksLikeEquipmentCode(v){const s=cleanEquipmentCode(v);return s.length>=4&&s.length<=24&&/[A-Z]/.test(s)&&/\d/.test(s);}
function buildCodeIndex(rows,codeGetter,sorter){const map=new Map();for(const row of rows||[]){const key=canonicalEquipmentCode(codeGetter(row));if(!key)continue;let bucket=map.get(key);if(!bucket){bucket=[];map.set(key,bucket);}bucket.push(row);}if(sorter){for(const bucket of map.values())bucket.sort(sorter);}return map;}

function EquipmentPicker({options,value,onChange}){
  return <select value={value||""} onChange={e=>onChange(e.target.value)} style={{width:"100%",height:40,boxSizing:"border-box",borderRadius:8,border:`1px solid ${C.border}`,background:"#151515",color:C.text,padding:"0 12px",fontSize:12,fontWeight:700,outline:"none",cursor:"pointer"}}>
    <option value="">Seleccionar equipo...</option>
    {options.map(o=><option key={o.key} value={o.value}>{o.label}</option>)}
  </select>;
}

function formatUSDFromARS(valueARS,usdRate){const ars=Number(valueARS),rate=Number(usdRate);if(!Number.isFinite(ars)||ars<=0||!Number.isFinite(rate)||rate<=0)return"—";return formatUSDNumber(ars/rate);}
function formatUSDNumber(valueUSD){const usd=Number(valueUSD);if(!Number.isFinite(usd))return"USD 0,00";return`USD ${usd.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;}

function maintenanceCostARS(row,insumosCatalog){
  const items=Array.isArray(row?.insumos)?row.insumos:[];
  let total=0;
  for(const item of items){
    const code=String(item?.codigo||"").trim().toUpperCase().replace(/\s+/g,"").replace(/[–—]/g,"-");
    const qty=Number(item?.cantidad)||0;
    const catalog=insumosCatalog?.[code]||{};
    const unit=Number(catalog?.costoUnitario);
    if(qty>0&&Number.isFinite(unit)&&unit>0)total+=qty*unit;
    else total+=Number(item?.costoTotal)||0;
  }
  if(total>0)return total;
  return Number(row?.costoTotal)||0;
}
function Rma15UsdTooltip({active,payload,label}){if(!active||!payload?.length)return null;const value=Number(payload[0]?.value)||0;return <div style={{background:"rgba(23,23,23,.98)",border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",boxShadow:"0 8px 24px rgba(0,0,0,.45)"}}><div style={{fontSize:11,color:C.textSub,marginBottom:4}}>{label}</div><div style={{fontSize:12,fontWeight:800,color:C.purple}}>{formatUSDNumber(value)}</div></div>;}

function EquipmentProfileView({listaEquipos=[],rop02All=[],rop05=[],rma15=[],insumos={},initialCode="",onSelectCode,usdRate}){
  const [selected,setSelected]=useState(()=>cleanEquipmentCode(initialCode));
  const [detailKey,setDetailKey]=useState(()=>canonicalEquipmentCode(initialCode));
  const [pm,setPm]=useState({config:[],registros:[]});
  const [fechaD,setFechaD]=useState("");
  const [fechaH,setFechaH]=useState("");
  const [selectedMonth,setSelectedMonth]=useState("");
  const [activeTab,setActiveTab]=useState("resumen");

  // El selector debe responder de inmediato. La ficha pesada se actualiza en el
  // frame siguiente para que el navegador pueda pintar primero la opción elegida.
  // No propagamos cada selección al estado raíz de App: eso antes provocaba un
  // rerender de toda la aplicación y podía dejar el <select> bloqueado.
  useEffect(()=>{
    if(!initialCode)return;
    const clean=cleanEquipmentCode(initialCode);
    setSelected(clean);
    setDetailKey(canonicalEquipmentCode(clean));
  },[initialCode]);
  useEffect(()=>{
    try{
      if(selected)sessionStorage.setItem("dm_selected_equipment",cleanEquipmentCode(selected));
    }catch(_){}
    let alive=true;
    let raf=window.requestAnimationFrame(()=>{
      if(alive)setDetailKey(canonicalEquipmentCode(selected));
    });
    return()=>{alive=false;window.cancelAnimationFrame(raf);};
  },[selected]);
  const loadPm=React.useCallback(async()=>{const r=await fetchAction(APPS_SCRIPT_URL,"mantenimiento_programado");if(r?.ok)setPm({config:r.config||[],registros:r.registros||[]});return r;},[]);
  useEffect(()=>{loadPm().catch(()=>{});},[loadPm]);
  useEffect(()=>registerRefreshTask("equipment-profile",loadPm,{views:["equipmentProfile"],priority:20}),[loadPm]);

  // Índices construidos una sola vez por actualización de dataset. Cambiar de equipo
  // ya no recorre miles de filas de ROP02/RMA15/ROP05 en el hilo principal.
  const masterIndex=useMemo(()=>{const map=new Map();for(const row of listaEquipos){for(const c of codesOfMaster(row)){const key=canonicalEquipmentCode(c);if(key&&!map.has(key))map.set(key,row);}}return map;},[listaEquipos]);
  const rop02Index=useMemo(()=>buildCodeIndex(rop02All,sourceCode,(a,b)=>String(a.fecha||"").localeCompare(String(b.fecha||""))),[rop02All]);
  const rop05Index=useMemo(()=>buildCodeIndex(rop05,sourceCode),[rop05]);
  const rma15Index=useMemo(()=>buildCodeIndex(rma15,sourceCode,(a,b)=>String(b.fecha||"").localeCompare(String(a.fecha||""))),[rma15]);
  const pmRegIndex=useMemo(()=>buildCodeIndex(pm.registros||[],r=>pick(r,["Interno","Codigo","Equipo"]),(a,b)=>String(pick(b,["Fecha","Fecha PM"])||"").localeCompare(String(pick(a,["Fecha","Fecha PM"])||""))),[pm.registros]);
  const pmCfgIndex=useMemo(()=>{const m=new Map();for(const r of pm.config||[]){const k=canonicalEquipmentCode(pick(r,["Interno","Codigo","Equipo"]));if(k)m.set(k,r);}return m;},[pm.config]);

  const allCodes=useMemo(()=>{
    const catalog=new Map();
    const add=(raw,explicitMaster=null,fromMaster=false)=>{
      const rawCode=String(raw||"").trim();
      const key=canonicalEquipmentCode(rawCode);
      if(!key||(!fromMaster&&!looksLikeEquipmentCode(rawCode)))return;
      const master=explicitMaster||masterIndex.get(key)||null;
      const masterCodes=master?codesOfMaster(master):[];
      const preferred=cleanEquipmentCode(masterCodes[0]||rawCode);
      const existing=catalog.get(key);
      if(existing&&(!master||existing.master))return;
      const marca=pick(master||{},["Marca"]),modelo=pick(master||{},["Modelo"]),familia=pick(master||{},["Familia","Tipo"]);
      catalog.set(key,{key,value:preferred,label:`${preferred}${marca||modelo?` · ${[marca,modelo].filter(Boolean).join(" ")}`:familia?` · ${familia}`:""}`,master});
    };
    listaEquipos.forEach(row=>{const codes=codesOfMaster(row);if(codes.length)add(codes[0],row,true);});
    // Los índices ya recorrieron las fuentes completas: reutilizarlos evita una segunda
    // pasada por miles de registros sólo para construir el desplegable.
    for(const bucket of rop02Index.values())if(bucket[0])add(sourceCode(bucket[0]));
    for(const bucket of rop05Index.values())if(bucket[0])add(sourceCode(bucket[0]));
    for(const bucket of rma15Index.values())if(bucket[0])add(sourceCode(bucket[0]));
    (pm.config||[]).forEach(r=>add(pick(r,["Interno","Codigo","Equipo"])));
    for(const bucket of pmRegIndex.values())if(bucket[0])add(pick(bucket[0],["Interno","Codigo","Equipo"]));
    return [...catalog.values()].sort((a,b)=>a.label.localeCompare(b.label,"es",{numeric:true,sensitivity:"base"}));
  },[listaEquipos,rop02Index,rop05Index,rma15Index,pm.config,pmRegIndex,masterIndex]);

  // Si llega RPC-0016-JM, el selector utiliza RPC-0016; ambos comparten la misma clave.
  const selectedKey=detailKey;
  const selectedOption=useMemo(()=>allCodes.find(o=>o.key===selectedKey)||null,[allCodes,selectedKey]);
  const master=masterIndex.get(selectedKey)||selectedOption?.master||null;
  const op=rop02Index.get(selectedKey)||[];
  const prod=rop05Index.get(selectedKey)||[];
  const mant=rma15Index.get(selectedKey)||[];
  const pmReg=pmRegIndex.get(selectedKey)||[];

  const filteredOp=useMemo(()=>{
    let rows=op;
    if(fechaD||fechaH)rows=byDateFilter(rows,"periodo",null,fechaD,fechaH);
    return rows;
  },[op,fechaD,fechaH]);
  const filteredProd=useMemo(()=>{
    let rows=prod;
    if(fechaD||fechaH)rows=byDateFilter(rows,"periodo",null,fechaD,fechaH);
    return rows;
  },[prod,fechaD,fechaH]);
  const filteredMant=useMemo(()=>{
    let rows=mant;
    if(fechaD||fechaH)rows=byDateFilter(rows,"periodo",null,fechaD,fechaH);
    return rows;
  },[mant,fechaD,fechaH]);
  const filteredPmReg=useMemo(()=>{
    let rows=pmReg;
    if(fechaD||fechaH)rows=byDateFilter(rows,"periodo",null,fechaD,fechaH);
    return rows;
  },[pmReg,fechaD,fechaH]);

  const effectiveUsdRate=useMemo(()=>{try{const saved=JSON.parse(window.localStorage.getItem("delta_costos_mant_state_v1")||"{}");const configured=Number(saved?.usdRate2);if(Number.isFinite(configured)&&configured>0)return configured;}catch(_){}const fallback=Number(usdRate);return Number.isFinite(fallback)&&fallback>0?fallback:1400;},[usdRate]);

  const summary=useMemo(()=>{
    const lastOp=filteredOp[filteredOp.length-1]||{};
    const currentH=Number(lastOp.horometroFinal??lastOp.hf??lastOp.horometro??0)||0;
    let totalHours=0,totalFuel=0,prodHours=0,maintCostARS=0,operativos=0;
    for(const r of filteredOp){totalHours+=Number(r.horas??r.hs??0)||0;totalFuel+=Number(r.combustible??0)||0;}
    for(const r of filteredProd)prodHours+=Number(r.cantHs??r.horasProductivas??r.hs??r.horas??0)||0;
    for(const r of filteredMant){maintCostARS+=maintenanceCostARS(r,insumos);if(r.operativo!==false)operativos++;}
    return {lastOp,currentH,totalHours,totalFuel,prodHours,maintCostARS,fuelRate:totalHours>0?totalFuel/totalHours:0,availability:filteredMant.length?Math.round(100*operativos/filteredMant.length):null};
  },[filteredOp,filteredProd,filteredMant,insumos]);

  const operationalStatus=useMemo(()=>{
    const byDay=new Map();
    for(const r of filteredOp){
      const d=String(r.fecha||"").slice(0,10);if(!d)continue;
      const x=byDay.get(d)||{hours:0,states:[]};x.hours+=Number(r.horas??r.hs??0)||0;x.states.push(norm(r.estado||r.status||r.horasRaw));byDay.set(d,x);
    }
    const counts={TRABAJO:0,OD:0,EM:0,FS:0,SD:0};
    for(const x of byDay.values()){
      if(x.hours>0)counts.TRABAJO++;
      else if(x.states.some(v=>v==="FS"||v.includes("FUERA")))counts.FS++;
      else if(x.states.some(v=>v==="EM"||v.includes("MANT")))counts.EM++;
      else if(x.states.some(v=>v==="OD"||v.includes("DISPOSIC")))counts.OD++;
      else counts.SD++;
    }
    const tracked=counts.TRABAJO+counts.OD+counts.EM+counts.FS;
    const latest=[...filteredOp].reverse().find(Boolean)||{};
    let current="SIN REGISTRO";
    const latestHours=Number(latest.horas??latest.hs??0)||0, st=norm(latest.estado||latest.status||latest.horasRaw);
    if(latestHours>0)current="OPERATIVO";else if(st==="FS"||st.includes("FUERA"))current="FS";else if(st==="EM"||st.includes("MANT"))current="EM";else if(st==="OD"||st.includes("DISPOSIC"))current="OD";
    return{...counts,tracked,utilization:tracked?counts.TRABAJO/tracked*100:null,availability:tracked?(counts.TRABAJO+counts.OD)/tracked*100:null,current};
  },[filteredOp]);
  const totalMaintAllARS=useMemo(()=>mant.reduce((s,r)=>s+maintenanceCostARS(r,insumos),0),[mant,insumos]);
  const periodCostUSD=Number(effectiveUsdRate)>0?summary.maintCostARS/Number(effectiveUsdRate):0;
  const accumulatedCostUSD=Number(effectiveUsdRate)>0?totalMaintAllARS/Number(effectiveUsdRate):0;
  const costPerHourUSD=summary.totalHours>0?periodCostUSD/summary.totalHours:0;
  const pmInfo=useMemo(()=>{
    const cfg=pmCfgIndex.get(selectedKey)||{};
    const latestReg=pmReg[0]||null;
    const lastH=Number(latestReg?pick(latestReg,["Horometro","Horómetro","Km / hs"]):pick(cfg,["horometroUltimoPM","Horómetro último PM"]))||0;
    const lastDate=latestReg?pick(latestReg,["Fecha","Fecha PM"]):pick(cfg,["fechaUltimoPM","Fecha último PM"]);
    const interval=Number(pick(cfg,["intervalo","Intervalo"]))||250;
    const next=lastH?lastH+interval:0;
    const since=lastH&&summary.currentH?Math.max(0,summary.currentH-lastH):0;
    const remaining=next&&summary.currentH?next-summary.currentH:null;
    let status="SIN BASE";if(lastH){status=remaining!=null&&remaining<0?"ATRASADO":remaining!=null&&remaining<=50?"PRÓXIMO":"AL DÍA";}
    return{lastH,lastDate,interval,next,since,remaining,status};
  },[pmCfgIndex,selectedKey,pmReg,summary.currentH]);
  const projectMovements=useMemo(()=>{
    const sorted=[...op].sort((a,b)=>String(a.fecha||"").localeCompare(String(b.fecha||"")));
    const out=[];let prev="";
    for(const r of sorted){const pr=String(r.proyecto||"").trim();if(!pr||pr===prev)continue;out.push({fecha:r.fecha,desde:prev||"—",hasta:pr});prev=pr;}
    return out.reverse().slice(0,30);
  },[op]);
  const project=summary.lastOp.proyecto||pick(master||{},["Proyecto","Lugar","Sitio"])||"—";
  const marca=pick(master||{},["Marca"]),modelo=pick(master||{},["Modelo"]),familia=pick(master||{},["Familia","Tipo"]),propiedad=pick(master||{},["Propiedad"]);
  const acquisition=pick(master||{},["Costo local en dólares sin IVA","Costo adquisición","Costo adquisicion"]);
  const rent=pick(master||{},["Tarifa mensual de alquiler","Tarifa mensual alquiler","Tarifa mensual de alquiler en dólares"]);

  const detailCode=selectedOption?.value||cleanEquipmentCode(selected);
  const horometerSeries=useMemo(()=>filteredOp.slice(-90).map(r=>({fecha:shortDate(r.fecha),horometro:Number(r.horometroFinal??r.hf??0)||0})).filter(x=>x.horometro>0),[filteredOp]);
  const monthlyMaint=useMemo(()=>{const rate=Number(effectiveUsdRate);if(!Number.isFinite(rate)||rate<=0)return[];const map=new Map();for(const r of filteredMant){const key=monthKey(r.fecha);if(key)map.set(key,(map.get(key)||0)+maintenanceCostARS(r,insumos)/rate);}return[...map.entries()].sort(([a],[b])=>a.localeCompare(b)).slice(-12).map(([key,value])=>({mes:key.slice(5)+"/"+key.slice(2,4),costo:Math.round(value*100)/100}));},[filteredMant,effectiveUsdRate,insumos]);
  const rop05Analytics=useMemo(()=>{
    const tasks=new Map(),days=new Set();
    let totalHours=0,totalRecords=0;
    for(const r of filteredProd){
      const task=String(r.tarea||r.actividad||r.tipoTrabajo||"Sin tarea").trim()||"Sin tarea";
      const hours=Number(r.cantHs??r.horasProductivas??r.hs??r.horas??0)||0;
      const quantity=Number(r.cantidad??r.cant??r.produccion??0)||0;
      const unit=String(r.unidad||"").trim().toUpperCase();
      const date=String(r.fecha||"").slice(0,10);if(date)days.add(date);
      totalHours+=hours;totalRecords++;
      const key=norm(task);const x=tasks.get(key)||{task,registros:0,horas:0,cantidad:0,units:new Set()};
      x.registros++;x.horas+=hours;x.cantidad+=quantity;if(unit)x.units.add(unit);tasks.set(key,x);
    }
    const list=[...tasks.values()].map(x=>{const unit=x.units.size===1?[...x.units][0]:x.units.size>1?"VARIAS":"";return{...x,unidad:unit,rendimiento:unit&&x.horas>0?x.cantidad/x.horas:null};}).sort((a,b)=>b.horas-a.horas||b.registros-a.registros);
    const byFrequency=[...list].sort((a,b)=>b.registros-a.registros||b.horas-a.horas);
    const main=list[0]||null,frequent=byFrequency[0]||null;
    return{list,top:list.slice(0,6),main,frequent,totalHours,totalRecords,productiveDays:days.size,avgHoursDay:days.size?totalHours/days.size:0};
  },[filteredProd]);
  const rop05TaskRows=useMemo(()=>rop05Analytics.list.slice(0,30).map((x,i)=>({id:`task-${i}`,tarea:x.task,registros:x.registros,horas:x.horas,cantidad:x.cantidad,unidad:x.unidad,rendimiento:x.rendimiento})),[rop05Analytics]);
  const rop05TaskCols=useMemo(()=>[{key:"tarea",label:"Tarea",wrap:true,minWidth:220},{key:"registros",label:"Registros",width:90},{key:"horas",label:"Horas",width:90,render:v=>`${fmt(v)} h`},{key:"cantidad",label:"Cantidad",width:105,render:v=>fmt(v)},{key:"unidad",label:"Unidad",width:90},{key:"rendimiento",label:"Rendimiento",width:120,render:(v,row)=>v==null?"—":`${fmt(v,2)} ${row?.unidad||""}/h`}],[]);
  const rows=useMemo(()=>filteredMant.slice(0,80).map((r,i)=>{const costoARS=maintenanceCostARS(r,insumos);return{id:`${selectedKey}-${i}`,fecha:r.fecha,tipo:r.tipoMant,intervencion:r.intervencion,kmHs:r.kmHs,costoUSD:Number(effectiveUsdRate)>0?costoARS/Number(effectiveUsdRate):0,operativo:r.operativo?"Sí":"No",observaciones:r.observaciones};}),[filteredMant,effectiveUsdRate,selectedKey,insumos]);
  const cols=useMemo(()=>[{key:"fecha",label:"Fecha",width:100},{key:"tipo",label:"Tipo",width:120},{key:"intervencion",label:"Intervención",wrap:true,minWidth:240},{key:"kmHs",label:"Km / hs",width:90,render:value=>fmt(value)},{key:"costoUSD",label:"Insumos USD",width:120,render:value=>formatUSDNumber(value)},{key:"operativo",label:"Operativo",width:90},{key:"observaciones",label:"Observaciones",wrap:true,minWidth:220}],[]);
  const rop02Rows=useMemo(()=>filteredOp.slice().reverse().slice(0,150).map((r,i)=>{const hours=Number(r.horas??r.hs??0)||0;const raw=r.estado||r.status||r.horasRaw;const st=norm(raw);const estadoTipo=hours>0?"TRABAJO":st==="FS"||st.includes("FUERA")?"FS":st==="EM"||st.includes("MANT")?"EM":st==="OD"||st.includes("DISPOSIC")?"OD":"SIN REGISTRO";return{id:`op-${i}`,fecha:r.fecha,interno:detailCode||sourceCode(r),proyecto:r.proyecto,turno:r.turno,hi:r.horometroInicial??r.hi,hf:r.horometroFinal??r.hf,horas:r.horas,estado:raw,estadoTipo,operador:r.operador||r.chofer||r.conductor,observaciones:r.observaciones};}),[filteredOp,detailCode]);
  const rop02Cols=useMemo(()=>[{key:"fecha",label:"Fecha",width:100},{key:"interno",label:"Interno",width:105},{key:"proyecto",label:"Proyecto",width:120},{key:"turno",label:"Turno",width:70},{key:"hi",label:"HI",width:85,render:v=>fmt(v)},{key:"hf",label:"HF",width:85,render:v=>fmt(v)},{key:"horas",label:"Horas",width:75,render:(v,row)=><strong style={{color:row?.estadoTipo==="TRABAJO"?C.green:C.text}}>{fmt(v)}</strong>},{key:"estado",label:"Estado",width:105,render:(v,row)=>{const type=row?.estadoTipo||"SIN REGISTRO";const color=type==="TRABAJO"?C.green:type==="OD"?C.yellow:type==="FS"?C.red:type==="EM"?C.purple:C.textMuted;const label=type==="TRABAJO"?"TRABAJO":type;return <span style={{display:"inline-flex",alignItems:"center",gap:6,color,fontWeight:900,background:`${color}18`,border:`1px solid ${color}55`,borderRadius:999,padding:"3px 8px"}}><span style={{width:6,height:6,borderRadius:"50%",background:color}}/>{label}</span>}},{key:"operador",label:"Operador",width:150},{key:"observaciones",label:"Observaciones",wrap:true,minWidth:220}],[]);
  const rop05Rows=useMemo(()=>filteredProd.slice().reverse().slice(0,150).map((r,i)=>({id:`prod-${i}`,fecha:r.fecha,interno:detailCode||sourceCode(r),proyecto:r.proyecto,tarea:r.tarea||r.actividad||r.tipoTrabajo,horas:r.cantHs??r.horasProductivas??r.hs??r.horas,cantidad:r.cantidad??r.cant??r.produccion,unidad:r.unidad,operador:r.operador||r.chofer||r.conductor})),[filteredProd,detailCode]);
  const rop05Cols=useMemo(()=>[{key:"fecha",label:"Fecha",width:100},{key:"interno",label:"Interno",width:105},{key:"proyecto",label:"Proyecto",width:120},{key:"tarea",label:"Tarea",wrap:true,minWidth:220},{key:"horas",label:"Horas",width:80,render:v=>fmt(v)},{key:"cantidad",label:"Cantidad",width:95,render:v=>fmt(v)},{key:"unidad",label:"Unidad",width:85},{key:"operador",label:"Operador",width:150}],[]);
  const movementCols=useMemo(()=>[{key:"fecha",label:"Fecha",width:110},{key:"desde",label:"Proyecto anterior",width:160},{key:"hasta",label:"Nuevo proyecto",width:160}],[]);

  const applyOperationalMonth=(month)=>{
    setSelectedMonth(month);
    if(!month){setFechaD("");setFechaH("");return;}
    const [year,monthNum]=month.split("-").map(Number);
    if(!year||!monthNum)return;
    const start=new Date(year,monthNum-2,26,12);
    const end=new Date(year,monthNum-1,25,12);
    const ymd=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    setFechaD(ymd(start));
    setFechaH(ymd(end));
  };
  const clearFilters=()=>{setSelectedMonth("");setFechaD("");setFechaH("");};
  const periodLabel=fechaD||fechaH?`${fechaD||"inicio"} al ${fechaH||"hoy"}`:"Todo el historial disponible";
  const statusColor=operationalStatus.current==="FS"?C.red:operationalStatus.current==="EM"?C.purple:operationalStatus.current==="OD"?C.yellow:C.green;
  const totalStateDays=operationalStatus.tracked||0;
  const workPct=totalStateDays?operationalStatus.TRABAJO/totalStateDays*100:0;
  const odPct=totalStateDays?operationalStatus.OD/totalStateDays*100:0;
  const emPct=totalStateDays?operationalStatus.EM/totalStateDays*100:0;
  const fsPct=totalStateDays?operationalStatus.FS/totalStateDays*100:0;
  const pmProgress=pmInfo.lastH&&pmInfo.interval?Math.max(0,Math.min(100,(pmInfo.since/pmInfo.interval)*100)):0;
  const tabs=[
    ["resumen","Resumen"],["rop02","ROP02"],["rop05","ROP05"],["rma15","RMA15"],["historial","Historial"]
  ];
  const metricValueStyle={fontSize:24,lineHeight:1.05,whiteSpace:"normal",overflowWrap:"anywhere",wordBreak:"break-word"};
  const compactMetric=(label,value,color,tooltip,sub,icon)=><StatCard icon={icon} label={label} value={value} color={color} tooltip={tooltip} sub={sub} small valueStyle={metricValueStyle}/>;
  const dataRow=(label,value,color=C.text)=><div style={{display:"flex",justifyContent:"space-between",gap:18,padding:"8px 0",borderBottom:`1px solid ${C.border}55`,fontSize:12}}><span style={{color:C.textMuted}}>{label}</span><strong style={{color,textAlign:"right",overflowWrap:"anywhere"}}>{value||"—"}</strong></div>;

  const responsiveCss=`
    .dm-equipment-profile{width:100%;max-width:100%;overflow-x:hidden}
    .dm-equipment-profile *{min-width:0}
    .dm-equipment-filter-row>label,.dm-equipment-filter-row>div{min-width:0}
    .dm-equipment-filter-row input,.dm-equipment-filter-row select{width:100%!important}
    @media(max-width:1360px){
      .dm-equipment-header{grid-template-columns:minmax(0,1fr) minmax(520px,48%)!important;padding-inline:16px!important}
      .dm-equipment-metrics-6{grid-template-columns:repeat(3,minmax(0,1fr))!important}
      .dm-equipment-metrics-5{grid-template-columns:repeat(3,minmax(0,1fr))!important}
    }
    @media(max-width:1120px){
      .dm-equipment-header{grid-template-columns:1fr!important}
      .dm-equipment-filter-panel{max-width:100%!important}
      .dm-equipment-filter-row{grid-template-columns:repeat(4,minmax(0,1fr))!important}
      .dm-equipment-filter-row>button{width:100%!important}
      .dm-equipment-summary-grid{grid-template-columns:1fr 1fr!important}
      .dm-equipment-summary-grid>*:last-child{grid-column:1/-1}
      .dm-equipment-grid-4{grid-template-columns:repeat(2,minmax(0,1fr))!important}
    }
    @media(max-width:820px){
      .dm-equipment-profile{padding-inline:10px!important}
      .dm-equipment-header{padding:14px!important}
      .dm-equipment-header strong{overflow-wrap:anywhere}
      .dm-equipment-filter-row{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      .dm-equipment-metrics-5,.dm-equipment-metrics-6{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      .dm-equipment-summary-grid,.dm-equipment-grid-2,.dm-equipment-grid-3{grid-template-columns:1fr!important}
      .dm-equipment-summary-grid>*:last-child{grid-column:auto}
      .dm-equipment-utilization{grid-template-columns:120px minmax(0,1fr)!important}
    }
    @media(max-width:520px){
      .dm-equipment-filter-row{grid-template-columns:1fr!important}
      .dm-equipment-metrics-5,.dm-equipment-metrics-6,.dm-equipment-grid-4{grid-template-columns:1fr!important}
      .dm-equipment-utilization{grid-template-columns:1fr!important}
      .dm-equipment-utilization>div:first-child{justify-self:center}
    }
  `;

  return <div className="dm-equipment-profile" style={{display:"flex",flexDirection:"column",gap:12,padding:"0 14px 18px",boxSizing:"border-box",minWidth:0}}><style>{responsiveCss}</style>
    <div style={{background:"rgba(18,25,33,.84)",backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)",border:`1px solid ${C.border}55`,borderRadius:14,overflow:"hidden",boxShadow:"0 18px 45px rgba(0,0,0,.22)"}}>
      <div className="dm-equipment-header" style={{padding:"16px 20px 12px",display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(260px,420px)",gap:18,alignItems:"start"}}>
        <div style={{minWidth:0}}>
          <div style={{fontSize:11,color:C.textMuted,marginBottom:8}}>Inicio &nbsp;›&nbsp; Oficina Técnica &nbsp;›&nbsp; Ficha Única del Equipo</div>
          <div style={{fontSize:13,color:C.textSub,marginBottom:4}}>Ficha Única del Equipo</div>
          <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <strong style={{fontSize:34,lineHeight:1,fontWeight:900,color:C.text,letterSpacing:"-.03em"}}>{detailCode||"Seleccioná un equipo"}</strong>
            {detailCode&&<span style={{fontSize:10,fontWeight:900,color:statusColor,background:`${statusColor}18`,border:`1px solid ${statusColor}55`,borderRadius:7,padding:"5px 8px"}}>{operationalStatus.current}</span>}
          </div>
          {detailCode&&<div style={{marginTop:9,color:C.textSub,fontSize:12,fontWeight:600,display:"flex",gap:8,flexWrap:"wrap"}}>
            <span>{familia||"Equipo"}</span><span>·</span><span>{marca||"Sin marca"}</span><span>·</span><span>{modelo||"Sin modelo"}</span><span>·</span><span style={{color:C.blue}}>{project}</span>
          </div>}
        </div>
        <div className="dm-equipment-filter-panel" style={{display:"flex",flexDirection:"column",gap:9,minWidth:0,width:"100%"}}>
          <div><div style={{fontSize:9,color:C.textMuted,fontWeight:800,marginBottom:4}}>EQUIPO</div><EquipmentPicker options={allCodes} value={selected} onChange={v=>setSelected(cleanEquipmentCode(v))}/></div>
          <div className="dm-equipment-filter-row" style={{display:"grid",gridTemplateColumns:"minmax(145px,1.2fr) minmax(120px,1fr) minmax(120px,1fr) auto",alignItems:"end",gap:8}}>
            <label style={{fontSize:9,color:C.textMuted,fontWeight:800}}>MES<input type="month" value={selectedMonth} onChange={e=>applyOperationalMonth(e.target.value)} onClick={e=>e.currentTarget.showPicker?.()} title="Elegir mes" style={{display:"block",marginTop:4,height:33,boxSizing:"border-box",background:"#151515",border:`1px solid ${C.border}`,color:C.text,borderRadius:8,padding:"0 36px 0 9px",fontSize:11,fontWeight:700,cursor:"pointer",colorScheme:"dark",backgroundImage:'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'18\' height=\'18\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Crect x=\'3\' y=\'5\' width=\'18\' height=\'16\' rx=\'2\'/%3E%3Cline x1=\'16\' y1=\'3\' x2=\'16\' y2=\'7\'/%3E%3Cline x1=\'8\' y1=\'3\' x2=\'8\' y2=\'7\'/%3E%3Cline x1=\'3\' y1=\'11\' x2=\'21\' y2=\'11\'/%3E%3C/svg%3E")',backgroundRepeat:"no-repeat",backgroundPosition:"right 10px center",backgroundSize:"16px 16px"}}/></label>
            <DateIn label="Desde" value={fechaD} onChange={setFechaD}/><DateIn label="Hasta" value={fechaH} onChange={setFechaH}/>
            <button onClick={clearFilters} style={{background:"rgba(255,255,255,.03)",border:`1px solid ${C.border}`,borderRadius:8,color:C.textSub,padding:"7px 10px",fontSize:11,cursor:"pointer",height:33}}>Limpiar</button>
          </div>
        </div>
      </div>
      {detailCode&&<div style={{display:"flex",alignItems:"center",gap:4,padding:"0 14px",borderTop:`1px solid ${C.border}55`,borderBottom:`1px solid ${C.border}55`,overflowX:"auto",background:"rgba(10,16,22,.35)"}}>
        {tabs.map(([id,label])=><button key={id} onClick={()=>setActiveTab(id)} style={{position:"relative",border:0,background:"transparent",color:activeTab===id?C.text:C.textSub,padding:"12px 17px",fontSize:11,fontWeight:activeTab===id?800:600,cursor:"pointer",whiteSpace:"nowrap"}}>{label}{activeTab===id&&<span style={{position:"absolute",height:2,left:10,right:10,bottom:0,background:C.blue,borderRadius:2}}/>}</button>)}
      </div>}
    </div>

    {selectedKey&&activeTab==="resumen"&&<>
      <div className="dm-equipment-metrics dm-equipment-metrics-5" style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:12,minWidth:0}}>
        {compactMetric("Horómetro actual",summary.currentH?`${fmt(summary.currentH)} h`:"—",C.blue,"Último horómetro final registrado en ROP02.",summary.lastOp?.fecha?`Última lectura: ${shortDate(summary.lastOp.fecha)}`:undefined,"hours")}
        {compactMetric("Horas ROP02 (período)",`${fmt(summary.totalHours)} h`,C.teal,"Horas acumuladas del equipo en ROP02 para el período filtrado.",periodLabel,"clock")}
        {compactMetric("Horas productivas",`${fmt(summary.prodHours)} h`,C.green,"Horas productivas registradas en ROP05 para el período filtrado.",summary.totalHours>0?`${fmt(summary.prodHours/summary.totalHours*100)}% del total ROP02`:undefined,"barChart")}
        {compactMetric("Consumo observado",summary.fuelRate>0?`${fmt(summary.fuelRate,2)} L/h`:"—",C.purple,"Combustible registrado dividido por horas ROP02 del período.","Promedio período","fuel")}
        {compactMetric("OT RMA15 (período)",filteredMant.length,C.yellow,"Órdenes RMA15 asociadas al interno dentro del período seleccionado.","Órdenes de trabajo","maintenance")}
      </div>
      <div className="dm-equipment-metrics dm-equipment-metrics-6" style={{display:"grid",gridTemplateColumns:"repeat(6,minmax(0,1fr))",gap:12,minWidth:0}}>
        {compactMetric("Costo insumos RMA15",formatUSDFromARS(summary.maintCostARS,effectiveUsdRate),C.purple,"Suma de insumos RMA15 del período convertida a USD.","Período seleccionado","money")}
        {compactMetric("Costo acumulado",formatUSDNumber(accumulatedCostUSD),C.purple,"Costo histórico acumulado de insumos RMA15 del equipo.","Desde inicio de registros","money")}
        {compactMetric("Costo mant. USD/h",summary.totalHours>0?`USD ${costPerHourUSD.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}/h`:"—",C.purple,"Costo RMA15 del período dividido por las horas ROP02 del mismo período.","Promedio período","money")}
        {compactMetric("Utilización",operationalStatus.utilization==null?"—":`${fmt(operationalStatus.utilization)}%`,operationalStatus.utilization!=null&&operationalStatus.utilization<50?C.red:C.green,"Días con trabajo dividido por días con estado ROP02 dentro del filtro.","Trabajo / días registrados","barChart")}
        {compactMetric("Disponibilidad",operationalStatus.availability==null?"—":`${fmt(operationalStatus.availability)}%`,operationalStatus.availability!=null&&operationalStatus.availability<70?C.red:C.green,"Días Trabajo + OD divididos por días con estado ROP02 dentro del filtro.","Trabajo + OD / registrados","truck")}
        {compactMetric("Último PM",pmInfo.lastH?`${fmt(pmInfo.lastH)} h`:"—",C.blue,pmInfo.lastDate?`Último PM registrado: ${pmInfo.lastDate}`:"No existe base de PM para este equipo.",pmInfo.lastDate?`Realizado: ${shortDate(pmInfo.lastDate)}`:undefined,"maintenance")}
      </div>

      <div className="dm-equipment-summary-grid" style={{display:"grid",gridTemplateColumns:"minmax(0,.9fr) minmax(0,.9fr) minmax(0,1.2fr)",gap:12}}>
        <Card title="Estado actual" tooltip="Último estado ROP02 disponible para el equipo seleccionado."><div style={{padding:"8px 16px 14px"}}>
          {dataRow("Estado operativo",operationalStatus.current,statusColor)}
          {dataRow("Proyecto actual",project,C.blue)}
          {dataRow("Familia",familia)}
          {dataRow("Marca / Modelo",[marca,modelo].filter(Boolean).join(" "))}
          {dataRow("Propiedad",propiedad)}
        </div></Card>
        <Card title="Próximo PM" tooltip="Objetivo de mantenimiento preventivo calculado con el último PM, intervalo configurado y horómetro actual."><div style={{padding:"8px 16px 14px"}}>
          {dataRow("Próximo PM",pmInfo.next?`${fmt(pmInfo.next)} h`:"—",pmInfo.status==="ATRASADO"?C.red:C.text)}
          {dataRow("Faltan / atraso",pmInfo.remaining==null?"—":pmInfo.remaining<0?`${fmt(Math.abs(pmInfo.remaining))} h de atraso`:`${fmt(pmInfo.remaining)} h`,pmInfo.remaining!=null&&pmInfo.remaining<0?C.red:C.green)}
          {dataRow("Periodicidad",`${fmt(pmInfo.interval)} h`)}
          {dataRow("Estado",pmInfo.status,pmInfo.status==="ATRASADO"?C.red:pmInfo.status==="PRÓXIMO"?C.yellow:C.green)}
          <div style={{marginTop:12}}><div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.textMuted,marginBottom:5}}><span>Progreso del intervalo</span><strong style={{color:C.green}}>{fmt(pmProgress)}%</strong></div><div style={{height:6,borderRadius:999,background:"rgba(255,255,255,.08)",overflow:"hidden"}}><div style={{height:"100%",width:`${pmProgress}%`,background:pmProgress>=100?C.red:pmProgress>=80?C.yellow:C.green,borderRadius:999}}/></div></div>
        </div></Card>
        <Card title="Resumen de utilización (período)" tooltip="Distribución de días ROP02 del equipo seleccionado dentro de los filtros activos."><div className="dm-equipment-utilization" style={{padding:"14px 16px",display:"grid",gridTemplateColumns:"150px minmax(0,1fr)",alignItems:"center",gap:18}}>
          <div style={{width:134,height:134,borderRadius:"50%",background:`conic-gradient(${C.green} 0 ${workPct}%, ${C.yellow} ${workPct}% ${workPct+odPct}%, ${C.purple} ${workPct+odPct}% ${workPct+odPct+emPct}%, ${C.red} ${workPct+odPct+emPct}% 100%)`,position:"relative",margin:"0 auto"}}><div style={{position:"absolute",inset:28,borderRadius:"50%",background:"#17212a",display:"grid",placeItems:"center",textAlign:"center"}}><div><strong style={{fontSize:19,color:C.text}}>{totalStateDays}</strong><div style={{fontSize:9,color:C.textMuted}}>días</div></div></div></div>
          <div>{[["Trabajo",operationalStatus.TRABAJO,workPct,C.green],["OD (A disposición)",operationalStatus.OD,odPct,C.yellow],["Mantenimiento (EM)",operationalStatus.EM,emPct,C.purple],["Fuera de servicio (FS)",operationalStatus.FS,fsPct,C.red]].map(([l,n,pct,col])=><div key={l} style={{display:"grid",gridTemplateColumns:"10px minmax(0,1fr) auto",gap:8,alignItems:"center",padding:"5px 0",fontSize:11}}><span style={{width:8,height:8,borderRadius:2,background:col}}/><span style={{color:C.textSub}}>{l}</span><strong>{n} días ({fmt(pct)}%)</strong></div>)}</div>
        </div></Card>
      </div>
      <div className="dm-equipment-grid-4" style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:12,minWidth:0}}>
        {compactMetric("Tarea principal ROP05",rop05Analytics.main?.task||"—",C.green,"Tarea con mayor cantidad de horas productivas en ROP05 dentro del período.",rop05Analytics.main?`${fmt(rop05Analytics.main.horas)} h · ${rop05Analytics.main.registros} registros`:"Sin registros","barChart")}
        {compactMetric("Registros productivos",rop05Analytics.totalRecords,C.teal,"Cantidad total de registros ROP05 del equipo en el período.",`${rop05Analytics.productiveDays} días con productividad`,"list")}
        {compactMetric("Días productivos",rop05Analytics.productiveDays,C.blue,"Días distintos con al menos un registro ROP05.",rop05Analytics.productiveDays?`${fmt(rop05Analytics.avgHoursDay,2)} h/día promedio`:"Sin registros","calendar")}
        {compactMetric("Tarea más frecuente",rop05Analytics.frequent?.task||"—",C.yellow,"Tarea que aparece mayor cantidad de veces en ROP05.",rop05Analytics.frequent?`${rop05Analytics.frequent.registros} registros`:"Sin registros","star")}
      </div>
      <div className="dm-equipment-grid-2" style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)",gap:12}}>
        <Card title="Resumen productivo ROP05" tooltip="Horas productivas acumuladas por las principales tareas del equipo en el período seleccionado."><div style={{height:270,padding:"10px 14px 14px"}}><ResponsiveContainer width="100%" height="100%"><BarChart data={rop05Analytics.top} layout="vertical" margin={{left:18,right:18}}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)"/><XAxis type="number" tick={{fill:C.textMuted,fontSize:10}}/><YAxis type="category" dataKey="task" width={135} tick={{fill:C.textSub,fontSize:10}}/><Tooltip/><Bar dataKey="horas" name="Horas" fill={C.green} radius={[0,6,6,0]}/></BarChart></ResponsiveContainer></div></Card>
        <Card title="Productividad por tarea" tooltip="Consolidado de las principales tareas ROP05. El rendimiento se calcula como cantidad dividida por horas cuando existe una única unidad para la tarea."><div style={{padding:"0 12px 12px"}}><Table tableId="equipment-profile-summary-rop05" cols={rop05TaskCols} rows={rop05TaskRows.slice(0,8)} maxH={270} emptyMsg="Sin productividad para el filtro"/></div></Card>
      </div>

      <div className="dm-equipment-grid-2" style={{display:"grid",gridTemplateColumns:"minmax(0,.8fr) minmax(0,1.2fr)",gap:12}}>
        <Card title="Mantenimiento programado" tooltip="Legajo de PM con último servicio, próximo objetivo y horas restantes calculadas contra el horómetro actual."><div style={{padding:"14px 16px"}}>{dataRow("PM registrados en filtro",filteredPmReg.length)}{dataRow("Último PM",pmInfo.lastDate||"—")}{dataRow("Horómetro último PM",pmInfo.lastH?`${fmt(pmInfo.lastH)} h`:"—")}{dataRow("Próximo PM",pmInfo.next?`${fmt(pmInfo.next)} h`:"—")}{dataRow("Horas desde PM",pmInfo.lastH?`${fmt(pmInfo.since)} h`:"—")}{dataRow("Estado",pmInfo.status,pmInfo.status==="ATRASADO"?C.red:pmInfo.status==="PRÓXIMO"?C.yellow:C.green)}</div></Card>
        <Card title="Evolución de horómetro" tooltip="Evolución del horómetro final registrado en ROP02 dentro del período activo."><div style={{height:300,padding:"10px 14px 14px"}}><ResponsiveContainer width="100%" height="100%"><LineChart data={horometerSeries}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)"/><XAxis dataKey="fecha" tick={{fill:C.textMuted,fontSize:10}}/><YAxis tick={{fill:C.textMuted,fontSize:10}} width={58}/><Tooltip/><Line type="monotone" dataKey="horometro" stroke={C.blue} dot={false} strokeWidth={2}/></LineChart></ResponsiveContainer></div></Card>
      </div>

      <div className="dm-equipment-grid-3" style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:12}}>
        {compactMetric("Costo período",formatUSDFromARS(summary.maintCostARS,effectiveUsdRate),C.purple,"Costo de insumos RMA15 del período seleccionado.",periodLabel,"money")}
        {compactMetric("Costo acumulado",formatUSDNumber(accumulatedCostUSD),C.purple,"Costo histórico acumulado del equipo.","Histórico","money")}
        {compactMetric("Costo mant. USD/h",summary.totalHours>0?`USD ${costPerHourUSD.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}/h`:"—",C.teal,"Costo del período dividido por horas ROP02.","Promedio período","money")}
      </div>
      <Card title="Costo mensual de insumos RMA15 (USD)" tooltip="Suma mensual de insumos RMA15 convertida a USD dentro de los filtros activos."><div style={{height:300,padding:"10px 14px 14px"}}><ResponsiveContainer width="100%" height="100%"><BarChart data={monthlyMaint}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)"/><XAxis dataKey="mes" tick={{fill:C.textMuted,fontSize:10}}/><YAxis tick={{fill:C.textMuted,fontSize:10}} width={86} tickFormatter={v=>`USD ${Number(v||0).toLocaleString("es-AR",{maximumFractionDigits:0})}`}/><Tooltip content={<Rma15UsdTooltip/>}/><Bar dataKey="costo" name="Costo" fill={C.purple} radius={[6,6,0,0]}/></BarChart></ResponsiveContainer></div></Card>

      <div style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:8,background:"rgba(29,78,216,.10)",border:"1px solid rgba(96,165,250,.20)",borderRadius:10,color:C.textSub,fontSize:10}}><Icon name="info" size={14} color={C.blue}/>Los datos mostrados corresponden al período seleccionado en la ficha: <strong style={{color:C.text}}>{periodLabel}</strong>.</div>
    </>}

    {selectedKey&&activeTab==="rop02"&&<Card title={`Historial ROP02 (${filteredOp.length})`} tooltip="Partes operativos del equipo dentro de los filtros activos."><div style={{padding:"0 12px 12px"}}><Table tableId="equipment-profile-rop02" cols={rop02Cols} rows={rop02Rows} maxH={560} emptyMsg="Sin ROP02 para el filtro"/></div></Card>}
    {selectedKey&&activeTab==="rop05"&&<>
      <div className="dm-equipment-grid-4" style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:12,minWidth:0}}>
        {compactMetric("Tarea principal",rop05Analytics.main?.task||"—",C.green,"Tarea con mayor cantidad de horas productivas en el período.",rop05Analytics.main?`${fmt(rop05Analytics.main.horas)} h acumuladas`:"Sin registros","barChart")}
        {compactMetric("Horas productivas",`${fmt(rop05Analytics.totalHours)} h`,C.teal,"Horas productivas acumuladas en ROP05 para el filtro activo.",periodLabel,"clock")}
        {compactMetric("Días productivos",rop05Analytics.productiveDays,C.blue,"Cantidad de días distintos con registros de productividad.",rop05Analytics.productiveDays?`${fmt(rop05Analytics.avgHoursDay,2)} h/día promedio`:"Sin registros","calendar")}
        {compactMetric("Registros ROP05",rop05Analytics.totalRecords,C.yellow,"Cantidad de partes de productividad del equipo en el período.",rop05Analytics.frequent?`Más frecuente: ${rop05Analytics.frequent.task}`:"Sin registros","list")}
      </div>
      <div className="dm-equipment-grid-2" style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)",gap:12}}>
        <Card title="Horas productivas por tarea" tooltip="Ranking de tareas por horas productivas acumuladas en ROP05."><div style={{height:300,padding:"10px 14px 14px"}}><ResponsiveContainer width="100%" height="100%"><BarChart data={rop05Analytics.top} layout="vertical" margin={{left:18,right:18}}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)"/><XAxis type="number" tick={{fill:C.textMuted,fontSize:10}}/><YAxis type="category" dataKey="task" width={135} tick={{fill:C.textSub,fontSize:10}}/><Tooltip/><Bar dataKey="horas" name="Horas" fill={C.green} radius={[0,6,6,0]}/></BarChart></ResponsiveContainer></div></Card>
        <Card title="Detalle de productividad por tarea" tooltip="Consolida registros, horas, cantidad y rendimiento por tarea. El rendimiento sólo se muestra cuando la tarea usa una única unidad."><div style={{padding:"0 12px 12px"}}><Table tableId="equipment-profile-rop05-task-summary" cols={rop05TaskCols} rows={rop05TaskRows} maxH={300} emptyMsg="Sin productividad para el filtro"/></div></Card>
      </div>
      <Card title={`Historial ROP05 (${filteredProd.length})`} tooltip="Detalle de todos los registros de productividad del equipo dentro de los filtros activos."><div style={{padding:"0 12px 12px"}}><Table tableId="equipment-profile-rop05" cols={rop05Cols} rows={rop05Rows} maxH={480} emptyMsg="Sin ROP05 para el filtro"/></div></Card>
    </>}
    {selectedKey&&activeTab==="rma15"&&<Card title={`Historial RMA15 (${filteredMant.length})`} tooltip="Órdenes de mantenimiento e insumos asociados al equipo dentro del período filtrado."><div style={{padding:"0 12px 12px"}}><Table tableId="equipment-profile-rma15" cols={cols} rows={rows} maxH={560} emptyMsg="Sin mantenimientos RMA15 para este equipo"/></div></Card>}
    {selectedKey&&activeTab==="historial"&&<div className="dm-equipment-grid-2" style={{display:"grid",gridTemplateColumns:"minmax(0,.8fr) minmax(0,1.2fr)",gap:12}}><Card title="Datos de Lista Maestra" tooltip="Datos maestros y comerciales del equipo."><div style={{padding:"8px 16px 14px"}}>{dataRow("Marca",marca)}{dataRow("Modelo",modelo)}{dataRow("Familia",familia)}{dataRow("Propiedad",propiedad)}{dataRow("Proyecto actual",project,C.blue)}{dataRow("Costo adquisición USD",acquisition)}{dataRow("Tarifa alquiler mensual",rent)}{dataRow("N° serie",pick(master||{},["N de serie","N° de serie","Numero de serie"]))}{dataRow("Año",pick(master||{},["Año de fabricacion","Año fabricacion"]))}</div></Card><Card title="Historial de movimientos entre proyectos" tooltip="Se detecta un movimiento cuando el proyecto informado en ROP02 cambia respecto del registro anterior."><div style={{padding:"0 12px 12px"}}><Table tableId="equipment-profile-movements" cols={movementCols} rows={projectMovements} maxH={460} emptyMsg="No se detectaron cambios de proyecto"/></div></Card></div>}
  </div>;
}

export default React.memo(EquipmentProfileView);
