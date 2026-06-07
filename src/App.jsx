import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, Legend } from "recharts";

const LOGO="data:image/png;base64,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";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwKaZwRXWUdSGq1sbgwoIlwy7-cWA2h7HMsiMxsPUQm754S9fs7p34hc6_wntt49nKgew/exec";

// ─── Máquinas excluidas (camionetas, camiones, auxiliares) ────────────────────
const EXCLUDED_TYPES = new Set([
  "CAMIONETA","CAMION CISTERNA","CAMION","CAMION REGADOR","CAMION VOLCADOR",
  "GRUPO ELECTROGENO","GENERADOR","CAT-GENERADOR","GENERADOR CAT",
  "PREDIO","CONTENEDOR","OXICORTE","PERTIGA","TALLER DELTA","PREDIO DELTA",
  "N/A","OFICINA","REORGANIZACION","REPARACION","TALLER",
]);
const MACHINE_TYPE_MAP = {
  "1088":"PERTIGA",
  "AG201HG":"CAMIONETA","AG201HO":"CAMIONETA","AG458MM":"CAMIONETA",
  "AG575LJ":"CAMIONETA","AG575MX":"CAMIONETA","AG469HA":"CAMIONETA",
  "AG600JG":"CAMIONETA","AH045UV":"CAMIONETA","AH106YK":"CAMIONETA",
  "AH619FB":"CAMIONETA","CTA-0848":"CAMIONETA","CTA-1267":"CAMIONETA",
  "CTA0848":"CAMIONETA","CTA-0451":"CAMIONETA","CTA-0541":"CAMIONETA",
  "CTA-0787":"CAMIONETA","CTA-0825":"CAMIONETA","CTA-0879":"CAMIONETA",
  "CTA-0888":"CAMIONETA","CTA-1067":"CAMIONETA","CTA-1131":"CAMIONETA",
  "CTA-1410":"CAMIONETA","CTA-1411":"CAMIONETA","CTA-1418":"CAMIONETA",
  "CTA-1435":"CAMIONETA",
  "AG611LL":"CAMION CISTERNA","AG661LL":"CAMION CISTERNA",
  "AG816QB":"CAMION CISTERNA","AG818QB":"CAMION CISTERNA",
  "CAMION CISTERNA":"CAMION",
  "CAA-0002":"CAMION REGADOR","CAR-0073":"CAMION REGADOR",
  "CAR-0089":"CAMION REGADOR","CAR-0101":"CAMION REGADOR",
  "CAT-0073":"CAMION",
  "CAV-0078":"CAMION VOLCADOR","CAV-0114":"CAMION VOLCADOR",
  "CATERPILLAR":"GENERADOR","CAT":"GRUPO ELECTROGENO",
  "CX21067":"GRUPO ELECTROGENO","DE-169":"GRUPO ELECTROGENO","DE169":"GENERADOR CAT",
  "DELTA":"PREDIO","N/A":"PREDIO FILO EN BATIDERO",
  "OFICINA":"CONTENEDOR","PREDIO DELTA":"CONTENEDOR",
  "REORGANIZACION":"OXICORTE","REPARACION":"PERTIGA","TALLER":"PREDIO DELTA",
  "PCA-0081":"PALA CARGADORA","PCA-0093":"PALA CARGADORA","PCA-095":"PALA CARGADORA","CFN-0101":"PALA CARGADORA",
  "EXC-0005":"EXCAVADORA","EXC-0034":"EXCAVADORA","EXC-0048":"EXCAVADORA","EXC-0055":"EXCAVADORA",
  "MNC-001":"MINICARGADORA","MNC-FDS-001":"MINICARGADORA","MCA-0005":"MINICARGADORA",
  "MOT-0014":"MOTONIVELADORA","MOT-0047":"MOTONIVELADORA","MOT-0079":"MOTONIVELADORA",
  "MOT-0021":"PALA CARGADORA","MOT-0024":"MOTONIVELADORA","MOT-0049":"MOTONIVELADORA",
  "MOT-0051":"MOTONIVELADORA","MOT-0069":"MOTONIVELADORA",
  "ROD-0001":"VIBROCOMPACTADOR","RPC-0039":"VIBROCOMPACTADOR",
  "RCP-0016":"COMPACTADOR","RCP-0036":"COMPACTADOR",
  "RPC-0016":"BIBRO COMPACTADOR","RPC-0036":"BIBRO COMPACTADOR",
  "RTP-0016":"RETROPALA","RTP-0011":"RETROPALA","RTP-0012":"RETROPALA","RTP-0018":"RETROPALA","RTP-0030":"RETROPALA",
  "TOP-0032":"TOPADOR","TOP-0022":"TOPADOR","TOP-0036-JM":"TOPADOR","TOP-0051":"TOPADOR","TOP-0059":"TOPADOR",
  "TOP-0014":"TOPADORA","TOP-0036":"TOPADORA","TOP-0048":"TOPADORA","TOP-0067":"TOPADORA",
  "PCA-0017":"PALA CARGADORA","PCA-0021":"PALA CARGADORA","PCA-0040":"PALA CARGADORA",
  "PCA-0051":"CARGADORA","PCA-0070":"PALA CARGADORA","PCA-0074":"PALA CARGADORA",
  "PCA-0101":"PALA CARGADORA","PCA-021":"PALA CARGADORA","PCA-051":"PALA CARGADORA",
};
function normalizeMachineCode(code){
  return String(code||"").replace(/\s*\(.*?\)/g,"").replace(/[-_\/\s]+JM$/i,"").trim().toUpperCase();
}
function getMachineType(maquina){
  return MACHINE_TYPE_MAP[normalizeMachineCode(maquina)]||null;
}
function isExcluded(maquina){
  const raw=String(maquina||"").trim().toUpperCase();
  const norm=normalizeMachineCode(raw);
  // Probar ambas variantes: con y sin sufijo -JM
  const toCheck=[norm, raw];
  for(const c of toCheck){
    // Camionetas CTA-* (con o sin guion, con o sin -JM)
    if(/^CTA/.test(c))return true;
    // Patentes argentinas AG + número (AG611LL, AG201HG, etc.)
    if(/^AG[0-9]/.test(c))return true;
    // Patentes AH + número
    if(/^AH[0-9]/.test(c))return true;
    // Camiones regadores, volcadores, cisternas
    if(/^CAR/.test(c))return true;
    if(/^CAV/.test(c))return true;
    if(/^CAA/.test(c))return true;
    if(/^AG[0-9A-Z]{5,}$/.test(c))return true; // patentes largas AG*
    // Camión CAT con número
    if(/^CAT-[0-9]/.test(c))return true;
    // Lookup en el mapa
    const t=MACHINE_TYPE_MAP[c]||null;
    if(t){
      const tu=t.toUpperCase();
      for(const e of EXCLUDED_TYPES){if(tu.includes(e)||e.includes(tu))return true;}
    }
  }
  return false;
}

// ─── Colores ──────────────────────────────────────────────────────────────────
const C={
  bg:"#0d0d0d",surface:"#161616",card:"#1c1c1c",border:"#2a2a2a",borderLight:"#333333",
  accent:"#e8001d",accentDim:"rgba(232,0,29,0.12)",
  teal:"#cc0018",tealDim:"rgba(204,0,24,0.12)",
  blue:"#ff3347",blueDim:"rgba(255,51,71,0.12)",
  purple:"#ff6b6b",purpleDim:"rgba(255,107,107,0.12)",
  red:"#e8001d",redDim:"rgba(232,0,29,0.12)",
  yellow:"#ffaa00",yellowDim:"rgba(255,170,0,0.12)",
  green:"#22c55e",greenDim:"rgba(34,197,94,0.12)",
  text:"#f0f0f0",textMuted:"#666666",textSub:"#999999",
};
const PIE_COLORS=[C.accent,C.teal,C.blue,C.purple,C.green,C.yellow,C.red];
const STYLES=`
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'DM Sans',sans-serif;background:${C.bg};color:${C.text};-webkit-font-smoothing:antialiased}
  ::-webkit-scrollbar{width:5px;height:5px}
  ::-webkit-scrollbar-track{background:${C.surface}}
  ::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  .fade-in{animation:fadeIn .3s ease forwards}
  .spin{animation:spin 1s linear infinite}
  input[type=date]::-webkit-calendar-picker-indicator{filter:invert(.5);cursor:pointer}
  select option{background:${C.surface};color:${C.text}}
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtNum(n){return(n||0).toLocaleString("es-AR",{maximumFractionDigits:1});}
function fmtPct(n){return`${n}%`;}
function uniq(arr){const s=new Set();const r=[];for(const v of arr){const c=typeof v==="string"?v.trim():v;if(c&&!s.has(c)){s.add(c);r.push(c);}}return r.sort();}
function semaforo(pct){
  if(pct>=90)return{color:C.green,label:"ÓPTIMO",dim:C.greenDim};
  if(pct>=70)return{color:C.yellow,label:"ATENCIÓN",dim:C.yellowDim};
  return{color:C.red,label:"CRÍTICO",dim:C.redDim};
}
function cleanKey(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLowerCase();}
function getValue(row,keys){
  const rk=Object.keys(row||{});const wk=keys.map(cleanKey);
  for(const k of rk){if(wk.includes(cleanKey(k)))return row[k];}
  for(const k of rk){const nk=cleanKey(k);if(wk.some(w=>nk.includes(w)||w.includes(nk)))return row[k];}
  return"";
}
function toNumber(v){
  if(v===null||v===undefined||v==="")return 0;
  return parseFloat(String(v).replace(",",".").replace(/[^\d.-]/g,"").trim())||0;
}
function normDate(d){
  if(!d)return"";const t=String(d).trim();
  const m1=t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(m1)return`${m1[3]}-${m1[2].padStart(2,"0")}-${m1[1].padStart(2,"0")}`;
  const m2=t.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m2)return t.slice(0,10);
  const p=new Date(t);if(!Number.isNaN(p.getTime()))return p.toISOString().slice(0,10);
  return"";
}
function cleanMachine(v){
  return String(v||"").trim().toUpperCase().replace(/\s+/g,"-")
    .replace(/([A-Z]{3})-?(\d+)/,(_,a,n)=>`${a}-${String(n).padStart(4,"0")}`);
}
function detectEstado(trabajo,obs,hs){
  // La fuente de verdad es la columna Cant. Hs.:
  // "FS" o "FUERA DE SERVICIO" → FS
  // "OD" u "ORDEN DEL DIA" → OD (Operativo a Disposición)
  // cualquier número (o vacío) → TRABAJO efectivo
  const hsStr=String(hs||"").trim().toUpperCase();
  if(/\bFS\b/.test(hsStr)||hsStr.includes("FUERA DE SERVICIO"))return"FS";
  if(/\bOD\b/.test(hsStr)||hsStr.includes("ORDEN DEL DIA")||hsStr.includes("ORDEN DEL DÍA"))return"OD";
  return"TRABAJO";
}
// Normaliza nombres de proyecto: VICUÑA y sus variantes → FILO DEL SOL
function normProject(raw){
  const p=String(raw||"").replace(/\s+/g," ").trim().toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  if(p.includes("VICU")||p.includes("FILO"))return"FILO DEL SOL";
  if(p.includes("JOSE")||p.includes("MARIA")||p.includes("JM"))return"JOSE MARIA";
  return p||"S/D";
}
// Filtro facetado: byFecha filtrado por todos los demás selectores excepto el propio
function facetOpts(byFecha,key,others){
  return uniq(byFecha.filter(r=>others.every(([k,v,def])=>v===def||r[k]===v)).map(r=>r[key]));
}
// Filtro de fecha genérico
function byDateFilter(rows,mode,fecha,fechaD,fechaH){
  // Sin filtro de fecha activo: devolver todo sin iterar
  if(mode==="dia"&&!fecha)return rows;
  if(mode==="periodo"&&!fechaD&&!fechaH)return rows;
  return rows.filter(r=>{
    const f=r.fecha||"";
    if(mode==="dia")return f===fecha;
    if(fechaD&&f<fechaD)return false;
    if(fechaH&&f>fechaH)return false;
    return true;
  });
}

// ─── Normalización ────────────────────────────────────────────────────────────
function normalizeROP02(rows,proyectoDefault){
  return(rows||[]).map(r=>{
    const trabajo=String(r["Descripción de los trabajos realizados"]||"").trim();
    const obs=String(r["Observaciones"]||"").trim();
    return{
      fecha:normDate(r["Fecha"]),maquina:cleanMachine(r["Interno"]),
      operario:String(r["Operador"]||"").trim(),supervisor:String(r["Supervisor Delta"]||"").trim(),
      supervisorCliente:String(r["Supervisor Vial Cliente"]||"").trim(),
      turno:String(r["Turno de trabajo"]||"").trim(),parte:String(r["N° Parte"]||"").trim(),
      proyecto:normProject(r["Proyecto"]||proyectoDefault),
      horometroInicial:toNumber(r["Horómetro inicial"]),horometroFinal:toNumber(r["Horómetro final"]),
      horas:toNumber(r["Cant. Hs."]),combustible:toNumber(r["Combustible"]),
      aceite:String(r["Aceite"]||"").trim(),tipo_trabajo:trabajo,
      desgaste:String(r["Información sobre Desgaste"]||"").trim(),observaciones:obs,
      estado:detectEstado(trabajo,obs,r["Cant. Hs."]),
    };
  }).filter(r=>r.fecha&&r.maquina);
}
function normalizeROP05(rows){
  return(rows||[]).map(r=>{
    const tarea=String(r["Tarea"]||r["TAREAS PRODUCTIVAS CON TOPADORAS"]||r["TAREAS PRODUCTIVAS CON EXCAVADORAS"]||r["TAREAS PRODUCTIVAS CON CARGADORA FRONTAL"]||r["TAREAS PRODUCTIVAS CON MOTONIVELADORA"]||r["TAREAS PRODUCTIVAS CON RETROPALA"]||"").trim();
    const cantHs=getValue(r,["CANTIDAD DE HS PRODUCTIVAS EFECTIVAS\n(SOLO CANTIDAD)","CANTIDAD DE HS PRODUCTIVAS EFECTIVAS (SOLO CANTIDAD)","HS PRODUCTIVAS EFECTIVAS","Horas","Hs"]);
    const cantProd=getValue(r,["CANTIDAD DE PRODUCCIÓN DE LA TAREA REALIZADA\n(SIN UNIDADES DE MEDIDA)","CANTIDAD DE PRODUCCION DE LA TAREA REALIZADA (SIN UNIDADES DE MEDIDA)","CANTIDAD DE PRODUCCIÓN","CANTIDAD DE PRODUCCION","Cantidad"]);
    return{
      fecha:normDate(r["Fecha del Parte Diario"]||r["Marca Tmeporal"]||r["Marca Temporal"]),
      maquina:cleanMachine(r["Codigo Int"]),
      tipo_maquina:String(r["Tipo de máquina"]||r["Tipo de maquina"]||"").trim(),
      tarea,horas:toNumber(cantHs),cantidad:toNumber(cantProd),
      unidad:String(r["UNIDAD DE PRODUCTIVIDAD"]||"").trim().toUpperCase(),
      proyecto:normProject(r["Proyecto"]),
      supervisor:String(r["Supervisor"]||"").trim(),
      parte:String(r["N° de Parte"]||"").trim(),
      grupo:String(r["Grupo de trabajo"]||"").trim(),
      observaciones:String(getValue(r,["OBSERVACION DE LA TAREA","Observacion","Observación"])||"").trim(),
    };
  }).filter(r=>r.fecha&&r.maquina);
}
function esNoProductivo(e){const s=String(e||"").toUpperCase();return s==="FS"||s==="OD"||s.includes("FUERA")||s.includes("OTRO");}
function calcControl(rop02All,rop05){
  const productivos=(rop02All||[]).filter(r=>!esNoProductivo(r.estado)&&!isExcluded(r.maquina));
  const prod05=(rop05||[]).filter(r=>!isExcluded(r.maquina));
  const key=r=>`${r.fecha}__${r.maquina}`;
  const set05=new Set(prod05.map(key));const set02=new Set(productivos.map(key));
  const faltanEn05=productivos.filter(r=>!set05.has(key(r)));
  const faltanEn02=prod05.filter(r=>!set02.has(key(r)));
  const total=productivos.length+prod05.length;
  const problemas=faltanEn05.length+faltanEn02.length;
  const consistencia=total>0?Math.round(((total-problemas)/total)*100):100;
  return{faltanEn05,faltanEn02,consistencia,total,problemas,productivos,prod05};
}

// ─── Íconos ───────────────────────────────────────────────────────────────────
const PATHS={
  dashboard:"M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z",
  parts:"M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 15h8v2H8zm0-4h8v2H8zm0-4h5v2H8z",
  prod:"M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z",
  control:"M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
  refresh:"M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z",
  warn:"M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z",
  check:"M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
  hours:"M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm.5 5v5.25l4.5 2.67-.75 1.23L11 13V7h1.5z",
  fuel:"M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33 0 1.38 1.12 2.5 2.5 2.5.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v16h10v-7.5h1.5v5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V9c0-.69-.28-1.32-.73-1.77z",
  equip:"M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm13.5-1c0 .55-.45 1-1 1s-1-.45-1-1 .45-1 1-1 1 .45 1 1z",
  alert:"M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z",
  consist:"M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z",
  menu:"M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z",
  close:"M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
  wear:"M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z",
  filter:"M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z",
};
function Icon({name,size=18,color="currentColor",style}){
  const p=PATHS[name];if(!p)return null;
  return<svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={style}><path d={p}/></svg>;
}
function Spinner({size=24}){return<div className="spin" style={{width:size,height:size,border:`2px solid ${C.border}`,borderTop:`2px solid ${C.accent}`,borderRadius:"50%"}}/>;}
function Badge({children,color=C.accent}){return<span style={{display:"inline-block",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:600,color,background:color+"22",border:`1px solid ${color}33`}}>{children}</span>;}
function StatCard({icon,value,label,sub,color=C.accent,valueColor,small}){
  const valCol=valueColor||color;
  return(
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:small?"12px 14px":"16px 18px",display:"flex",flexDirection:"column",gap:5,position:"relative",overflow:"hidden",boxShadow:`0 0 24px ${color}0d`}}>
      <div style={{position:"absolute",top:-8,right:-8,width:56,height:56,background:color+"15",borderRadius:"50%"}}/>
      <div style={{display:"flex",alignItems:"center",gap:7}}>
        <div style={{background:color+"20",borderRadius:7,padding:5,display:"flex"}}><Icon name={icon} size={14} color={color}/></div>
        <span style={{fontSize:11,color:C.textSub,fontWeight:500}}>{label}</span>
      </div>
      <div style={{fontFamily:"Syne,sans-serif",fontSize:small?20:26,fontWeight:800,color:valCol,lineHeight:1}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:C.textMuted}}>{sub}</div>}
    </div>
  );
}
function Card({children,style,title,action}){
  return(
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden",...style}}>
      {title&&<div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontFamily:"Syne",fontWeight:700,fontSize:13,color:C.text}}>{title}</span>
        {action}
      </div>}
      {children}
    </div>
  );
}
function Table({cols,rows,maxH=380,emptyMsg="Sin datos"}){
  const ROW_H=36;
  const[scrollTop,setScrollTop]=useState(0);
  const onScroll=useCallback(e=>setScrollTop(e.target.scrollTop),[]);

  // Todos los hooks antes de cualquier return condicional
  const bufferRows=8;
  const visibleCount=Math.ceil(maxH/ROW_H);
  const startIdx=Math.max(0,Math.floor(scrollTop/ROW_H)-bufferRows);
  const endIdx=Math.min(rows.length,startIdx+visibleCount+bufferRows*2);
  const visibleRows=rows.slice(startIdx,endIdx);
  const offsetY=startIdx*ROW_H;

  if(rows.length===0)return(
    <div style={{padding:"28px",textAlign:"center",color:C.textMuted,fontSize:12}}>{emptyMsg}</div>
  );
  return(
    <div onScroll={onScroll} style={{overflowX:"auto",overflowY:"auto",maxHeight:maxH}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead><tr>{cols.map((c,i)=><th key={i} style={{padding:"9px 12px",textAlign:"left",position:"sticky",top:0,zIndex:1,background:C.surface,color:C.textSub,fontWeight:600,fontSize:10,letterSpacing:".06em",textTransform:"uppercase",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{c.label}</th>)}</tr></thead>
        <tbody>
          {offsetY>0&&<tr style={{height:offsetY}}><td colSpan={cols.length} style={{padding:0,border:"none"}}/></tr>}
          {visibleRows.map((r,i)=>{
            const absI=startIdx+i;
            return(
              <tr key={absI} style={{background:absI%2===0?"transparent":C.surface+"66",height:ROW_H}}>
                {cols.map((c,j)=><td key={j} style={{padding:"8px 12px",borderBottom:`1px solid ${C.border}18`,color:C.text,whiteSpace:c.wrap?"normal":"nowrap",overflow:"hidden",maxWidth:c.wrap?undefined:300}}>{c.render?c.render(r[c.key],r):(r[c.key]??"—")}</td>)}
              </tr>
            );
          })}
          {endIdx<rows.length&&<tr style={{height:(rows.length-endIdx)*ROW_H}}><td colSpan={cols.length} style={{padding:0,border:"none"}}/></tr>}
        </tbody>
      </table>
    </div>
  );
}
function Sel({label,value,onChange,options}){
  // Si el valor actual no existe en las opciones, caer al default (primera opción)
  const safeValue=options.some(o=>o.value===value)?value:(options[0]?.value??value);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:3}}>
      <label style={{fontSize:10,color:C.textMuted,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase"}}>{label}</label>
      <select value={safeValue} onChange={e=>onChange(e.target.value)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,padding:"7px 10px",fontSize:12,cursor:"pointer",outline:"none",minWidth:120}}>
        {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
function DateIn({label,value,onChange}){
  return(
    <div style={{display:"flex",flexDirection:"column",gap:3}}>
      <label style={{fontSize:10,color:C.textMuted,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase"}}>{label}</label>
      <input type="date" value={value} onChange={e=>onChange(e.target.value)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,padding:"7px 10px",fontSize:12,outline:"none"}}/>
    </div>
  );
}
function ChartTip({active,payload,label}){
  if(!active||!payload?.length)return null;
  return(
    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",fontSize:12}}>
      {label&&<div style={{color:C.textSub,marginBottom:4,fontWeight:600,fontSize:11}}>{label}</div>}
      {payload.map((p,i)=><div key={i} style={{color:p.color||C.accent,fontWeight:600}}>{p.name}: {fmtNum(p.value)}</div>)}
    </div>
  );
}
function TabBtn({active,onClick,children}){return<button onClick={onClick} style={{padding:"7px 14px",borderRadius:7,border:"none",cursor:"pointer",background:active?C.accent:C.surface,color:active?"#fff":C.textSub,fontFamily:"DM Sans",fontWeight:600,fontSize:12,transition:"all .2s"}}>{children}</button>;}
function SubTab({active,onClick,children}){return<button onClick={onClick} style={{padding:"7px 0",border:"none",background:"none",cursor:"pointer",color:active?C.accent:C.textSub,fontFamily:"DM Sans",fontWeight:600,fontSize:12,borderBottom:`2px solid ${active?C.accent:"transparent"}`,transition:"all .15s",marginRight:18}}>{children}</button>;}
function AlertBanner({type="warn",children}){
  const m={warn:[C.yellow,C.yellowDim],error:[C.red,C.redDim],success:[C.green,C.greenDim],info:[C.blue,C.blueDim]};
  const[col,bg]=m[type]||m.warn;
  return<div style={{display:"flex",alignItems:"flex-start",gap:8,padding:"10px 14px",background:bg,border:`1px solid ${col}44`,borderRadius:9,fontSize:12,color:C.text}}><Icon name="warn" size={14} color={col} style={{flexShrink:0,marginTop:1}}/><span>{children}</span></div>;
}

// ─── fetchAll ─────────────────────────────────────────────────────────────────
async function fetchAll(url){
  const res=await fetch(`${url}?action=all`);
  if(!res.ok)throw new Error(`HTTP ${res.status} desde el Apps Script`);
  const text=await res.text();
  let json;
  try{json=JSON.parse(text);}catch(e){throw new Error("El Apps Script devolvió HTML. Verificá que esté publicado como 'Cualquier persona'.");}
  if(!json.ok&&!json.sources)throw new Error(json.error?.message||"Respuesta inválida del Apps Script");
  return json;
}

// ─── ViewDashboard ────────────────────────────────────────────────────────────
function ViewDashboard({rop02All,rop05,control}){
  const[proyecto,setProyecto]=useState("todos");

  // Proyectos disponibles
  const proyectos=useMemo(()=>uniq(rop02All.map(r=>r.proyecto)),[rop02All]);

  // Base filtrada por proyecto
  const r02f=useMemo(()=>proyecto==="todos"?rop02All:rop02All.filter(r=>r.proyecto===proyecto),[rop02All,proyecto]);
  const r05f=useMemo(()=>proyecto==="todos"?rop05:rop05.filter(r=>r.proyecto===proyecto),[rop05,proyecto]);

  // Excluye camionetas/camiones de TODOS los cálculos del dashboard
  const r02prod=useMemo(()=>r02f.filter(r=>!isExcluded(r.maquina)),[r02f]);
  const totalHoras=useMemo(()=>r02prod.reduce((s,r)=>s+r.horas,0),[r02prod]);
  const totalComb=useMemo(()=>r02prod.reduce((s,r)=>s+r.combustible,0),[r02prod]);
  const totalProd=useMemo(()=>r05f.reduce((s,r)=>s+r.cantidad,0),[r05f]);
  const totalEquipos=useMemo(()=>uniq(r02prod.map(r=>r.maquina)).length,[r02prod]);

  // Top 10 equipos con info enriquecida para tooltip
  const topEquipos=useMemo(()=>{
    const m={};
    r02prod.forEach(r=>{
      if(!m[r.maquina])m[r.maquina]={horas:0,proyectos:new Set(),tipo:getMachineType(r.maquina)||""};
      m[r.maquina].horas+=r.horas;
      if(r.proyecto)m[r.maquina].proyectos.add(r.proyecto);
    });
    return Object.entries(m).sort((a,b)=>b[1].horas-a[1].horas).slice(0,10).map(([name,d])=>({
      name,horas:d.horas,
      proyectos:[...d.proyectos].join(" / "),
      tipo:d.tipo,
    }));
  },[r02prod]);

  // Top 8 operarios con info enriquecida para tooltip
  const topOps=useMemo(()=>{
    const m={};
    r02prod.filter(r=>r.operario).forEach(r=>{
      if(!m[r.operario])m[r.operario]={horas:0,proyectos:new Set(),maquinas:new Set()};
      m[r.operario].horas+=r.horas;
      if(r.proyecto)m[r.operario].proyectos.add(r.proyecto);
      if(r.maquina)m[r.operario].maquinas.add(r.maquina);
    });
    return Object.entries(m).sort((a,b)=>b[1].horas-a[1].horas).slice(0,8).map(([fullName,d])=>({
      name:fullName.split(" ")[0],
      fullName,
      horas:d.horas,
      proyectos:[...d.proyectos].join(" / "),
      maquinas:[...d.maquinas].sort().join(", "),
    }));
  },[r02prod]);

  // Producción por unidad (ROP05 no incluye camionetas/camiones por definición)
  const prodUnit=useMemo(()=>{const m={};r05f.forEach(r=>{if(r.unidad)m[r.unidad]=(m[r.unidad]||0)+r.cantidad;});return Object.entries(m).map(([name,value])=>({name,value}));},[r05f]);
  // Top 10 tareas más realizadas en ROP05
  const topTareas=useMemo(()=>{
    const m={};
    r05f.filter(r=>r.tarea&&r.tarea.trim()!=="").forEach(r=>{m[r.tarea]=(m[r.tarea]||0)+1;});
    const total=Object.values(m).reduce((s,v)=>s+v,0);
    return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,10)
      .map(([name,count])=>({name:name.length>34?name.slice(0,32)+"…":name,count,pct:total>0?Math.round((count/total)*100):0}));
  },[r05f]);
  // Horas por proyecto: solo equipos productivos
  const horasProy=useMemo(()=>{const m={};r02prod.forEach(r=>{const p=r.proyecto||"S/D";m[p]=(m[p]||0)+r.horas;});return Object.entries(m).map(([name,value])=>({name,value}));},[r02prod]);
  // KPIs nuevos: horas promedio/día, equipos en FS, días OD
  const horasPromDia=useMemo(()=>{
    const fechas=uniq(r02prod.map(r=>r.fecha));
    return fechas.length>0?Math.round(totalHoras/fechas.length):0;
  },[r02prod,totalHoras]);
  const equiposFS=useMemo(()=>uniq(r02f.filter(r=>r.estado==="FS"&&!isExcluded(r.maquina)).map(r=>r.maquina)).length,[r02f]);
  const diasOperativos=useMemo(()=>uniq(r02prod.filter(r=>r.estado==="TRABAJO").map(r=>r.fecha)).length,[r02prod]);
  const diasOD=useMemo(()=>uniq(r02f.filter(r=>r.estado==="OD"&&!isExcluded(r.maquina)).map(r=>r.fecha)).length,[r02f]);
  const sem=semaforo(control.consistencia);

  // Tooltips custom
  const TooltipEquipo=({active,payload})=>{
    if(!active||!payload?.length)return null;
    const d=payload[0].payload;
    return(
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",fontSize:12,minWidth:180,boxShadow:"0 4px 20px rgba(0,0,0,.4)"}}>
        <div style={{fontFamily:"Syne",fontWeight:800,fontSize:14,color:C.accent,marginBottom:6}}>{d.name}</div>
        {d.tipo&&<div style={{color:C.textSub,fontSize:11,marginBottom:4}}>{d.tipo}</div>}
        <div style={{display:"flex",justifyContent:"space-between",gap:16,marginBottom:4}}>
          <span style={{color:C.textMuted,fontSize:11}}>Horas totales</span>
          <span style={{color:C.text,fontWeight:700}}>{fmtNum(d.horas)}</span>
        </div>
        {d.proyectos&&<div style={{display:"flex",justifyContent:"space-between",gap:16}}>
          <span style={{color:C.textMuted,fontSize:11}}>Proyecto</span>
          <span style={{color:C.accent,fontWeight:600,fontSize:11}}>{d.proyectos}</span>
        </div>}
      </div>
    );
  };

  const TooltipOperario=({active,payload})=>{
    if(!active||!payload?.length)return null;
    const d=payload[0].payload;
    return(
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",fontSize:12,minWidth:200,boxShadow:"0 4px 20px rgba(0,0,0,.4)"}}>
        <div style={{fontFamily:"Syne",fontWeight:800,fontSize:14,color:C.purple,marginBottom:6}}>{d.fullName||d.name}</div>
        <div style={{display:"flex",justifyContent:"space-between",gap:16,marginBottom:4}}>
          <span style={{color:C.textMuted,fontSize:11}}>Horas totales</span>
          <span style={{color:C.text,fontWeight:700}}>{fmtNum(d.horas)}</span>
        </div>
        {d.proyectos&&<div style={{display:"flex",justifyContent:"space-between",gap:16,marginBottom:4}}>
          <span style={{color:C.textMuted,fontSize:11}}>Proyecto</span>
          <span style={{color:C.accent,fontWeight:600,fontSize:11}}>{d.proyectos}</span>
        </div>}
        {d.maquinas&&<div style={{display:"flex",flexDirection:"column",gap:2,marginTop:4,paddingTop:4,borderTop:`1px solid ${C.border}`}}>
          <span style={{color:C.textMuted,fontSize:10,textTransform:"uppercase",letterSpacing:".06em"}}>Máquinas operadas</span>
          <span style={{color:C.textSub,fontSize:10,lineHeight:1.5}}>{d.maquinas}</span>
        </div>}
      </div>
    );
  };

  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Filtro de proyecto */}
      <Card>
        <div style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <Icon name="filter" size={14} color={C.textSub}/>
          <span style={{fontSize:11,color:C.textSub,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase"}}>Proyecto</span>
          <div style={{display:"flex",gap:7}}>
            {[{value:"todos",label:"Todos"},...proyectos.map(p=>({value:p,label:p}))].map(opt=>(
              <button key={opt.value} onClick={()=>setProyecto(opt.value)} style={{padding:"6px 14px",borderRadius:7,border:`1px solid ${proyecto===opt.value?C.accent:C.border}`,background:proyecto===opt.value?C.accentDim:"none",color:proyecto===opt.value?C.accent:C.textSub,fontFamily:"DM Sans",fontWeight:600,fontSize:12,cursor:"pointer",transition:"all .15s"}}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:12}}>
        <StatCard icon="hours" label="Horas Totales" value={fmtNum(totalHoras)} sub="equipos productivos" color={C.accent}/>
        <StatCard icon="fuel" label="Combustible" value={fmtNum(totalComb)} sub="litros" color={C.teal}/>
        <StatCard icon="equip" label="Equipos" value={totalEquipos} sub="activos" color={C.purple}/>
        <StatCard icon="consist" label="Días Operativos" value={diasOperativos} sub="con registro productivo" color={C.blue}/>
        <StatCard icon="hours" label="Hs Prom./Día" value={fmtNum(horasPromDia)} sub="equipos productivos" color={C.green}/>
        <StatCard icon="parts" label="Días OD" value={diasOD} sub="orden del día" color={C.yellow}/>
        <StatCard icon="warn" label="Equipos en FS" value={equiposFS} sub="fuera de servicio" color={C.red}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Card title="Top 10 Equipos — Horas (sin camionetas/camiones)">
          <div style={{padding:"12px 6px"}}>
            <ResponsiveContainer width="100%" height={Math.max(200,topEquipos.length*34+40)}>
              <BarChart data={topEquipos} layout="vertical" margin={{left:8,right:16}}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false}/>
                <XAxis type="number" tick={{fill:C.textMuted,fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis type="category" dataKey="name" tick={{fill:C.textSub,fontSize:10}} width={84} axisLine={false} tickLine={false}/>
                <Tooltip content={<TooltipEquipo/>}/>
                <Bar dataKey="horas" fill={C.accent} radius={[0,4,4,0]} name="Horas" barSize={20}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <Card title="Top 10 Tareas — ROP05">
            <div style={{padding:"8px 12px 12px",display:"flex",flexDirection:"column",gap:7}}>
              {topTareas.map((t,i)=>(
                <div key={i} style={{display:"flex",flexDirection:"column",gap:3}}>
                  <div style={{display:"flex",alignItems:"center",gap:7}}>
                    <span style={{fontSize:11,fontWeight:800,color:C.accent,width:16,textAlign:"right",flexShrink:0,fontFamily:"Syne"}}>{i+1}</span>
                    <span style={{fontSize:11,color:C.text,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:500}}>{t.name}</span>
                    <span style={{fontSize:11,fontWeight:700,color:C.accent,flexShrink:0,minWidth:36,textAlign:"right"}}>{t.pct}%</span>
                  </div>
                  <div style={{marginLeft:23,background:C.border,borderRadius:3,height:4,overflow:"hidden"}}>
                    <div style={{width:`${t.pct}%`,height:"100%",background:C.accent,borderRadius:3,transition:"width .4s ease"}}/>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Horas por Proyecto">
            <div style={{padding:"10px 14px 12px",display:"flex",alignItems:"center",gap:16}}>
              <ResponsiveContainer width={120} height={120}>
                <PieChart>
                  <Pie data={horasProy} cx="50%" cy="50%" outerRadius={52} innerRadius={30} dataKey="value" nameKey="name" labelLine={false} label={false}>
                    {horasProy.map((entry,i)=><Cell key={i} fill={entry.name==="FILO DEL SOL"?"#e8001d":entry.name==="JOSE MARIA"?"#f0f0f0":"#ffaa00"}/>)}
                  </Pie>
                  <Tooltip content={<ChartTip/>}/>
                </PieChart>
              </ResponsiveContainer>
              <div style={{flex:1,display:"flex",flexDirection:"column",gap:8}}>
                {(()=>{const total=horasProy.reduce((s,r)=>s+r.value,0);return horasProy.map((entry,i)=>{const col=entry.name==="FILO DEL SOL"?"#e8001d":entry.name==="JOSE MARIA"?"#f0f0f0":"#ffaa00";const pct=total>0?Math.round((entry.value/total)*100):0;return(<div key={i} style={{display:"flex",flexDirection:"column",gap:3}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}><span style={{fontSize:11,fontWeight:600,color:col}}>{entry.name==="FILO DEL SOL"?"FILO DEL SOL":"JOSÉ MARÍA"}</span><span style={{fontSize:14,fontWeight:800,color:col,fontFamily:"Syne"}}>{pct}%</span></div><div style={{background:C.border,borderRadius:3,height:5,overflow:"hidden"}}><div style={{width:pct+"%",height:"100%",background:col,borderRadius:3}}/></div><span style={{fontSize:10,color:C.textMuted}}>{fmtNum(entry.value)} hs</span></div>);});})()} 
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Card title="Top 8 Operarios — Horas (equipos productivos)">
          <div style={{padding:"12px 6px"}}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={topOps} margin={{left:0,right:16}}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                <XAxis dataKey="name" tick={{fill:C.textMuted,fontSize:9}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:C.textMuted,fontSize:10}} axisLine={false} tickLine={false}/>
                <Tooltip content={<TooltipOperario/>}/>
                <Bar dataKey="horas" fill={C.accent} radius={[4,4,0,0]} name="Horas"/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Resumen Operativo">
          <div style={{padding:16,display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              <div style={{background:C.greenDim,borderRadius:8,padding:"12px 10px",border:`1px solid ${C.green}33`,textAlign:"center"}}>
                <div style={{fontFamily:"Syne",fontSize:22,fontWeight:800,color:C.green}}>{fmtNum(horasPromDia)}</div>
                <div style={{fontSize:10,color:C.textSub,marginTop:2}}>Hs prom./día</div>
              </div>
              <div style={{background:C.yellowDim,borderRadius:8,padding:"12px 10px",border:`1px solid ${C.yellow}33`,textAlign:"center"}}>
                <div style={{fontFamily:"Syne",fontSize:22,fontWeight:800,color:C.yellow}}>{diasOD}</div>
                <div style={{fontSize:10,color:C.textSub,marginTop:2}}>Días OD</div>
              </div>
              <div style={{background:C.redDim,borderRadius:8,padding:"12px 10px",border:`1px solid ${C.red}33`,textAlign:"center"}}>
                <div style={{fontFamily:"Syne",fontSize:22,fontWeight:800,color:C.red}}>{equiposFS}</div>
                <div style={{fontSize:10,color:C.textSub,marginTop:2}}>Equipos en FS</div>
              </div>
            </div>
            <div style={{borderTop:`1px solid ${C.border}`,paddingTop:10,display:"flex",flexDirection:"column",gap:6}}>
              <div style={{fontSize:10,color:C.textMuted,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase"}}>Equipos FS por máquina</div>
              {r02f.filter(r=>r.estado==="FS"&&!isExcluded(r.maquina)).reduce((acc,r)=>{
                const ex=acc.find(a=>a.m===r.maquina);
                if(ex)ex.d=uniq([...ex.d,r.fecha]);else acc.push({m:r.maquina,d:[r.fecha]});
                return acc;
              },[]).sort((a,b)=>b.d.length-a.d.length).slice(0,5).map((e,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:10,fontWeight:700,color:C.red,fontFamily:"Syne",width:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flexShrink:0}}>{e.m}</span>
                  <div style={{flex:1,background:C.border,borderRadius:3,height:5}}>
                    <div style={{width:`${(e.d.length/Math.max(...r02f.filter(r=>r.estado==="FS"&&!isExcluded(r.maquina)).reduce((acc,r)=>{const ex=acc.find(a=>a.m===r.maquina);if(ex)ex.d=uniq([...ex.d,r.fecha]);else acc.push({m:r.maquina,d:[r.fecha]});return acc;},[]).map(a=>a.d.length)))*100}%`,height:"100%",background:C.red,borderRadius:3}}/>
                  </div>
                  <span style={{fontSize:10,color:C.textMuted,flexShrink:0}}>{e.d.length}d</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Hook: filtros facetados genérico ─────────────────────────────────────────
function useFacetedFilters(allRows, filterKeys){
  const[mode,setMode]=useState("dia");
  const[fecha,setFecha]=useState("");
  const[fechaD,setFechaD]=useState("");
  const[fechaH,setFechaH]=useState("");

  // fkKeys y fkDefaults son estables porque filterKeys viene memoizado del componente
  const fkKeys=useMemo(()=>filterKeys.map(f=>f.key).join(","),[filterKeys]);
  const fkDefaults=useMemo(()=>Object.fromEntries(filterKeys.map(f=>[f.key,f.defaultVal])),[filterKeys]);

  const[vals,setVals]=useState(fkDefaults);

  // Reset selectores cuando cambia fecha/modo
  useEffect(()=>{setVals(fkDefaults);},[mode,fecha,fechaD,fechaH]);// eslint-disable-line

  // byFecha: filtrado solo por fecha — base para todo
  const byFecha=useMemo(()=>byDateFilter(allRows,mode,fecha,fechaD,fechaH),[allRows,mode,fecha,fechaD,fechaH]);

  // filtered: aplica todos los selectores sobre byFecha
  const filtered=useMemo(()=>{
    const activeFilters=filterKeys.filter(f=>vals[f.key]!==f.defaultVal);
    if(activeFilters.length===0)return byFecha;
    return byFecha.filter(r=>activeFilters.every(f=>r[f.key]===vals[f.key]));
  },[byFecha,vals,fkKeys]);// eslint-disable-line

  // opts: opciones facetadas — para cada key, byFecha filtrado por todos los demás activos
  const opts=useMemo(()=>{
    const result={};
    const valsEntries=Object.entries(vals);
    filterKeys.forEach(f=>{
      const otherActives=valsEntries.filter(([k,v])=>k!==f.key&&v!==fkDefaults[k]);
      if(otherActives.length===0){
        // Sin otros filtros activos — todas las opciones disponibles en byFecha
        result[f.key]=uniq(byFecha.map(r=>r[f.key]));
      } else {
        result[f.key]=uniq(byFecha.filter(r=>
          otherActives.every(([k,v])=>r[k]===v)
        ).map(r=>r[f.key]));
      }
    });
    return result;
  },[byFecha,vals,fkKeys]);// eslint-disable-line

  const set=useCallback((key,val)=>setVals(prev=>({...prev,[key]:val})),[]);
  const reset=useCallback(()=>{setVals(fkDefaults);setFecha("");setFechaD("");setFechaH("");},[fkDefaults]);
  const hayFiltros=fecha||fechaD||fechaH||filterKeys.some(f=>vals[f.key]!==f.defaultVal);

  return{mode,setMode,fecha,setFecha,fechaD,setFechaD,fechaH,setFechaH,byFecha,filtered,opts,vals,set,reset,hayFiltros};
}

// ─── ViewROP02 ────────────────────────────────────────────────────────────────
function ViewROP02({rop02All}){
  // Excluir camionetas y camiones de toda la vista ROP02
  const rop02Prod=useMemo(()=>rop02All.filter(r=>!isExcluded(r.maquina)),[rop02All]);

  const fk=useMemo(()=>[
    {key:"proyecto",defaultVal:"todos"},
    {key:"maquina",defaultVal:"todas"},
    {key:"supervisor",defaultVal:"todos"},
    {key:"operario",defaultVal:"todos"},
  ],[]);
  const{mode,setMode,fecha,setFecha,fechaD,setFechaD,fechaH,setFechaH,filtered:filteredBase,opts,vals,set}=useFacetedFilters(rop02Prod,fk);

  // Filtro de estado independiente (no afecta las opciones facetadas de otros selectores)
  const[estado,setEstado]=useState("todos");
  const filtered=useMemo(()=>{
    if(estado==="todos")return filteredBase;
    if(estado==="TRABAJO")return filteredBase.filter(r=>r.estado==="TRABAJO");
    if(estado==="OD")return filteredBase.filter(r=>r.estado==="OD");
    if(estado==="FS")return filteredBase.filter(r=>r.estado==="FS");
    return filteredBase;
  },[filteredBase,estado]);

  const stats=useMemo(()=>({
    horas:filtered.reduce((s,r)=>s+r.horas,0),
    comb:filtered.reduce((s,r)=>s+r.combustible,0),
    equipos:uniq(filtered.map(r=>r.maquina)).length,
    ops:uniq(filtered.map(r=>r.operario)).length,
    prod:filtered.filter(r=>r.estado==="TRABAJO").length,
    od:filtered.filter(r=>r.estado==="OD").length,
    fs:filtered.filter(r=>r.estado==="FS").length,
    desgaste:filtered.filter(r=>r.desgaste&&r.desgaste.trim()!==""&&!r.desgaste.toLowerCase().includes("sin consumo")).length,
  }),[filtered]);
  const horasFecha=useMemo(()=>{if(mode!=="periodo")return[];const m={};filtered.forEach(r=>{m[r.fecha]=(m[r.fecha]||0)+r.horas;});return Object.entries(m).sort().map(([fecha,horas])=>({fecha,horas}));},[filtered,mode]);

  const cols=useMemo(()=>[
    {key:"fecha",label:"Fecha"},
    {key:"maquina",label:"Máquina",render:v=><Badge color={C.purple}>{v}</Badge>},
    {key:"operario",label:"Operario"},
    {key:"supervisor",label:"Supervisor"},
    {key:"tipo_trabajo",label:"Tarea",render:v=><span style={{display:"block",maxWidth:260,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={v}>{v||"—"}</span>},
    {key:"horas",label:"Horas",render:v=><span style={{color:C.accent,fontWeight:600}}>{fmtNum(v)}</span>},
    {key:"combustible",label:"Comb.",render:v=>fmtNum(v)},
    {key:"estado",label:"Estado",render:v=><Badge color={v==="FS"?C.red:v==="OD"?C.yellow:C.green}>{v==="OD"?"OD":v||"—"}</Badge>},
    {key:"desgaste",label:"Desgaste",wrap:true,render:v=>v&&!v.toLowerCase().includes("sin consumo")?<Badge color={C.purple}>{v}</Badge>:<span style={{color:C.textMuted}}>—</span>},
    {key:"proyecto",label:"Proyecto",render:v=><Badge color={v?.includes("FILO")?C.accent:C.teal}>{v||"—"}</Badge>},
  ],[]);
  // Ordenar de más reciente a más viejo
  const filteredSorted=useMemo(()=>[...filtered].sort((a,b)=>b.fecha.localeCompare(a.fecha)),[filtered]);
  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:14}}>
      <Card>
        <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",gap:7}}>
            <TabBtn active={mode==="dia"} onClick={()=>setMode("dia")}>Por día</TabBtn>
            <TabBtn active={mode==="periodo"} onClick={()=>setMode("periodo")}>Por período</TabBtn>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"flex-end"}}>
            {mode==="dia"?<DateIn label="Fecha" value={fecha} onChange={setFecha}/>:<><DateIn label="Desde" value={fechaD} onChange={setFechaD}/><DateIn label="Hasta" value={fechaH} onChange={setFechaH}/></>}
            <Sel label="Proyecto" value={vals.proyecto} onChange={v=>set("proyecto",v)} options={[{value:"todos",label:"Todos"},...opts.proyecto.map(p=>({value:p,label:p}))]}/>
            <Sel label="Máquina" value={vals.maquina} onChange={v=>set("maquina",v)} options={[{value:"todas",label:"Todas"},...opts.maquina.map(m=>({value:m,label:m}))]}/>
            <Sel label="Supervisor" value={vals.supervisor} onChange={v=>set("supervisor",v)} options={[{value:"todos",label:"Todos"},...opts.supervisor.map(s=>({value:s,label:s}))]}/>
            <Sel label="Operario" value={vals.operario} onChange={v=>set("operario",v)} options={[{value:"todos",label:"Todos"},...opts.operario.map(o=>({value:o,label:o}))]}/>
            <Sel label="Estado" value={estado} onChange={setEstado} options={[
              {value:"todos",label:"Todos"},
              {value:"TRABAJO",label:"✅ Trabajo efectivo"},
              {value:"OD",label:"🟡 Operativo a Disposición"},
              {value:"FS",label:"🔴 Fuera de servicio"},
            ]}/>
          </div>
        </div>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10}}>
        <StatCard icon="hours" label="Kilómetros" value={fmtNum(stats.horas)} color={C.accent} valueColor="#ffffff" small/>
        <StatCard icon="fuel" label="Combustible" value={fmtNum(stats.comb)} color={C.teal} valueColor="#ffffff" small/>
        <StatCard icon="equip" label="Equipos" value={stats.equipos} color={C.purple} valueColor="#ffffff" small/>
        <StatCard icon="parts" label="Operarios" value={stats.ops} color={C.blue} valueColor="#ffffff" small/>
        <StatCard icon="check" label="Productivos" value={stats.prod} color={C.green} valueColor="#ffffff" small/>
        <StatCard icon="parts" label="Días OD" value={stats.od} color={C.yellow} valueColor="#ffffff" small/>
        <StatCard icon="warn" label="Días FS" value={stats.fs} color={C.red} valueColor="#ffffff" small/>
        <StatCard icon="wear" label="Días con elementos de desgaste" value={stats.desgaste} color={C.purple} valueColor="#ffffff" small/>
      </div>
      {mode==="periodo"&&horasFecha.length>0&&(
        <Card title="Kilómetros por Fecha">
          <div style={{padding:"10px 6px"}}>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={horasFecha} margin={{left:0,right:10}}>
                <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.accent} stopOpacity={.3}/><stop offset="95%" stopColor={C.accent} stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                <XAxis dataKey="fecha" tick={{fill:C.textMuted,fontSize:9}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:C.textMuted,fontSize:10}} axisLine={false} tickLine={false}/>
                <Tooltip content={<ChartTip/>}/>
                <Area type="monotone" dataKey="horas" stroke={C.accent} fill="url(#g1)" name="Horas" strokeWidth={2}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
      {mode==="periodo"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {["FILO DEL SOL","JOSE MARIA"].map((p,i)=>{
            const rows=filtered.filter(r=>r.proyecto===p);
            return(
              <Card key={p} style={{borderColor:(i===0?C.accent:C.teal)+"44"}}>
                <div style={{padding:"12px 16px"}}>
                  <Badge color={i===0?C.accent:C.teal}>{p}</Badge>
                  <div style={{marginTop:10,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {[[fmtNum(rows.reduce((s,r)=>s+r.horas,0)),"horas",i===0?C.accent:C.teal],[fmtNum(rows.reduce((s,r)=>s+r.combustible,0)),"combustible",C.teal],[rows.length,"registros",C.blue],[uniq(rows.map(r=>r.maquina)).length,"equipos",C.purple]].map(([v,l,c],j)=>(
                      <div key={j}><div style={{fontFamily:"Syne",fontSize:18,fontWeight:800,color:c}}>{v}</div><div style={{fontSize:10,color:C.textMuted}}>{l}</div></div>
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <Card title={`Registros (${filtered.length})`}>
        <Table cols={cols} rows={filteredSorted} maxH={400} emptyMsg="Sin registros con los filtros seleccionados"/>
      </Card>
    </div>
  );
}

// ─── ViewROP05 ────────────────────────────────────────────────────────────────
function ViewROP05({rop05}){
  const fk=useMemo(()=>[
    {key:"proyecto",defaultVal:"todos"},
    {key:"maquina",defaultVal:"todas"},
    {key:"supervisor",defaultVal:"todos"},
    {key:"unidad",defaultVal:"todas"},
  ],[]);
  const{mode,setMode,fecha,setFecha,fechaD,setFechaD,fechaH,setFechaH,filtered:filteredBase05,opts,vals,set}=useFacetedFilters(rop05,fk);

  // Filtro de tarea independiente — sus opciones dependen de la máquina seleccionada
  const[tarea,setTarea]=useState("todas");

  // Opciones de tarea: filtra por máquina activa (y fecha) para que se reduzca según máquina elegida
  const tareasOpts=useMemo(()=>{
    const base=rop05.filter(r=>{
      // Aplicar filtro de fecha
      const f=r.fecha||"";
      if(mode==="dia"&&fecha&&f!==fecha)return false;
      if(mode==="periodo"){if(fechaD&&f<fechaD)return false;if(fechaH&&f>fechaH)return false;}
      // Aplicar filtro de máquina si está activo
      if(vals.maquina!=="todas"&&r.maquina!==vals.maquina)return false;
      // Aplicar filtro de proyecto si está activo
      if(vals.proyecto!=="todos"&&r.proyecto!==vals.proyecto)return false;
      return true;
    });
    return uniq(base.map(r=>r.tarea).filter(Boolean));
  },[rop05,mode,fecha,fechaD,fechaH,vals.maquina,vals.proyecto]);

  // Reset tarea cuando cambia máquina o fecha
  useEffect(()=>{setTarea("todas");},[vals.maquina,mode,fecha,fechaD,fechaH]);

  // Aplicar filtro de tarea sobre el resultado del hook
  const filtered=useMemo(()=>
    tarea==="todas"?filteredBase05:filteredBase05.filter(r=>r.tarea===tarea)
  ,[filteredBase05,tarea]);

  // Configuración fija de unidades productivas
  // Normaliza string: quita tildes, espacios extra, mayúsculas
  const nu=s=>String(s||"").trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/\s+/g," ");

  const UNIDADES_CONFIG=useMemo(()=>[
    {titulo:"Productividad Metros Lineales", key:"ML",  match:(u)=>nu(u)==="METROS LINEALES",    color:C.accent},
    {titulo:"Productividad Km Lineales",     key:"KL",  match:(u)=>nu(u)==="KILOMETROS LINEALES", color:C.blue},
    {titulo:"Productividad Metros Cuadrados",key:"M2",  match:(u)=>nu(u)==="M2",                  color:C.teal},
    {titulo:"Productividad Metros Cúbicos",  key:"M3",  match:(u)=>nu(u)==="M3",                  color:C.purple},
    {titulo:"Trabajos por Hora",             key:"HS",  match:(u)=>nu(u)==="HS",                  color:C.green},
  ],[]);

  const prodCards=useMemo(()=>UNIDADES_CONFIG.map(cfg=>{
    const rows=filtered.filter(r=>r.unidad&&cfg.match(r.unidad));
    // Para HS: el acumulado es la suma de horas (no de cantidad)
    const cantidad=cfg.key==="HS"
      ? rows.reduce((s,r)=>s+r.horas,0)
      : rows.reduce((s,r)=>s+r.cantidad,0);
    const horas=rows.reduce((s,r)=>s+r.horas,0);
    const rendimiento=horas>0?(cantidad/horas):0;
    return{...cfg,cantidad,horas,rendimiento};
  }),[filtered,UNIDADES_CONFIG]);

  const prodFecha=useMemo(()=>{
    if(mode!=="periodo")return[];
    const m={};
    filtered.forEach(r=>{m[r.fecha]=(m[r.fecha]||0)+r.cantidad;});
    return Object.entries(m).sort().map(([fecha,cantidad])=>({fecha,cantidad}));
  },[filtered,mode]);

  const totalHoras05=useMemo(()=>filtered.reduce((s,r)=>s+r.horas,0),[filtered]);
  const filteredSorted=useMemo(()=>[...filtered].sort((a,b)=>b.fecha.localeCompare(a.fecha)),[filtered]);
  const cols=useMemo(()=>[
    {key:"fecha",label:"Fecha"},
    {key:"maquina",label:"Máquina",render:v=><Badge color={C.purple}>{v}</Badge>},
    {key:"tipo_maquina",label:"Tipo"},
    {key:"tarea",label:"Tarea",render:v=><span style={{display:"block",maxWidth:260,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={v}>{v||"—"}</span>},
    {key:"horas",label:"Horas",render:v=><span style={{color:C.accent,fontWeight:600}}>{fmtNum(v)}</span>},
    {key:"cantidad",label:"Cantidad",render:v=><span style={{color:C.blue,fontWeight:600}}>{fmtNum(v)}</span>},
    {key:"unidad",label:"Unidad",render:v=><Badge color={C.teal}>{v}</Badge>},
    {key:"proyecto",label:"Proyecto",render:v=><Badge color={v?.includes("FILO")?C.accent:C.teal}>{v||"—"}</Badge>},
  ],[]);

  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:14}}>
      <Card>
        <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",gap:7}}>
            <TabBtn active={mode==="dia"} onClick={()=>setMode("dia")}>Por día</TabBtn>
            <TabBtn active={mode==="periodo"} onClick={()=>setMode("periodo")}>Por período</TabBtn>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"flex-end"}}>
            {mode==="dia"?<DateIn label="Fecha" value={fecha} onChange={setFecha}/>:<><DateIn label="Desde" value={fechaD} onChange={setFechaD}/><DateIn label="Hasta" value={fechaH} onChange={setFechaH}/></>}
            <Sel label="Proyecto" value={vals.proyecto} onChange={v=>set("proyecto",v)} options={[{value:"todos",label:"Todos"},...opts.proyecto.map(p=>({value:p,label:p}))]}/>
            <Sel label="Máquina" value={vals.maquina} onChange={v=>set("maquina",v)} options={[{value:"todas",label:"Todas"},...opts.maquina.map(m=>({value:m,label:m}))]}/>
            <Sel label="Supervisor" value={vals.supervisor} onChange={v=>set("supervisor",v)} options={[{value:"todos",label:"Todos"},...opts.supervisor.map(s=>({value:s,label:s}))]}/>
            <Sel label="Tarea" value={tarea} onChange={setTarea} options={[{value:"todas",label:"Todas"},...tareasOpts.map(t=>({value:t,label:t.length>40?t.slice(0,38)+"…":t}))]}/>
            <Sel label="Unidad" value={vals.unidad} onChange={v=>set("unidad",v)} options={[{value:"todas",label:"Todas"},...opts.unidad.map(u=>({value:u,label:u}))]}/>
          </div>
        </div>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
        <StatCard icon="prod" label="Registros" value={filtered.length} color={C.blue} small/>
        <StatCard icon="hours" label="Horas" value={fmtNum(totalHoras05)} color={C.accent} small/>
        <StatCard icon="equip" label="Equipos" value={uniq(filtered.map(r=>r.maquina)).length} color={C.purple} small/>
        {prodCards.filter(({key})=>key!=="HS").map(({titulo,color,rendimiento})=>(
          <StatCard key={titulo}
            icon="prod"
            label={titulo}
            value={rendimiento>0?fmtNum(rendimiento):"—"}
            sub={rendimiento>0?"unidades / hora":"sin datos"}
            color={color}
            small
          />
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12}}>
        {prodCards.map(({titulo,color,cantidad,rendimiento})=>(
          <Card key={titulo} style={{borderColor:color+"44"}}>
            <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:6}}>
              <div style={{fontSize:10,color:color,fontWeight:700,letterSpacing:".04em",textTransform:"uppercase",lineHeight:1.3}}>{titulo}</div>
              <div style={{fontFamily:"Syne",fontSize:26,fontWeight:800,color:"#ffffff",lineHeight:1}}>{cantidad>0?fmtNum(cantidad):"—"}</div>
              <div style={{fontSize:10,color:C.textMuted}}>total acumulado</div>
              <div style={{borderTop:`1px solid ${C.border}`,paddingTop:6,display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                <span style={{fontSize:10,color:C.textMuted}}>Productividad</span>
                <span style={{fontFamily:"Syne",fontSize:14,fontWeight:800,color:color}}>{rendimiento>0?fmtNum(rendimiento):"—"}<span style={{fontSize:9,fontWeight:400,color:C.textMuted,marginLeft:2}}>/hs</span></span>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {mode==="periodo"&&prodFecha.length>0&&(
        <Card title="Producción por Fecha">
          <div style={{padding:"10px 6px"}}>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={prodFecha} margin={{left:0,right:10}}>
                <defs><linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.blue} stopOpacity={.3}/><stop offset="95%" stopColor={C.blue} stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                <XAxis dataKey="fecha" tick={{fill:C.textMuted,fontSize:9}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:C.textMuted,fontSize:10}} axisLine={false} tickLine={false}/>
                <Tooltip content={<ChartTip/>}/>
                <Area type="monotone" dataKey="cantidad" stroke={C.blue} fill="url(#g2)" name="Cantidad" strokeWidth={2}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
      <Card title={`Registros (${filtered.length})`}>
        <Table cols={cols} rows={filteredSorted} maxH={400} emptyMsg="Sin registros con los filtros seleccionados"/>
      </Card>
    </div>
  );
}

// ─── ViewControl ──────────────────────────────────────────────────────────────
function ViewControl({control}){
  const[sub,setSub]=useState("dashboard");

  // Filtros facetados sobre el universo productivo combinado (02+05)
  // Usamos el hook sobre productivos para ROP02; para ROP05 aplicamos manualmente los mismos filtros
  const fk=useMemo(()=>[
    {key:"proyecto",defaultVal:"todos"},
    {key:"maquina",defaultVal:"todas"},
    {key:"supervisor",defaultVal:"todos"},
  ],[]);
  const{mode,setMode,fecha,setFecha,fechaD,setFechaD,fechaH,setFechaH,vals,set,reset,hayFiltros,byFecha:byFecha02,opts:opts02}=useFacetedFilters(control.productivos,fk);

  // Aplicar mismo filtro de fecha+selectores a prod05
  const byFecha05=useMemo(()=>byDateFilter(control.prod05,mode,fecha,fechaD,fechaH),[control.prod05,mode,fecha,fechaD,fechaH]);
  const filtered05=useMemo(()=>byFecha05.filter(r=>
    (vals.proyecto==="todos"||r.proyecto===vals.proyecto)&&
    (vals.maquina==="todas"||r.maquina===vals.maquina)&&
    (vals.supervisor==="todos"||r.supervisor===vals.supervisor)
  ),[byFecha05,vals]);
  const filtered02=useMemo(()=>byFecha02.filter(r=>
    (vals.proyecto==="todos"||r.proyecto===vals.proyecto)&&
    (vals.maquina==="todas"||r.maquina===vals.maquina)&&
    (vals.supervisor==="todos"||r.supervisor===vals.supervisor)
  ),[byFecha02,vals]);

  // Opciones facetadas para Control: unión de 02 y 05
  const optsControl=useMemo(()=>{
    const combined=[...byFecha02,...byFecha05];
    const result={};
    fk.forEach(f=>{
      const others=fk.filter(o=>o.key!==f.key);
      result[f.key]=uniq(combined.filter(r=>
        others.every(o=>vals[o.key]===o.defaultVal||r[o.key]===vals[o.key])
      ).map(r=>r[f.key]));
    });
    return result;
  },[byFecha02,byFecha05,vals]);// eslint-disable-line

  // Recalcular inconsistencias sobre subconjunto filtrado
  const filteredData=useMemo(()=>{
    const key=r=>`${r.fecha}__${r.maquina}`;
    const set05=new Set(filtered05.map(key));
    const set02=new Set(filtered02.map(key));
    const faltanEn05=filtered02.filter(r=>!set05.has(key(r)));
    const faltanEn02=filtered05.filter(r=>!set02.has(key(r)));
    const total=filtered02.length+filtered05.length;
    const problemas=faltanEn05.length+faltanEn02.length;
    const consistencia=total>0?Math.round(((total-problemas)/total)*100):100;
    return{faltanEn05,faltanEn02,total,problemas,consistencia,prod02f:filtered02,prod05f:filtered05};
  },[filtered02,filtered05]);

  const inconsistFecha=useMemo(()=>{
    const m={};
    filteredData.faltanEn05.forEach(r=>{m[r.fecha]=m[r.fecha]||{fecha:r.fecha,sinProd:0,sinParte:0};m[r.fecha].sinProd++;});
    filteredData.faltanEn02.forEach(r=>{m[r.fecha]=m[r.fecha]||{fecha:r.fecha,sinProd:0,sinParte:0};m[r.fecha].sinParte++;});
    return Object.values(m).sort((a,b)=>a.fecha.localeCompare(b.fecha));
  },[filteredData]);

  const sem=semaforo(filteredData.consistencia);

  const FilterPanel=(
    <Card>
      <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <Icon name="filter" size={14} color={C.textSub}/>
          <span style={{fontSize:11,color:C.textSub,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase"}}>Filtros</span>
          {hayFiltros&&<button onClick={reset} style={{marginLeft:"auto",padding:"4px 10px",borderRadius:6,border:`1px solid ${C.border}`,background:"none",color:C.textSub,cursor:"pointer",fontSize:11}}>Limpiar todo</button>}
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"flex-end"}}>
          <div style={{display:"flex",gap:7}}>
            <TabBtn active={mode==="dia"} onClick={()=>setMode("dia")}>Por día</TabBtn>
            <TabBtn active={mode==="periodo"} onClick={()=>setMode("periodo")}>Por período</TabBtn>
          </div>
          {mode==="dia"?<DateIn label="Fecha" value={fecha} onChange={setFecha}/>:<><DateIn label="Desde" value={fechaD} onChange={setFechaD}/><DateIn label="Hasta" value={fechaH} onChange={setFechaH}/></>}
          <Sel label="Proyecto" value={vals.proyecto} onChange={v=>set("proyecto",v)} options={[{value:"todos",label:"Todos"},...optsControl.proyecto.map(p=>({value:p,label:p}))]}/>
          <Sel label="Máquina" value={vals.maquina} onChange={v=>set("maquina",v)} options={[{value:"todas",label:"Todas"},...optsControl.maquina.map(m=>({value:m,label:m}))]}/>
          <Sel label="Supervisor" value={vals.supervisor} onChange={v=>set("supervisor",v)} options={[{value:"todos",label:"Todos"},...optsControl.supervisor.map(s=>({value:s,label:s}))]}/>
        </div>
        {hayFiltros&&(
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {fecha&&<Badge color={C.blue}>Fecha: {fecha}</Badge>}
            {fechaD&&<Badge color={C.blue}>Desde: {fechaD}</Badge>}
            {fechaH&&<Badge color={C.blue}>Hasta: {fechaH}</Badge>}
            {vals.proyecto!=="todos"&&<Badge color={C.accent}>Proyecto: {vals.proyecto}</Badge>}
            {vals.maquina!=="todas"&&<Badge color={C.purple}>Máquina: {vals.maquina}</Badge>}
            {vals.supervisor!=="todos"&&<Badge color={C.teal}>Supervisor: {vals.supervisor}</Badge>}
          </div>
        )}
      </div>
    </Card>
  );

  const cols1=[
    {key:"fecha",label:"Fecha"},
    {key:"proyecto",label:"Proyecto",render:v=><Badge color={v?.includes("FILO")?C.accent:C.teal}>{v||"—"}</Badge>},
    {key:"maquina",label:"Máquina",render:v=><Badge color={C.purple}>{v}</Badge>},
    {key:"operario",label:"Operario"},{key:"supervisor",label:"Supervisor"},
    {key:"horas",label:"Horas",render:v=><span style={{color:C.accent,fontWeight:600}}>{fmtNum(v)}</span>},
    {key:"estado",label:"Estado",render:v=><Badge color={C.green}>{v||"—"}</Badge>},
    {key:"_",label:"Problema",render:()=><span style={{color:C.red,fontSize:11}}>Sin producción en ROP05</span>},
  ];
  const cols2=[
    {key:"fecha",label:"Fecha"},
    {key:"proyecto",label:"Proyecto",render:v=><Badge color={v?.includes("FILO")?C.accent:C.teal}>{v||"—"}</Badge>},
    {key:"maquina",label:"Máquina",render:v=><Badge color={C.purple}>{v}</Badge>},
    {key:"supervisor",label:"Supervisor"},{key:"tarea",label:"Tarea",wrap:true},
    {key:"horas",label:"Horas",render:v=><span style={{color:C.accent,fontWeight:600}}>{fmtNum(v)}</span>},
    {key:"cantidad",label:"Cantidad",render:v=>fmtNum(v)},
    {key:"unidad",label:"Unidad",render:v=><Badge color={C.teal}>{v}</Badge>},
    {key:"_",label:"Problema",render:()=><span style={{color:C.yellow,fontSize:11}}>Sin parte diario en ROP02</span>},
  ];

  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{borderBottom:`1px solid ${C.border}`,paddingBottom:2}}>
        <SubTab active={sub==="dashboard"} onClick={()=>setSub("dashboard")}>Dashboard</SubTab>
        <SubTab active={sub==="sinprod"} onClick={()=>setSub("sinprod")}>Sin producción ({filteredData.faltanEn05.length})</SubTab>
        <SubTab active={sub==="sinparte"} onClick={()=>setSub("sinparte")}>Sin parte diario ({filteredData.faltanEn02.length})</SubTab>
      </div>
      {FilterPanel}
      <AlertBanner type="info">Camionetas, camiones y equipos auxiliares están excluidos de este análisis.</AlertBanner>

      {sub==="dashboard"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10}}>
            <StatCard icon="consist" label="Consistencia" value={fmtPct(filteredData.consistencia)} sub={sem.label} color={sem.color} small/>
            <StatCard icon="alert" label="Problemas" value={filteredData.problemas} sub="registros" color={C.red} small/>
            <StatCard icon="check" label="ROP02 prod." value={filteredData.prod02f.length} sub="en filtro" color={C.green} small/>
            <StatCard icon="prod" label="ROP05" value={filteredData.prod05f.length} sub="en filtro" color={C.blue} small/>
            <StatCard icon="warn" label="Sin producción" value={filteredData.faltanEn05.length} sub="→ ROP05 faltante" color={C.red} small/>
            <StatCard icon="warn" label="Sin parte diario" value={filteredData.faltanEn02.length} sub="→ ROP02 faltante" color={C.yellow} small/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <Card title="Índice de Consistencia">
              <div style={{padding:"20px 24px",display:"flex",alignItems:"center",gap:24}}>
                <div style={{width:108,height:108,borderRadius:"50%",border:`5px solid ${sem.color}`,background:sem.dim,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",boxShadow:`0 0 32px ${sem.color}33`,flexShrink:0}}>
                  <span style={{fontFamily:"Syne",fontSize:28,fontWeight:800,color:sem.color}}>{filteredData.consistencia}%</span>
                  <span style={{fontSize:9,color:sem.color,fontWeight:700,letterSpacing:".1em"}}>{sem.label}</span>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"Syne",fontSize:14,fontWeight:700,color:C.text,marginBottom:8}}>Compara ROP02 productivos vs ROP05</div>
                  <p style={{fontSize:12,color:C.textSub,lineHeight:1.6,marginBottom:12}}>Cruce por <strong style={{color:C.text}}>fecha + máquina</strong>. Excluye camionetas y auxiliares.</p>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                    {[{l:"Total",v:filteredData.total,c:C.blue},{l:"Problemas",v:filteredData.problemas,c:C.red},{l:"OK",v:filteredData.total-filteredData.problemas,c:C.green}].map(({l,v,c})=>(
                      <div key={l} style={{background:c+"15",borderRadius:8,padding:"10px 12px",border:`1px solid ${c}33`}}>
                        <div style={{fontFamily:"Syne",fontSize:20,fontWeight:800,color:c}}>{v}</div>
                        <div style={{fontSize:10,color:C.textMuted}}>{l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
            <Card title="Umbrales">
              <div style={{padding:14,display:"flex",flexDirection:"column",gap:8}}>
                {[["≥ 90%","ÓPTIMO",C.green],["70–89%","ATENCIÓN",C.yellow],["< 70%","CRÍTICO",C.red]].map(([r,l,c])=>(
                  <div key={l} style={{background:c+"15",borderRadius:8,padding:"10px 14px",border:`1px solid ${c}33`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <span style={{fontFamily:"Syne",fontSize:16,fontWeight:800,color:c}}>{r}</span><Badge color={c}>{l}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          {inconsistFecha.length>0&&(
            <Card title="Inconsistencias por fecha">
              <div style={{padding:"10px 6px"}}>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={inconsistFecha} margin={{left:0,right:16}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                    <XAxis dataKey="fecha" tick={{fill:C.textMuted,fontSize:9}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:C.textMuted,fontSize:10}} axisLine={false} tickLine={false} allowDecimals={false}/>
                    <Tooltip content={<ChartTip/>}/>
                    <Bar dataKey="sinProd" name="Sin producción" fill={C.red} radius={[4,4,0,0]} stackId="a"/>
                    <Bar dataKey="sinParte" name="Sin parte diario" fill={C.yellow} radius={[4,4,0,0]} stackId="a"/>
                    <Legend iconSize={8} wrapperStyle={{fontSize:10,color:C.textSub}}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
          {filteredData.faltanEn05.length+filteredData.faltanEn02.length>0&&(
            <Card title="Máquinas con más inconsistencias">
              <div style={{padding:"12px 6px"}}>
                {(()=>{
                  const m={};
                  filteredData.faltanEn05.forEach(r=>{m[r.maquina]=m[r.maquina]||{maq:r.maquina,sinProd:0,sinParte:0};m[r.maquina].sinProd++;});
                  filteredData.faltanEn02.forEach(r=>{m[r.maquina]=m[r.maquina]||{maq:r.maquina,sinProd:0,sinParte:0};m[r.maquina].sinParte++;});
                  const top=Object.values(m).sort((a,b)=>(b.sinProd+b.sinParte)-(a.sinProd+a.sinParte)).slice(0,10);
                  return(
                    <ResponsiveContainer width="100%" height={Math.max(160,top.length*28)}>
                      <BarChart data={top} layout="vertical" margin={{left:8,right:16}}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false}/>
                        <XAxis type="number" tick={{fill:C.textMuted,fontSize:10}} axisLine={false} tickLine={false} allowDecimals={false}/>
                        <YAxis type="category" dataKey="maq" tick={{fill:C.textSub,fontSize:10}} width={84} axisLine={false} tickLine={false}/>
                        <Tooltip content={<ChartTip/>}/>
                        <Bar dataKey="sinProd" name="Sin producción" fill={C.red} radius={[0,4,4,0]} stackId="a"/>
                        <Bar dataKey="sinParte" name="Sin parte diario" fill={C.yellow} radius={[0,4,4,0]} stackId="a"/>
                        <Legend iconSize={8} wrapperStyle={{fontSize:10,color:C.textSub}}/>
                      </BarChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>
            </Card>
          )}
          <Card title="Reglas de Validación">
            <div style={{padding:14,display:"flex",flexDirection:"column",gap:9}}>
              {[["1","Máquina productiva en ROP02 → debe estar en ROP05",C.green],["2","Máquina en ROP05 → debe existir en ROP02",C.green],["3","Camionetas, camiones y auxiliares → excluidos del control",C.blue],["4","Comparación por fecha + máquina",C.blue],["5","Sin producción registrada → inconsistencia tipo A",C.yellow],["6","Sin parte diario → inconsistencia tipo B",C.yellow]].map(([n,d,c])=>(
                <div key={n} style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                  <span style={{width:20,height:20,borderRadius:"50%",background:c+"22",border:`1px solid ${c}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:c,flexShrink:0}}>{n}</span>
                  <span style={{fontSize:12,color:C.textSub,lineHeight:1.5}}>{d}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
      {sub==="sinprod"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {filteredData.faltanEn05.length>0
            ?<AlertBanner type="error">{filteredData.faltanEn05.length} máquinas productivas en ROP02 sin producción en ROP05.</AlertBanner>
            :<AlertBanner type="success">Sin inconsistencias con los filtros actuales.</AlertBanner>}
          <Card title={`Sin producción en ROP05 (${filteredData.faltanEn05.length})`}>
            <Table cols={cols1} rows={filteredData.faltanEn05} maxH={500} emptyMsg="Sin inconsistencias"/>
          </Card>
        </div>
      )}
      {sub==="sinparte"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {filteredData.faltanEn02.length>0
            ?<AlertBanner type="warn">{filteredData.faltanEn02.length} registros de ROP05 sin parte diario en ROP02.</AlertBanner>
            :<AlertBanner type="success">Sin inconsistencias con los filtros actuales.</AlertBanner>}
          <Card title={`Sin parte diario en ROP02 (${filteredData.faltanEn02.length})`}>
            <Table cols={cols2} rows={filteredData.faltanEn02} maxH={500} emptyMsg="Sin inconsistencias"/>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── ErrorScreen ──────────────────────────────────────────────────────────────
function ErrorScreen({errors,onRetry}){
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"60vh",gap:20,textAlign:"center",padding:24}}>
      <div style={{width:56,height:56,borderRadius:"50%",background:C.redDim,border:`2px solid ${C.red}44`,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <Icon name="warn" size={26} color={C.red}/>
      </div>
      <div>
        <div style={{fontFamily:"Syne",fontSize:16,fontWeight:700,color:C.red,marginBottom:8}}>Error al cargar datos</div>
        <div style={{display:"flex",flexDirection:"column",gap:6,maxWidth:480}}>
          {errors.map((e,i)=>(
            <div key={i} style={{background:C.redDim,border:`1px solid ${C.red}33`,borderRadius:8,padding:"10px 14px",textAlign:"left"}}>
              <div style={{fontSize:11,color:C.red,fontWeight:600}}>{e.source}</div>
              <div style={{fontSize:12,color:C.textSub,marginTop:2}}>{e.message}</div>
            </div>
          ))}
        </div>
      </div>
      <button onClick={onRetry} style={{padding:"9px 18px",borderRadius:8,border:`1px solid ${C.accent}44`,background:C.accentDim,color:C.accent,fontFamily:"DM Sans",fontWeight:600,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
        <Icon name="refresh" size={14} color={C.accent}/> Reintentar
      </button>
    </div>
  );
}

// ─── ViewVehiculos ────────────────────────────────────────────────────────────
function ViewVehiculos({rop02All}){
  // Solo camionetas y camiones
  const rop02Veh=useMemo(()=>rop02All.filter(r=>isExcluded(r.maquina)),[rop02All]);

  const fk=useMemo(()=>[
    {key:"proyecto",defaultVal:"todos"},
    {key:"maquina",defaultVal:"todas"},
    {key:"supervisor",defaultVal:"todos"},
    {key:"operario",defaultVal:"todos"},
  ],[]);
  const{mode,setMode,fecha,setFecha,fechaD,setFechaD,fechaH,setFechaH,filtered:filteredBase,opts,vals,set}=useFacetedFilters(rop02Veh,fk);

  const[estado,setEstado]=useState("todos");
  const filtered=useMemo(()=>{
    if(estado==="todos")return filteredBase;
    return filteredBase.filter(r=>r.estado===estado);
  },[filteredBase,estado]);

  const stats=useMemo(()=>({
    horas:filtered.reduce((s,r)=>s+r.horas,0),
    comb:filtered.reduce((s,r)=>s+r.combustible,0),
    equipos:uniq(filtered.map(r=>r.maquina)).length,
    ops:uniq(filtered.map(r=>r.operario)).length,
    prod:filtered.filter(r=>r.estado==="TRABAJO").length,
    od:filtered.filter(r=>r.estado==="OD").length,
    fs:filtered.filter(r=>r.estado==="FS").length,
  }),[filtered]);

  const horasFecha=useMemo(()=>{
    if(mode!=="periodo")return[];
    const m={};filtered.forEach(r=>{m[r.fecha]=(m[r.fecha]||0)+r.horas;});
    return Object.entries(m).sort().map(([fecha,horas])=>({fecha,horas}));
  },[filtered,mode]);

  const cols=useMemo(()=>[
    {key:"fecha",label:"Fecha"},
    {key:"maquina",label:"Vehículo",render:v=><Badge color={C.teal}>{v}</Badge>},
    {key:"operario",label:"Operario"},
    {key:"supervisor",label:"Supervisor"},
    {key:"tipo_trabajo",label:"Tarea",render:v=><span style={{display:"block",maxWidth:260,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={v}>{v||"—"}</span>},
    {key:"horas",label:"Km",render:v=><span style={{color:C.accent,fontWeight:600}}>{fmtNum(v)}</span>},
    {key:"combustible",label:"Comb.",render:v=>fmtNum(v)},
    {key:"estado",label:"Estado",render:v=><Badge color={v==="FS"?C.red:v==="OD"?C.yellow:C.green}>{v==="OD"?"OD":v||"—"}</Badge>},
    {key:"proyecto",label:"Proyecto",render:v=><Badge color={v?.includes("FILO")?C.accent:C.teal}>{v||"—"}</Badge>},
  ],[]);

  const filteredSorted=useMemo(()=>[...filtered].sort((a,b)=>b.fecha.localeCompare(a.fecha)),[filtered]);

  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:14}}>
      <Card>
        <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",gap:7}}>
            <TabBtn active={mode==="dia"} onClick={()=>setMode("dia")}>Por día</TabBtn>
            <TabBtn active={mode==="periodo"} onClick={()=>setMode("periodo")}>Por período</TabBtn>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"flex-end"}}>
            {mode==="dia"?<DateIn label="Fecha" value={fecha} onChange={setFecha}/>:<><DateIn label="Desde" value={fechaD} onChange={setFechaD}/><DateIn label="Hasta" value={fechaH} onChange={setFechaH}/></>}
            <Sel label="Proyecto" value={vals.proyecto} onChange={v=>set("proyecto",v)} options={[{value:"todos",label:"Todos"},...opts.proyecto.map(p=>({value:p,label:p}))]}/>
            <Sel label="Vehículo" value={vals.maquina} onChange={v=>set("maquina",v)} options={[{value:"todas",label:"Todos"},...opts.maquina.map(m=>({value:m,label:m}))]}/>
            <Sel label="Supervisor" value={vals.supervisor} onChange={v=>set("supervisor",v)} options={[{value:"todos",label:"Todos"},...opts.supervisor.map(s=>({value:s,label:s}))]}/>
            <Sel label="Operario" value={vals.operario} onChange={v=>set("operario",v)} options={[{value:"todos",label:"Todos"},...opts.operario.map(o=>({value:o,label:o}))]}/>
            <Sel label="Estado" value={estado} onChange={setEstado} options={[
              {value:"todos",label:"Todos"},
              {value:"TRABAJO",label:"✅ Trabajo efectivo"},
              {value:"OD",label:"🟡 Operativo a Disposición"},
              {value:"FS",label:"🔴 Fuera de servicio"},
            ]}/>
          </div>
        </div>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10}}>
        <StatCard icon="hours" label="Kilómetros" value={fmtNum(stats.horas)} color={C.accent} valueColor="#ffffff" small/>
        <StatCard icon="fuel" label="Combustible" value={fmtNum(stats.comb)} color={C.teal} valueColor="#ffffff" small/>
        <StatCard icon="equip" label="Vehículos" value={stats.equipos} color={C.purple} valueColor="#ffffff" small/>
        <StatCard icon="parts" label="Operarios" value={stats.ops} color={C.blue} valueColor="#ffffff" small/>
        <StatCard icon="check" label="Productivos" value={stats.prod} color={C.green} valueColor="#ffffff" small/>
        <StatCard icon="parts" label="Días OD" value={stats.od} color={C.yellow} valueColor="#ffffff" small/>
        <StatCard icon="warn" label="Días FS" value={stats.fs} color={C.red} valueColor="#ffffff" small/>
      </div>

      {mode==="periodo"&&horasFecha.length>0&&(
        <Card title="Kilómetros por Fecha">
          <div style={{padding:"10px 6px"}}>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={horasFecha} margin={{left:0,right:10}}>
                <defs><linearGradient id="gv" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.teal} stopOpacity={.3}/><stop offset="95%" stopColor={C.teal} stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                <XAxis dataKey="fecha" tick={{fill:C.textMuted,fontSize:9}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:C.textMuted,fontSize:10}} axisLine={false} tickLine={false}/>
                <Tooltip content={<ChartTip/>}/>
                <Area type="monotone" dataKey="horas" stroke={C.teal} fill="url(#gv)" name="Kilómetros" strokeWidth={2}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {mode==="periodo"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {["FILO DEL SOL","JOSE MARIA"].map((p,i)=>{
            const rows=filtered.filter(r=>r.proyecto===p);
            return(
              <Card key={p} style={{borderColor:(i===0?C.accent:C.teal)+"44"}}>
                <div style={{padding:"12px 16px"}}>
                  <Badge color={i===0?C.accent:C.teal}>{p}</Badge>
                  <div style={{marginTop:10,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {[
                      [fmtNum(rows.reduce((s,r)=>s+r.horas,0)),"km",i===0?C.accent:C.teal],
                      [fmtNum(rows.reduce((s,r)=>s+r.combustible,0)),"combustible",C.teal],
                      [rows.length,"registros",C.blue],
                      [uniq(rows.map(r=>r.maquina)).length,"vehículos",C.purple],
                    ].map(([v,l,c],j)=>(
                      <div key={j}><div style={{fontFamily:"Syne",fontSize:18,fontWeight:800,color:c}}>{v}</div><div style={{fontSize:10,color:C.textMuted}}>{l}</div></div>
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card title={`Registros (${filtered.length})`}>
        <Table cols={cols} rows={filteredSorted} maxH={400} emptyMsg="Sin registros con los filtros seleccionados"/>
      </Card>
    </div>
  );
}


// ─── App ──────────────────────────────────────────────────────────────────────
export default function App(){
  const[view,setView]=useState("dashboard");
  const[loading,setLoading]=useState(false);
  const[rop02All,setRop02All]=useState([]);
  const[rop05,setRop05]=useState([]);
  const[lastUpdate,setLastUpdate]=useState(null);
  const[sidebarOpen,setSidebarOpen]=useState(true);
  const[errors,setErrors]=useState([]);
  const[fatalError,setFatalError]=useState(null);
  const control=useMemo(()=>calcControl(rop02All,rop05),[rop02All,rop05]);

  const loadData=useCallback(async()=>{
    setLoading(true);setErrors([]);setFatalError(null);
    try{
      const json=await fetchAll(APPS_SCRIPT_URL);
      const src=json.sources||{};const errs=[];
      if(src.rop05?.ok&&src.rop05.data){setRop05(normalizeROP05(src.rop05.data));}
      else if(src.rop05&&!src.rop05.ok){errs.push({source:"ROP05",...src.rop05.error});setRop05([]);}
      const rFS=src.rop02_fs?.ok&&src.rop02_fs.data?normalizeROP02(src.rop02_fs.data,"FILO DEL SOL"):[];
      if(src.rop02_fs&&!src.rop02_fs.ok)errs.push({source:"ROP02 — Filo del Sol",...src.rop02_fs.error});
      const rJM=src.rop02_jm?.ok&&src.rop02_jm.data?normalizeROP02(src.rop02_jm.data,"JOSE MARIA"):[];
      if(src.rop02_jm&&!src.rop02_jm.ok)errs.push({source:"ROP02 — José María",...src.rop02_jm.error});
      setRop02All([...rFS,...rJM]);setErrors(errs);setLastUpdate(new Date());
    }catch(err){setFatalError(err.message);}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{loadData();},[loadData]);

  const navItems=[
    {id:"dashboard",icon:"dashboard",label:"Dashboard"},
    {id:"rop02",icon:"parts",label:"Equipos"},
    {id:"vehiculos",icon:"equip",label:"Vehículos"},
    {id:"rop05",icon:"prod",label:"Productividad"},
    {id:"control",icon:"control",label:"Control",badge:control.problemas>0?control.problemas:null},
  ];
  const titles={dashboard:"Dashboard",rop02:"Equipos",vehiculos:"Vehículos y Camionetas",rop05:"Productividad",control:"Control de Consistencia"};
  const SW=sidebarOpen?210:52;

  return(
    <>
      <style>{STYLES}</style>
      <div style={{display:"flex",height:"100vh",overflow:"hidden",background:C.bg}}>
        <div style={{width:SW,flexShrink:0,background:C.surface,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",transition:"width .22s ease",overflow:"hidden"}}>
          <div style={{padding:sidebarOpen?"18px 16px 14px":"18px 0 14px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:8,justifyContent:sidebarOpen?"space-between":"center"}}>
            {sidebarOpen&&(<div style={{padding:"2px 0"}}><img src={LOGO} alt="Delta Mining" style={{height:48,objectFit:"contain",display:"block"}}/></div>)}
            <button onClick={()=>setSidebarOpen(o=>!o)} style={{background:"none",border:"none",cursor:"pointer",color:C.textMuted,padding:3,display:"flex",alignItems:"center",flexShrink:0}}>
              <Icon name={sidebarOpen?"close":"menu"} size={17}/>
            </button>
          </div>
          <nav style={{flex:1,padding:"8px 0"}}>
            {navItems.map(item=>{
              const active=view===item.id;
              return(
                <button key={item.id} onClick={()=>setView(item.id)} style={{width:"100%",background:active?C.accentDim:"none",border:"none",borderLeft:`2px solid ${active?C.accent:"transparent"}`,padding:sidebarOpen?"10px 14px":"10px 0",display:"flex",alignItems:"center",gap:9,justifyContent:sidebarOpen?"flex-start":"center",cursor:"pointer",transition:"all .15s"}}>
                  <Icon name={item.icon} size={17} color={active?C.accent:C.textMuted}/>
                  {sidebarOpen&&(<><span style={{fontSize:12,fontWeight:500,color:active?C.accent:C.textSub,flex:1,textAlign:"left"}}>{item.label}</span>{item.badge&&<span style={{background:C.red,color:"#fff",borderRadius:9,fontSize:9,fontWeight:700,padding:"1px 5px"}}>{item.badge}</span>}</>)}
                </button>
              );
            })}
          </nav>
        </div>
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{height:50,flexShrink:0,background:C.surface,borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 18px"}}>
            <h1 style={{fontFamily:"Syne",fontWeight:700,fontSize:14,color:C.text}}>{titles[view]}</h1>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              {lastUpdate&&<span style={{fontSize:10,color:C.textMuted}}>Actualizado: {lastUpdate.toLocaleTimeString("es-AR")}</span>}
              <button onClick={loadData} disabled={loading} style={{display:"flex",alignItems:"center",gap:5,background:C.accentDim,border:`1px solid ${C.accent}44`,borderRadius:7,padding:"6px 12px",cursor:loading?"not-allowed":"pointer",color:C.accent,fontSize:12,fontWeight:600,fontFamily:"DM Sans"}}>
                {loading?<Spinner size={12}/>:<Icon name="refresh" size={13} color={C.accent}/>}
                {loading?"Cargando...":"Actualizar"}
              </button>
            </div>
          </div>
          <div style={{flex:1,overflow:"auto",padding:16}}>
            {errors.length>0&&!fatalError&&(
              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
                {errors.map((e,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"9px 12px",background:C.yellowDim,border:`1px solid ${C.yellow}44`,borderRadius:8,fontSize:12}}>
                    <Icon name="warn" size={13} color={C.yellow} style={{flexShrink:0,marginTop:1}}/>
                    <span><strong style={{color:C.yellow}}>{e.source}: </strong><span style={{color:C.textSub}}>{e.message}</span></span>
                  </div>
                ))}
              </div>
            )}
            {fatalError&&<ErrorScreen errors={[{source:"Apps Script",message:fatalError}]} onRetry={loadData}/>}
            {loading&&!lastUpdate&&!fatalError&&(
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"60vh",gap:14}}>
                <Spinner size={36}/>
                <div style={{color:C.textMuted,fontSize:13}}>Cargando datos desde Google Sheets...</div>
                <div style={{fontFamily:"monospace",fontSize:10,color:C.borderLight}}>{APPS_SCRIPT_URL.slice(0,60)}...</div>
              </div>
            )}
            {!fatalError&&lastUpdate&&(
              <>
                {view==="dashboard"&&<ViewDashboard rop02All={rop02All} rop05={rop05} control={control}/>}
                {view==="rop02"&&<ViewROP02 rop02All={rop02All}/>}
                {view==="vehiculos"&&<ViewVehiculos rop02All={rop02All}/>}
                {view==="rop05"&&<ViewROP05 rop05={rop05}/>}
                {view==="control"&&<ViewControl control={control} rop02All={rop02All} rop05={rop05}/>}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
