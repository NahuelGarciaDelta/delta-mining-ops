import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import * as XLSX from "xlsx";
import {
  LICITACION_PLANILLAS_BASE,
  LICITACION_PLANILLAS_OCULTAS_BASE,
  LICITACION_PLANILLA_BY_TAB,
  LICITACION_PLANILLA_CELDAS_MANUALES,
  LICITACION_PLANILLA_FORMULAS,
} from "./licitacionPlanillasData.js";
import { AcquisitionCostSelector, LICITACIONES_STORAGE_KEY, createEmptyTender, loadLocalTenders, normalizeTender } from "./licitacionesState.jsx";

// Dependencias compartidas inyectadas desde App mientras se completa la modularización.
let __deps = {};


function LicitacionesView({listaEquipos=[],rop02All=[],rma15=[],usdRate=1,initialTab="nueva"}){
  const { APPS_SCRIPT_URL, C, Icon, Spinner, MultiSel, multiIsAll, appAlert, appConfirm, dmNormKey, canonicalEquivalentMachineCode, cleanMachine, mainMachineCode } = __deps;
  const STORAGE_KEY=LICITACIONES_STORAGE_KEY;
  const emptyTender=createEmptyTender;
  const[licitaciones,setLicitaciones]=useState(loadLocalTenders);
  const[activeId,setActiveId]=useState("");
  const[tab,setTab]=useState(initialTab||"nueva");
  const[licitacionesReady,setLicitacionesReady]=useState(false);
  const[licitacionesSaving,setLicitacionesSaving]=useState(false);
  const[licitacionesError,setLicitacionesError]=useState("");
  const lastSavedRef=useRef(new Map());
  const saveTimersRef=useRef(new Map());
  const postLicitaciones=useCallback(async(payload)=>{
    const res=await fetch(APPS_SCRIPT_URL,{method:"POST",cache:"no-store",redirect:"follow",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},body:new URLSearchParams({payload:JSON.stringify(payload)}).toString()});
    if(!res.ok)throw new Error(`Error HTTP ${res.status}`);
    const json=await res.json();
    if(!json.ok)throw new Error(json?.error?.message||"No se pudo guardar la licitación.");
    return json;
  },[]);
  const guardarLicitacion=useCallback(async(lic,{silent=false}={})=>{
    if(!lic?.id)return;
    const signature=JSON.stringify(lic);
    if(lastSavedRef.current.get(lic.id)===signature)return;
    setLicitacionesSaving(true);setLicitacionesError("");
    try{
      await postLicitaciones({action:"guardar_licitacion",licitacion:lic});
      lastSavedRef.current.set(lic.id,signature);
      try{localStorage.setItem(STORAGE_KEY,JSON.stringify(licitaciones));}catch(_){}
      if(!silent)await appAlert("La licitación se guardó en la planilla compartida.","Guardado");
    }catch(err){setLicitacionesError(err?.message||String(err));if(!silent)await appAlert(err?.message||String(err),"No se pudo guardar");throw err;}
    finally{setLicitacionesSaving(false);}
  },[postLicitaciones,licitaciones]);
  useEffect(()=>{if(initialTab&&initialTab!==tab)setTab(initialTab);},[initialTab]);
  useEffect(()=>{
    let alive=true;
    (async()=>{
      try{
        const res=await fetch(`${APPS_SCRIPT_URL}?action=licitaciones_compartidas&_=${Date.now()}`,{cache:"no-store"});
        const json=await res.json();
        if(!alive)return;
        if(!json.ok)throw new Error(json?.error?.message||"No se pudieron cargar las licitaciones.");
        const rows=Array.isArray(json.data)?json.data.map(normalizeTender):[];
        if(rows.length){setLicitaciones(rows);setActiveId(rows[0].id);rows.forEach(x=>lastSavedRef.current.set(x.id,JSON.stringify(x)));}
        else{const first=emptyTender();setLicitaciones([first]);setActiveId(first.id);}
        setLicitacionesError("");
      }catch(err){if(alive)setLicitacionesError(err?.message||String(err));}
      finally{if(alive)setLicitacionesReady(true);}
    })();
    return()=>{alive=false;};
  },[]);
  const tender=licitaciones.find(x=>x.id===activeId)||licitaciones[0];
  useEffect(()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(licitaciones));}catch(_){ }},[licitaciones]);
  useEffect(()=>{if(!licitaciones.some(x=>x.id===activeId)&&licitaciones[0])setActiveId(licitaciones[0].id);},[licitaciones,activeId]);
  useEffect(()=>{
    if(!licitacionesReady)return;
    licitaciones.forEach(lic=>{
      const signature=JSON.stringify(lic);
      if(lastSavedRef.current.get(lic.id)===signature)return;
      const old=saveTimersRef.current.get(lic.id);if(old)clearTimeout(old);
      const timer=setTimeout(()=>guardarLicitacion(lic,{silent:true}).catch(()=>{}),900);
      saveTimersRef.current.set(lic.id,timer);
    });
    return()=>{};
  },[licitaciones,licitacionesReady,guardarLicitacion]);
  useEffect(()=>()=>{saveTimersRef.current.forEach(t=>clearTimeout(t));},[]);
  const update=(patch)=>setLicitaciones(xs=>xs.map(x=>x.id===tender.id?{...x,...patch}:x));
  const planillaName=LICITACION_PLANILLA_BY_TAB[tab]||"";
  const colToIndex=(col)=>String(col||"").toUpperCase().split("").reduce((acc,ch)=>acc*26+(ch.charCodeAt(0)-64),0)-1;
  const indexToCol=(index)=>{let n=index+1,s="";while(n>0){const r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26);}return s;};
  const addrToPos=(addr)=>{const m=String(addr||"").replace(/\$/g,"").match(/^([A-Z]{1,3})(\d+)$/i);return m?{r:Number(m[2])-1,c:colToIndex(m[1])}:null;};
  const allPlanillaBase={...LICITACION_PLANILLAS_OCULTAS_BASE,...LICITACION_PLANILLAS_BASE};
  const manualSetBySheet=useMemo(()=>Object.fromEntries(Object.entries(LICITACION_PLANILLA_CELDAS_MANUALES).map(([k,v])=>[k,new Set(v)])),[]);
  const planillaRows=useMemo(()=>{
    if(!planillaName)return[];
    const memo=new Map();
    const inStack=new Set();
    const parseScalar=(v)=>{
      if(v===null||v===undefined||v==="")return 0;
      if(typeof v==="number")return Number.isFinite(v)?v:0;
      const raw=String(v).trim();
      if(!raw)return 0;
      const cleaned=raw.replace(/[^0-9,.-]/g,"");
      if(!cleaned||cleaned==="-"||cleaned===".")return raw;
      let normalized=cleaned;
      const comma=normalized.lastIndexOf(","),dot=normalized.lastIndexOf(".");
      if(comma>=0&&dot>=0)normalized=comma>dot?normalized.replace(/\./g,"").replace(",","."):normalized.replace(/,/g,"");
      else if(comma>=0)normalized=normalized.replace(/\./g,"").replace(",",".");
      const num=Number(normalized);
      return Number.isFinite(num)?num:raw;
    };
    const baseCell=(sheet,addr)=>{
      const p=addrToPos(addr);if(!p)return"";
      const override=tender.planillas?.[sheet];
      if(Array.isArray(override)&&Array.isArray(override[p.r])&&override[p.r][p.c]!==undefined)return override[p.r][p.c];
      return allPlanillaBase?.[sheet]?.[p.r]?.[p.c]??"";
    };
    const getRange=(sheet,a1,a2)=>{
      const p1=addrToPos(a1),p2=addrToPos(a2);if(!p1||!p2)return[];
      const out=[];
      for(let r=Math.min(p1.r,p2.r);r<=Math.max(p1.r,p2.r);r++)for(let c=Math.min(p1.c,p2.c);c<=Math.max(p1.c,p2.c);c++)out.push(getCell(sheet,`${indexToCol(c)}${r+1}`));
      return out;
    };
    const flatten=(xs)=>xs.flatMap(x=>Array.isArray(x)?flatten(x):[x]);
    const numeric=(v)=>{const x=parseScalar(v);return typeof x==="number"&&Number.isFinite(x)?x:0;};
    const getCell=(sheet,addr)=>{
      const clean=String(addr||"").replace(/\$/g,"").toUpperCase();
      const key=`${sheet}!${clean}`;
      if(memo.has(key))return memo.get(key);
      if(inStack.has(key))return 0;
      inStack.add(key);
      const formula=LICITACION_PLANILLA_FORMULAS?.[sheet]?.[clean];
      let result;
      if(!formula)result=parseScalar(baseCell(sheet,clean));
      else{
        try{
          let expr=String(formula).replace(/^=/,"").trim();
          expr=expr.replace(/(\d+(?:\.\d+)?)%/g,"($1/100)");
          const names=Object.keys(allPlanillaBase).sort((a,b)=>b.length-a.length);
          const refTokens=[];
          const token=(code)=>{const id=refTokens.length;refTokens.push(code);return `__DMREF_${id}__`;};
          names.forEach(sh=>{
            const esc=sh.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
            const quoted=new RegExp(`'${esc}'!\\$?([A-Z]{1,3})\\$?(\\d+):\\$?([A-Z]{1,3})\\$?(\\d+)`,"gi");
            expr=expr.replace(quoted,(_,c1,r1,c2,r2)=>token(`RANGE(${JSON.stringify(sh)},"${c1}${r1}","${c2}${r2}")`));
            const plainRange=new RegExp(`${esc}!\\$?([A-Z]{1,3})\\$?(\\d+):\\$?([A-Z]{1,3})\\$?(\\d+)`,"gi");
            expr=expr.replace(plainRange,(_,c1,r1,c2,r2)=>token(`RANGE(${JSON.stringify(sh)},"${c1}${r1}","${c2}${r2}")`));
            const quotedCell=new RegExp(`'${esc}'!\\$?([A-Z]{1,3})\\$?(\\d+)`,"gi");
            expr=expr.replace(quotedCell,(_,c,r)=>token(`CELL(${JSON.stringify(sh)},"${c}${r}")`));
            const plainCell=new RegExp(`${esc}!\\$?([A-Z]{1,3})\\$?(\\d+)`,"gi");
            expr=expr.replace(plainCell,(_,c,r)=>token(`CELL(${JSON.stringify(sh)},"${c}${r}")`));
          });
          expr=expr.replace(/\$?([A-Z]{1,3})\$?(\d+):\$?([A-Z]{1,3})\$?(\d+)/g,(_,c1,r1,c2,r2)=>`RANGE(${JSON.stringify(sheet)},"${c1}${r1}","${c2}${r2}")`);
          expr=expr.replace(/\$?([A-Z]{1,3})\$?(\d+)/g,(_,c,r)=>`CELL(${JSON.stringify(sheet)},"${c}${r}")`);
          expr=expr.replace(/__DMREF_(\d+)__/g,(_,id)=>refTokens[Number(id)]||"0");
          const CELL=(sh,a)=>getCell(sh,a);
          const RANGE=(sh,a,b)=>getRange(sh,a,b);
          const SUM=(...args)=>flatten(args).reduce((s,v)=>s+numeric(v),0);
          const PRODUCT=(...args)=>flatten(args).reduce((p,v)=>p*numeric(v),1);
          const SUBTOTAL=(code,...args)=>SUM(...args);
          const IFERROR=(v,alt)=>v===null||v===undefined||v===""||!Number.isFinite(Number(v))?alt:v;
          result=Function("CELL","RANGE","SUM","PRODUCT","SUBTOTAL","IFERROR",`return (${expr});`)(CELL,RANGE,SUM,PRODUCT,SUBTOTAL,IFERROR);
          if(typeof result==="number"&&!Number.isFinite(result))result=0;
        }catch(_){result=baseCell(sheet,clean);}
      }
      inStack.delete(key);memo.set(key,result);return result;
    };
    const base=allPlanillaBase[planillaName]||[];
    const stored=tender.planillas?.[planillaName]||[];
    const rows=Math.max(base.length,stored.length);
    const cols=Math.max(1,...base.map(r=>r?.length||0),...stored.map(r=>r?.length||0));
    return Array.from({length:rows},(_,ri)=>Array.from({length:cols},(_,ci)=>getCell(planillaName,`${indexToCol(ci)}${ri+1}`)));
  },[planillaName,tender.planillas,manualSetBySheet]);
  const updatePlanillaCell=(rowIndex,colIndex,value)=>{
    if(!planillaName)return;
    const addr=`${indexToCol(colIndex)}${rowIndex+1}`;
    const baseRows=LICITACION_PLANILLAS_BASE[planillaName]||[];
    const isAddedRow=rowIndex>=baseRows.length;
    if(!isAddedRow&&!manualSetBySheet[planillaName]?.has(addr))return;
    const current=((tender.planillas&&tender.planillas[planillaName])||baseRows).map(r=>Array.isArray(r)?[...r]:[]);
    while(current.length<=rowIndex)current.push([]);
    while(current[rowIndex].length<=colIndex)current[rowIndex].push("");
    current[rowIndex][colIndex]=value;
    update({planillas:{...(tender.planillas||{}),[planillaName]:current}});
  };
  const addPlanillaRow=()=>{
    if(!planillaName)return;
    const maxCols=Math.max(1,...planillaRows.map(r=>Array.isArray(r)?r.length:0));
    update({planillas:{...(tender.planillas||{}),[planillaName]:[...planillaRows,Array(maxCols).fill("")]}});
  };
  const resetPlanilla=()=>{
    if(!planillaName)return;
    const next={...(tender.planillas||{})};
    delete next[planillaName];
    update({planillas:next});
  };
  const n=v=>{
    if(typeof v==="number")return Number.isFinite(v)?v:0;
    let raw=String(v??"").trim();
    if(!raw)return 0;
    raw=raw.replace(/[^0-9,.-]/g,"");
    if(!raw)return 0;
    const lastComma=raw.lastIndexOf(",");
    const lastDot=raw.lastIndexOf(".");
    if(lastComma>=0&&lastDot>=0){
      raw=lastComma>lastDot?raw.replace(/\./g,"").replace(",","."):raw.replace(/,/g,"");
    }else if(lastComma>=0){
      const decimals=raw.length-lastComma-1;
      raw=decimals===3?raw.replace(/,/g,""):raw.replace(/\./g,"").replace(",",".");
    }else if(lastDot>=0){
      const decimals=raw.length-lastDot-1;
      if(decimals===3)raw=raw.replace(/\./g,"");
    }
    return Number(raw)||0;
  };
  const money=v=>`USD ${n(v).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const field=(label,value,onChange,type="text")=><label style={{display:"grid",gap:5,fontSize:10,color:C.textMuted,fontWeight:800,textTransform:"uppercase"}}>{label}<input type={type} value={value} onChange={e=>onChange(e.target.value)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 10px",color:C.text,outline:"none",fontFamily:"Inter"}}/></label>;
  const getEqVal=(r,names)=>{
    const keys=Object.keys(r||{});
    for(const name of names){
      const q=dmNormKey(name);
      const exact=keys.find(x=>dmNormKey(x)===q);
      if(exact!==undefined&&r[exact]!==""&&r[exact]!==null&&r[exact]!==undefined)return r[exact];
    }
    for(const name of names){
      const q=dmNormKey(name);
      const partial=keys.find(x=>{
        const k=dmNormKey(x);
        return k.includes(q)||q.includes(k);
      });
      if(partial!==undefined&&r[partial]!==""&&r[partial]!==null&&r[partial]!==undefined)return r[partial];
    }
    return"";
  };
  const normTxt=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().trim();
  const equipoOptions=useMemo(()=>{
    const groups=new Map();
    (listaEquipos||[]).forEach((r,index)=>{
      const codigo=String(getEqVal(r,["Código Nuevo","Codigo Nuevo","Código Drusila","Codigo Drusila","Interno","Código interno","Codigo interno"])||"").trim();
      const tipo=String(getEqVal(r,["Familia","Familia de equipo","Tipo de equipo","Tipo","Equipo","Máquina","Maquina"])||"").trim();
      const marca=String(getEqVal(r,["Marca","Fabricante"])||"").trim();
      const modelo=String(getEqVal(r,["Modelo","Modelo Equipo","Modelo de equipo"])||"").trim();
      const propiedad=String(getEqVal(r,["Propiedad"])||"").trim();
      const adquisicion=n(getEqVal(r,[
        "Costo Local en Dolares sin IVA","Costo Local en Dólares sin IVA",
        "Costo local en dolares sin IVA","Costo local en dólares sin IVA",
        "Costo Local USD sin IVA","Costo local USD sin IVA","Costo Local Dolares",
        "Costo local USD","Costo Local USD","Costo Local USD (s/IVA)","Costo local USD (s/IVA)",
        "Costo local usd","Costo Local","Costo local","Costo USD","Valor USD","Valor local USD",
        "Costo de Adquisición","Costo de Adquisicion","Costo Adquisición","Costo Adquisicion",
        "Costo de adquisición (USD)","Costo de adquisicion (USD)","Costo adquisición USD","Costo adquisicion USD",
        "Valor de adquisición","Valor de adquisicion","Valor equipo","Precio de compra",
        "C. Adq./Alquiler (USD)","C. Adq./Alquiler","Costo adquisición/alquiler","Costo adquisicion/alquiler",
        "Costo adquisición / alquiler","Costo adquisicion / alquiler","Costo de adquisición/alquiler","Costo de adquisicion/alquiler"
      ]));
      const label=[tipo,marca,modelo].filter(Boolean).join(" — ");
      if(!label)return;
      const groupKey=[normTxt(tipo),normTxt(marca),normTxt(modelo)].join("|");
      const current=groups.get(groupKey);
      if(!current){
        groups.set(groupKey,{id:`opt-${index}`,codigo,tipo,marca,modelo,propiedad,adquisicion,label,groupKey});
      }else if(!(n(current.adquisicion)>0)&&adquisicion>0){
        groups.set(groupKey,{...current,codigo:codigo||current.codigo,propiedad:propiedad||current.propiedad,adquisicion});
      }
    });
    return Array.from(groups.values()).sort((a,b)=>a.label.localeCompare(b.label));
  },[listaEquipos]);

  const COSTOS_MANT_STATE_KEY="delta_costos_mant_state_v1";
  const AMORT_CATEGORIES_KEY="dm_amortization_categories_v2";
  const DATOS_EQUIPOS_VIDA_KEY="dm_licitaciones_datos_equipos_vida_v1";
  const DATOS_EQUIPOS_ADQ_KEY="dm_licitaciones_datos_equipos_adquisicion_v1";
  const AMORTIZACION_GRUPOS_DEFAULT=useMemo(()=>[
    {tipo:"MOTONIVELADORA 1",equipos:["MOT-0014","MOT-0047","MOT-0049","MOT-0051","MOT-0069"],prefixes:["MOT"]},
    {tipo:"MINICARGADORA",equipos:["MCA-0005","MNC-0001","MNC-001"],prefixes:["MCA","MNC"]},
    {tipo:"EXCAVADORA 1",equipos:["EXC-0034"],prefixes:[]},
    {tipo:"EXCAVADORA",equipos:["EXC-0005","EXC-0017","EXC-0048","EXC-0055"],prefixes:["EXC"]},
    {tipo:"CARGADORA 1",equipos:["PCA-0093"],prefixes:[]},
    {tipo:"CARGADORA",equipos:["PCA-0081","PCA-0095","CFN-0101","PCA-0017","PCA-0021","PCA-0051","PCA-0070","PCA-0074","PCA-0101"],prefixes:["CFN","PCA"]},
    {tipo:"COMPACTACIÓN",equipos:["ROD-0001","RCP-0016","RPC-0016","RCP-0036","RPC-0036","RPC-0039"],prefixes:["ROD","RCP","RPC"]},
    {tipo:"RETROPALA",equipos:["RTP-0016","RTP-0011","RTP-0024","RTP-0018","RTP-0030"],prefixes:["RTP"]},
    {tipo:"TOPADORA",equipos:["TOP-0032","TOP-0022","TOP-0036","TOP-0048","TOP-0051","TOP-0058"],prefixes:["TOP"]},
  ],[]);
  const readCostosMantConfig=useCallback(()=>{
    try{
      const x=JSON.parse(localStorage.getItem(COSTOS_MANT_STATE_KEY)||"{}");
      const base=x&&typeof x==="object"?x:{};
      const saved=JSON.parse(localStorage.getItem(AMORT_CATEGORIES_KEY)||"{}");
      if(saved&&typeof saved==="object"){
        if(saved.assignments&&typeof saved.assignments==="object")base.amortizacionCategorias=saved.assignments;
        if(Array.isArray(saved.categories))base.amortizacionCategoriasLista=saved.categories;
      }
      return base;
    }catch(_){return{};}
  },[]);
  const[costosMantConfig,setCostosMantConfig]=useState(readCostosMantConfig);
  const[datosEquiposVida,setDatosEquiposVida]=useState(()=>{try{const x=JSON.parse(localStorage.getItem(DATOS_EQUIPOS_VIDA_KEY)||"{}");return x&&typeof x==="object"?x:{};}catch(_){return{};}});
  const[datosEquiposAdquisicion,setDatosEquiposAdquisicion]=useState(()=>{try{const x=JSON.parse(localStorage.getItem(DATOS_EQUIPOS_ADQ_KEY)||"{}");return x&&typeof x==="object"?x:{};}catch(_){return{};}});
  const hoyIso=new Date().toISOString().slice(0,10);
  const[datosEquiposDesde,setDatosEquiposDesde]=useState(()=>`${new Date().getFullYear()}-01-01`);
  const[datosEquiposHasta,setDatosEquiposHasta]=useState(hoyIso);
  const[datosEquiposCategorias,setDatosEquiposCategorias]=useState("todos");
  const[datosEquiposEquipos,setDatosEquiposEquipos]=useState("todos");
  const[datosEquiposProyectos,setDatosEquiposProyectos]=useState("todos");
  const[datosEquiposInsumos,setDatosEquiposInsumos]=useState("todos");
  const fechaRegistro=(r)=>{
    const raw=r?.fecha??r?.Fecha??r?.FECHA??r?.["Fecha OT"]??r?.["FECHA OT"]??r?.fechaOT??r?.date??"";
    if(!raw)return"";
    if(raw instanceof Date&&!Number.isNaN(raw.getTime()))return raw.toISOString().slice(0,10);
    const txt=String(raw).trim();
    const dm=txt.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if(dm)return`${dm[3]}-${String(dm[2]).padStart(2,"0")}-${String(dm[1]).padStart(2,"0")}`;
    const ym=txt.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if(ym)return`${ym[1]}-${String(ym[2]).padStart(2,"0")}-${String(ym[3]).padStart(2,"0")}`;
    const d=new Date(txt);
    return Number.isNaN(d.getTime())?"":d.toISOString().slice(0,10);
  };
  const dentroPeriodo=(r)=>{
    const f=fechaRegistro(r);
    if(!f)return false;
    return(!datosEquiposDesde||f>=datosEquiposDesde)&&(!datosEquiposHasta||f<=datosEquiposHasta);
  };
  const multiSelecciona=useCallback((seleccion,valor)=>{
    if(multiIsAll?multiIsAll(seleccion,"todos"):seleccion==="todos")return true;
    const arr=Array.isArray(seleccion)?seleccion:[seleccion];
    return arr.map(x=>String(x||"").trim()).includes(String(valor||"").trim());
  },[multiIsAll]);
  const proyectoRegistro=useCallback((r)=>normTxt(r?.proyecto??r?.Proyecto??r?.PROYECTO??r?.ubicacion??r?.Ubicacion??""),[]);
  const codigoInsumo=useCallback((ins)=>String(ins?.codigo??ins?.code??ins?.cod??ins?.["Código"]??ins?.["Codigo"]??"").trim(),[]);
  const nombreInsumo=useCallback((ins)=>String(ins?.nombre??ins?.descripcion??ins?.insumo??ins?.["Descripción"]??ins?.["Descripcion"]??"").trim(),[]);
  useEffect(()=>{
    const refresh=()=>setCostosMantConfig(readCostosMantConfig());
    const onStorage=e=>{if(!e?.key||e.key===COSTOS_MANT_STATE_KEY||e.key===AMORT_CATEGORIES_KEY||e.key==="dm_costos_resumen_equipos")refresh();};
    window.addEventListener("storage",onStorage);
    window.addEventListener("focus",refresh);
    window.addEventListener("dm-costos-mant-state-updated",refresh);
    window.addEventListener("dm-amortization-categories-updated",refresh);
    return()=>{window.removeEventListener("storage",onStorage);window.removeEventListener("focus",refresh);window.removeEventListener("dm-costos-mant-state-updated",refresh);window.removeEventListener("dm-amortization-categories-updated",refresh);};
  },[readCostosMantConfig]);
  useEffect(()=>{try{localStorage.setItem(DATOS_EQUIPOS_VIDA_KEY,JSON.stringify(datosEquiposVida));}catch(_){}},[datosEquiposVida]);
  useEffect(()=>{try{localStorage.setItem(DATOS_EQUIPOS_ADQ_KEY,JSON.stringify(datosEquiposAdquisicion));}catch(_){}},[datosEquiposAdquisicion]);
  const rawMachineCode=useCallback((value)=>{
    return cleanMachine?cleanMachine(mainMachineCode?mainMachineCode(value):value):String(value||"").trim().toUpperCase();
  },[cleanMachine,mainMachineCode]);
  const canonCode=useCallback((value)=>{
    const raw=rawMachineCode(value);
    return canonicalEquivalentMachineCode?canonicalEquivalentMachineCode(raw):raw;
  },[canonicalEquivalentMachineCode,rawMachineCode]);
  const categoriaModeloKey=useCallback((familia,modelo)=>`${normTxt(familia)||"S/D"}|||${normTxt(modelo)}`,[]);
  const codigoListaEquipo=useCallback((r)=>canonCode(getEqVal(r,[
    "Código Nuevo","Codigo Nuevo","Código nuevo","Codigo nuevo","Código Actual","Codigo Actual",
    "Código Interno","Codigo Interno","CODIGO N° INTERNO","Interno",
    "Código Drusila","Codigo Drusila","Código de Drusila","Codigo de Drusila","Cod Drusila","Cod. Drusila","Interno Drusila",
    "Código Viejo","Codigo Viejo","Código viejo","Codigo viejo","Código Anterior","Codigo Anterior","Cod Viejo","Cod. Viejo"
  ])),[canonCode]);
  const categoriaFallback=useCallback((code,familia,modelo)=>{
    const modelCompact=normTxt(modelo).replace(/[\s\-_/]+/g,"");
    if(modelCompact.includes("PC350"))return"EXCAVADORA 1";
    if(modelCompact.includes("L120"))return"CARGADORA 1";
    const canonical=canonCode(code);
    for(const group of AMORTIZACION_GRUPOS_DEFAULT){
      if((group.equipos||[]).some(x=>canonCode(x)===canonical))return normTxt(group.tipo);
    }
    const prefix=String(canonical||"").split("-")[0];
    for(const group of AMORTIZACION_GRUPOS_DEFAULT){if((group.prefixes||[]).includes(prefix))return normTxt(group.tipo);}
    return normTxt(familia)||"SIN CATEGORIA";
  },[AMORTIZACION_GRUPOS_DEFAULT,canonCode]);
  const categoriaParaEquipo=useCallback((code,familia,modelo)=>{
    const key=categoriaModeloKey(familia,modelo);
    const manual=normTxt(costosMantConfig?.amortizacionCategorias?.[key]);
    return manual||categoriaFallback(code,familia,modelo);
  },[categoriaModeloKey,costosMantConfig,categoriaFallback]);
  const esEquipoOCamion=useCallback((code,familia)=>{
    const fam=normTxt(familia);
    if(!fam)return false;
    if(fam.includes("CAMIONETA")||fam.includes("PICK UP")||fam.includes("PICKUP")||fam.includes("VEHICULO LIVIANO"))return false;
    if(fam.includes("CAMION")||fam.includes("CAMIÓN"))return true;
    if(["EXCAV","CARGADOR","MOTONIV","TOPADOR","RETROPALA","COMPACT","RODILLO","MINICARG","TRACTOR","HIDROGRUA"].some(x=>fam.includes(x)))return true;
    const prefix=String(canonCode(code)||"").split("-")[0];
    return new Set(["MOT","MCA","MNC","EXC","PCA","CFN","ROD","RCP","RPC","RTP","TOP","CAR","CAA","CAM","CMB","HGR"]).has(prefix);
  },[canonCode]);
  const datosEquiposCatalogo=useMemo(()=>{
    const rows=[];
    (listaEquipos||[]).forEach((r,index)=>{
      const codigo=codigoListaEquipo(r);
      const camposCodigo=[
        "Código Nuevo","Codigo Nuevo","Código nuevo","Codigo nuevo","Código Actual","Codigo Actual",
        "Código Interno","Codigo Interno","CODIGO N° INTERNO","Interno",
        "Código Drusila","Codigo Drusila","Código de Drusila","Codigo de Drusila","Cod Drusila","Cod. Drusila","Interno Drusila",
        "Código Viejo","Codigo Viejo","Código viejo","Codigo viejo","Código Anterior","Codigo Anterior","Cod Viejo","Cod. Viejo"
      ];
      const codigosOrigen=Array.from(new Set(camposCodigo.map(k=>rawMachineCode(r?.[k])).filter(Boolean)));
      if(codigo&&!codigosOrigen.includes(rawMachineCode(codigo)))codigosOrigen.push(rawMachineCode(codigo));
      const familia=String(getEqVal(r,["Familia","FAMILIA","Familia de equipo","Tipo de equipo","Tipo Equipo","Tipo","Equipo","Máquina","Maquina","EQUIPO"])||"").trim();
      const marca=String(getEqVal(r,["Marca","MARCA","Fabricante"])||"").trim();
      const modelo=String(getEqVal(r,["Modelo","MODELO","Modelo Equipo","Modelo de equipo","Modelo Tipo","Modelo/Tipo","Marca / Modelo","Marca/Modelo"])||"").trim();
      if(!codigo||!modelo||!esEquipoOCamion(codigo,familia))return;
      const categoria=categoriaParaEquipo(codigo,familia,modelo);
      if(!categoria||categoria==="SIN CATEGORIA")return;
      const adquisicion=n(getEqVal(r,["Costo Local en Dolares sin IVA","Costo Local en Dólares sin IVA","Costo local en dolares sin IVA","Costo local en dólares sin IVA","Costo Local USD sin IVA","Costo local USD sin IVA","Costo Local USD","Costo local USD","Costo USD","Valor USD","Costo de Adquisición","Costo de Adquisicion","Costo Adquisición","Costo Adquisicion","C. Adq./Alquiler (USD)"]));
      const vidaLista=n(getEqVal(r,["Vida Útil hs","Vida Util hs","Vida Útil hs/km","Vida Util hs/km","Vida útil","Vida Util","Vida útil horas","Vida util horas"]));
      rows.push({id:`de-${index}`,codigo,codigosOrigen,familia,marca,modelo,adquisicion,vidaLista,categoria});
    });
    return rows;
  },[listaEquipos,codigoListaEquipo,esEquipoOCamion,categoriaParaEquipo,rawMachineCode]);

  const datosEquiposCategoriaOpts=useMemo(()=>[
    {value:"todos",label:"Todas"},
    ...Array.from(new Set(datosEquiposCatalogo.map(x=>normTxt(x.categoria)).filter(x=>x&&x!=="OTROS"))).sort((a,b)=>a.localeCompare(b,"es")).map(x=>({value:x,label:x}))
  ],[datosEquiposCatalogo]);
  const datosEquiposEquipoOpts=useMemo(()=>[
    {value:"todos",label:"Todos"},
    ...datosEquiposCatalogo.filter(x=>normTxt(x.categoria)!=="OTROS").slice().sort((a,b)=>a.codigo.localeCompare(b.codigo,"es",{numeric:true})).map(x=>({value:x.codigo,label:`${x.codigo} — ${[x.marca,x.modelo].filter(Boolean).join(" ")}`}))
  ],[datosEquiposCatalogo]);
  const datosEquiposProyectoOpts=useMemo(()=>{
    const values=new Set();
    [...(rma15||[]),...(rop02All||[])].forEach(r=>{if(dentroPeriodo(r)){const p=proyectoRegistro(r);if(p)values.add(p);}});
    return [{value:"todos",label:"Todos"},...Array.from(values).sort((a,b)=>a.localeCompare(b,"es")).map(x=>({value:x,label:x}))];
  },[rma15,rop02All,datosEquiposDesde,datosEquiposHasta,proyectoRegistro]);
  const datosEquiposCatalogoFiltrado=useMemo(()=>datosEquiposCatalogo.filter(eq=>
    normTxt(eq.categoria)!=="OTROS"&&multiSelecciona(datosEquiposCategorias,normTxt(eq.categoria))&&multiSelecciona(datosEquiposEquipos,eq.codigo)
  ),[datosEquiposCatalogo,datosEquiposCategorias,datosEquiposEquipos,multiSelecciona]);
  const datosEquiposCodigosPermitidos=useMemo(()=>new Set(datosEquiposCatalogoFiltrado.map(x=>x.codigo)),[datosEquiposCatalogoFiltrado]);
  // Relación estricta entre los códigos realmente declarados para cada unidad en
  // Lista Maestra y su código vigente. Evita que un equipo sin RMA15 herede el
  // mantenimiento de otra unidad por compartir categoría, modelo o equivalencia.
  const datosEquiposPorCodigoOrigen=useMemo(()=>{
    const out=new Map();
    datosEquiposCatalogoFiltrado.forEach(eq=>{
      (eq.codigosOrigen||[]).forEach(code=>{if(code&&!out.has(code))out.set(code,eq);});
    });
    return out;
  },[datosEquiposCatalogoFiltrado]);
  const equipoDatosDesdeRegistro=useCallback((r)=>{
    const raw=rawMachineCode(r?.maquina||r?.interno||r?.codigo||r?.["CODIGO N° INTERNO"]||r?.["Código interno"]||"");
    return raw?datosEquiposPorCodigoOrigen.get(raw)||null:null;
  },[rawMachineCode,datosEquiposPorCodigoOrigen]);
  const datosEquiposInsumoOpts=useMemo(()=>{
    const map=new Map();
    (rma15||[]).forEach(r=>{
      if(!dentroPeriodo(r)||!multiSelecciona(datosEquiposProyectos,proyectoRegistro(r)))return;
      const equipoMeta=equipoDatosDesdeRegistro(r);
      const codigo=equipoMeta?.codigo||"";
      if(!codigo||!datosEquiposCodigosPermitidos.has(codigo))return;
      (r?.insumos||[]).forEach(ins=>{
        const cod=codigoInsumo(ins);if(!cod)return;
        const desc=nombreInsumo(ins)||cod;
        if(!map.has(cod)||map.get(cod)===cod)map.set(cod,desc);
      });
    });
    return [{value:"todos",label:"Todos"},...Array.from(map.entries()).sort((a,b)=>String(a[0]).localeCompare(String(b[0]),"es",{numeric:true})).map(([cod,desc])=>({value:cod,label:`${cod} — ${desc}`}))];
  },[rma15,datosEquiposDesde,datosEquiposHasta,datosEquiposProyectos,datosEquiposCodigosPermitidos,proyectoRegistro,equipoDatosDesdeRegistro,codigoInsumo,nombreInsumo,multiSelecciona]);
  useEffect(()=>{
    const valid=new Set(datosEquiposCategoriaOpts.map(x=>x.value));
    if(Array.isArray(datosEquiposCategorias)){const next=datosEquiposCategorias.filter(x=>valid.has(x));if(next.length!==datosEquiposCategorias.length)setDatosEquiposCategorias(next.length?next:"todos");}
  },[datosEquiposCategoriaOpts]);
  useEffect(()=>{
    const valid=new Set(datosEquiposEquipoOpts.map(x=>x.value));
    if(Array.isArray(datosEquiposEquipos)){const next=datosEquiposEquipos.filter(x=>valid.has(x));if(next.length!==datosEquiposEquipos.length)setDatosEquiposEquipos(next.length?next:"todos");}
  },[datosEquiposEquipoOpts]);
  useEffect(()=>{
    const valid=new Set(datosEquiposInsumoOpts.map(x=>x.value));
    if(Array.isArray(datosEquiposInsumos)){const next=datosEquiposInsumos.filter(x=>valid.has(x));if(next.length!==datosEquiposInsumos.length)setDatosEquiposInsumos(next.length?next:"todos");}
  },[datosEquiposInsumoOpts]);

  const horasCombustiblePorEquipo=useMemo(()=>{
    const out=new Map();
    (rop02All||[]).forEach(r=>{
      if(!dentroPeriodo(r)||!multiSelecciona(datosEquiposProyectos,proyectoRegistro(r)))return;
      const equipoMeta=equipoDatosDesdeRegistro(r);
      const codigo=equipoMeta?.codigo||"";
      if(!codigo||!datosEquiposCodigosPermitidos.has(codigo))return;
      const horas=n(r?.horas??r?.hs??r?.Hs??r?.["Hs"]??r?.["HORAS"]??r?.cantidadHoras??0);
      const combustible=n(r?.combustible??r?.Combustible??r?.litros??r?.Litros??r?.["COMBUSTIBLE"]??0);
      if(horas<=0&&combustible<=0)return;
      const acc=out.get(codigo)||{horas:0,combustible:0};
      acc.horas+=Math.max(0,horas);acc.combustible+=Math.max(0,combustible);out.set(codigo,acc);
    });
    return out;
  },[rop02All,equipoDatosDesdeRegistro,datosEquiposDesde,datosEquiposHasta,datosEquiposProyectos,datosEquiposCodigosPermitidos,proyectoRegistro,multiSelecciona]);

  // Desagrega el costo horario de mantenimiento en dos componentes auditables:
  // 1) insumos reales de RMA15, y 2) mano de obra mecánica distribuida.
  // La suma de ambos coincide exactamente con Mantenimiento (USD/h).
  // Este análisis se limita a camiones y equipos y excluye la categoría OTROS.
  const mantenimientoHorarioPorEquipo=useMemo(()=>{
    const rate=Math.max(0.000001,n(usdRate)||n(costosMantConfig?.usdRate2)||1);
    const monthKey=(r)=>String(fechaRegistro(r)||"").slice(0,7);
    const bySectionEquipmentMonth=new Map();
    (rma15||[]).forEach(r=>{
      if(!dentroPeriodo(r)||!multiSelecciona(datosEquiposProyectos,proyectoRegistro(r)))return;
      const equipoMeta=equipoDatosDesdeRegistro(r);
      const codigo=equipoMeta?.codigo||"";
      if(!codigo||!datosEquiposCodigosPermitidos.has(codigo))return;
      const meta=equipoMeta;
      if(!meta||normTxt(meta.categoria)==="OTROS")return;
      const proyecto=proyectoRegistro(r);
      const section=(proyecto.includes("JOSE")||proyecto==="JM"||proyecto.includes("JOSE MARIA"))?"JM":"FS";
      const month=monthKey(r);if(!month)return;
      const insumosFila=Array.isArray(r?.insumos)?r.insumos:[];
      const insumosElegidos=insumosFila.filter(ins=>multiSelecciona(datosEquiposInsumos,codigoInsumo(ins)));
      const costo=insumosElegidos.reduce((sum,i)=>sum+n(i?.costoTotal||n(i?.cantidad)*n(i?.costoUnitario)),0);
      const key=`${section}__${codigo}__${month}`;
      bySectionEquipmentMonth.set(key,(bySectionEquipmentMonth.get(key)||0)+Math.max(0,costo)/rate);
    });
    const monthlyBySectionEquipment=new Map();
    bySectionEquipmentMonth.forEach((value,key)=>{
      const [section,codigo]=key.split("__");const k=`${section}__${codigo}`;
      if(!monthlyBySectionEquipment.has(k))monthlyBySectionEquipment.set(k,[]);
      if(value>0)monthlyBySectionEquipment.get(k).push(value);
    });
    const avgInsumosMensual=new Map();
    monthlyBySectionEquipment.forEach((vals,key)=>avgInsumosMensual.set(key,vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0));

    // La mano de obra se distribuye entre los equipos de cada proyecto en la misma
    // proporción que sus costos mensuales promedio de insumos, replicando la lógica
    // del Informe de Costos pero conservando ambos componentes por separado.
    const totals={JM:0,FS:0};
    avgInsumosMensual.forEach((v,key)=>{const section=key.slice(0,2);totals[section]=(totals[section]||0)+v;});
    const subtotal={
      JM:(n(costosMantConfig?.mecJM)||8)*(n(costosMantConfig?.costMec)||2390.27)+(n(costosMantConfig?.ctaMecJM)||2)*(n(costosMantConfig?.costCTA)||3000),
      FS:(n(costosMantConfig?.mecFS)||8)*(n(costosMantConfig?.costMec)||2390.27)+(n(costosMantConfig?.ctaMecFS)||1)*(n(costosMantConfig?.costCTA)||3000),
    };
    const hs={JM:Math.max(1,n(costosMantConfig?.hsEfJM)||180),FS:Math.max(1,n(costosMantConfig?.hsEfFS)||180)};
    const out=new Map();
    avgInsumosMensual.forEach((insumosMensual,key)=>{
      const [section,codigo]=key.split("__");
      const manoObraMensual=totals[section]>0?subtotal[section]*(insumosMensual/totals[section]):0;
      const costoInsumosHora=insumosMensual/hs[section];
      const costoManoObraHora=manoObraMensual/hs[section];
      const actual=out.get(codigo)||{costoInsumosHora:0,costoManoObraHora:0,mantenimiento:0};
      actual.costoInsumosHora+=costoInsumosHora;
      actual.costoManoObraHora+=costoManoObraHora;
      actual.mantenimiento+=costoInsumosHora+costoManoObraHora;
      out.set(codigo,actual);
    });
    return out;
  },[rma15,usdRate,costosMantConfig,datosEquiposCatalogoFiltrado,datosEquiposCodigosPermitidos,equipoDatosDesdeRegistro,datosEquiposDesde,datosEquiposHasta,datosEquiposProyectos,datosEquiposInsumos,proyectoRegistro,codigoInsumo,multiSelecciona]);

  const datosEquiposRows=useMemo(()=>{
    const groups=new Map();
    datosEquiposCatalogoFiltrado.forEach(eq=>{
      // En esta vista solo se muestran equipos con mantenimiento real registrado
      // dentro del período y los filtros seleccionados. No se inventan ni se
      // heredan costos desde otra categoría/modelo.
      const desglose=mantenimientoHorarioPorEquipo.get(eq.codigo)||null;
      const mant=n(desglose?.mantenimiento);
      if(!(mant>0))return;
      const cat=normTxt(eq.categoria);if(!cat||cat==="OTROS")return;
      if(!groups.has(cat))groups.set(cat,{categoria:cat,equipos:[],adqSum:0,adqCount:0,vidaSum:0,vidaCount:0,horas:0,combustible:0,insumosHoraVals:[],manoObraHoraVals:[],mantVals:[]});
      const g=groups.get(cat);g.equipos.push(eq);
      if(eq.adquisicion>0){g.adqSum+=eq.adquisicion;g.adqCount++;}
      if(eq.vidaLista>0){g.vidaSum+=eq.vidaLista;g.vidaCount++;}
      const fuel=horasCombustiblePorEquipo.get(eq.codigo)||{horas:0,combustible:0};g.horas+=fuel.horas;g.combustible+=fuel.combustible;
      g.insumosHoraVals.push(n(desglose?.costoInsumosHora));
      g.manoObraHoraVals.push(n(desglose?.costoManoObraHora));
      g.mantVals.push(mant);
    });
    return Array.from(groups.values()).map(g=>{
      const vidaDefault=g.vidaCount?g.vidaSum/g.vidaCount:8000;
      const vidaUtil=Math.max(1,n(datosEquiposVida[g.categoria])||vidaDefault);
      const costoAdquisicionPromedio=g.adqCount?g.adqSum/g.adqCount:0;
      const equiposConPrecio=g.equipos.filter(eq=>n(eq.adquisicion)>0).map((eq,index)=>{
        const adquisicion=n(eq.adquisicion);
        // La clave incluye unidad, modelo y precio. No usamos solo el interno porque
        // las equivalencias históricas pueden hacer que dos filas terminen con el
        // mismo código canónico y el selector vuelva accidentalmente al promedio.
        const selectionId=[eq.codigo,normTxt(eq.marca),normTxt(eq.modelo),adquisicion,index].join("|||");
        return{
          selectionId,
          codigo:eq.codigo,
          marca:eq.marca||"",
          modelo:eq.modelo||"",
          adquisicion,
          label:[eq.codigo,[eq.marca,eq.modelo].filter(Boolean).join(" "),`USD ${adquisicion.toLocaleString("es-AR",{maximumFractionDigits:0})}`].filter(Boolean).join(" — ")
        };
      }).sort((a,b)=>a.label.localeCompare(b.label,"es",{numeric:true}));
      const seleccionGuardada=String(datosEquiposAdquisicion[g.categoria]||"promedio");
      // Compatibilidad con selecciones antiguas que guardaban solamente el interno.
      const equipoSeleccionado=equiposConPrecio.find(eq=>eq.selectionId===seleccionGuardada)
        ||equiposConPrecio.find(eq=>eq.codigo===seleccionGuardada)
        ||null;
      const seleccionAdquisicion=equipoSeleccionado?equipoSeleccionado.selectionId:"promedio";
      const costoAdquisicionSeleccionado=equipoSeleccionado?equipoSeleccionado.adquisicion:costoAdquisicionPromedio;
      const amortizacion=costoAdquisicionSeleccionado/vidaUtil;
      const consumo=g.horas>0?g.combustible/g.horas:0;
      const costoInsumosHora=g.insumosHoraVals.length?g.insumosHoraVals.reduce((a,b)=>a+b,0)/g.insumosHoraVals.length:0;
      const costoManoObraHora=g.manoObraHoraVals.length?g.manoObraHoraVals.reduce((a,b)=>a+b,0)/g.manoObraHoraVals.length:0;
      const mantenimiento=costoInsumosHora+costoManoObraHora;
      const modelos=new Map();g.equipos.forEach(eq=>{const key=[eq.marca,eq.modelo].filter(Boolean).join(" ")||eq.modelo;modelos.set(key,(modelos.get(key)||0)+1);});
      return {...g,vidaDefault,vidaUtil,costoAdquisicionPromedio,costoAdquisicionSeleccionado,seleccionAdquisicion,equipoSeleccionado,equiposConPrecio,amortizacion,consumo,costoInsumosHora,costoManoObraHora,mantenimiento,modelos:Array.from(modelos.entries()).map(([nombre,cantidad])=>({nombre,cantidad}))};
    }).sort((a,b)=>a.categoria.localeCompare(b.categoria,"es"));
  },[datosEquiposCatalogoFiltrado,horasCombustiblePorEquipo,mantenimientoHorarioPorEquipo,datosEquiposVida,datosEquiposAdquisicion]);
  const setVidaCategoria=(categoria,value)=>setDatosEquiposVida(prev=>({...prev,[categoria]:Math.max(1,n(value)||1)}));
  const setAdquisicionCategoria=(categoria,value)=>setDatosEquiposAdquisicion(prev=>({...prev,[categoria]:String(value||"promedio")}));
  const exportDatosEquipos=()=>{
    const rows=datosEquiposRows.map(g=>({Periodo:`${datosEquiposDesde||"Inicio"} a ${datosEquiposHasta||"Hoy"}`,Categoria:g.categoria,"Cantidad de equipos":g.equipos.length,"Equipos y modelos":g.modelos.map(m=>`${m.nombre} (${m.cantidad})`).join("; "),"Combustible total L":g.combustible,"Horas totales":g.horas,"Consumo combustible L/h":g.consumo,"Vida útil h":g.vidaUtil,"Equipo/costo de adquisición seleccionado":g.equipoSeleccionado?g.equipoSeleccionado.label:"PROMEDIO DE LA CATEGORÍA","Costo adquisición seleccionado USD":g.costoAdquisicionSeleccionado,"Amortización USD/h":g.amortizacion,"Costo de insumos USD/h":g.costoInsumosHora,"Costo de mano de obra USD/h":g.costoManoObraHora,"Mantenimiento USD/h":g.mantenimiento,"Costo total equipo USD/h (sin combustible)":g.amortizacion+g.mantenimiento}));
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),"Datos Equipos");XLSX.writeFile(wb,"Datos_Equipos_Licitaciones.xlsx");
  };

  const laborRate=(conv="AOMA")=>{const rows=tender.manoObra?.[conv]||[];return rows.length?rows.reduce((s,r)=>s+n(r.costoHora),0)/rows.length:0;};
  const leerInformeResumen=()=>{try{const x=JSON.parse(localStorage.getItem("dm_costos_resumen_equipos")||"[]");return Array.isArray(x)?x:[];}catch(_){return[];}};
  const informeResumen=leerInformeResumen();
  const resumenLabel=(tipo,modelo)=>{const t=normTxt(tipo),m=normTxt(modelo).replace(/[\s\-_/]+/g,"");if(m.includes("PC350"))return"EXCAVADORA PC350";if(m.includes("L120"))return"CARGADOR FRONTAL L120";if(m.includes("L330")||t.includes("MINICARG"))return"MINICARGADORA";if(t.includes("MOTONIV"))return"MOTONIVELADORA";if(t.includes("CARGADOR")||t.includes("CARGADORA"))return"CARGADOR FRONTAL";if(t.includes("EXCAV"))return"EXCAVADORA";if(t.includes("RETRO"))return"RETROPALA";if(t.includes("RODILLO")||t.includes("COMPACT"))return"RODILLO COMPACTADOR";if(t.includes("TOPAD"))return"TOPADORA";if(t.includes("REGADOR"))return"CAMION REGADOR";if(t.includes("VOLCADOR"))return"CAMION VOLCADOR";return t;};
  const resumenCostoTipo=(tipo,modelo)=>{
    const rows=leerInformeResumen();
    const key=resumenLabel(tipo,modelo);
    const modelKey=normTxt(modelo).replace(/[\s\-_/]+/g,"");
    const tipoKey=normTxt(tipo);
    const row=rows.find(r=>normTxt(r.maquina)===key)
      ||rows.find(r=>normTxt(r.modelo).replace(/[\s\-_/]+/g,"")===modelKey)
      ||rows.find(r=>{
        const maq=normTxt(r.maquina);
        return maq===tipoKey||maq.includes(tipoKey)||tipoKey.includes(maq);
      });
    return {
      costoHorario:n(row?.costoHorario),
      pctMant:n(row?.pctMant)
    };
  };
  const mantenimientoTipo=(tipo,modelo)=>resumenCostoTipo(tipo,modelo).costoHorario;
  const vestidoHora=()=>{const fromInforme=n(localStorage.getItem("dm_costo_hombre_vestido_hora"));if(fromInforme>0)return fromInforme;const annual=(tender.hombreVestido||[]).reduce((s,r)=>s+n(r.costoAnual)*(12/Math.max(1,n(r.vidaMeses)||12)),0);return annual/(12*180);};
  const horasContrato1=Math.max(0,n(tender.horasContrato1??tender.equipos?.[0]?.horas??180));
  const horasContrato2=Math.max(0,n(tender.horasContrato2??0));
  const usarSegundoContrato=!!tender.usarSegundoContrato;
  const equiposCalc=useMemo(()=>tender.equipos.map(e=>{
    const selectedOption=equipoOptions.find(o=>o.id===e.equipoOptionId)
      ||equipoOptions.find(o=>
        normTxt(o.tipo)===normTxt(e.tipo)&&
        normTxt(o.marca)===normTxt(e.marca)&&
        normTxt(o.modelo)===normTxt(e.modelo)
      );
    const costoAdquisicion=n(selectedOption?.adquisicion)>0?n(selectedOption.adquisicion):n(e.costoAdquisicion);
    const vidaUtil=Math.max(0,n(e.vidaUtil));
    const amortizacion=vidaUtil>0?costoAdquisicion/vidaUtil:0;
    const resumenCosto=resumenCostoTipo(e.tipo,e.modelo);
    const mantenimiento=n(resumenCosto.costoHorario);
    const costoHoraTotal=amortizacion+mantenimiento;
    const mantAdoptado=e.mantAdoptado!==undefined&&e.mantAdoptado!==null&&e.mantAdoptado!==""
      ?Math.max(0,n(e.mantAdoptado))
      :Math.max(0,n(resumenCosto.pctMant)*100);
    const mantAdoptadoUsd=amortizacion*mantAdoptado/100;
    const costoHoraAdoptado=amortizacion+mantAdoptadoUsd;
    const costoArrendado=Math.max(0,n(e.costoArrendado));
    let comparacion="—";
    if(costoHoraAdoptado>0&&costoArrendado>0){
      const diferencia=(costoArrendado/costoHoraAdoptado-1)*100;
      comparacion=diferencia>=0
        ?`${Math.abs(diferencia).toLocaleString("es-AR",{minimumFractionDigits:1,maximumFractionDigits:1})}% más caro que Delta`
        :`${Math.abs(diferencia).toLocaleString("es-AR",{minimumFractionDigits:1,maximumFractionDigits:1})}% más barato que Delta`;
    }
    return{
      ...e,costoAdquisicion,vidaUtil,amortizacion,mantenimiento,costoHoraTotal,mantAdoptado,mantAdoptadoUsd,costoHoraAdoptado,costoArrendado,comparacion,
      costoHora:costoHoraAdoptado,
      total:n(e.cantidad)*horasContrato1*costoHoraAdoptado,
      total2:n(e.cantidad)*horasContrato2*costoHoraAdoptado
    };
  }),[tender,informeResumen,equipoOptions,horasContrato1,horasContrato2]);
  const subtotalEquipos=equiposCalc.reduce((s,e)=>s+e.total,0);
  const subtotalEquipos2=equiposCalc.reduce((s,e)=>s+e.total2,0);
  const gastosMonto=(tender.gastos||[]).reduce((s,g)=>s+(g.tipo==="monto"?n(g.valor):0),0);
  const gastosPct=(tender.gastos||[]).reduce((s,g)=>s+(g.tipo==="porcentaje"?subtotalEquipos*n(g.valor)/100:0),0);
  const totalFinal=subtotalEquipos+gastosMonto+gastosPct;
  const addTender=()=>{const x=emptyTender();setLicitaciones(v=>[...v,x]);setActiveId(x.id);setTab("nueva");};
  const duplicate=()=>{const x={...JSON.parse(JSON.stringify(tender)),id:`LIC-${Date.now()}`,nombre:`${tender.nombre} — Copia`};setLicitaciones(v=>[...v,x]);setActiveId(x.id);};
  const removeTender=async()=>{if(licitaciones.length===1){await appAlert("Debe conservarse al menos una licitación.");return;}if(await appConfirm(`¿Eliminar ${tender.nombre}?`)){try{await postLicitaciones({action:"eliminar_licitacion",idLicitacion:tender.id});lastSavedRef.current.delete(tender.id);setLicitaciones(v=>v.filter(x=>x.id!==tender.id));}catch(err){await appAlert(err?.message||String(err),"No se pudo eliminar");}}};
  const addEquipo=()=>update({equipos:[...tender.equipos,{id:`eq-${Date.now()}`,equipoPedido:"",equipoOptionId:"",codigo:"",tipo:"",marca:"",modelo:"",propiedad:"",costoAdquisicion:0,cantidad:1,vidaUtil:6000,mantAdoptado:null,costoArrendado:0}]});
  const updEquipo=(id,patch)=>update({equipos:tender.equipos.map(e=>e.id===id?{...e,...patch}:e)});
  const addFecha=()=>update({fechas:[...(tender.fechas||[]),{id:`f-${Date.now()}`,fecha:"",descripcion:""}]});
  const updFecha=(id,patch)=>update({fechas:(tender.fechas||[]).map(f=>f.id===id?{...f,...patch}:f)});
  const removeFecha=(id)=>update({fechas:(tender.fechas||[]).filter(f=>f.id!==id)});
  const fechasOrdenadas=useMemo(()=>[...(tender.fechas||[])].filter(f=>f.fecha||f.descripcion).sort((a,b)=>String(a.fecha||"9999-12-31").localeCompare(String(b.fecha||"9999-12-31"))),[tender.fechas]);
  const formatFechaCorta=(v)=>{if(!v)return"Sin fecha";const [y,m,d]=String(v).split("-");return d&&m&&y?`${d}/${m}/${y}`:String(v);};
  const exportExcel=()=>{
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(equiposCalc.map(e=>({Equipo_Pedido:e.equipoPedido||"",Equipo_Propuesto:[e.tipo,e.marca,e.modelo].filter(Boolean).join(" — "),Tipo:e.tipo,Marca:e.marca||"",Modelo:e.modelo,Cantidad:n(e.cantidad),Horas_Contrato_1:horasContrato1,Total_Contrato_1_USD:e.total,Horas_Contrato_2:usarSegundoContrato?horasContrato2:"",Total_Contrato_2_USD:usarSegundoContrato?e.total2:"",Costo_Adquisicion_USD:n(e.costoAdquisicion),Vida_Util_h:n(e.vidaUtil),Amortizacion_USD_h:n(e.amortizacion),Costo_Hora_Mantenimiento_USD:n(e.mantenimiento),Costo_Hora_Total_USD:n(e.costoHoraTotal),Mant_Adoptado_Porcentaje:n(e.mantAdoptado),Mant_Adoptado_USD_h:n(e.mantAdoptadoUsd),Costo_Hora_Adoptado_USD:n(e.costoHoraAdoptado),Costo_Arrendado_USD_h:n(e.costoArrendado),Comparacion:e.comparacion}))),"Equipos");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet((tender.gastos||[]).map(g=>({Concepto:g.concepto,Tipo:g.tipo,Valor:n(g.valor),Incidencia_USD:g.tipo==="monto"?n(g.valor):subtotalEquipos*n(g.valor)/100}))),"Gastos");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["Licitación",tender.nombre],["Cliente",tender.cliente],["Proyecto",tender.proyecto],["Subtotal equipos",subtotalEquipos],["Gastos",gastosMonto+gastosPct],["TOTAL",totalFinal]]),"Resumen");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(fechasOrdenadas.map(f=>({Fecha:formatFechaCorta(f.fecha),Descripcion:f.descripcion||""}))),"Cronograma");
    XLSX.writeFile(wb,`Licitacion_${String(tender.nombre||"sin_nombre").replace(/[^a-z0-9]+/gi,"_")}.xlsx`);
  };
  const updateLabor=(conv,id,patch)=>update({manoObra:{...tender.manoObra,[conv]:(tender.manoObra?.[conv]||[]).map(r=>r.id===id?{...r,...patch}:r)}});
  const addLabor=(conv)=>update({manoObra:{...tender.manoObra,[conv]:[...(tender.manoObra?.[conv]||[]),{id:`${conv.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,categoria:"Nueva categoría",costoHora:0}]}});
  const removeLabor=(conv,id)=>update({manoObra:{...tender.manoObra,[conv]:(tender.manoObra?.[conv]||[]).filter(r=>r.id!==id)}});
  const panel={background:"rgba(22,22,22,.84)",border:`1px solid ${C.border}`,borderRadius:14,padding:16,boxShadow:"0 12px 32px rgba(0,0,0,.24)"};
  const th={padding:"9px 10px",fontSize:10,textTransform:"uppercase",color:C.textSub,textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"};
  const td={padding:"8px 10px",borderBottom:`1px solid ${C.border}55`,fontSize:11,color:C.text};
  const numInput=(value,onChange)=><input value={value} onChange={e=>onChange(e.target.value)} inputMode="decimal" style={{width:82,background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"7px 8px",color:C.text,textAlign:"right"}}/>;
  const licitacionesEnCurso=licitaciones.filter(x=>String(x.estado||"EN CURSO").toUpperCase()==="EN CURSO").length;
  const licitacionesCerradas=licitaciones.filter(x=>String(x.estado||"").toUpperCase()==="CERRADA").length;
  const licitacionesGanadas=licitaciones.filter(x=>String(x.resultado||"").toUpperCase()==="GANADA").length;
  const licitacionesPerdidas=licitaciones.filter(x=>String(x.resultado||"").toUpperCase()==="PERDIDA").length;
  const parseLicitacionDate=(value)=>{
    const match=String(value||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!match)return null;
    const date=new Date(Number(match[1]),Number(match[2])-1,Number(match[3]));
    return Number.isNaN(date.getTime())?null:date;
  };
  const todayStart=()=>{
    const d=new Date();
    return new Date(d.getFullYear(),d.getMonth(),d.getDate());
  };
  const renderControlTimeline=(licitacion)=>{
    const today=todayStart();
    const events=(Array.isArray(licitacion.fechas)?licitacion.fechas:[])
      .map(item=>({...item,dateObj:parseLicitacionDate(item.fecha)}))
      .filter(item=>item.dateObj)
      .sort((a,b)=>a.dateObj-b.dateObj);
    const dates=[today,...events.map(item=>item.dateObj)];
    let minDate=new Date(Math.min(...dates.map(date=>date.getTime())));
    let maxDate=new Date(Math.max(...dates.map(date=>date.getTime())));
    if(minDate.getTime()===maxDate.getTime()){
      minDate=new Date(minDate.getTime()-3*86400000);
      maxDate=new Date(maxDate.getTime()+3*86400000);
    }else{
      const padding=Math.max(86400000,Math.round((maxDate-minDate)*0.06));
      minDate=new Date(minDate.getTime()-padding);
      maxDate=new Date(maxDate.getTime()+padding);
    }
    const span=Math.max(1,maxDate-minDate);
    const position=date=>Math.max(0,Math.min(100,((date-minDate)/span)*100));
    const todayPos=position(today);
    return <div style={{position:"relative",height:78,minWidth:560,padding:"18px 12px 8px"}}>
      <div style={{position:"absolute",left:12,right:12,top:38,height:5,borderRadius:999,background:"linear-gradient(90deg,#38bdf8,#60a5fa)",boxShadow:"0 0 0 1px rgba(255,255,255,.30),0 0 12px rgba(56,189,248,.50)"}}/>
      <div style={{position:"absolute",left:`calc(12px + (100% - 24px) * ${todayPos/100})`,top:31,transform:"translateX(-50%)",zIndex:6}}>
        <div style={{width:18,height:18,borderRadius:"50%",background:C.red,border:"3px solid #fff",boxShadow:`0 0 0 4px ${C.red}55,0 0 14px ${C.red}aa`}}/>
        <div style={{position:"absolute",top:24,left:"50%",transform:"translateX(-50%)",whiteSpace:"nowrap",fontSize:9,fontWeight:950,color:C.red,textShadow:"0 1px 2px #000"}}>HOY</div>
        <div style={{position:"absolute",top:37,left:"50%",transform:"translateX(-50%)",whiteSpace:"nowrap",fontSize:9,fontWeight:900,color:C.text,textShadow:"0 1px 2px #000"}}>{formatFechaCorta(`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`)}</div>
      </div>
      {events.length===0&&<div style={{position:"absolute",left:12,right:12,top:49,textAlign:"center",fontSize:10,color:C.textMuted}}>Sin fechas importantes cargadas</div>}
      {events.map((item,index)=>{
        const pos=position(item.dateObj);
        const completed=item.dateObj<today;
        return <div key={item.id||`${item.fecha}-${index}`} title={`${formatFechaCorta(item.fecha)} · ${item.descripcion||"Sin descripción"}`} style={{position:"absolute",left:`calc(12px + (100% - 24px) * ${pos/100})`,top:32,transform:"translateX(-50%)",zIndex:4}}>
          <div style={{width:14,height:14,borderRadius:"50%",background:completed?C.green:C.blue,border:"2px solid #171717",boxShadow:`0 0 0 3px ${completed?C.green:C.blue}33`}}/>
          <div style={{position:"absolute",top:index%2===0?18:-25,left:"50%",transform:"translateX(-50%)",width:112,textAlign:"center",fontSize:9,lineHeight:1.2,color:C.textSub,fontWeight:800,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{formatFechaCorta(item.fecha)} · {item.descripcion||"Hito"}</div>
        </div>;
      })}
    </div>;
  };
  const renderEquiposTable=(numeroContrato=1)=>{
    const totalKey=numeroContrato===2?"total2":"total";
    const headers=["Equipo pedido","Equipo propuesto","Cant.","Costo adquisición","Vida útil","Amort.","Costo hora mant.","Costo hora total","Mant. adoptado (%)","$ mant. adoptado","Costo hora adoptado","Costo arrendado","Comparación",`Total contrato ${numeroContrato}`,""];
    return <div style={{overflow:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:2180}}><thead><tr>{headers.map(x=><th key={x} style={th}>{x}</th>)}</tr></thead><tbody>{equiposCalc.map(e=><tr key={`${numeroContrato}-${e.id}`}>
      <td style={td}><input value={e.equipoPedido||""} onChange={ev=>updEquipo(e.id,{equipoPedido:ev.target.value})} placeholder="Equipo solicitado..." style={{width:230,background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"7px 8px",color:C.text}}/></td>
      <td style={td}><select value={e.equipoOptionId||""} onChange={ev=>{const opt=equipoOptions.find(o=>o.id===ev.target.value);updEquipo(e.id,opt?{equipoOptionId:opt.id,codigo:opt.codigo,tipo:opt.tipo,marca:opt.marca,modelo:opt.modelo,propiedad:opt.propiedad,costoAdquisicion:n(opt.adquisicion),mantAdoptado:null}:{equipoOptionId:"",codigo:"",tipo:"",marca:"",modelo:"",propiedad:"",costoAdquisicion:0,mantAdoptado:null});}} style={{width:310,background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"7px 8px",color:C.text}}><option value="">Seleccionar equipo...</option>{equipoOptions.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></td>
      <td style={td}>{numInput(e.cantidad,v=>updEquipo(e.id,{cantidad:v}))}</td>
      <td style={{...td,color:C.text,fontWeight:800}}>{money(e.costoAdquisicion)}</td>
      <td style={td}>{numInput(e.vidaUtil??6000,v=>updEquipo(e.id,{vidaUtil:v}))}</td>
      <td style={{...td,color:C.yellow,fontWeight:900}}>{money(e.amortizacion)}</td>
      <td style={{...td,color:C.purple,fontWeight:900}}>{money(e.mantenimiento)}</td>
      <td style={{...td,color:C.green,fontWeight:900}}>{money(e.costoHoraTotal)}</td>
      <td style={td}>{numInput(e.mantAdoptado,v=>updEquipo(e.id,{mantAdoptado:v}))}</td>
      <td style={{...td,color:C.purple,fontWeight:900}}>{money(e.mantAdoptadoUsd)}</td>
      <td style={{...td,color:C.green,fontWeight:900}}>{money(e.costoHoraAdoptado)}</td>
      <td style={td}>{numInput(e.costoArrendado,v=>updEquipo(e.id,{costoArrendado:v}))}</td>
      <td style={{...td,color:e.comparacion.includes("más caro")?C.red:e.comparacion.includes("más barato")?C.green:C.textMuted,fontWeight:900,minWidth:180}}>{e.comparacion}</td>
      <td style={{...td,color:C.green,fontWeight:900}}>{money(e[totalKey])}</td>
      <td style={td}><button onClick={()=>update({equipos:tender.equipos.filter(x=>x.id!==e.id)})} style={{border:"none",background:"none",color:C.red,cursor:"pointer"}}>×</button></td>
    </tr>)}</tbody></table></div>;
  };
  return <div style={{display:"grid",gap:14,minWidth:0,paddingBottom:30}}>
    {tab!=="datosEquipos"&&<div style={{...panel,display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap"}}>
      <label style={{display:"grid",gap:5,fontSize:10,color:C.textMuted,fontWeight:800}}>LICITACIÓN<select value={tender.id} onChange={e=>setActiveId(e.target.value)} style={{minWidth:260,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 10px",color:C.text}}>{licitaciones.map(x=><option key={x.id} value={x.id}>{x.nombre}</option>)}</select></label>
      <button onClick={addTender} style={{padding:"9px 13px",borderRadius:8,border:`1px solid ${C.green}66`,background:`${C.green}18`,color:C.green,fontWeight:900,cursor:"pointer"}}>+ Nueva</button>
      <button onClick={duplicate} style={{padding:"9px 13px",borderRadius:8,border:`1px solid ${C.blue}66`,background:`${C.blue}18`,color:C.blue,fontWeight:900,cursor:"pointer"}}>Duplicar</button>
      <button onClick={removeTender} style={{padding:"9px 13px",borderRadius:8,border:`1px solid ${C.red}66`,background:C.redDim,color:C.red,fontWeight:900,cursor:"pointer"}}>Eliminar</button>
      <button onClick={()=>guardarLicitacion(tender)} disabled={licitacionesSaving} style={{padding:"9px 13px",borderRadius:8,border:`1px solid ${C.accent}66`,background:C.accentDim,color:C.accent,fontWeight:900,cursor:licitacionesSaving?"wait":"pointer"}}>{licitacionesSaving?"Guardando...":"Guardar en Google Sheets"}</button>
      <span style={{fontSize:11,fontWeight:800,color:licitacionesError?C.red:C.textMuted}}>{licitacionesError?`Error: ${licitacionesError}`:(licitacionesReady?"Base compartida conectada":"Conectando...")}</span>
      <button onClick={exportExcel} style={{marginLeft:"auto",padding:"9px 13px",borderRadius:8,border:`1px solid ${C.green}66`,background:`${C.green}18`,color:C.green,fontWeight:900,cursor:"pointer"}}>Descargar Excel</button>
    </div>}
    {tab==="nueva"&&<div style={{display:"grid",gap:14}}>
      <div style={panel}>
        <h3 style={{margin:"0 0 14px",color:C.text}}>Datos generales</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(160px,1fr))",gap:12}}>
          {field("Nombre",tender.nombre,v=>update({nombre:v}))}
          {field("Cliente",tender.cliente,v=>update({cliente:v}))}
          {field("Proyecto",tender.proyecto,v=>update({proyecto:v}))}
          {field("Fecha de creación",tender.fecha,v=>update({fecha:v}),"date")}
          <label style={{display:"grid",gap:5,fontSize:10,color:C.textMuted,fontWeight:800,textTransform:"uppercase"}}>Estado de licitación
            <select value={tender.estado||"EN CURSO"} onChange={e=>update({estado:e.target.value})} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 10px",color:C.text,outline:"none",fontFamily:"Inter"}}>
              <option value="EN CURSO">En curso</option>
              <option value="CERRADA">Cerrada</option>
            </select>
          </label>
          <label style={{display:"grid",gap:5,fontSize:10,color:C.textMuted,fontWeight:800,textTransform:"uppercase"}}>Resultado
            <select value={tender.resultado||"PENDIENTE"} onChange={e=>update({resultado:e.target.value})} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 10px",color:C.text,outline:"none",fontFamily:"Inter"}}>
              <option value="PENDIENTE">Pendiente</option>
              <option value="GANADA">Ganada</option>
              <option value="PERDIDA">Perdida</option>
            </select>
          </label>
        </div>
        <label style={{display:"grid",gap:5,marginTop:12,fontSize:10,color:C.textMuted,fontWeight:800}}>NOTAS<textarea value={tender.notas} onChange={e=>update({notas:e.target.value})} rows={5} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:10,color:C.text,resize:"vertical"}}/></label>
      </div>
      <div style={panel}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:12}}>
          <div><h3 style={{margin:0,color:C.text}}>Fechas importantes</h3><div style={{fontSize:11,color:C.textMuted,marginTop:3}}>Se pueden registrar cierres de consultas, entregas, visitas y otros hitos.</div></div>
          <button onClick={addFecha} style={{padding:"9px 13px",borderRadius:8,border:`1px solid ${C.accent}66`,background:C.accentDim,color:C.accent,fontWeight:900,cursor:"pointer"}}>+ Añadir fecha</button>
        </div>
        {(tender.fechas||[]).length===0?<div style={{padding:"18px 12px",border:`1px dashed ${C.border}`,borderRadius:10,color:C.textMuted,fontSize:12}}>Todavía no hay fechas cargadas.</div>:(tender.fechas||[]).map(f=><div key={f.id} style={{display:"grid",gridTemplateColumns:"180px minmax(220px,1fr) 42px",gap:10,alignItems:"center",marginBottom:8}}>
          <input type="date" value={f.fecha||""} onChange={e=>updFecha(f.id,{fecha:e.target.value})} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 10px",color:C.text}}/>
          <input value={f.descripcion||""} onChange={e=>updFecha(f.id,{descripcion:e.target.value})} placeholder="Descripción, por ejemplo: Cierre de consultas" style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 10px",color:C.text}}/>
          <button onClick={()=>removeFecha(f.id)} title="Eliminar fecha" style={{height:36,borderRadius:8,border:`1px solid ${C.red}55`,background:C.redDim,color:C.red,fontSize:18,cursor:"pointer"}}>×</button>
        </div>)}
      </div>
      <div style={panel}>
        <h3 style={{margin:"0 0 16px",color:C.text}}>Línea de tiempo</h3>
        {fechasOrdenadas.length===0?<div style={{padding:"22px 12px",textAlign:"center",color:C.textMuted,fontSize:12}}>La línea de tiempo se mostrará cuando se cargue al menos una fecha.</div>:<div style={{position:"relative",padding:"8px 12px 8px 28px"}}>
          <div style={{position:"absolute",left:10,top:12,bottom:12,width:2,background:`${C.accent}66`}}/>
          {fechasOrdenadas.map((f,i)=><div key={f.id} style={{position:"relative",display:"grid",gridTemplateColumns:"130px minmax(0,1fr)",gap:14,padding:"0 0 18px"}}>
            <div style={{position:"absolute",left:-23,top:4,width:12,height:12,borderRadius:"50%",background:i===0?C.accent:C.blue,border:"2px solid #171717",boxShadow:`0 0 0 3px ${i===0?C.accent:C.blue}33`}}/>
            <div style={{fontSize:12,fontWeight:900,color:C.accent}}>{formatFechaCorta(f.fecha)}</div>
            <div style={{fontSize:13,fontWeight:800,color:C.text}}>{f.descripcion||"Sin descripción"}</div>
          </div>)}
        </div>}
      </div>
    </div>}
    {tab==="control"&&<div style={{display:"grid",gap:14}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(150px,1fr))",gap:12}}>
        <div style={{...panel,borderColor:`${C.blue}66`}}><div style={{fontSize:11,color:C.textMuted,fontWeight:800,textTransform:"uppercase"}}>En curso</div><div style={{fontSize:32,fontWeight:950,color:C.blue,marginTop:8}}>{licitacionesEnCurso}</div></div>
        <div style={{...panel,borderColor:`${C.green}66`}}><div style={{fontSize:11,color:C.textMuted,fontWeight:800,textTransform:"uppercase"}}>Cerradas</div><div style={{fontSize:32,fontWeight:950,color:C.green,marginTop:8}}>{licitacionesCerradas}</div></div>
        <div style={{...panel,borderColor:"#22c55e88"}}><div style={{fontSize:11,color:C.textMuted,fontWeight:800,textTransform:"uppercase"}}>Ganadas</div><div style={{fontSize:32,fontWeight:950,color:"#22c55e",marginTop:8}}>{licitacionesGanadas}</div></div>
        <div style={{...panel,borderColor:`${C.red}88`}}><div style={{fontSize:11,color:C.textMuted,fontWeight:800,textTransform:"uppercase"}}>Perdidas</div><div style={{fontSize:32,fontWeight:950,color:C.red,marginTop:8}}>{licitacionesPerdidas}</div></div>
        <div style={{...panel,borderColor:`${C.accent}66`}}><div style={{fontSize:11,color:C.textMuted,fontWeight:800,textTransform:"uppercase"}}>Total</div><div style={{fontSize:32,fontWeight:950,color:C.accent,marginTop:8}}>{licitaciones.length}</div></div>
      </div>
      <div style={panel}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:12}}><div><h3 style={{margin:0,color:C.text}}>Control de licitaciones</h3><div style={{fontSize:11,color:C.textMuted,marginTop:3}}>Estado general de las licitaciones guardadas.</div></div></div>
        <div style={{overflow:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:1550}}>
            <thead><tr><th style={th}>Licitación</th><th style={th}>Cliente</th><th style={th}>Proyecto</th><th style={th}>Fecha</th><th style={{...th,minWidth:600}}>Línea de tiempo</th><th style={th}>Estado</th><th style={th}>Resultado</th><th style={th}></th></tr></thead>
            <tbody>{licitaciones.map(x=><tr key={x.id}>
              <td style={{...td,fontWeight:900,color:C.text}}>{x.nombre||"Sin nombre"}</td>
              <td style={td}>{x.cliente||"—"}</td>
              <td style={td}>{x.proyecto||"—"}</td>
              <td style={td}>{formatFechaCorta(x.fecha)}</td>
              <td style={{...td,padding:"4px 8px",minWidth:600}}>{renderControlTimeline(x)}</td>
              <td style={td}><select value={x.estado||"EN CURSO"} onChange={e=>setLicitaciones(xs=>xs.map(t=>t.id===x.id?{...t,estado:e.target.value}:t))} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"7px 8px",color:(x.estado||"EN CURSO")==="CERRADA"?C.green:C.blue,fontWeight:900}}><option value="EN CURSO">En curso</option><option value="CERRADA">Cerrada</option></select></td>
              <td style={td}><select value={x.resultado||"PENDIENTE"} onChange={e=>setLicitaciones(xs=>xs.map(t=>t.id===x.id?{...t,resultado:e.target.value}:t))} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"7px 8px",color:(x.resultado||"PENDIENTE")==="GANADA"?"#22c55e":(x.resultado||"PENDIENTE")==="PERDIDA"?C.red:C.textSub,fontWeight:900}}><option value="PENDIENTE">Pendiente</option><option value="GANADA">Ganada</option><option value="PERDIDA">Perdida</option></select></td>
              <td style={td}><button onClick={()=>{setActiveId(x.id);setTab("nueva");}} style={{padding:"7px 10px",borderRadius:7,border:`1px solid ${C.blue}55`,background:`${C.blue}18`,color:C.blue,fontWeight:900,cursor:"pointer"}}>Abrir</button></td>
            </tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>}
    {tab==="equipos"&&<div style={{display:"grid",gap:14}}>
      <div style={panel}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:12,flexWrap:"wrap"}}>
          <div><h3 style={{margin:0,color:C.text}}>Costos de equipos</h3><div style={{fontSize:11,color:C.textMuted,marginTop:3}}>Las horas se definen por contrato y se aplican a todos los equipos de la tabla.</div></div>
          <button onClick={addEquipo} style={{padding:"9px 13px",borderRadius:8,border:`1px solid ${C.accent}66`,background:C.accentDim,color:C.accent,fontWeight:900,cursor:"pointer"}}>+ Agregar equipo</button>
        </div>
        <div style={{display:"flex",alignItems:"flex-end",gap:12,flexWrap:"wrap",marginBottom:14,padding:"12px 14px",border:`1px solid ${C.border}`,borderRadius:10,background:"rgba(0,0,0,.18)"}}>
          <label style={{display:"grid",gap:5,fontSize:10,color:C.textMuted,fontWeight:800}}>HORAS DE CONTRATO 1{numInput(tender.horasContrato1??180,v=>update({horasContrato1:v}))}</label>
          {!usarSegundoContrato?<button onClick={()=>update({usarSegundoContrato:true,horasContrato2:tender.horasContrato2||horasContrato1})} style={{padding:"9px 13px",borderRadius:8,border:`1px solid ${C.blue}66`,background:`${C.blue}18`,color:C.blue,fontWeight:900,cursor:"pointer"}}>+ Agregar otra tabla con otras horas</button>:null}
        </div>
        <div style={{fontSize:12,fontWeight:900,color:C.accent,margin:"0 0 8px"}}>Contrato 1 · {horasContrato1.toLocaleString("es-AR")} horas</div>
        {renderEquiposTable(1)}
      </div>
      {usarSegundoContrato&&<div style={panel}>
        <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:14}}>
          <label style={{display:"grid",gap:5,fontSize:10,color:C.textMuted,fontWeight:800}}>HORAS DE CONTRATO 2{numInput(tender.horasContrato2??0,v=>update({horasContrato2:v}))}</label>
          <button onClick={()=>update({usarSegundoContrato:false})} style={{padding:"9px 13px",borderRadius:8,border:`1px solid ${C.red}55`,background:C.redDim,color:C.red,fontWeight:900,cursor:"pointer"}}>Quitar segunda tabla</button>
        </div>
        <div style={{fontSize:12,fontWeight:900,color:C.blue,margin:"0 0 8px"}}>Contrato 2 · {horasContrato2.toLocaleString("es-AR")} horas</div>
        {renderEquiposTable(2)}
      </div>}
    </div>}
    {tab==="datosEquipos"&&<div style={{display:"grid",gap:14}}>
      <div style={panel}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:14}}>
          <div><h3 style={{margin:0,color:C.text}}>Datos Equipos</h3><div style={{fontSize:11,color:C.textMuted,marginTop:4}}>Vista directa de las categorías y del costo horario calculados por Informe de Costos → Amortización / Resumen por equipo. Incluye únicamente camiones y equipos; la categoría OTROS queda excluida.</div></div>
          <div style={{display:"flex",gap:8}}><button onClick={()=>setCostosMantConfig(readCostosMantConfig())} style={{padding:"8px 11px",borderRadius:8,border:`1px solid ${C.blue}55`,background:`${C.blue}18`,color:C.blue,fontWeight:900,cursor:"pointer"}}>Actualizar categorías</button><button onClick={exportDatosEquipos} style={{padding:"8px 11px",borderRadius:8,border:`1px solid ${C.green}55`,background:`${C.green}18`,color:C.green,fontWeight:900,cursor:"pointer"}}>Exportar Excel</button></div>
        </div>
        <div style={{display:"flex",gap:12,alignItems:"flex-end",flexWrap:"wrap",padding:"12px 14px",borderRadius:10,border:`1px solid ${C.border}`,background:"rgba(0,0,0,.18)",marginBottom:12}}>
          <label style={{display:"grid",gap:5,fontSize:10,color:C.textMuted,fontWeight:850}}>DESDE<input type="date" value={datosEquiposDesde} onChange={e=>setDatosEquiposDesde(e.target.value)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 10px",color:C.text}}/></label>
          <label style={{display:"grid",gap:5,fontSize:10,color:C.textMuted,fontWeight:850}}>HASTA<input type="date" value={datosEquiposHasta} onChange={e=>setDatosEquiposHasta(e.target.value)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 10px",color:C.text}}/></label>
          <button onClick={()=>{setDatosEquiposDesde(`${new Date().getFullYear()}-01-01`);setDatosEquiposHasta(new Date().toISOString().slice(0,10));}} style={{padding:"8px 11px",borderRadius:8,border:`1px solid ${C.border}`,background:"rgba(255,255,255,.04)",color:C.textSub,fontWeight:900,cursor:"pointer"}}>Año actual</button>
          <MultiSel label="Proyecto" value={datosEquiposProyectos} onChange={setDatosEquiposProyectos} options={datosEquiposProyectoOpts} commitOnClose/>
          <MultiSel label="Categoría" value={datosEquiposCategorias} onChange={setDatosEquiposCategorias} options={datosEquiposCategoriaOpts} commitOnClose/>
          <MultiSel label="Equipo" value={datosEquiposEquipos} onChange={setDatosEquiposEquipos} options={datosEquiposEquipoOpts} commitOnClose/>
          <MultiSel label="Insumo RMA15" value={datosEquiposInsumos} onChange={setDatosEquiposInsumos} options={datosEquiposInsumoOpts} commitOnClose/>
          <button onClick={()=>{setDatosEquiposProyectos("todos");setDatosEquiposCategorias("todos");setDatosEquiposEquipos("todos");setDatosEquiposInsumos("todos");}} style={{padding:"8px 11px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.textSub,fontWeight:850,cursor:"pointer"}}>Limpiar filtros</button>
        </div>
        <div style={{padding:"10px 12px",borderRadius:9,border:`1px solid ${C.yellow}55`,background:C.yellowDim,color:C.textSub,fontSize:11,marginBottom:12}}>El mantenimiento se desagrega en <b>insumos por hora</b> + <b>mano de obra por hora</b>; ambas columnas suman exactamente Mantenimiento (USD/h). El consumo se muestra como dato informativo y <b>no se suma</b> al costo horario total. La categoría OTROS queda excluida.</div>
        <div style={{overflowX:"auto",overflowY:"visible"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:1485,tableLayout:"fixed"}}><colgroup>
          <col style={{width:120}}/><col style={{width:60}}/><col style={{width:220}}/><col style={{width:130}}/><col style={{width:120}}/><col style={{width:170}}/><col style={{width:120}}/><col style={{width:145}}/><col style={{width:155}}/><col style={{width:125}}/><col style={{width:120}}/>
        </colgroup><thead><tr>{["Categoría","Cantidad","Equipos y modelos incluidos","Consumo combustible (L/h)","Vida útil elegida (h)","Equipo / costo de adquisición","Amortización (USD/h)","Costo de insumos por h (USD/h)","Costo de mano de obra por h (USD/h)","Mantenimiento (USD/h)","Total equipo (USD/h)"].map(h=><th key={h} style={{...th,padding:"9px 7px",fontSize:9,whiteSpace:"normal",lineHeight:1.15}}>{h}</th>)}</tr></thead><tbody>
          {datosEquiposRows.map(g=><tr key={g.categoria}>
            <td style={{...td,fontWeight:950,color:C.accent,whiteSpace:"nowrap"}}>{g.categoria}</td>
            <td style={{...td,textAlign:"center",fontWeight:900}}>{g.equipos.length}</td>
            <td style={{...td,padding:"8px 7px"}}><div style={{display:"grid",gap:3}}>{g.modelos.map(m=><div key={m.nombre} style={{display:"flex",alignItems:"center",justifyContent:"flex-start",gap:6,minWidth:0}}><span style={{minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={m.nombre}>{m.nombre}</span><span style={{color:C.textMuted,fontWeight:800,flex:"0 0 auto",whiteSpace:"nowrap"}}>× {m.cantidad}</span></div>)}</div></td>
            <td style={{...td,textAlign:"right",fontWeight:900,color:C.blue}}>{g.consumo>0?<><div>{g.consumo.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})} L/h</div><div style={{fontSize:9,color:C.textMuted,marginTop:3}}>{g.combustible.toLocaleString("es-AR",{maximumFractionDigits:1})} L ÷ {g.horas.toLocaleString("es-AR",{maximumFractionDigits:1})} h</div></>:"—"}</td>
            <td style={{...td,textAlign:"center"}}><input type="number" min="1" step="100" value={Math.round(g.vidaUtil)} onChange={e=>setVidaCategoria(g.categoria,e.target.value)} style={{width:102,background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"7px 8px",color:C.text,textAlign:"right",fontWeight:900}}/><div style={{fontSize:9,color:C.textMuted,marginTop:3}}>Lista: {Math.round(g.vidaDefault).toLocaleString("es-AR")} h</div></td>
            <td style={{...td,padding:"8px 7px"}}>{g.equiposConPrecio.length?<AcquisitionCostSelector C={C} value={g.seleccionAdquisicion} onChange={value=>setAdquisicionCategoria(g.categoria,value)} averageCost={g.costoAdquisicionPromedio} equipmentOptions={g.equiposConPrecio}/>:"—"}</td>
            <td style={{...td,textAlign:"right",fontWeight:900,color:C.yellow}}>{g.amortizacion>0?`USD ${g.amortizacion.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}`:"—"}</td>
            <td style={{...td,textAlign:"right",fontWeight:900,color:C.blue}}>{g.costoInsumosHora>0?`USD ${g.costoInsumosHora.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}`:"—"}</td>
            <td style={{...td,textAlign:"right",fontWeight:900,color:C.orange||"#ff8c32"}}>{g.costoManoObraHora>0?`USD ${g.costoManoObraHora.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}`:"—"}</td>
            <td style={{...td,textAlign:"right",fontWeight:900,color:C.purple}}>{g.mantenimiento>0?`USD ${g.mantenimiento.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}`:"—"}</td>
            <td style={{...td,textAlign:"right",fontWeight:950,color:C.green}}>{(g.amortizacion+g.mantenimiento)>0?`USD ${(g.amortizacion+g.mantenimiento).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}`:"—"}</td>
          </tr>)}
          {!datosEquiposRows.length&&<tr><td colSpan={11} style={{...td,textAlign:"center",padding:28,color:C.textMuted}}>No se encontraron equipos o camiones con mantenimiento registrado en el período y filtros seleccionados.</td></tr>}
        </tbody></table></div>
      </div>
    </div>}


  </div>;
}


function useGlobalThreeStateTableSort(){
  useEffect(()=>{
    if(typeof document==="undefined")return undefined;

    const styleId="dm-global-table-sort-style";
    if(!document.getElementById(styleId)){
      const style=document.createElement("style");
      style.id=styleId;
      style.textContent=`
        table thead th:not([data-dm-no-sort="true"]){cursor:pointer;user-select:none}
        table thead th[data-dm-sort-dir="asc"]::after{content:" ↑";color:#e8001d;font-weight:900}
        table thead th[data-dm-sort-dir="desc"]::after{content:" ↓";color:#e8001d;font-weight:900}
      `;
      document.head.appendChild(style);
    }

    const originalOrder=new WeakMap();
    const tableState=new WeakMap();

    const normalizeValue=(raw)=>{
      const text=String(raw??"").replace(/\s+/g," ").trim();
      if(!text)return{kind:"empty",value:""};

      const dmy=text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(?:\s|$)/);
      if(dmy){
        const year=Number(dmy[3].length===2?`20${dmy[3]}`:dmy[3]);
        const value=new Date(year,Number(dmy[2])-1,Number(dmy[1])).getTime();
        if(Number.isFinite(value))return{kind:"number",value};
      }
      const iso=text.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s|$)/);
      if(iso){
        const value=new Date(Number(iso[1]),Number(iso[2])-1,Number(iso[3])).getTime();
        if(Number.isFinite(value))return{kind:"number",value};
      }

      let numeric=text
        .replace(/^(?:ARS|USD|U\$S)\s*/i,"")
        .replace(/[a-zA-ZáéíóúÁÉÍÓÚ²³\/]+.*$/g,"")
        .replace(/[$%\s]/g,"")
        .trim();
      if(/^-?[\d.,]+$/.test(numeric)){
        if(numeric.includes(","))numeric=numeric.replace(/\./g,"").replace(",",".");
        else numeric=numeric.replace(/,/g,"");
        const value=Number(numeric);
        if(Number.isFinite(value))return{kind:"number",value};
      }
      return{kind:"text",value:text.toLocaleLowerCase("es-AR")};
    };

    const getGroups=(tbody)=>{
      const rows=Array.from(tbody.children).filter(el=>el.tagName==="TR");
      const groups=[];
      for(let i=0;i<rows.length;i++){
        const row=rows[i];
        const group=[row];
        while(i+1<rows.length){
          const next=rows[i+1];
          const first=next.cells&&next.cells[0];
          const isDetail=next.cells?.length===1&&Number(first?.colSpan||1)>1;
          if(!isDetail)break;
          group.push(next);i++;
        }
        groups.push(group);
      }
      return groups;
    };

    const clearIndicators=(table)=>{
      table.querySelectorAll("thead th[data-dm-sort-dir]").forEach(th=>{
        th.removeAttribute("data-dm-sort-dir");
      });
    };

    const onClick=(event)=>{
      const th=event.target.closest?.("th");
      if(!th||th.dataset.dmManagedSort==="true"||th.dataset.dmNoSort==="true")return;
      const table=th.closest("table");
      if(!table||!table.tHead||!table.tBodies.length)return;
      const headerRow=th.parentElement;
      if(!headerRow||headerRow.parentElement?.tagName!=="THEAD")return;
      const colIndex=Array.from(headerRow.cells).indexOf(th);
      if(colIndex<0)return;

      const previous=tableState.get(table)||{col:-1,dir:"original"};
      let dir="asc";
      if(previous.col===colIndex&&previous.dir==="asc")dir="desc";
      else if(previous.col===colIndex&&previous.dir==="desc")dir="original";

      clearIndicators(table);
      if(dir!=="original")th.dataset.dmSortDir=dir;
      tableState.set(table,{col:colIndex,dir});

      Array.from(table.tBodies).forEach(tbody=>{
        const groups=getGroups(tbody);
        groups.forEach((group,index)=>{
          const anchor=group[0];
          if(!originalOrder.has(anchor))originalOrder.set(anchor,index);
        });

        const ordered=[...groups];
        if(dir==="original"){
          ordered.sort((a,b)=>(originalOrder.get(a[0])??0)-(originalOrder.get(b[0])??0));
        }else{
          ordered.sort((a,b)=>{
            const av=normalizeValue(a[0].cells?.[colIndex]?.innerText||"");
            const bv=normalizeValue(b[0].cells?.[colIndex]?.innerText||"");
            if(av.kind==="empty"&&bv.kind!=="empty")return 1;
            if(bv.kind==="empty"&&av.kind!=="empty")return -1;
            let cmp=0;
            if(av.kind==="number"&&bv.kind==="number")cmp=av.value-bv.value;
            else cmp=String(av.value).localeCompare(String(bv.value),"es-AR",{numeric:true,sensitivity:"base"});
            return dir==="asc"?cmp:-cmp;
          });
        }
        ordered.forEach(group=>group.forEach(row=>tbody.appendChild(row)));
      });
    };

    document.addEventListener("click",onClick);
    return()=>document.removeEventListener("click",onClick);
  },[]);
}

export function LicitacionesModule({ deps = {}, ...props }) {
  __deps = deps || {};
  return <LicitacionesView {...props} />;
}

export default LicitacionesModule;
