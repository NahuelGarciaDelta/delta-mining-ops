import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import { positionTip } from "../../shared/dom.js";
import { ICON_PATHS } from "../../shared/icons.js";
import { fmtNum, normDate, toNumber } from "../../shared/formatters.js";

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
export function LoadingMotoniveladora({size=72,label=""}){return <div style={{display:"inline-flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8}}><img src="/loader.gif" alt="Cargando" style={{width:size,height:"auto",maxWidth:"82vw",maxHeight:"58vh",objectFit:"contain",display:"block"}}/>{label?<div style={{color:C.text,fontSize:13,fontWeight:900,textAlign:"center"}}>{label}</div>:null}</div>;}
export function Spinner({size=24}){return <LoadingMotoniveladora size={Math.max(28,size)}/>;}
export function Badge({children,color=C.accent}){return<span style={{display:"inline-block",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:600,color,background:color+"22",border:`1px solid ${color}33`}}>{children}</span>;}
export function StatCard({icon,value,label,sub,color=C.accent,valueColor,small}){
  const valCol=valueColor||color;
  return(
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:small?"12px 14px":"16px 18px",display:"flex",flexDirection:"column",gap:5,position:"relative",overflow:"hidden",boxShadow:`0 0 24px ${color}0d`}}>
      <div style={{position:"absolute",top:-8,right:-8,width:56,height:56,background:color+"15",borderRadius:"50%"}}/>
      <div style={{display:"flex",alignItems:"center",gap:7}}>
        <div style={{background:color+"20",borderRadius:7,padding:5,display:"flex"}}><Icon name={icon} size={14} color={color}/></div>
        <span style={{fontSize:12,color:C.textSub,fontWeight:600}}>{label}</span>
      </div>
      <div style={{fontFamily:"Inter,sans-serif",fontSize:small?26:34,fontWeight:800,color:valCol,lineHeight:1,letterSpacing:"-0.02em"}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:C.textMuted}}>{sub}</div>}
    </div>
  );
}
export function Card({children,style,title,action}){
  return(
    <div style={{background:"rgba(28,28,28,0.82)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",border:`1px solid ${C.border}55`,borderRadius:12,overflow:"visible",...style}}>
      {title&&<div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
        <span style={{fontFamily:"Inter",fontWeight:700,fontSize:13,color:C.text}}>{title}</span>
        {action}
      </div>}
      {children}
    </div>
  );
}
export function Table({cols,rows,maxH=380,emptyMsg="Sin datos",stickyFirst=false,disableTooltip=false}){
  const ROW_H=36;
  const[scrollTop,setScrollTop]=useState(0);
  const[sortKey,setSortKey]=useState(null);
  const[sortDir,setSortDir]=useState("asc");
  const pinnedTipKeyRef=useRef(null);

  // FIX VIBRACIÓN DE TABLAS:
  // La virtualización anterior asumía filas de 36px. Cuando una columna tenía wrap
  // (por ejemplo "Tarea (ROP02)"), las filas reales eran más altas. Al llegar al
  // final del scroll, React recalculaba spacer + ancho de scrollbar y la tabla
  // empezaba a moverse de izquierda a derecha. Para tablas con texto multilínea
  // se desactiva la virtualización y se deja el layout estable.
  const hasWrappedCols=useMemo(()=>cols.some(c=>c.wrap),[cols]);
  const useVirtual=rows.length>250&&!hasWrappedCols;
  const onScroll=useCallback(e=>{
    if(useVirtual)setScrollTop(e.target.scrollTop);
  },[useVirtual]);

  // Ordenamiento global para TODAS las tablas:
  // Primer clic = menor a mayor para números/fechas y A→Z para textos.
  const colSortId=useCallback((c,i)=>c.sortKey||c.key||`__col_${i}` ,[]);

  // IMPORTANTE: esta función debe declararse ANTES de detectInitialDir.
  // Si queda después, React evalúa el array de dependencias de detectInitialDir
  // mientras normalizeSortValue todavía está en zona temporal muerta y la vista queda en blanco.
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
    const sortCol=cols.find((c,i)=>colSortId(c,i)===key);
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
  },[cols,rows,colSortId,normalizeSortValue]);
  const handleSort=useCallback((key)=>{
    if(sortKey===key){
      if(sortDir==="asc")setSortDir("desc");
      else{setSortKey(null);setSortDir("asc");}
    }else{setSortKey(key);setSortDir(detectInitialDir(key));}
  },[sortKey,sortDir,detectInitialDir]);

  const sortedRows=useMemo(()=>{
    if(!sortKey)return rows;
    const sortCol=cols.find((c,i)=>colSortId(c,i)===sortKey);
    if(!sortCol)return rows;
    const getSortValue=(row)=>{
      if(typeof sortCol.sortValue==="function")return sortCol.sortValue(row);
      if(sortCol.sortKey&&row[sortCol.sortKey]!==undefined)return row[sortCol.sortKey];
      if(sortCol.key&&row[sortCol.key]!==undefined)return row[sortCol.key];
      return "";
    };
    return [...rows].sort((a,b)=>{
      const av=normalizeSortValue(getSortValue(a));
      const bv=normalizeSortValue(getSortValue(b));
      if(av.type==="empty"&&bv.type!=="empty")return 1;
      if(bv.type==="empty"&&av.type!=="empty")return -1;
      let cmp=0;
      if((av.type==="number"&&bv.type==="number")||(av.type==="date"&&bv.type==="date"))cmp=av.value-bv.value;
      else cmp=String(av.value).localeCompare(String(bv.value),"es-AR",{sensitivity:"base"});
      return sortDir==="asc"?cmp:-cmp;
    });
  },[rows,cols,sortKey,sortDir,colSortId,normalizeSortValue]);

  const bufferRows=8;
  const visibleCount=Math.ceil(maxH/ROW_H);
  const startIdx=useVirtual?Math.max(0,Math.floor(scrollTop/ROW_H)-bufferRows):0;
  const endIdx=useVirtual?Math.min(sortedRows.length,startIdx+visibleCount+bufferRows*2):sortedRows.length;
  const visibleRows=sortedRows.slice(startIdx,endIdx);
  const offsetY=useVirtual?startIdx*ROW_H:0;

  if(rows.length===0)return(
    <div style={{padding:"28px",textAlign:"center",color:C.textMuted,fontSize:12}}>{emptyMsg}</div>
  );

  const tableMinWidth=cols.reduce((sum,c)=>{
    const raw=c.width||c.minWidth||c.maxWidth||(c.wrap?140:120);
    const n=typeof raw==="number"?raw:parseFloat(String(raw),10);
    return sum+(Number.isFinite(n)?n:120);
  },0);

  return(
    <div className="dm-table-scroll" onScroll={onScroll} style={{overflowX:"auto",overflowY:"auto",maxHeight:maxH,scrollbarGutter:"stable",overscrollBehavior:"contain",contain:"layout paint",transform:"translateZ(0)"}}>
      <table style={{width:"100%",minWidth:tableMinWidth,borderCollapse:"separate",borderSpacing:0,fontSize:12,tableLayout:"fixed"}}>
        <thead><tr>{cols.map((c,i)=>{
          const sticky=stickyFirst&&i===0;
          const sKey=colSortId(c,i);
          return(
          <th key={i} data-dm-managed-sort="true" onClick={()=>handleSort(sKey)}
            style={{padding:c.compact?"9px 6px":"9px 12px",textAlign:c.align||"left",position:"sticky",top:0,left:sticky?0:undefined,zIndex:sticky?4:3,background:c.headerBg||(c.color?c.color+"22":C.surface),color:sortKey===sKey?C.accent:C.textSub,fontWeight:600,fontSize:10,letterSpacing:".06em",textTransform:"uppercase",borderBottom:`2px solid ${c.color?c.color+"66":C.border}`,whiteSpace:c.wrap?"normal":"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:c.width||c.maxWidth||(c.wrap?140:undefined),minWidth:c.width||c.minWidth,width:c.width||c.minWidth||(c.wrap?140:undefined),lineHeight:1.3,cursor:"pointer",userSelect:"none",boxShadow:sticky?`1px 0 0 ${C.border}`:undefined}}>
            {c.label}{sortKey===sKey?(sortDir==="asc"?" ↑":" ↓"):""}
          </th>
          );
        })}</tr></thead>
        <tbody>
          {offsetY>0&&<tr style={{height:offsetY}}><td colSpan={cols.length} style={{padding:0,border:"none"}}/></tr>}
          {visibleRows.map((r,i)=>{
            const absI=startIdx+i;
            const customTooltip=typeof r._rowTooltipHtml==="function"?r._rowTooltipHtml(r):r._rowTooltipHtml;
            const hasTooltip=!disableTooltip&&(customTooltip||r.observaciones!==undefined);
            const rowBg=absI%2===0?"transparent":C.surface+"66";
            const tooltipKey=String(r._tooltipKey||r.codigo||r.id||absI);
            const buildTooltipHtml=()=>customTooltip||("<div><span style=\"font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.06em\">Observaciones</span><div style=\"color:"+(r.observaciones?"#ccc":"#555")+";margin-top:3px;font-style:"+(r.observaciones?"normal":"italic")+"\">"+(r.observaciones||"Sin observaciones")+"</div></div>");
            return(
              <tr key={absI}
                style={{background:rowBg,height:useVirtual?ROW_H:undefined,position:"relative",cursor:hasTooltip?"pointer":"default",transition:"background .1s"}}
                onMouseEnter={e=>{
                  e.currentTarget.dataset.bg=rowBg;
                  e.currentTarget.style.background=C.accent+"22";
                  if(!hasTooltip||pinnedTipKeyRef.current)return;
                  const old=document.getElementById("row-tip-hover");if(old)old.remove();
                  const tip=document.createElement("div");
                  tip.id="row-tip-hover";
                  tip.style.cssText=`position:fixed;z-index:9999;background:${C.surface};border:1px solid ${C.border};border-radius:10px;padding:12px 16px;font-size:12px;font-family:Inter,sans-serif;max-width:390px;box-shadow:0 8px 32px rgba(0,0,0,.5);pointer-events:none;visibility:hidden`;
                  tip.innerHTML=buildTooltipHtml();
                  positionTip(tip,e.clientX,e.clientY);
                }}
                onMouseLeave={e=>{
                  e.currentTarget.style.background=e.currentTarget.dataset.bg||"transparent";
                  const t=document.getElementById("row-tip-hover");if(t)t.remove();
                }}
                onClick={e=>{
                  if(!hasTooltip)return;
                  const current=document.getElementById("row-tip-pinned");
                  if(pinnedTipKeyRef.current===tooltipKey){
                    if(current)current.remove();
                    pinnedTipKeyRef.current=null;
                    return;
                  }
                  if(current)current.remove();
                  const hover=document.getElementById("row-tip-hover");if(hover)hover.remove();
                  const tip=document.createElement("div");
                  tip.id="row-tip-pinned";
                  tip.style.cssText=`position:fixed;z-index:10000;background:${C.surface};border:1px solid ${C.red};border-radius:10px;padding:12px 16px;font-size:12px;font-family:Inter,sans-serif;max-width:390px;box-shadow:0 10px 36px rgba(0,0,0,.65);pointer-events:auto;visibility:hidden`;
                  tip.innerHTML=buildTooltipHtml()+`<div style="margin-top:8px;padding-top:7px;border-top:1px solid ${C.border};font-size:10px;color:${C.textMuted};font-weight:700">Click nuevamente en la fila para desfijar</div>`;
                  pinnedTipKeyRef.current=tooltipKey;
                  positionTip(tip,e.clientX,e.clientY);
                }}
              >
                {cols.map((c,j)=>{
                  const sticky=stickyFirst&&j===0;
                  return(
                  <td key={j} style={{padding:c.compact?"8px 6px":"8px 12px",borderBottom:`1px solid ${C.border}18`,color:C.text,whiteSpace:c.wrap?"normal":"nowrap",overflow:"hidden",textOverflow:"ellipsis",textAlign:c.align||"left",maxWidth:c.maxWidth||(c.wrap?undefined:300),minWidth:c.width||c.minWidth,width:c.width||c.minWidth||(c.wrap?140:undefined),position:sticky?"sticky":undefined,left:sticky?0:undefined,zIndex:sticky?2:undefined,background:sticky?C.card:(c.color?c.color+"0a":undefined),boxShadow:sticky?`1px 0 0 ${C.border}`:undefined,verticalAlign:"top",lineHeight:1.25}}>{c.render?c.render(r[c.key],r):(r[c.key]??"—")}</td>
                  );
                })}
              </tr>
            );
          })}
          {useVirtual&&endIdx<sortedRows.length&&<tr style={{height:(sortedRows.length-endIdx)*ROW_H}}><td colSpan={cols.length} style={{padding:0,border:"none"}}/></tr>}
        </tbody>
      </table>
    </div>
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
  const sameMonth=fechaD&&fechaH&&fechaD.slice(0,7)===fechaH.slice(0,7);
  const selectedMonth=sameMonth?String(fechaD).slice(5,7):"";
  const selectedYear=fechaD?String(fechaD).slice(0,4):"";
  const apply=(year,month)=>{
    const now=new Date();
    const y=year||String(now.getFullYear());
    if(!month){
      // Solo año seleccionado: rango = año completo (no forzar un mes)
      setFechaD(`${y}-01-01`);
      setFechaH(`${y}-12-31`);
      return;
    }
    const lastDay=new Date(Number(y),Number(month),0).getDate();
    setFechaD(`${y}-${month}-01`);
    setFechaH(`${y}-${month}-${String(lastDay).padStart(2,"0")}`);
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
// ─── HelpTip ──────────────────────────────────────────────────────────────────
// Ícono "?" con tooltip explicativo, para desambiguar siglas (ROP02, ROP05,
// RMA15, ICHC, TD/TN, etc.) a usuarios nuevos sin necesidad de manual.
export function HelpTip({text}){
  const[open,setOpen]=useState(false);
  const[pos,setPos]=useState({x:0,y:0});
  const W=300;
  const H=150;
  const move=e=>setPos({x:e.clientX,y:e.clientY});
  const left=Math.max(12,Math.min((pos.x||0)+12,window.innerWidth-W-12));
  const top=Math.max(12,Math.min((pos.y||0)+12,window.innerHeight-H-12));

  return(
    <span style={{position:"relative",display:"inline-flex",alignItems:"center"}}
      onMouseEnter={e=>{setOpen(true);move(e);}}
      onMouseMove={move}
      onMouseLeave={()=>setOpen(false)}>
      <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:16,height:16,borderRadius:"50%",background:C.surface,border:`1px solid ${C.border}`,color:C.textMuted,fontSize:10,fontWeight:700,cursor:"help",userSelect:"none"}}>?</span>
      {open&&ReactDOM.createPortal(
        <div style={{
          position:"fixed",
          left,
          top,
          zIndex:2147483647,
          width:W,
          maxWidth:"calc(100vw - 24px)",
          padding:"10px 12px",
          background:C.card,
          border:`1px solid ${C.border}`,
          borderRadius:8,
          boxShadow:"0 12px 36px rgba(0,0,0,0.65)",
          fontSize:11,
          fontWeight:400,
          lineHeight:1.5,
          color:C.textSub,
          whiteSpace:"normal",
          pointerEvents:"none"
        }}>
          {text}
        </div>,
        document.body
      )}
    </span>
  );
}
// ─── Fetch Google Apps Script: carga liviana y bajo demanda ──────────────────
