import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import { ICON_PATHS } from "../../shared/icons.js";
import { fmtNum, normDate, toNumber } from "../../shared/formatters.js";
import { SafeTooltipHtml } from "../../shared/safeTooltip.jsx";

// ─── Colores ──────────────────────────────────────────────────────────────────
export const C={
  bg:"#0d0d0d",surface:"#161616",card:"#1c1c1c",border:"#2a2a2a",borderLight:"#333333",
  accent:"#e8001d",accentDim:"rgba(232,0,29,0.12)",
  teal:"#06b6d4",tealDim:"rgba(6,182,212,0.12)",
  blue:"#3b82f6",blueDim:"rgba(59,130,246,0.12)",
  purple:"#a855f7",purpleDim:"rgba(168,85,247,0.12)",
  red:"#e8001d",redDim:"rgba(232,0,29,0.12)",
  yellow:"#f59e0b",yellowDim:"rgba(245,158,11,0.12)",
  green:"#22c55e",greenDim:"rgba(34,197,94,0.12)",
  text:"#f0f0f0",textMuted:"#666666",textSub:"#999999",
};
export const STYLES=`
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',sans-serif;background:${C.bg};color:${C.text};-webkit-font-smoothing:antialiased;background-image:url('/img/embedded/ui-background-b80067ac.jpg');background-size:cover;background-position:center;background-attachment:fixed;background-repeat:no-repeat;}
  html,body,#root{width:100%;min-width:0;min-height:100%;overflow-x:hidden}
  img,svg,canvas{max-width:100%}
  .dm-app-content>*{min-width:0}
  .dm-table-scroll{width:100%;max-width:100%;overflow:auto;overscroll-behavior:contain}
  [role="dialog"]>div{max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px);overflow:auto}
  input,select,textarea,button{max-width:100%}
  .dm-app-content{container-type:inline-size}
  .dm-app-content table{max-width:100%;font-variant-numeric:tabular-nums}
  .dm-app-content [style*="display: grid"]>*{min-width:0}
  .dm-app-content [style*="display: flex"]>*{min-width:0}
  .dm-app-content [style*="grid-template-columns"]{max-width:100%}
  .dm-app-content h1,.dm-app-content h2,.dm-app-content h3,.dm-app-content strong,.dm-app-content td,.dm-app-content th{overflow-wrap:anywhere}
  .dm-app-content canvas{width:100%!important;height:auto;min-width:0}
  @media(max-width:1200px){
    .dm-app-content>div:last-child{padding-inline:12px!important}
    .dm-table-scroll{overflow-x:auto!important;-webkit-overflow-scrolling:touch}
    .dm-table-scroll table{min-width:max-content}
    [role=dialog]>div{width:min(96vw,1100px)!important}
  }
  @media(max-width:900px){.dm-app-shell{min-width:0}.dm-app-sidebar{width:64px!important;flex-basis:64px}.dm-app-sidebar>div:first-child{padding-inline:0!important;justify-content:center!important}.dm-app-sidebar>div:first-child>div{display:none!important}.dm-app-sidebar nav button{justify-content:center!important;padding-inline:0!important}.dm-app-sidebar nav button span{display:none!important}.dm-app-sidebar>div:last-child{padding-inline:6px!important}.dm-app-sidebar>div:last-child span,.dm-app-sidebar>div:last-child>div{display:none!important}.dm-app-content{min-width:0}.dm-app-content>div:first-child{height:auto!important;min-height:50px;flex-wrap:wrap;gap:6px;padding:7px 10px!important}.dm-app-content>div:first-child>div{min-width:0;flex-wrap:wrap}.dm-app-content>div:first-child>div:last-child{gap:6px!important;justify-content:flex-end}.dm-app-content>div:first-child>div:last-child>div{display:none!important}}
  @media(max-width:640px){.dm-app-shell{height:100dvh}.dm-app-sidebar{width:54px!important;flex-basis:54px}.dm-app-content>div:last-child{padding:10px!important}.dm-app-content h1{max-width:48vw;overflow:hidden;text-overflow:ellipsis}.dm-app-content>div:first-child>div:last-child>span:not(:last-of-type){display:none!important}.dm-table-scroll{scrollbar-width:thin}.dm-table-scroll table{font-size:11px!important;min-width:max-content}.dm-table-scroll th,.dm-table-scroll td{padding-block:7px!important}}
  ::-webkit-scrollbar{width:12px;height:12px}
  ::-webkit-scrollbar-track{background:${C.surface}}
  ::-webkit-scrollbar-thumb{background:#4a4a4a;border-radius:6px;border:2px solid ${C.surface}}
  ::-webkit-scrollbar-thumb:hover{background:#666666}
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  .fade-in{animation:fadeIn .3s ease forwards}
  .spin{animation:spin 1s linear infinite}
  input[type=date]::-webkit-calendar-picker-indicator{filter:invert(.5);cursor:pointer}
  select option{background:${C.surface};color:${C.text}}
  .insumo-tr{cursor:pointer;transition:background .12s;will-change:background-color;}
  .insumo-tr:hover{background:rgba(232,0,29,0.13) !important;}
  .insumo-tr.pinned{background:rgba(232,0,29,0.22) !important;}

/* Tablas: encabezado visible y desplazamiento horizontal accesible. */
.dm-table-scroll{
  position:relative;
  overscroll-behavior:contain;
  scrollbar-gutter:stable both-edges;
}
.dm-table-scroll table{
  border-collapse:separate;
  border-spacing:0;
}
.dm-table-scroll thead th{
  position:sticky;
  top:0;
  z-index:5;
  background:#1c1c1c;
  box-shadow:0 1px 0 rgba(255,255,255,.08);
}
`;



export function Icon({name,size=18,color="currentColor",style}){
  const p=ICON_PATHS[name];if(!p)return null;
  return<svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={style}><path d={p}/></svg>;
}
export const PAGE_LOADER_SIZE=340;
export function LoadingMotoniveladora({size=72,label=""}){return <div style={{display:"inline-flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8}}><img src="/loader.gif" alt="Cargando" style={{width:size,height:"auto",maxWidth:"82vw",maxHeight:"58vh",objectFit:"contain",display:"block"}}/>{label?<div style={{color:C.text,fontSize:13,fontWeight:900,textAlign:"center"}}>{label}</div>:null}</div>;}
export function PageLoadingMotoniveladora({label="Cargando...",minHeight="55vh",margin=16}){return <div style={{margin,minHeight,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.62)",border:`1px solid ${C.border}`,borderRadius:16,backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)"}}><LoadingMotoniveladora size={PAGE_LOADER_SIZE} label={label}/></div>;}
export function Spinner({size=24}){return <LoadingMotoniveladora size={Math.max(28,size)}/>;}
export function Badge({children,color=C.accent}){return<span style={{display:"inline-block",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:600,color,background:color+"22",border:`1px solid ${color}33`}}>{children}</span>;}
const CARD_HELP_EXACT={
  "Cobertura con base":"Porcentaje de equipos activos que tienen cargados el último PM y el intervalo necesario para calcular su estado. Una cobertura baja indica que faltan datos en Configuración.",
  "Cumplimiento PM del mes":"Porcentaje de mantenimientos programados del mes que fueron realizados dentro del período seleccionado. Un valor alto indica mejor cumplimiento del plan preventivo.",
  "Atraso promedio":"Promedio de horas de atraso de los equipos que ya superaron su próximo PM. No incluye equipos al día ni próximos.",
  "Atraso máximo":"Mayor cantidad de horas de atraso registrada entre los equipos filtrados. Permite identificar la situación más crítica.",
  "Disponibilidad repuestos":"Porcentaje de repuestos configurados cuya existencia actual alcanza la cantidad mínima requerida para realizar el PM.",
  "Alertas activas":"Cantidad de situaciones críticas o de alta prioridad detectadas con los filtros actuales, incluyendo PM atrasados, urgentes y programaciones vencidas.",
  "PM programados":"Cantidad de mantenimientos que ya tienen fecha y asignación registradas y todavía no fueron cerrados como realizados.",
  "PM atrasados":"Equipos que superaron el límite de horas definido para ejecutar el mantenimiento programado.",
  "PM urgentes":"Equipos que alcanzaron el intervalo objetivo o están muy cerca del límite de atraso y requieren programación prioritaria.",
  "PM próximos":"Equipos que ingresaron al umbral de aviso, pero todavía no alcanzaron el intervalo objetivo.",
  "Equipos al día":"Equipos con información base válida y horas desde el último PM por debajo del umbral de aviso.",
  "Equipos activos en el período":"Cantidad de equipos que registraron actividad ROP02 dentro del período y filtros seleccionados.",
  "PM realizados en el mes":"Cantidad de mantenimientos programados registrados como realizados en el mes seleccionado.",
  "Promedio de horas entre PM":"Promedio de horas transcurridas entre mantenimientos programados consecutivos registrados.",
  "Estado de PM":"Distribución de los equipos según su situación actual: al día, próximo, urgente, atrasado o sin base.",
  "PM por proyecto":"Distribución de equipos con seguimiento de mantenimiento programado agrupados por proyecto.",
  "Horas desde el último PM por equipo":"Compara las horas acumuladas desde el último mantenimiento programado de cada equipo.",
  "PM previstos para el próximo turno":"Equipos que podrían alcanzar el intervalo de PM durante el próximo turno según su uso proyectado.",
  "Alertas automáticas":"Listado de situaciones que requieren atención, ordenadas por severidad para facilitar la toma de decisiones.",
  "Planificador semanal de PM":"Organiza los mantenimientos previstos por fecha estimada, prioridad, proyecto y disponibilidad de recursos.",
  "Repuestos mínimos por PM":"Permite definir la cantidad mínima necesaria de cada repuesto y compararla con el stock disponible.",
  "Exportación profesional":"Genera una salida del análisis filtrado para Excel o PDF, respetando el período y los filtros activos.",
  "Estado de mantenimiento programado":"Detalle por equipo del horómetro actual, último PM, horas acumuladas, próximo PM y estado calculado.",
  "Historial completo por equipo":"Resume la situación actual y todos los mantenimientos programados registrados para el equipo seleccionado.",
  "Distribución de mantenimientos":"Muestra cómo se distribuyen los mantenimientos registrados según fecha, tipo, proyecto o equipo.",
  "Costo total USD":"Suma de los costos de mantenimiento convertidos o registrados en dólares dentro de los filtros aplicados.",
  "Costo total ARS":"Suma de los costos de mantenimiento registrados en pesos dentro de los filtros aplicados.",
  "Total OTs":"Cantidad total de órdenes de trabajo incluidas en el período y filtros seleccionados.",
  "Preventivos":"Cantidad de órdenes de trabajo clasificadas como mantenimiento preventivo.",
  "Correctivos":"Cantidad de órdenes de trabajo clasificadas como mantenimiento correctivo.",
  "Ratio C/P":"Relación entre mantenimientos correctivos y preventivos. Un valor alto puede indicar menor efectividad preventiva.",
  "Días entre mantenimientos":"Promedio de días transcurridos entre intervenciones registradas para los equipos analizados.",
  "Lista Maestra de Equipos":"Base central con identificación, características, propiedad, costos y parámetros técnicos de cada equipo.",
  "Resumen por equipo":"Consolida los principales resultados, horas y costos calculados para cada equipo.",
  "Mano de Obra":"Detalle de costos y horas de personal utilizados en los cálculos del informe.",
  "Costos unitarios":"Presenta costos por unidad de producción para comparar tareas, equipos o períodos.",
  "Estado de fuentes":"Indica qué fuentes de datos fueron cargadas correctamente y cuáles presentan errores o faltantes.",
  "Próximo cambio":"Muestra la próxima fecha de cambio de turno y los grupos involucrados.",
  "Grupo trabajando hoy":"Identifica el grupo o supervisores asignados al turno vigente según la configuración de cambio de turno.",
  "Calendario de cambios de turno":"Visualiza la secuencia de grupos entrantes y salientes durante el período seleccionado."
};

function cleanCardTitle(value){
  return String(value??"")
    .replace(/\([^)]*\)/g," ")
    .replace(/\$\{[^}]+\}/g," ")
    .replace(/[—–-]\s*\d.*$/," ")
    .replace(/\s+/g," ")
    .trim();
}

export function getCardHelpText(title){
  const raw=cleanCardTitle(title);
  if(!raw)return "Esta tarjeta resume información calculada con los datos y filtros actualmente seleccionados.";
  if(CARD_HELP_EXACT[raw])return CARD_HELP_EXACT[raw];
  const t=raw.toLowerCase();
  if(t.includes("cumplimiento"))return `Indica el nivel de cumplimiento de ${raw.replace(/cumplimiento/ig,"").trim()||"la condición evaluada"} según los datos y filtros seleccionados.`;
  if(t.includes("costo")||t.includes("gasto"))return `Muestra ${raw.toLowerCase()} calculado con los registros incluidos en el período y filtros activos.`;
  if(t.includes("hora")||t.includes("horómetro")||t.includes("horometro"))return `Resume ${raw.toLowerCase()} utilizando los registros válidos disponibles para el período seleccionado.`;
  if(t.includes("equipo")||t.includes("máquina")||t.includes("maquina")||t.includes("vehículo")||t.includes("vehiculo"))return `Muestra ${raw.toLowerCase()} dentro del alcance definido por los filtros actuales.`;
  if(t.includes("distribución")||t.includes("por proyecto")||t.includes("por tipo")||t.includes("ranking")||t.includes("top "))return `Compara ${raw.toLowerCase()} para identificar concentración, diferencias y elementos destacados.`;
  if(t.includes("alerta")||t.includes("error")||t.includes("problema")||t.includes("inconsistencia")||t.includes("sin "))return `Señala ${raw.toLowerCase()} que requieren revisión. El contenido responde a los datos y filtros actuales.`;
  if(t.includes("registro")||t.includes("historial")||t.includes("orden")||t.includes("ot"))return `Presenta ${raw.toLowerCase()} incluidos en el período y filtros seleccionados.`;
  if(t.includes("producción")||t.includes("productiv"))return `Resume ${raw.toLowerCase()} a partir de los partes y registros de producción disponibles.`;
  if(t.includes("combustible")||t.includes("litros")||t.includes("consumo"))return `Resume ${raw.toLowerCase()} según las cargas y horas registradas en el período seleccionado.`;
  if(t.includes("stock")||t.includes("artículo")||t.includes("articulo")||t.includes("insumo")||t.includes("repuesto"))return `Muestra ${raw.toLowerCase()} para controlar disponibilidad, consumo y necesidades de reposición.`;
  return `Esta tarjeta muestra ${raw.toLowerCase()} calculado con los datos disponibles y los filtros actualmente aplicados.`;
}

export function HelpTip({text,ariaLabel="Ayuda"}){
  const[open,setOpen]=useState(false);
  const[anchor,setAnchor]=useState(null);
  const ref=useRef(null);
  const show=()=>{
    if(ref.current)setAnchor(ref.current.getBoundingClientRect());
    setOpen(true);
  };
  const hide=()=>setOpen(false);
  const W=300;
  let left=anchor?anchor.left+anchor.width/2-W/2:12;
  left=Math.max(12,Math.min(left,typeof window!=="undefined"?window.innerWidth-W-12:left));
  let top=anchor?anchor.bottom+9:12;
  const estimatedH=110;
  if(anchor&&typeof window!=="undefined"&&top+estimatedH>window.innerHeight-12)top=Math.max(12,anchor.top-estimatedH-9);
  return(
    <span ref={ref} tabIndex={0} role="button" aria-label={ariaLabel}
      onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}
      style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:18,height:18,borderRadius:"50%",background:"#171717",border:"1px solid #343434",color:"#a1a1a1",fontSize:11,fontWeight:900,cursor:"help",userSelect:"none",flex:"0 0 auto",outline:"none"}}>
      ?
      {open&&anchor&&ReactDOM.createPortal(
        <div role="tooltip" style={{position:"fixed",left,top,zIndex:2147483647,width:W,maxWidth:"calc(100vw - 24px)",padding:"11px 13px",background:"rgba(23,23,23,.98)",border:"1px solid #3a3a3a",borderRadius:7,boxShadow:"0 12px 34px rgba(0,0,0,.58)",fontSize:11,lineHeight:1.5,fontWeight:400,color:"#a9a9a9",whiteSpace:"normal",pointerEvents:"none",textAlign:"left"}}>{text}</div>,
        document.body
      )}
    </span>
  );
}

export function StatCard({icon,value,label,sub,color=C.accent,valueColor,small,tooltip,valueStyle}){
  const valCol=valueColor||color;
  const help=tooltip||getCardHelpText(label);
  return(
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:small?"12px 14px":"16px 18px",display:"flex",flexDirection:"column",gap:5,position:"relative",overflow:"visible",boxShadow:`0 0 24px ${color}0d`}}>
      <div style={{position:"absolute",top:-8,right:-8,width:56,height:56,background:color+"15",borderRadius:"50%",pointerEvents:"none"}}/>
      <div style={{display:"flex",alignItems:"center",gap:7,position:"relative",zIndex:1}}>
        <div style={{background:color+"20",borderRadius:7,padding:5,display:"flex"}}><Icon name={icon} size={14} color={color}/></div>
        <span style={{fontSize:12,color:C.textSub,fontWeight:600}}>{label}</span>
        <HelpTip text={help} ariaLabel={`Ayuda: ${label}`}/>
      </div>
      <div style={{fontFamily:"Inter,sans-serif",fontSize:small?26:34,fontWeight:800,color:valCol,lineHeight:1,letterSpacing:"-0.02em",position:"relative",zIndex:1,...valueStyle}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:C.textMuted,position:"relative",zIndex:1}}>{sub}</div>}
    </div>
  );
}
export function Card({children,style,title,action,tooltip,hideHelp=false}){
  const help=tooltip||getCardHelpText(title);
  return(
    <div style={{background:"rgba(28,28,28,0.82)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",border:`1px solid ${C.border}55`,borderRadius:12,overflow:"visible",...style}}>
      {title&&<div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
        <span style={{fontFamily:"Inter",fontWeight:700,fontSize:13,color:C.text,display:"inline-flex",alignItems:"center",gap:7}}>
          <span>{title}</span>
          {!hideHelp?<HelpTip text={help} ariaLabel={`Ayuda: ${cleanCardTitle(title)}`}/>:null}
        </span>
        {action}
      </div>}
      {children}
    </div>
  );
}
function TableRowTooltip({ tip, pinned = false }) {
  if (!tip || typeof document === "undefined") return null;
  const width = 390;
  const estimatedHeight = 190;
  const viewportWidth = window.innerWidth || 1280;
  const viewportHeight = window.innerHeight || 720;
  const left = Math.max(12, Math.min(tip.x + 14, viewportWidth - width - 12));
  const topCandidate = tip.y + 14;
  const top = topCandidate + estimatedHeight > viewportHeight - 12
    ? Math.max(12, tip.y - estimatedHeight - 14)
    : topCandidate;

  return ReactDOM.createPortal(
    <div
      role="tooltip"
      style={{
        position: "fixed",
        zIndex: pinned ? 10000 : 9999,
        left,
        top,
        width,
        maxWidth: "calc(100vw - 24px)",
        background: C.surface,
        border: `1px solid ${pinned ? C.red : C.border}`,
        borderRadius: 10,
        padding: "12px 16px",
        fontSize: 12,
        fontFamily: "Inter,sans-serif",
        boxShadow: pinned ? "0 10px 36px rgba(0,0,0,.65)" : "0 8px 32px rgba(0,0,0,.5)",
        pointerEvents: pinned ? "auto" : "none",
        color: C.text,
        lineHeight: 1.4
      }}
    >
      {tip.customHtml ? (
        <SafeTooltipHtml html={tip.customHtml} />
      ) : (
        <div>
          <span style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: ".06em" }}>Observaciones</span>
          <div style={{ color: tip.observaciones ? "#ccc" : "#555", marginTop: 3, fontStyle: tip.observaciones ? "normal" : "italic", whiteSpace: "pre-wrap" }}>
            {tip.observaciones || "Sin observaciones"}
          </div>
        </div>
      )}
      {pinned ? (
        <div style={{ marginTop: 8, paddingTop: 7, borderTop: `1px solid ${C.border}`, fontSize: 10, color: C.textMuted, fontWeight: 700 }}>
          Click nuevamente en la fila para desfijar
        </div>
      ) : null}
    </div>,
    document.body
  );
}

export function Table({cols,rows,maxH=380,emptyMsg="Sin datos",stickyFirst=false,disableTooltip=false,advanced=true,tableId=""}){
  const storageKey=useMemo(()=>`dm_table_prefs_${tableId||cols.map(c=>c.key||c.label||"").join("_").slice(0,80)}`,[tableId,cols]);
  const readPrefs=useCallback(()=>{try{return JSON.parse(localStorage.getItem(storageKey)||"{}")||{}}catch(_){return{}}},[storageKey]);
  const[density,setDensity]=useState(()=>{try{return localStorage.getItem("dm_table_density")||"normal"}catch(_){return"normal"}});
  const ROW_H=density==="compact"?30:density==="comfortable"?44:36;
  const[tableSearch,setTableSearch]=useState("");
  const[showColumns,setShowColumns]=useState(false);
  const[showColumnFilters,setShowColumnFilters]=useState(false);
  const[columnFilters,setColumnFilters]=useState({});
  const[hiddenColumns,setHiddenColumns]=useState(()=>new Set(readPrefs().hiddenColumns||[]));
  const[pinnedFirstCol,setPinnedFirstCol]=useState(()=>readPrefs().pinnedFirstCol??stickyFirst);
  const[colWidths,setColWidths]=useState(()=>readPrefs().colWidths||{});
  useEffect(()=>{try{localStorage.setItem(storageKey,JSON.stringify({hiddenColumns:[...hiddenColumns],pinnedFirstCol,colWidths}))}catch(_){}},[storageKey,hiddenColumns,pinnedFirstCol,colWidths]);
  const[scrollTop,setScrollTop]=useState(0);
  const[sortKey,setSortKey]=useState(null);
  const[sortDir,setSortDir]=useState("asc");
  const[hoverTip,setHoverTip]=useState(null);
  const[pinnedTip,setPinnedTip]=useState(null);


  // FIX VIBRACIÓN DE TABLAS:
  // La virtualización anterior asumía filas de 36px. Cuando una columna tenía wrap
  // (por ejemplo "Tarea (ROP02)"), las filas reales eran más altas. Al llegar al
  // final del scroll, React recalculaba spacer + ancho de scrollbar y la tabla
  // empezaba a moverse de izquierda a derecha. Para tablas con texto multilínea
  // se desactiva la virtualización y se deja el layout estable.
  const visibleCols=useMemo(()=>cols.filter((c,i)=>!hiddenColumns.has(c.key||c.label||String(i))),[cols,hiddenColumns]);
  const hasWrappedCols=useMemo(()=>visibleCols.some(c=>c.wrap),[visibleCols]);
  const useVirtual=rows.length>250&&!hasWrappedCols;
  const onScroll=useCallback(e=>{
    if(useVirtual)setScrollTop(e.target.scrollTop);
    setHoverTip(null);
  },[useVirtual]);

  // Ordenamiento global para TODAS las tablas:
  // Primer clic = menor a mayor para números/fechas y A→Z para textos.
  const colSortId=useCallback((c,i)=>c.sortKey||c.key||`__col_${i}` ,[]);

  const normalizeSortValue=useCallback((v)=>{
    if(v===null||v===undefined||v==="")return{type:"empty",value:""};
    if(typeof v==="number"&&Number.isFinite(v))return{type:"number",value:v};
    const raw=String(v).trim();
    if(!raw)return{type:"empty",value:""};

    const dmy=raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if(dmy){
      const yy=dmy[3].length===2?`20${dmy[3]}`:dmy[3];
      const ms=new Date(`${yy}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}T00:00:00`).getTime();
      if(Number.isFinite(ms))return{type:"date",value:ms};
    }
    const iso=raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(iso){
      const ms=new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00`).getTime();
      if(Number.isFinite(ms))return{type:"date",value:ms};
    }

    const numericRaw=raw
      .replace(/^U\$S\s*/i,"")
      .replace(/^ARS\s*/i,"")
      .replace(/[$%\s]/g,"");
    if(/^-?[\d.,]+$/.test(numericRaw)){
      let normalized=numericRaw;
      if(normalized.includes(",")) normalized=normalized.replace(/\./g,"").replace(",",".");
      else normalized=normalized.replace(/,/g,"");
      const n=Number(normalized);
      if(Number.isFinite(n))return{type:"number",value:n};
    }

    return{type:"text",value:raw.toLocaleLowerCase("es-AR")};
  },[]);

  const detectInitialDir=useCallback((key)=>{
    const sortCol=visibleCols.find((c,i)=>colSortId(c,i)===key);
    if(!sortCol)return"asc";
    const getSV=(row)=>{
      if(typeof sortCol.sortValue==="function")return sortCol.sortValue(row);
      if(sortCol.sortKey&&row[sortCol.sortKey]!==undefined)return row[sortCol.sortKey];
      if(sortCol.key&&row[sortCol.key]!==undefined)return row[sortCol.key];
      return"";
    };
    const first=rows.find(r=>{const v=getSV(r);return v!==null&&v!==undefined&&v!==""});
    if(!first)return"asc";
    normalizeSortValue(getSV(first));
    return "asc";
  },[visibleCols,rows,colSortId,normalizeSortValue]);
  const handleSort=useCallback((key)=>{
    if(sortKey===key){
      if(sortDir==="asc")setSortDir("desc");
      else{setSortKey(null);setSortDir("asc");}
    }else{setSortKey(key);setSortDir(detectInitialDir(key));}
  },[sortKey,sortDir,detectInitialDir]);

  const searchedRows=useMemo(()=>{
    const q=String(tableSearch||"").trim().toLowerCase();
    return rows.filter(r=>{
      if(q&&!Object.values(r||{}).some(v=>v!==null&&v!==undefined&&typeof v!=="object"&&String(v).toLowerCase().includes(q)))return false;
      for(const c of visibleCols){
        const key=c.key||c.label; const fq=String(columnFilters[key]||"").trim().toLowerCase();
        if(!fq)continue;
        const value=typeof c.exportValue==="function"?c.exportValue(r):r?.[c.key];
        if(!String(value??"").toLowerCase().includes(fq))return false;
      }
      return true;
    });
  },[rows,tableSearch,columnFilters,visibleCols]);

  const sortedRows=useMemo(()=>{
    if(!sortKey)return searchedRows;
    const sortCol=visibleCols.find((c,i)=>colSortId(c,i)===sortKey);
    if(!sortCol)return searchedRows;
    const getSortValue=(row)=>{
      if(typeof sortCol.sortValue==="function")return sortCol.sortValue(row);
      if(sortCol.sortKey&&row[sortCol.sortKey]!==undefined)return row[sortCol.sortKey];
      if(sortCol.key&&row[sortCol.key]!==undefined)return row[sortCol.key];
      return "";
    };
    return [...searchedRows].sort((a,b)=>{
      const av=normalizeSortValue(getSortValue(a));
      const bv=normalizeSortValue(getSortValue(b));
      if(av.type==="empty"&&bv.type!=="empty")return 1;
      if(bv.type==="empty"&&av.type!=="empty")return -1;
      let cmp=0;
      if((av.type==="number"&&bv.type==="number")||(av.type==="date"&&bv.type==="date"))cmp=av.value-bv.value;
      else cmp=String(av.value).localeCompare(String(bv.value),"es-AR",{sensitivity:"base"});
      return sortDir==="asc"?cmp:-cmp;
    });
  },[searchedRows,visibleCols,sortKey,sortDir,colSortId,normalizeSortValue]);

  const bufferRows=8;
  const visibleCount=Math.ceil(maxH/ROW_H);
  const startIdx=useVirtual?Math.max(0,Math.floor(scrollTop/ROW_H)-bufferRows):0;
  const endIdx=useVirtual?Math.min(sortedRows.length,startIdx+visibleCount+bufferRows*2):sortedRows.length;
  const visibleRows=sortedRows.slice(startIdx,endIdx);
  const offsetY=useVirtual?startIdx*ROW_H:0;

  if(rows.length===0)return(
    <div style={{padding:"28px",textAlign:"center",color:C.textMuted,fontSize:12}}>{emptyMsg}</div>
  );

  const tableMinWidth=visibleCols.reduce((sum,c,i)=>{
    const raw=colWidths[c.key||c.label||String(i)]||c.width||c.minWidth||c.maxWidth||(c.wrap?140:120);
    const n=typeof raw==="number"?raw:parseFloat(String(raw),10);
    return sum+(Number.isFinite(n)?n:120);
  },0);

  const exportFiltered=()=>{
    const esc=v=>`"${String(v??"").replace(/"/g,'""')}"`;
    const header=visibleCols.map(c=>esc(c.label||c.key||"")).join(",");
    const body=sortedRows.map(r=>visibleCols.map(c=>esc(typeof c.exportValue==="function"?c.exportValue(r):r?.[c.key])).join(",")).join("\n");
    const blob=new Blob(["\ufeff"+header+"\n"+body],{type:"text/csv;charset=utf-8"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`${tableId||"tabla"}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  };
  const startResize=(e,c,i)=>{
    e.preventDefault();e.stopPropagation();
    const key=c.key||c.label||String(i);const startX=e.clientX;const base=Number(colWidths[key]||c.width||c.minWidth||120)||120;
    const onMove=ev=>setColWidths(prev=>({...prev,[key]:Math.max(60,base+(ev.clientX-startX))}));
    const onUp=()=>{window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);};
    window.addEventListener("mousemove",onMove);window.addEventListener("mouseup",onUp);
  };

  return(
    <>
      {advanced&&<div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap",padding:"7px 8px",borderBottom:`1px solid ${C.border}66`,background:"rgba(0,0,0,.12)"}}>
        <input value={tableSearch} onChange={e=>setTableSearch(e.target.value)} placeholder="Buscar en tabla..." style={{minWidth:180,flex:"1 1 220px",maxWidth:320,background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,padding:"6px 9px",fontSize:11,outline:"none"}}/>
        <div style={{position:"relative"}}><button type="button" onClick={()=>setShowColumns(v=>!v)} style={{padding:"6px 9px",borderRadius:7,border:`1px solid ${C.border}`,background:C.surface,color:C.textSub,cursor:"pointer",fontSize:11}}>Columnas</button>{showColumns&&<div style={{position:"absolute",right:0,top:"calc(100% + 5px)",zIndex:1000,width:230,maxHeight:280,overflow:"auto",padding:7,borderRadius:8,border:`1px solid ${C.border}`,background:C.surface,boxShadow:"0 12px 30px rgba(0,0,0,.5)"}}>{cols.map((c,i)=>{const key=c.key||c.label||String(i);const checked=!hiddenColumns.has(key);return <label key={key} style={{display:"flex",gap:7,alignItems:"center",padding:"5px 3px",fontSize:11,color:C.textSub,cursor:"pointer"}}><input type="checkbox" checked={checked} onChange={()=>setHiddenColumns(prev=>{const n=new Set(prev);checked?n.add(key):n.delete(key);return n})}/>{c.label||c.key}</label>})}</div>}</div>
        <select value={density} onChange={e=>{setDensity(e.target.value);try{localStorage.setItem("dm_table_density",e.target.value)}catch(_){}}} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,color:C.textSub,padding:"6px 7px",fontSize:11}}><option value="compact">Compacta</option><option value="normal">Normal</option><option value="comfortable">Cómoda</option></select>
        <button type="button" onClick={()=>setShowColumnFilters(v=>!v)} style={{padding:"6px 9px",borderRadius:7,border:`1px solid ${showColumnFilters?C.blue:C.border}`,background:showColumnFilters?C.blueDim:C.surface,color:showColumnFilters?C.blue:C.textSub,cursor:"pointer",fontSize:11}}>Filtros por columna</button>
        <button type="button" onClick={()=>setPinnedFirstCol(v=>!v)} style={{padding:"6px 9px",borderRadius:7,border:`1px solid ${pinnedFirstCol?C.blue:C.border}`,background:pinnedFirstCol?C.blueDim:C.surface,color:pinnedFirstCol?C.blue:C.textSub,cursor:"pointer",fontSize:11}}>Fijar 1ª</button>
        <button type="button" onClick={exportFiltered} style={{padding:"6px 9px",borderRadius:7,border:`1px solid ${C.green}55`,background:C.greenDim,color:C.green,cursor:"pointer",fontSize:11,fontWeight:700}}>Exportar filtrado</button>
        <span style={{marginLeft:"auto",fontSize:10,color:C.textMuted}}>{sortedRows.length.toLocaleString("es-AR")} filas</span>
      </div>}
      <div className="dm-table-scroll" onScroll={onScroll} style={{overflowX:"auto",overflowY:"auto",maxHeight:maxH,scrollbarGutter:"stable",overscrollBehavior:"contain",contain:"layout paint",transform:"translateZ(0)"}}>
        <table style={{width:"100%",minWidth:tableMinWidth,borderCollapse:"separate",borderSpacing:0,fontSize:12,tableLayout:"fixed"}}>
          <thead><tr>{visibleCols.map((c,i)=>{
            const sticky=pinnedFirstCol&&i===0;
            const colKey=c.key||c.label||String(i);
            const effectiveWidth=colWidths[colKey]||c.width||c.minWidth||(c.wrap?140:undefined);
            const sKey=colSortId(c,i);
            return(
            <th key={i} data-dm-managed-sort="true" onClick={()=>handleSort(sKey)}
              style={{padding:c.compact?"9px 6px":"9px 12px",textAlign:c.align||"left",position:"sticky",top:0,left:sticky?0:undefined,zIndex:sticky?4:3,background:c.headerBg||(c.color?c.color+"22":C.surface),color:sortKey===sKey?C.accent:C.textSub,fontWeight:600,fontSize:10,letterSpacing:".06em",textTransform:"uppercase",borderBottom:`2px solid ${c.color?c.color+"66":C.border}`,whiteSpace:c.wrap?"normal":"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:effectiveWidth||c.maxWidth||(c.wrap?140:undefined),minWidth:effectiveWidth,width:effectiveWidth,lineHeight:1.3,cursor:"pointer",userSelect:"none",boxShadow:sticky?`1px 0 0 ${C.border}`:undefined}}>
              {c.label}{sortKey===sKey?(sortDir==="asc"?" ↑":" ↓"):""}<span onMouseDown={e=>startResize(e,c,i)} onClick={e=>e.stopPropagation()} title="Arrastrar para redimensionar" style={{position:"absolute",right:0,top:0,width:6,height:"100%",cursor:"col-resize"}}/>
            </th>
            );
          })}</tr>{showColumnFilters&&<tr>{visibleCols.map((c,i)=>{const key=c.key||c.label||String(i);return <th key={`filter-${key}`} style={{position:"sticky",top:35,zIndex:3,background:C.surface,padding:"4px 5px",borderBottom:`1px solid ${C.border}`}}><input value={columnFilters[key]||""} onChange={e=>setColumnFilters(prev=>({...prev,[key]:e.target.value}))} placeholder="Filtrar..." onClick={e=>e.stopPropagation()} style={{width:"100%",minWidth:0,background:"rgba(0,0,0,.28)",border:`1px solid ${C.border}`,borderRadius:5,color:C.text,padding:"4px 6px",fontSize:9,outline:"none"}}/></th>})}</tr>}</thead>
          <tbody>
            {offsetY>0&&<tr style={{height:offsetY}}><td colSpan={visibleCols.length} style={{padding:0,border:"none"}}/></tr>}
            {visibleRows.map((r,i)=>{
              const absI=startIdx+i;
              const customTooltip=typeof r._rowTooltipHtml==="function"?r._rowTooltipHtml(r):r._rowTooltipHtml;
              const hasTooltip=!disableTooltip&&(customTooltip||r.observaciones!==undefined);
              const rowBg=absI%2===0?"transparent":C.surface+"66";
              const tooltipKey=String(r._tooltipKey||r.codigo||r.id||absI);
              const makeTip=(event)=>({
                key:tooltipKey,
                x:event.clientX,
                y:event.clientY,
                customHtml:customTooltip||null,
                observaciones:String(r.observaciones??"")
              });
              return(
                <tr key={absI}
                  style={{background:rowBg,height:useVirtual?ROW_H:undefined,position:"relative",cursor:hasTooltip?"pointer":"default",transition:"background .1s"}}
                  onMouseEnter={e=>{
                    e.currentTarget.dataset.bg=rowBg;
                    e.currentTarget.style.background=C.accent+"22";
                    if(!hasTooltip||pinnedTip)return;
                    setHoverTip(makeTip(e));
                  }}
                  onMouseMove={e=>{
                    if(!hasTooltip||pinnedTip)return;
                    setHoverTip(current=>current?{...current,x:e.clientX,y:e.clientY}:makeTip(e));
                  }}
                  onMouseLeave={e=>{
                    e.currentTarget.style.background=e.currentTarget.dataset.bg||"transparent";
                    setHoverTip(null);
                  }}
                  onClick={e=>{
                    if(!hasTooltip)return;
                    setHoverTip(null);
                    setPinnedTip(current=>current?.key===tooltipKey?null:makeTip(e));
                  }}
                >
                  {visibleCols.map((c,j)=>{
                    const sticky=pinnedFirstCol&&j===0;
                    const colKey=c.key||c.label||String(j);
                    const effectiveWidth=colWidths[colKey]||c.width||c.minWidth||(c.wrap?140:undefined);
                    const rawCell=r[c.key];
                    const cellContent=c.render?c.render(rawCell,r):(rawCell??"—");
                    const linkLabel=String(c.label||c.key||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
                    const equipmentText=String(rawCell||"").trim();
                    const looksEquipmentCode=/^[A-Z]{2,6}[- ]?\d{3,6}(?:[- ][A-Z0-9]+)?$/i.test(equipmentText);
                    const equipmentColumn=linkLabel.includes("interno")||linkLabel.includes("codigo int")||linkLabel==="equipo"||linkLabel.includes("codigo equipo")||linkLabel.includes("maquina");
                    const equipmentLink=!c.render&&equipmentColumn&&looksEquipmentCode&&equipmentText;
                    return(
                    <td key={j} style={{padding:c.compact?"8px 6px":"8px 12px",borderBottom:`1px solid ${C.border}18`,color:C.text,whiteSpace:c.wrap?"normal":"nowrap",overflow:"hidden",textOverflow:"ellipsis",textAlign:c.align||"left",maxWidth:c.maxWidth||(c.wrap?undefined:300),minWidth:effectiveWidth,width:effectiveWidth,position:sticky?"sticky":undefined,left:sticky?0:undefined,zIndex:sticky?2:undefined,background:sticky?C.card:(c.color?c.color+"0a":undefined),boxShadow:sticky?`1px 0 0 ${C.border}`:undefined,verticalAlign:"top",lineHeight:1.25}}>{equipmentLink?<button type="button" title="Abrir ficha única del equipo" onClick={e=>{e.stopPropagation();window.dispatchEvent(new CustomEvent("dm-open-equipment-profile",{detail:{code:String(rawCell).trim()}}));}} style={{background:"none",border:"none",padding:0,color:C.blue,font:"inherit",fontWeight:800,cursor:"pointer",textDecoration:"underline",textDecorationColor:C.blue+"66"}}>{cellContent}</button>:cellContent}</td>
                    );
                  })}
                </tr>
              );
            })}
            {useVirtual&&endIdx<sortedRows.length&&<tr style={{height:(sortedRows.length-endIdx)*ROW_H}}><td colSpan={visibleCols.length} style={{padding:0,border:"none"}}/></tr>}
          </tbody>
        </table>
      </div>
      <TableRowTooltip tip={pinnedTip||hoverTip} pinned={Boolean(pinnedTip)} />
    </>
  );
}

export function tableSortValue(v){
  if(v===null||v===undefined)return "";
  if(typeof v==="boolean")return v?1:0;
  if(typeof v==="number")return v;
  const str=String(v).trim();
  if(!str)return "";
  const iso=normDate(str);
  if(iso)return iso;
  const num=toNumber(str);
  if(/^-?\d+(?:[.,]\d+)?$/.test(str.replace(/\s/g,"")))return num;
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
}
export function compareTableValues(a,b){
  const av=tableSortValue(a),bv=tableSortValue(b);
  if(av===""&&bv!=="")return 1;
  if(bv===""&&av!=="")return -1;
  if(av===""&&bv==="")return 0;
  if(typeof av==="number"&&typeof bv==="number")return av-bv;
  return String(av).localeCompare(String(bv),"es-AR",{sensitivity:"base"});
}
export function sortRowsForTable(rows,sort,getters={}){
  if(!sort?.key)return rows;
  const getter=getters[sort.key]||((r)=>r?.[sort.key]);
  return [...(rows||[])].sort((a,b)=>{
    const cmp=compareTableValues(getter(a),getter(b));
    return sort.dir==="desc"?-cmp:cmp;
  });
}
export function SortableTH({sortId,sortKey,sorts,setSorts,children,style,initialDir,...thProps}){
  const active=sorts?.[sortId]?.key===sortKey;
  const dir=sorts?.[sortId]?.dir||"asc";
  const firstDir=initialDir||"asc";
  return(
    <th {...thProps} onClick={()=>setSorts(prev=>{
      const cur=prev?.[sortId];
      if(cur?.key===sortKey){
        if(cur.dir==="asc")return {...prev,[sortId]:{key:sortKey,dir:"desc"}};
        else{const next={...prev};delete next[sortId];return next;}
      }
      return {...prev,[sortId]:{key:sortKey,dir:firstDir}};
    })} style={{...style,cursor:"pointer",userSelect:"none",color:active?C.accent:(style?.color||C.textSub)}}>
      {children}{active?(dir==="asc"?" ↑":" ↓"):""}
    </th>
  );
}

export function Sel({label,value,onChange,options}){
  // Si el valor actual no existe en las opciones, caer al default (primera opción)
  const safeValue=options.some(o=>o.value===value)?value:(options[0]?.value??value);
  const defaultVal=options[0]?.value;
  const isActive=defaultVal!==undefined&&safeValue!==defaultVal;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:3}}>
      <label style={{fontSize:10,color:C.textMuted,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase"}}>{label}</label>
      <div style={{position:"relative",display:"flex"}}>
        {isActive&&(
          <button onClick={()=>onChange(defaultVal)} title="Limpiar filtro" aria-label="Limpiar filtro"
            style={{position:"absolute",left:5,top:"50%",transform:"translateY(-50%)",width:15,height:15,display:"flex",alignItems:"center",justifyContent:"center",background:C.red+"33",border:"none",borderRadius:"50%",color:C.red,cursor:"pointer",fontSize:10,fontWeight:700,lineHeight:1,padding:0,zIndex:2}}>
            ×
          </button>
        )}
        <select value={safeValue} onChange={e=>onChange(e.target.value)} style={{background:C.surface,border:`1px solid ${isActive?C.accent+"55":C.border}`,borderRadius:7,color:C.text,padding:`7px 10px 7px ${isActive?26:10}px`,fontSize:12,cursor:"pointer",outline:"none",minWidth:120,width:"100%"}}>
          {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    </div>
  );
}

export function multiDefault(options){return options?.[0]?.value ?? "todos";}
export function normalizeMultiValue(value, options){
  const def=multiDefault(options);
  const valid=new Set((options||[]).map(o=>o.value));
  if(Array.isArray(value)){
    const arr=value.filter(v=>v!==def&&valid.has(v));
    const realOpts=(options||[]).filter(o=>o.value!==def);
    // Un arreglo vacío representa "ninguna opción seleccionada".
    // Si están seleccionadas todas las opciones reales, se normaliza a "Todos".
    if(arr.length>=realOpts.length&&realOpts.length>0)return def;
    return arr;
  }
  if(!value||value===def||!valid.has(value))return def;
  return [value];
}
export function multiIsAll(value, def="todos"){
  return !Array.isArray(value)||value.includes(def);
}
export function multiIncludes(value, item, def="todos"){
  if(multiIsAll(value,def))return true;
  return value.includes(item);
}
export function matchMulti(item, value, def="todos"){
  return multiIncludes(value,item,def);
}
export function multiSummary(value, options){
  const def=multiDefault(options);
  const normalized=normalizeMultiValue(value,options);
  if(!Array.isArray(normalized))return (options.find(o=>o.value===def)?.label)||"Todos";
  const labels=normalized.map(v=>(options.find(o=>o.value===v)?.label)||v);
  if(labels.length===0)return "0 seleccionados";
  if(labels.length===1)return labels[0];
  const joined=labels.join(", ");
  return joined.length<=34?joined:`${labels.length} seleccionados`;
}
export function multiSelectedLabels(value, options){
  const normalized=normalizeMultiValue(value,options);
  if(!Array.isArray(normalized))return [];
  return normalized.map(v=>({value:v,label:(options.find(o=>o.value===v)?.label)||v}));
}
export function dmNormalizeAssignedProject(v){
  const raw=String(v||"TODO").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  if(!raw||raw==="TODO"||raw==="TODOS"||raw==="ALL")return "TODO";
  if(raw==="FS"||raw==="FDS"||raw.includes("FILO DEL SOL"))return "FILO DEL SOL";
  if(raw==="JM"||raw.includes("JOSE MARIA"))return "JOSE MARIA";
  return raw;
}
export function dmAssignedProject(){
  try{return dmNormalizeAssignedProject(sessionStorage.getItem("dm_project")||"TODO");}
  catch(_){return "TODO";}
}
export function dmProjectMatches(value,assigned=dmAssignedProject()){
  const a=dmNormalizeAssignedProject(assigned);
  if(a==="TODO")return true;
  return dmNormalizeAssignedProject(value)===a;
}

export function MultiSel({label,value,onChange,options,commitOnClose=false,commitDelay=180}){
  const[open,setOpen]=useState(false);
  const[search,setSearch]=useState("");
  // Valor local: permite marcar varias opciones sin cerrar el desplegable ni recalcular toda la pantalla en cada click.
  const[draftValue,setDraftValue]=useState(value);
  const[tipOpen,setTipOpen]=useState(false);
  const draftRef=useRef(value);
  const ref=useRef(null);
  const commitRef=useRef(null);
  const searchRef=useRef(null);
  const btnRef=useRef(null);
  const[menuPos,setMenuPos]=useState(null);

  const calcMenuPosition=useCallback(()=>{
    if(typeof window==="undefined")return null;
    const el=btnRef.current||ref.current;
    if(!el)return null;
    const r=el.getBoundingClientRect();
    const margin=8;
    const width=Math.min(360,Math.max(240,r.width));
    let left=Math.min(Math.max(margin,r.left),Math.max(margin,window.innerWidth-width-margin));
    let top=r.bottom+6;
    let maxHeight=Math.min(320,window.innerHeight-top-margin);
    if(maxHeight<180&&r.top>(window.innerHeight-r.bottom)){
      maxHeight=Math.min(320,Math.max(180,r.top-margin-6));
      top=Math.max(margin,r.top-maxHeight-6);
    }
    maxHeight=Math.max(160,Math.min(320,maxHeight));
    if(top+maxHeight>window.innerHeight-margin)top=Math.max(margin,window.innerHeight-margin-maxHeight);
    return{top,left,width,maxHeight};
  },[]);

  const def=multiDefault(options);
  const displayValue=open?draftValue:value;
  const selected=normalizeMultiValue(displayValue,options);
  const selectedLabels=multiSelectedLabels(displayValue,options);
  const isActive=Array.isArray(selected)&&selected.length>0;
  const realOptions=useMemo(()=>(options||[]).filter(o=>o.value!==def),[options,def]);
  // Cuando el filtro está en “Todos”, todas las opciones se muestran tildadas.
  // Al destildar una opción desde ese estado, quedan seleccionadas todas las demás.
  const selectedArr=Array.isArray(selected)?selected:realOptions.map(o=>o.value);
  const searchNorm=String(search||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
  const filteredOptions=useMemo(()=>{
    if(!searchNorm)return realOptions;
    return realOptions.filter(o=>String(o.label||o.value||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").includes(searchNorm));
  },[realOptions,searchNorm]);
  // Para que abrir un filtro grande no congele la app, se renderiza una cantidad acotada.
  // Al buscar, filtra sobre todas las opciones y vuelve a mostrar las primeras coincidencias.
  const MAX_RENDER_OPTIONS=100;
  const visibleOptions=filteredOptions.slice(0,MAX_RENDER_OPTIONS);
  const hiddenCount=Math.max(0,filteredOptions.length-visibleOptions.length);

  useEffect(()=>{
    if(!open)setDraftValue(value);
  },[value,open]);

  useEffect(()=>{
    draftRef.current=draftValue;
  },[draftValue]);

  useEffect(()=>()=>{
    if(commitRef.current)clearTimeout(commitRef.current);
  },[]);

  useEffect(()=>{
    if(open&&searchRef.current){
      const id=setTimeout(()=>searchRef.current&&searchRef.current.focus(),0);
      return()=>clearTimeout(id);
    }
  },[open]);

  useEffect(()=>{
    if(!open)return;
    const update=()=>setMenuPos(calcMenuPosition());
    update();
    window.addEventListener("resize",update,true);
    window.addEventListener("scroll",update,true);
    return()=>{
      window.removeEventListener("resize",update,true);
      window.removeEventListener("scroll",update,true);
    };
  },[open,calcMenuPosition]);

  const commitNow=useCallback((next)=>{
    if(commitRef.current){clearTimeout(commitRef.current);commitRef.current=null;}
    const a=JSON.stringify(normalizeMultiValue(next,options));
    const b=JSON.stringify(normalizeMultiValue(value,options));
    if(a===b)return;
    // Cambiar el valor final puede recalcular tablas grandes. Se difiere para no bloquear el click.
    const run=()=>onChange(next);
    if(typeof window!=="undefined"&&window.requestIdleCallback)window.requestIdleCallback(run,{timeout:300});
    else setTimeout(run,0);
  },[onChange,options,value]);

  const commitValue=useCallback((next)=>{
    setDraftValue(next);
    draftRef.current=next;
    if(commitRef.current){clearTimeout(commitRef.current);commitRef.current=null;}
    if(commitOnClose)return;
    commitRef.current=setTimeout(()=>commitNow(next),commitDelay);
  },[commitNow,commitOnClose,commitDelay]);

  const closeMenu=useCallback(()=>{
    if(commitOnClose)commitNow(draftRef.current);
    setOpen(false);
    setMenuPos(null);
    setSearch("");
  },[commitOnClose,commitNow]);

  useEffect(()=>{
    const handler=e=>{
      if(ref.current&&ref.current.contains(e.target))return;
      closeMenu();
    };
    document.addEventListener("mousedown",handler);
    return()=>{
      document.removeEventListener("mousedown",handler);
      if(commitRef.current)clearTimeout(commitRef.current);
    };
  },[closeMenu]);

  const emit=(arr)=>{
    const clean=arr.filter(Boolean).filter(v=>v!==def);
    if(clean.length>=realOptions.length&&realOptions.length>0)commitValue(def);
    else commitValue(clean);
  };
  const toggle=(v)=>{
    if(v===def){commitValue(def);return;}
    const set=new Set(selectedArr);
    if(set.has(v))set.delete(v);else set.add(v);
    emit([...set]);
  };
  const allChecked=!Array.isArray(selected);

  const menu=open&&menuPos?ReactDOM.createPortal((
    <div data-multisel-menu="true" onMouseDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} style={{position:"fixed",top:menuPos.top,left:menuPos.left,zIndex:2147483000,width:menuPos.width,maxWidth:360,maxHeight:menuPos.maxHeight,overflow:"auto",overscrollBehavior:"contain",background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,boxShadow:"0 18px 50px rgba(0,0,0,.82)",padding:6,contain:"layout paint",willChange:"transform",isolation:"isolate"}}>
      <label style={{display:"flex",alignItems:"center",gap:8,padding:"7px 8px",borderRadius:6,cursor:"pointer",fontSize:12,color:allChecked?C.accent:C.textSub,fontWeight:allChecked?700:500}}>
        <input type="checkbox" checked={allChecked} onChange={()=>commitValue(allChecked?[]:def)} style={{accentColor:C.accent}}/>
        Todos
      </label>
      <div style={{height:1,background:C.border,margin:"4px 0"}}/>
      <input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar..." style={{width:"100%",boxSizing:"border-box",background:"rgba(255,255,255,.05)",border:`1px solid ${C.border}`,borderRadius:7,color:C.text,padding:"7px 8px",fontSize:12,outline:"none",margin:"3px 0 6px",fontFamily:"Inter"}}/>
      {visibleOptions.length?visibleOptions.map(o=>(
        <label key={o.value} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 8px",borderRadius:6,cursor:"pointer",fontSize:12,color:selectedArr.includes(o.value)?C.text:C.textSub}}>
          <input type="checkbox" checked={selectedArr.includes(o.value)} onChange={()=>toggle(o.value)} style={{accentColor:C.accent}}/>
          <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.label}</span>
        </label>
      )):<div style={{padding:"9px 8px",fontSize:12,color:C.textMuted}}>Sin resultados</div>}
      {hiddenCount>0&&(
        <div style={{padding:"7px 8px",fontSize:11,color:C.textMuted,borderTop:`1px solid ${C.border}55`,marginTop:4}}>
          Mostrando {visibleOptions.length} de {filteredOptions.length}. Usá el buscador para encontrar el resto.
        </div>
      )}
      {commitOnClose&&<div style={{display:"flex",gap:6,position:"sticky",bottom:0,background:C.surface,borderTop:`1px solid ${C.border}`,padding:"7px 4px 2px",marginTop:4}}>
        <button onClick={closeMenu} style={{flex:1,border:`1px solid ${C.accent}66`,background:C.redDim,color:C.accent,borderRadius:7,padding:"7px 8px",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"Inter"}}>Aplicar</button>
        <button onClick={()=>{setDraftValue(value);draftRef.current=value;setOpen(false);setMenuPos(null);setSearch("");}} style={{border:`1px solid ${C.border}`,background:"transparent",color:C.textSub,borderRadius:7,padding:"7px 8px",fontSize:12,cursor:"pointer",fontFamily:"Inter"}}>Cancelar</button>
      </div>}
    </div>
  ),document.body):null;

  const ocultarProyectoAsignado=dmAssignedProject()!=="TODO"&&String(label||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")==="proyecto";
  if(ocultarProyectoAsignado)return null;

  return(
    <div ref={ref} style={{display:"flex",flexDirection:"column",gap:3,position:"relative",minWidth:130,zIndex:open?1000000:1,overflow:"visible"}}>
      <label style={{fontSize:10,color:C.textMuted,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase"}}>{label}</label>
      <div style={{position:"relative",display:"flex"}}>
        {isActive&&(
          <button onClick={(e)=>{e.stopPropagation();setDraftValue(def);draftRef.current=def;commitNow(def);if(open){setOpen(false);setMenuPos(null);}}} title="Limpiar filtro" aria-label="Limpiar filtro"
            style={{position:"absolute",left:5,top:"50%",transform:"translateY(-50%)",width:15,height:15,display:"flex",alignItems:"center",justifyContent:"center",background:C.red+"33",border:"none",borderRadius:"50%",color:C.red,cursor:"pointer",fontSize:10,fontWeight:700,lineHeight:1,padding:0,zIndex:2}}>
            ×
          </button>
        )}
        <button type="button"
          ref={btnRef}
          onMouseEnter={()=>setTipOpen(true)}
          onMouseLeave={()=>setTipOpen(false)}
          onClick={()=>{if(open){closeMenu();return;}setDraftValue(value);draftRef.current=value;setTipOpen(false);const pos=calcMenuPosition();setMenuPos(pos);if(pos)setOpen(true);}}
          style={{background:C.surface,border:`1px solid ${isActive?C.accent+"55":C.border}`,borderRadius:7,color:C.text,padding:`7px 28px 7px ${isActive?26:10}px`,fontSize:12,cursor:"pointer",outline:"none",minWidth:130,width:"100%",textAlign:"left",fontFamily:"Inter",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
          {multiSummary(displayValue,options)}
        </button>
        <Icon name="chevronDown" size={15} color={C.textMuted} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}/>
      </div>
      {isActive&&tipOpen&&!open&&(
        <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,zIndex:999999,minWidth:220,maxWidth:360,maxHeight:260,overflow:"auto",background:C.card,border:`1px solid ${C.border}`,borderRadius:9,boxShadow:"0 16px 45px rgba(0,0,0,.75)",padding:"10px 12px",pointerEvents:"none"}}>
          <div style={{fontSize:10,color:C.textMuted,textTransform:"uppercase",letterSpacing:".06em",fontWeight:700,marginBottom:7}}>{label} aplicado</div>
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            {selectedLabels.slice(0,30).map(item=>(
              <div key={item.value} style={{display:"flex",alignItems:"center",gap:7,fontSize:12,color:C.text,lineHeight:1.25}}>
                <span style={{color:C.accent,fontWeight:900}}>✓</span>
                <span>{item.label}</span>
              </div>
            ))}
            {selectedLabels.length>30&&<div style={{fontSize:11,color:C.textMuted}}>+ {selectedLabels.length-30} más</div>}
          </div>
        </div>
      )}
      {menu}
    </div>
  );
}
export function DateIn({label,value,onChange,min,max,warn,disabled=false}){
  return(
    <div style={{display:"flex",flexDirection:"column",gap:3}}>
      <label style={{fontSize:10,color:warn?C.red:C.textMuted,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase"}}>{label}{warn?` ⚠ ${warn}`:""}</label>
      <input type="date" value={value} min={min} max={max} disabled={disabled} onChange={e=>!disabled&&onChange(e.target.value)} style={{background:C.surface,border:`1px solid ${warn?C.red:C.border}`,borderRadius:7,color:disabled?C.textMuted:C.text,padding:"7px 10px",fontSize:12,outline:"none",opacity:disabled?0.75:1,cursor:disabled?"not-allowed":"auto"}}/>
    </div>
  );
}

export const MONTH_OPTIONS=[
  {value:"",label:"Mes"},
  {value:"01",label:"Enero"},{value:"02",label:"Febrero"},{value:"03",label:"Marzo"},
  {value:"04",label:"Abril"},{value:"05",label:"Mayo"},{value:"06",label:"Junio"},
  {value:"07",label:"Julio"},{value:"08",label:"Agosto"},{value:"09",label:"Septiembre"},
  {value:"10",label:"Octubre"},{value:"11",label:"Noviembre"},{value:"12",label:"Diciembre"},
];
export const YEAR_OPTIONS=[{value:"",label:"Año"},{value:"2026",label:"2026"},{value:"2027",label:"2027"},{value:"2028",label:"2028"}];
export function PeriodMonthYear({fechaD,fechaH,setFechaD,setFechaH}){
  // El mes representa el período operativo: 26 del mes anterior → 25 del mes seleccionado.
  const selectedMonth=fechaH&&String(fechaH).slice(8,10)==="25"?String(fechaH).slice(5,7):"";
  const selectedYear=fechaH&&selectedMonth?String(fechaH).slice(0,4):(fechaD?String(fechaD).slice(0,4):"");
  const apply=(year,month)=>{
    const now=new Date();
    const y=year||String(now.getFullYear());
    if(!month){
      // Solo año seleccionado: rango = año completo (no forzar un mes)
      setFechaD(`${y}-01-01`);
      setFechaH(`${y}-12-31`);
      return;
    }
    const endYear=Number(y);
    const endMonth=Number(month);
    const start=new Date(endYear,endMonth-2,26,12);
    const end=new Date(endYear,endMonth-1,25,12);
    const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    setFechaD(iso(start));
    setFechaH(iso(end));
  };
  const clearPeriodo=()=>{setFechaD("");setFechaH("");};
  return(
    <>
      <Sel label="Mes" value={selectedMonth} onChange={m=>m?apply(selectedYear,m):clearPeriodo()} options={MONTH_OPTIONS}/>
      <Sel label="Año" value={selectedYear} onChange={y=>y?apply(y,selectedMonth):clearPeriodo()} options={YEAR_OPTIONS}/>
    </>
  );
}
export function ChartTip({active,payload,label}){
  if(!active||!payload?.length)return null;
  return(
    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",fontSize:12}}>
      {label&&<div style={{color:C.textSub,marginBottom:4,fontWeight:600,fontSize:11}}>{label}</div>}
      {payload.map((p,i)=><div key={i} style={{color:p.color||C.accent,fontWeight:600}}>{p.name}: {fmtNum(p.value)}</div>)}
    </div>
  );
}
export function TabBtn({active,onClick,children}){return<button onClick={onClick} style={{padding:"7px 14px",borderRadius:7,border:`1px solid ${active?"transparent":"rgba(255,255,255,0.18)"}`,cursor:"pointer",background:active?C.accent:"rgba(28,28,28,0.82)",color:active?"#fff":C.text,fontFamily:"Inter",fontWeight:600,fontSize:12,transition:"all .2s",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)"}}>{children}</button>;}
export function SubTab({active,onClick,children}){return<button onClick={onClick} style={{padding:"7px 0",border:"none",background:"none",cursor:"pointer",color:active?C.accent:C.textSub,fontFamily:"Inter",fontWeight:600,fontSize:12,borderBottom:`2px solid ${active?C.accent:"transparent"}`,transition:"all .15s",marginRight:18}}>{children}</button>;}
export function AlertBanner({type="warn",children}){
  const m={warn:[C.yellow,C.yellowDim],error:[C.red,C.redDim],success:[C.green,C.greenDim],info:[C.blue,C.blueDim]};
  const[col,bg]=m[type]||m.warn;
  return<div style={{display:"flex",alignItems:"flex-start",gap:8,padding:"10px 14px",background:bg,border:`1px solid ${col}44`,borderRadius:9,fontSize:12,color:C.text}}><Icon name="warn" size={14} color={col} style={{flexShrink:0,marginTop:1}}/><span>{children}</span></div>;
}
// ─── Fetch Google Apps Script: carga liviana y bajo demanda ──────────────────
