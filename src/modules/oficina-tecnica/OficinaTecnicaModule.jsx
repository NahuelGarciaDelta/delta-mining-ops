import React, { useState, useCallback, useMemo, useEffect, useRef, startTransition } from "react";
import ReactDOM from "react-dom";
import * as XLSX from "xlsx";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, Legend, ReferenceLine } from "recharts";
import ComparisonStrip from "../../components/ComparisonStrip.jsx";
import {WeatherSummary} from "../weather/WeatherModule.jsx";
import { previousComparablePeriod } from "../../shared/periodCompare.js";
import { calculateAtrasoRop02, equipmentProjectKey, normalizeRop02Project } from "../home/homeAvailability.js";
import {cancelEquipmentMovement,saveEquipmentMovement,useEquipmentMovements} from "../../services/equipmentMovements.js";
import {cancelErrorAcceptance,errorAcceptanceKey,saveErrorAcceptance,useErrorAcceptances} from "../../services/errorAcceptances.js";
import {getRop02,getRop05,getRop02LatestByEquipmentProject} from "../../data/historicalDataService.js";
import {normalizeROP02,normalizeROP05,calcControl} from "../../shared/domain/index.jsx";

// Dependencias compartidas inyectadas desde App mientras se completa la modularización.
const DEFAULT_COLORS={
  green:"#10b981", blue:"#3b82f6", teal:"#14b8a6", purple:"#8b5cf6",
  red:"#ef4444", yellow:"#f59e0b", text:"#f8fafc", textSub:"#cbd5e1",
  textMuted:"#94a3b8", card:"#111827", surface:"#0f172a", border:"#334155",
  redDim:"rgba(239,68,68,.12)", greenDim:"rgba(16,185,129,.12)",
  blueDim:"rgba(59,130,246,.12)", tealDim:"rgba(20,184,166,.12)",
  yellowDim:"rgba(245,158,11,.12)"
};
let AlertBanner, Badge, BtnExcel, C=DEFAULT_COLORS, Card, ChartTip, DateIn, HealthDashboard, IMG_CARGADORA_FRONTAL, IMG_EXCAVADORA, IMG_MINICARGADORA, IMG_MOTONIVELADORA, IMG_RETROPALA, IMG_RODILLO_COMPACTADOR, IMG_TOPADORA, Icon, LISTA_COLUMNS, ListaEquipoFieldInput, MultiSel, PeriodMonthYear, Sel, Spinner, StatCard, SubTab, TabBtn, Table, VEH_CAMIONETA, VEH_COMBUSTIBLE, VEH_REGADOR, VEH_TRACTOR, VEH_VOLCADOR, appAlert, appConfirm, buildHorometroMapForLista, buildListaEquipoInfoIndex, buildVehicleListaIndex, byDateFilter, canonicalEquivalentMachineCode, cleanKey, cleanMachine, dmDisplayTarea, dmMatchTipoMaquinaSeleccion, dmNormalizeUnidad, dmTipoMaquinaOptions, excelFromCols, findColumnKey, fmtFecha, fmtNum, fmtPct, generarExcelICHC, generarExcelListaMaestra, generarReporteControl, getListaEquipoInfoMatch, getListaVehicleMatch, getPropiedadVehiculoFromListaRow, getValue, isRop02ControlMachineExcluded, isValidEquipoCodigoParaCorrelacion, isYearOnlyListaField, machineCodeOutsideParentheses, machineLookupVariants, mainMachineCode, matchMulti, multiIsAll, normDate, normProject, normalizeMachineCode, normalizeVehicleFamily, normalizeYearValue, postAddListaEquipo, postBulkUpdateListaEquipos, postUpdateListaEquipo, postUpdateROP02Row, proyColor, semaforo, uniq, validPropiedadValue, BlockingDataLoader;
let anioAcumulado, anioAcumuladoOpts, periodoAcumulado, rangoAcumulado, setAnioAcumulado, setPeriodoAcumulado;

function applyDeps(deps={}){
  const previousC=C;
  ({AlertBanner, Badge, BtnExcel, C, Card, ChartTip, DateIn, HealthDashboard, IMG_CARGADORA_FRONTAL, IMG_EXCAVADORA, IMG_MINICARGADORA, IMG_MOTONIVELADORA, IMG_RETROPALA, IMG_RODILLO_COMPACTADOR, IMG_TOPADORA, Icon, LISTA_COLUMNS, ListaEquipoFieldInput, MultiSel, PeriodMonthYear, Sel, Spinner, StatCard, SubTab, TabBtn, Table, VEH_CAMIONETA, VEH_COMBUSTIBLE, VEH_REGADOR, VEH_TRACTOR, VEH_VOLCADOR, appAlert, appConfirm, buildHorometroMapForLista, buildListaEquipoInfoIndex, buildVehicleListaIndex, byDateFilter, canonicalEquivalentMachineCode, cleanKey, cleanMachine, dmDisplayTarea, dmMatchTipoMaquinaSeleccion, dmNormalizeUnidad, dmTipoMaquinaOptions, excelFromCols, findColumnKey, fmtFecha, fmtNum, fmtPct, generarExcelICHC, generarExcelListaMaestra, generarReporteControl, getListaEquipoInfoMatch, getListaVehicleMatch, getPropiedadVehiculoFromListaRow, getValue, isRop02ControlMachineExcluded, isValidEquipoCodigoParaCorrelacion, isYearOnlyListaField, machineCodeOutsideParentheses, machineLookupVariants, mainMachineCode, matchMulti, multiIsAll, normDate, normProject, normalizeMachineCode, normalizeVehicleFamily, normalizeYearValue, postAddListaEquipo, postBulkUpdateListaEquipos, postUpdateListaEquipo, postUpdateROP02Row, proyColor, semaforo, uniq, validPropiedadValue, BlockingDataLoader}=deps);
  C={...DEFAULT_COLORS,...(previousC||{}),...(deps.C||{})};
}

function ViewListaMaestraEquipos({rows,rop02All,rop05=[],rma15=[],onReloadLista}){
  const LISTA_MAESTRA_STORAGE_KEY="delta_lista_maestra_equipos_filters_v1";
  const readListaMaestraSaved=(key,def="")=>{
    try{return localStorage.getItem(`${LISTA_MAESTRA_STORAGE_KEY}_${key}`)??def;}
    catch(_){return def;}
  };
  const[search,setSearch]=useState(()=>readListaMaestraSaved("search",""));
  const[fechaHorometro,setFechaHorometro]=useState(()=>readListaMaestraSaved("fechaHorometro",""));
  const[soloActivos,setSoloActivos]=useState(()=>readListaMaestraSaved("soloActivos","false")==="true");
  const[filtersOpen,setFiltersOpen]=useState(false);
  const[addOpen,setAddOpen]=useState(false);
  const[newEquipo,setNewEquipo]=useState({});
  const[savingEquipo,setSavingEquipo]=useState(false);
  const[addMsg,setAddMsg]=useState(null);
  const[editOpen,setEditOpen]=useState(false);
  const[editEquipo,setEditEquipo]=useState({});
  const[editSelected,setEditSelected]=useState("");
  const[savingEdit,setSavingEdit]=useState(false);
  const[editMsg,setEditMsg]=useState(null);
  const[syncingListaExcel,setSyncingListaExcel]=useState(false);
  const[syncMsg,setSyncMsg]=useState(null);
  const[listaTab,setListaTab]=useState("maestra");

  useEffect(()=>{
    try{localStorage.setItem(`${LISTA_MAESTRA_STORAGE_KEY}_search`,search||"");}
    catch(_){}
  },[search]);

  useEffect(()=>{
    try{localStorage.setItem(`${LISTA_MAESTRA_STORAGE_KEY}_fechaHorometro`,fechaHorometro||"");}
    catch(_){}
  },[fechaHorometro]);

  useEffect(()=>{
    try{localStorage.setItem(`${LISTA_MAESTRA_STORAGE_KEY}_soloActivos`,String(soloActivos));}
    catch(_){}
  },[soloActivos]);

  const data=useMemo(()=>rows||[],[rows]);
  const allKeys=useMemo(()=>{
    const set=new Set();
    data.slice(0,200).forEach(r=>Object.keys(r||{}).forEach(k=>{if(k&&String(k).trim())set.add(k);}));
    return Array.from(set);
  },[data]);

  // Columna "HORAS" de la planilla: valor de respaldo cuando la máquina no
  // tiene registros en ROP02 (no se separa con findColumnKey para que no
  // "robe" el match de otras columnas como "Horas Trab. x Mes").
  const horasKey=useMemo(()=>allKeys.find(k=>cleanKey(k)==="horas"),[allKeys]);
  const searchableKeys=useMemo(()=>allKeys.filter(k=>k!==horasKey),[allKeys,horasKey]);

  // Clave de código usada para cruzar contra ROP02: el código fuera de
  // paréntesis en ROP02 (ej. "MOT-0024" en "MOT-0024 (MOT-0047)") corresponde
  // al "Código Drusila" de la lista maestra.
  const drusilaKey=useMemo(()=>findColumnKey(searchableKeys,"Codigo Drusila",["Codigo de Drusila","Cod Drusila"]),[searchableKeys]);
  const codigoNuevoKey=useMemo(()=>findColumnKey(searchableKeys,"Codigo Nuevo",["Codigo Interno","CODIGO N° INTERNO","Interno"]),[searchableKeys]);
  const descripcionEquipoKey=useMemo(()=>findColumnKey(searchableKeys,"Descripcion",["Descripción","Equipo","Tipo de Equipo","Tipo Equipo","Marca / Modelo","Modelo"]),[searchableKeys]);
  const horometroMap=useMemo(()=>buildHorometroMapForLista(rop02All,fechaHorometro),[rop02All,fechaHorometro]);

  const dataWithKey=useMemo(()=>data.map(r=>{
    const maquinaKeys=machineLookupVariants(
      drusilaKey?r[drusilaKey]:"",
      codigoNuevoKey?r[codigoNuevoKey]:""
    );
    const maquinaKey=maquinaKeys[0]||cleanMachine(r[drusilaKey]||r[codigoNuevoKey]||"");
    const ropInfo=maquinaKeys.map(k=>horometroMap[k]).find(Boolean)||null;
    const fallbackRaw=horasKey?String(r[horasKey]||"").trim():"";
    const fallbackNum=fallbackRaw?parseFloat(fallbackRaw.replace(/[^0-9.-]/g,"")):NaN;
    // Prioridad del horómetro:
    // 1) ROP02 del día filtrado, si existe.
    // 2) Si ese día no existe, último horómetro final ROP02 de la máquina.
    // 3) Si la máquina no tiene ninguna carga ROP02 histórica, columna HORAS de la Lista Maestra.
    const horometroValue=ropInfo?ropInfo.horometroFinal:(Number.isFinite(fallbackNum)?fallbackNum:null);
    return{
      ...r,
      _maquinaKey:maquinaKey,
      _ropInfo:ropInfo,
      _horometroValue:horometroValue,
      _horometroDisplay:horometroValue!=null?fmtNum(horometroValue):"",
    };
  }),[data,drusilaKey,codigoNuevoKey,horometroMap,horasKey,fechaHorometro]);

  // Equipos activos: tuvieron al menos 1 registro en ROP02 en los últimos 7 días
  // (contados hacia atrás desde hoy, inclusive).
  const activeMachinesSet=useMemo(()=>{
    const hoy=new Date();
    hoy.setHours(0,0,0,0);
    const hace7=new Date(hoy);
    hace7.setDate(hace7.getDate()-7);
    const set=new Set();
    (rop02All||[]).forEach(r=>{
      if(!r.fecha)return;
      const d=new Date(r.fecha);
      d.setHours(0,0,0,0);
      if(d>=hace7&&d<=hoy){
        const keys=machineLookupVariants(r.maquina,"");
        keys.forEach(k=>set.add(k));
        set.add(cleanMachine(r.maquina));
      }
    });
    return set;
  },[rop02All]);

  const q=cleanKey(search);
  const searched=useMemo(()=>{
    let base=dataWithKey;
    if(soloActivos)base=base.filter(r=>activeMachinesSet.has(r._maquinaKey));
    if(!q)return base;
    return base.filter(r=>searchableKeys.some(k=>cleanKey(r[k]).includes(q)));
  },[dataWithKey,searchableKeys,q,soloActivos,activeMachinesSet]);

  const cols=useMemo(()=>LISTA_COLUMNS.map((col,idx)=>{
    if(col.special==="horometro"){
      return{
        key:"_horometroDisplay",label:col.label,filterKey:"_horometroDisplay",
        render:(_v,row)=>{
          if(row._horometroValue==null)return<span style={{color:C.textMuted}}>—</span>;
          if(row._ropInfo){
            const isFallback=row._ropInfo.modo==="fallback_ultimo"||row._ropInfo.modo==="fallback_historico";
            const tip=`${isFallback?"Sin registro el día elegido. Último horómetro final ROP02 disponible":"Registro ROP02"}: ${fmtFecha(row._ropInfo.fecha)}${row._ropInfo.turno?` (${row._ropInfo.turno})`:""}`;
            return<span style={{display:"inline-block",padding:"2px 7px",borderRadius:5,background:(isFallback?C.yellow:C.green)+"33",border:`1px solid ${(isFallback?C.yellow:C.green)}55`,color:"#fff",fontWeight:700}} title={tip}>{fmtNum(row._horometroValue)}</span>;
          }
          return<span style={{display:"inline-block",padding:"2px 7px",borderRadius:5,background:C.red+"33",border:`1px solid ${C.red}55`,color:"#fff",fontWeight:700}} title="Sin registros en ROP02 — valor fijo de la planilla (columna HORAS), no se actualiza">{fmtNum(row._horometroValue)}</span>;
        }
      };
    }
    const realKey=findColumnKey(searchableKeys,col.label,col.aliases);
    const isCodigo=idx===0; // Código Drusila → badge, igual al estilo de la columna MÁQUINA en ROP02
    return{
      key:realKey||`_missing_${idx}`,label:col.label,wrap:col.label.length>=17,
      width:col.width, minWidth:col.minWidth, maxWidth:col.maxWidth,
      align:col.align, compact:col.compact, color:col.color,
      filterKey:realKey||null,
      render:!realKey?()=><span style={{color:C.textMuted}}>—</span>:
        isCodigo?(v)=>v?<Badge color={C.purple}>{v}</Badge>:<span style={{color:C.textMuted}}>—</span>:
        undefined,
    };
  }),[searchableKeys,fechaHorometro]);

  // ── Filtros desplegables facetados, uno por columna ──
  const filterFields=useMemo(()=>{
    const seen=new Set();
    return cols.filter(c=>c.filterKey&&!seen.has(c.filterKey)&&(seen.add(c.filterKey),true))
      .map(c=>({key:c.filterKey,label:c.label,color:c.color}));
  },[cols]);
  const filterKeysOnly=useMemo(()=>filterFields.map(f=>f.key),[filterFields]);
  const{vals:fVals,set:fSet,opts:fOpts,filtered,reset:fReset,hayFiltros}=useSimpleFacetedFilters(searched,filterKeysOnly,`${LISTA_MAESTRA_STORAGE_KEY}_columnFilters`);

  const propiedadKey=useMemo(()=>findColumnKey(searchableKeys,"Propiedad",["PROPIEDAD","Propiedad Equipo","Propiedad del equipo","Propiedad de equipo"]),[searchableKeys]);
  const costoLocalKey=useMemo(()=>findColumnKey(searchableKeys,"Costo Local USD (s/IVA)",["Costo Local en Dolares sin IVA","Costo Local USD sin IVA","Costo Local Dolares","Costo Local USD","Costo Local"]),[searchableKeys]);
  const tarifaAlquilerKey=useMemo(()=>findColumnKey(searchableKeys,"Tarifa Mensual Alquiler",["Tarifa Mensual de Alquiler","Tarifa de Alquiler Mensual","Tarifa Alquiler","Alquiler Mensual"]),[searchableKeys]);

  const equiposSinInfo=useMemo(()=>{
    const listaIndex=buildListaEquipoInfoIndex(data);
    // Solo se controlan equipos con registros desde mayo de 2026 en adelante.
    // Esto evita que equipos históricos anteriores a mayo entren en la correlación
    // Código Drusila / Código Nuevo y ensucien la ventana de pendientes.
    const FECHA_CORTE_EQUIPOS_SIN_INFO="2026-05-01";
    const fechaComparable=(v)=>{
      if(!v)return"";
      const s=String(v).trim();
      if(!s)return"";
      const iso=s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
      if(iso)return`${iso[1]}-${String(iso[2]).padStart(2,"0")}-${String(iso[3]).padStart(2,"0")}`;
      const dmy=s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
      if(dmy)return`${dmy[3]}-${String(dmy[2]).padStart(2,"0")}-${String(dmy[1]).padStart(2,"0")}`;
      const d=new Date(s);
      if(!Number.isNaN(d.getTime()))return d.toISOString().slice(0,10);
      return"";
    };
    const esRegistroDesdeMayo=(fecha)=>{
      const f=fechaComparable(fecha);
      return !!f&&f>=FECHA_CORTE_EQUIPOS_SIN_INFO;
    };
    const toNumInfo=(v)=>{
      if(v===null||v===undefined||v==="")return 0;
      const s=String(v).trim();
      if(!s||s==="-"||s==="—")return 0;
      let clean=s.replace(/[^0-9,.-]/g,"");
      const lastComma=clean.lastIndexOf(",");
      const lastDot=clean.lastIndexOf(".");
      if(lastComma>-1&&lastDot>-1){
        clean=lastComma>lastDot?clean.replace(/\./g,"").replace(",","."):clean.replace(/,/g,"");
      }else if(lastComma>-1){
        clean=clean.replace(/\./g,"").replace(",",".");
      }
      const n=Number(clean);
      return Number.isFinite(n)?n:0;
    };
    const esPropDelta=(v)=>{
      const k=cleanKey(v);
      return k.includes("delta")||k.includes("propia")||k.includes("propio");
    };
    const pending=new Map();
    const registroProyectoLugar=(r)=>{
      const v=getValue(r||{},[
        "proyecto","Proyecto","PROYECTO",
        "lugar","Lugar","LUGAR",
        "proyectoLugar","Proyecto/Lugar","PROYECTO/LUGAR",
        "ubicacion","Ubicación","UBICACION",
        "sector","Sector","SECTOR"
      ]);
      const t=String(v||"").trim();
      return t&&t!=="-"&&t!=="—"?t:"—";
    };
    const add=(rawCode,fuente,fecha,tipo,proyectoLugar)=>{
      if(!esRegistroDesdeMayo(fecha))return;
      if(!isValidEquipoCodigoParaCorrelacion(rawCode))return;
      const code=cleanMachine(mainMachineCode(rawCode)||rawCode);
      if(!code)return;
      const fechaISO=fechaComparable(fecha);
      const match=getListaEquipoInfoMatch(listaIndex,rawCode);
      const key=match?`LM_${match._idx}`:`SIN_${machineLookupVariants(rawCode)[0]||code}`;
      const prev=pending.get(key)||{
        codigoDrusila:match?.codigoDrusila||"",
        codigoNuevo:match?.codigoNuevo||"",
        codigoRegistro:code,
        tipoEquipo:tipo||match?.familia||"",
        propiedad:match?(String((propiedadKey?match[propiedadKey]:match.propiedad)||match.propiedad||"").trim()):"",
        fuenteSet:new Set(),
        proyectoSet:new Set(),
        registros:0,
        ultimaFecha:"",
        motivos:[],
        _match:match,
      };
      prev.fuenteSet.add(fuente);
      if(proyectoLugar&&proyectoLugar!=="—")prev.proyectoSet.add(proyectoLugar);
      prev.registros+=1;
      if(fechaISO&&(!prev.ultimaFecha||fechaISO>prev.ultimaFecha))prev.ultimaFecha=fechaISO;
      if(!prev.tipoEquipo&&tipo)prev.tipoEquipo=tipo;
      pending.set(key,prev);
    };
    (rop02All||[]).forEach(r=>add(r.maquina,"ROP02",r.fecha,r.equipo||r._tipo,registroProyectoLugar(r)));
    (rop05||[]).forEach(r=>add(r.maquina,"ROP05",r.fecha,r.tipo_maquina||r._tipo,registroProyectoLugar(r)));
    (rma15||[]).forEach(r=>add(r.maquina,"RMA15",r.fecha,r.tipoEquipo,registroProyectoLugar(r)));

    const out=[];
    pending.forEach(item=>{
      const motivos=[];
      const match=item._match;
      if(!match){
        motivos.push("No está en Lista Maestra");
      }else{
        const propRaw=String((propiedadKey?match[propiedadKey]:match.propiedad)||match.propiedad||"").trim();
        const propValid=validPropiedadValue(propRaw);
        if(!propValid)motivos.push("Sin propiedad");
        else if(esPropDelta(propRaw)){
          const costo=toNumInfo(costoLocalKey?match[costoLocalKey]:"");
          if(!(costo>0))motivos.push("Sin costo local USD");
        }else{
          const tarifa=toNumInfo(tarifaAlquilerKey?match[tarifaAlquilerKey]:"");
          if(!(tarifa>0))motivos.push("Sin tarifa mensual de alquiler");
        }
      }
      if(!motivos.length)return;
      out.push({
        codigoRegistro:item.codigoRegistro,
        codigoDrusila:item.codigoDrusila||"—",
        codigoNuevo:item.codigoNuevo||"—",
        tipoEquipo:item.tipoEquipo||"—",
        propiedad:item.propiedad||"—",
        fuentes:Array.from(item.fuenteSet).sort().join(" / "),
        proyectoLugar:Array.from(item.proyectoSet||[]).sort().join(" / ")||"—",
        registros:item.registros,
        ultimaFecha:item.ultimaFecha,
        motivo:motivos.join(" + "),
      });
    });
    return out.sort((a,b)=>String(a.motivo).localeCompare(String(b.motivo))||String(a.codigoRegistro).localeCompare(String(b.codigoRegistro)));
  },[data,rop02All,rop05,rma15,propiedadKey,costoLocalKey,tarifaAlquilerKey]);

  const equiposSinInfoCols=useMemo(()=>[
    {key:"codigoRegistro",label:"Código en planillas",render:v=><Badge color={C.purple}>{v}</Badge>},
    {key:"codigoDrusila",label:"Código Drusila"},
    {key:"codigoNuevo",label:"Código Nuevo"},
    {key:"tipoEquipo",label:"Tipo / equipo"},
    {key:"propiedad",label:"Propiedad"},
    {key:"fuentes",label:"Planillas"},
    {key:"proyectoLugar",label:"Proyecto / lugar",wrap:true},
    {key:"registros",label:"Registros",align:"right",render:v=><b>{fmtNum(v)}</b>},
    {key:"ultimaFecha",label:"Última fecha",render:v=>v?fmtFecha(v):"—"},
    {key:"motivo",label:"Información faltante",wrap:true,render:v=><span style={{color:C.red,fontWeight:800}}>{v}</span>},
  ],[]);

  const descargarEquiposSinInfo=useCallback(()=>{
    const wb=XLSX.utils.book_new();
    const headers=["Código en planillas","Código Drusila","Código Nuevo","Tipo / equipo","Propiedad","Planillas","Proyecto / lugar","Registros","Última fecha","Información faltante"];
    const body=equiposSinInfo.map(r=>[r.codigoRegistro,r.codigoDrusila,r.codigoNuevo,r.tipoEquipo,r.propiedad,r.fuentes,r.proyectoLugar,r.registros,r.ultimaFecha?fmtFecha(r.ultimaFecha):"",r.motivo]);
    const ws=XLSX.utils.aoa_to_sheet([headers,...body]);
    ws["!cols"]=[{wch:18},{wch:18},{wch:18},{wch:24},{wch:18},{wch:18},{wch:22},{wch:10},{wch:14},{wch:34}];
    XLSX.utils.book_append_sheet(wb,ws,"Equipos sin info");
    XLSX.writeFile(wb,`Equipos_sin_informacion_${new Date().toISOString().slice(0,10).replace(/-/g,"")}.xlsx`);
  },[equiposSinInfo]);

  const formFields=useMemo(()=>LISTA_COLUMNS.map(col=>{
    const realKey=col.special==="horometro"
      ? (horasKey||"HORAS")
      : (findColumnKey(searchableKeys,col.label,col.aliases)||col.label);
    return{...col,key:realKey,inputType:isYearOnlyListaField(col.label)?"year":"text"};
  }),[searchableKeys,horasKey]);

  const equipoEditOptions=useMemo(()=>dataWithKey.map((r,idx)=>{
    const codDrusila=drusilaKey?String(r[drusilaKey]||"").trim():"";
    const codNuevo=codigoNuevoKey?String(r[codigoNuevoKey]||"").trim():"";
    const desc=descripcionEquipoKey?String(r[descripcionEquipoKey]||"").trim():"";
    const title=[codDrusila,codNuevo].filter(Boolean).join(" / ") || `Fila ${idx+1}`;
    return{value:String(idx),label:desc?`${title} — ${desc}`:title};
  }),[dataWithKey,drusilaKey,codigoNuevoKey,descripcionEquipoKey]);

  const setNewEquipoValue=useCallback((key,value)=>{
    setNewEquipo(prev=>({...prev,[key]:value}));
  },[]);

  const setEditEquipoValue=useCallback((key,value)=>{
    setEditEquipo(prev=>({...prev,[key]:value}));
  },[]);

  const seleccionarEquipoEditar=useCallback((value)=>{
    setEditSelected(value);
    setEditMsg(null);
    const row=dataWithKey[Number(value)];
    if(!row){setEditEquipo({});return;}
    const next={};
    formFields.forEach(f=>{
      const raw=row[f.key]===undefined||row[f.key]===null?"":String(row[f.key]);
      next[f.key]=f.inputType==="year"?normalizeYearValue(raw):raw;
    });
    setEditEquipo(next);
  },[dataWithKey,formFields]);

  const limpiarNuevoEquipo=useCallback(()=>{
    setNewEquipo({});
    setAddMsg(null);
  },[]);

  const limpiarEdicionEquipo=useCallback(()=>{
    setEditSelected("");
    setEditEquipo({});
    setEditMsg(null);
  },[]);

  const guardarEdicionEquipo=useCallback(async()=>{
    const originalRow=dataWithKey[Number(editSelected)];
    if(!originalRow){
      setEditMsg({type:"error",text:"Seleccioná primero un equipo para modificar."});
      return;
    }
    const codigoDrusila=drusilaKey?String(originalRow[drusilaKey]||"").trim():"";
    const codigoNuevo=codigoNuevoKey?String(originalRow[codigoNuevoKey]||"").trim():"";
    // La edición se identifica SIEMPRE por Código Drusila/Código Nuevo, no por índice visual.
    // El índice cambia si la tabla se filtra/ordena y puede pisar otra fila.
    if(!codigoDrusila&&!codigoNuevo){
      setEditMsg({type:"error",text:"El equipo no tiene Código Drusila ni Código Nuevo. No se puede guardar."});
      return;
    }
    setSavingEdit(true);
    setEditMsg({type:"info",text:"Actualizando equipo en Google Sheets..."});
    try{
      const cleanRow={};
      formFields.forEach(f=>{
        const v=editEquipo[f.key];
        cleanRow[f.key]=v===undefined||v===null?"":String(v).trim();
      });
      const originalLookupKeys=machineLookupVariants(codigoDrusila,codigoNuevo);
      const res=await postUpdateListaEquipo({
        codigoDrusila,
        codigoNuevo,
        codigoPrincipal:mainMachineCode(codigoDrusila||codigoNuevo),
        codigoDrusilaNorm:normalizeMachineCode(codigoDrusila),
        codigoNuevoNorm:normalizeMachineCode(codigoNuevo),
        lookupKeys:originalLookupKeys,
        codigoDrusilaHeader:drusilaKey||"",
        codigoNuevoHeader:codigoNuevoKey||"",
        // No se envía rowNumber: el Apps Script debe buscar la fila por Código Drusila.
        useRowNumber:false,
      },cleanRow);
      setEditMsg({type:"success",text:`Equipo actualizado en la fila ${res.rowNumber||"encontrada por Código Drusila"}.`});
      if(onReloadLista)await onReloadLista();
    }catch(err){
      setEditMsg({type:"error",text:err.message});
    }finally{
      setSavingEdit(false);
    }
  },[dataWithKey,editSelected,drusilaKey,codigoNuevoKey,formFields,editEquipo,onReloadLista]);

  const guardarNuevoEquipo=useCallback(async()=>{
    const codigoDrusilaField=formFields.find(f=>cleanKey(f.label).includes("codigo drusila"));
    const codigoNuevoField=formFields.find(f=>cleanKey(f.label).includes("codigo nuevo"));
    const codigoDrusila=String(newEquipo[codigoDrusilaField?.key]||"").trim();
    const codigoNuevo=String(newEquipo[codigoNuevoField?.key]||"").trim();
    if(!codigoDrusila&&!codigoNuevo){
      setAddMsg({type:"error",text:"Completá al menos Código Drusila o Código Nuevo."});
      return;
    }
    setSavingEquipo(true);
    setAddMsg({type:"info",text:"Guardando equipo en Google Sheets..."});
    try{
      const cleanRow={};
      formFields.forEach(f=>{
        const v=newEquipo[f.key];
        if(v!==undefined&&String(v).trim()!=="")cleanRow[f.key]=String(v).trim();
      });
      const res=await postAddListaEquipo(cleanRow);
      setAddMsg({type:"success",text:`Equipo guardado en la fila ${res.rowNumber||"nueva"}.`});
      setNewEquipo({});
      if(onReloadLista)await onReloadLista();
    }catch(err){
      setAddMsg({type:"error",text:err.message});
    }finally{
      setSavingEquipo(false);
    }
  },[formFields,newEquipo,onReloadLista]);

  const buildListaExcelUpdates=useCallback(()=>{
    const updates=[];
    const horasField=horasKey||formFields.find(f=>f.special==="horometro")?.key||"HORAS";
    const toNum=(v)=>{
      if(v===null||v===undefined||v==="")return NaN;
      const n=Number(String(v).replace(/\./g,"").replace(",",".").replace(/[^0-9.\-]/g,""));
      return Number.isFinite(n)?n:NaN;
    };
    dataWithKey.forEach(row=>{
      if(!row||!row._ropInfo||row._horometroValue==null)return;
      const codigoDrusila=drusilaKey?String(row[drusilaKey]||"").trim():"";
      const codigoNuevo=codigoNuevoKey?String(row[codigoNuevoKey]||"").trim():"";
      if(!codigoDrusila&&!codigoNuevo)return;
      const appNum=toNum(row._horometroValue);
      const excelNum=toNum(row[horasField]);
      if(!Number.isFinite(appNum))return;
      if(Number.isFinite(excelNum)&&Math.abs(appNum-excelNum)<0.0001)return;
      updates.push({
        originalKeys:{
          codigoDrusila,
          codigoNuevo,
          codigoPrincipal:mainMachineCode(codigoDrusila||codigoNuevo),
          codigoDrusilaNorm:normalizeMachineCode(codigoDrusila),
          codigoNuevoNorm:normalizeMachineCode(codigoNuevo),
          lookupKeys:machineLookupVariants(codigoDrusila,codigoNuevo),
          codigoDrusilaHeader:drusilaKey||"",
          codigoNuevoHeader:codigoNuevoKey||"",
          useRowNumber:false,
        },
        row:{[horasField]:String(Math.round(appNum*100)/100)}
      });
    });
    return updates;
  },[dataWithKey,drusilaKey,codigoNuevoKey,horasKey,formFields]);

  const actualizarListaEnExcel=useCallback(async()=>{
    const updates=buildListaExcelUpdates();
    if(!updates.length){
      setSyncMsg({type:"success",text:"No hay diferencias para actualizar. Los horómetros ya coinciden con la app."});
      return;
    }
    const ok=await appConfirm(`Se actualizarán ${updates.length} horómetros en la planilla base Lista Maestra de Equipos. ¿Continuar?`);
    if(!ok)return;
    setSyncingListaExcel(true);
    setSyncMsg({type:"info",text:`Actualizando ${updates.length} equipos en Google Sheets...`});
    try{
      const res=await postBulkUpdateListaEquipos(updates);
      const updated=res.updatedRows??res.updated??updates.length;
      const skipped=res.skippedRows??0;
      const failed=res.failedRows??0;
      setSyncMsg({type:failed?"error":"success",text:failed?`Se actualizaron ${updated}, fallaron ${failed} y se omitieron ${skipped}. Revisá permisos o códigos no encontrados.`:`${updated} equipos actualizados en Excel${skipped?` (${skipped} omitidos)`:""}.`});
      if(onReloadLista)await onReloadLista();
    }catch(err){
      setSyncMsg({type:"error",text:err.message||"No se pudo actualizar la Lista Maestra."});
    }finally{
      setSyncingListaExcel(false);
    }
  },[buildListaExcelUpdates,onReloadLista]);

  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
        <StatCard icon="equip" label="Equipos en lista" value={fmtNum(data.length)} sub="Registros cargados desde Google Sheets" color={C.teal} small/>
        <StatCard icon="filter" label="Resultado filtrado" value={fmtNum(filtered.length)} sub={search||hayFiltros||soloActivos?"Según búsqueda / filtros":"Sin filtros aplicados"} color={C.blue} small/>
        <StatCard icon="check" label="Activos (últimos 7 días)" value={fmtNum(dataWithKey.filter(r=>activeMachinesSet.has(r._maquinaKey)).length)} sub="Con registro en ROP02 últimos 7 días" color={C.green} small/>
        <StatCard icon="hours" label="Con horómetro ROP02" value={fmtNum(filtered.filter(r=>r._ropInfo).length)} sub={fechaHorometro?`Del día o último disponible`:"Último disponible"} color={C.accent} small/>
        <StatCard icon="warn" label={fechaHorometro?"Usan último ROP02":"Valor fijo (HORAS)"} value={fmtNum(fechaHorometro?filtered.filter(r=>r._ropInfo?.modo==="fallback_ultimo"||r._ropInfo?.modo==="fallback_historico").length:filtered.filter(r=>!r._ropInfo&&r._horometroValue!=null).length)} sub={fechaHorometro?"No tenían ROP02 ese día":"Sin registros en ROP02"} color={C.red} small/>
      </div>
      <div style={{display:"flex",gap:14,flexWrap:"wrap",fontSize:11,color:C.textSub,background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 14px",alignItems:"center"}}>
        <span><Badge color={C.green}>●</Badge> {fechaHorometro?`Horómetro ROP02 del ${fmtFecha(fechaHorometro)}`:"Último horómetro ROP02"}</span>
        {fechaHorometro&&<span><Badge color={C.yellow}>●</Badge> Sin registro ese día: muestra el último horómetro final disponible</span>}
        <span><Badge color={C.red}>●</Badge> Sin ROP02 histórico: horómetro fijo de planilla</span>
        {soloActivos&&<span style={{color:C.green,fontWeight:700}}><Badge color={C.green}>✔</Badge> Filtro activo: mostrando solo equipos con registro ROP02 en los últimos 7 días</span>}
      </div>
      <Card title="Lista Maestra de Equipos" action={
        <div style={{display:"flex",flexDirection:"column",gap:8,alignItems:"stretch",width:"min(100%,1380px)",maxWidth:"100%"}}>
          <div style={{display:"flex",gap:8,alignItems:"center",justifyContent:"flex-end",flexWrap:"wrap",maxWidth:"100%"}}>
            <button onClick={()=>setListaTab("maestra")} style={{background:listaTab==="maestra"?C.accentDim:C.surface,border:`1px solid ${listaTab==="maestra"?C.accent+"55":C.border}`,borderRadius:7,color:listaTab==="maestra"?C.accent:C.textSub,padding:"7px 11px",fontSize:12,fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
              Lista maestra
            </button>
            <button onClick={()=>setListaTab("sinInfo")} style={{background:listaTab==="sinInfo"?C.redDim:C.surface,border:`1px solid ${listaTab==="sinInfo"?C.red+"55":C.border}`,borderRadius:7,color:listaTab==="sinInfo"?C.red:C.textSub,padding:"7px 11px",fontSize:12,fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
              Equipos sin información {equiposSinInfo.length?`(${equiposSinInfo.length})`:""}
            </button>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar equipo, tipo, marca, proyecto..." style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,padding:"8px 10px",fontSize:12,minWidth:230,width:320,outline:"none",flex:"1 1 260px",maxWidth:420}}/>
            <button onClick={()=>setFiltersOpen(o=>!o)} style={{background:filtersOpen?C.accentDim:C.surface,border:`1px solid ${filtersOpen?C.accent+"55":C.border}`,borderRadius:7,color:filtersOpen?C.accent:C.textSub,padding:"7px 11px",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
              <Icon name="filter" size={13} color={filtersOpen?C.accent:C.textSub}/>Filtros{hayFiltros?` (${filterKeysOnly.filter(k=>!multiIsAll(fVals[k])).length})`:""}
            </button>
            {hayFiltros&&<button onClick={fReset} style={{background:C.redDim,border:`1px solid ${C.red}44`,borderRadius:7,color:C.red,padding:"7px 11px",fontSize:12,fontWeight:600,cursor:"pointer",flexShrink:0}}>Limpiar filtros</button>}
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",justifyContent:"flex-end",flexWrap:"wrap",maxWidth:"100%"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,background:C.surface,border:`1px solid ${fechaHorometro?C.accent+"55":C.border}`,borderRadius:8,padding:"5px 8px",flexShrink:0}}> 
              <span style={{fontSize:10,color:C.textMuted,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Horómetro día</span>
              <input type="date" value={fechaHorometro} onChange={e=>setFechaHorometro(e.target.value)} style={{background:"transparent",border:"none",color:C.text,fontSize:12,outline:"none",fontFamily:"Inter"}}/>
              {fechaHorometro&&<button onClick={()=>setFechaHorometro("")} title="Sin día: mostrar último horómetro" style={{background:C.redDim,border:`1px solid ${C.red}44`,borderRadius:6,color:C.red,padding:"3px 7px",fontSize:11,fontWeight:700,cursor:"pointer"}}>×</button>}
            </div>
            <button onClick={()=>setSoloActivos(v=>!v)} title="Equipos con al menos 1 registro en ROP02 en los últimos 7 días" style={{background:soloActivos?C.greenDim:C.surface,border:`1px solid ${soloActivos?C.green+"66":C.border}`,borderRadius:7,color:soloActivos?C.green:C.textSub,padding:"7px 11px",fontSize:12,fontWeight:soloActivos?800:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6,transition:"all .15s",flexShrink:0}}>
              <span style={{fontSize:13}}>{soloActivos?"✔":"○"}</span> Activos (7 días)
            </button>
            <button onClick={()=>{setAddOpen(o=>!o);setAddMsg(null);if(editOpen)setEditOpen(false);}} style={{background:addOpen?C.accentDim:C.tealDim,border:`1px solid ${addOpen?C.accent+"55":C.teal+"44"}`,borderRadius:7,color:addOpen?C.accent:C.teal,padding:"7px 11px",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
              + Cargar nuevo equipo
            </button>
            <button onClick={()=>{setEditOpen(o=>!o);setEditMsg(null);if(addOpen)setAddOpen(false);}} style={{background:editOpen?C.accentDim:C.yellowDim,border:`1px solid ${editOpen?C.accent+"55":C.yellow+"44"}`,borderRadius:7,color:editOpen?C.accent:C.yellow,padding:"7px 11px",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
              ✎ Modificar equipos
            </button>
            <button onClick={actualizarListaEnExcel} disabled={syncingListaExcel} title="Actualiza en Excel los horómetros que la app toma desde ROP02 y que estén distintos a la Lista Maestra" style={{background:C.blueDim,border:`1px solid ${C.blue}55`,borderRadius:7,color:C.blue,padding:"7px 11px",fontSize:12,fontWeight:800,cursor:syncingListaExcel?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:6,flexShrink:0,opacity:syncingListaExcel?0.65:1}}>
              {syncingListaExcel?<Spinner size={13}/>:<Icon name="refresh" size={13} color={C.blue}/>} Actualizar en Excel
            </button>
            <button onClick={()=>generarExcelListaMaestra(filtered,cols,new Date().toISOString().slice(0,10).replace(/-/g,""))} style={{background:C.greenDim,border:`1px solid ${C.green}44`,borderRadius:7,color:C.green,padding:"7px 11px",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
              ⬇ Generar reporte
            </button>
          </div>
        </div>
      }>
        {syncMsg&&(
          <div style={{margin:"0 0 14px",padding:"10px 13px",borderRadius:8,fontSize:12,fontWeight:600,
            color:syncMsg.type==="error"?C.red:syncMsg.type==="success"?C.green:C.blue,
            background:syncMsg.type==="error"?C.redDim:syncMsg.type==="success"?C.greenDim:C.blueDim,
            border:`1px solid ${syncMsg.type==="error"?C.red:syncMsg.type==="success"?C.green:C.blue}55`}}>
            {syncMsg.text}
          </div>
        )}
        {editOpen&&(
          <div style={{margin:"0 0 14px",padding:"18px 18px 14px",background:C.surface,border:`1px solid ${C.yellow}44`,borderRadius:10,boxShadow:"0 2px 12px rgba(0,0,0,.2)"}}>
            {/* ── Header ── */}
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,marginBottom:14}}>
              <div>
                <div style={{fontSize:14,fontWeight:800,color:C.text,letterSpacing:".01em"}}>Modificar equipos</div>
                <div style={{fontSize:11,color:C.textMuted,marginTop:3,lineHeight:1.5}}>Seleccioná un equipo, editá cualquier celda y guardá. La modificación se actualiza en la planilla base Lista Maestra de Equipos.</div>
              </div>
              <button onClick={()=>{setEditOpen(false);limpiarEdicionEquipo();}} disabled={savingEdit}
                style={{background:C.redDim,border:`1px solid ${C.red}44`,borderRadius:7,color:C.red,padding:"6px 13px",fontSize:12,fontWeight:700,cursor:savingEdit?"not-allowed":"pointer",whiteSpace:"nowrap",flexShrink:0}}>
                Cerrar
              </button>
            </div>
            {/* ── Mensaje de estado ── */}
            {editMsg&&(
              <div style={{marginBottom:13,padding:"10px 13px",borderRadius:8,fontSize:12,fontWeight:500,
                color:editMsg.type==="error"?C.red:editMsg.type==="success"?C.green:C.blue,
                background:editMsg.type==="error"?C.redDim:editMsg.type==="success"?C.greenDim:C.blueDim,
                border:`1px solid ${editMsg.type==="error"?C.red:editMsg.type==="success"?C.green:C.blue}55`}}>
                {editMsg.text}
              </div>
            )}
            {/* ── Selector de equipo ── */}
            <div style={{display:"grid",gridTemplateColumns:"minmax(240px,400px) 1fr",gap:12,alignItems:"end",marginBottom:14}}>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                <label style={{fontSize:10,color:C.textMuted,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em"}}>Equipo a modificar</label>
                <select value={editSelected} onChange={e=>seleccionarEquipoEditar(e.target.value)}
                  style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,padding:"8px 10px",fontSize:12,outline:"none",cursor:"pointer"}}>
                  <option value="">Seleccionar equipo...</option>
                  {equipoEditOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div style={{fontSize:11,color:C.textMuted,lineHeight:1.5}}>
                Identificación usada para guardar: <b style={{color:C.text}}>Código Drusila</b> principal y variantes normalizadas. Podés modificar el resto de las columnas y también esos códigos, siempre que no queden duplicados.
              </div>
            </div>
            {/* ── Campos ── */}
            {editSelected!==""&&(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10,marginBottom:2}}>
                {formFields.map(f=>(
                  <div key={"edit_"+f.key+f.label} style={{display:"flex",flexDirection:"column",gap:4}}>
                    <label style={{fontSize:10,color:C.textMuted,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>
                      {f.label}{f.special==="horometro"&&<span style={{color:C.yellow,fontWeight:800}}> → HORAS</span>}
                    </label>
                    <ListaEquipoFieldInput field={f} value={editEquipo[f.key]||""} onChange={v=>setEditEquipoValue(f.key,v)}/>
                  </div>
                ))}
              </div>
            )}
            {/* ── Acciones ── */}
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
              <button onClick={limpiarEdicionEquipo} disabled={savingEdit}
                style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,color:C.textSub,padding:"8px 14px",fontSize:12,fontWeight:700,cursor:savingEdit?"not-allowed":"pointer"}}>
                Limpiar
              </button>
              <button onClick={guardarEdicionEquipo} disabled={savingEdit||editSelected===""}
                style={{background:C.yellowDim,border:`1px solid ${C.yellow}66`,borderRadius:7,color:C.yellow,padding:"8px 16px",fontSize:12,fontWeight:800,
                  cursor:(savingEdit||editSelected==="")?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:7,
                  opacity:(savingEdit||editSelected==="")?0.55:1,transition:"opacity .15s"}}>
                {savingEdit?<Spinner size={13}/>:<Icon name="check" size={13} color={C.yellow}/>}
                {savingEdit?"Guardando...":"Guardar cambios"}
              </button>
            </div>
          </div>
        )}
        {addOpen&&(
          <div style={{margin:"0 0 14px",padding:14,background:C.surface,border:`1px solid ${C.teal}33`,borderRadius:10}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:12}}>
              <div>
                <div style={{fontSize:13,fontWeight:800,color:C.text}}>Nuevo equipo</div>
                <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>Completá las celdas y guardá. El registro se agrega en la planilla base Lista Maestra de Equipos.</div>
              </div>
              <button onClick={()=>{setAddOpen(false);limpiarNuevoEquipo();}} disabled={savingEquipo} style={{background:C.redDim,border:`1px solid ${C.red}44`,borderRadius:7,color:C.red,padding:"6px 10px",fontSize:12,fontWeight:700,cursor:savingEquipo?"not-allowed":"pointer"}}>Cerrar</button>
            </div>
            {addMsg&&<div style={{marginBottom:12,padding:"9px 11px",borderRadius:8,fontSize:12,color:addMsg.type==="error"?C.red:addMsg.type==="success"?C.green:C.blue,background:(addMsg.type==="error"?C.redDim:addMsg.type==="success"?C.greenDim:C.blueDim),border:`1px solid ${(addMsg.type==="error"?C.red:addMsg.type==="success"?C.green:C.blue)}44`}}>{addMsg.text}</div>}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:10}}>
              {formFields.map(f=>(
                <div key={f.key+f.label} style={{display:"flex",flexDirection:"column",gap:4}}>
                  <label style={{fontSize:10,color:C.textMuted,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>{f.label}{f.special==="horometro"&&<span style={{color:C.yellow}}> → HORAS</span>}</label>
                  <ListaEquipoFieldInput field={f} value={newEquipo[f.key]||""} onChange={v=>setNewEquipoValue(f.key,v)} placeholder={f.special==="horometro"?"Valor inicial si no hay ROP02":""}/>
                </div>
              ))}
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:14}}>
              <button onClick={limpiarNuevoEquipo} disabled={savingEquipo} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,color:C.textSub,padding:"8px 12px",fontSize:12,fontWeight:700,cursor:savingEquipo?"not-allowed":"pointer"}}>Limpiar</button>
              <button onClick={guardarNuevoEquipo} disabled={savingEquipo} style={{background:C.tealDim,border:`1px solid ${C.teal}55`,borderRadius:7,color:C.teal,padding:"8px 12px",fontSize:12,fontWeight:800,cursor:savingEquipo?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:7}}>
                {savingEquipo?<Spinner size={13}/>:<Icon name="check" size={13} color={C.teal}/>}
                {savingEquipo?"Guardando...":"Guardar en planilla"}
              </button>
            </div>
          </div>
        )}
        {listaTab==="sinInfo"?(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,background:C.surface,border:`1px solid ${C.red}33`,borderRadius:10,padding:"12px 14px"}}>
              <div>
                <div style={{fontSize:13,fontWeight:900,color:C.text}}>Equipos sin información</div>
                <div style={{fontSize:11,color:C.textMuted,marginTop:3,lineHeight:1.5}}>
                  Se cruzan solamente códigos de equipos que aparecen desde mayo de 2026 en adelante en ROP02, ROP05 y RMA15 contra <b>Código Drusila</b> y <b>Código Nuevo</b> de la Lista Maestra. Se excluyen textos operativos como PREDIO-DELTA, REORGANIZACION, REPARACION, MANTENIMIENTO, BANDEJA-MARTILLO, TALLER y códigos numéricos sueltos. También se muestran equipos que existen en la lista pero tienen datos incompletos.
                </div>
              </div>
              <button onClick={descargarEquiposSinInfo} disabled={!equiposSinInfo.length} style={{background:C.greenDim,border:`1px solid ${C.green}44`,borderRadius:7,color:C.green,padding:"8px 12px",fontSize:12,fontWeight:800,cursor:equiposSinInfo.length?"pointer":"not-allowed",opacity:equiposSinInfo.length?1:.55,flexShrink:0}}>
                ⬇ Descargar Excel
              </button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}>
              <StatCard icon="warn" label="Pendientes" value={fmtNum(equiposSinInfo.length)} sub="Sin lista o datos incompletos" color={C.red} small/>
              <StatCard icon="equip" label="No están en lista" value={fmtNum(equiposSinInfo.filter(r=>String(r.motivo).includes("No está")).length)} sub="Aparecen en planillas" color={C.yellow} small/>
              <StatCard icon="filter" label="Con datos incompletos" value={fmtNum(equiposSinInfo.filter(r=>!String(r.motivo).includes("No está")).length)} sub="Propiedad / costo / tarifa" color={C.blue} small/>
            </div>
            <Table cols={equiposSinInfoCols} rows={equiposSinInfo} maxH={620} emptyMsg="No hay equipos sin información" stickyFirst disableTooltip/>
          </div>
        ):(
          <>
            {filtersOpen&&(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:10,padding:"4px 0 14px"}}>
                {filterFields.map(f=>(
                  <MultiSel key={f.key} label={f.label} value={fVals[f.key]} onChange={v=>fSet(f.key,v)}
                    options={[{value:"todos",label:"Todos"},...(fOpts[f.key]||[]).map(v=>({value:v,label:v}))]}/>
                ))}
              </div>
            )}
            <Table cols={cols} rows={filtered} maxH={620} emptyMsg="Sin equipos para mostrar" stickyFirst disableTooltip/>
          </>
        )}
      </Card>
    </div>
  );
}

// ─── ViewDashboard ────────────────────────────────────────────────────────────
// ─── Dashboard ROP05 ──────────────────────────────────────────────────────────
function DashboardROP05({rop05,dashSt,setDashSt}){
  const modeD=dashSt?.modeD05??"todo";
  const fechaD=dashSt?.fechaD05??"";
  const fechaDD=dashSt?.fechaDD05??"";
  const fechaDH=dashSt?.fechaDH05??"";
  const proyecto=dashSt?.proyecto05??"todos";
  const setModeD=v=>setDashSt(s=>({...s,modeD05:v}));
  const setFechaD=v=>setDashSt(s=>({...s,fechaD05:v}));
  const setFechaDD=v=>setDashSt(s=>({...s,fechaDD05:v}));
  const setFechaDH=v=>setDashSt(s=>({...s,fechaDH05:v}));
  const setProyecto=v=>setDashSt(s=>({...s,proyecto05:v}));

  const proyectos=useMemo(()=>uniq(rop05.map(r=>r.proyecto).filter(Boolean)),[rop05]);

  const filtered=useMemo(()=>rop05.filter(r=>{
    if(!matchMulti(r.proyecto,proyecto,"todos"))return false;
    if(modeD==="dia"&&fechaD&&r.fecha!==fechaD)return false;
    if(modeD==="periodo"){if(fechaDD&&r.fecha<fechaDD)return false;if(fechaDH&&r.fecha>fechaDH)return false;}
    return true;
  }),[rop05,proyecto,modeD,fechaD,fechaDD,fechaDH]);

  const totalHoras=useMemo(()=>filtered.reduce((s,r)=>s+r.horas,0),[filtered]);
  const totalEquipos=useMemo(()=>uniq(filtered.map(r=>r.maquina)).length,[filtered]);
  const diasOp=useMemo(()=>uniq(filtered.map(r=>r.fecha)).length,[filtered]);

  const topTareas=useMemo(()=>{
    const m={};
    filtered.filter(r=>r.tarea).forEach(r=>{m[r.tarea]=(m[r.tarea]||0)+1;});
    const total=Object.values(m).reduce((s,v)=>s+v,0);
    return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,10)
      .map(([name,count])=>({name:name.length>36?name.slice(0,34)+"…":name,count,pct:total>0?Math.round(count/total*100):0}));
  },[filtered]);

  const topEquipos=useMemo(()=>{
    const m={};
    filtered.forEach(r=>{if(!m[r.maquina])m[r.maquina]={horas:0,tipo:r._tipo};m[r.maquina].horas+=r.horas;});
    return Object.entries(m).sort((a,b)=>b[1].horas-a[1].horas).slice(0,10).map(([name,d])=>({name,horas:Math.round(d.horas*10)/10,tipo:d.tipo}));
  },[filtered]);

  const totalTareas=useMemo(()=>{const m={};filtered.forEach(r=>{if(r.tarea)m[r.tarea]=1;});return Object.keys(m).length;},[filtered]);

  const prodPorUnidad=useMemo(()=>{
    const m={};
    filtered.forEach(r=>{if(r.unidad){m[r.unidad]=(m[r.unidad]||0)+r.cantidad;}});
    return Object.entries(m).sort((a,b)=>b[1]-a[1]).map(([name,value])=>({name,value:Math.round(value)}));
  },[filtered]);

  const prodPorProy=useMemo(()=>{
    const m={};
    filtered.forEach(r=>{const p=r.proyecto||"S/D";m[p]=(m[p]||0)+r.horas;});
    return Object.entries(m).map(([name,value])=>({name,value}));
  },[filtered]);

  const hayFiltros=modeD!=="todo"||!multiIsAll(proyecto,"todos");
  const reset=()=>{setModeD("todo");setFechaD("");setFechaDD("");setFechaDH("");setProyecto("todos");};

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <Card>
        <div style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          <Icon name="filter" size={14} color={C.textSub}/>
          <div style={{display:"flex",gap:7}}>
            <TabBtn active={modeD==="todo"} onClick={()=>setModeD("todo")}>Todo</TabBtn>
            <TabBtn active={modeD==="dia"} onClick={()=>setModeD("dia")}>Por día</TabBtn>
            <TabBtn active={modeD==="periodo"} onClick={()=>setModeD("periodo")}>Por período</TabBtn>
          </div>
          {modeD==="dia"&&<DateIn label="Fecha" value={fechaD} onChange={setFechaD}/>}
          {modeD==="periodo"&&<><PeriodMonthYear fechaD={fechaDD} fechaH={fechaDH} setFechaD={setFechaDD} setFechaH={setFechaDH}/><DateIn label="Desde" value={fechaDD} onChange={setFechaDD} max={fechaDH||undefined}/><DateIn label="Hasta" value={fechaDH} onChange={setFechaDH} min={fechaDD||undefined} warn={fechaDH&&fechaDD&&fechaDH<fechaDD?"≥ Desde":null}/></>}
          <MultiSel label="Proyecto" value={proyecto} onChange={setProyecto} options={[{value:"todos",label:"Todos"},...proyectos.map(p=>({value:p,label:p}))]}/>
          <button onClick={reset} style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,border:`1px solid ${C.red}44`,background:C.redDim,color:C.red,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"Inter",opacity:hayFiltros?1:0.3,pointerEvents:hayFiltros?"auto":"none"}}><Icon name="close" size={11} color={C.red}/>Limpiar</button>
        </div>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:12}}>
        <StatCard icon="prod" label="Registros" value={filtered.length} color={C.teal}/>
        <StatCard icon="hours" label="Horas Productivas" value={fmtNum(totalHoras)} color={C.yellow}/>
        <StatCard icon="equip" label="Equipos" value={totalEquipos} color={C.purple}/>
        <StatCard icon="consist" label="Días con Registro" value={diasOp} color={C.blue}/>
        <StatCard icon="prod" label="Tareas distintas" value={totalTareas} color={C.green}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Card title="Top 10 Equipos — Horas productivas">
          <div style={{padding:"12px 6px"}}>
            <ResponsiveContainer width="100%" height={Math.max(200,topEquipos.length*34+40)}>
              <BarChart data={topEquipos} layout="vertical" margin={{left:8,right:16}}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false}/>
                <XAxis type="number" tick={{fill:C.textMuted,fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis type="category" dataKey="name" tick={{fill:C.textSub,fontSize:10}} width={84} axisLine={false} tickLine={false}/>
                <Tooltip content={<ChartTip/>}/>
                <Bar dataKey="horas" fill={C.teal} radius={[0,4,4,0]} barSize={20}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <Card title="Top 10 Tareas más realizadas">
            <div style={{padding:"8px 12px 12px",display:"flex",flexDirection:"column",gap:7}}>
              {topTareas.map((t,i)=>(
                <div key={i} style={{display:"flex",flexDirection:"column",gap:3}}>
                  <div style={{display:"flex",alignItems:"center",gap:7}}>
                    <span style={{fontSize:11,fontWeight:800,color:C.teal,width:16,textAlign:"right",flexShrink:0,fontFamily:"Inter"}}>{i+1}</span>
                    <span style={{fontSize:11,color:C.text,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</span>
                    <span style={{fontSize:11,fontWeight:700,color:C.teal,flexShrink:0,minWidth:36,textAlign:"right"}}>{t.pct}%</span>
                  </div>
                  <div style={{marginLeft:23,background:C.border,borderRadius:3,height:4,overflow:"hidden"}}>
                    <div style={{width:`${t.pct}%`,height:"100%",background:C.teal,borderRadius:3,transition:"width .4s ease"}}/>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Producción por unidad">
            <div style={{padding:"10px 14px 12px",display:"flex",flexDirection:"column",gap:8}}>
              {prodPorUnidad.slice(0,5).map((u,i)=>{
                const max=prodPorUnidad[0]?.value||1;
                return(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:10,fontWeight:600,color:C.textSub,width:80,flexShrink:0}}>{u.name}</span>
                    <div style={{flex:1,background:C.border,borderRadius:3,height:6,overflow:"hidden"}}>
                      <div style={{width:`${(u.value/max)*100}%`,height:"100%",background:C.teal,borderRadius:3}}/>
                    </div>
                    <span style={{fontSize:11,fontWeight:700,color:C.teal,flexShrink:0,minWidth:60,textAlign:"right"}}>{fmtNum(u.value)}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      <Card title="Producción por proyecto">
        <div style={{padding:"10px 14px 12px",display:"flex",alignItems:"center",gap:16}}>
          <ResponsiveContainer width={120} height={120}>
            <PieChart>
              <Pie data={prodPorProy} cx="50%" cy="50%" outerRadius={52} innerRadius={30} dataKey="value" labelLine={false} label={false}>
                {prodPorProy.map((entry,i)=><Cell key={i} fill={entry.name==="FILO DEL SOL"?"#e8001d":entry.name==="JOSE MARIA"?"#f0f0f0":"#ffaa00"}/>)}
              </Pie>
              <Tooltip content={<ChartTip/>}/>
            </PieChart>
          </ResponsiveContainer>
          <div style={{flex:1,display:"flex",flexDirection:"column",gap:8}}>
            {(()=>{const total=prodPorProy.reduce((s,r)=>s+r.value,0);return prodPorProy.map((entry,i)=>{const col=entry.name==="FILO DEL SOL"?"#e8001d":entry.name==="JOSE MARIA"?"#f0f0f0":"#ffaa00";const pct=total>0?Math.round(entry.value/total*100):0;return(<div key={i} style={{display:"flex",flexDirection:"column",gap:3}}><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:11,fontWeight:600,color:col}}>{entry.name}</span><span style={{fontSize:14,fontWeight:800,color:col,fontFamily:"Inter"}}>{pct}%</span></div><div style={{background:C.border,borderRadius:3,height:5,overflow:"hidden"}}><div style={{width:pct+"%",height:"100%",background:col,borderRadius:3}}/></div><span style={{fontSize:10,color:C.textMuted}}>{fmtNum(entry.value)} hs</span></div>);})})()}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Dashboard RMA15 ──────────────────────────────────────────────────────────
function DashboardRMA15({rma15,dashSt,setDashSt}){
  const modeD=dashSt?.modeD15??"todo";
  const fechaD=dashSt?.fechaD15??"";
  const fechaDD=dashSt?.fechaDD15??"";
  const fechaDH=dashSt?.fechaDH15??"";
  const proyecto=dashSt?.proyecto15??"todos";
  const setModeD=v=>setDashSt(s=>({...s,modeD15:v}));
  const setFechaD=v=>setDashSt(s=>({...s,fechaD15:v}));
  const setFechaDD=v=>setDashSt(s=>({...s,fechaDD15:v}));
  const setFechaDH=v=>setDashSt(s=>({...s,fechaDH15:v}));
  const setProyecto=v=>setDashSt(s=>({...s,proyecto15:v}));

  const proyectos=useMemo(()=>uniq((rma15||[]).map(r=>r.proyecto).filter(Boolean)),[rma15]);

  const filtered=useMemo(()=>(rma15||[]).filter(r=>{
    if(!matchMulti(r.proyecto,proyecto,"todos"))return false;
    if(modeD==="dia"&&fechaD&&r.fecha!==fechaD)return false;
    if(modeD==="periodo"){if(fechaDD&&r.fecha<fechaDD)return false;if(fechaDH&&r.fecha>fechaDH)return false;}
    return true;
  }),[rma15,proyecto,modeD,fechaD,fechaDD,fechaDH]);

  const totalOTs=filtered.length;
  const preventivos=filtered.filter(r=>r.tipoMant?.toUpperCase().includes("PREV")).length;
  const correctivos=filtered.filter(r=>r.tipoMant?.toUpperCase().includes("CORR")).length;
  const noOperativos=filtered.filter(r=>!r.operativo).length;
  const costoTotal=filtered.reduce((s,r)=>s+r.costoTotal,0);
  const equiposAfect=useMemo(()=>uniq(filtered.map(r=>r.maquina)).length,[filtered]);

  const otsPorTipo=useMemo(()=>[
    {name:"Preventivo",value:preventivos,fill:C.green},
    {name:"Correctivo",value:correctivos,fill:C.red},
  ].filter(x=>x.value>0),[preventivos,correctivos]);

  const topEquipos=useMemo(()=>{
    const m={};
    filtered.forEach(r=>{if(!m[r.maquina])m[r.maquina]={ots:0,costo:0};m[r.maquina].ots++;m[r.maquina].costo+=r.costoTotal;});
    return Object.entries(m).sort((a,b)=>b[1].costo-a[1].costo).slice(0,10).map(([name,d])=>({name,ots:d.ots,costo:Math.round(d.costo)}));
  },[filtered]);

  const topInsumos=useMemo(()=>{
    const m={};
    filtered.forEach(r=>(r.insumos||[]).forEach(ins=>{if(!ins.codigo)return;const k=ins.codigo+" — "+(ins.nombre||"");if(!m[k])m[k]={qty:0,costo:0};m[k].qty+=ins.cantidad;m[k].costo+=ins.costoTotal||0;}));
    return Object.entries(m).sort((a,b)=>b[1].costo-a[1].costo).slice(0,8).map(([name,d])=>({name,qty:Math.round(d.qty),costo:Math.round(d.costo)}));
  },[filtered]);

  const costosPorMes=useMemo(()=>{
    const m={};
    filtered.forEach(r=>{if(!r.fecha)return;const mes=r.fecha.slice(0,7);if(!m[mes])m[mes]={prev:0,corr:0};if(r.tipoMant?.toUpperCase().includes("PREV"))m[mes].prev+=r.costoTotal;else m[mes].corr+=r.costoTotal;});
    return Object.entries(m).sort((a,b)=>a[0].localeCompare(b[0])).map(([mes,d])=>({mes,prev:Math.round(d.prev),corr:Math.round(d.corr)}));
  },[filtered]);

  const hayFiltros=modeD!=="todo"||!multiIsAll(proyecto,"todos");
  const reset=()=>{setModeD("todo");setFechaD("");setFechaDD("");setFechaDH("");setProyecto("todos");};

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <Card>
        <div style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          <Icon name="filter" size={14} color={C.textSub}/>
          <div style={{display:"flex",gap:7}}>
            <TabBtn active={modeD==="todo"} onClick={()=>setModeD("todo")}>Todo</TabBtn>
            <TabBtn active={modeD==="dia"} onClick={()=>setModeD("dia")}>Por día</TabBtn>
            <TabBtn active={modeD==="periodo"} onClick={()=>setModeD("periodo")}>Por período</TabBtn>
          </div>
          {modeD==="dia"&&<DateIn label="Fecha" value={fechaD} onChange={setFechaD}/>}
          {modeD==="periodo"&&<><PeriodMonthYear fechaD={fechaDD} fechaH={fechaDH} setFechaD={setFechaDD} setFechaH={setFechaDH}/><DateIn label="Desde" value={fechaDD} onChange={setFechaDD} max={fechaDH||undefined}/><DateIn label="Hasta" value={fechaDH} onChange={setFechaDH} min={fechaDD||undefined} warn={fechaDH&&fechaDD&&fechaDH<fechaDD?"≥ Desde":null}/></>}
          <MultiSel label="Proyecto" value={proyecto} onChange={setProyecto} options={[{value:"todos",label:"Todos"},...proyectos.map(p=>({value:p,label:p}))]}/>
          <button onClick={reset} style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,border:`1px solid ${C.red}44`,background:C.redDim,color:C.red,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"Inter",opacity:hayFiltros?1:0.3,pointerEvents:hayFiltros?"auto":"none"}}><Icon name="close" size={11} color={C.red}/>Limpiar</button>
        </div>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:12}}>
        <StatCard icon="parts" label="Total OTs" value={totalOTs} color={C.blue}/>
        <StatCard icon="check" label="Preventivos" value={preventivos} color={C.green}/>
        <StatCard icon="warn" label="Correctivos" value={correctivos} color={C.red}/>
        <StatCard icon="equip" label="Equipos afectados" value={equiposAfect} color={C.purple}/>
        <StatCard icon="warn" label="No operativos" value={noOperativos} color={C.yellow}/>
        <StatCard icon="prod" label="Costo total ARS" value={costoTotal>0?"$"+fmtNum(Math.round(costoTotal)):"—"} color={C.yellow}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Card title="Costo por equipo (Top 10)">
          <div style={{padding:"12px 6px"}}>
            <ResponsiveContainer width="100%" height={Math.max(200,topEquipos.length*34+40)}>
              <BarChart data={topEquipos} layout="vertical" margin={{left:8,right:16}}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false}/>
                <XAxis type="number" tick={{fill:C.textMuted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>"$"+fmtNum(v)}/>
                <YAxis type="category" dataKey="name" tick={{fill:C.textSub,fontSize:10}} width={84} axisLine={false} tickLine={false}/>
                <Tooltip content={<ChartTip/>}/>
                <Bar dataKey="costo" fill={C.purple} radius={[0,4,4,0]} barSize={20}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <Card title="OTs por tipo">
            <div style={{padding:"10px 14px 12px",display:"flex",alignItems:"center",gap:16}}>
              <ResponsiveContainer width={120} height={120}>
                <PieChart>
                  <Pie data={otsPorTipo} cx="50%" cy="50%" outerRadius={52} innerRadius={30} dataKey="value" labelLine={false} label={false}>
                    {otsPorTipo.map((entry,i)=><Cell key={i} fill={entry.fill}/>)}
                  </Pie>
                  <Tooltip content={<ChartTip/>}/>
                </PieChart>
              </ResponsiveContainer>
              <div style={{flex:1,display:"flex",flexDirection:"column",gap:8}}>
                {otsPorTipo.map((t,i)=>{const pct=totalOTs>0?Math.round(t.value/totalOTs*100):0;return(<div key={i} style={{display:"flex",flexDirection:"column",gap:3}}><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:11,fontWeight:600,color:t.fill}}>{t.name}</span><span style={{fontSize:14,fontWeight:800,color:t.fill,fontFamily:"Inter"}}>{pct}%</span></div><div style={{background:C.border,borderRadius:3,height:5,overflow:"hidden"}}><div style={{width:pct+"%",height:"100%",background:t.fill,borderRadius:3}}/></div><span style={{fontSize:10,color:C.textMuted}}>{t.value} OTs</span></div>);})}
              </div>
            </div>
          </Card>

          <Card title="Top insumos por costo">
            <div style={{padding:"8px 12px 12px",display:"flex",flexDirection:"column",gap:6}}>
              {topInsumos.slice(0,5).map((ins,i)=>{
                const max=topInsumos[0]?.costo||1;
                return(
                  <div key={i} style={{display:"flex",flexDirection:"column",gap:2}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                      <span style={{fontSize:10,color:C.text,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ins.name}</span>
                      <span style={{fontSize:11,fontWeight:700,color:C.yellow,flexShrink:0,marginLeft:8}}>${fmtNum(ins.costo)}</span>
                    </div>
                    <div style={{background:C.border,borderRadius:3,height:4,overflow:"hidden"}}>
                      <div style={{width:`${(ins.costo/max)*100}%`,height:"100%",background:C.yellow,borderRadius:3}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {costosPorMes.length>1&&(
        <Card title="Evolución de costos por mes">
          <div style={{padding:"12px 6px"}}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={costosPorMes} margin={{left:8,right:16}}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                <XAxis dataKey="mes" tick={{fill:C.textMuted,fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:C.textMuted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>"$"+fmtNum(v)}/>
                <Tooltip content={<ChartTip/>}/>
                <Bar dataKey="prev" name="Preventivo" fill={C.green} radius={[4,4,0,0]} stackId="a"/>
                <Bar dataKey="corr" name="Correctivo" fill={C.red} radius={[4,4,0,0]} stackId="a"/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}


function ViewDashboard({rop02All,rop05,rma15,control,dashSt,setDashSt}){
  const proyecto=dashSt?.proyecto??"todos";
  const modeD=dashSt?.modeD??"todo";
  const fechaD=dashSt?.fechaD??"";
  const fechaDD=dashSt?.fechaDD??"";
  const fechaDH=dashSt?.fechaDH??"";
  const setProyecto=v=>setDashSt(s=>({...s,proyecto:v}));
  const setModeD=v=>setDashSt(s=>({...s,modeD:v}));
  const setFechaD=v=>setDashSt(s=>({...s,fechaD:v}));
  const setFechaDD=v=>setDashSt(s=>({...s,fechaDD:v}));
  const setFechaDH=v=>setDashSt(s=>({...s,fechaDH:v}));

  // Proyectos disponibles
  const proyectos=useMemo(()=>uniq(rop02All.map(r=>r.proyecto)),[rop02All]);

  // Base filtrada por proyecto Y fecha
  const r02f=useMemo(()=>rop02All.filter(r=>{
    if(!matchMulti(r.proyecto,proyecto,"todos"))return false;
    if(modeD==="dia"&&fechaD&&r.fecha!==fechaD)return false;
    if(modeD==="periodo"){if(fechaDD&&r.fecha<fechaDD)return false;if(fechaDH&&r.fecha>fechaDH)return false;}
    return true;
  }),[rop02All,proyecto,modeD,fechaD,fechaDD,fechaDH]);
  const r05f=useMemo(()=>rop05.filter(r=>{
    if(!matchMulti(r.proyecto,proyecto,"todos"))return false;
    if(modeD==="dia"&&fechaD&&r.fecha!==fechaD)return false;
    if(modeD==="periodo"){if(fechaDD&&r.fecha<fechaDD)return false;if(fechaDH&&r.fecha>fechaDH)return false;}
    return true;
  }),[rop05,proyecto,modeD,fechaD,fechaDD,fechaDH]);

  // Excluye camionetas/camiones de TODOS los cálculos del dashboard
  const r02prod=useMemo(()=>r02f.filter(r=>!r._excluded),[r02f]);
  const totalHoras=useMemo(()=>r02prod.reduce((s,r)=>s+r.horas,0),[r02prod]);
  const totalComb=useMemo(()=>r02prod.reduce((s,r)=>s+r.combustible,0),[r02prod]);
  const totalProd=useMemo(()=>r05f.reduce((s,r)=>s+r.cantidad,0),[r05f]);
  const totalEquipos=useMemo(()=>uniq(r02prod.filter(r=>r.estado==="TRABAJO").map(r=>r.maquina)).length,[r02prod]);

  // Top 10 equipos con info enriquecida para tooltip
  const topEquipos=useMemo(()=>{
    const m={};
    r02prod.forEach(r=>{
      if(!m[r.maquina])m[r.maquina]={horas:0,proyectos:new Set(),tipo:r._tipo};
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
  const equiposFS=useMemo(()=>uniq(r02f.filter(r=>r.estado==="FS"&&!r._excluded).map(r=>r.maquina)).length,[r02f]);
  const diasOperativos=useMemo(()=>uniq(r02prod.filter(r=>r.estado==="TRABAJO").map(r=>r.fecha)).length,[r02prod]);
  const diasOD=useMemo(()=>uniq(r02f.filter(r=>r.estado==="OD"&&!r._excluded).map(r=>r.fecha)).length,[r02f]);
  const sem=semaforo(control.consistencia);

  // Tooltips custom
  const TooltipEquipo=({active,payload})=>{
    if(!active||!payload?.length)return null;
    const d=payload[0].payload;
    return(
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",fontSize:12,minWidth:180,boxShadow:"0 4px 20px rgba(0,0,0,.4)"}}>
        <div style={{fontFamily:"Inter",fontWeight:800,fontSize:14,color:C.accent,marginBottom:6}}>{d.name}</div>
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
        <div style={{fontFamily:"Inter",fontWeight:800,fontSize:14,color:C.purple,marginBottom:6}}>{d.fullName||d.name}</div>
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
      <WeatherSummary onOpen={()=>{sessionStorage.setItem("dm_home_requested_view","weather");window.dispatchEvent(new CustomEvent("dm-open-weather"));}}/>
      {/* Selector de dashboard */}
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <TabBtn active={dashSt?.dashTab!=="rop05"&&dashSt?.dashTab!=="rma15"} onClick={()=>setDashSt(s=>({...s,dashTab:"rop02"}))}>ROP02 — Partes Diarios</TabBtn>
        <TabBtn active={dashSt?.dashTab==="rop05"} onClick={()=>setDashSt(s=>({...s,dashTab:"rop05"}))}>ROP05 — Productividad</TabBtn>
        <TabBtn active={dashSt?.dashTab==="rma15"} onClick={()=>setDashSt(s=>({...s,dashTab:"rma15"}))}>RMA15 — Mantenimiento</TabBtn>
      </div>

      {(dashSt?.dashTab==="rop05")?(
        <DashboardROP05 rop05={rop05} dashSt={dashSt} setDashSt={setDashSt}/>
      ):(dashSt?.dashTab==="rma15")?(
        <DashboardRMA15 rma15={rma15} dashSt={dashSt} setDashSt={setDashSt}/>
      ):(
      <>
      {/* Filtros de proyecto + fecha */}
      <Card>
        <div style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          <Icon name="filter" size={14} color={C.textSub}/>
          <div style={{display:"flex",gap:7}}>
            <TabBtn active={modeD==="todo"} onClick={()=>setModeD("todo")}>Todo</TabBtn>
            <TabBtn active={modeD==="dia"} onClick={()=>setModeD("dia")}>Por día</TabBtn>
            <TabBtn active={modeD==="periodo"} onClick={()=>setModeD("periodo")}>Por período</TabBtn>
          </div>
          {modeD==="dia"&&<DateIn label="Fecha" value={fechaD} onChange={setFechaD}/>}
          {modeD==="periodo"&&<><PeriodMonthYear fechaD={fechaDD} fechaH={fechaDH} setFechaD={setFechaDD} setFechaH={setFechaDH}/><DateIn label="Desde" value={fechaDD} onChange={setFechaDD}/><DateIn label="Hasta" value={fechaDH} onChange={setFechaDH}/></>}
          <MultiSel label="Proyecto" value={proyecto} onChange={setProyecto} options={[{value:"todos",label:"Todos"},...proyectos.map(p=>({value:p,label:p}))]}/>
          <button onClick={()=>{setProyecto("todos");setModeD("todo");setFechaD("");setFechaDD("");setFechaDH("");}} style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,border:`1px solid ${C.red}44`,background:C.redDim,color:C.red,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"Inter",opacity:(!multiIsAll(proyecto,"todos")||modeD!=="todo"||fechaD||fechaDD||fechaDH)?1:0.3,pointerEvents:(!multiIsAll(proyecto,"todos")||modeD!=="todo"||fechaD||fechaDD||fechaDH)?"auto":"none"}}><Icon name="close" size={11} color={C.red}/>Limpiar filtros</button>
        </div>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:12}}>
        <StatCard icon="hours" label="Horas Totales" value={fmtNum(totalHoras)} sub="equipos productivos" color={C.yellow}/>
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
                    <span style={{fontSize:11,fontWeight:800,color:C.accent,width:16,textAlign:"right",flexShrink:0,fontFamily:"Inter"}}>{i+1}</span>
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
                {(()=>{const total=horasProy.reduce((s,r)=>s+r.value,0);return horasProy.map((entry,i)=>{const col=entry.name==="FILO DEL SOL"?"#e8001d":entry.name==="JOSE MARIA"?"#f0f0f0":"#ffaa00";const label=entry.name==="JOSE MARIA"?"JOSÉ MARÍA":entry.name;const pct=total>0?Math.round((entry.value/total)*100):0;return(<div key={i} style={{display:"flex",flexDirection:"column",gap:3}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}><span style={{fontSize:11,fontWeight:600,color:col}}>{label}</span><span style={{fontSize:14,fontWeight:800,color:col,fontFamily:"Inter"}}>{pct}%</span></div><div style={{background:C.border,borderRadius:3,height:5,overflow:"hidden"}}><div style={{width:pct+"%",height:"100%",background:col,borderRadius:3}}/></div><span style={{fontSize:10,color:C.textMuted}}>{fmtNum(entry.value)} hs</span></div>);});})()} 
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
                <div style={{fontFamily:"Inter",fontSize:22,fontWeight:800,color:C.green}}>{fmtNum(horasPromDia)}</div>
                <div style={{fontSize:10,color:C.textSub,marginTop:2}}>Hs prom./día</div>
              </div>
              <div style={{background:C.yellowDim,borderRadius:8,padding:"12px 10px",border:`1px solid ${C.yellow}33`,textAlign:"center"}}>
                <div style={{fontFamily:"Inter",fontSize:22,fontWeight:800,color:C.yellow}}>{diasOD}</div>
                <div style={{fontSize:10,color:C.textSub,marginTop:2}}>Días OD</div>
              </div>
              <div style={{background:C.redDim,borderRadius:8,padding:"12px 10px",border:`1px solid ${C.red}33`,textAlign:"center"}}>
                <div style={{fontFamily:"Inter",fontSize:22,fontWeight:800,color:C.red}}>{equiposFS}</div>
                <div style={{fontSize:10,color:C.textSub,marginTop:2}}>Equipos en FS</div>
              </div>
            </div>
            <div style={{borderTop:`1px solid ${C.border}`,paddingTop:10,display:"flex",flexDirection:"column",gap:6}}>
              <div style={{fontSize:10,color:C.textMuted,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase"}}>Equipos FS por máquina</div>
              {r02f.filter(r=>r.estado==="FS"&&!r._excluded).reduce((acc,r)=>{
                const ex=acc.find(a=>a.m===r.maquina);
                if(ex)ex.d=uniq([...ex.d,r.fecha]);else acc.push({m:r.maquina,d:[r.fecha]});
                return acc;
              },[]).sort((a,b)=>b.d.length-a.d.length).slice(0,5).map((e,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:10,fontWeight:700,color:C.red,fontFamily:"Inter",width:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flexShrink:0}}>{e.m}</span>
                  <div style={{flex:1,background:C.border,borderRadius:3,height:5}}>
                    <div style={{width:`${(e.d.length/Math.max(...r02f.filter(r=>r.estado==="FS"&&!r._excluded).reduce((acc,r)=>{const ex=acc.find(a=>a.m===r.maquina);if(ex)ex.d=uniq([...ex.d,r.fecha]);else acc.push({m:r.maquina,d:[r.fecha]});return acc;},[]).map(a=>a.d.length)))*100}%`,height:"100%",background:C.red,borderRadius:3}}/>
                  </div>
                  <span style={{fontSize:10,color:C.textMuted,flexShrink:0}}>{e.d.length}d</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
      </>
      )}
    </div>
  );
}

// ─── Hook: filtros facetados genérico ─────────────────────────────────────────
function useFacetedFilters(allRows, filterKeys, extState, setExtState){
  // Si se pasa extState, usarlo como fuente de verdad (persistencia entre pestañas)
  const fkKeys=useMemo(()=>filterKeys.map(f=>f.key).join(","),[filterKeys]);
  const fkDefaults=useMemo(()=>Object.fromEntries(filterKeys.map(f=>[f.key,f.defaultVal])),[filterKeys]);

  const defaultState=useMemo(()=>({mode:"dia",fecha:"",fechaD:"",fechaH:"",vals:fkDefaults}),[fkDefaults]);

  const[localState,setLocalState]=useState(defaultState);
  const state=useMemo(()=>({
    ...defaultState,
    ...(extState||localState||{}),
    vals:{...fkDefaults,...((extState||localState||{}).vals||{})}
  }),[extState,localState,defaultState,fkDefaults]);
  const setState=useCallback((updater)=>{
    if(setExtState)setExtState(updater);
    else setLocalState(updater);
  },[setExtState]);

  const mode=state.mode;
  const fecha=state.fecha;
  const fechaD=state.fechaD;
  const fechaH=state.fechaH;
  const vals=state.vals||fkDefaults;

  const ultimaFechaConRegistros=useMemo(()=>{
    const fechas=(allRows||[]).map(r=>normDate(r?.fecha)).filter(Boolean).sort();
    return fechas.length?fechas[fechas.length-1]:"";
  },[allRows]);

  useEffect(()=>{
    if(mode!=="dia")return;
    if(fecha)return;
    if(!ultimaFechaConRegistros)return;
    setState(s=>{
      if((s?.mode||"dia")!=="dia"||s?.fecha)return s;
      return {...s,fecha:ultimaFechaConRegistros};
    });
  },[mode,fecha,ultimaFechaConRegistros,setState]);

  const setMode=useCallback(v=>setState(s=>({...s,mode:v,fecha:v==="dia"?(s.fecha||ultimaFechaConRegistros||""):s.fecha})),[setState,ultimaFechaConRegistros]);
  const setFecha=useCallback(v=>setState(s=>({...s,fecha:v})),[setState]);
  const setFechaD=useCallback(v=>setState(s=>({...s,fechaD:v})),[setState]);
  const setFechaH=useCallback(v=>setState(s=>({...s,fechaH:v})),[setState]);

  const fechaDiaAplicada=mode==="dia"?(fecha||ultimaFechaConRegistros):fecha;

  // byFecha: filtrado solo por fecha — base para todo
  const byFecha=useMemo(()=>byDateFilter(allRows,mode,fechaDiaAplicada,fechaD,fechaH),[allRows,mode,fechaDiaAplicada,fechaD,fechaH]);

  // filtered: aplica todos los selectores sobre byFecha
  const filtered=useMemo(()=>{
    const activeFilters=filterKeys.filter(f=>!multiIsAll(vals[f.key],f.defaultVal));
    if(activeFilters.length===0)return byFecha;
    return byFecha.filter(r=>activeFilters.every(f=>matchMulti(r[f.key],vals[f.key],f.defaultVal)));
  },[byFecha,vals,fkKeys]);// eslint-disable-line

  // opts: opciones encadenadas de izquierda a derecha.
  // Cada filtro sólo toma en cuenta los filtros anteriores en el orden visual,
  // para que las opciones de la derecha dependan de lo elegido a la izquierda.
  const opts=useMemo(()=>{
    const result={};
    filterKeys.forEach((f,idx)=>{
      const prevActives=filterKeys
        .slice(0,idx)
        .filter(prev=>!multiIsAll(vals[prev.key],prev.defaultVal));
      const base=prevActives.length
        ? byFecha.filter(r=>prevActives.every(prev=>matchMulti(r[prev.key],vals[prev.key],prev.defaultVal)))
        : byFecha;
      result[f.key]=uniq(base.map(r=>r[f.key]).filter(v=>v!==undefined&&v!==null&&String(v).trim()!==""));
    });
    return result;
  },[byFecha,vals,fkKeys]);// eslint-disable-line

  const set=useCallback((key,val)=>setState(s=>({...s,vals:{...(s.vals||fkDefaults),[key]:val}})),[setState,fkDefaults]);
  const reset=useCallback(()=>setState(s=>({...s,mode:"dia",fecha:ultimaFechaConRegistros||"",fechaD:"",fechaH:"",vals:fkDefaults})),[setState,fkDefaults,ultimaFechaConRegistros]);
  const hayFiltros=fechaDiaAplicada||fechaD||fechaH||filterKeys.some(f=>!multiIsAll(vals[f.key],f.defaultVal));

  return{mode,setMode,fecha:fechaDiaAplicada,setFecha,fechaD,setFechaD,fechaH,setFechaH,byFecha,filtered,opts,vals,set,reset,hayFiltros};
}

// Filtros facetados simples (sin dimensión de fecha), para tablas estáticas
// como la Lista Maestra de Equipos: cada filtro muestra solo las opciones
// compatibles con los demás filtros activos.
function sortFacetValues(arr){
  return [...arr].sort((a,b)=>{
    const na=parseFloat(String(a).replace(/\./g,"").replace(",","."));
    const nb=parseFloat(String(b).replace(/\./g,"").replace(",","."));
    if(Number.isFinite(na)&&Number.isFinite(nb))return na-nb;
    return String(a).localeCompare(String(b),"es");
  });
}
function useSimpleFacetedFilters(rows, keys, storageKey){
  const[vals,setVals]=useState(()=>{
    if(!storageKey)return{};
    try{
      const raw=localStorage.getItem(storageKey);
      return raw?JSON.parse(raw):{};
    }catch(_){return{};}
  });
  useEffect(()=>{
    setVals(prev=>{
      let changed=false;
      const next={...prev};
      keys.forEach(k=>{if(!(k in next)){next[k]="todos";changed=true;}});
      Object.keys(next).forEach(k=>{if(!keys.includes(k)){delete next[k];changed=true;}});
      return changed?next:prev;
    });
  },[keys]);

  useEffect(()=>{
    if(!storageKey)return;
    try{localStorage.setItem(storageKey,JSON.stringify(vals||{}));}
    catch(_){}
  },[storageKey,vals]);

  const filtered=useMemo(()=>{
    const active=keys.filter(k=>!multiIsAll(vals[k]));
    if(!active.length)return rows;
    return rows.filter(r=>active.every(k=>matchMulti(r[k],vals[k])));
  },[rows,vals,keys]);
  const opts=useMemo(()=>{
    const result={};
    keys.forEach((k,idx)=>{
      const prevKeys=keys.slice(0,idx).filter(o=>!multiIsAll(vals[o]));
      const base=prevKeys.length?rows.filter(r=>prevKeys.every(o=>matchMulti(r[o],vals[o]))):rows;
      result[k]=sortFacetValues(uniq(base.map(r=>r[k])).filter(v=>v!==undefined&&v!==null&&String(v).trim()!==""));
    });
    return result;
  },[rows,vals,keys]);
  const set=useCallback((k,v)=>setVals(s=>({...s,[k]:v})),[]);
  const reset=useCallback(()=>setVals(Object.fromEntries(keys.map(k=>[k,"todos"]))),[keys]);
  const hayFiltros=keys.some(k=>!multiIsAll(vals[k]));
  return{vals,set,opts,filtered,reset,hayFiltros};
}


// ─── EquipoCard ───────────────────────────────────────────────────────────────
function EquipoCard({img,nombre,prefijos=[],rop02Prod,equiposExtra=[],matchTipo,listaInfoIndex}){
  const[hover,setHover]=useState(false);
  const[pinned,setPinned]=useState(false);
  const[pos,setPos]=useState({top:0,left:0});
  const cardRef=useRef(null);

  const codigos=useMemo(()=>{
    const by={};
    const normFam=f=>normalizeVehicleFamily(f||"");
    const match=(code,familia)=>{
      const fam=normFam(familia);
      if(typeof matchTipo==="function")return matchTipo(code,fam);
      return prefijos.some(p=>String(code||"").startsWith(p));
    };

    // Primero se cargan los registros ROP02 como respaldo operativo.
    (rop02Prod||[]).forEach(r=>{
      const code=cleanMachine(r.maquina);
      const lookupCode=machineCodeOutsideParentheses(r.maquina)||code;
      if(!code||!match(code,r._tipoVehiculo||r._tipo))return;
      // Si el equipo viene como "viejo (nuevo)", para propiedad se busca SOLO por el viejo.
      const info=getListaEquipoInfoMatch(listaInfoIndex,lookupCode)||getListaEquipoInfoMatch(listaInfoIndex,code);
      const propInfo=validPropiedadValue(info?.propiedad);
      const propRop=validPropiedadValue(r.propiedad);
      const propiedad=propInfo||propRop||"S/D";
      by[code]=by[code]||{
        codigo:code,
        proyecto:r.proyecto||info?.proyecto||info?.ubicacion||r.ubicacion||"S/D",
        propiedad,
        familia:r._tipoVehiculo||r._tipo||info?.familia||""
      };
    });

    // Después se pisa/completa con Lista Maestra, que es la fuente de verdad para
    // que aparezcan TODOS los vehículos aunque no tengan registros ROP02.
    (equiposExtra||[]).forEach(e=>{
      const code=cleanMachine(e.codigoNuevo||e.codigoViejo||e.codigo);
      if(!code||!match(code,e.familia))return;
      const proyecto=e.proyecto&&e.proyecto!=="S/D"?e.proyecto:(e.sitioAlquiler||e.ubicacion||"S/D");
      const prop=validPropiedadValue(e.propiedad)||validPropiedadValue(getPropiedadVehiculoFromListaRow(e))||"S/D";
      by[code]={
        codigo:code,
        proyecto:proyecto||"S/D",
        propiedad:prop,
        familia:e.familia||""
      };
    });
    return Object.values(by).sort((a,b)=>a.codigo.localeCompare(b.codigo,"es",{numeric:true}));
  },[rop02Prod,equiposExtra,prefijos,matchTipo,listaInfoIndex]);

  const updatePos=useCallback(()=>{
    const el=cardRef.current;
    if(!el)return;
    const r=el.getBoundingClientRect();
    const width=Math.min(440,Math.max(nombre==="Camioneta"?390:360,r.width+90));
    const height=Math.min(280,64+codigos.length*24);
    let left=r.left+(r.width/2)-(width/2);
    let top=r.top-height-10;
    if(left<10)left=10;
    if(left+width>window.innerWidth-10)left=window.innerWidth-width-10;
    if(top<10)top=Math.min(window.innerHeight-height-10,r.bottom+10);
    if(top+height>window.innerHeight-10)top=Math.max(10,window.innerHeight-height-10);
    setPos({top,left,width});
  },[codigos.length,nombre]);

  useEffect(()=>{
    if(!(hover||pinned))return;
    updatePos();
    window.addEventListener("resize",updatePos);
    window.addEventListener("scroll",updatePos,true);
    return()=>{
      window.removeEventListener("resize",updatePos);
      window.removeEventListener("scroll",updatePos,true);
    };
  },[hover,pinned,updatePos]);

  const tooltip=(hover||pinned)&&codigos.length>0?ReactDOM.createPortal(
    <div style={{position:"fixed",top:pos.top,left:pos.left,width:pos.width,zIndex:1000000,background:C.surface,border:`1px solid ${pinned?C.accent:C.border}`,borderRadius:10,padding:"10px 14px",boxShadow:"0 4px 24px rgba(0,0,0,.7)",pointerEvents:pinned?"auto":"none"}}>
      <div style={{fontFamily:"Inter",fontWeight:700,fontSize:11,color:C.accent,marginBottom:6,borderBottom:`1px solid ${C.border}`,paddingBottom:4}}>
        {nombre} — {codigos.length} equipo{codigos.length!==1?"s":""}{pinned?" · fijo":""}
      </div>
      <div style={{maxHeight:220,overflowY:"auto",overflowX:"hidden",paddingRight:6,paddingBottom:4}}>
        <div style={{display:"flex",flexDirection:"column",gap:4}}>
          {codigos.map(c=>(
            <div key={c.codigo} style={{display:"grid",gridTemplateColumns:"1.55fr .95fr 1fr",gap:6,fontSize:11,color:C.text,lineHeight:1.35,alignItems:"center"}}>
              <span style={{fontFamily:"monospace",letterSpacing:".02em",color:C.accent,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}} title={c.codigo}>{c.codigo}</span>
              <span style={{color:C.textSub,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}} title={c.proyecto||"S/D"}>{c.proyecto||"S/D"}</span>
              <span style={{color:C.textSub,textAlign:"right",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}} title={c.propiedad||"S/D"}>{c.propiedad||"S/D"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,document.body
  ):null;

  return(
    <div
      ref={cardRef}
      style={{position:"relative",display:"flex",flexDirection:"column",alignItems:"center",gap:0,background:C.surface,borderRadius:10,overflow:"visible",border:`1px solid ${(hover||pinned)?C.accent:C.border}`,transition:"border-color .2s",cursor:"default"}}
      onMouseEnter={()=>{setHover(true);setTimeout(updatePos,0);}}
      onMouseLeave={()=>setHover(false)}
    >
      <div
        onClick={()=>{setPinned(v=>!v);setTimeout(updatePos,0);}}
        title={pinned?"Click para soltar la lista":"Click para fijar la lista"}
        style={{width:"100%",height:110,background:"#111",borderRadius:"10px 10px 0 0",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}
      >
        <img src={img} alt={nombre} style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain",display:"block",pointerEvents:"none"}}/>
      </div>
      <span style={{fontFamily:"Inter",fontWeight:700,fontSize:11,color:C.accent,padding:"7px 0",textAlign:"center"}}>{nombre}</span>
      {tooltip}
    </div>
  );
}

// ─── ViewROP02 ────────────────────────────────────────────────────────────────

function HorometrosSection({rows}){
  const data=useMemo(()=>{
    const groups={};
    (rows||[]).forEach((r,idx)=>{
      if(!r.maquina)return;
      if(!groups[r.maquina])groups[r.maquina]=[];
      groups[r.maquina].push({...r,_idx:idx});
    });
    const numParte=r=>{
      const n=parseFloat(String(r.parte||"").replace(/[^0-9.]/g,""));
      return Number.isFinite(n)?n:0;
    };
    const cleanRows=list=>[...list].sort((a,b)=>
      String(a.fecha||"").localeCompare(String(b.fecha||"")) ||
      numParte(a)-numParte(b) ||
      (Number(a.horometroInicial)||0)-(Number(b.horometroInicial)||0) ||
      a._idx-b._idx
    );
    return Object.entries(groups).map(([maquina,list])=>{
      const ordenadas=cleanRows(list);
      const primerasConHI=ordenadas.filter(r=>Number(r.horometroInicial)>0);
      const ultimasConHF=ordenadas.filter(r=>Number(r.horometroFinal)>0);
      const primera=primerasConHI[0]||ordenadas[0];
      const ultima=ultimasConHF[ultimasConHF.length-1]||ordenadas[ordenadas.length-1];
      const hi=Number(primera?.horometroInicial)||0;
      const hf=Number(ultima?.horometroFinal)||0;
      const delta=hf&&hi?hf-hi:0;
      const proyectos=uniq(ordenadas.map(r=>r.proyecto)).join(" / ");
      const supervisores=uniq(ordenadas.map(r=>r.supervisor)).join(" / ");
      const estados=uniq(ordenadas.map(r=>r.estado)).join(" / ");
      return{
        maquina,
        proyecto:proyectos,
        fechaInicial:primera?.fecha||"",
        horometroInicial:hi,
        fechaFinal:ultima?.fecha||"",
        horometroFinal:hf,
        diferencia:delta,
        registros:ordenadas.length,
        horas:ordenadas.reduce((s,r)=>s+(Number(r.horas)||0),0),
        supervisor:supervisores,
        estado:estados,
      };
    }).sort((a,b)=>a.maquina.localeCompare(b.maquina));
  },[rows]);

  const stats=useMemo(()=>({
    equipos:data.length,
    registros:(rows||[]).length,
    totalDelta:data.reduce((s,r)=>s+(Number(r.diferencia)||0),0),
    sinHorometro:data.filter(r=>!r.horometroInicial||!r.horometroFinal).length,
  }),[data,rows]);

  const cols=useMemo(()=>[
    {key:"maquina",label:"Máquina",render:v=><Badge color={C.purple}>{v}</Badge>},
    {key:"proyecto",label:"Proyecto",render:v=><span>{String(v||"—").split(" / ").map((p,i)=><span key={p+i} style={{marginRight:4}}><Badge color={proyColor(p)}>{p}</Badge></span>)}</span>},
    {key:"fechaInicial",label:"Fecha inicial",render:v=>fmtFecha(v)},
    {key:"horometroInicial",label:"Horómetro inicial",render:v=><span style={{color:C.teal,fontWeight:700}}>{fmtNum(v)}</span>},
    {key:"fechaFinal",label:"Fecha final",render:v=>fmtFecha(v)},
    {key:"horometroFinal",label:"Horómetro final",render:v=><span style={{color:C.accent,fontWeight:700}}>{fmtNum(v)}</span>},
    {key:"diferencia",label:"Diferencia",render:v=><span style={{color:v<0?C.red:C.green,fontWeight:700}}>{fmtNum(v)}</span>},
    {key:"horas",label:"Hs. registradas",render:v=>fmtNum(v)},
    {key:"registros",label:"Registros"},
    {key:"supervisor",label:"Supervisor",wrap:true,render:v=><span title={v}>{v||"—"}</span>},
  ],[]);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <AlertBanner type="info">La tabla toma el horómetro inicial del primer registro del período filtrado y el horómetro final del último registro disponible para cada máquina.</AlertBanner>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
        <StatCard icon="equip" label="Máquinas" value={stats.equipos} color={C.purple} small/>
        <StatCard icon="parts" label="Registros" value={stats.registros} color={C.blue} small/>
        <StatCard icon="hours" label="Dif. total horómetro" value={fmtNum(stats.totalDelta)} color={C.green} small/>
        <StatCard icon="warn" label="Sin HI/HF completo" value={stats.sinHorometro} color={stats.sinHorometro?C.yellow:C.green} small/>
      </div>
      <Card title={`Horómetros por máquina (${data.length})`} action={<BtnExcel onClick={()=>excelFromCols(cols,data,"Horometros")}/>}>
        <Table cols={cols} rows={data} maxH={520} emptyMsg="Sin registros con los filtros seleccionados"/>
      </Card>
    </div>
  );
}

function ViewROP02({rop02All,listaEquipos,extState,setExtState,remoteTotal=0,remoteHasMore=false,onRemoteMore,onRemoteExport}){
  // Excluir camionetas y camiones de toda la vista ROP02
  const rop02Prod=useMemo(()=>rop02All.filter(r=>!r._excluded && normalizeMachineCode(r.maquina)!=="CAA-0002"),[rop02All]);
  const listaInfoIndex=useMemo(()=>buildListaEquipoInfoIndex(listaEquipos),[listaEquipos]);
  const fk=useMemo(()=>[
    {key:"proyecto",defaultVal:"todos"},
    {key:"turno",defaultVal:"todos"},
    {key:"maquina",defaultVal:"todas"},
    {key:"supervisor",defaultVal:"todos"},
    {key:"operario",defaultVal:"todos"},
  ],[]);
  const{mode,setMode,fecha,setFecha,fechaD,setFechaD,fechaH,setFechaH,filtered:filteredBase,opts,vals,set,reset,hayFiltros}=useFacetedFilters(rop02Prod,fk,extState,setExtState);

  // Filtro de estado correlacionado con los filtros anteriores.
  // Ejemplo: si elegís una máquina, el filtro Estado solo muestra los estados existentes para esa máquina.
  const estado=extState?.estado||"todos";
  const setEstado=v=>setExtState(s=>({...s,estado:v}));
  const estadoOptions=useMemo(()=>{const o=uniq(filteredBase.map(r=>r.estado).filter(Boolean)); if(!o.includes("EM")) o.push("EM"); return o;},[filteredBase]);
  const[tipoMaquinaROP02,setTipoMaquinaROP02]=useState("todas");
  const filtered=useMemo(()=>{
    let base=filteredBase;
    if(!multiIsAll(tipoMaquinaROP02,"todas"))base=base.filter(r=>tipoMatchMachineROP05(tipoMaquinaROP02,r.maquina));
    if(multiIsAll(estado,"todos"))return base;
    return base.filter(r=>matchMulti(r.estado,estado,"todos")||matchMulti(String(r.horasRaw||"").trim().toUpperCase(),estado,"todos"));
  },[filteredBase,estado,tipoMaquinaROP02]);
  const hayFiltrosConEstado=hayFiltros||!multiIsAll(estado,"todos")||!multiIsAll(tipoMaquinaROP02,"todas");
  const resetAll=()=>{reset();setEstado("todos");setTipoMaquinaROP02("todas");};

  const stats=useMemo(()=>({
    horas:filtered.reduce((s,r)=>s+r.horas,0),
    comb:filtered.reduce((s,r)=>s+r.combustible,0),
    equipos:uniq(filtered.map(r=>r.maquina)).length,
    ops:uniq(filtered.map(r=>r.operario)).length,
    prod:filtered.filter(r=>r.estado==="TRABAJO").length,
    od:filtered.filter(r=>r.estado==="OD").length,
    fs:filtered.filter(r=>r.estado==="FS").length,
    em:filtered.filter(r=>r.estado==="EM").length,
    desgaste:filtered.filter(r=>r.desgaste&&r.desgaste.trim()!==""&&!r.desgaste.toLowerCase().includes("sin consumo")).length,
  }),[filtered]);
  const horasFecha=useMemo(()=>{if(mode!=="periodo")return[];const m={};filtered.forEach(r=>{m[r.fecha]=(m[r.fecha]||0)+r.horas;});return Object.entries(m).sort().map(([fecha,horas])=>({fecha,horas}));},[filtered,mode]);

  const cols=useMemo(()=>[
    {key:"fecha",label:"Fecha",render:v=>fmtFecha(v)},
    {key:"maquina",label:"Máquina",render:v=><Badge color={C.purple}>{v}</Badge>},
    {key:"operario",label:"Operario"},
    {key:"supervisor",label:"Supervisor"},
    {key:"tipo_trabajo",label:"Tarea",render:v=><span style={{display:"block",maxWidth:260,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={v}>{v||"—"}</span>},
    {key:"horas",label:"Horas",render:(v,r)=>{const est=String(r?.estado||"").toUpperCase();return est==="OD"||est==="FS"||est==="EM"?<Badge color={est==="FS"?C.red:est==="EM"?C.purple:C.yellow}>{est}</Badge>:<span style={{color:C.accent,fontWeight:600}}>{fmtNum(v)}</span>;}},
    {key:"combustible",label:"Comb.",render:v=>fmtNum(v)},
    {key:"estado",label:"Estado",render:v=><Badge color={v==="FS"?C.red:v==="EM"?C.purple:v==="OD"?C.yellow:C.green}>{v||"—"}</Badge>},
    {key:"desgaste",label:"Desgaste",wrap:true,render:v=>v&&!v.toLowerCase().includes("sin consumo")?<Badge color={C.purple}>{v}</Badge>:<span style={{color:C.textMuted}}>—</span>},
    {key:"proyecto",label:"Proyecto",render:v=><Badge color={proyColor(v)}>{v||"—"}</Badge>},
  ],[]);
  // Ordenar de más reciente a más viejo
  const filteredSorted=useMemo(()=>[...filtered].sort((a,b)=>b.fecha.localeCompare(a.fecha)),[filtered]);
  const filtrosOperativosActivos=Boolean(fecha||fechaD||fechaH)||fk.some(f=>!multiIsAll(vals[f.key],f.defaultVal))||!multiIsAll(estado,"todos");
  const codigosFiltradosSet=useMemo(()=>{
    const set=new Set();
    (filtered||[]).forEach(r=>{
      const c=cleanMachine(r.maquina);
      if(c){set.add(c);set.add(c.replace(/[^A-Z0-9]/g,""));set.add(canonicalEquivalentMachineCode(c));}
    });
    return set;
  },[filtered]);
  const equiposListaFiltrados=useMemo(()=>{
    return (listaInfoIndex.all||[]).filter(e=>{
      const fam=String(e.familia||"");
      if(fam.includes("CAMION")||fam.includes("CAMIONETA"))return false;
      if(!matchMulti(e.proyecto||e.ubicacion,vals.proyecto,"todos"))return false;
      if(!multiIsAll(vals.maquina,"todas")&&!matchMulti(e.codigoNuevo||e.codigo||e.codigoViejo,vals.maquina,"todas"))return false;
      if(filtrosOperativosActivos){
        return (e.codes||[e.codigoNuevo,e.codigoViejo,e.codigo]).some(c=>{
          const k=cleanMachine(c);
          return codigosFiltradosSet.has(k)||codigosFiltradosSet.has(k.replace(/[^A-Z0-9]/g,""))||codigosFiltradosSet.has(canonicalEquivalentMachineCode(k));
        });
      }
      return true;
    });
  },[listaInfoIndex,vals.proyecto,vals.maquina,filtrosOperativosActivos,codigosFiltradosSet]);
  const [rop05TipRow,setRop05TipRow]=React.useState(null);   // fila en hover
  const [rop05PinnedRow,setRop05PinnedRow]=React.useState(null); // fila fijada por click
  const [rop05TipPos,setRop05TipPos]=React.useState({x:0,y:0});
  const rop05ActiveRow=rop05PinnedRow||rop05TipRow;
  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:14}}>
      <Card>
        <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",gap:7}}>
            <TabBtn active={mode==="dia"} onClick={()=>setMode("dia")}>Por día</TabBtn>
            <TabBtn active={mode==="periodo"} onClick={()=>setMode("periodo")}>Por período</TabBtn>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"flex-end"}}>
            {mode==="dia"?(
              <DateIn label="Fecha" value={fecha} onChange={setFecha}/>
            ):mode==="acumulado"?(
              <>
                <Sel label="Período" value={periodoAcumulado} onChange={setPeriodoAcumulado} options={ROP05_PERIODOS_ACUMULADO}/>
                <Sel label="Año" value={anioAcumulado} onChange={setAnioAcumulado} options={anioAcumuladoOpts}/>
                <div style={{fontSize:11,color:C.textMuted,padding:"0 4px 8px",whiteSpace:"nowrap"}}>Rango: {fmtFecha(rangoAcumulado.desde)} → {fmtFecha(rangoAcumulado.hasta)}</div>
              </>
            ):(
              <><PeriodMonthYear fechaD={fechaD} fechaH={fechaH} setFechaD={setFechaD} setFechaH={setFechaH}/><DateIn label="Desde" value={fechaD} onChange={setFechaD} max={fechaH||undefined}/><DateIn label="Hasta" value={fechaH} onChange={setFechaH} min={fechaD||undefined} warn={fechaH&&fechaD&&fechaH<fechaD?"≥ Desde":null}/></>
            )}
            <MultiSel label="Tipo de Máquina" value={tipoMaquinaROP02} onChange={v=>{setTipoMaquinaROP02(v);set("maquina","todas");setEstado("todos");}} options={ROP05_TIPOS_MAQUINA.map(t=>({value:t.value,label:t.label}))}/>
            <MultiSel label="Proyecto" value={vals.proyecto} onChange={v=>{set("proyecto",v);setEstado("todos");}} options={[{value:"todos",label:"Todos"},...opts.proyecto.map(p=>({value:p,label:p}))]}/>
            <MultiSel label="Turno" value={vals.turno} onChange={v=>{set("turno",v);setEstado("todos");}} options={[{value:"todos",label:"Todos"},...opts.turno.map(t=>{const u=String(t||"").trim().toUpperCase();return{value:t,label:(u.includes("NOCHE")||u==="TN")?"Turno Noche":(u.includes("DIA")||u==="TD")?"Turno Día":t};})]}/>
            <MultiSel label="Máquina" value={vals.maquina} onChange={v=>{set("maquina",v);setEstado("todos");}} options={[{value:"todas",label:"Todas"},...opts.maquina.filter(m=>multiIsAll(tipoMaquinaROP02,"todas")||tipoMatchMachineROP05(tipoMaquinaROP02,m)).map(m=>({value:m,label:m}))]}/>
            <MultiSel label="Supervisor" value={vals.supervisor} onChange={v=>{set("supervisor",v);setEstado("todos");}} options={[{value:"todos",label:"Todos"},...opts.supervisor.map(s=>({value:s,label:s}))]}/>
            <MultiSel label="Operario" value={vals.operario} onChange={v=>{set("operario",v);setEstado("todos");}} options={[{value:"todos",label:"Todos"},...opts.operario.map(o=>({value:o,label:o}))]}/>
            <MultiSel label="Estado" value={estado} onChange={setEstado} options={[
              {value:"todos",label:"Todos"},
              ...[
                {value:"TRABAJO",label:"✅ Trabajo efectivo"},
                {value:"OD",label:"🟡 Operativo a Disposición"},
                {value:"FS",label:"🔴 Fuera de servicio"},
                {value:"EM",label:"🟣 En mantenimiento"},
              ].filter(o=>estadoOptions.includes(o.value)),
            ]}/>
            <button onClick={resetAll} style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,border:`1px solid ${C.red}44`,background:C.redDim,color:C.red,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"Inter",opacity:hayFiltrosConEstado?1:0.3,pointerEvents:hayFiltrosConEstado?"auto":"none"}}>
              <Icon name="close" size={11} color={C.red}/>Limpiar filtros
            </button>
          </div>
        </div>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10}}>
        <StatCard icon="hours" label="Horas" value={fmtNum(stats.horas)} color={C.yellow} small/>
        <StatCard icon="fuel" label="Combustible" value={fmtNum(stats.comb)} color={C.teal} small/>
        <StatCard icon="equip" label="Equipos" value={stats.equipos} color={C.purple} small/>
        <StatCard icon="parts" label="Operarios" value={stats.ops} color={C.blue} small/>
        <StatCard icon="check" label="Productivos" value={stats.prod} color={C.green} small/>
        <StatCard icon="parts" label="Días OD" value={stats.od} color={C.yellow} small/>
        <StatCard icon="warn" label="Días FS" value={stats.fs} color={C.red} small/>
        <StatCard icon="gear" label="Días EM" value={stats.em} color={C.purple} small/>
        <StatCard icon="wear" label="Días con elementos de desgaste" value={stats.desgaste} color={C.purple} small/>
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
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>
          {uniq(filtered.map(r=>r.proyecto)).map((p)=>{
            const rows=filtered.filter(r=>r.proyecto===p);
            const col=proyColor(p);
            return(
              <Card key={p} style={{borderColor:col+"44"}}>
                <div style={{padding:"12px 16px"}}>
                  <Badge color={col}>{p}</Badge>
                  <div style={{marginTop:10,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {[[fmtNum(rows.reduce((s,r)=>s+r.horas,0)),"horas",col],[fmtNum(rows.reduce((s,r)=>s+r.combustible,0)),"combustible",C.teal],[rows.length,"registros",C.blue],[uniq(rows.map(r=>r.maquina)).length,"equipos",C.purple]].map(([v,l,c],j)=>(
                      <div key={j}><div style={{fontFamily:"Inter",fontSize:18,fontWeight:800,color:c}}>{v}</div><div style={{fontSize:10,color:C.textMuted}}>{l}</div></div>
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <Card title={`Registros (${remoteTotal||filtered.length})`} action={<BtnExcel onClick={async()=>{if(!onRemoteExport){excelFromCols(cols,filteredSorted,"Equipos_ROP02");return;}const rows=(await onRemoteExport()).filter(r=>!r._excluded&&normalizeMachineCode(r.maquina)!=="CAA-0002").filter(r=>multiIsAll(tipoMaquinaROP02,"todas")||tipoMatchMachineROP05(tipoMaquinaROP02,r.maquina)).filter(r=>multiIsAll(estado,"todos")||matchMulti(r.estado,estado,"todos")||matchMulti(String(r.horasRaw||"").trim().toUpperCase(),estado,"todos")).filter(r=>matchMulti(r.operario,vals.operario,"todos"));excelFromCols(cols,rows,"Equipos_ROP02");}}/>}>
        <Table cols={cols} rows={filteredSorted} maxH={400} emptyMsg="Sin registros con los filtros seleccionados"/>
        {(remoteTotal>0||remoteHasMore)&&<div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:10,padding:12,borderTop:`1px solid ${C.border}`}}><span style={{fontSize:12,color:C.textMuted}}>Mostrando {rop02All.length} de {remoteTotal} registros</span>{remoteHasMore&&<button onClick={onRemoteMore} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,padding:"7px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Mostrar 250 más</button>}</div>}
      </Card>
      <Card title="Flota de Equipos" style={{overflow:"visible"}}>
        <div style={{padding:"14px 16px",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12}}>
          {[
            {img:IMG_CARGADORA_FRONTAL,   nombre:"Cargadora Frontal",   prefijos:["CFN","PCA"]},
            {img:IMG_EXCAVADORA,          nombre:"Excavadora",          prefijos:["EXC"]},
            {img:IMG_TOPADORA,            nombre:"Topadora",            prefijos:["TOP"]},
            {img:IMG_MOTONIVELADORA,      nombre:"Motoniveladora",      prefijos:["MOT"]},
            {img:IMG_RETROPALA,           nombre:"Retropala",           prefijos:["RTP"]},
            {img:IMG_RODILLO_COMPACTADOR, nombre:"Rodillo Compactador", prefijos:["ROD","RPC","RCP"]},
            {img:IMG_MINICARGADORA,       nombre:"Minicargadora",       prefijos:["MCA","MNC"]},
          ].map(tipo=>(
            <EquipoCard key={tipo.nombre} {...tipo} rop02Prod={filtered} equiposExtra={equiposListaFiltrados} listaInfoIndex={listaInfoIndex}/>
          ))}
        </div>
      </Card>
    </div>
  );
}


function ViewHorometros({rop02All,extState,setExtState}){
  const rop02Prod=useMemo(()=>rop02All.filter(r=>!r._excluded),[rop02All]);
  const tipoMaquina=extState?.tipoMaquina||"todas";
  const setTipoMaquina=v=>setExtState(st=>({...st,tipoMaquina:v,maquina:"todas"}));
  const rop02Tipo=useMemo(()=>rop02Prod.filter(r=>dmMatchTipoMaquinaSeleccion(r.maquina,tipoMaquina)),[rop02Prod,tipoMaquina]);

  const fk=useMemo(()=>[
    {key:"proyecto",defaultVal:"todos"},
    {key:"maquina",defaultVal:"todas"},
    {key:"supervisor",defaultVal:"todos"},
    {key:"operario",defaultVal:"todos"},
  ],[]);

  const{mode,setMode,fecha,setFecha,fechaD,setFechaD,fechaH,setFechaH,filtered:filteredBase,opts,vals,set,reset,hayFiltros}=useFacetedFilters(rop02Tipo,fk,extState,setExtState);

  // En Horómetros no se filtra por estado: se muestran todos los registros del período
  // para calcular el horómetro inicial y final real de cada máquina.
  const filtered=filteredBase;
  const hayFiltrosHorometros=hayFiltros||!multiIsAll(tipoMaquina,"todas");
  const resetAll=()=>{reset();setTipoMaquina("todas");};

  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:14}}>
      <Card>
        <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",gap:7}}>
            <TabBtn active={mode==="dia"} onClick={()=>setMode("dia")}>Por día</TabBtn>
            <TabBtn active={mode==="periodo"} onClick={()=>setMode("periodo")}>Por período</TabBtn>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"flex-end"}}>
            {mode==="dia"?
              <DateIn label="Fecha" value={fecha} onChange={setFecha}/>
              :<>
                <PeriodMonthYear fechaD={fechaD} fechaH={fechaH} setFechaD={setFechaD} setFechaH={setFechaH}/>
                <DateIn label="Desde" value={fechaD} onChange={setFechaD} max={fechaH||undefined}/>
                <DateIn label="Hasta" value={fechaH} onChange={setFechaH} min={fechaD||undefined} warn={fechaH&&fechaD&&fechaH<fechaD?"≥ Desde":null}/>
              </>}
            <MultiSel label="Tipo de Máquina" value={tipoMaquina} onChange={setTipoMaquina} options={dmTipoMaquinaOptions()}/>
            <MultiSel label="Proyecto" value={vals.proyecto} onChange={v=>set("proyecto",v)} options={[{value:"todos",label:"Todos"},...opts.proyecto.map(p=>({value:p,label:p}))]}/>
            <MultiSel label="Máquina" value={vals.maquina} onChange={v=>set("maquina",v)} options={[{value:"todas",label:"Todas"},...opts.maquina.map(m=>({value:m,label:m}))]}/>
            <MultiSel label="Supervisor" value={vals.supervisor} onChange={v=>set("supervisor",v)} options={[{value:"todos",label:"Todos"},...opts.supervisor.map(s=>({value:s,label:s}))]}/>
            <MultiSel label="Operario" value={vals.operario} onChange={v=>set("operario",v)} options={[{value:"todos",label:"Todos"},...opts.operario.map(o=>({value:o,label:o}))]}/>
            <button onClick={resetAll} style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,border:`1px solid ${C.red}44`,background:C.redDim,color:C.red,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"Inter",opacity:hayFiltrosHorometros?1:0.3,pointerEvents:hayFiltrosHorometros?"auto":"none"}}>
              <Icon name="close" size={11} color={C.red}/>Limpiar filtros
            </button>
          </div>
        </div>
      </Card>
      <HorometrosSection rows={filtered}/>
    </div>
  );
}

// ─── Generar Excel de Productividad ──────────────────────────────────────────
function estilosCelda(wb){
  // Helper para crear estilos
  const s=(fill,font,border,align)=>({
    fill:fill?{fgColor:{rgb:fill},patternType:"solid"}:undefined,
    font:font||undefined,
    border:border?{top:{style:"thin",color:{rgb:"CCCCCC"}},bottom:{style:"thin",color:{rgb:"CCCCCC"}},left:{style:"thin",color:{rgb:"CCCCCC"}},right:{style:"thin",color:{rgb:"CCCCCC"}}}:undefined,
    alignment:align||{vertical:"center"},
  });
  return{
    titulo:   s("1A1A2E",{bold:true,color:{rgb:"FFFFFF"},sz:13},true,{horizontal:"center",vertical:"center"}),
    periodo:  s("2D2D2D",{color:{rgb:"AAAAAA"},sz:10},false,{horizontal:"left",vertical:"center"}),
    tipoEq:   s("C00000",{bold:true,color:{rgb:"FFFFFF"},sz:11},true,{horizontal:"center",vertical:"center"}),
    proyJM:   s("1F4E79",{bold:true,color:{rgb:"FFFFFF"},sz:10},true,{horizontal:"center",vertical:"center"}),
    proyFDS:  s("833C00",{bold:true,color:{rgb:"FFFFFF"},sz:10},true,{horizontal:"center",vertical:"center"}),
    header:   s("2E2E2E",{bold:true,color:{rgb:"DDDDDD"},sz:9},true,{horizontal:"center",vertical:"center"}),
    tareaJM:  s("EBF3FB",{color:{rgb:"1A1A2E"},sz:10},true,{horizontal:"left",vertical:"center"}),
    tareaFDS: s("FFF2CC",{color:{rgb:"3A2000"},sz:10},true,{horizontal:"left",vertical:"center"}),
    numJM:    s("EBF3FB",{color:{rgb:"1F4E79"},sz:10},true,{horizontal:"center",vertical:"center"}),
    numFDS:   s("FFF2CC",{color:{rgb:"833C00"},sz:10},true,{horizontal:"center",vertical:"center"}),
    vacio:    s("F5F5F5",null,true,{horizontal:"center",vertical:"center"}),
    sep:      s("888888",null,false,{horizontal:"center",vertical:"center"}),
  };
}

function generarExcelProductividad(rop05, fechaD, fechaH, mode, fechaDia, opts={}){
  const MESES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  // Hoja 1 = período mensual seleccionado en "Por período".
  // Hoja 2 = acumulado según Verano/Invierno + Año.
  // En modo acumulado NO usamos el rango de temporada para la primera hoja,
  // porque el Excel debe mantener el mismo formato que "Por período":
  // una hoja mensual y otra hoja acumulada.
  let fechaDesde, fechaHasta, mesNombre, y, temporada, tempDesde, tempHasta;
  if(mode==="acumulado"){
    const rango=rop05TemporadaRango(opts.periodoAcumulado||"verano",opts.anioAcumulado||new Date().getFullYear());
    tempDesde=rango.desde;
    tempHasta=rango.hasta;
    temporada=rango.label.toUpperCase();

    if(fechaD&&fechaH){
      fechaDesde=fechaD;
      fechaHasta=fechaH;
    }else{
      const hoy=new Date();
      const yy=hoy.getFullYear();
      const mm=hoy.getMonth()+1;
      fechaDesde=`${yy}-${String(mm).padStart(2,"0")}-01`;
      fechaHasta=`${yy}-${String(mm).padStart(2,"0")}-${String(new Date(yy,mm,0).getDate()).padStart(2,"0")}`;
    }

    const d=rop05ParseYMDLocal(fechaDesde);
    mesNombre=MESES[d.getMonth()];
    y=d.getFullYear();
  } else if(mode==="dia"&&fechaDia){
    fechaDesde=fechaDia; fechaHasta=fechaDia;
    const d=rop05ParseYMDLocal(fechaDia);
    mesNombre=MESES[d.getMonth()]; y=d.getFullYear();
    const rango=rop05TemporadaDeFecha(fechaDesde);
    temporada=rango.label.toUpperCase(); tempDesde=rango.desde; tempHasta=fechaHasta;
  } else if(fechaD&&fechaH){
    fechaDesde=fechaD; fechaHasta=fechaH;
    const d=rop05ParseYMDLocal(fechaD);
    mesNombre=MESES[d.getMonth()]; y=d.getFullYear();
    const rango=rop05TemporadaDeFecha(fechaDesde);
    temporada=rango.label.toUpperCase(); tempDesde=rango.desde; tempHasta=fechaHasta;
  } else {
    const hoy=new Date();
    mesNombre=MESES[hoy.getMonth()]; y=hoy.getFullYear();
    const mesNum=hoy.getMonth()+1;
    fechaDesde=`${y}-${String(mesNum).padStart(2,"0")}-01`;
    const lastDay=new Date(y,mesNum,0).getDate();
    fechaHasta=`${y}-${String(mesNum).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;
    const rango=rop05TemporadaDeFecha(fechaDesde);
    temporada=rango.label.toUpperCase(); tempDesde=rango.desde; tempHasta=fechaHasta;
  }

  // Filtrar ROP05 por período (excluir HS)
  const filtrarRows=(rows, desde, hasta)=>rows.filter(r=>{
    if(!r.fecha||r.fecha<desde||r.fecha>hasta)return false;
    if(!r.unidad||r.unidad.trim().toUpperCase()==="HS")return false;
    if(!r.horas||r.horas<=0)return false;
    return true;
  });

  const rowsMes=filtrarRows(rop05,fechaDesde,fechaHasta);
  const rowsTemp=filtrarRows(rop05,tempDesde,tempHasta);

  const TIPOS=[
    {nombre:"Motoniveladora",prefijos:["MOT"]},
    {nombre:"Excavadora",prefijos:["EXC"]},
    {nombre:"Rodillo Compactador",prefijos:["ROD","RPC","RCP"]},
    {nombre:"Cargadora Frontal",prefijos:["CFN","PCA"]},
    {nombre:"Minicargadora",prefijos:["MCA","MNC"]},
    {nombre:"Retropala",prefijos:["RTP"]},
    {nombre:"Topadora",prefijos:["TOP"]},
  ];
  const PROYECTOS=["JOSE MARIA","FILO DEL SOL"];

  // Calcular rendimiento por tarea. Los kilómetros lineales se convierten a metros
  // lineales (*1000) y se suman en la misma columna ML/Hs del Excel.
  const calcRendimiento=(rows)=>{
    const m={};
    rows.forEach(r=>{
      const k=dmDisplayTarea(r.tarea||"Sin tarea");
      if(!m[k])m[k]={horas:0,horasML:0,horasM2:0,horasM3:0,ml:0,m2:0,m3:0};
      m[k].horas+=r.horas;
      const u=nuROP05(r.unidad);
      const cant=r.cantidad||0;
      if(rop05EsML(u)){m[k].ml+=cant;m[k].horasML+=r.horas;}
      else if(rop05EsKML(u)){m[k].ml+=cant*1000;m[k].horasML+=r.horas;}
      else if(rop05EsM2(u)){m[k].m2+=cant;m[k].horasM2+=r.horas;}
      else if(rop05EsM3(u)){m[k].m3+=cant;m[k].horasM3+=r.horas;}
    });
    return m;
  };

  // Filtrar tareas al 80% de horas y calcular rendimiento
  const calcTabla=(rows)=>{
    const rend=calcRendimiento(rows);
    const tareas=Object.entries(rend).sort((a,b)=>b[1].horas-a[1].horas);
    const totalHoras=tareas.reduce((s,[,v])=>s+v.horas,0);
    let acum=0;
    const result=[];
    for(const [tarea,v] of tareas){
      if(acum/totalHoras>=0.8&&result.length>0)break;
      result.push({
        tarea,
        horas:Math.round(v.horas*10)/10,
        mlHs:v.horasML>0&&v.ml>0?Math.round(v.ml/v.horasML*10)/10:0,
        m2Hs:v.horasM2>0&&v.m2>0?Math.round(v.m2/v.horasM2*10)/10:0,
        m3Hs:v.horasM3>0&&v.m3>0?Math.round(v.m3/v.horasM3*10)/10:0,
      });
      acum+=v.horas;
    }
    return result;
  };

  const wb=XLSX.utils.book_new();
  const ST=estilosCelda(wb);
  const COLS=[{wch:32},{wch:7},{wch:7},{wch:7},{wch:7},{wch:2},{wch:32},{wch:7},{wch:7},{wch:7},{wch:7}];

  // 10 columnas: A-E = JM, F-J = FDS. KML se informa convertido dentro de ML/Hs.
  const COLS10=[{wch:32},{wch:7},{wch:7},{wch:7},{wch:7},{wch:32},{wch:7},{wch:7},{wch:7},{wch:7}];

  const construirHoja=(rowsFiltradas, titulo, periodo)=>{
    const data=[];
    const merges=[];

    // Título — combinado A:J
    data.push([titulo,"","","","","","","","",""]);
    merges.push({s:{r:0,c:0},e:{r:0,c:9}});

    // Período
    data.push([`Período: ${periodo}`,"","","","","","","","",""]);
    merges.push({s:{r:1,c:0},e:{r:1,c:9}});

    data.push([]); // espacio

    TIPOS.forEach(tipo=>{
      const rowsJM=rowsFiltradas.filter(r=>tipo.prefijos.some(p=>r.maquina?.startsWith(p))&&r.proyecto==="JOSE MARIA");
      const rowsFDS=rowsFiltradas.filter(r=>tipo.prefijos.some(p=>r.maquina?.startsWith(p))&&r.proyecto==="FILO DEL SOL");
      const tablaJM=calcTabla(rowsJM);
      const tablaFDS=calcTabla(rowsFDS);
      if(!tablaJM.length&&!tablaFDS.length)return;

      const baseRow=data.length;

      // Nombre del tipo — combinado A:J
      data.push([tipo.nombre.toUpperCase(),"","","","","","","","",""]);
      merges.push({s:{r:baseRow,c:0},e:{r:baseRow,c:9}});

      // Proyectos — JM combinado A:E, FDS combinado F:J
      data.push(["JOSE MARIA","","","","","FILO DEL SOL","","","",""]);
      merges.push({s:{r:baseRow+1,c:0},e:{r:baseRow+1,c:4}});
      merges.push({s:{r:baseRow+1,c:5},e:{r:baseRow+1,c:9}});

      // Headers columnas
      data.push(["Tarea JM","Hs","ML/Hs","M2/Hs","M3/Hs","Tarea FDS","Hs","ML/Hs","M2/Hs","M3/Hs"]);

      // Datos
      const maxR=Math.max(tablaJM.length,tablaFDS.length,1);
      for(let i=0;i<maxR;i++){
        const jm=tablaJM[i];
        const fds=tablaFDS[i];
        data.push([
          jm?jm.tarea:"", jm?jm.horas||0:0, jm?jm.mlHs||0:0, jm?jm.m2Hs||0:0, jm?jm.m3Hs||0:0,
          fds?fds.tarea:"",fds?fds.horas||0:0,fds?fds.mlHs||0:0,fds?fds.m2Hs||0:0,fds?fds.m3Hs||0:0,
        ]);
      }
      data.push([]); // espacio
    });

    const ws=XLSX.utils.aoa_to_sheet(data);
    ws["!merges"]=merges;
    ws["!cols"]=COLS10;
    return ws;
  };

  const tituloPrincipal=`INFORME DE PRODUCTIVIDAD — ${mesNombre.toUpperCase()} ${y}`;
  const hojaPrincipal=`${mesNombre} ${y}`;

  const wsMes=construirHoja(rowsMes,tituloPrincipal,`${fechaDesde} → ${fechaHasta}`);
  XLSX.utils.book_append_sheet(wb,wsMes,String(hojaPrincipal).slice(0,31));

  const wsAcum=construirHoja(rowsTemp,`PRODUCTIVIDAD ACUMULADA — ${temporada}`,`${tempDesde} → ${tempHasta}`);
  XLSX.utils.book_append_sheet(wb,wsAcum,`Acumulado ${temporada.split(" ")[0]}`.slice(0,31));

  // ── Descargar con estilos ─────────────────────────────────────────────────
  const nombreArchivo=mode==="acumulado"
    ? `Productividad_${mesNombre}_${y}_${String(temporada).replace(/[^a-zA-Z0-9_-]+/g,"_")}`
    : `Productividad_${mesNombre}_${y}`;
  XLSX.writeFile(wb,`${nombreArchivo}.xlsx`);
}

function generarExcelDiscriminacionROP05(resumenTareas,discrRows,detalleRows,label="Reporte"){
  const wb=XLSX.utils.book_new();
  const resumen=(resumenTareas||[]).map(r=>({
    Tarea:r.tarea,
    Unidad:r.unidad,
    Cantidad:Number((r.cantidad||0).toFixed(3)),
    Horas:Number((r.horas||0).toFixed(2)),
    "Prod/hs":Number((r.rendimiento||0).toFixed(3)),
    "Largo prom.":Number((r.largoProm||0).toFixed(3)),
    "Ancho prom.":Number((r.anchoProm||0).toFixed(3)),
    "Prof. prom.":Number((r.profProm||0).toFixed(3)),
    Registros:r.registros||0,
    Equipos:r.equiposCount||0,
    Alertas:r.errores||0,
  }));
  const discr=(discrRows||[]).map(r=>({
    Tarea:r.tarea,
    Unidad:r.unidad,
    "Largo total":Number((r.largo||0).toFixed(3)),
    "Ancho total":Number((r.ancho||0).toFixed(3)),
    "Prof. total":Number((r.profundidad||0).toFixed(3)),
    Cantidad:Number((r.cantidad||0).toFixed(3)),
    Horas:Number((r.horas||0).toFixed(2)),
    "Prod/hs":Number((r.rendimiento||0).toFixed(3)),
    Registros:r.registros||0,
    Equipos:r.equiposCount||0,
    Proyecto:r.proyectosTxt||"",
    Alertas:r.errores||0,
  }));
  const detalle=(detalleRows||[]).map(r=>({
    Fecha:r.fecha||"", Proyecto:r.proyecto||"", Máquina:r.maquina||"", Supervisor:r.supervisor||"", Tarea:r.tarea||"", Unidad:r.unidad||"",
    Horas:r.horas||0, Cantidad:r.cantidad||0, Largo:r.largo||0, Ancho:r.ancho||0, Profundidad:r.profundidad||0, Parte:r.parte||""
  }));
  const add=(name,rows)=>{
    const ws=XLSX.utils.json_to_sheet(rows.length?rows:[{}]);
    ws["!cols"]=[{wch:28},{wch:14},{wch:14},{wch:14},{wch:14},{wch:14},{wch:12},{wch:12},{wch:12},{wch:12},{wch:12},{wch:18}];
    XLSX.utils.book_append_sheet(wb,ws,name.slice(0,31));
  };
  add("Resumen tarea",resumen);
  add("Largo ancho prof",discr);
  add("Detalle registros",detalle);
  XLSX.writeFile(wb,`Discriminacion_por_tarea_${String(label||"Reporte").replace(/[^a-zA-Z0-9_-]+/g,"_")}.xlsx`);
}


// ─── Imprimir gráfico de incidencia horaria por tarea ───────────────────────
function rop05PeriodoTextoGrafico({mode,fecha,fechaD,fechaH,rangoAcumulado}){
  const MESES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const fmt=d=>{
    const x=rop05ParseYMDLocal(d);
    return `${String(x.getDate()).padStart(2,"0")}/${String(x.getMonth()+1).padStart(2,"0")}/${x.getFullYear()}`;
  };
  if(mode==="acumulado"&&rangoAcumulado)return rangoAcumulado.label;
  const base=mode==="dia"?fecha:fechaD;
  if(base){
    const d=rop05ParseYMDLocal(base);
    if(mode==="dia")return `${fmt(fecha)} (${MESES[d.getMonth()]} de ${d.getFullYear()})`;
    return `${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  }
  if(fechaD||fechaH)return `${fechaD?fmt(fechaD):"inicio"} al ${fechaH?fmt(fechaH):"fin"}`;
  const h=new Date();
  return `${MESES[h.getMonth()]} de ${h.getFullYear()}`;
}

function rop05ProyectoTextoGrafico(rows){
  const ps=Array.from(new Set((rows||[]).map(r=>String(r?.proyecto||"").trim()).filter(Boolean))).sort();
  if(ps.length===1)return ps[0];
  if(ps.length===2&&ps.includes("JOSE MARIA")&&ps.includes("FILO DEL SOL"))return "JOSE MARIA / FILO DEL SOL";
  return ps.length?ps.join(" / "):"TODOS LOS PROYECTOS";
}

function rop05PrintEscape(v){
  return String(v??"").replace(/[&<>\"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
}

function rop05SvgPieChartTop20(items,projectTitle){
  const total=items.reduce((s,it)=>s+(it.horas||0),0);
  const colors=["#4285F4","#EA4335","#FBBC04","#34A853","#FF6D01","#46BDC6","#7BAAF7","#F07B72","#FDD663","#57BB8A","#B39DDB","#F6AEA9","#A8DAB5","#FDE293","#AECBFA","#C58AF9","#81C995","#FFAB91","#9AA0A6","#B7E1CD","#DADCE0"];
  const W=1180,H=760;
  const cx=W/2,cy=390,r=205;
  let angle=-90;
  const slices=[];
  const labelsLeft=[];
  const labelsRight=[];

  const p2=(ang,rad=r)=>{
    const a=(ang-90)*Math.PI/180;
    return {x:cx+rad*Math.cos(a),y:cy+rad*Math.sin(a)};
  };
  const arc=(start,end)=>{
    const a0=p2(start),a1=p2(end);
    const large=end-start>180?1:0;
    return `M ${cx} ${cy} L ${a0.x.toFixed(2)} ${a0.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${a1.x.toFixed(2)} ${a1.y.toFixed(2)} Z`;
  };

  items.forEach((it,i)=>{
    const deg=total>0?(it.horas/total*360):0;
    const start=angle,end=angle+deg;
    const mid=start+deg/2;
    const startPoint=p2(mid,r+5);
    const side=startPoint.x>=cx?"right":"left";
    const label={...it,i,mid,startPoint,side,pct:total>0?it.horas/total*100:0};
    (side==="right"?labelsRight:labelsLeft).push(label);
    slices.push(`<path d="${arc(start,end)}" fill="${colors[i%colors.length]}" stroke="#ffffff" stroke-width="1"/>`);

    const txt=p2(mid,r*0.58);
    if(it.horas>0&&it.horas/total>=0.025){
      slices.push(`<text x="${txt.x.toFixed(1)}" y="${txt.y.toFixed(1)}" font-size="10" text-anchor="middle" dominant-baseline="middle" fill="#222">${Math.round(it.horas)}</text>`);
    }
    angle=end;
  });

  // Distribuye etiquetas por columna y evita que se pisen.
  // Esto corrige las líneas cruzadas cuando hay muchas tareas chicas.
  const distribute=(arr,side)=>{
    if(!arr.length)return "";
    arr.sort((a,b)=>a.startPoint.y-b.startPoint.y);
    const minY=82,maxY=708;
    const gap=Math.max(24,Math.min(34,(maxY-minY)/Math.max(1,arr.length-1)));

    arr.forEach((l,idx)=>{
      l.y=Math.max(minY,Math.min(maxY,l.startPoint.y));
      if(idx&&l.y<arr[idx-1].y+gap)l.y=arr[idx-1].y+gap;
    });
    for(let i=arr.length-2;i>=0;i--){
      if(arr[i].y>arr[i+1].y-gap)arr[i].y=arr[i+1].y-gap;
    }
    const overflowTop=minY-arr[0].y;
    const overflowBottom=arr[arr.length-1].y-maxY;
    if(overflowTop>0)arr.forEach(l=>l.y+=overflowTop);
    if(overflowBottom>0)arr.forEach(l=>l.y-=overflowBottom);

    const right=side==="right";
    const labelX=right?1088:92;
    const anchor=right?"end":"start";
    const elbowX=right?cx+r+46:cx-r-46;
    const lineTextX=right?labelX-12:labelX+12;

    return arr.map(l=>{
      const pct=l.pct.toFixed(1).replace(".",",");
      const full=String(l.tarea||"");
      const name=rop05PrintEscape(full.length>38?full.slice(0,36)+"…":full);
      const p=l.startPoint;
      // Línea en 3 tramos cortos: borde del gráfico → codo → etiqueta.
      // Al ordenar por Y y mantener un codo fijo por lado, se minimizan cruces visuales.
      return `<polyline points="${p.x.toFixed(1)},${p.y.toFixed(1)} ${elbowX},${l.y.toFixed(1)} ${lineTextX},${l.y.toFixed(1)}" fill="none" stroke="#9a9a9a" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="1.6" fill="#9a9a9a"/>
        <text x="${labelX}" y="${(l.y-4).toFixed(1)}" font-size="10.5" font-weight="600" text-anchor="${anchor}" fill="#333">${name}</text>
        <text x="${labelX}" y="${(l.y+10).toFixed(1)}" font-size="9.5" text-anchor="${anchor}" fill="#777">${pct}%</text>`;
    }).join("\n");
  };

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>
    <text x="${W/2}" y="34" text-anchor="middle" font-size="17" fill="#777" font-family="Arial">${rop05PrintEscape(projectTitle)}</text>
    ${slices.join("\n")}
    ${distribute(labelsLeft,"left")}
    ${distribute(labelsRight,"right")}
  </svg>`;
}

function imprimirGraficoIncidenciaROP05(rows,ctx={}){
  const base=(rows||[]).filter(r=>Number(r?.horas||0)>0);
  if(!base.length){
    appAlert("No hay horas para imprimir con los filtros seleccionados.");
    return;
  }
  const totalHoras=base.reduce((s,r)=>s+Number(r.horas||0),0);
  const map=new Map();
  base.forEach(r=>{
    const tarea=dmDisplayTarea(String(r?.tarea||"").trim()||"No se describe tarea");
    map.set(tarea,(map.get(tarea)||0)+Number(r.horas||0));
  });
  const ordenadas=Array.from(map.entries()).map(([tarea,horas])=>({tarea,horas})).sort((a,b)=>b.horas-a.horas);
  const top20=ordenadas.slice(0,20);
  const otrosHs=ordenadas.slice(20).reduce((s,r)=>s+r.horas,0);
  const chartItems=otrosHs>0?[...top20,{tarea:"Otros",horas:otrosHs}]:top20;
  const periodoTxt=rop05PeriodoTextoGrafico(ctx);
  const proyectoTxt=rop05ProyectoTextoGrafico(base);
  const texto=`En la página siguiente se observa de forma gráfica la incidencia horaria correspondiente al ${ctx.mode==="acumulado"?"período acumulado":"mes de"} ${periodoTxt} de cada tarea y el porcentaje relativo del Proyecto.`;
  const tabla=chartItems.map((it,i)=>`<tr><td>${i+1}</td><td>${rop05PrintEscape(it.tarea)}</td><td>${it.horas.toFixed(1).replace(".",",")}</td><td>${(it.horas/totalHoras*100).toFixed(1).replace(".",",")}%</td></tr>`).join("");
  const svg=rop05SvgPieChartTop20(chartItems,proyectoTxt);
  const w=window.open("","_blank","width=1200,height=800");
  if(!w){appAlert("El navegador bloqueó la ventana de impresión.");return;}
  w.document.open();
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>Gráfico incidencia horaria</title>
  <style>
    @page{size:A4 landscape;margin:12mm;}
    *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#222;margin:0;background:white;}
    .page{page-break-after:always;width:100%;min-height:185mm;padding:8mm 10mm;display:flex;flex-direction:column;justify-content:center;}
    .page:last-child{page-break-after:auto;}
    .intro{font-size:18px;line-height:1.55;max-width:900px;margin:0 auto;text-align:justify;}
    .meta{margin:22px auto 0;max-width:900px;font-size:13px;color:#555;display:grid;grid-template-columns:170px 1fr;gap:7px 14px;}
    .chartPage{padding:2mm 4mm;justify-content:flex-start;}
    .chartWrap{width:100%;height:174mm;}
    table{border-collapse:collapse;width:92%;margin:4mm auto 0;font-size:10px;}
    th,td{border:1px solid #ddd;padding:4px 6px;text-align:left;} th{background:#f4f4f4;} td:nth-child(1),td:nth-child(3),td:nth-child(4){text-align:right;}
    @media print{button{display:none}.page{break-after:page}.page:last-child{break-after:auto}}
  </style></head><body>
    <div class="page">
      <p class="intro">${rop05PrintEscape(texto)}</p>
      <div class="meta">
        <strong>Proyecto:</strong><span>${rop05PrintEscape(proyectoTxt)}</span>
        <strong>Período:</strong><span>${rop05PrintEscape(periodoTxt)}</span>
        <strong>Horas totales:</strong><span>${totalHoras.toFixed(1).replace(".",",")} hs</span>
        <strong>Criterio:</strong><span>Top 20 tareas por horas; el resto se agrupa como “Otros”.</span>
      </div>
    </div>
    <div class="page chartPage">
      <div class="chartWrap">${svg}</div>
    </div>
    <div class="page">
      <table><thead><tr><th>#</th><th>Tarea</th><th>Horas</th><th>%</th></tr></thead><tbody>${tabla}</tbody></table>
    </div>
    <script>window.onload=function(){setTimeout(function(){window.print();},250);};</script>
  </body></html>`);
  w.document.close();
}


// ─── ViewROP05 ────────────────────────────────────────────────────────────────
// ─── ViewROP05: constantes a nivel de módulo (no recreadas en cada render) ────
const ROP05_TIPOS_MAQUINA=[
  {label:"Todas",value:"todas",prefijos:[]},
  {label:"Cargadora Frontal",value:"CFN",prefijos:["CFN","PCA"]},
  {label:"Minicargadora",value:"MCA",prefijos:["MCA","MNC"]},
  {label:"Excavadora",value:"EXC",prefijos:["EXC"]},
  {label:"Topadora",value:"TOP",prefijos:["TOP"]},
  {label:"Motoniveladora",value:"MOT",prefijos:["MOT"]},
  {label:"Retropala",value:"RTP",prefijos:["RTP"]},
  {label:"Rodillo Compactador",value:"ROD",prefijos:["ROD","RPC","RCP"]},
];
const ROP05_UNIDADES_GRAFICO=[
  {label:"Metros Lineales",value:"METROS LINEALES"},
  {label:"Km Lineales",value:"KILOMETROS LINEALES"},
  {label:"Metros Cuadrados",value:"M2"},
  {label:"Metros Cúbicos",value:"M3"},
  {label:"Horas (HS)",value:"HS"},
];
const ROP05_PERIODOS_ACUMULADO=[
  {label:"Verano",value:"verano"},
  {label:"Invierno",value:"invierno"},
];
function rop05TemporadaRango(periodo,anio){
  const y=Number(anio)||new Date().getFullYear();
  const p=String(periodo||"verano").toLowerCase();
  if(p==="invierno"){
    return{periodo:"invierno",anio:String(y),desde:`${y}-05-01`,hasta:`${y}-08-31`,label:`Invierno ${y}`};
  }
  return{periodo:"verano",anio:String(y),desde:`${y}-09-01`,hasta:`${y+1}-04-30`,label:`Verano ${y}/${y+1}`};
}
function rop05ParseYMDLocal(fecha){
  if(fecha instanceof Date)return fecha;
  const m=String(fecha||"").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m)return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));
  return new Date(fecha||new Date());
}
function rop05TemporadaDeFecha(fecha){
  const d=rop05ParseYMDLocal(fecha||new Date());
  const m=d.getMonth();
  const y=d.getFullYear();
  if([4,5,6,7].includes(m))return rop05TemporadaRango("invierno",y);
  return rop05TemporadaRango("verano",m<=3?y-1:y);
}
function rop05UltimaFecha(rows){
  const fechas=(rows||[]).map(r=>String(r?.fecha||"")).filter(Boolean).sort();
  return fechas.length?fechas[fechas.length-1]:"";
}
function rop05YearOptions(rows){
  const years=new Set();
  (rows||[]).forEach(r=>{
    const f=String(r?.fecha||"");
    const y=Number(f.slice(0,4));
    if(Number.isFinite(y)&&y>2000){years.add(y);years.add(y-1);}
  });
  [2026,2027,2028].forEach(y=>years.add(y));
  return Array.from(years).sort((a,b)=>b-a).map(y=>({value:String(y),label:String(y)}));
}
function rop05Between(row,desde,hasta){
  const f=row?.fecha||"";
  if(desde&&f<desde)return false;
  if(hasta&&f>hasta)return false;
  return true;
}
// Normaliza string para comparación de unidades
const nuROP05=s=>String(s||"").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ");
const rop05UnidadKey=s=>dmNormalizeUnidad(s||"");
const rop05EsML=u=>rop05UnidadKey(u)==="ML";
const rop05EsKML=u=>rop05UnidadKey(u)==="KML";
const rop05EsM2=u=>rop05UnidadKey(u)==="M2";
const rop05EsM3=u=>rop05UnidadKey(u)==="M3";
const rop05EsHS=u=>rop05UnidadKey(u)==="HS";
const ROP05_UNIDADES_CONFIG=[
  {titulo:"Productividad Metros Lineales",key:"ML",match:rop05EsML,   color:C.green},
  {titulo:"Productividad Km Lineales",    key:"KL",match:rop05EsKML,color:C.blue},
  {titulo:"Productividad Metros Cuadrados",key:"M2",match:rop05EsM2,               color:C.teal},
  {titulo:"Productividad Metros Cúbicos", key:"M3",match:rop05EsM3,                color:C.purple},
  {titulo:"Trabajos por Hora",            key:"HS",match:rop05EsHS,                color:C.green},
];
const ROP05_CHART_COLORS=["#e8001d","#3b82f6","#10b981","#f59e0b","#8b5cf6","#ec4899","#06b6d4","#f97316","#84cc16","#6366f1"];
function rop05Top20MasOtros(items,totalHoras){
  const ordenados=[...(items||[])].sort((a,b)=>(b.value||0)-(a.value||0));
  const top20=ordenados.slice(0,20);
  const otros=ordenados.slice(20).reduce((s,r)=>s+Number(r.value||0),0);
  const base=otros>0?[...top20,{name:"Otros",value:Math.round(otros*10)/10}]:top20;
  return base.map(d=>({
    ...d,
    pct:totalHoras>0?Math.round((Number(d.value||0)/totalHoras)*1000)/10:0
  }));
}
function tipoMatchMachineROP05(tipoValue,maquina){
  if(multiIsAll(tipoValue,"todas"))return true;
  const arr=Array.isArray(tipoValue)?tipoValue:[tipoValue];
  return arr.some(v=>{
    const t=ROP05_TIPOS_MAQUINA.find(x=>x.value===v);
    return t?.prefijos?.some(p=>maquina?.startsWith(p));
  });
}
const ROP05_FK=[
  {key:"proyecto",defaultVal:"todos"},
  {key:"maquina",defaultVal:"todas"},
  {key:"supervisor",defaultVal:"todos"},
  {key:"unidad",defaultVal:"todas"},
];
const ROP05_TABLE_HEADERS=[["fecha","Fecha",90],["maquina","Máquina",110],["tipo_maquina","Tipo",90],["tarea","Tarea",220],["horas","Horas",70],["cantidad","Cantidad",80],["unidad","Unidad",80],["proyecto","Proyecto",110]];
// ─────────────────────────────────────────────────────────────────────────────

function ViewROP05({rop05,extState,setExtState,remoteTotal=0,remoteHasMore=false,onRemoteMore,onRemoteExport}){
  const{mode,setMode,fecha,setFecha,fechaD,setFechaD,fechaH,setFechaH,filtered:filteredBase05,opts,vals,set,reset,hayFiltros}=useFacetedFilters(rop05,ROP05_FK,extState,setExtState);

  // Filtro de tarea independiente — sus opciones dependen de la máquina seleccionada
  const tarea=extState?.tarea||"todas",setTarea=value=>setExtState(state=>(state?.tarea||"todas")===value?state:{...state,tarea:value});
  const tipoMaquina=extState?.tipoMaquina||"todas",setTipoMaquina=value=>setExtState(state=>(state?.tipoMaquina||"todas")===value?state:{...state,tipoMaquina:value});
  const[unidadGrafico,setUnidadGrafico]=useState("METROS LINEALES");
  const temporadaInicialROP05=useMemo(()=>rop05TemporadaDeFecha(rop05UltimaFecha(rop05)||new Date()),[rop05]);
  const[periodoAcumulado,setPeriodoAcumulado]=useState(()=>temporadaInicialROP05.periodo);
  const[anioAcumulado,setAnioAcumulado]=useState(()=>temporadaInicialROP05.anio);
  const anioAcumuladoOpts=useMemo(()=>rop05YearOptions(rop05),[rop05]);
  const rangoAcumulado=useMemo(()=>rop05TemporadaRango(periodoAcumulado,anioAcumulado),[periodoAcumulado,anioAcumulado]);

  const fechaDentroModo=useCallback((r)=>{
    const f=r.fecha||"";
    if(mode==="dia"&&fecha)return f===fecha;
    if(mode==="periodo"){
      if(fechaD&&f<fechaD)return false;
      if(fechaH&&f>fechaH)return false;
      return true;
    }
    if(mode==="acumulado")return rop05Between(r,rangoAcumulado.desde,rangoAcumulado.hasta);
    return true;
  },[mode,fecha,fechaD,fechaH,rangoAcumulado]);

  // Opciones de tarea: filtra por tipo de máquina, máquina, proyecto y fecha/acumulado
  const tareasOpts=useMemo(()=>{
    const base=rop05.filter(r=>{
      if(!fechaDentroModo(r))return false;
      if(!matchMulti(r.maquina,vals.maquina,"todas"))return false;
      if(!matchMulti(r.proyecto,vals.proyecto,"todos"))return false;
      if(!multiIsAll(tipoMaquina,"todas")&&!tipoMatchMachineROP05(tipoMaquina,r.maquina))return false;
      return true;
    });
    return uniq(base.map(r=>r.tarea).filter(Boolean));
  },[rop05,fechaDentroModo,vals.maquina,vals.proyecto,tipoMaquina]);

  // Reset tarea cuando cambia máquina, fecha o temporada
  useEffect(()=>{setTarea("todas");},[vals.maquina,mode,fecha,fechaD,fechaH,tipoMaquina,periodoAcumulado,anioAcumulado]);

  // Aplicar filtro de fecha acumulada, tipo y tarea sobre filteredBase05
  const deferredFilteredBase05=React.useDeferredValue(filteredBase05);
  const filtered=useMemo(()=>{
    let rows=mode==="acumulado"?deferredFilteredBase05.filter(r=>rop05Between(r,rangoAcumulado.desde,rangoAcumulado.hasta)):deferredFilteredBase05;
    if(!multiIsAll(tarea,"todas"))rows=rows.filter(r=>matchMulti(r.tarea,tarea,"todas"));
    if(!multiIsAll(tipoMaquina,"todas"))rows=rows.filter(r=>tipoMatchMachineROP05(tipoMaquina,r.maquina));
    return rows;
  },[deferredFilteredBase05,mode,rangoAcumulado,tarea,tipoMaquina]);

  // Base para Excel: mismos filtros operativos, pero sin limitar al rango de fecha del tablero.
  // La función de Excel aplica luego Período/Acumulado para que la descarga coincida con lo seleccionado.
  const excelBaseRows=useMemo(()=>{
    let rows=rop05.filter(r=>{
      if(!matchMulti(r.proyecto,vals.proyecto,"todos"))return false;
      if(!matchMulti(r.maquina,vals.maquina,"todas"))return false;
      if(!matchMulti(r.supervisor,vals.supervisor,"todos"))return false;
      if(!matchMulti(r.unidad,vals.unidad,"todas"))return false;
      return true;
    });
    if(!multiIsAll(tarea,"todas"))rows=rows.filter(r=>matchMulti(r.tarea,tarea,"todas"));
    if(!multiIsAll(tipoMaquina,"todas"))rows=rows.filter(r=>tipoMatchMachineROP05(tipoMaquina,r.maquina));
    return rows;
  },[rop05,vals.proyecto,vals.maquina,vals.supervisor,vals.unidad,tarea,tipoMaquina]);

  const prodCards=useMemo(()=>ROP05_UNIDADES_CONFIG.map(cfg=>{
    const rows=filtered.filter(r=>r.unidad&&cfg.match(r.unidad));
    // Para HS: el acumulado es la suma de horas (no de cantidad)
    const cantidad=cfg.key==="HS"
      ? rows.reduce((s,r)=>s+r.horas,0)
      : rows.reduce((s,r)=>s+r.cantidad,0);
    const horas=rows.reduce((s,r)=>s+r.horas,0);
    const rendimiento=horas>0?(cantidad/horas):0;
    return{...cfg,cantidad,horas,rendimiento};
  }),[filtered]);

  const prodFecha=useMemo(()=>{
    if(mode==="dia")return[];
    const base=filtered;
    // Obtener todas las fechas del período filtrado (para mantener el eje X)
    const todasFechas=[...new Set(base.map(r=>r.fecha))].sort();
    if(!todasFechas.length)return[];
    const m={};
    // Inicializar todas las fechas en 0
    todasFechas.forEach(f=>{m[f]=0;});
    base.forEach(r=>{
      const u=rop05UnidadKey(r.unidad);
      let val=0;
      if(unidadGrafico==="METROS LINEALES"&&u==="ML")val=r.cantidad;
      else if(unidadGrafico==="KILOMETROS LINEALES"&&u==="KML")val=r.cantidad;
      else if(unidadGrafico==="M2"&&u==="M2")val=r.cantidad;
      else if(unidadGrafico==="M3"&&u==="M3")val=r.cantidad;
      else if(unidadGrafico==="HS"&&u==="HS")val=r.horas;
      else return;
      m[r.fecha]=(m[r.fecha]||0)+val;
    });
    return Object.entries(m).sort().map(([fecha,cantidad])=>({fecha,cantidad}));
  },[filtered,mode,unidadGrafico]);

  const totalHoras05=useMemo(()=>filtered.reduce((s,r)=>s+r.horas,0),[filtered]);
  const totalEquipos05=useMemo(()=>new Set(filtered.map(r=>r.maquina)).size,[filtered]);
  const filteredSorted=useMemo(()=>[...filtered].sort((a,b)=>b.fecha.localeCompare(a.fecha)),[filtered]);
  const periodoAnteriorROP05=useMemo(()=>mode==="periodo"&&fechaD&&fechaH?previousComparablePeriod(fechaD,fechaH):null,[mode,fechaD,fechaH]);
  const filteredAnteriorROP05=useMemo(()=>periodoAnteriorROP05?excelBaseRows.filter(r=>r.fecha>=periodoAnteriorROP05.from&&r.fecha<=periodoAnteriorROP05.to):[],[excelBaseRows,periodoAnteriorROP05]);

  // ── Datos para gráficos de PERÍODO (antes eran IIFEs en el JSX) ────────────
  const periodoChartData=useMemo(()=>{
    if((mode!=="periodo"&&mode!=="acumulado")||!filtered.length)return null;
    const tareaMap={};
    filtered.forEach(r=>{
      const tarea=dmDisplayTarea(String(r.tarea||"").trim()||"No se describe tarea");
      const u=nuROP05(r.unidad);
      if(!tareaMap[tarea])tareaMap[tarea]={horas:0,horasML:0,horasKL:0,horasM2:0,horasM3:0,ml:0,kl:0,m2:0,m3:0};
      tareaMap[tarea].horas+=Number(r.horas||0);
      const cant=Number(r.cantidad||0);
      if(rop05EsML(u)){tareaMap[tarea].ml+=cant;tareaMap[tarea].horasML+=Number(r.horas||0);}
      else if(rop05EsKML(u)){tareaMap[tarea].kl+=cant;tareaMap[tarea].horasKL+=Number(r.horas||0);}
      else if(rop05EsM2(u)){tareaMap[tarea].m2+=cant;tareaMap[tarea].horasM2+=Number(r.horas||0);}
      else if(rop05EsM3(u)){tareaMap[tarea].m3+=cant;tareaMap[tarea].horasM3+=Number(r.horas||0);}
      // Las tareas con unidad HS/HORAS también quedan incluidas en horas de incidencia.
      // No tienen rendimiento físico asociado, por eso sus ML/M2/M3 quedan en 0.
    });
    const totalHs=Object.values(tareaMap).reduce((s,v)=>s+v.horas,0);
    const pieDataCompleta=Object.entries(tareaMap).sort((a,b)=>b[1].horas-a[1].horas).map(([name,v])=>({
      name,
      value:Math.round(v.horas*10)/10,
      pct:totalHs>0?Math.round(v.horas/totalHs*1000)/10:0,
      mlHs:(v.horasML+v.horasKL)>0&&(v.ml+v.kl*1000)>0?Math.round(((v.ml+v.kl*1000)/(v.horasML+v.horasKL))*10)/10:0,
      klHs:0,
      m2Hs:v.horasM2>0&&v.m2>0?Math.round(v.m2/v.horasM2*10)/10:0,
      m3Hs:v.horasM3>0&&v.m3>0?Math.round(v.m3/v.horasM3*10)/10:0,
    }));
    const pieData=rop05Top20MasOtros(pieDataCompleta,totalHs);
    // % acumulado precalculado en una sola pasada (evita O(n²))
    let running=0;
    const pieDataCon80=[];
    for(const d of pieDataCompleta){
      if(running>=80)break;
      running+=d.pct;
      pieDataCon80.push({...d,acumLocal:Math.min(running,100)});
    }
    const maqMap={};
    filtered.forEach(r=>{if(r.maquina)maqMap[r.maquina]=(maqMap[r.maquina]||0)+Number(r.horas||0);});
    const barData=Object.entries(maqMap).sort((a,b)=>b[1]-a[1]).map(([maquina,horas])=>({maquina,horas}));
    return{pieData,pieDataCon80,barData};
  },[filtered,mode]);

  // ── Datos para gráficos de DÍA ─────────────────────────────────────────────
  const diaChartData=useMemo(()=>{
    if(mode!=="dia"||!fecha||!filtered.length)return null;
    const tareaMap={};
    filtered.forEach(r=>{
      const tarea=dmDisplayTarea(String(r.tarea||"").trim()||"No se describe tarea");
      tareaMap[tarea]=(tareaMap[tarea]||0)+Number(r.horas||0);
    });
    const totalHs=Object.values(tareaMap).reduce((s,v)=>s+v,0);
    const pieDataCompleta=Object.entries(tareaMap).sort((a,b)=>b[1]-a[1]).map(([name,value])=>({name,value:Math.round(value*10)/10,pct:totalHs>0?Math.round(value/totalHs*1000)/10:0}));
    const pieData=rop05Top20MasOtros(pieDataCompleta,totalHs);
    const maqMap={};
    filtered.forEach(r=>{if(r.maquina)maqMap[r.maquina]=(maqMap[r.maquina]||0)+Number(r.horas||0);});
    const barData=Object.entries(maqMap).sort((a,b)=>b[1]-a[1]).map(([maquina,horas])=>({maquina,horas}));
    return{pieData,barData};
  },[filtered,mode,fecha]);
  // ───────────────────────────────────────────────────────────────────────────

  const [rop05TipRow,setRop05TipRow]=React.useState(null);
  const [rop05PinnedRow,setRop05PinnedRow]=React.useState(null);
  const ROP05_PAGE_SIZE=250;
  const ROP05_INITIAL_LIMIT=hayFiltros?500:250;
  const [rop05VisibleLimit,setRop05VisibleLimit]=React.useState(ROP05_INITIAL_LIMIT);

  const rop05TipPosRef=useRef({x:16,y:16});
  const rop05TipElRef=useRef(null);
  const rop05RafRef=useRef(null);

  const rop05MoveTip=useCallback((x,y)=>{
    rop05TipPosRef.current={x,y};
    if(rop05RafRef.current)return;
    rop05RafRef.current=requestAnimationFrame(()=>{
      rop05RafRef.current=null;
      const el=rop05TipElRef.current;
      if(!el)return;
      const W=280,H=218;
      const left=Math.max(12,Math.min((rop05TipPosRef.current.x||0)+8,window.innerWidth-W-12));
      const top=Math.max(12,Math.min((rop05TipPosRef.current.y||0)+8,window.innerHeight-H-12));
      el.style.transform=`translate3d(${left}px,${top}px,0)`;
    });
  },[]);

  const rop05ActiveRow=rop05PinnedRow??rop05TipRow;
  const rop05RowsVisible=useMemo(()=>filteredSorted.slice(0,rop05VisibleLimit),[filteredSorted,rop05VisibleLimit]);
  useEffect(()=>{
    setRop05TipRow(null);
    setRop05PinnedRow(null);
    setRop05VisibleLimit(ROP05_INITIAL_LIMIT);
  },[mode,fecha,fechaD,fechaH,vals.proyecto,vals.maquina,vals.supervisor,vals.unidad,tarea,tipoMaquina,periodoAcumulado,anioAcumulado,ROP05_INITIAL_LIMIT]);

  useEffect(()=>{
    const onMove=e=>{
      if(rop05TipRow!==null&&rop05PinnedRow===null)rop05MoveTip(e.clientX,e.clientY);
    };
    window.addEventListener("mousemove",onMove,{passive:true});
    return()=>{
      window.removeEventListener("mousemove",onMove);
      if(rop05RafRef.current)cancelAnimationFrame(rop05RafRef.current);
      rop05RafRef.current=null;
    };
  },[rop05TipRow,rop05PinnedRow,rop05MoveTip]);

  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:14}}>
      <Card>
        <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
            <TabBtn active={mode==="dia"} onClick={()=>setMode("dia")}>Por día</TabBtn>
            <TabBtn active={mode==="periodo"} onClick={()=>setMode("periodo")}>Por período</TabBtn>
            <TabBtn active={mode==="acumulado"} onClick={()=>setMode("acumulado")}>Acumulado</TabBtn>
            <button onClick={async()=>{const base=onRemoteExport?await onRemoteExport():excelBaseRows;const rows=base.filter(r=>matchMulti(r.unidad,vals.unidad,"todas")).filter(r=>multiIsAll(tarea,"todas")||matchMulti(r.tarea,tarea,"todas")).filter(r=>multiIsAll(tipoMaquina,"todas")||tipoMatchMachineROP05(tipoMaquina,r.maquina));generarExcelProductividad(rows,fechaD,fechaH,mode,fecha,{periodoAcumulado,anioAcumulado});}} style={{marginLeft:8,display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:7,border:`1px solid ${C.accent}`,background:C.accentDim,color:C.accent,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"Inter",letterSpacing:".04em"}}>
              📊 Generar Reporte
            </button>
            <button onClick={()=>imprimirGraficoIncidenciaROP05(filtered,{mode,fecha,fechaD,fechaH,rangoAcumulado})} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:7,border:`1px solid ${C.yellow}66`,background:C.yellowDim,color:C.yellow,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"Inter",letterSpacing:".04em"}}>
              🖨️ Imprimir gráfico
            </button>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"flex-end",paddingBottom:2}}>
            {mode==="dia"?(
              <DateIn label="Fecha" value={fecha} onChange={setFecha}/>
            ):mode==="acumulado"?(
              <>
                <Sel label="Período" value={periodoAcumulado} onChange={setPeriodoAcumulado} options={ROP05_PERIODOS_ACUMULADO}/>
                <Sel label="Año" value={anioAcumulado} onChange={setAnioAcumulado} options={anioAcumuladoOpts}/>
                <DateIn label="Desde" value={rangoAcumulado.desde} onChange={()=>{}} disabled/>
                <DateIn label="Hasta" value={rangoAcumulado.hasta} onChange={()=>{}} disabled/>
              </>
            ):(
              <>
                <PeriodMonthYear fechaD={fechaD} fechaH={fechaH} setFechaD={setFechaD} setFechaH={setFechaH}/>
                <DateIn label="Desde" value={fechaD} onChange={setFechaD} max={fechaH||undefined}/>
                <DateIn label="Hasta" value={fechaH} onChange={setFechaH} min={fechaD||undefined} warn={fechaH&&fechaD&&fechaH<fechaD?"≥ Desde":null}/>
              </>
            )}
            <MultiSel label="Proyecto" value={vals.proyecto} onChange={v=>set("proyecto",v)} options={[{value:"todos",label:"Todos"},...opts.proyecto.map(p=>({value:p,label:p}))]}/>
            <MultiSel label="Tipo de Máquina" value={tipoMaquina} onChange={v=>{setTipoMaquina(v);set("maquina","todas");}} options={ROP05_TIPOS_MAQUINA.map(t=>({value:t.value,label:t.label}))}/>
            <MultiSel label="Máquina" value={vals.maquina} onChange={v=>set("maquina",v)} options={[{value:"todas",label:"Todas"},...opts.maquina.filter(m=>multiIsAll(tipoMaquina,"todas")||tipoMatchMachineROP05(tipoMaquina,m)).map(m=>({value:m,label:m}))]}/>
            <MultiSel label="Supervisor" value={vals.supervisor} onChange={v=>set("supervisor",v)} options={[{value:"todos",label:"Todos"},...opts.supervisor.map(s=>({value:s,label:s}))]}/>
            <MultiSel label="Tarea" value={tarea} onChange={setTarea} options={[{value:"todas",label:"Todas"},...tareasOpts.map(t=>({value:t,label:t.length>40?t.slice(0,38)+"…":t}))]}/>
            <MultiSel label="Unidad" value={vals.unidad} onChange={v=>set("unidad",v)} options={[{value:"todas",label:"Todas"},...opts.unidad.map(u=>({value:u,label:u}))]}/>
            <button onClick={reset} style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,border:`1px solid ${C.red}44`,background:C.redDim,color:C.red,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"Inter",opacity:hayFiltros?1:0.3,pointerEvents:hayFiltros?"auto":"none"}}>
              <Icon name="close" size={11} color={C.red}/>Limpiar filtros
            </button>
          </div>
        </div>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
        <StatCard icon="prod" label="Registros" value={filtered.length} color={C.blue} small/>
        <StatCard icon="hours" label="Horas" value={fmtNum(totalHoras05)} color={C.yellow} small/>
        <StatCard icon="equip" label="Equipos" value={totalEquipos05} color={C.purple} small/>
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
      {periodoAnteriorROP05&&<ComparisonStrip title="Comparar períodos — Productividad" currentLabel={`${fechaD} → ${fechaH}`} previousLabel={`${periodoAnteriorROP05.from} → ${periodoAnteriorROP05.to}`} metrics={[
        {label:"Registros",current:filtered.length,previous:filteredAnteriorROP05.length},
        {label:"Horas",current:totalHoras05,previous:filteredAnteriorROP05.reduce((s,r)=>s+Number(r.horas||0),0)},
        {label:"Equipos",current:totalEquipos05,previous:new Set(filteredAnteriorROP05.map(r=>r.maquina)).size}
      ]}/>}
      {multiIsAll(vals.proyecto,"todos")&&(()=>{const jm=filtered.filter(r=>String(r.proyecto||"").toUpperCase().includes("JOSE"));const fs=filtered.filter(r=>String(r.proyecto||"").toUpperCase().includes("FILO"));if(!jm.length&&!fs.length)return null;return <ComparisonStrip title="Comparar proyectos — Productividad" currentLabel="José María" previousLabel="Filo del Sol" metrics={[{label:"Registros",current:jm.length,previous:fs.length},{label:"Horas",current:jm.reduce((a,r)=>a+(Number(r.horas)||0),0),previous:fs.reduce((a,r)=>a+(Number(r.horas)||0),0)},{label:"Equipos",current:new Set(jm.map(r=>r.maquina)).size,previous:new Set(fs.map(r=>r.maquina)).size}]}/>})()}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12}}>
        {prodCards.map(({titulo,color,cantidad,rendimiento})=>(
          <Card key={titulo} style={{borderColor:color+"44"}}>
            <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:6}}>
              <div style={{fontSize:10,color:color,fontWeight:700,letterSpacing:".04em",textTransform:"uppercase",lineHeight:1.3}}>{titulo}</div>
              <div style={{fontFamily:"Inter",fontSize:26,fontWeight:800,color:"#ffffff",lineHeight:1}}>{cantidad>0?fmtNum(cantidad):"—"}</div>
              <div style={{fontSize:10,color:C.textMuted}}>total acumulado</div>
              <div style={{borderTop:`1px solid ${C.border}`,paddingTop:6,display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                <span style={{fontSize:10,color:C.textMuted}}>Productividad</span>
                <span style={{fontFamily:"Inter",fontSize:14,fontWeight:800,color:color}}>{rendimiento>0?fmtNum(rendimiento):"—"}<span style={{fontSize:9,fontWeight:400,color:C.textMuted,marginLeft:2}}>/hs</span></span>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {(mode==="periodo"||mode==="acumulado")&&filtered.length>0&&(
        <Card title="Producción por Fecha" action={<Sel label="" value={unidadGrafico} onChange={setUnidadGrafico} options={ROP05_UNIDADES_GRAFICO.map(u=>({value:u.value,label:u.label}))}/>}>
          <div style={{padding:"10px 6px"}}>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={prodFecha} margin={{left:0,right:10}}>
                <defs><linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.blue} stopOpacity={.3}/><stop offset="95%" stopColor={C.blue} stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                <XAxis dataKey="fecha" tick={{fill:C.textMuted,fontSize:9}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:C.textMuted,fontSize:9}} axisLine={false} tickLine={false} width={40}/>
                <Tooltip content={({active,payload})=>{
                  if(!active||!payload?.length)return null;
                  return(<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",fontSize:12}}>
                    <div style={{color:C.textSub}}>{payload[0].payload.fecha}</div>
                    <div style={{color:C.blue,fontWeight:700}}>{fmtNum(payload[0].value)}</div>
                  </div>);
                }}/>
                <Area type="monotone" dataKey="cantidad" stroke={C.blue} fill="url(#g2)" strokeWidth={2} dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
      {periodoChartData&&(()=>{
        const{pieData,pieDataCon80,barData}=periodoChartData;
        return(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"2fr 3fr",gap:14}}>
            <Card title="Distribución de Horas por Tarea">
              <div style={{padding:"16px",display:"flex",gap:20,alignItems:"center"}}>
                <div style={{flexShrink:0}}>
                  <PieChart width={220} height={220}>
                    <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={100} innerRadius={44}>
                      {pieData.map((_,i)=><Cell key={i} fill={ROP05_CHART_COLORS[i%ROP05_CHART_COLORS.length]}/>)}
                    </Pie>
                    <Tooltip content={({active,payload})=>{
                      if(!active||!payload?.length)return null;
                      const d=payload[0].payload;
                      return(<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",fontSize:12}}>
                        <div style={{color:C.text,fontWeight:600,marginBottom:4}}>{d.name}</div>
                        <div style={{color:C.accent}}>{fmtNum(d.value)} hs — {d.pct}%</div>
                      </div>);
                    }}/>
                  </PieChart>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:8,flex:1,overflow:"hidden"}}>
                  {pieData.map((d,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:12,height:12,borderRadius:"50%",background:ROP05_CHART_COLORS[i%ROP05_CHART_COLORS.length],flexShrink:0}}/>
                      <span style={{fontSize:13,color:C.textSub,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.name}</span>
                      <span style={{fontSize:13,fontWeight:700,color:C.text,flexShrink:0}}>{d.pct}%</span>
                      <span style={{fontSize:12,color:C.textMuted,flexShrink:0,minWidth:36,textAlign:"right"}}>{fmtNum(d.value)}hs</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
            <Card title="Horas por Equipo">
              <div style={{padding:"8px 6px"}}>
                <ResponsiveContainer width="100%" height={Math.max(160,barData.length*26+30)}>
                  <BarChart data={barData} layout="vertical" margin={{left:8,right:30}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false}/>
                    <XAxis type="number" tick={{fill:C.textMuted,fontSize:11}} axisLine={false} tickLine={false} unit="hs"/>
                    <YAxis type="category" dataKey="maquina" tick={{fill:C.textSub,fontSize:11}} width={90} axisLine={false} tickLine={false}/>
                    <Tooltip content={({active,payload})=>{
                      if(!active||!payload?.length)return null;
                      return(<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",fontSize:13}}>
                        <div style={{color:C.purple,fontWeight:700}}>{payload[0].payload.maquina}</div>
                        <div style={{color:C.accent}}>{fmtNum(payload[0].value)} hs</div>
                      </div>);
                    }}/>
                    <Bar dataKey="horas" fill={C.accent} radius={[0,4,4,0]} barSize={16}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
          <Card title="Tareas principales — 80% de las horas">
            <div className="dm-table-scroll" style={{overflowX:"auto",overflowY:"auto",maxHeight:520,scrollbarGutter:"stable"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:14}}>
                <thead>
                  <tr style={{background:C.surface}}>
                    {["Tarea","Horas","%","% Acum.","ML/Hs","M2/Hs","M3/Hs"].map((h,i)=>(
                      <th key={i} style={{padding:"10px 14px",textAlign:i===0?"left":"center",color:C.textSub,fontWeight:600,fontSize:12,letterSpacing:".05em",textTransform:"uppercase",borderBottom:`1px solid ${C.border}`}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pieDataCon80.map((d,i)=>(
                    <tr key={i} style={{background:i%2===0?"transparent":C.surface+"55"}}>
                      <td style={{padding:"10px 14px",borderBottom:`1px solid ${C.border}18`,color:C.text,fontSize:14}}>{d.name}</td>
                      <td style={{padding:"10px 14px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:C.accent,fontWeight:600,fontSize:14}}>{fmtNum(d.value)}</td>
                      <td style={{padding:"10px 14px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:C.text,fontWeight:700,fontSize:14}}>{d.pct}%</td>
                      <td style={{padding:"10px 14px",textAlign:"center",borderBottom:`1px solid ${C.border}18`}}>
                        <span style={{display:"inline-block",padding:"4px 14px",borderRadius:20,fontSize:13,fontWeight:700,background:d.acumLocal>=80?C.green+"22":C.yellow+"22",color:d.acumLocal>=80?C.green:C.yellow,border:`1px solid ${d.acumLocal>=80?C.green:C.yellow}44`}}>{d.acumLocal.toFixed(1)}%</span>
                      </td>
                      <td style={{padding:"10px 14px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:d.mlHs>0?C.blue:C.textMuted,fontWeight:d.mlHs>0?700:400,fontSize:14}}>{d.mlHs>0?fmtNum(d.mlHs):"—"}</td>
                      <td style={{padding:"10px 14px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:d.m2Hs>0?C.teal:C.textMuted,fontWeight:d.m2Hs>0?700:400,fontSize:14}}>{d.m2Hs>0?fmtNum(d.m2Hs):"—"}</td>
                      <td style={{padding:"10px 14px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:d.m3Hs>0?C.purple:C.textMuted,fontWeight:d.m3Hs>0?700:400,fontSize:14}}>{d.m3Hs>0?fmtNum(d.m3Hs):"—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
                    </div>
        );
      })()}
      {diaChartData&&(()=>{
        const{pieData,barData}=diaChartData;
        return(
          <div style={{display:"grid",gridTemplateColumns:"2fr 3fr",gap:14}}>
            <Card title={`Distribución de Horas por Tarea — ${fecha}`}>
              <div style={{padding:"16px",display:"flex",gap:20,alignItems:"center"}}>
                <div style={{flexShrink:0}}>
                  <PieChart width={220} height={220}>
                    <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={100} innerRadius={44}>
                      {pieData.map((_,i)=><Cell key={i} fill={ROP05_CHART_COLORS[i%ROP05_CHART_COLORS.length]}/>)}
                    </Pie>
                    <Tooltip content={({active,payload})=>{
                      if(!active||!payload?.length)return null;
                      const d=payload[0].payload;
                      return(<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",fontSize:12}}>
                        <div style={{color:C.text,fontWeight:600,marginBottom:4}}>{d.name}</div>
                        <div style={{color:C.accent}}>{fmtNum(d.value)} hs — {d.pct}%</div>
                      </div>);
                    }}/>
                  </PieChart>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:7,flex:1,overflow:"hidden"}}>
                  {pieData.map((d,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:11,height:11,borderRadius:"50%",background:ROP05_CHART_COLORS[i%ROP05_CHART_COLORS.length],flexShrink:0}}/>
                      <span style={{fontSize:12,color:C.textSub,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.name}</span>
                      <span style={{fontSize:12,fontWeight:700,color:C.text,flexShrink:0}}>{d.pct}%</span>
                      <span style={{fontSize:11,color:C.textMuted,flexShrink:0,minWidth:32,textAlign:"right"}}>{fmtNum(d.value)}hs</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
            <Card title={`Horas por Equipo — ${fecha}`}>
              <div style={{padding:"8px 6px"}}>
                <ResponsiveContainer width="100%" height={Math.max(160,barData.length*26+30)}>
                  <BarChart data={barData} layout="vertical" margin={{left:8,right:30}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false}/>
                    <XAxis type="number" tick={{fill:C.textMuted,fontSize:9}} axisLine={false} tickLine={false} unit="hs"/>
                    <YAxis type="category" dataKey="maquina" tick={{fill:C.textSub,fontSize:9}} width={80} axisLine={false} tickLine={false}/>
                    <Tooltip content={({active,payload})=>{
                      if(!active||!payload?.length)return null;
                      return(<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",fontSize:12}}>
                        <div style={{color:C.purple,fontWeight:700}}>{payload[0].payload.maquina}</div>
                        <div style={{color:C.accent}}>{fmtNum(payload[0].value)} hs</div>
                      </div>);
                    }}/>
                    <Bar dataKey="horas" fill={C.accent} radius={[0,4,4,0]} barSize={14}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        );
      })()}
      <Card title={`Registros (${filtered.length})`}>
        <div style={{overflowX:"auto",overflowY:"auto",maxHeight:400,position:"relative"}}>
          {filteredSorted.length===0?(
            <div style={{padding:28,textAlign:"center",color:C.textMuted,fontSize:12}}>Sin registros con los filtros seleccionados</div>
          ):(
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,tableLayout:"fixed",minWidth:700}}>
              <thead>
                <tr>
                  {ROP05_TABLE_HEADERS.map(([k,lbl,w])=>(
                    <th key={k} style={{padding:"9px 10px",textAlign:k==="tarea"?"left":"center",fontWeight:600,fontSize:10,letterSpacing:".06em",textTransform:"uppercase",color:C.textSub,borderBottom:`2px solid ${C.border}`,position:"sticky",top:0,background:C.surface,zIndex:2,width:w,minWidth:w}}>
                      {lbl}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rop05RowsVisible.map((r,i)=>{
                  const isActive=rop05ActiveRow===i;
                  const isPinned=rop05PinnedRow===i;
                  return(
                    <tr key={i}
                      style={{background:isActive?"rgba(232,0,29,0.15)":i%2===0?"transparent":C.surface+"33",cursor:"pointer",transition:"background .1s",borderTop:isPinned?`1px solid ${C.red}44`:undefined}}
                      onMouseEnter={e=>{
                        if(rop05PinnedRow!==null)return;
                        rop05MoveTip(e.clientX,e.clientY);
                        setRop05TipRow(i);
                      }}
                      onMouseLeave={()=>{if(rop05PinnedRow===null)setRop05TipRow(null);}}
                      onClick={e=>{
                        e.stopPropagation();
                        rop05MoveTip(e.clientX,e.clientY);
                        if(rop05PinnedRow===i){
                          setRop05PinnedRow(null);
                          setRop05TipRow(null);
                        }else{
                          setRop05PinnedRow(i);
                          setRop05TipRow(i);
                        }
                      }}
                    >
                      <td style={{padding:"8px 10px",textAlign:"center",color:C.textSub,borderBottom:`1px solid ${C.border}18`}}>{fmtFecha(r.fecha)}</td>
                      <td style={{padding:"8px 10px",textAlign:"center",borderBottom:`1px solid ${C.border}18`}}><Badge color={C.purple}>{r.maquina||"—"}</Badge></td>
                      <td style={{padding:"8px 10px",textAlign:"center",borderBottom:`1px solid ${C.border}18`}}><Badge color={C.textSub}>{r.tipo_maquina||r._tipo||"—"}</Badge></td>
                      <td style={{padding:"8px 10px",textAlign:"left",borderBottom:`1px solid ${C.border}18`,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:220,color:C.text}} title={r.tarea}>{r.tarea||"—"}</td>
                      <td style={{padding:"8px 10px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:C.accent,fontWeight:600}}>{fmtNum(r.horas)}</td>
                      <td style={{padding:"8px 10px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:C.blue,fontWeight:600}}>{fmtNum(r.cantidad)}</td>
                      <td style={{padding:"8px 10px",textAlign:"center",borderBottom:`1px solid ${C.border}18`}}><Badge color={C.teal}>{r.unidad||"—"}</Badge></td>
                      <td style={{padding:"8px 10px",textAlign:"center",borderBottom:`1px solid ${C.border}18`}}><Badge color={proyColor(r.proyecto)}>{r.proyecto||"—"}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {(filteredSorted.length>rop05RowsVisible.length||remoteHasMore)&&(
            <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:10,padding:"12px",borderTop:`1px solid ${C.border}22`,background:"rgba(0,0,0,.20)"}}>
              <span style={{fontSize:12,color:C.textMuted}}>
                Mostrando {rop05RowsVisible.length} de {remoteTotal||filteredSorted.length} registros
              </span>
              <button
                onClick={()=>remoteHasMore?onRemoteMore?.().then(()=>setRop05VisibleLimit(v=>v+ROP05_PAGE_SIZE)):setRop05VisibleLimit(v=>Math.min(v+ROP05_PAGE_SIZE,filteredSorted.length))}
                style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,padding:"7px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}
              >
                Mostrar 250 más
              </button>
            </div>
          )}
        </div>
        {/* Tooltip flotante de Productividad */}
        {rop05ActiveRow!==null&&filteredSorted[rop05ActiveRow]&&ReactDOM.createPortal((()=>{
          const r=filteredSorted[rop05ActiveRow];
          const isPinned=rop05PinnedRow!==null;
          const W=280;
          return(
            <div
              ref={rop05TipElRef}
              onClick={e=>{e.stopPropagation();if(isPinned){setRop05PinnedRow(null);setRop05TipRow(null);}}}
              style={{position:"fixed",left:0,top:0,zIndex:99999,width:W,background:C.card,border:`1px solid ${isPinned?C.red+"88":C.border}`,borderRadius:10,padding:"12px 14px",boxShadow:"0 8px 32px rgba(0,0,0,.55)",pointerEvents:isPinned?"auto":"none",transform:"translate3d(16px,16px,0)",willChange:"transform"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span style={{fontSize:11,fontWeight:800,color:C.text,textTransform:"uppercase",letterSpacing:".04em"}}>Detalle del registro</span>
                {isPinned&&<span style={{fontSize:10,color:C.red,fontWeight:700,cursor:"pointer"}}>✕ soltar</span>}
              </div>
              {[
                ["Equipo", r.maquina||"—", C.purple],
                ["Proyecto", r.proyecto||"—", proyColor(r.proyecto)],
                ["Día", fmtFecha(r.fecha), C.textSub],
                ["Supervisor", r.supervisor||"—", C.textSub],
                ["Parte", r.parte||"—", C.textSub],
                ["Tarea", r.tarea||"—", C.text],
                ["Horas", r.horas!=null?fmtNum(r.horas)+" h":"—", C.accent],
                ["Cantidad", r.cantidad!=null?fmtNum(r.cantidad)+" "+(r.unidad||""):"—", C.blue],
              ].map(([lbl,val,col])=>(
                <div key={lbl} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:6,marginBottom:5}}>
                  <span style={{fontSize:11,color:C.textMuted,flexShrink:0}}>{lbl}</span>
                  <span style={{fontSize:11,color:col,fontWeight:700,textAlign:"right",maxWidth:175,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={String(val)}>{val}</span>
                </div>
              ))}
              <div style={{fontSize:10,color:C.textMuted,marginTop:6,textAlign:"center"}}>
                {isPinned?"Tooltip fijado · click para soltar":"Hover · click en la fila para fijar"}
              </div>
            </div>
          );
        })(),document.body)}
      </Card>
    </div>
  );
}


function ViewROP05Discriminacion({rop05,extState,setExtState}){
  const rop05DesdeJulio=useMemo(()=>rop05,[rop05]);
  const{mode,setMode,fecha,setFecha,fechaD,setFechaD,fechaH,setFechaH,filtered:filteredBase05,opts,vals,set,reset,hayFiltros}=useFacetedFilters(rop05DesdeJulio,ROP05_FK,extState,setExtState);
  const[tarea,setTarea]=useState("todas");
  const[tipoMaquina,setTipoMaquina]=useState("todas");
  const temporadaInicialROP05=useMemo(()=>rop05TemporadaDeFecha(rop05UltimaFecha(rop05DesdeJulio)||new Date()),[rop05DesdeJulio]);
  const[periodoAcumulado,setPeriodoAcumulado]=useState(()=>temporadaInicialROP05.periodo);
  const[anioAcumulado,setAnioAcumulado]=useState(()=>temporadaInicialROP05.anio);
  const anioAcumuladoOpts=useMemo(()=>rop05YearOptions(rop05DesdeJulio),[rop05DesdeJulio]);
  const rangoAcumulado=useMemo(()=>rop05TemporadaRango(periodoAcumulado,anioAcumulado),[periodoAcumulado,anioAcumulado]);
  const[detalleKey,setDetalleKey]=useState(null);

  const n=v=>{const x=Number(String(v??"").replace(",","."));return Number.isFinite(x)?x:0;};
  const unidadNorm=u=>String(u||"").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim();
  const unidadShort=u=>{
    const s=unidadNorm(u);
    if(s.includes("M3")||s.includes("M³"))return "M³";
    if(s.includes("M2")||s.includes("M²"))return "M²";
    if(s.includes("KILOMETRO")||s==="KML"||s==="KM LINEALES"||s==="KM LINEAL")return "KML";
    if(s.includes("LINEAL")||s==="ML"||s==="M")return "ML";
    if(s.includes("HS")||s.includes("HORA"))return "HS";
    return String(u||"—").trim()||"—";
  };
  const formatCantidad=(v,u)=>`${fmtNum(v)} ${unidadShort(u)}`;
  const formatRend=(v,u)=>v?`${fmtNum(v)} ${unidadShort(u)}/h`:"—";
  const textoNorm=v=>String(v||"")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^A-Z0-9]+/gi," ")
    .replace(/\s+/g," ")
    .trim()
    .toUpperCase();
  const esCargaDescargaCamion=r=>{
    const t=textoNorm(r?.tarea);
    return t.includes("CARGA")&&t.includes("DESCARGA")&&t.includes("CAMION");
  };
  const dimError=r=>{
    const u=unidadNorm(r.unidad), l=n(r.largo), a=n(r.ancho), p=n(r.profundidad);
    if(u.includes("M3")||u.includes("M³")){
      // Excepción operativa: esta tarea informa directamente la cantidad en m³.
      // No corresponde exigir largo, ancho ni profundidad.
      if(esCargaDescargaCamion(r))return "";
      if(l<=0||a<=0||p<=0)return "M³ sin largo, ancho o profundidad";
    }
    if(u.includes("M2")||u.includes("M²")){
      if(l<=0||a<=0)return "M² sin largo o ancho";
    }
    if(u.includes("ML")||u.includes("LINEAL")||u==="M"){
      if(l<=0)return "Metro lineal sin largo";
    }
    if((!r.tarea||String(r.tarea).trim()==="")&&(l>0||a>0||p>0))return "Dimensiones sin tarea";
    return "";
  };

  const fechaDentroModo=useCallback((r)=>{
    const f=r.fecha||"";
    if(mode==="dia"&&fecha)return f===fecha;
    if(mode==="periodo"){
      if(fechaD&&f<fechaD)return false;
      if(fechaH&&f>fechaH)return false;
      return true;
    }
    if(mode==="acumulado")return rop05Between(r,rangoAcumulado.desde,rangoAcumulado.hasta);
    return true;
  },[mode,fecha,fechaD,fechaH,rangoAcumulado]);

  const tareasOpts=useMemo(()=>{
    const base=rop05DesdeJulio.filter(r=>{
      if(!fechaDentroModo(r))return false;
      if(!matchMulti(r.maquina,vals.maquina,"todas"))return false;
      if(!matchMulti(r.proyecto,vals.proyecto,"todos"))return false;
      if(!multiIsAll(tipoMaquina,"todas")&&!tipoMatchMachineROP05(tipoMaquina,r.maquina))return false;
      return true;
    });
    return uniq(base.map(r=>r.tarea).filter(Boolean));
  },[rop05DesdeJulio,fechaDentroModo,vals.maquina,vals.proyecto,tipoMaquina]);

  useEffect(()=>{setTarea("todas");setDetalleKey(null);},[vals.maquina,mode,fecha,fechaD,fechaH,tipoMaquina,periodoAcumulado,anioAcumulado]);

  const filtered=useMemo(()=>{
    let rows=mode==="acumulado"?filteredBase05.filter(r=>rop05Between(r,rangoAcumulado.desde,rangoAcumulado.hasta)):filteredBase05;
    if(!multiIsAll(tarea,"todas"))rows=rows.filter(r=>matchMulti(r.tarea,tarea,"todas"));
    if(!multiIsAll(tipoMaquina,"todas"))rows=rows.filter(r=>tipoMatchMachineROP05(tipoMaquina,r.maquina));
    return rows;
  },[filteredBase05,mode,rangoAcumulado,tarea,tipoMaquina]);

  // Cuando una misma tarea aparece cargada en ML y KML, se consolida en una sola fila KML.
  // La conversión usada es 1 KML = 1.000 ML. Las tareas que solo existen en ML conservan su unidad original.
  const tareasMixtasLineales=useMemo(()=>{
    const unidadesPorTarea=new Map();
    filtered.forEach(r=>{
      const tarea=r.tarea||"—";
      const unidad=unidadShort(r.unidad);
      if(unidad!=="ML"&&unidad!=="KML")return;
      if(!unidadesPorTarea.has(tarea))unidadesPorTarea.set(tarea,new Set());
      unidadesPorTarea.get(tarea).add(unidad);
    });
    return new Set(Array.from(unidadesPorTarea.entries())
      .filter(([,unidades])=>unidades.has("ML")&&unidades.has("KML"))
      .map(([tarea])=>tarea));
  },[filtered]);

  const normalizarLineaParaAgrupacion=useCallback(r=>{
    const tarea=r.tarea||"—";
    const unidadOriginal=unidadShort(r.unidad);
    const consolidar=tareasMixtasLineales.has(tarea)&&(unidadOriginal==="ML"||unidadOriginal==="KML");
    const factor=consolidar&&unidadOriginal==="ML"?1/1000:1;
    return {
      tarea,
      unidad:consolidar?"KML":unidadOriginal,
      cantidad:n(r.cantidad)*factor,
      largo:n(r.largo)*factor,
      ancho:n(r.ancho),
      profundidad:n(r.profundidad),
      horas:n(r.horas),
    };
  },[tareasMixtasLineales]);

  const discrRows=useMemo(()=>{
    const map=new Map();
    filtered.forEach(r=>{
      const nr=normalizarLineaParaAgrupacion(r);
      const {unidad,tarea}=nr;
      const key=[tarea,unidad].join("__");
      if(!map.has(key))map.set(key,{key,tarea,unidad,cantidad:0,horas:0,largo:0,ancho:0,profundidad:0,registros:0,equipos:new Set(),proyectos:new Set(),errores:0});
      const acc=map.get(key);
      acc.cantidad+=nr.cantidad; acc.horas+=nr.horas; acc.largo+=nr.largo; acc.ancho+=nr.ancho; acc.profundidad+=nr.profundidad; acc.registros+=1;
      if(dimError(r))acc.errores+=1;
      if(r.maquina)acc.equipos.add(r.maquina);
      if(r.proyecto)acc.proyectos.add(r.proyecto);
    });
    return Array.from(map.values()).map(r=>({
      ...r,
      equiposCount:r.equipos.size,
      proyectosTxt:Array.from(r.proyectos).sort().join(" / ")||"—",
      rendimiento:r.horas>0?r.cantidad/r.horas:0,
    })).sort((a,b)=>a.tarea.localeCompare(b.tarea)||a.unidad.localeCompare(b.unidad));
  },[filtered,normalizarLineaParaAgrupacion]);

  const resumenTareas=useMemo(()=>{
    const map=new Map();
    filtered.forEach(r=>{
      const nr=normalizarLineaParaAgrupacion(r);
      const {unidad,tarea}=nr;
      const key=[tarea,unidad].join("__");
      if(!map.has(key))map.set(key,{key,tarea,unidad,cantidad:0,horas:0,largo:0,anchoTotal:0,profTotal:0,registros:0,equipos:new Set(),largoVals:[],anchoVals:[],profVals:[],errores:0});
      const acc=map.get(key), l=nr.largo, a=nr.ancho, p=nr.profundidad, c=nr.cantidad;
      acc.cantidad+=c; acc.horas+=nr.horas; acc.registros+=1; acc.largo+=l; acc.anchoTotal+=a; acc.profTotal+=p;
      if(l>0)acc.largoVals.push(l); if(a>0)acc.anchoVals.push(a); if(p>0)acc.profVals.push(p);
      if(r.maquina)acc.equipos.add(r.maquina);
      if(dimError(r))acc.errores+=1;
    });
    const avg=arr=>arr.length?arr.reduce((s,x)=>s+x,0)/arr.length:0;
    return Array.from(map.values()).map(r=>({
      ...r,
      equiposCount:r.equipos.size,
      largoProm:avg(r.largoVals), anchoProm:avg(r.anchoVals), profProm:avg(r.profVals),
      rendimiento:r.horas>0?r.cantidad/r.horas:0,
    })).sort((a,b)=>b.cantidad-a.cantidad);
  },[filtered,normalizarLineaParaAgrupacion]);

  const excelBaseRows=useMemo(()=>{
    let rows=rop05DesdeJulio.filter(r=>{
      if(!matchMulti(r.proyecto,vals.proyecto,"todos"))return false;
      if(!matchMulti(r.maquina,vals.maquina,"todas"))return false;
      if(!matchMulti(r.supervisor,vals.supervisor,"todos"))return false;
      if(!matchMulti(r.unidad,vals.unidad,"todas"))return false;
      return true;
    });
    if(!multiIsAll(tarea,"todas"))rows=rows.filter(r=>matchMulti(r.tarea,tarea,"todas"));
    if(!multiIsAll(tipoMaquina,"todas"))rows=rows.filter(r=>tipoMatchMachineROP05(tipoMaquina,r.maquina));
    return rows;
  },[rop05DesdeJulio,vals.proyecto,vals.maquina,vals.supervisor,vals.unidad,tarea,tipoMaquina]);

  const registrosConAlertas=useMemo(()=>filtered.map(r=>({...r,_error:dimError(r)})).filter(r=>r._error).slice(0,80),[filtered]);
  const detalleRows=useMemo(()=>{
    if(!detalleKey)return [];
    const [dt,du]=detalleKey.split("__");
    return filtered.filter(r=>{
      const nr=normalizarLineaParaAgrupacion(r);
      return nr.tarea===dt&&nr.unidad===du;
    }).slice(0,150);
  },[filtered,detalleKey,normalizarLineaParaAgrupacion]);
  const totalCantidad=discrRows.reduce((s,r)=>s+r.cantidad,0);
  const totalHoras=discrRows.reduce((s,r)=>s+r.horas,0);
  const totalLargo=resumenTareas.reduce((s,r)=>s+r.largo,0);
  const totalErrores=registrosConAlertas.length;
  const chartData=resumenTareas.slice(0,10).map(r=>({tarea:r.tarea.length>26?r.tarea.slice(0,24)+"…":r.tarea,cantidad:Number(r.cantidad.toFixed(2)),horas:Number(r.horas.toFixed(2)),registros:r.registros,unidad:r.unidad}));
  const periodoLabelDiscr=mode==="acumulado"?rangoAcumulado.label:(mode==="dia"?fmtFecha(fecha):`${fechaD||"inicio"}_${fechaH||"fin"}`);

  const generarPDFDiscriminacionPorProyecto=useCallback(()=>{
    const escapeHtml=value=>String(value??"")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/\"/g,"&quot;")
      .replace(/'/g,"&#039;");
    const esTrabajoPorHora=tarea=>textoNorm(tarea).includes("TRABAJO POR HORA");
    const agrupado=new Map();

    filtered.forEach(r=>{
      if(esTrabajoPorHora(r.tarea))return;
      const proyecto=String(r.proyecto||"SIN PROYECTO").trim()||"SIN PROYECTO";
      const nr=normalizarLineaParaAgrupacion(r);
      const {unidad,tarea}=nr;
      if(!agrupado.has(proyecto))agrupado.set(proyecto,new Map());
      const porTarea=agrupado.get(proyecto);
      const key=`${tarea}__${unidad}`;
      if(!porTarea.has(key))porTarea.set(key,{tarea,unidad,largo:0,ancho:0,profundidad:0,cantidad:0,horas:0,registros:0,equipos:new Set()});
      const acc=porTarea.get(key);
      acc.largo+=nr.largo;
      acc.ancho+=nr.ancho;
      acc.profundidad+=nr.profundidad;
      acc.cantidad+=nr.cantidad;
      acc.horas+=nr.horas;
      acc.registros+=1;
      if(r.maquina)acc.equipos.add(r.maquina);
    });

    if(!agrupado.size){
      appAlert("No hay registros para generar el PDF con los filtros actuales.");
      return;
    }

    const periodoTexto=mode==="acumulado"
      ?rangoAcumulado.label
      :mode==="dia"
        ?fmtFecha(fecha)
        :`${fechaD?fmtFecha(fechaD):"Inicio"} a ${fechaH?fmtFecha(fechaH):"Fin"}`;
    const proyectos=Array.from(agrupado.entries()).sort(([a],[b])=>a.localeCompare(b,"es",{sensitivity:"base"}));
    const secciones=proyectos.map(([proyecto,map],index)=>{
      const filas=Array.from(map.values())
        .map(r=>({...r,equiposCount:r.equipos.size,rendimiento:r.horas>0?r.cantidad/r.horas:0}))
        .sort((a,b)=>(b.horas-a.horas)||a.tarea.localeCompare(b.tarea,"es",{sensitivity:"base"})||a.unidad.localeCompare(b.unidad,"es",{sensitivity:"base"}));
      const body=filas.map(r=>`
        <tr>
          <td class="left">${escapeHtml(r.tarea)}</td>
          <td class="hours-cell">${escapeHtml(fmtNum(r.horas))}</td>
          <td>${escapeHtml(r.unidad)}</td>
          <td>${r.largo?escapeHtml(fmtNum(r.largo)):"—"}</td>
          <td>${r.ancho?escapeHtml(fmtNum(r.ancho)):"—"}</td>
          <td>${r.profundidad?escapeHtml(fmtNum(r.profundidad)):"—"}</td>
          <td>${escapeHtml(formatCantidad(r.cantidad,r.unidad))}</td>
          <td>${escapeHtml(formatRend(r.rendimiento,r.unidad))}</td>
          <td>${r.registros}</td>
          <td>${r.equiposCount}</td>
        </tr>`).join("");
      return `
        <section class="project ${index<proyectos.length-1?"page-break":""}">
          <div class="project-title">PROYECTO: ${escapeHtml(proyecto)}</div>
          <table>
            <thead><tr>
              <th class="left">Tarea</th><th>Horas</th><th>Unidad</th><th>Largo total</th><th>Ancho total</th><th>Prof. total</th><th>Cantidad</th><th>Prod/hs</th><th>Registros</th><th>Equipos</th>
            </tr></thead>
            <tbody>${body}</tbody>
          </table>
        </section>`;
    }).join("");

    const html=`<!doctype html><html><head><meta charset="utf-8"><title>Discriminación por proyecto</title>
      <style>
        @page{size:A4 landscape;margin:10mm}
        *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#171717;margin:0;font-size:9px}
        .report-title{text-align:center;font-size:16px;font-weight:800;margin:0 0 3px}
        .period{text-align:center;color:#555;font-size:10px;margin-bottom:12px}
        .project{width:100%;margin-bottom:12px}.page-break{page-break-after:always}
        .project-title{font-size:13px;font-weight:800;background:#202020;color:#fff;padding:7px 9px;border-radius:4px 4px 0 0}
        table{width:100%;border-collapse:collapse;table-layout:fixed}
        th,td{border:1px solid #bdbdbd;padding:5px 4px;text-align:center;vertical-align:middle;overflow-wrap:anywhere}
        th{background:#e7e7e7;font-size:8px;text-transform:uppercase;letter-spacing:.03em}
        th:first-child,td:first-child{width:25%}.left{text-align:left}
        tbody tr:nth-child(even){background:#f5f5f5}
        .hours-cell{font-weight:800}
        .footer{margin-top:8px;font-size:8px;color:#666;text-align:right}
      </style></head><body>
      <h1 class="report-title">DISCRIMINACIÓN POR LARGO, ANCHO Y PROFUNDIDAD</h1>
      <div class="period">Período: ${escapeHtml(periodoTexto)}</div>
      ${secciones}
      <div class="footer">Generado desde Delta Mining App</div>
      <script>window.onload=function(){setTimeout(function(){window.print();},250)};<\/script>
      </body></html>`;
    // Imprime directamente desde la pestaña actual, sin abrir ventanas emergentes.
    const printFrame=document.createElement("iframe");
    printFrame.setAttribute("aria-hidden","true");
    printFrame.style.position="fixed";
    printFrame.style.right="0";
    printFrame.style.bottom="0";
    printFrame.style.width="0";
    printFrame.style.height="0";
    printFrame.style.border="0";
    printFrame.style.opacity="0";
    printFrame.style.pointerEvents="none";

    const limpiarFrame=()=>{
      try{printFrame.remove();}catch(_err){}
    };

    printFrame.onload=()=>{
      try{
        const printWindow=printFrame.contentWindow;
        if(!printWindow)throw new Error("No se pudo preparar la vista de impresión.");
        printWindow.focus();
        const despuesDeImprimir=()=>{
          printWindow.removeEventListener?.("afterprint",despuesDeImprimir);
          setTimeout(limpiarFrame,100);
        };
        printWindow.addEventListener?.("afterprint",despuesDeImprimir);
        setTimeout(()=>{
          printWindow.print();
          // Respaldo para navegadores que no disparan afterprint.
          setTimeout(limpiarFrame,60000);
        },250);
      }catch(err){
        limpiarFrame();
        appAlert(`No se pudo abrir el cuadro de impresión: ${err?.message||err}`);
      }
    };

    document.body.appendChild(printFrame);
    printFrame.srcdoc=html.replace(/<script>[\s\S]*?<\/script>/i,"");
  },[filtered,mode,rangoAcumulado,fecha,fechaD,fechaH,normalizarLineaParaAgrupacion]);

  const th=(txt,left=false)=><th style={{padding:"9px 10px",textAlign:left?"left":"center",fontWeight:700,fontSize:10,letterSpacing:".06em",textTransform:"uppercase",color:C.textSub,borderBottom:`2px solid ${C.border}`,position:"sticky",top:0,background:C.surface,zIndex:2}}>{txt}</th>;
  const td=(children,left=false,color=C.text,fw=600)=> <td style={{padding:"8px 10px",textAlign:left?"left":"center",borderBottom:`1px solid ${C.border}18`,color,fontWeight:fw}}>{children}</td>;

  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:14}}>
      <Card>
        <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
            <TabBtn active={mode==="dia"} onClick={()=>setMode("dia")}>Por día</TabBtn>
            <TabBtn active={mode==="periodo"} onClick={()=>setMode("periodo")}>Por período</TabBtn>
            <TabBtn active={mode==="acumulado"} onClick={()=>setMode("acumulado")}>Acumulado</TabBtn>
            <button onClick={()=>generarExcelProductividad(excelBaseRows,fechaD,fechaH,mode,fecha,{periodoAcumulado,anioAcumulado})} style={{marginLeft:8,display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:7,border:`1px solid ${C.accent}`,background:C.accentDim,color:C.accent,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"Inter",letterSpacing:".04em"}}>
              📊 Generar Reporte
            </button>
            <button onClick={()=>imprimirGraficoIncidenciaROP05(filtered,{mode,fecha,fechaD,fechaH,rangoAcumulado})} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:7,border:`1px solid ${C.yellow}66`,background:C.yellowDim,color:C.yellow,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"Inter",letterSpacing:".04em"}}>
              🖨️ Imprimir gráfico
            </button>
          </div>
          <div style={{display:"flex",flexWrap:"nowrap",overflowX:"auto",gap:10,alignItems:"flex-end",paddingBottom:2}}>
            {mode==="dia"?(
              <DateIn label="Fecha" value={fecha} onChange={setFecha}/>
            ):mode==="acumulado"?(
              <>
                <Sel label="Período" value={periodoAcumulado} onChange={setPeriodoAcumulado} options={ROP05_PERIODOS_ACUMULADO}/>
                <Sel label="Año" value={anioAcumulado} onChange={setAnioAcumulado} options={anioAcumuladoOpts}/>
                <DateIn label="Desde" value={rangoAcumulado.desde} onChange={()=>{}} disabled/>
                <DateIn label="Hasta" value={rangoAcumulado.hasta} onChange={()=>{}} disabled/>
              </>
            ):(
              <>
                <PeriodMonthYear fechaD={fechaD} fechaH={fechaH} setFechaD={setFechaD} setFechaH={setFechaH}/>
                <DateIn label="Desde" value={fechaD} onChange={setFechaD} max={fechaH||undefined}/>
                <DateIn label="Hasta" value={fechaH} onChange={setFechaH} min={fechaD||undefined} warn={fechaH&&fechaD&&fechaH<fechaD?"≥ Desde":null}/>
              </>
            )}
            <MultiSel label="Proyecto" value={vals.proyecto} onChange={v=>set("proyecto",v)} options={[{value:"todos",label:"Todos"},...opts.proyecto.map(p=>({value:p,label:p}))]}/>
            <MultiSel label="Tipo de Máquina" value={tipoMaquina} onChange={v=>{setTipoMaquina(v);set("maquina","todas");}} options={ROP05_TIPOS_MAQUINA.map(t=>({value:t.value,label:t.label}))}/>
            <MultiSel label="Máquina" value={vals.maquina} onChange={v=>set("maquina",v)} options={[{value:"todas",label:"Todas"},...opts.maquina.filter(m=>multiIsAll(tipoMaquina,"todas")||tipoMatchMachineROP05(tipoMaquina,m)).map(m=>({value:m,label:m}))]}/>
            <MultiSel label="Supervisor" value={vals.supervisor} onChange={v=>set("supervisor",v)} options={[{value:"todos",label:"Todos"},...opts.supervisor.map(s=>({value:s,label:s}))]}/>
            <MultiSel label="Tarea" value={tarea} onChange={setTarea} options={[{value:"todas",label:"Todas"},...tareasOpts.map(t=>({value:t,label:t.length>40?t.slice(0,38)+"…":t}))]}/>
            <MultiSel label="Unidad" value={vals.unidad} onChange={v=>set("unidad",v)} options={[{value:"todas",label:"Todas"},...opts.unidad.map(u=>({value:u,label:u}))]}/>
            <button onClick={()=>{reset();setDetalleKey(null);}} style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,border:`1px solid ${C.red}44`,background:C.redDim,color:C.red,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"Inter",opacity:hayFiltros?1:0.3,pointerEvents:hayFiltros?"auto":"none"}}>
              <Icon name="close" size={11} color={C.red}/>Limpiar filtros
            </button>
          </div>
        </div>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:10}}>
        <StatCard icon="prod" label="Registros" value={filtered.length} color={C.blue} small/>
        <StatCard icon="prod" label="Tareas" value={resumenTareas.length} color={C.accent} small/>
        <StatCard icon="hours" label="Horas" value={fmtNum(totalHoras)} color={C.yellow} small/>
        <StatCard icon="prod" label="Cantidad total" value={fmtNum(totalCantidad)} color={C.green} small/>
        <StatCard icon="alert" label="Alertas carga" value={totalErrores} color={totalErrores?C.red:C.green} small/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"minmax(320px,1.2fr) minmax(320px,.8fr)",gap:14}}>
        <Card title="Producción por tarea - Top 10">
          <div style={{height:Math.max(260,chartData.length*32+60),padding:"10px 12px"}}>
            {chartData.length===0?<div style={{padding:28,textAlign:"center",color:C.textMuted,fontSize:12}}>Sin datos para graficar</div>:
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{left:8,right:16,top:8,bottom:8}}>
                  <CartesianGrid stroke={C.border} strokeOpacity={0.15}/>
                  <XAxis type="number" stroke={C.textMuted} tick={{fontSize:10}}/>
                  <YAxis dataKey="tarea" type="category" width={150} stroke={C.textMuted} tick={{fontSize:10}}/>
                  <Tooltip contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,color:C.text}} formatter={(v,_,p)=>`${fmtNum(v)} ${p?.payload?.unidad||""}`}/>
                  <Bar dataKey="cantidad" fill={C.green} radius={[0,5,5,0]}/>
                </BarChart>
              </ResponsiveContainer>}
          </div>
        </Card>

        <Card title="Alertas de carga">
          <div style={{maxHeight:330,overflowY:"auto"}}>
            {registrosConAlertas.length===0?<div style={{padding:28,textAlign:"center",color:C.green,fontSize:12,fontWeight:700}}>Sin errores de dimensiones detectados</div>:
              registrosConAlertas.slice(0,12).map((r,i)=>(
                <div key={i} style={{padding:"9px 12px",borderBottom:`1px solid ${C.border}22`,display:"grid",gridTemplateColumns:"1fr auto",gap:8,alignItems:"center"}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:12,color:C.text,fontWeight:800,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.tarea||"—"}</div>
                    <div style={{fontSize:10,color:C.textMuted}}>{fmtFecha(r.fecha)} · {r.maquina||"—"} · {r.unidad||"—"}</div>
                  </div>
                  <Badge color={C.red}>{r._error}</Badge>
                </div>
              ))}
          </div>
        </Card>
      </div>

      <Card title="Resumen agrupado por tarea y unidad">
        <div style={{overflowX:"auto",overflowY:"auto",maxHeight:520}}>
          {resumenTareas.length===0?<div style={{padding:28,textAlign:"center",color:C.textMuted,fontSize:12}}>Sin registros con los filtros seleccionados</div>:(
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:1000}}>
              <thead><tr>{th("Tarea",true)}{th("Unidad")}{th("Cantidad")}{th("Horas")}{th("Prod/hs")}{th("Largo prom.")}{th("Ancho prom.")}{th("Prof. prom.")}{th("Reg.")}{th("Equipos")}{th("Alertas")}{th("Detalle")}</tr></thead>
              <tbody>{resumenTareas.map((r,i)=>(
                <React.Fragment key={r.key}>
                  <tr style={{background:detalleKey===r.key?"rgba(232,0,29,.14)":i%2===0?"transparent":C.surface+"33"}}>
                    {td(<span title={r.tarea}>{r.tarea}</span>,true,C.text,800)}
                    {td(<Badge color={C.teal}>{r.unidad}</Badge>)}
                    {td(formatCantidad(r.cantidad,r.unidad),false,C.green,800)}{td(fmtNum(r.horas),false,C.yellow,700)}{td(formatRend(r.rendimiento,r.unidad),false,C.accent,700)}
                    {td(r.largoProm?fmtNum(r.largoProm):"—")} {td(r.anchoProm?fmtNum(r.anchoProm):"—")} {td(r.profProm?fmtNum(r.profProm):"—")}
                    {td(r.registros)}{td(r.equiposCount)}{td(r.errores?<Badge color={C.red}>{r.errores}</Badge>:<Badge color={C.green}>OK</Badge>)}
                    {td(<button onClick={()=>setDetalleKey(detalleKey===r.key?null:r.key)} style={{background:detalleKey===r.key?C.redDim:C.surface,border:`1px solid ${detalleKey===r.key?C.red:C.border}`,borderRadius:7,color:detalleKey===r.key?C.red:C.text,padding:"5px 9px",fontSize:11,fontWeight:800,cursor:"pointer"}}>{detalleKey===r.key?"Ocultar":"Ver"}</button>)}
                  </tr>
                  {detalleKey===r.key&&(
                    <tr>
                      <td colSpan={12} style={{padding:0,borderBottom:`1px solid ${C.red}33`}}>
                        <div style={{padding:"10px 12px",background:"rgba(0,0,0,.28)"}}>
                          <div style={{fontSize:11,color:C.textSub,fontWeight:800,textTransform:"uppercase",letterSpacing:".05em",marginBottom:8}}>Registros considerados</div>
                          <div style={{overflowX:"auto",maxHeight:260,overflowY:"auto"}}>
                            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:900}}>
                              <thead><tr>{th("Fecha")}{th("Máquina")}{th("Proyecto")}{th("Supervisor")}{th("Largo")}{th("Ancho")}{th("Prof.")}{th("Cantidad")}{th("Horas")}{th("Alerta")}</tr></thead>
                              <tbody>{detalleRows.map((d,di)=>(
                                <tr key={di} style={{background:di%2===0?"transparent":C.surface+"22"}}>
                                  {td(fmtFecha(d.fecha))}{td(<Badge color={C.purple}>{d.maquina||"—"}</Badge>)}{td(<Badge color={proyColor(d.proyecto)}>{d.proyecto||"—"}</Badge>)}{td(d.supervisor||"—")}{td(n(d.largo)?fmtNum(n(d.largo)):"—",false,C.blue,700)}{td(n(d.ancho)?fmtNum(n(d.ancho)):"—",false,C.teal,700)}{td(n(d.profundidad)?fmtNum(n(d.profundidad)):"—",false,C.purple,700)}{td(formatCantidad(n(d.cantidad),d.unidad),false,C.green,800)}{td(fmtNum(n(d.horas)),false,C.yellow,700)}{td(dimError(d)?<Badge color={C.red}>{dimError(d)}</Badge>:<Badge color={C.green}>OK</Badge>)}
                                </tr>
                              ))}</tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}</tbody>
            </table>)}
        </div>
      </Card>

      <Card
        title={`Discriminación por largo, ancho y profundidad (${discrRows.length})`}
        action={<button
          onClick={generarPDFDiscriminacionPorProyecto}
          disabled={!filtered.some(r=>!textoNorm(r.tarea).includes("TRABAJO POR HORA"))}
          title="Generar PDF separado por proyecto"
          style={{height:30,border:`1px solid ${C.red}77`,background:C.redDim,color:C.red,borderRadius:8,padding:"0 12px",fontSize:11,fontWeight:900,cursor:"pointer",opacity:filtered.some(r=>!textoNorm(r.tarea).includes("TRABAJO POR HORA"))?1:.4}}
        >📄 PDF</button>}
      >
        <div style={{overflowX:"auto",overflowY:"auto",maxHeight:520}}>
          {discrRows.length===0?(
            <div style={{padding:28,textAlign:"center",color:C.textMuted,fontSize:12}}>Sin registros con los filtros seleccionados</div>
          ):(
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:1040}}>
              <thead><tr>{th("Tarea",true)}{th("Unidad")}{th("Largo total")}{th("Ancho total")}{th("Prof. total")}{th("Cantidad")}{th("Horas")}{th("Prod/hs")}{th("Registros")}{th("Equipos")}{th("Proyecto")}{th("Alertas")}</tr></thead>
              <tbody>
                {discrRows.map((r,i)=>(
                  <tr key={r.key} style={{background:i%2===0?"transparent":C.surface+"33"}}>
                    {td(r.tarea,true,C.text,700)}{td(<Badge color={C.teal}>{r.unidad}</Badge>)}{td(r.largo?fmtNum(r.largo):"—",false,C.blue,700)}{td(r.ancho?fmtNum(r.ancho):"—",false,C.teal,700)}{td(r.profundidad?fmtNum(r.profundidad):"—",false,C.purple,700)}{td(formatCantidad(r.cantidad,r.unidad),false,C.green,800)}{td(fmtNum(r.horas),false,C.yellow,700)}{td(formatRend(r.rendimiento,r.unidad),false,C.accent,700)}{td(r.registros)}{td(r.equiposCount)}{td(<Badge color={proyColor(r.proyectosTxt)}>{r.proyectosTxt}</Badge>)}{td(r.errores?<Badge color={C.red}>{r.errores}</Badge>:<Badge color={C.green}>OK</Badge>)}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}

function calcularErroresControlEquipo(rows){
  // La continuidad se controla dentro del mismo proyecto. Si un equipo cambia
  // de proyecto, la numeración y el horómetro comienzan una nueva secuencia y
  // no se comparan contra el último registro del proyecto anterior.
  const byMaqProyecto={};
  (rows||[]).forEach(r=>{
    if(r.maquina){
      const proyectoKey=String(r.proyecto||"SIN PROYECTO").trim().toUpperCase();
      const key=`${r.maquina}|||${proyectoKey}`;
      if(!byMaqProyecto[key])byMaqProyecto[key]=[];
      byMaqProyecto[key].push(r);
    }
  });
  const erroresPartes=[];
  const erroresHoro=[];
  const parseParte=p=>{const m=String(p||"").match(/(\d+)/g);return m?Number(m[m.length-1]):null;};
  Object.entries(byMaqProyecto).forEach(([groupKey,items])=>{
    const maq=groupKey.split("|||")[0];
    const byFecha={};
    items.forEach(r=>{
      if(!byFecha[r.fecha])byFecha[r.fecha]={fecha:r.fecha,TD:null,TN:null};
      const turnoKey=(r.turno||"").toUpperCase().includes("NOCHE")?"TN":"TD";
      byFecha[r.fecha][turnoKey]=r;
    });
    const cronologico=Object.values(byFecha).sort((a,b)=>a.fecha.localeCompare(b.fecha));
    const diasPartes=cronologico.map(d=>{
      const primero=d.TD||d.TN;
      const ultimo=d.TN||d.TD;
      return{
        fecha:d.fecha,
        primero,
        ultimo,
        turnoPrimero:d.TD?"TD":"TN",
        turnoUltimo:d.TN?"TN":"TD",
        partePrimero:primero?.parte||"",
        parteUltimo:ultimo?.parte||"",
        numPrimero:parseParte(primero?.parte),
        numUltimo:parseParte(ultimo?.parte),
      };
    }).filter(d=>d.primero&&d.ultimo);

    diasPartes.forEach(d=>{
      if(d.primero&&d.ultimo&&d.turnoPrimero==="TD"&&d.turnoUltimo==="TN"){
        const td=d.primero;
        const tn=d.ultimo;
        const numTD=parseParte(td?.parte);
        const numTN=parseParte(tn?.parte);
        const esperado=(numTD!==null)?numTD+1:null;
        if(numTD!==null&&numTN!==null&&numTN!==esperado){
          erroresPartes.push({
            tipo:"TD_TN_NO_CONSECUTIVA",
            proyecto:tn?.proyecto||td?.proyecto||"—",
            maquina:maq,
            supervisor:tn?.supervisor||td?.supervisor||"—",
            fecha:d.fecha,
            turno:"TN",
            numeroIncorrecto:tn?.parte||"",
            numeroCorrecto:esperado,
            parteAnterior:td?.parte||"",
            fechaAnterior:d.fecha,
            turnoAnterior:"TD",
            diff:numTN-esperado,
            detalle:"El número de parte del turno noche debe ser consecutivo al número de parte del turno día."
          });
        }
      }
    });

    for(let i=0;i<diasPartes.length-1;i++){
      const hoy=diasPartes[i];
      const siguiente=diasPartes[i+1];
      const proyectoAnterior=normProject(hoy.ultimo?.proyecto||hoy.primero?.proyecto||"");
      const proyectoActual=normProject(siguiente.primero?.proyecto||siguiente.ultimo?.proyecto||"");
      // Guardia explícita: nunca comparar continuidad entre proyectos distintos.
      // Esto evita que una máquina que se trasladó (por ejemplo TOP-0072)
      // arrastre la numeración del proyecto anterior.
      if(!proyectoAnterior||!proyectoActual||proyectoAnterior!==proyectoActual)continue;
      if(hoy.numUltimo!==null&&siguiente.numPrimero!==null&&siguiente.numPrimero!==hoy.numUltimo+1){
        erroresPartes.push({
          tipo:"ENTRE_DIAS",
          proyecto:siguiente.primero?.proyecto||hoy.ultimo?.proyecto||"—",
          maquina:maq,
          supervisor:siguiente.primero?.supervisor||hoy.ultimo?.supervisor||"—",
          fecha:siguiente.fecha,
          turno:siguiente.turnoPrimero,
          numeroIncorrecto:siguiente.partePrimero,
          numeroCorrecto:hoy.numUltimo+1,
          parteAnterior:hoy.parteUltimo,
          fechaAnterior:hoy.fecha,
          turnoAnterior:hoy.turnoUltimo,
          diff:siguiente.numPrimero-(hoy.numUltimo+1),
          detalle:"El primer parte del día debe continuar al último parte registrado del día anterior."
        });
      }
    }

    const turnoOrden=r=>(String(r?.turno||"").toUpperCase().includes("NOCHE")?1:0);
    const parteNumero=r=>parseParte(r?.parte)??0;
    const diasHoro=cronologico.map(d=>{
      const registros=[d.TD,d.TN].filter(Boolean).sort((a,b)=>{
        const t=turnoOrden(a)-turnoOrden(b);
        if(t!==0)return t;
        return parteNumero(a)-parteNumero(b);
      });
      return{
        fecha:d.fecha,
        primero:registros[0]||null,
        ultimo:registros[registros.length-1]||null,
        turnoPrimero:registros[0]?(turnoOrden(registros[0])===1?"TN":"TD"):"—",
        turnoUltimo:registros[registros.length-1]?(turnoOrden(registros[registros.length-1])===1?"TN":"TD"):"—",
      };
    }).filter(d=>d.primero&&d.ultimo);
    for(let i=0;i<diasHoro.length-1;i++){
      const diaActual=diasHoro[i];
      const diaSiguiente=diasHoro[i+1];
      const proyectoAnterior=normProject(diaActual.ultimo?.proyecto||diaActual.primero?.proyecto||"");
      const proyectoActual=normProject(diaSiguiente.primero?.proyecto||diaSiguiente.ultimo?.proyecto||"");
      // La continuidad de horómetro también se reinicia al cambiar de proyecto.
      if(!proyectoAnterior||!proyectoActual||proyectoAnterior!==proyectoActual)continue;
      const hfPrev=Number(diaActual.ultimo?.horometroFinal)||null;
      const hiCurr=Number(diaSiguiente.primero?.horometroInicial)||null;
      if(hfPrev&&hiCurr&&hfPrev!==hiCurr){
        erroresHoro.push({
          proyecto:diaSiguiente.primero?.proyecto||diaActual.ultimo?.proyecto||"—",
          maquina:maq,
          fecha:diaSiguiente.fecha,
          turno:diaSiguiente.turnoPrimero,
          supervisor:diaSiguiente.primero?.supervisor||"—",
          parte:diaSiguiente.primero?.parte||"—",
          hiActual:hiCurr,
          hfAnterior:hfPrev,
          fechaAnterior:diaActual.fecha,
          turnoAnterior:diaActual.turnoUltimo,
          parteAnterior:diaActual.ultimo?.parte||"—",
          diff:hiCurr-hfPrev,
          detalle:"El horómetro inicial debe coincidir con el horómetro final del día anterior registrado."
        });
      }
    }
  });
  erroresPartes.sort((a,b)=>(a.fecha||"").localeCompare(b.fecha||"")||String(a.maquina||"").localeCompare(String(b.maquina||"")));
  erroresHoro.sort((a,b)=>(a.fecha||"").localeCompare(b.fecha||"")||String(a.maquina||"").localeCompare(String(b.maquina||"")));
  return{erroresPartes,erroresHoro};
}

// ─── ControlDeErrores ───────────────────────────────────────────────────────
function ControlDeErrores({rop02All,extState,setExtState}){
  const rop02Prod=useMemo(()=>rop02All.filter(r=>!r._excluded),[rop02All]);
  const rop02ControlRows=useMemo(()=>rop02Prod.filter(r=>{
    const m=String(r.maquina||"").trim();
    return !/^CAA[-_\s]*0002(?:[-_\s]*JM)?$/i.test(m) && normalizeMachineCode(m)!=="CAA-0002";
  }),[rop02Prod]);
  const MESES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const hoy=new Date();
  const {proyecto,maquina,año,mesIdx,tipo,tipoMaquina="todas",fechaDesde="",fechaHasta=""}=extState;
  const set=(key,value)=>setExtState(state=>({...state,[key]:value}));
  const periodo=useMemo(()=>{
    const year=parseFloat(año,10);
    const month=Number(mesIdx);
    const monthText=String(month+1).padStart(2,"0");
    const lastDay=new Date(year,month+1,0).getDate();
    return {fechaD:String(year)+"-"+monthText+"-01",fechaH:String(year)+"-"+monthText+"-"+String(lastDay).padStart(2,"0")};
  },[año,mesIdx]);
  const años=useMemo(()=>{
    const years=new Set(["2026","2027","2028"]);
    rop02ControlRows.forEach(row=>{if(row.fecha)years.add(row.fecha.slice(0,4));});
    return [...years].sort();
  },[rop02ControlRows]);
  const rop02ControlTipo=useMemo(()=>rop02ControlRows.filter(row=>dmMatchTipoMaquinaSeleccion(row.maquina,tipoMaquina)),[rop02ControlRows,tipoMaquina]);
  const proyectos=useMemo(()=>uniq(rop02ControlTipo.map(row=>row.proyecto).filter(Boolean)).sort(),[rop02ControlTipo]);
  const proyectosAutorizados=useMemo(()=>uniq(rop02Prod.map(row=>normalizeRop02Project(row.proyecto||"")).filter(Boolean)),[rop02Prod]);
  const rangoDesde=fechaDesde||periodo.fechaD;
  const rangoHasta=fechaHasta||periodo.fechaH;
  const maquinas=useMemo(()=>{
    const base=rop02ControlTipo.filter(row=>matchMulti(row.proyecto,proyecto,"todos")&&row.fecha>=rangoDesde&&row.fecha<=rangoHasta);
    return uniq(base.map(row=>row.maquina).filter(Boolean)).filter(value=>!isRop02ControlMachineExcluded(value)).sort();
  },[rop02ControlTipo,proyecto,rangoDesde,rangoHasta]);
  React.useEffect(()=>{
    if(!multiIsAll(maquina,"todas")&&(!maquina.some(value=>maquinas.includes(value))||maquina.some(value=>isRop02ControlMachineExcluded(value))))set("maquina","todas");
  },[maquinas,maquina]);// eslint-disable-line
  const filtered=useMemo(()=>rop02ControlTipo.filter(row=>{
    if(!matchMulti(row.proyecto,proyecto,"todos"))return false;
    if(isRop02ControlMachineExcluded(row.maquina))return false;
    if(!matchMulti(row.maquina,maquina,"todas"))return false;
    return row.fecha>=rangoDesde&&row.fecha<=rangoHasta;
  }),[rop02ControlTipo,proyecto,maquina,rangoDesde,rangoHasta]);
  const control=useMemo(()=>calcularErroresControlEquipo(filtered),[filtered]);
  const todosErrores=useMemo(()=>[
    ...control.erroresPartes.map(error=>({...error,_tipo:"Numeración"})),
    ...control.erroresHoro.map(error=>({...error,_tipo:"Horómetro"})),
  ].sort((a,b)=>(a.fecha||"").localeCompare(b.fecha||"")||String(a.maquina||"").localeCompare(String(b.maquina||""))),[control]);
  const {data:erroresAceptados,byKey:aceptadosPorClave,error:errorAceptadosError,reload:recargarErroresAceptados,remember:recordarAceptacion,restore:retirarAceptacionLocal}=useErrorAcceptances(proyectosAutorizados,["controlErrores","controlROP02"]);
  const [modalError,setModalError]=useState(null);
  const [justificacionError,setJustificacionError]=useState("");
  const [guardandoAceptacion,setGuardandoAceptacion]=useState(false);
  const [restaurandoAceptacion,setRestaurandoAceptacion]=useState("");
  const [mensajeAceptacion,setMensajeAceptacion]=useState(null);
  const erroresTabla=tipo==="numeracion"
    ?control.erroresPartes.map(error=>({...error,_tipo:"Numeración"}))
    :tipo==="horometros"
      ?control.erroresHoro.map(error=>({...error,_tipo:"Horómetro"}))
      :todosErrores;
  const erroresPendientes=useMemo(()=>erroresTabla.filter(error=>!aceptadosPorClave.has(errorAcceptanceKey(error))),[erroresTabla,aceptadosPorClave]);
  const todosPendientes=useMemo(()=>todosErrores.filter(error=>!aceptadosPorClave.has(errorAcceptanceKey(error))),[todosErrores,aceptadosPorClave]);
  const pendientesNumeracion=useMemo(()=>control.erroresPartes.filter(error=>!aceptadosPorClave.has(errorAcceptanceKey({...error,_tipo:"Numeración"}))).length,[control.erroresPartes,aceptadosPorClave]);
  const pendientesHorometro=useMemo(()=>control.erroresHoro.filter(error=>!aceptadosPorClave.has(errorAcceptanceKey({...error,_tipo:"Horómetro"}))).length,[control.erroresHoro,aceptadosPorClave]);
  const erroresAceptadosTabla=useMemo(()=>erroresAceptados.filter(error=>{
    if(!matchMulti(error.proyecto,proyecto,"todos"))return false;
    if(!matchMulti(error.maquina,maquina,"todas"))return false;
    if(!dmMatchTipoMaquinaSeleccion(error.maquina,tipoMaquina))return false;
    if(error.fecha<rangoDesde||error.fecha>rangoHasta)return false;
    if(tipo==="numeracion"&&error.tipo!=="Numeración")return false;
    if(tipo==="horometros"&&error.tipo!=="Horómetro")return false;
    return true;
  }).sort((a,b)=>String(b.fechaAceptacion||"").localeCompare(String(a.fechaAceptacion||""))),[erroresAceptados,proyecto,maquina,tipoMaquina,rangoDesde,rangoHasta,tipo]);
  const porProyecto=useMemo(()=>{
    const map={};
    todosPendientes.forEach(error=>{const key=error.proyecto||"—";map[key]=(map[key]||0)+1;});
    return Object.entries(map).sort((a,b)=>b[1]-a[1]);
  },[todosPendientes]);
  const porMaquina=useMemo(()=>{
    const map={};
    todosPendientes.forEach(error=>{const key=error.maquina||"—";map[key]=(map[key]||0)+1;});
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,12);
  },[todosPendientes]);
  const hayFiltros=!multiIsAll(tipoMaquina,"todas")||!multiIsAll(proyecto,"todos")||!multiIsAll(maquina,"todas")||año!==String(hoy.getFullYear())||mesIdx!==hoy.getMonth()||tipo!=="todos"||Boolean(fechaDesde)||Boolean(fechaHasta);
  const reset=()=>setExtState({tipoMaquina:"todas",proyecto:"todos",maquina:"todas",año:String(hoy.getFullYear()),mesIdx:hoy.getMonth(),tipo:"todos",fechaDesde:"",fechaHasta:""});
  const descargar=()=>{
    const cols=["Tipo","Proyecto","Máquina","Fecha con error","Turno","Supervisor","Parte informado","Valor informado","Valor esperado/anterior","Diferencia","Fecha anterior","Turno anterior","Parte anterior","Detalle"];
    const data=[cols,...erroresPendientes.map(error=>[error._tipo,error.proyecto,error.maquina,error.fecha,error.turno,error.supervisor,error.numeroIncorrecto||error.parte||"",error.numeroIncorrecto||error.hiActual||"",error.numeroCorrecto||error.hfAnterior||"",error.diff,error.fechaAnterior||"",error.turnoAnterior||"",error.parteAnterior||"",error.detalle||""])];
    const workbook=XLSX.utils.book_new();
    const worksheet=XLSX.utils.aoa_to_sheet(data);
    worksheet["!cols"]=cols.map(header=>({wch:Math.max(header.length+2,14)}));
    XLSX.utils.book_append_sheet(workbook,worksheet,"Control de errores");
    XLSX.writeFile(workbook,"Control_de_errores_ROP02.xlsx");
  };
  const descargarAceptados=()=>{
    const cols=["Tipo","Proyecto","Máquina","Fecha con error","Turno","Detalle","Justificación","Aceptó","Fecha de aceptación"];
    const data=[cols,...erroresAceptadosTabla.map(error=>[error.tipo,error.proyecto,error.maquina,error.fecha,error.turno,error.detalle||"",error.justificacion,error.usuario,error.fechaAceptacion?new Date(error.fechaAceptacion).toLocaleString("es-AR"):""])];
    const workbook=XLSX.utils.book_new();
    const worksheet=XLSX.utils.aoa_to_sheet(data);
    worksheet["!cols"]=cols.map(header=>({wch:Math.max(header.length+2,16)}));
    XLSX.utils.book_append_sheet(workbook,worksheet,"Errores aceptados");
    XLSX.writeFile(workbook,"Errores_aceptados_ROP02.xlsx");
  };
  const abrirAceptacion=error=>{
    setModalError(error);
    setJustificacionError("");
    setMensajeAceptacion(null);
  };
  const confirmarAceptacion=async()=>{
    if(!modalError)return;
    const justificacion=String(justificacionError||"").trim();
    if(!justificacion){
      setMensajeAceptacion({type:"error",text:"Ingresá una justificación para aceptar el error."});
      return;
    }
    setGuardandoAceptacion(true);
    setMensajeAceptacion(null);
    try{
      const aceptacion=await saveErrorAcceptance(modalError,justificacion,sessionStorage.getItem("dm_user")||"Usuario");
      recordarAceptacion(aceptacion);
      await recargarErroresAceptados();
      setModalError(null);
      setMensajeAceptacion({type:"success",text:"El error fue aceptado y quedó registrado con su justificación."});
    }catch(error){
      setMensajeAceptacion({type:"error",text:error?.message||"No se pudo aceptar el error."});
    }finally{
      setGuardandoAceptacion(false);
    }
  };
  const restaurarAceptacion=async error=>{
    setRestaurandoAceptacion(error.id);
    setMensajeAceptacion(null);
    try{
      await cancelErrorAcceptance(error.id,sessionStorage.getItem("dm_user")||"Usuario");
      retirarAceptacionLocal(error);
      await recargarErroresAceptados();
      setMensajeAceptacion({type:"success",text:"La aceptación fue restaurada; el error vuelve a quedar pendiente."});
    }catch(err){
      setMensajeAceptacion({type:"error",text:err?.message||"No se pudo restaurar la aceptación."});
    }finally{
      setRestaurandoAceptacion("");
    }
  };
  const th={padding:"8px 12px",fontSize:11,fontWeight:800,color:C.textMuted,textAlign:"left",borderBottom:"1px solid "+C.border};
  const td={padding:"8px 12px",borderBottom:"1px solid "+C.border+"18",fontSize:12};
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <Card>
        <div style={{padding:"12px 14px",display:"flex",flexWrap:"wrap",gap:10,alignItems:"flex-end"}}>
          <Sel label="Mes" value={String(mesIdx)} onChange={value=>set("mesIdx",Number(value))} options={MESES.map((month,index)=>({value:String(index),label:month}))}/>
          <Sel label="Año" value={año} onChange={value=>set("año",value)} options={años.map(year=>({value:year,label:year}))}/>
          <DateIn label="Desde" value={rangoDesde} onChange={value=>set("fechaDesde",value)} max={rangoHasta||undefined}/>
          <DateIn label="Hasta" value={rangoHasta} onChange={value=>set("fechaHasta",value)} min={rangoDesde||undefined} warn={rangoHasta&&rangoDesde&&rangoHasta<rangoDesde?"≥ Desde":null}/>
          <MultiSel label="Tipo de Máquina" value={tipoMaquina} onChange={value=>{set("tipoMaquina",value);set("maquina","todas");}} options={dmTipoMaquinaOptions()}/>
          <MultiSel label="Proyecto" value={proyecto} onChange={value=>{set("proyecto",value);set("maquina","todas");}} options={[{value:"todos",label:"Todos"},...proyectos.map(value=>({value,label:value}))]}/>
          <MultiSel label="Máquina" value={maquina} onChange={value=>set("maquina",value)} options={[{value:"todas",label:"Todas"},...maquinas.map(value=>({value,label:value}))]}/>
          <Sel label="Tipo de error" value={tipo} onChange={value=>set("tipo",value)} options={[{value:"todos",label:"Todos"},{value:"numeracion",label:"Numeración"},{value:"horometros",label:"Horómetros"}]}/>
          <div style={{fontSize:11,color:C.textSub,padding:"7px 10px",border:"1px solid "+C.border,borderRadius:7,background:C.surface}}>Período: <strong style={{color:C.text}}>{fmtFecha(rangoDesde)} → {fmtFecha(rangoHasta)}</strong></div>
          <button onClick={reset} style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,border:"1px solid "+C.red+"44",background:C.redDim,color:C.red,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"Inter",opacity:hayFiltros?1:0.3,pointerEvents:hayFiltros?"auto":"none"}}>
            <Icon name="close" size={11} color={C.red}/>Limpiar filtros
          </button>
        </div>
      </Card>
      {mensajeAceptacion&&<AlertBanner type={mensajeAceptacion.type==="success"?"success":"error"}>{mensajeAceptacion.text}</AlertBanner>}
      {errorAceptadosError&&<AlertBanner type="error">No se pudo actualizar la tabla de errores aceptados. Los errores pendientes continúan disponibles: {errorAceptadosError}</AlertBanner>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12}}>
        <StatCard icon="warn" label="Errores pendientes" value={fmtNum(todosPendientes.length)} sub={String(filtered.length)+" registros controlados"} color={todosPendientes.length?C.red:C.green} small/>
        <StatCard icon="parts" label="Numeración pendiente" value={fmtNum(pendientesNumeracion)} sub="Partes diarios no consecutivos" color={pendientesNumeracion?C.yellow:C.green} small/>
        <StatCard icon="hours" label="Horómetros pendientes" value={fmtNum(pendientesHorometro)} sub="Cortes entre días registrados" color={pendientesHorometro?C.red:C.green} small/>
        <StatCard icon="check" label="Errores aceptados" value={fmtNum(erroresAceptadosTabla.length)} sub="Con justificación registrada" color={C.green} small/>
        <StatCard icon="equip" label="Equipos afectados" value={fmtNum(new Set(todosPendientes.map(error=>error.maquina)).size)} sub={String(maquinas.length)+" equipos en filtro"} color={C.purple} small/>
      </div>
      {erroresPendientes.length===0?
        <AlertBanner type="success">✅ No hay errores pendientes para los filtros seleccionados.</AlertBanner>:
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12}}>
            <Card title="Errores pendientes por proyecto"><div style={{padding:14,display:"flex",flexDirection:"column",gap:8}}>{porProyecto.map(([key,value])=><div key={key} style={{display:"flex",justifyContent:"space-between",gap:12,fontSize:12}}><span style={{color:C.textSub,fontWeight:700}}>{key}</span><Badge color={C.red}>{value}</Badge></div>)}</div></Card>
            <Card title="Equipos con más errores pendientes"><div style={{padding:14,display:"flex",flexDirection:"column",gap:8}}>{porMaquina.map(([key,value])=><div key={key} style={{display:"flex",justifyContent:"space-between",gap:12,fontSize:12}}><span style={{color:C.textSub,fontWeight:800}}>{key}</span><Badge color={C.yellow}>{value}</Badge></div>)}</div></Card>
          </div>
          <Card title={"Detalle de errores ("+erroresPendientes.length+")"} action={<BtnExcel onClick={descargar}/>}>
            <div className="dm-table-scroll" style={{overflowX:"auto",overflowY:"auto",maxHeight:520,scrollbarGutter:"stable"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:1100}}>
                <thead><tr style={{background:C.surface}}>{["Tipo","Proyecto","Máquina","Fecha","Turno","Supervisor","Dato informado","Dato esperado","Diferencia","Referencia anterior","Detalle","Acción"].map(header=><th key={header} style={th}>{header}</th>)}</tr></thead>
                <tbody>{erroresPendientes.map((error,index)=>{
                  const esParte=error._tipo==="Numeración";
                  return <tr key={errorAcceptanceKey(error)} style={{background:index%2===0?C.red+"0a":"transparent"}}>
                    <td style={td}><Badge color={esParte?C.yellow:C.red}>{error._tipo}</Badge></td>
                    <td style={td}>{error.proyecto}</td>
                    <td style={td}><Badge color={C.purple}>{error.maquina}</Badge></td>
                    <td style={{...td,fontWeight:800}}>{fmtFecha(error.fecha)}</td>
                    <td style={td}><Badge color={error.turno==="TD"?C.blue:C.purple}>{error.turno}</Badge></td>
                    <td style={td}>{error.supervisor}</td>
                    <td style={{...td,color:C.red,fontWeight:900}}>{esParte?"#"+error.numeroIncorrecto:fmtNum(error.hiActual)}</td>
                    <td style={{...td,color:C.yellow,fontWeight:900}}>{esParte?"#"+error.numeroCorrecto:fmtNum(error.hfAnterior)}</td>
                    <td style={td}><Badge color={error.diff>0?C.yellow:C.red}>{error.diff>0?"+"+fmtNum(error.diff):fmtNum(error.diff)}</Badge></td>
                    <td style={td}>{fmtFecha(error.fechaAnterior)} · {error.turnoAnterior||"—"} · #{error.parteAnterior||"—"}</td>
                    <td style={{...td,minWidth:240,color:C.textSub}}>{error.detalle||"—"}</td>
                    <td style={{...td,textAlign:"right",whiteSpace:"nowrap"}}><button onClick={()=>abrirAceptacion(error)} style={{border:"1px solid "+C.green+"66",background:C.greenDim,color:C.green,borderRadius:7,padding:"6px 10px",fontSize:11,fontWeight:900,cursor:"pointer"}}>Aceptar</button></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </Card>
        </>
      }
      <Card title={"Errores aceptados ("+erroresAceptadosTabla.length+")"} action={<BtnExcel onClick={descargarAceptados}/>}>
        <div className="dm-table-scroll" style={{overflowX:"auto",overflowY:"auto",maxHeight:420,scrollbarGutter:"stable"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:980}}>
            <thead><tr style={{background:C.surface}}>{["Tipo","Proyecto","Máquina","Fecha","Turno","Detalle","Justificación","Aceptó","Fecha de aceptación","Acción"].map(header=><th key={header} style={th}>{header}</th>)}</tr></thead>
            <tbody>{erroresAceptadosTabla.map((error,index)=><tr key={error.id} style={{background:index%2===0?C.green+"0a":"transparent"}}>
              <td style={td}><Badge color={error.tipo==="Numeración"?C.yellow:C.red}>{error.tipo}</Badge></td>
              <td style={td}>{error.proyecto}</td>
              <td style={td}><Badge color={C.purple}>{error.maquina}</Badge></td>
              <td style={{...td,fontWeight:800}}>{fmtFecha(error.fecha)}</td>
              <td style={td}><Badge color={error.turno==="TD"?C.blue:C.purple}>{error.turno}</Badge></td>
              <td style={{...td,minWidth:220,color:C.textSub}}>{error.detalle||"—"}</td>
              <td style={{...td,minWidth:260,color:C.green,fontWeight:700}}>{error.justificacion}</td>
              <td style={td}>{error.usuario||"Usuario"}</td>
              <td style={td}>{error.fechaAceptacion?new Date(error.fechaAceptacion).toLocaleString("es-AR"):"—"}</td>
              <td style={{...td,textAlign:"right"}}><button disabled={restaurandoAceptacion===error.id} onClick={()=>restaurarAceptacion(error)} style={{border:"1px solid "+C.yellow+"66",background:C.yellowDim,color:C.yellow,borderRadius:7,padding:"6px 10px",fontSize:11,fontWeight:900,cursor:restaurandoAceptacion===error.id?"wait":"pointer",opacity:restaurandoAceptacion===error.id?0.65:1}}>{restaurandoAceptacion===error.id?"Restaurando...":"Restaurar"}</button></td>
            </tr>)}</tbody>
          </table>
          {erroresAceptadosTabla.length===0&&<div style={{padding:28,textAlign:"center",color:C.textMuted,fontSize:12}}>Todavía no hay errores aceptados para los filtros seleccionados.</div>}
        </div>
      </Card>
      {modalError&&ReactDOM.createPortal(<div style={{position:"fixed",inset:0,zIndex:2147483647,background:"rgba(0,0,0,.62)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,boxSizing:"border-box"}}>
        <div style={{width:"min(560px,96vw)",background:"#232323",opacity:1,backdropFilter:"none",WebkitBackdropFilter:"none",border:"1px solid "+C.border,borderRadius:14,boxShadow:"0 20px 60px rgba(0,0,0,.45)",padding:20,display:"flex",flexDirection:"column",gap:14}}>
          <div style={{fontSize:18,fontWeight:900,color:C.text}}>Aceptar error</div>
          <div style={{fontSize:13,color:C.textSub}}><strong style={{color:C.purple}}>{modalError.maquina}</strong> · {modalError.proyecto} · {fmtFecha(modalError.fecha)} · {modalError._tipo}</div>
          <div style={{fontSize:12,color:C.textSub}}>{modalError.detalle||"Registrá por qué este hallazgo es válido."}</div>
          <label style={{display:"flex",flexDirection:"column",gap:7,fontSize:12,fontWeight:800,color:C.textSub}}>
            Justificación
            <textarea autoFocus value={justificacionError} onChange={event=>setJustificacionError(event.target.value)} placeholder="Escribí la justificación del error aceptado..." rows={4} maxLength={2000} style={{background:C.bg,border:"1px solid "+C.border,color:C.text,borderRadius:8,padding:"10px 12px",resize:"vertical"}}/>
          </label>
          <div style={{fontSize:11,color:C.textMuted,textAlign:"right"}}>{justificacionError.length}/2000</div>
          {mensajeAceptacion?.type==="error"&&<div style={{fontSize:12,fontWeight:800,color:C.red}}>{mensajeAceptacion.text}</div>}
          <div style={{display:"flex",justifyContent:"flex-end",gap:10}}>
            <button disabled={guardandoAceptacion} onClick={()=>setModalError(null)} style={{border:"1px solid "+C.border,background:"transparent",color:C.textSub,borderRadius:8,padding:"9px 14px",fontWeight:800,cursor:"pointer"}}>Cancelar</button>
            <button disabled={guardandoAceptacion} onClick={confirmarAceptacion} style={{border:"1px solid "+C.green+"66",background:C.greenDim,color:C.green,borderRadius:8,padding:"9px 14px",fontWeight:900,cursor:guardandoAceptacion?"wait":"pointer",opacity:guardandoAceptacion?0.65:1}}>{guardandoAceptacion?"Guardando...":"Aceptar error"}</button>
          </div>
        </div>
      </div>,document.body)}
    </div>
  );
}

// ─── ControlPorEquipo ─────────────────────────────────────────────────────────
function ControlPorEquipo({rop02All,extState,setExtState}){
  const rop02Prod=useMemo(()=>rop02All.filter(r=>!r._excluded),[rop02All]);
  const rop02ControlRows=useMemo(()=>rop02Prod.filter(r=>{
    const m=String(r.maquina||"").trim();
    return !/^CAA[-_\s]*0002(?:[-_\s]*JM)?$/i.test(m) && normalizeMachineCode(m)!=="CAA-0002";
  }),[rop02Prod]);
  const MESES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const hoy=new Date();
  const{proyecto,maquina,año,mesIdx,fechaSel,controlActivo,tipoMaquina="todas"}=extState;
  const set=(k,v)=>setExtState(s=>({...s,[k]:v}));
  const setProyecto=v=>set("proyecto",v);
  const setMaquina=v=>set("maquina",v);
  const setAño=v=>set("año",v);
  const setMesIdx=v=>set("mesIdx",v);
  const setFechaSel=v=>set("fechaSel",v);
  const setControlActivo=v=>set("controlActivo",v);

  // En Control por Equipo, el filtro de Mes usa el mes calendario completo
  // Ej.: Junio 2026 = 01/06/2026 → 30/06/2026.
  // No usa el período operativo 26→25 de otras pestañas.
  const periodo=useMemo(()=>{
    const y=parseFloat(año,10);
    const m=Number(mesIdx);
    const mes=String(m+1).padStart(2,"0");
    const ultimoDia=new Date(y,m+1,0).getDate();
    const fechaD=`${y}-${mes}-01`;
    const fechaH=`${y}-${mes}-${String(ultimoDia).padStart(2,"0")}`;
    return{fechaD,fechaH,label:`01/${mes}/${y} → ${String(ultimoDia).padStart(2,"0")}/${mes}/${y}`};
  },[año,mesIdx]);

  const años=useMemo(()=>{
    const ys=new Set(["2026","2027","2028"]);
    rop02ControlRows.forEach(r=>{if(r.fecha)ys.add(r.fecha.slice(0,4));});
    return [...ys].sort();
  },[rop02ControlRows]);

  const rop02ControlTipo=useMemo(()=>rop02ControlRows.filter(r=>dmMatchTipoMaquinaSeleccion(r.maquina,tipoMaquina)),[rop02ControlRows,tipoMaquina]);
  const proyectos=useMemo(()=>uniq(rop02ControlTipo.map(r=>r.proyecto).filter(Boolean)).sort(),[rop02ControlTipo]);
  const maquinas=useMemo(()=>{
    const base=rop02ControlTipo.filter(r=>
      matchMulti(r.proyecto,proyecto,"todos")&&
      r.fecha>=periodo.fechaD&&r.fecha<=periodo.fechaH
    );
    return uniq(base.map(r=>r.maquina).filter(Boolean)).filter(m=>!isRop02ControlMachineExcluded(m)).sort();
  },[rop02ControlTipo,proyecto,periodo]);

  React.useEffect(()=>{
    if(!multiIsAll(maquina,"todas")&&(!maquina.some(m=>maquinas.includes(m)) || maquina.some(m=>isRop02ControlMachineExcluded(m)))){
      setMaquina("todas");
      setFechaSel("");
    }
  },[maquinas,maquina]);// eslint-disable-line

  const filtered=useMemo(()=>rop02ControlTipo.filter(r=>{
    if(!matchMulti(r.proyecto,proyecto,"todos"))return false;
    if(isRop02ControlMachineExcluded(r.maquina))return false;
    if(!matchMulti(r.maquina,maquina,"todas"))return false;
    if(r.fecha<periodo.fechaD||r.fecha>periodo.fechaH)return false;
    return true;
  }),[rop02ControlTipo,proyecto,maquina,periodo]);

  const hayFiltros=!multiIsAll(tipoMaquina,"todas")||!multiIsAll(proyecto,"todos")||!multiIsAll(maquina,"todas")||año!==String(hoy.getFullYear())||mesIdx!==hoy.getMonth();
  const reset=()=>{set("tipoMaquina","todas");setProyecto("todos");setMaquina("todas");setAño(String(hoy.getFullYear()));setMesIdx(hoy.getMonth());setFechaSel("");};

  const fichaMaquina=useMemo(()=>{
    if(!multiIsAll(maquina,"todas"))return maquina[0];
    return maquinas[0]||null;
  },[maquina,maquinas]);

  const equipoData=useMemo(()=>{
    if(!fichaMaquina)return null;
    const rows=filtered.filter(r=>r.maquina===fichaMaquina);
    const byFechaTurno={};
    rows.forEach(r=>{
      const k=r.fecha;
      if(!byFechaTurno[k])byFechaTurno[k]={fecha:k,TD:null,TN:null};
      const turnoKey=(r.turno||"").toUpperCase().includes("NOCHE")?"TN":"TD";
      byFechaTurno[k][turnoKey]=r;
    });
    return Object.values(byFechaTurno).sort((a,b)=>b.fecha.localeCompare(a.fecha));
  },[filtered,fichaMaquina]);

  const fechasDisp=useMemo(()=>(equipoData||[]).map(d=>d.fecha),[equipoData]);
  const equipoIdx=useMemo(()=>fichaMaquina?maquinas.indexOf(fichaMaquina):-1,[maquinas,fichaMaquina]);
  const irEquipoAnterior=useCallback(()=>{
    if(equipoIdx>0){
      setMaquina([maquinas[equipoIdx-1]]);
      setFechaSel("");
    }
  },[equipoIdx,maquinas]);
  const irEquipoSiguiente=useCallback(()=>{
    if(equipoIdx>=0&&equipoIdx<maquinas.length-1){
      setMaquina([maquinas[equipoIdx+1]]);
      setFechaSel("");
    }
  },[equipoIdx,maquinas]);
  const fichaActual=useMemo(()=>{
    if(!equipoData||equipoData.length===0)return null;
    const target=fechaSel&&fechasDisp.includes(fechaSel)?fechaSel:fechasDisp[0];
    return equipoData.find(d=>d.fecha===target)||equipoData[0];
  },[equipoData,fechaSel,fechasDisp]);

  React.useEffect(()=>{
    if(fechasDisp.length>0&&(!fechaSel||!fechasDisp.includes(fechaSel)))setFechaSel(fechasDisp[0]);
  },[fechasDisp]);// eslint-disable-line

  const [editMode,setEditMode]=React.useState(false);
  const [editDraft,setEditDraft]=React.useState({TD:{},TN:{}});
  const [editSaving,setEditSaving]=React.useState(false);
  const [editError,setEditError]=React.useState(null);
  const [editSuccess,setEditSuccess]=React.useState(false);
  const moverFecha=useCallback((direccion)=>{
    const indice=fechasDisp.indexOf(fichaActual?.fecha);
    const siguienteIndice=direccion==="anterior"?indice+1:indice-1;
    if(indice<0||siguienteIndice<0||siguienteIndice>=fechasDisp.length)return false;
    setExtState(estado=>({...estado,fechaSel:fechasDisp[siguienteIndice]}));
    setEditMode(false);
    return true;
  },[fechasDisp,fichaActual?.fecha,setExtState,setEditMode]);
  React.useEffect(()=>{
    const onKeyDown=(event)=>{
      if(event.defaultPrevented||(event.key!=="ArrowLeft"&&event.key!=="ArrowRight"))return;
      const target=event.target;
      if(target instanceof HTMLTextAreaElement||target?.isContentEditable||(target instanceof HTMLInputElement&&target.type!=="date"))return;
      if(moverFecha(event.key==="ArrowLeft"?"anterior":"siguiente"))event.preventDefault();
    };
    window.addEventListener("keydown",onKeyDown);
    return()=>window.removeEventListener("keydown",onKeyDown);
  },[moverFecha]);
  React.useEffect(()=>{
    if(!fichaActual)return;
    const mk=(r)=>r?{parte:String(r.parte||""),hi:r.horometroInicial!=null?String(r.horometroInicial):"",hf:r.horometroFinal!=null?String(r.horometroFinal):"",tarea:String(r.tipo_trabajo||""),obs:String(r.observaciones||""),desgaste:String(r.desgaste||""),combustible:r.combustible!=null&&Number(r.combustible)>0?String(r.combustible):"",aceite:String(r.aceite||""),horas:(r.estado==="OD"||r.estado==="FS"||r.estado==="EM")?String(r.horasRaw||r.estado):(r.horas!=null?String(r.horas):"")}:{};
    setEditDraft({TD:mk(fichaActual.TD),TN:mk(fichaActual.TN)});
    setEditError(null);setEditSuccess(false);
  },[fichaActual,editMode]);// eslint-disable-line
  const getTarget=(r)=>{const p=String(r?.proyecto||"").toUpperCase();if(p.includes("EL ZORRO")||p==="ZORRO")return"rop02_zorro";if(p.includes("FILO SUR")||p.includes("FILOSUR"))return"rop02_filosur";if(p.includes("FILO DEL SOL")||p.includes("FDS")||p.includes("FILO"))return"rop02_fs";if(p.includes("JOSE MARIA")||p.includes("JM"))return"rop02_jm";const proj=Array.isArray(proyecto)?proyecto[0]:proyecto;const ps=String(proj||"").toUpperCase();if(ps.includes("EL ZORRO")||ps==="ZORRO")return"rop02_zorro";if(ps.includes("FILO SUR")||ps.includes("FILOSUR"))return"rop02_filosur";if(ps.includes("FILO DEL SOL")||ps.includes("FDS")||ps.includes("FILO"))return"rop02_fs";return"rop02_jm";};
  const handleSaveEdit=async()=>{
    if(!fichaActual||editSaving)return;
    setEditSaving(true);setEditError(null);setEditSuccess(false);
    try{
      const buildFields=(draft)=>{const horasVal=String(draft.horas||"").trim();const horasOut=/^(OD|FS|EM)$/i.test(horasVal)?horasVal.toUpperCase():(horasVal!==""?Number(horasVal):undefined);return {"N° Parte":draft.parte!==""?draft.parte:undefined,"Horómetro inicial":draft.hi!==""?Number(draft.hi):undefined,"Horómetro final":draft.hf!==""?Number(draft.hf):undefined,"Cant. Hs.":horasOut,"Cant.Hs/ KM":horasOut,"Combustible":draft.combustible!==""?Number(draft.combustible):undefined,"Aceite":draft.aceite!==""?draft.aceite:undefined,"Información sobre Desgaste":draft.desgaste!==""?draft.desgaste:undefined,"Descripción de los trabajos realizados":draft.tarea!==""?draft.tarea:undefined,"Observaciones":draft.obs!==""?draft.obs:undefined};};
      const calls=[];
      for(const turno of["TD","TN"]){const r=fichaActual[turno];if(!r)continue;const target=getTarget(r);if(!target)continue;const rowKey={"Proyecto":r.proyecto||"","Fecha":r.fecha||"","Interno":r._internoRaw||r.maquina||"","Turno de trabajo":r.turno||"","N° Parte":r.parte||""};calls.push(postUpdateROP02Row(target,rowKey,buildFields(editDraft[turno])));}
      await Promise.all(calls);
      setEditSuccess(true);setEditMode(false);
    }catch(err){setEditError(err.message||"Error al guardar");}
    finally{setEditSaving(false);}
  };

  const PINK="#f9a8c9";
  const PINK_BG="rgba(249,168,201,0.22)";
  const PINK_BORDER="rgba(249,168,201,0.70)";
  const PinkBox=({children})=>(
    <span style={{
      display:"inline-block",
      padding:"5px 10px",
      borderRadius:8,
      background:PINK_BG,
      border:`1px solid ${PINK_BORDER}`,
      color:PINK,
      fontWeight:900,
      lineHeight:1.25,
      boxShadow:"0 0 0 1px rgba(249,168,201,0.10) inset",
    }}>{children}</span>
  );
  const isSinCarga=v=>{const s=String(v||"").trim().toLowerCase().replace(/[^a-z]/g,"");return s==="sincarga"||s==="sincargar"||s==="sincargado";};
  const FILAS=[
    {key:"parte",      label:"Parte diario",    render:r=>r?.parte||"—"},
    {key:"hi",         label:"Hi",              render:r=>r?.horometroInicial!=null?r.horometroInicial:"—"},
    {key:"hf",         label:"Hf",              render:r=>r?.horometroFinal!=null?r.horometroFinal:"—"},
    {key:"tarea",      label:"Tarea realizada", render:r=>r?.tipo_trabajo||"—"},
    {key:"obs",        label:"Observaciones",   render:r=>r?.observaciones||"—"},
    {key:"desgaste",   label:"Desgaste",        render:r=>{const v=r?.desgaste||"Sin consumo de desgaste";return String(v).toLowerCase().includes("sin consumo de desgaste")?<PinkBox>{v}</PinkBox>:v;}},
    {key:"combustible",label:"Combustible",     render:r=>{const v=r?.combustible!=null&&Number(r.combustible)>0?fmtNum(r.combustible):"Sin Carga";return isSinCarga(v)?<PinkBox>{v}</PinkBox>:v;}},
    {key:"aceite",     label:"Aceite",          render:r=>{const v=r?.aceite||"Sin Carga";return isSinCarga(v)?<PinkBox>{v}</PinkBox>:v;}},
    {key:"horas",      label:"Cant. Hs.",       render:r=>r?.estado==="OD"||r?.estado==="FS"||r?.estado==="EM"?r.estado:(r?.horas!=null?fmtNum(r.horas):"—")},
  ];

  const cellBg=(r)=>{
    if(!r)return"rgba(180,60,60,0.18)";
    if(r.estado==="OD")return"rgba(34,197,94,0.78)";
    if(r.estado==="FS")return"rgba(232,0,29,0.78)";
    if(r.estado==="EM")return"rgba(168,85,247,0.78)";
    return(r.horas||0)>0?"rgba(40,160,80,0.18)":"rgba(180,60,60,0.18)";
  };
  const cellColor=(r)=>r&&(r.estado==="OD"||r.estado==="FS"||r.estado==="EM")?"#fff":(r?C.text:C.textMuted);

  const selectStyle={
    background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,
    color:C.text,fontSize:12,fontWeight:600,padding:"5px 10px",fontFamily:"Inter",cursor:"pointer",outline:"none",
  };

  const controlIntegridad=useMemo(()=>calcularErroresControlEquipo(filtered),[filtered]);

  const ErrorDato=({label,children,color=C.text})=>(
    <div style={{display:"flex",flexDirection:"column",gap:3,minWidth:120}}>
      <span style={{fontSize:10,color:C.textMuted,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>{label}</span>
      <span style={{fontSize:13,color,fontWeight:800}}>{children}</span>
    </div>
  );

  const renderNumeracion=()=>{
    const errores=controlIntegridad.erroresPartes;
    if(errores.length===0)return <AlertBanner type="success">✅ Sin errores de numeración para los filtros seleccionados.</AlertBanner>;
    return(
      <Card title={`⚠️ Errores de numeración de partes (${errores.length})`}>
        <div style={{padding:14,display:"flex",flexDirection:"column",gap:10}}>
          {errores.map((e,i)=>(
            <div key={i} style={{background:C.redDim,border:`1px solid ${C.red}55`,borderRadius:10,padding:"12px 14px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
              <span style={{fontSize:22}}>⚠️</span>
              <ErrorDato label="Supervisor">{e.supervisor}</ErrorDato>
              <ErrorDato label="Día">{fmtFecha(e.fecha)}</ErrorDato>
              <ErrorDato label="Parte incorrecto" color={C.red}>#{e.numeroIncorrecto}</ErrorDato>
              <ErrorDato label={e.tipo==="TD_TN_NO_CONSECUTIVA"||e.tipo==="TD_TN_CONTINUA"?"Debería decir":"Debería decir"} color={C.yellow}>#{e.numeroCorrecto}</ErrorDato>
              <ErrorDato label="Máquina">{e.maquina}</ErrorDato>
              <ErrorDato label="Turno">{e.turno}</ErrorDato>
              {e.tipo==="TD_TN_CONTINUA"&&<ErrorDato label="Parte TD" color={C.textSub}>#{e.parteAnterior}</ErrorDato>}
              {e.detalle&&<ErrorDato label="Detalle" color={C.red}>{e.detalle}</ErrorDato>}
            </div>
          ))}
        </div>
      </Card>
    );
  };

  const renderHorometros=()=>{
    const errores=controlIntegridad.erroresHoro;
    if(errores.length===0)return <AlertBanner type="success">✅ Sin cortes de horómetro para los filtros seleccionados.</AlertBanner>;
    const cols=["Proyecto","Máquina","Día con error","Turno con error","Supervisor","N° parte","Día anterior","Turno anterior","Hi informado","Hf anterior esperado","Diferencia","Detalle"];
    const descargarHoro=()=>{
      const wb=XLSX.utils.book_new();
      const data=[cols,...errores.map(e=>[e.proyecto,e.maquina,e.fecha,e.turno,e.supervisor,e.parte,e.fechaAnterior,e.turnoAnterior,e.hiActual,e.hfAnterior,e.diff,e.detalle||""])];
      const ws=XLSX.utils.aoa_to_sheet(data);
      ws["!cols"]=cols.map(h=>({wch:Math.max(h.length+2,12)}));
      XLSX.utils.book_append_sheet(wb,ws,"Errores Horómetros");
      XLSX.writeFile(wb,"Control_Horometros.xlsx");
    };
    return(
      <Card title={`⚠️ Control de horómetros (${errores.length})`} action={<BtnExcel onClick={descargarHoro}/>}>
        <div className="dm-table-scroll" style={{overflowX:"auto",overflowY:"auto",maxHeight:520,scrollbarGutter:"stable"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:860}}>
            <thead><tr style={{background:C.surface}}>{cols.map(h=><th key={h} style={{padding:"8px 12px",fontSize:11,fontWeight:700,color:C.textMuted,textAlign:"left",borderBottom:`1px solid ${C.border}`}}>{h}</th>)}</tr></thead>
            <tbody>
              {errores.map((e,i)=>(
                <tr key={i} style={{background:i%2===0?C.red+"0a":"transparent"}}>
                  <td style={{padding:"8px 12px",borderBottom:`1px solid ${C.border}18`}}>{e.proyecto}</td>
                  <td style={{padding:"8px 12px",borderBottom:`1px solid ${C.border}18`}}><Badge color={C.purple}>{e.maquina}</Badge></td>
                  <td style={{padding:"8px 12px",borderBottom:`1px solid ${C.border}18`,fontWeight:700}}>{fmtFecha(e.fecha)}</td>
                  <td style={{padding:"8px 12px",borderBottom:`1px solid ${C.border}18`}}><Badge color={e.turno==="TD"?C.blue:C.purple}>{e.turno}</Badge></td>
                  <td style={{padding:"8px 12px",borderBottom:`1px solid ${C.border}18`}}>{e.supervisor}</td>
                  <td style={{padding:"8px 12px",borderBottom:`1px solid ${C.border}18`,color:C.blue,fontWeight:700}}>#{e.parte}</td>
                  <td style={{padding:"8px 12px",borderBottom:`1px solid ${C.border}18`,fontWeight:700}}>{fmtFecha(e.fechaAnterior)}</td>
                  <td style={{padding:"8px 12px",borderBottom:`1px solid ${C.border}18`}}><Badge color={e.turnoAnterior==="TD"?C.blue:C.purple}>{e.turnoAnterior}</Badge></td>
                  <td style={{padding:"8px 12px",borderBottom:`1px solid ${C.border}18`,color:C.red,fontWeight:800}}>{fmtNum(e.hiActual)}</td>
                  <td style={{padding:"8px 12px",borderBottom:`1px solid ${C.border}18`,color:C.yellow,fontWeight:800}}>{fmtNum(e.hfAnterior)}</td>
                  <td style={{padding:"8px 12px",borderBottom:`1px solid ${C.border}18`}}><Badge color={e.diff===0?C.red:(e.diff>0?C.yellow:C.red)}>{e.diff>0?`+${fmtNum(e.diff)}`:fmtNum(e.diff)}</Badge></td>
                  <td style={{padding:"8px 12px",borderBottom:`1px solid ${C.border}18`,color:C.red,fontWeight:700,minWidth:220}}>{e.detalle||"—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    );
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <Card>
        <div style={{padding:"12px 14px",display:"flex",flexWrap:"wrap",gap:10,alignItems:"flex-end"}}>
          <Sel label="Mes" value={String(mesIdx)} onChange={v=>{setMesIdx(Number(v));setFechaSel("");}} options={MESES.map((m,i)=>({value:String(i),label:m}))}/>
          <Sel label="Año" value={año} onChange={v=>{setAño(v);setFechaSel("");}} options={años.map(y=>({value:y,label:y}))}/>
          <MultiSel label="Tipo de Máquina" value={tipoMaquina} onChange={v=>{set("tipoMaquina",v);setMaquina("todas");setFechaSel("");}} options={dmTipoMaquinaOptions()}/>
          <MultiSel label="Proyecto" value={proyecto} onChange={v=>{setProyecto(v);setMaquina("todas");setFechaSel("");}} options={[{value:"todos",label:"Todos"},...proyectos.map(p=>({value:p,label:p}))]}/>
          <MultiSel label="Máquina" value={maquina} onChange={v=>{setMaquina(v);setFechaSel("");}} options={[{value:"todas",label:"Todas"},...maquinas.map(m=>({value:m,label:m}))]}/>
          <div style={{fontSize:11,color:C.textSub,padding:"7px 10px",border:`1px solid ${C.border}`,borderRadius:7,background:C.surface}}>Período: <strong style={{color:C.text}}>{periodo.label}</strong></div>
          <button onClick={reset} style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,border:`1px solid ${C.red}44`,background:C.redDim,color:C.red,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"Inter",opacity:hayFiltros?1:0.3,pointerEvents:hayFiltros?"auto":"none"}}>
            <Icon name="close" size={11} color={C.red}/>Limpiar filtros
          </button>
        </div>
      </Card>

      {!fichaMaquina?(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Card title="¿Qué hace esta pestaña?">
            <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:8,fontSize:12,color:C.textSub,lineHeight:1.6}}>
              <p style={{margin:0}}>Acá podés ver, día por día y turno por turno (TD/TN), el detalle completo de un equipo: parte diario, horómetros, tarea realizada, observaciones, desgaste, combustible y aceite.</p>
              <p style={{margin:0}}>Además, corre dos controles automáticos sobre el período filtrado:</p>
              <ul style={{margin:"0 0 0 18px",padding:0}}>
                <li><strong style={{color:C.text}}>Numeración de partes</strong>: que el número de parte sea consecutivo entre el último turno de un día y el primero del día siguiente.</li>
                <li><strong style={{color:C.text}}>Horómetros</strong>: que el horómetro final de un turno coincida con el horómetro inicial del turno siguiente.</li>
              </ul>
              <p style={{margin:0}}>Elegí un <strong style={{color:C.text}}>proyecto</strong> y una <strong style={{color:C.text}}>máquina</strong> arriba para empezar.</p>
            </div>
          </Card>
          <AlertBanner type="info">No hay máquinas disponibles para los filtros seleccionados.</AlertBanner>
        </div>
      ):!fichaActual?(
        <AlertBanner type="warn">No hay registros para {fichaMaquina} en {MESES[mesIdx]} {año}.</AlertBanner>
      ):(
        <Card>
          {multiIsAll(maquina,"todas")&&(
            <div style={{padding:"8px 14px",borderBottom:`1px solid ${C.border}`}}>
              <AlertBanner type="info">Mostrando la primera máquina del filtro ({fichaMaquina}). Elegí otra desde el desplegable de la tabla para ver su ficha.</AlertBanner>
            </div>
          )}
          <div style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",borderBottom:`1px solid ${C.border}22`}}>
            <select value={fichaMaquina||""} onChange={e=>{setMaquina([e.target.value]);setEditMode(false);}} style={selectStyle}>{maquinas.map(m=><option key={m} value={m}>{m}</option>)}</select>
            <select value={fichaActual.fecha} onChange={e=>{setFechaSel(e.target.value);setEditMode(false);}} style={{...selectStyle,fontSize:13,fontWeight:700,color:C.accent,minWidth:140}}>{fechasDisp.map(f=><option key={f} value={f}>{fmtFecha(f)}</option>)}</select>
            <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
              {editSuccess&&!editMode&&<span style={{fontSize:12,color:"#4ade80",fontWeight:700}}>✓ Guardado</span>}
              {editMode&&<><button onClick={handleSaveEdit} disabled={editSaving} style={{padding:"7px 20px",borderRadius:7,border:"none",background:"#22c55e",color:"#fff",cursor:editSaving?"not-allowed":"pointer",fontSize:13,fontWeight:800,fontFamily:"Inter",opacity:editSaving?0.6:1}}>{editSaving?"Guardando…":"💾 Guardar"}</button><button onClick={()=>{setEditMode(false);setEditError(null);}} disabled={editSaving} style={{padding:"7px 14px",borderRadius:7,border:`1px solid ${C.border}`,background:C.surface,color:C.textSub,cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"Inter"}}>Cancelar</button></>}
            </div>
          </div>
          {editError&&<div style={{padding:"8px 14px",background:"rgba(220,38,38,0.18)",color:"#f87171",fontSize:12,fontWeight:600}}>{editError}</div>}
          {(()=>{
            const inpStyle={width:"100%",background:"rgba(255,255,255,0.06)",border:`1px solid ${C.accent}66`,borderRadius:6,color:C.text,fontSize:14,padding:"5px 8px",fontFamily:"Inter",outline:"none",boxSizing:"border-box"};
            const FIELD_CFG={parte:{type:"text"},hi:{type:"number"},hf:{type:"number"},tarea:{type:"text"},obs:{type:"text"},desgaste:{type:"text"},combustible:{type:"number"},aceite:{type:"text"},horas:{type:"text"}};
            return(
              <div className="dm-table-scroll" style={{overflowX:"auto",overflowY:"auto",maxHeight:520,scrollbarGutter:"stable"}}>
                <table style={{width:"100%",borderCollapse:"collapse",minWidth:480,tableLayout:"fixed"}}>
                  <colgroup><col style={{width:190}}/><col style={{width:"50%"}}/><col style={{width:"50%"}}/></colgroup>
                  <thead><tr><th style={{padding:"7px 14px",background:C.surface+"cc",borderBottom:`1px solid ${C.border}`}}/>{["TD","TN"].map(t=><th key={t} style={{padding:"10px 16px",background:C.surface+"cc",borderBottom:`1px solid ${C.border}`,textAlign:"center",fontSize:16,fontWeight:900,color:C.textSub,letterSpacing:".06em"}}>{t}</th>)}</tr></thead>
                  <tbody>
                    {FILAS.map(({key,label,render})=>{
                      const rTD=fichaActual.TD; const rTN=fichaActual.TN;
                      const renderCell=(turno,r)=>{if(!editMode)return render(r);if(!r)return <span style={{color:C.textMuted}}>—</span>;const val=editDraft[turno]?.[key]??"";return<input type={FIELD_CFG[key]?.type||"text"} value={val} onChange={e=>setEditDraft(d=>({...d,[turno]:{...d[turno],[key]:e.target.value}}))} style={inpStyle}/>;};
                      return(<tr key={key}><td style={{padding:"11px 16px",fontWeight:900,fontSize:14,color:C.textSub,background:C.surface+"55",borderBottom:`1px solid ${C.border}22`,borderRight:`1px solid ${C.border}22`}}>{label}</td><td style={{padding:editMode?"8px 10px":"13px 18px",fontSize:16,color:cellColor(rTD),background:cellBg(rTD),borderBottom:`1px solid ${C.border}22`,borderRight:`1px solid ${C.border}22`,verticalAlign:"middle",lineHeight:1.5,fontWeight:800}}>{renderCell("TD",rTD)}</td><td style={{padding:editMode?"8px 10px":"13px 18px",fontSize:16,color:cellColor(rTN),background:cellBg(rTN),borderBottom:`1px solid ${C.border}22`,verticalAlign:"middle",lineHeight:1.5,fontWeight:800}}>{renderCell("TN",rTN)}</td></tr>);
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
          {(fechasDisp.length>1||maquinas.length>1)&&(
            <div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:8,borderTop:`1px solid ${C.border}22`}}>
              {fechasDisp.length>1&&(<div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}><span style={{fontSize:11,color:C.textSub,minWidth:75}}>{fechasDisp.indexOf(fichaActual.fecha)+1} / {fechasDisp.length} fechas</span><button onClick={()=>{const i=fechasDisp.indexOf(fichaActual.fecha);if(i<fechasDisp.length-1){setFechaSel(fechasDisp[i+1]);setEditMode(false);}}} style={{...selectStyle,padding:"4px 10px"}}>← Anterior</button><button onClick={()=>{const i=fechasDisp.indexOf(fichaActual.fecha);if(i>0){setFechaSel(fechasDisp[i-1]);setEditMode(false);}}} style={{...selectStyle,padding:"4px 10px"}}>Siguiente →</button></div>)}
              {maquinas.length>1&&(<div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",paddingTop:fechasDisp.length>1?6:0,borderTop:fechasDisp.length>1?`1px solid ${C.border}18`:undefined}}><span style={{fontSize:11,color:C.textSub,minWidth:75}}>{equipoIdx+1} / {maquinas.length} equipos</span><button onClick={irEquipoAnterior} disabled={equipoIdx<=0} style={{...selectStyle,padding:"4px 10px",opacity:equipoIdx<=0?0.45:1,cursor:equipoIdx<=0?"not-allowed":"pointer"}}>← Equipo anterior</button><button onClick={irEquipoSiguiente} disabled={equipoIdx<0||equipoIdx>=maquinas.length-1} style={{...selectStyle,padding:"4px 10px",opacity:(equipoIdx<0||equipoIdx>=maquinas.length-1)?0.45:1,cursor:(equipoIdx<0||equipoIdx>=maquinas.length-1)?"not-allowed":"pointer"}}>Equipo siguiente →</button></div>)}
            </div>
          )}
        </Card>
      )}

      <Card>
        <div style={{padding:"10px 14px",display:"flex",gap:8,flexWrap:"wrap"}}>
          <TabBtn active={controlActivo==="numeracion"} onClick={()=>setControlActivo("numeracion")}>Numeración de partes ({controlIntegridad.erroresPartes.length})</TabBtn>
          <TabBtn active={controlActivo==="horometros"} onClick={()=>setControlActivo("horometros")}>Control de horómetros ({controlIntegridad.erroresHoro.length})</TabBtn>
        </div>
      </Card>

      {controlActivo==="numeracion"?renderNumeracion():renderHorometros()}
    </div>
  );
}

// ─── ControlRMA15PorEquipo ───────────────────────────────────────────────────
function ControlRMA15PorEquipo({rma15,extState,setExtState}){
  const MESES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const hoy=new Date();
  const proyecto=extState?.proyecto||"todos";
  const maquina=extState?.maquina||"todas";
  const año=extState?.año||String(hoy.getFullYear());
  const mesIdx=Number(extState?.mesIdx??hoy.getMonth());
  const fechaSel=extState?.fechaSel||"";
  const tipoMaquina=extState?.tipoMaquina||"todas";
  const set=(k,v)=>setExtState(s=>({...s,[k]:v}));
  const setProyecto=v=>set("proyecto",v);
  const setMaquina=v=>set("maquina",v);
  const setAño=v=>set("año",v);
  const setMesIdx=v=>set("mesIdx",v);
  const setFechaSel=v=>set("fechaSel",v);

  // En Control por Equipo, el filtro de Mes usa el mes calendario completo
  // Ej.: Junio 2026 = 01/06/2026 → 30/06/2026.
  // No usa el período operativo 26→25 de otras pestañas.
  const periodo=useMemo(()=>{
    const y=parseFloat(año,10);
    const m=Number(mesIdx);
    const mes=String(m+1).padStart(2,"0");
    const ultimoDia=new Date(y,m+1,0).getDate();
    const fechaD=`${y}-${mes}-01`;
    const fechaH=`${y}-${mes}-${String(ultimoDia).padStart(2,"0")}`;
    return{fechaD,fechaH,label:`01/${mes}/${y} → ${String(ultimoDia).padStart(2,"0")}/${mes}/${y}`};
  },[año,mesIdx]);

  const años=useMemo(()=>{
    const ys=new Set(["2026","2027","2028"]);
    (rma15||[]).forEach(r=>{if(r.fecha)ys.add(String(r.fecha).slice(0,4));});
    return [...ys].sort();
  },[rma15]);

  const rma15Tipo=useMemo(()=>(rma15||[]).filter(r=>dmMatchTipoMaquinaSeleccion(r.maquina,tipoMaquina)),[rma15,tipoMaquina]);
  const proyectos=useMemo(()=>uniq(rma15Tipo.map(r=>r.proyecto).filter(Boolean)).sort(),[rma15Tipo]);
  const maquinas=useMemo(()=>{
    const base=rma15Tipo.filter(r=>
      matchMulti(r.proyecto,proyecto,"todos")&&
      r.fecha>=periodo.fechaD&&r.fecha<=periodo.fechaH
    );
    return uniq(base.map(r=>r.maquina).filter(Boolean)).sort();
  },[rma15Tipo,proyecto,periodo]);

  const filtered=useMemo(()=>(rma15||[]).filter(r=>{
    if(!matchMulti(r.proyecto,proyecto,"todos"))return false;
    if(!matchMulti(r.maquina,maquina,"todas"))return false;
    if(r.fecha<periodo.fechaD||r.fecha>periodo.fechaH)return false;
    return true;
  }),[rma15Tipo,proyecto,maquina,periodo]);

  const fichaMaquina=useMemo(()=>{
    if(!multiIsAll(maquina,"todas"))return Array.isArray(maquina)?maquina[0]:maquina;
    return maquinas[0]||null;
  },[maquina,maquinas]);

  const turnoKey=r=>String(r?.turno||"").toUpperCase().includes("NOCHE")?"TN":"TD";
  const joinUnique=(arr,sep=" / ")=>uniq(arr.map(v=>String(v||"").trim()).filter(Boolean)).join(sep)||"—";
  const combineRecords=(items=[])=>{
    if(!items.length)return null;
    const insMap={};
    items.forEach(r=>(r.insumos||[]).forEach(i=>{
      const cod=String(i.codigo||"").trim()||"S/C";
      const key=`${cod}__${String(i.nombre||"").trim()}`;
      if(!insMap[key])insMap[key]={codigo:cod,nombre:String(i.nombre||cod).trim(),cantidad:0};
      insMap[key].cantidad+=(Number(i.cantidad)||0);
    }));
    const insumos=Object.values(insMap);
    return{
      fecha:items[0].fecha,
      proyecto:joinUnique(items.map(r=>r.proyecto)),
      maquina:items[0].maquina,
      turno:items[0].turno,
      tipoMant:joinUnique(items.map(r=>r.tipoMant)),
      kmHs:items.map(r=>r.kmHs).filter(v=>v!==null&&v!==undefined&&String(v)!=="").map(fmtNum).join(" / ")||"—",
      reparacion:joinUnique(items.map(r=>r.intervencion),"\n\n"),
      operativo:items.every(r=>r.operativo)?"SI":(items.some(r=>r.operativo)?"PARCIAL":"NO"),
      observaciones:joinUnique(items.map(r=>r.observaciones),"\n\n"),
      insumos,
    };
  };

  const equipoData=useMemo(()=>{
    if(!fichaMaquina)return null;
    const rows=filtered.filter(r=>r.maquina===fichaMaquina);
    const byFechaTurno={};
    rows.forEach(r=>{
      const k=r.fecha;
      if(!byFechaTurno[k])byFechaTurno[k]={fecha:k,TD:[],TN:[]};
      byFechaTurno[k][turnoKey(r)].push(r);
    });
    return Object.values(byFechaTurno).map(d=>({fecha:d.fecha,TD:combineRecords(d.TD),TN:combineRecords(d.TN)})).sort((a,b)=>b.fecha.localeCompare(a.fecha));
  },[filtered,fichaMaquina]);

  const fechasDisp=useMemo(()=>(equipoData||[]).map(d=>d.fecha),[equipoData]);
  const fichaActual=useMemo(()=>{
    if(!equipoData||equipoData.length===0)return null;
    const target=fechaSel&&fechasDisp.includes(fechaSel)?fechaSel:fechasDisp[0];
    return equipoData.find(d=>d.fecha===target)||equipoData[0];
  },[equipoData,fechaSel,fechasDisp]);
  React.useEffect(()=>{if(fechasDisp.length>0&&(!fechaSel||!fechasDisp.includes(fechaSel)))setFechaSel(fechasDisp[0]);},[fechasDisp]);// eslint-disable-line
  const moverFecha=useCallback((direccion)=>{
    const indice=fechasDisp.indexOf(fichaActual?.fecha);
    const siguienteIndice=direccion==="anterior"?indice+1:indice-1;
    if(indice<0||siguienteIndice<0||siguienteIndice>=fechasDisp.length)return false;
    setExtState(estado=>({...estado,fechaSel:fechasDisp[siguienteIndice]}));
    return true;
  },[fechasDisp,fichaActual?.fecha,setExtState]);
  React.useEffect(()=>{
    const onKeyDown=(event)=>{
      if(event.defaultPrevented||(event.key!=="ArrowLeft"&&event.key!=="ArrowRight"))return;
      const target=event.target;
      if(target instanceof HTMLTextAreaElement||target?.isContentEditable||(target instanceof HTMLInputElement&&target.type!=="date"))return;
      if(moverFecha(event.key==="ArrowLeft"?"anterior":"siguiente"))event.preventDefault();
    };
    window.addEventListener("keydown",onKeyDown);
    return()=>window.removeEventListener("keydown",onKeyDown);
  },[moverFecha]);

  const equipoIdx=useMemo(()=>fichaMaquina?maquinas.indexOf(fichaMaquina):-1,[maquinas,fichaMaquina]);
  const irEquipoAnterior=useCallback(()=>{if(equipoIdx>0){setMaquina([maquinas[equipoIdx-1]]);setFechaSel("");}},[equipoIdx,maquinas]);
  const irEquipoSiguiente=useCallback(()=>{if(equipoIdx>=0&&equipoIdx<maquinas.length-1){setMaquina([maquinas[equipoIdx+1]]);setFechaSel("");}},[equipoIdx,maquinas]);
  const hayFiltros=!multiIsAll(tipoMaquina,"todas")||!multiIsAll(proyecto,"todos")||!multiIsAll(maquina,"todas")||año!==String(hoy.getFullYear())||mesIdx!==hoy.getMonth();
  const reset=()=>{set("tipoMaquina","todas");setProyecto("todos");setMaquina("todas");setAño(String(hoy.getFullYear()));setMesIdx(hoy.getMonth());setFechaSel("");};

  const selectStyle={background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:12,fontWeight:600,padding:"5px 10px",fontFamily:"Inter",cursor:"pointer",outline:"none"};
  const PinkBox=({children})=><span style={{display:"inline-block",padding:"5px 10px",borderRadius:8,background:"rgba(249,168,201,0.22)",border:"1px solid rgba(249,168,201,0.70)",color:"#f9a8c9",fontWeight:900,lineHeight:1.25}}>{children}</span>;
  const cellBg=(r)=>!r?"rgba(180,60,60,0.18)":(r.operativo==="NO"?"rgba(232,0,29,0.38)":"rgba(40,160,80,0.28)");
  const cellColor=r=>r?C.text:C.textMuted;
  const renderInsumos=r=>{
    if(!r||!r.insumos||!r.insumos.length)return <PinkBox>Sin insumos utilizados</PinkBox>;
    return <div style={{display:"flex",flexDirection:"column",gap:6}}>{r.insumos.map((i,idx)=>(
      <div key={idx} style={{display:"grid",gridTemplateColumns:"70px 95px 1fr",gap:8,alignItems:"start",fontSize:13,lineHeight:1.3}}>
        <span><b style={{color:C.textSub}}>Cant.</b> {fmtNum(i.cantidad)}</span>
        <Badge color={C.purple}>{i.codigo}</Badge>
        <span>{i.nombre||"—"}</span>
      </div>
    ))}</div>;
  };
  const FILAS=[
    {key:"tipoMant",label:"TIPO DE MANTENIMIENTO",render:r=>r?.tipoMant||"—"},
    {key:"kmHs",label:"KM/HS",render:r=>r?.kmHs||"—"},
    {key:"reparacion",label:"REPARACION",render:r=><span style={{whiteSpace:"pre-wrap"}}>{r?.reparacion||"—"}</span>},
    {key:"operativo",label:"EQUIPO OPERATIVO?",render:r=>r?<Badge color={r.operativo==="NO"?C.red:r.operativo==="PARCIAL"?C.yellow:C.green}>{r.operativo}</Badge>:"—"},
    {key:"observaciones",label:"OBSERVACIONES",render:r=><span style={{whiteSpace:"pre-wrap"}}>{r?.observaciones||"—"}</span>},
    {key:"insumos",label:"INSUMOS UTILIZADOS",render:renderInsumos},
  ];

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <Card>
        <div style={{padding:"12px 14px",display:"flex",flexWrap:"wrap",gap:10,alignItems:"flex-end"}}>
          <Sel label="Mes" value={String(mesIdx)} onChange={v=>{setMesIdx(Number(v));setFechaSel("");}} options={MESES.map((m,i)=>({value:String(i),label:m}))}/>
          <Sel label="Año" value={año} onChange={v=>{setAño(v);setFechaSel("");}} options={años.map(y=>({value:y,label:y}))}/>
          <MultiSel label="Tipo de Máquina" value={tipoMaquina} onChange={v=>{set("tipoMaquina",v);setMaquina("todas");setFechaSel("");}} options={dmTipoMaquinaOptions()}/>
          <MultiSel label="Proyecto" value={proyecto} onChange={v=>{setProyecto(v);setMaquina("todas");setFechaSel("");}} options={[{value:"todos",label:"Todos"},...proyectos.map(p=>({value:p,label:p}))]}/>
          <MultiSel label="Máquina" value={maquina} onChange={v=>{setMaquina(v);setFechaSel("");}} options={[{value:"todas",label:"Todas"},...maquinas.map(m=>({value:m,label:m}))]}/>
          <div style={{fontSize:11,color:C.textSub,padding:"7px 10px",border:`1px solid ${C.border}`,borderRadius:7,background:C.surface}}>Período: <strong style={{color:C.text}}>{periodo.label}</strong></div>
          <button onClick={reset} style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,border:`1px solid ${C.red}44`,background:C.redDim,color:C.red,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"Inter",opacity:hayFiltros?1:0.3,pointerEvents:hayFiltros?"auto":"none"}}>× Limpiar filtros</button>
        </div>
      </Card>

      {!fichaMaquina?(
        <AlertBanner type="info">No hay equipos de RMA15 disponibles para los filtros seleccionados.</AlertBanner>
      ):!fichaActual?(
        <AlertBanner type="warn">No hay registros de mantenimiento para {fichaMaquina} en {MESES[mesIdx]} {año}.</AlertBanner>
      ):(
        <Card>
          {multiIsAll(maquina,"todas")&&(
            <div style={{padding:"8px 14px",borderBottom:`1px solid ${C.border}`}}>
              <AlertBanner type="info">Mostrando la primera máquina del filtro ({fichaMaquina}). Elegí otra desde el desplegable de la tabla para ver su ficha.</AlertBanner>
            </div>
          )}
          <div style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",borderBottom:`1px solid ${C.border}22`}}>
            <select value={fichaMaquina||""} onChange={e=>{setMaquina([e.target.value]);}} style={selectStyle}>{maquinas.map(m=><option key={m} value={m}>{m}</option>)}</select>
            <select value={fichaActual.fecha} onChange={e=>{setFechaSel(e.target.value);}} style={{...selectStyle,fontSize:13,fontWeight:700,color:C.accent,minWidth:140}}>{fechasDisp.map(f=><option key={f} value={f}>{fmtFecha(f)}</option>)}</select>
          </div>
          <div className="dm-table-scroll" style={{overflowX:"auto",overflowY:"auto",maxHeight:520,scrollbarGutter:"stable"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:620,tableLayout:"fixed"}}>
              <colgroup><col style={{width:230}}/><col style={{width:"50%"}}/><col style={{width:"50%"}}/></colgroup>
              <thead><tr><th style={{padding:"7px 14px",background:C.surface+"cc",borderBottom:`1px solid ${C.border}`}}/>{["TD","TN"].map(t=><th key={t} style={{padding:"10px 16px",background:C.surface+"cc",borderBottom:`1px solid ${C.border}`,textAlign:"center",fontSize:16,fontWeight:900,color:C.textSub,letterSpacing:".06em"}}>{t}</th>)}</tr></thead>
              <tbody>
                {FILAS.map(({key,label,render})=>{
                  const rTD=fichaActual.TD; const rTN=fichaActual.TN;
                  return(<tr key={key}><td style={{padding:"11px 16px",fontWeight:900,fontSize:13,color:C.textSub,background:C.surface+"55",borderBottom:`1px solid ${C.border}22`,borderRight:`1px solid ${C.border}22`}}>{label}</td><td style={{padding:"13px 18px",fontSize:15,color:cellColor(rTD),background:cellBg(rTD),borderBottom:`1px solid ${C.border}22`,borderRight:`1px solid ${C.border}22`,verticalAlign:"top",lineHeight:1.5,fontWeight:800}}>{render(rTD)}</td><td style={{padding:"13px 18px",fontSize:15,color:cellColor(rTN),background:cellBg(rTN),borderBottom:`1px solid ${C.border}22`,verticalAlign:"top",lineHeight:1.5,fontWeight:800}}>{render(rTN)}</td></tr>);
                })}
              </tbody>
            </table>
          </div>
          {(fechasDisp.length>1||maquinas.length>1)&&(
            <div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:8,borderTop:`1px solid ${C.border}22`}}>
              {fechasDisp.length>1&&(<div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}><span style={{fontSize:11,color:C.textSub,minWidth:75}}>{fechasDisp.indexOf(fichaActual.fecha)+1} / {fechasDisp.length} fechas</span><button onClick={()=>{const i=fechasDisp.indexOf(fichaActual.fecha);if(i<fechasDisp.length-1)setFechaSel(fechasDisp[i+1]);}} style={{...selectStyle,padding:"4px 10px"}}>← Anterior</button><button onClick={()=>{const i=fechasDisp.indexOf(fichaActual.fecha);if(i>0)setFechaSel(fechasDisp[i-1]);}} style={{...selectStyle,padding:"4px 10px"}}>Siguiente →</button></div>)}
              {maquinas.length>1&&(<div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",paddingTop:fechasDisp.length>1?6:0,borderTop:fechasDisp.length>1?`1px solid ${C.border}18`:undefined}}><span style={{fontSize:11,color:C.textSub,minWidth:75}}>{equipoIdx+1} / {maquinas.length} equipos</span><button onClick={irEquipoAnterior} disabled={equipoIdx<=0} style={{...selectStyle,padding:"4px 10px",opacity:equipoIdx<=0?0.45:1,cursor:equipoIdx<=0?"not-allowed":"pointer"}}>← Equipo anterior</button><button onClick={irEquipoSiguiente} disabled={equipoIdx<0||equipoIdx>=maquinas.length-1} style={{...selectStyle,padding:"4px 10px",opacity:(equipoIdx<0||equipoIdx>=maquinas.length-1)?0.45:1,cursor:(equipoIdx<0||equipoIdx>=maquinas.length-1)?"not-allowed":"pointer"}}>Equipo siguiente →</button></div>)}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}


function ViewAtrasoROP02({rop02All,onLegacyFallback}){
  const [remoteRop02,setRemoteRop02]=useState(null);
  const legacyFallbackRef=useRef(onLegacyFallback);
  useEffect(()=>{legacyFallbackRef.current=onLegacyFallback;},[onLegacyFallback]);
  useEffect(()=>{
    let active=true;
    const run=async()=>{
      const latest=await getRop02LatestByEquipmentProject({});
      const rawLatest=Array.isArray(latest.data)?latest.data:[];
      const reference=String(latest.referenceDate||rawLatest.reduce((max,row)=>String(row.ULTIMA_FECHA||row.ultimaCarga||"")>max?String(row.ULTIMA_FECHA||row.ultimaCarga):max,""));
      if(!reference)throw new Error("Snapshot ROP02 sin fecha de referencia");
      const start=new Date(`${reference}T12:00:00`);start.setDate(start.getDate()-45);
      const desde=`${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,"0")}-${String(start.getDate()).padStart(2,"0")}`;
      const recent=await getRop02({desde,hasta:reference,limit:"all",sortBy:"fecha",sortDirection:"asc"});
      const normalizedRecent=normalizeROP02(recent.data||[]);
      const recentKeys=new Set(normalizedRecent.map(row=>equipmentProjectKey(canonicalEquivalentMachineCode(row.maquina),row.proyecto)));
      const synthetic=rawLatest.map(row=>({
        fecha:String(row.ULTIMA_FECHA||row.ultimaCarga||""),maquina:String(row.INTERNO||row.equipo||row.maquina||""),
        proyecto:String(row.PROYECTO||row.proyecto||""),supervisor:String(row.SUPERVISOR||row.supervisor||""),
        horas:Number(row.HORAS??row.horas??0),estado:String(row.ULTIMO_ESTADO||row.ultimoEstado||""),tipo_trabajo:String(row.ULTIMO_ESTADO||row.ultimoEstado||""),
        _snapshot:true,_excluded:false
      })).filter(row=>row.fecha&&row.maquina&&!recentKeys.has(equipmentProjectKey(canonicalEquivalentMachineCode(row.maquina),row.proyecto)));
      if(active)setRemoteRop02([...normalizedRecent,...synthetic]);
    };
    run().catch(()=>{if(active){setRemoteRop02(null);legacyFallbackRef.current?.();}});
    return()=>{active=false;};
  },[]);
  const atrasoSource=remoteRop02||rop02All;
  const rop02Prod=useMemo(()=>atrasoSource.filter(r=>!r._excluded && normalizeMachineCode(r.maquina)!=="CAA-0002" && r.fecha),[atrasoSource]);
  const [modoFiltro,setModoFiltro]=useState("periodo");
  const [fechaFiltro,setFechaFiltro]=useState("");
  const [fechaDesde,setFechaDesde]=useState("");
  const [fechaHasta,setFechaHasta]=useState("");
  const [tipoMaquinaFiltro,setTipoMaquinaFiltro]=useState("todas");
  const [proyectoFiltro,setProyectoFiltro]=useState("todos");
  const [maquinaFiltro,setMaquinaFiltro]=useState("todas");
  const {admitidos,movements,loading:movimientosLoading,error:movimientosError}=useEquipmentMovements(rop02Prod,["atrasoROP02","controlROP02"]);
  const [modalAtraso,setModalAtraso]=useState(null);
  const [motivoTipo,setMotivoTipo]=useState("Bajó a San Juan");
  const [motivoOtro,setMotivoOtro]=useState("");
  const [proyectoDestino,setProyectoDestino]=useState("");
  const [savingMovimiento,setSavingMovimiento]=useState(false);
  const [movimientoMsg,setMovimientoMsg]=useState("");
  const hoyISO=useMemo(()=>{
    const d=new Date();
    d.setMinutes(d.getMinutes()-d.getTimezoneOffset());
    return d.toISOString().slice(0,10);
  },[]);
  const keyEquipoAtraso=useCallback((maquina)=>canonicalEquivalentMachineCode(String(maquina||"").replace(/[-\s]*\(.*?\)/g,"")).replace(/[-_]JM$/i,""),[]);

  const data=useMemo(()=>{
    const dayMs=86400000;
    const toDate=iso=>new Date(iso+"T00:00:00");
    const diffDias=(a,b)=>Math.floor((toDate(a)-toDate(b))/dayMs);
    const addDays=(iso,n)=>{const d=toDate(iso);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
    const fechasEntre=(desde,hasta)=>{
      const out=[];
      const d=toDate(desde);
      const h=toDate(hasta);
      d.setDate(d.getDate()+1);
      while(d<h){out.push(d.toISOString().slice(0,10));d.setDate(d.getDate()+1);}
      return out;
    };

    const fechas=uniq(rop02Prod.map(r=>r.fecha)).sort();
    const ultimaFecha=fechas[fechas.length-1]||"";
    const diasAtraso=ultimaFecha?diffDias(hoyISO,ultimaFecha):null;
    const rowsUltima=ultimaFecha?rop02Prod.filter(r=>r.fecha===ultimaFecha):[];
    const presentesUltima=new Set(rowsUltima.map(r=>equipmentProjectKey(keyEquipoAtraso(r.maquina),r.proyecto)).filter(Boolean));

    const recordsByEquipmentProject=new Map();
    rop02Prod.forEach(r=>{
      const codigo=keyEquipoAtraso(r.maquina), proyecto=normalizeRop02Project(r.proyecto);
      if(!codigo||!proyecto)return;
      const k=equipmentProjectKey(codigo,proyecto);
      const current=recordsByEquipmentProject.get(k)||{codigo,maquina:r.maquina,proyecto,supervisor:"",fechas:new Set(),registros:0,ultimaCarga:""};
      current.fechas.add(r.fecha);current.registros+=1;
      if(r.fecha>=current.ultimaCarga){current.ultimaCarga=r.fecha;if(r.supervisor)current.supervisor=r.supervisor;current.maquina=r.maquina||current.maquina;}
      recordsByEquipmentProject.set(k,current);
    });

    // Equipo atrasado: tiene historial y su última carga quedó al menos 2 días
    // detrás de la fecha máxima global; la ventana reciente es sólo informativa.
    const atrasoActual=calculateAtrasoRop02(rop02Prod,admitidos,{
      normalizeEquipmentCode:keyEquipoAtraso,
      isEligible:()=>true,
    });
    const atrasados=atrasoActual.atrasados;
    const inicioVentana=atrasoActual.ventanaDesde;
    const finVentana=atrasoActual.ventanaHasta;

    const desdeSaltos=ultimaFecha?addDays(ultimaFecha,-45):"";
    const saltos=[];
    recordsByEquipmentProject.forEach(v=>{
      const fechasEq=[...v.fechas].filter(f=>!desdeSaltos||f>=desdeSaltos).sort();
      if(fechasEq.length<2)return;
      for(let i=1;i<fechasEq.length;i++){
        const desde=fechasEq[i-1];
        const hasta=fechasEq[i];
        const diasSalto=diffDias(hasta,desde)-1;
        if(diasSalto<=0)continue;
        const id=`salto_${v.codigo}_${v.proyecto}_${desde}_${hasta}`;
        const saved=admitidos[id]||admitidos[`atrasado_${v.codigo}_${v.proyecto}_${desde}`]||{};
        saltos.push({
          id,tipo:"Salto",codigo:v.codigo,maquina:v.maquina,proyecto:v.proyecto,supervisor:v.supervisor,
          ultimaCarga:desde,proximaCarga:hasta,diasSinCarga:diasSalto,
          diasSinCargaDetalle:fechasEntre(desde,hasta).join(", "),
          causa:String(saved.causa||"").trim(),admitido:Boolean(saved.admitido||saved.causa),fechaAdmitido:saved.fechaAdmitido||"",
          movementId:saved.movementId||"",proyectoDestino:saved.proyectoDestino||"",usuario:saved.usuario||""
        });
      }
    });
    saltos.sort((a,b)=>b.ultimaCarga.localeCompare(a.ultimaCarga)||b.diasSinCarga-a.diasSinCarga||a.maquina.localeCompare(b.maquina));

    return{ultimaFecha,diasAtraso,atrasados,saltos,totalUltima:rowsUltima.length,equiposUltima:presentesUltima.size,inicioVentana,finVentana};
  },[rop02Prod,admitidos,hoyISO,keyEquipoAtraso]);

  const coincideFechaFiltro=useCallback(fecha=>{
    const f=String(fecha||"");
    if(modoFiltro==="dia")return !fechaFiltro||f===fechaFiltro;
    if(fechaDesde&&f<fechaDesde)return false;
    if(fechaHasta&&f>fechaHasta)return false;
    return true;
  },[modoFiltro,fechaFiltro,fechaDesde,fechaHasta]);

  const coincideDimensionesFiltro=useCallback(row=>{
    if(!multiIsAll(tipoMaquinaFiltro,"todas")&&!tipoMatchMachineROP05(tipoMaquinaFiltro,row.maquina))return false;
    if(!matchMulti(row.proyecto,proyectoFiltro,"todos"))return false;
    if(!matchMulti(row.maquina,maquinaFiltro,"todas"))return false;
    return true;
  },[tipoMaquinaFiltro,proyectoFiltro,maquinaFiltro]);

  const universoFiltros=useMemo(()=>[...data.atrasados,...data.saltos],[data.atrasados,data.saltos]);
  const proyectosFiltro=useMemo(()=>uniq(universoFiltros
    .filter(r=>multiIsAll(tipoMaquinaFiltro,"todas")||tipoMatchMachineROP05(tipoMaquinaFiltro,r.maquina))
    .map(r=>r.proyecto).filter(Boolean)),[universoFiltros,tipoMaquinaFiltro]);
  const maquinasFiltro=useMemo(()=>uniq(universoFiltros
    .filter(r=>(multiIsAll(tipoMaquinaFiltro,"todas")||tipoMatchMachineROP05(tipoMaquinaFiltro,r.maquina))&&matchMulti(r.proyecto,proyectoFiltro,"todos"))
    .map(r=>r.maquina).filter(Boolean)),[universoFiltros,tipoMaquinaFiltro,proyectoFiltro]);

  const atrasosFiltrados=useMemo(()=>data.atrasados.filter(r=>coincideFechaFiltro(r.ultimaCarga)&&coincideDimensionesFiltro(r)),[data.atrasados,coincideFechaFiltro,coincideDimensionesFiltro]);
  const saltosFiltrados=useMemo(()=>data.saltos.filter(r=>coincideFechaFiltro(r.ultimaCarga)&&coincideDimensionesFiltro(r)),[data.saltos,coincideFechaFiltro,coincideDimensionesFiltro]);
  const registrosFiltrados=useMemo(()=>rop02Prod.filter(r=>coincideFechaFiltro(r.fecha)&&coincideDimensionesFiltro(r)),[rop02Prod,coincideFechaFiltro,coincideDimensionesFiltro]);
  const resumenFiltrado=useMemo(()=>{
    const fechas=uniq(registrosFiltrados.map(r=>r.fecha).filter(Boolean)).sort();
    const ultimaFecha=fechas[fechas.length-1]||"";
    const rowsUltima=ultimaFecha?registrosFiltrados.filter(r=>r.fecha===ultimaFecha):[];
    const equiposUltima=new Set(rowsUltima.map(r=>keyEquipoAtraso(r.maquina)).filter(Boolean)).size;
    const diasAtraso=ultimaFecha?Math.floor((new Date(hoyISO+"T00:00:00")-new Date(ultimaFecha+"T00:00:00"))/86400000):null;
    return{ultimaFecha,totalUltima:rowsUltima.length,equiposUltima,diasAtraso};
  },[registrosFiltrados,keyEquipoAtraso,hoyISO]);

  const hayFiltrosAtraso=Boolean(fechaFiltro||fechaDesde||fechaHasta)||!multiIsAll(tipoMaquinaFiltro,"todas")||!multiIsAll(proyectoFiltro,"todos")||!multiIsAll(maquinaFiltro,"todas");
  const limpiarFiltrosAtraso=()=>{
    setModoFiltro("periodo");
    setFechaFiltro("");
    setFechaDesde("");
    setFechaHasta("");
    setTipoMaquinaFiltro("todas");
    setProyectoFiltro("todos");
    setMaquinaFiltro("todas");
  };

  const abrirJustificacion=(row)=>{
    setModalAtraso(row);
    setMotivoTipo(row.causa||"Bajó a San Juan");
    setMotivoOtro("");
    setProyectoDestino("");
    setMovimientoMsg("");
  };

  const confirmarJustificacion=async()=>{
    if(!modalAtraso)return;
    const causa=motivoTipo==="Otro"
      ? String(motivoOtro||"").trim()
      : String(motivoTipo||"").trim();
    if(!causa){appAlert("Ingresá un motivo para justificar el equipo.");return;}
    if(motivoTipo==="Cambio de proyecto"&&!proyectoDestino){appAlert("Seleccioná el proyecto destino.");return;}
    const usuario=sessionStorage.getItem("dm_user")||"Usuario";
    const tipoMovimiento=motivoTipo==="Bajó a San Juan"?"BAJO_SAN_JUAN":motivoTipo==="Cambio de proyecto"?"CAMBIO_PROYECTO":motivoTipo==="Desmovilizado"?"DESMOVILIZADO":"OTRO";
    setSavingMovimiento(true);setMovimientoMsg("");
    try{
      await saveEquipmentMovement({interno:modalAtraso.maquina,internoNormalizado:modalAtraso.codigo,proyectoOrigen:modalAtraso.proyecto,proyectoDestino:tipoMovimiento==="BAJO_SAN_JUAN"?"SAN JUAN":proyectoDestino,tipoMovimiento,motivo:causa,observacion:motivoTipo==="Otro"?motivoOtro:"",usuario,fechaUltimoRop02:modalAtraso.ultimaCarga});
      setMovimientoMsg("Guardado correctamente.");
      setTimeout(()=>setModalAtraso(null),450);
    }catch(error){setMovimientoMsg(error?.message||"No se pudo guardar el movimiento.");}
    finally{setSavingMovimiento(false);}
  };

  const restaurar=async(row)=>{
    const movementId=row.movementId||admitidos[row.id]?.movementId;
    if(!movementId)return;
    try{await cancelEquipmentMovement(movementId,sessionStorage.getItem("dm_user")||"Usuario");}
    catch(error){appAlert(error?.message||"No se pudo cancelar el movimiento.");}
  };

  const accionBtn=(row)=><button onClick={()=>abrirJustificacion(row)} style={{border:`1px solid ${C.yellow}55`,background:C.yellowDim,color:C.yellow,borderRadius:7,padding:"5px 9px",fontSize:11,fontWeight:800,cursor:"pointer"}}>Justificar</button>;

  const cols=useMemo(()=>[
    {key:"maquina",label:"Equipo",render:v=><Badge color={C.purple}>{v}</Badge>},
    {key:"proyecto",label:"Proyecto",render:v=><Badge color={proyColor(v)}>{v||"—"}</Badge>},
    {key:"supervisor",label:"Supervisor",render:v=>v||"—"},
    {key:"ultimaCarga",label:"Última carga",render:v=>fmtFecha(v)},
    {key:"diasSinCarga",label:"Días de atraso",render:v=><span style={{color:C.red,fontWeight:900}}>{v}</span>},
    {key:"diasConCarga",label:"Cargas últimos 7 días"},
    {key:"accion",label:"Acción",render:(_,r)=>accionBtn(r)},
  ],[admitidos]);

  const colsSaltos=useMemo(()=>[
    {key:"maquina",label:"Equipo",render:v=><Badge color={C.purple}>{v}</Badge>},
    {key:"proyecto",label:"Proyecto",render:v=><Badge color={proyColor(v)}>{v||"—"}</Badge>},
    {key:"ultimaCarga",label:"Cargó hasta",render:v=>fmtFecha(v)},
    {key:"proximaCarga",label:"Volvió a cargar",render:v=>fmtFecha(v)},
    {key:"diasSinCarga",label:"Días saltados",render:v=><span style={{color:C.red,fontWeight:800}}>{v}</span>},
    {key:"diasSinCargaDetalle",label:"Fechas sin carga",wrap:true,render:v=><span style={{fontSize:12,color:C.textSub}}>{v||"—"}</span>},
    {key:"causa",label:"Motivo aceptado",wrap:true,render:v=>v?<span style={{color:C.green,fontWeight:700}}>{v}</span>:<span style={{color:C.red,fontWeight:700}}>Pendiente</span>},
    {key:"accion",label:"Acción",render:(_,r)=>r.admitido?<button onClick={()=>restaurar(r)} style={{border:`1px solid ${C.green}55`,background:C.greenDim,color:C.green,borderRadius:7,padding:"5px 9px",fontSize:11,fontWeight:800,cursor:"pointer"}}>Restaurar</button>:accionBtn(r)},
  ],[admitidos]);

  const colsAceptados=useMemo(()=>[
    {key:"maquina",label:"Equipo",render:v=><Badge color={C.purple}>{v}</Badge>},
    {key:"proyecto",label:"Proyecto",render:v=><Badge color={proyColor(v)}>{v||"—"}</Badge>},
    {key:"supervisor",label:"Supervisor",render:v=>v||"—"},
    {key:"ultimaCarga",label:"Última carga",render:v=>fmtFecha(v)},
    {key:"diasSinCarga",label:"Días de atraso",render:v=><span style={{color:C.yellow,fontWeight:900}}>{v}</span>},
    {key:"causa",label:"Motivo",wrap:true,render:v=><span style={{color:C.green,fontWeight:700}}>{v||"—"}</span>},
    {key:"proyectoDestino",label:"Destino",render:v=>v||"—"},
    {key:"fechaAdmitido",label:"Fecha aceptación",render:v=>v?new Date(v).toLocaleString("es-AR"):"—"},
    {key:"usuario",label:"Aceptó",render:v=>v||"Usuario"},
    {key:"accion",label:"Acción",render:(_,r)=><button onClick={()=>restaurar(r)} style={{border:`1px solid ${C.green}55`,background:C.greenDim,color:C.green,borderRadius:7,padding:"5px 9px",fontSize:11,fontWeight:800,cursor:"pointer"}}>Restaurar</button>},
  ],[admitidos]);

  const movimientosNoDisponibles=movimientosLoading||(movimientosError&&!movements.length);
  const atrasadosPendientes=movimientosNoDisponibles?[]:atrasosFiltrados.filter(r=>!r.admitido);
  const atrasadosAceptados=atrasosFiltrados.filter(r=>r.admitido);
  const saltosSinCausa=saltosFiltrados.filter(r=>!r.admitido).length;
  const atrasoGeneral=resumenFiltrado.diasAtraso!==null&&resumenFiltrado.diasAtraso>1;

  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:14}}>
      <Card>
        <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
            <TabBtn active={modoFiltro==="dia"} onClick={()=>setModoFiltro("dia")}>Por día</TabBtn>
            <TabBtn active={modoFiltro==="periodo"} onClick={()=>setModoFiltro("periodo")}>Por período</TabBtn>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"flex-end"}}>
            {modoFiltro==="dia"?(
              <DateIn label="Fecha" value={fechaFiltro} onChange={setFechaFiltro}/>
            ):(
              <><PeriodMonthYear fechaD={fechaDesde} fechaH={fechaHasta} setFechaD={setFechaDesde} setFechaH={setFechaHasta}/><DateIn label="Desde" value={fechaDesde} onChange={setFechaDesde} max={fechaHasta||undefined}/><DateIn label="Hasta" value={fechaHasta} onChange={setFechaHasta} min={fechaDesde||undefined} warn={fechaHasta&&fechaDesde&&fechaHasta<fechaDesde?"≥ Desde":null}/></>
            )}
            <MultiSel label="Tipo de Máquina" value={tipoMaquinaFiltro} onChange={v=>{setTipoMaquinaFiltro(v);setProyectoFiltro("todos");setMaquinaFiltro("todas");}} options={ROP05_TIPOS_MAQUINA.map(t=>({value:t.value,label:t.label}))}/>
            <MultiSel label="Proyecto" value={proyectoFiltro} onChange={v=>{setProyectoFiltro(v);setMaquinaFiltro("todas");}} options={[{value:"todos",label:"Todos"},...proyectosFiltro.map(p=>({value:p,label:p}))]}/>
            <MultiSel label="Máquina" value={maquinaFiltro} onChange={setMaquinaFiltro} options={[{value:"todas",label:"Todas"},...maquinasFiltro.map(m=>({value:m,label:m}))]}/>
            <button onClick={limpiarFiltrosAtraso} style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,border:`1px solid ${C.red}44`,background:C.redDim,color:C.red,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"Inter",opacity:hayFiltrosAtraso?1:0.3,pointerEvents:hayFiltrosAtraso?"auto":"none"}}><Icon name="close" size={11} color={C.red}/>Limpiar filtros</button>
          </div>
        </div>
      </Card>

      {atrasoGeneral&&<AlertBanner type="warn">Pasó más de 1 día desde la última carga de ROP02 para los filtros seleccionados. Última carga detectada: <strong>{fmtFecha(resumenFiltrado.ultimaFecha)}</strong> ({resumenFiltrado.diasAtraso} días).</AlertBanner>}
      {!atrasoGeneral&&resumenFiltrado.ultimaFecha&&<AlertBanner type="success">La carga de ROP02 está al día para los filtros seleccionados. Última carga detectada: <strong>{fmtFecha(resumenFiltrado.ultimaFecha)}</strong>.</AlertBanner>}
      {!resumenFiltrado.ultimaFecha&&<AlertBanner type="warn">No se detectaron cargas de ROP02 para los filtros seleccionados.</AlertBanner>}
      {movimientosLoading&&<AlertBanner type="info">Cargando movimientos compartidos de equipos...</AlertBanner>}
      {movimientosError&&<AlertBanner type="error">No fue posible cargar movimientos de equipos. Se ocultan los pendientes para evitar falsos positivos.</AlertBanner>}

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>
        <StatCard icon="hours" label="Última carga" value={resumenFiltrado.ultimaFecha?fmtFecha(resumenFiltrado.ultimaFecha):"—"} sub={resumenFiltrado.diasAtraso!==null?`${resumenFiltrado.diasAtraso} días desde la última carga`:"Sin datos"} color={atrasoGeneral?C.red:C.green} small/>
        <StatCard icon="equip" label="Equipos última carga" value={resumenFiltrado.equiposUltima} sub={`${resumenFiltrado.totalUltima} registros en el último día`} color={C.purple} small/>
        <StatCard icon="warn" label="Equipos atrasados" value={atrasadosPendientes.length} sub="Venían cargándose y dejaron de aparecer" color={atrasadosPendientes.length?C.red:C.green} small/>
        <StatCard icon="check" label="Atrasos aceptados" value={atrasadosAceptados.length} sub="Ej.: equipos que bajaron a San Juan" color={C.green} small/>
        <StatCard icon="warn" label="Saltos sin causa" value={saltosSinCausa} sub="Cortes intermedios por equipo" color={saltosSinCausa?C.red:C.green} small/>
      </div>

      {atrasadosPendientes.length>0&&<AlertBanner type="warn">Se detectaron equipos con historial ROP02 cuya última carga quedó 2 días o más detrás de la fecha máxima cargada. Revisalos y presioná <strong>Justificar</strong> cuando la falta sea válida, por ejemplo porque el equipo bajó a San Juan.</AlertBanner>}

      <Card title={`Equipos atrasados (${atrasadosPendientes.length})`} action={<BtnExcel onClick={()=>excelFromCols(cols.filter(c=>c.key!=="accion"),atrasadosPendientes,"Equipos_Atrasados_ROP02")}/>}>
        <Table cols={cols} rows={atrasadosPendientes} maxH={560} emptyMsg="No se detectaron equipos atrasados en el historial ROP02"/>
      </Card>

      <Card title={`Equipos aceptados (${atrasadosAceptados.length})`} action={<BtnExcel onClick={()=>excelFromCols(colsAceptados.filter(c=>c.key!=="accion"),atrasadosAceptados,"Equipos_Aceptados_ROP02")}/>}>
        <Table cols={colsAceptados} rows={atrasadosAceptados} maxH={420} emptyMsg="Todavía no hay equipos aceptados o justificados"/>
      </Card>

      <Card title={`Saltos de carga por equipo (${saltosFiltrados.length})`} action={<BtnExcel onClick={()=>excelFromCols(colsSaltos.filter(c=>c.key!=="accion"),saltosFiltrados,"Saltos_ROP02")}/>}> 
        <Table cols={colsSaltos} rows={saltosFiltrados} maxH={520} emptyMsg="No se detectaron saltos intermedios de carga por equipo con los filtros seleccionados"/>
      </Card>

      {modalAtraso&&ReactDOM.createPortal(<div style={{position:"fixed",inset:0,zIndex:2147483647,background:"rgba(0,0,0,.62)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,boxSizing:"border-box"}}>
        <div style={{width:"min(520px,96vw)",background:"#232323",opacity:1,backdropFilter:"none",WebkitBackdropFilter:"none",border:`1px solid ${C.border}`,borderRadius:14,boxShadow:"0 20px 60px rgba(0,0,0,.45)",padding:20,display:"flex",flexDirection:"column",gap:14}}>
          <div style={{fontSize:18,fontWeight:900,color:C.text}}>Justificar ausencia de equipo</div>
          <div style={{fontSize:13,color:C.textSub}}>Equipo: <strong style={{color:C.purple}}>{modalAtraso.maquina}</strong> · Última carga: <strong>{fmtFecha(modalAtraso.ultimaCarga)}</strong></div>
          <label style={{display:"flex",flexDirection:"column",gap:7,fontSize:12,fontWeight:800,color:C.textSub}}>
            Motivo
            <select value={motivoTipo} onChange={e=>setMotivoTipo(e.target.value)} style={{background:C.bg,border:`1px solid ${C.border}`,color:C.text,borderRadius:8,padding:"10px 12px"}}>
              <option>Bajó a San Juan</option>
              <option>Cambio de proyecto</option>
              <option>Desmovilizado</option>
              <option>Otro</option>
            </select>
          </label>
          {motivoTipo==="Cambio de proyecto"&&<label style={{display:"flex",flexDirection:"column",gap:7,fontSize:12,fontWeight:800,color:C.textSub}}>Proyecto destino<select value={proyectoDestino} onChange={e=>setProyectoDestino(e.target.value)} style={{background:C.bg,border:`1px solid ${C.border}`,color:C.text,borderRadius:8,padding:"10px 12px"}}><option value="">Seleccionar...</option>{uniq(["JOSE MARIA","FILO DEL SOL","FILO SUR","EL ZORRO",...proyectosFiltro]).map(p=><option key={p} value={p}>{p}</option>)}</select></label>}
          {motivoTipo==="Otro"&&<textarea value={motivoOtro} onChange={e=>setMotivoOtro(e.target.value)} placeholder="Escribí el motivo..." rows={3} style={{background:C.bg,border:`1px solid ${C.border}`,color:C.text,borderRadius:8,padding:"10px 12px",resize:"vertical"}}/>}
          {movimientoMsg&&<div style={{fontSize:12,fontWeight:800,color:movimientoMsg.includes("correctamente")?C.green:C.red}}>{movimientoMsg}</div>}
          <div style={{display:"flex",justifyContent:"flex-end",gap:10}}>
            <button onClick={()=>setModalAtraso(null)} style={{border:`1px solid ${C.border}`,background:"transparent",color:C.textSub,borderRadius:8,padding:"9px 14px",fontWeight:800,cursor:"pointer"}}>Cancelar</button>
            <button disabled={savingMovimiento} onClick={confirmarJustificacion} style={{border:`1px solid ${C.green}66`,background:C.greenDim,color:C.green,borderRadius:8,padding:"9px 14px",fontWeight:900,cursor:savingMovimiento?"wait":"pointer",opacity:savingMovimiento?0.65:1}}>{savingMovimiento?"Guardando...":"Aceptar"}</button>
          </div>
        </div>
      </div>,document.body)}

      <AlertBanner type="info">Criterio usado: un equipo con historial ROP02 se marca atrasado cuando su última carga quedó 2 días o más detrás de la fecha máxima global. La ventana de 7 días informa actividad reciente, pero no elimina equipos del control. Los equipos justificados quedan en “Equipos aceptados”; al restaurarlos vuelven a “Equipos atrasados” y a su Excel.</AlertBanner>
    </div>
  );
}

function ViewControlROP02({rop02All,rop02ControlAll=rop02All,tabState,setTabState,stControlErrores,setStControlErrores,stCtrlEquipo,setStCtrlEquipo}){
  const tab=tabState?.tab||"errores";
  const setTab=t=>setTabState(s=>({...s,tab:t}));
  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:14}}>
      <Card>
        <div style={{padding:"0 14px",display:"flex",gap:4,alignItems:"center",flexWrap:"wrap"}}>
          <SubTab active={tab==="errores"} onClick={()=>setTab("errores")}>Control de errores</SubTab>
          <SubTab active={tab==="equipo"} onClick={()=>setTab("equipo")}>Control por Equipo</SubTab>
          <SubTab active={tab==="atraso"} onClick={()=>setTab("atraso")}>Atraso</SubTab>
        </div>
      </Card>
      {tab==="errores"&&<ControlDeErrores rop02All={rop02All} extState={stControlErrores} setExtState={setStControlErrores}/>} 
      {tab==="equipo"&&<ControlPorEquipo rop02All={rop02All} extState={stCtrlEquipo} setExtState={setStCtrlEquipo}/>} 
      {tab==="atraso"&&<ViewAtrasoROP02 rop02All={rop02ControlAll}/>}
    </div>
  );
}

function ViewControl({control,rop02All,rop05,extState,setExtState}){
  const[sub,setSub]=useState("dashboard");
  const tipoMaquina=extState?.tipoMaquina||"todas";
  const setTipoMaquina=v=>setExtState(st=>({...st,tipoMaquina:v}));

  // Filtros facetados sobre el universo productivo combinado (02+05)
  // Usamos el hook sobre productivos para ROP02; para ROP05 aplicamos manualmente los mismos filtros
  const fk=useMemo(()=>[
    {key:"proyecto",defaultVal:"todos"},
    {key:"maquina",defaultVal:"todas"},
    {key:"supervisor",defaultVal:"todos"},
  ],[]);
  const{mode,setMode,fecha,setFecha,fechaD,setFechaD,fechaH,setFechaH,vals,set,reset,hayFiltros,byFecha:byFecha02,opts:opts02}=useFacetedFilters(control.productivos,fk,extState,setExtState);

  // Conjuntos para el CRUCE 02↔05: solo proyecto+máquina+fecha (sin supervisor),
  // así un registro que existe en ambos lados no se marca como "faltante" por
  // tener el campo Supervisor distinto o vacío entre ROP02 y ROP05.
  const byFecha05=useMemo(()=>byDateFilter(control.prod05,mode,fecha,fechaD,fechaH),[control.prod05,mode,fecha,fechaD,fechaH]);
  const filtered05Match=useMemo(()=>byFecha05.filter(r=>
    matchMulti(r.proyecto,vals.proyecto,"todos")&&
    (multiIsAll(tipoMaquina,"todas")||tipoMatchMachineROP05(tipoMaquina,r.maquina))&&
    matchMulti(r.maquina,vals.maquina,"todas")
  ),[byFecha05,vals,tipoMaquina]);
  const filtered02Match=useMemo(()=>byFecha02.filter(r=>
    matchMulti(r.proyecto,vals.proyecto,"todos")&&
    (multiIsAll(tipoMaquina,"todas")||tipoMatchMachineROP05(tipoMaquina,r.maquina))&&
    matchMulti(r.maquina,vals.maquina,"todas")
  ),[byFecha02,vals,tipoMaquina]);

  // Conjuntos con filtro de supervisor aplicado (para totales/estadísticas)
  const filtered05=useMemo(()=>filtered05Match.filter(r=>
    matchMulti(r.supervisor,vals.supervisor,"todos")
  ),[filtered05Match,vals]);
  const filtered02=useMemo(()=>filtered02Match.filter(r=>
    matchMulti(r.supervisor,vals.supervisor,"todos")
  ),[filtered02Match,vals]);

  // Opciones facetadas para Control: unión de ROP02 + ROP05
  // Correlación de izquierda a derecha:
  // Proyecto → Máquina → Supervisor
  // - Proyecto se calcula con el universo del período.
  // - Máquina se calcula aplicando solo Proyecto.
  // - Supervisor se calcula aplicando Proyecto + Máquina.
  const optsControl=useMemo(()=>{
    const combined=[...byFecha02,...byFecha05];
    const byTipo=combined.filter(r=>multiIsAll(tipoMaquina,"todas")||tipoMatchMachineROP05(tipoMaquina,r.maquina));
    const byProyecto=byTipo.filter(r=>matchMulti(r.proyecto,vals.proyecto,"todos"));
    const byProyectoMaquina=byProyecto.filter(r=>matchMulti(r.maquina,vals.maquina,"todas"));
    return{
      proyecto:uniq(byTipo.map(r=>r.proyecto).filter(Boolean)),
      maquina:uniq(byProyecto.map(r=>r.maquina).filter(Boolean)),
      supervisor:uniq(byProyectoMaquina.map(r=>r.supervisor).filter(Boolean)),
    };
  },[byFecha02,byFecha05,vals,tipoMaquina]);

  // Recalcular inconsistencias: el cruce se hace sobre los conjuntos SIN filtro
  // de supervisor; luego se filtra el resultado por supervisor de cada registro.
  const filteredData=useMemo(()=>{
    const keys=row=>{
      const fecha=normDate(row?.fecha);
      if(!fecha)return[];
      const variants=machineLookupVariants(row?.maquina||"");
      if(!variants.length){
        const fallback=cleanMachine(row?.maquina||"");
        if(fallback)variants.push(fallback);
      }
      return variants.map(code=>`${fecha}__${String(code||"").trim().toUpperCase()}`);
    };
    const makeSet=rows=>{
      const set=new Set();
      rows.forEach(row=>keys(row).forEach(key=>set.add(key)));
      return set;
    };
    const set05=makeSet(filtered05Match);
    const set02=makeSet(filtered02Match);
    let faltanEn05=filtered02Match.filter(r=>!keys(r).some(key=>set05.has(key)));
    let faltanEn02=filtered05Match.filter(r=>!keys(r).some(key=>set02.has(key)));
    if(!multiIsAll(vals.supervisor,"todos")){
      faltanEn05=faltanEn05.filter(r=>matchMulti(r.supervisor,vals.supervisor,"todos"));
      faltanEn02=faltanEn02.filter(r=>matchMulti(r.supervisor,vals.supervisor,"todos"));
    }
    const total=filtered02.length+filtered05.length;
    const problemas=faltanEn05.length+faltanEn02.length;
    const consistencia=total>0?Math.round(((total-problemas)/total)*100):100;
    return{faltanEn05,faltanEn02,total,problemas,consistencia,prod02f:filtered02,prod05f:filtered05};
  },[filtered02Match,filtered05Match,filtered02,filtered05,vals]);

  const resetAll=()=>{reset();setTipoMaquina("todas");};
  const hayFiltrosControl=hayFiltros||!multiIsAll(tipoMaquina,"todas");

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
        {/* Fila 1: tabs + botón reporte */}
        <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
          <TabBtn active={mode==="dia"} onClick={()=>setMode("dia")}>Por día</TabBtn>
          <TabBtn active={mode==="periodo"} onClick={()=>setMode("periodo")}>Por período</TabBtn>
          <button onClick={()=>generarReporteControl(
            (fecha&&mode==="dia"?fmtFecha(fecha):(fechaD||fechaH)?`${fmtFecha(fechaD)} → ${fmtFecha(fechaH)}`:"Todo el período"),
            filteredData.faltanEn05,
            filteredData.faltanEn02
          )} style={{marginLeft:8,display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:7,border:`1px solid ${C.accent}`,background:C.accentDim,color:C.accent,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"Inter",letterSpacing:".04em"}}>
            📄 Guardar Reporte
          </button>
        </div>
        {/* Fila 2: filtros */}
        <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"flex-end"}}>
          {mode==="dia"?<DateIn label="Fecha" value={fecha} onChange={setFecha}/>:<><PeriodMonthYear fechaD={fechaD} fechaH={fechaH} setFechaD={setFechaD} setFechaH={setFechaH}/><DateIn label="Desde" value={fechaD} onChange={setFechaD} max={fechaH||undefined}/><DateIn label="Hasta" value={fechaH} onChange={setFechaH} min={fechaD||undefined} warn={fechaH&&fechaD&&fechaH<fechaD?"≥ Desde":null}/></>}
          <MultiSel label="Tipo de Máquina" value={tipoMaquina} onChange={v=>{setTipoMaquina(v);set("maquina","todas");set("supervisor","todos");}} options={ROP05_TIPOS_MAQUINA.map(t=>({value:t.value,label:t.label}))}/>
          <MultiSel label="Proyecto" value={vals.proyecto} onChange={v=>{set("proyecto",v);set("maquina","todas");set("supervisor","todos");}} options={[{value:"todos",label:"Todos"},...optsControl.proyecto.map(p=>({value:p,label:p}))]}/>
          <MultiSel label="Máquina" value={vals.maquina} onChange={v=>{set("maquina",v);set("supervisor","todos");}} options={[{value:"todas",label:"Todas"},...optsControl.maquina.filter(m=>multiIsAll(tipoMaquina,"todas")||tipoMatchMachineROP05(tipoMaquina,m)).map(m=>({value:m,label:m}))]}/>
          <MultiSel label="Supervisor" value={vals.supervisor} onChange={v=>set("supervisor",v)} options={[{value:"todos",label:"Todos"},...optsControl.supervisor.map(s=>({value:s,label:s}))]}/>
          <button onClick={resetAll} style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,border:`1px solid ${C.red}44`,background:C.redDim,color:C.red,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"Inter",opacity:hayFiltrosControl?1:0.3,pointerEvents:hayFiltrosControl?"auto":"none"}}><Icon name="close" size={11} color={C.red}/>Limpiar filtros</button>
        </div>
      </div>
    </Card>
  );

  const cols1=[
    {key:"fecha",label:"Fecha",render:v=>fmtFecha(v)},
    {key:"proyecto",label:"Proyecto",render:v=><Badge color={proyColor(v)}>{v||"—"}</Badge>},
    {key:"maquina",label:"Máquina",render:v=><Badge color={C.purple}>{v}</Badge>},
    {key:"parte",label:"N° Parte",render:v=><span style={{color:C.blue,fontWeight:600}}>{v||"—"}</span>},
    {key:"operario",label:"Operario"},{key:"supervisor",label:"Supervisor"},
    {key:"horas",label:"Horas",render:v=><span style={{color:C.accent,fontWeight:600}}>{fmtNum(v)}</span>},
    {key:"estado",label:"Estado",render:v=><Badge color={C.green}>{v||"—"}</Badge>},
    {key:"tipo_trabajo",label:"Tarea (ROP02)",wrap:true,render:v=>v||"—"},
    {key:"_",label:"Problema",render:()=><span style={{color:C.red,fontSize:11}}>Sin producción en ROP05</span>},
  ];
  const cols2=[
    {key:"fecha",label:"Fecha",render:v=>fmtFecha(v)},
    {key:"proyecto",label:"Proyecto",render:v=><Badge color={proyColor(v)}>{v||"—"}</Badge>},
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
            <StatCard icon="consist" label="Partes Consistentes" value={fmtPct(filteredData.consistencia)} sub={sem.label} color={sem.color} small/>
            <StatCard icon="alert" label="Problemas" value={filteredData.problemas} sub="registros" color={C.red} small/>
            <StatCard icon="warn" label="Supervisor c/ más faltas" value={(()=>{
              const m={};
              filteredData.faltanEn05.forEach(r=>{if(r.supervisor)m[r.supervisor]=(m[r.supervisor]||0)+1;});
              const top=Object.entries(m).sort((a,b)=>b[1]-a[1])[0];
              return top?top[0]:"—";
            })()} sub={(()=>{
              const m={};
              filteredData.faltanEn05.forEach(r=>{if(r.supervisor)m[r.supervisor]=(m[r.supervisor]||0)+1;});
              const top=Object.entries(m).sort((a,b)=>b[1]-a[1])[0];
              return top?`${top[1]} registros sin carga`:"sin datos";
            })()} color={C.red} small/>
            <StatCard icon="warn" label="Equipos con problemas" value={uniq([...filteredData.faltanEn05.map(r=>r.maquina),...filteredData.faltanEn02.map(r=>r.maquina)]).length} sub="con inconsistencias" color={C.red} small/>
            <StatCard icon="warn" label="Sin producción" value={filteredData.faltanEn05.length} sub="→ ROP05 faltante" color={C.red} small/>
            <StatCard icon="warn" label="Sin parte diario" value={filteredData.faltanEn02.length} sub="→ ROP02 faltante" color={C.yellow} small/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 3fr",gap:14}}>
            <Card title="Índice de Consistencia">
              <div style={{padding:"20px 24px",display:"flex",alignItems:"center",gap:24}}>
                <div style={{width:108,height:108,borderRadius:"50%",border:`5px solid ${sem.color}`,background:sem.dim,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",boxShadow:`0 0 32px ${sem.color}33`,flexShrink:0}}>
                  <span style={{fontFamily:"Inter",fontSize:28,fontWeight:800,color:sem.color}}>{filteredData.consistencia}%</span>
                  <span style={{fontSize:9,color:sem.color,fontWeight:700,letterSpacing:".1em"}}>{sem.label}</span>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"Inter",fontSize:14,fontWeight:700,color:C.text,marginBottom:8}}>Compara ROP02 productivos vs ROP05</div>
                  <p style={{fontSize:12,color:C.textSub,lineHeight:1.6,marginBottom:12}}>Cruce por <strong style={{color:C.text}}>fecha + máquina</strong>. Excluye camionetas y auxiliares.</p>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                    {[{l:"Total",v:filteredData.total,c:C.blue},{l:"Problemas",v:filteredData.problemas,c:C.red},{l:"OK",v:filteredData.total-filteredData.problemas,c:C.green}].map(({l,v,c})=>(
                      <div key={l} style={{background:c+"15",borderRadius:8,padding:"10px 12px",border:`1px solid ${c}33`}}>
                        <div style={{fontFamily:"Inter",fontSize:20,fontWeight:800,color:c}}>{v}</div>
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
                    <span style={{fontFamily:"Inter",fontSize:16,fontWeight:800,color:c}}>{r}</span><Badge color={c}>{l}</Badge>
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
        <div style={{fontFamily:"Inter",fontSize:16,fontWeight:700,color:C.red,marginBottom:8}}>Error al cargar datos</div>
        <div style={{display:"flex",flexDirection:"column",gap:6,maxWidth:480}}>
          {errors.map((e,i)=>(
            <div key={i} style={{background:C.redDim,border:`1px solid ${C.red}33`,borderRadius:8,padding:"10px 14px",textAlign:"left"}}>
              <div style={{fontSize:11,color:C.red,fontWeight:600}}>{e.source}</div>
              <div style={{fontSize:12,color:C.textSub,marginTop:2}}>{e.message}</div>
            </div>
          ))}
        </div>
      </div>
      <button onClick={onRetry} style={{padding:"9px 18px",borderRadius:8,border:`1px solid ${C.accent}44`,background:C.accentDim,color:C.accent,fontFamily:"Inter",fontWeight:600,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
        <Icon name="refresh" size={14} color={C.accent}/> Reintentar
      </button>
    </div>
  );
}

// ─── ViewVehiculos ────────────────────────────────────────────────────────────
function ViewVehiculos({rop02All,listaEquipos,extState,setExtState}){
  const vehListaIndex=useMemo(()=>buildVehicleListaIndex(listaEquipos),[listaEquipos]);
  const listaInfoIndex=useMemo(()=>buildListaEquipoInfoIndex(listaEquipos),[listaEquipos]);
  // Solo camionetas y camiones, unificados contra Lista Maestra por Código Nuevo.
  const rop02Veh=useMemo(()=>rop02All.filter(r=>r._excluded).map(r=>{
    const hit=getListaVehicleMatch(vehListaIndex,r.maquina);
    if(!hit)return r;
    // Si tiene Código Nuevo se muestra/unifica por Código Nuevo; si no existe, queda identificado por Código Drusila.
    return{...r,maquina:hit.codigoNuevo||hit.codigoViejo||hit.codigo||r.maquina,proyecto:hit.proyecto||r.proyecto,ubicacion:hit.ubicacion||hit.sitioAlquiler||hit.proyecto||r.proyecto,_tipoVehiculo:hit.familia||r._tipo,propiedad:hit.propiedad||String(getValue(hit,["Propiedad","PROPIEDAD","Propietario","Dueño","Dueno","Empresa"])||"")};
  }),[rop02All,vehListaIndex]);

  const fk=useMemo(()=>[
    {key:"proyecto",defaultVal:"todos"},
    {key:"maquina",defaultVal:"todas"},
    {key:"supervisor",defaultVal:"todos"},
    {key:"operario",defaultVal:"todos"},
  ],[]);
  const{mode,setMode,fecha,setFecha,fechaD,setFechaD,fechaH,setFechaH,filtered:filteredBase,opts,vals,set,reset,hayFiltros}=useFacetedFilters(rop02Veh,fk,extState,setExtState);

  const estado=extState?.estado||"todos";
  const setEstado=v=>setExtState(s=>({...s,estado:v}));
  const filtered=useMemo(()=>{
    if(multiIsAll(estado,"todos"))return filteredBase;
    return filteredBase.filter(r=>matchMulti(r.estado,estado,"todos"));
  },[filteredBase,estado]);

  const stats=useMemo(()=>({
    horas:filtered.reduce((s,r)=>s+r.horas,0),
    comb:filtered.reduce((s,r)=>s+r.combustible,0),
    equipos:uniq(filtered.map(r=>r.maquina)).length,
    ops:uniq(filtered.map(r=>r.operario)).length,
    prod:filtered.filter(r=>r.estado==="TRABAJO").length,
    od:filtered.filter(r=>r.estado==="OD").length,
    fs:filtered.filter(r=>r.estado==="FS").length,
    em:filtered.filter(r=>r.estado==="EM").length,
  }),[filtered]);

  const horasFecha=useMemo(()=>{
    if(mode!=="periodo")return[];
    const m={};filtered.forEach(r=>{m[r.fecha]=(m[r.fecha]||0)+r.horas;});
    return Object.entries(m).sort().map(([fecha,horas])=>({fecha,horas}));
  },[filtered,mode]);

  const cols=useMemo(()=>[
    {key:"fecha",label:"Fecha",render:v=>fmtFecha(v)},
    {key:"maquina",label:"Vehículo",render:v=><Badge color={C.teal}>{v}</Badge>},
    {key:"operario",label:"Operario"},
    {key:"supervisor",label:"Supervisor"},
    {key:"tipo_trabajo",label:"Tarea",render:v=><span style={{display:"block",maxWidth:260,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={v}>{v||"—"}</span>},
    {key:"horas",label:"Km",render:v=><span style={{color:C.accent,fontWeight:600}}>{fmtNum(v)}</span>},
    {key:"combustible",label:"Comb.",render:v=>fmtNum(v)},
    {key:"estado",label:"Estado",render:v=><Badge color={v==="FS"?C.red:v==="EM"?C.purple:v==="OD"?C.yellow:C.green}>{v==="OD"?"OD":v||"—"}</Badge>},
    {key:"proyecto",label:"Proyecto",render:v=><Badge color={proyColor(v)}>{v||"—"}</Badge>},
  ],[]);

  const filteredSorted=useMemo(()=>[...filtered].sort((a,b)=>b.fecha.localeCompare(a.fecha)),[filtered]);
  const [rop05TipRow,setRop05TipRow]=React.useState(null);   // fila en hover
  const [rop05PinnedRow,setRop05PinnedRow]=React.useState(null); // fila fijada por click
  const [rop05TipPos,setRop05TipPos]=React.useState({x:0,y:0});
  const rop05ActiveRow=rop05PinnedRow||rop05TipRow;

  const filtrosOperativosVehActivos=((mode==="dia"&&Boolean(fecha))||(mode==="periodo"&&Boolean(fechaD||fechaH)))||fk.some(f=>!multiIsAll(vals[f.key],f.defaultVal))||!multiIsAll(estado,"todos");
  const codigosVehFiltradosSet=useMemo(()=>{
    const set=new Set();
    (filtered||[]).forEach(r=>{
      const c=cleanMachine(r.maquina);
      if(c){set.add(c);set.add(c.replace(/[^A-Z0-9]/g,""));set.add(canonicalEquivalentMachineCode(c));}
    });
    return set;
  },[filtered]);
  const vehiculosListaFiltrados=useMemo(()=>{
    return (vehListaIndex.vehicles||[]).filter(v=>{
      if(!matchMulti(v.proyecto||v.ubicacion,vals.proyecto,"todos"))return false;
      if(!matchMulti(v.codigoNuevo||v.codigo||v.codigoViejo,vals.maquina,"todas"))return false;
      if(filtrosOperativosVehActivos){
        return (v.codes||[v.codigoNuevo,v.codigoViejo,v.codigo]).some(c=>{
          const k=cleanMachine(c);
          return codigosVehFiltradosSet.has(k)||codigosVehFiltradosSet.has(k.replace(/[^A-Z0-9]/g,""))||codigosVehFiltradosSet.has(canonicalEquivalentMachineCode(k));
        });
      }
      return true;
    });
  },[vehListaIndex,vals.proyecto,vals.maquina,filtrosOperativosVehActivos,codigosVehFiltradosSet]);

  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:14}}>
      <Card>
        <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",gap:7}}>
            <TabBtn active={mode==="dia"} onClick={()=>setMode("dia")}>Por día</TabBtn>
            <TabBtn active={mode==="periodo"} onClick={()=>setMode("periodo")}>Por período</TabBtn>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"flex-end"}}>
            {mode==="dia"?<DateIn label="Fecha" value={fecha} onChange={setFecha}/>:<><PeriodMonthYear fechaD={fechaD} fechaH={fechaH} setFechaD={setFechaD} setFechaH={setFechaH}/><DateIn label="Desde" value={fechaD} onChange={setFechaD} max={fechaH||undefined}/><DateIn label="Hasta" value={fechaH} onChange={setFechaH} min={fechaD||undefined} warn={fechaH&&fechaD&&fechaH<fechaD?"≥ Desde":null}/></>}
            <MultiSel label="Proyecto" value={vals.proyecto} onChange={v=>set("proyecto",v)} options={[{value:"todos",label:"Todos"},...opts.proyecto.map(p=>({value:p,label:p}))]}/>
            <MultiSel label="Vehículo" value={vals.maquina} onChange={v=>set("maquina",v)} options={[{value:"todas",label:"Todos"},...opts.maquina.map(m=>({value:m,label:m}))]}/>
            <MultiSel label="Supervisor" value={vals.supervisor} onChange={v=>set("supervisor",v)} options={[{value:"todos",label:"Todos"},...opts.supervisor.map(s=>({value:s,label:s}))]}/>
            <MultiSel label="Operario" value={vals.operario} onChange={v=>set("operario",v)} options={[{value:"todos",label:"Todos"},...opts.operario.map(o=>({value:o,label:o}))]}/>
            <MultiSel label="Estado" value={estado} onChange={setEstado} options={[
              {value:"todos",label:"Todos"},
              {value:"TRABAJO",label:"✅ Trabajo efectivo"},
              {value:"OD",label:"🟡 Operativo a Disposición"},
              {value:"FS",label:"🔴 Fuera de servicio"},
              {value:"EM",label:"🟣 En mantenimiento"},
            ]}/>
          <button onClick={reset} style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,border:`1px solid ${C.red}44`,background:C.redDim,color:C.red,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"Inter",opacity:hayFiltros?1:0.3,pointerEvents:hayFiltros?"auto":"none"}}><Icon name="close" size={11} color={C.red}/>Limpiar filtros</button>
          </div>
        </div>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10}}>
        <StatCard icon="hours" label="Kilómetros" value={fmtNum(stats.horas)} color={C.yellow} small/>
        <StatCard icon="fuel" label="Combustible" value={fmtNum(stats.comb)} color={C.teal} small/>
        <StatCard icon="equip" label="Vehículos" value={stats.equipos} color={C.purple} small/>
        <StatCard icon="parts" label="Operarios" value={stats.ops} color={C.blue} small/>
        <StatCard icon="check" label="Productivos" value={stats.prod} color={C.green} small/>
        <StatCard icon="parts" label="Días OD" value={stats.od} color={C.yellow} small/>
        <StatCard icon="warn" label="Días FS" value={stats.fs} color={C.red} small/>
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
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>
          {uniq(filtered.map(r=>r.proyecto)).map((p)=>{
            const rows=filtered.filter(r=>r.proyecto===p);
            const col=proyColor(p);
            return(
              <Card key={p} style={{borderColor:col+"44"}}>
                <div style={{padding:"12px 16px"}}>
                  <Badge color={col}>{p}</Badge>
                  <div style={{marginTop:10,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {[
                      [fmtNum(rows.reduce((s,r)=>s+r.horas,0)),"km",col],
                      [fmtNum(rows.reduce((s,r)=>s+r.combustible,0)),"combustible",C.teal],
                      [rows.length,"registros",C.blue],
                      [uniq(rows.map(r=>r.maquina)).length,"vehículos",C.purple],
                    ].map(([v,l,c],j)=>(
                      <div key={j}><div style={{fontFamily:"Inter",fontSize:18,fontWeight:800,color:c}}>{v}</div><div style={{fontSize:10,color:C.textMuted}}>{l}</div></div>
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card title={`Registros (${filtered.length})`} action={<BtnExcel onClick={()=>excelFromCols(cols,filteredSorted,"Vehiculos_ROP02")}/>}>
        <Table cols={cols} rows={filteredSorted} maxH={400} emptyMsg="Sin registros con los filtros seleccionados"/>
      </Card>

      <Card title="Flota de Vehículos" style={{overflow:"visible"}}>
        <div style={{padding:"14px 16px",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12}}>
          {[
            {img:VEH_CAMIONETA, nombre:"Camioneta", prefijos:["CTA"], matchTipo:(c,f)=>String(f||"").includes("CAMIONETA")||String(c||"").startsWith("CTA")},
            {img:VEH_COMBUSTIBLE, nombre:"Camión de Combustible", prefijos:["CDC"], matchTipo:(c,f)=>String(f||"").includes("COMBUSTIBLE")},
            {img:VEH_VOLCADOR, nombre:"Camión Volcador", prefijos:["CAV"], matchTipo:(c,f)=>String(f||"").includes("VOLCADOR")||String(c||"").startsWith("CAV")},
            {img:VEH_REGADOR, nombre:"Camión Regador", prefijos:["CAR","CAA"], matchTipo:(c,f)=>String(f||"").includes("REGADOR")||String(c||"").startsWith("CAR")||String(c||"").startsWith("CAA")},
            {img:VEH_TRACTOR, nombre:"Camión Tractor", prefijos:["CAT"], matchTipo:(c,f)=>String(f||"").includes("TRACTOR")||String(c||"").startsWith("CAT")},
          ].map(tipo=>(
            <EquipoCard key={tipo.nombre} {...tipo} rop02Prod={filtered} equiposExtra={vehiculosListaFiltrados} listaInfoIndex={listaInfoIndex}/>
          ))}
        </div>
      </Card>
    </div>
  );
}


// ─── ViewCombustible ──────────────────────────────────────────────────────────
function ViewCombustible({rop02All,extState,setExtState}){
  // Solo máquinas/equipos (excluye camiones y camionetas)
  const rop02Prod=useMemo(()=>rop02All.filter(r=>!r._excluded),[rop02All]);

  const fk=useMemo(()=>[
    {key:"proyecto",defaultVal:"todos"},
    {key:"maquina",defaultVal:"todas"},
    {key:"supervisor",defaultVal:"todos"},
    {key:"operario",defaultVal:"todos"},
  ],[]);
  const{mode,setMode,fecha,setFecha,fechaD,setFechaD,fechaH,setFechaH,filtered:filteredBase,opts,vals,set,reset:resetBase,hayFiltros}=useFacetedFilters(rop02Prod,fk,extState,setExtState);
  const tipoMaquina=extState?.tipoMaquina||"todas";
  const setTipoMaquina=v=>setExtState(st=>({...st,tipoMaquina:v}));
  const filtered=useMemo(()=>multiIsAll(tipoMaquina,"todas")?filteredBase:filteredBase.filter(r=>tipoMatchMachineROP05(tipoMaquina,r.maquina)),[filteredBase,tipoMaquina]);
  const reset=()=>{resetBase();setTipoMaquina("todas");};
  const hayFiltrosComb=hayFiltros||!multiIsAll(tipoMaquina,"todas");

  // Solo registros con consumo de combustible cargado
  const conCombustible=useMemo(()=>filtered.filter(r=>Number(r.combustible)>0),[filtered]);

  const stats=useMemo(()=>{
    const total=filtered.reduce((s,r)=>s+(Number(r.combustible)||0),0);
    const horas=filtered.reduce((s,r)=>s+(Number(r.horas)||0),0);
    const registrosConCarga=conCombustible.length;
    const equiposConCarga=uniq(conCombustible.map(r=>r.maquina)).length;
    const promedioPorCarga=registrosConCarga>0?total/registrosConCarga:0;
    const ratio=horas>0?total/horas:0; // litros por hora trabajada
    return{total,horas,registrosConCarga,equiposConCarga,promedioPorCarga,ratio};
  },[filtered,conCombustible]);

  // Evolución por fecha (modo período)
  const combFecha=useMemo(()=>{
    if(mode!=="periodo")return[];
    const m={};
    filtered.forEach(r=>{m[r.fecha]=(m[r.fecha]||0)+(Number(r.combustible)||0);});
    return Object.entries(m).sort().map(([fecha,combustible])=>({fecha,combustible:Math.round(combustible*10)/10}));
  },[filtered,mode]);

  // Ranking por equipo
  const rankingEquipos=useMemo(()=>{
    const m={};
    conCombustible.forEach(r=>{
      if(!m[r.maquina])m[r.maquina]={maquina:r.maquina,total:0,horas:0,cargas:0,tipo:r._tipo};
      m[r.maquina].total+=Number(r.combustible)||0;
      m[r.maquina].horas+=Number(r.horas)||0;
      m[r.maquina].cargas+=1;
    });
    return Object.values(m)
      .map(d=>({...d,total:Math.round(d.total*10)/10,ratio:d.horas>0?Math.round((d.total/d.horas)*100)/100:0}))
      .sort((a,b)=>b.total-a.total);
  },[conCombustible]);

  // Distribución por proyecto
  const porProyecto=useMemo(()=>{
    const m={};
    conCombustible.forEach(r=>{
      const p=r.proyecto||"Sin proyecto";
      m[p]=(m[p]||0)+(Number(r.combustible)||0);
    });
    return Object.entries(m).map(([proyecto,total],i)=>({proyecto,total:Math.round(total*10)/10,color:[C.accent,C.teal,C.purple,C.yellow,C.blue][i%5]}));
  },[conCombustible]);

  const cols=useMemo(()=>[
    {key:"fecha",label:"Fecha",render:v=>fmtFecha(v)},
    {key:"maquina",label:"Equipo",render:v=><Badge color={C.purple}>{v}</Badge>},
    {key:"turno",label:"Turno",render:v=><Badge color={(v||"").toUpperCase().includes("NOCHE")?C.purple:C.blue}>{(v||"").toUpperCase().includes("NOCHE")?"TN":"TD"}</Badge>},
    {key:"operario",label:"Operario"},
    {key:"supervisor",label:"Supervisor"},
    {key:"horas",label:"Horas",render:v=><span style={{color:C.accent,fontWeight:600}}>{fmtNum(v)}</span>},
    {key:"combustible",label:"Combustible",render:v=><span style={{color:C.teal,fontWeight:700}}>{fmtNum(v)} L</span>},
    {key:"proyecto",label:"Proyecto",render:v=><Badge color={proyColor(v)}>{v||"—"}</Badge>},
  ],[]);

  const filteredSorted=useMemo(()=>[...conCombustible].sort((a,b)=>b.fecha.localeCompare(a.fecha)),[conCombustible]);

  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Filtros */}
      <Card>
        <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",gap:7}}>
            <TabBtn active={mode==="dia"} onClick={()=>setMode("dia")}>Por día</TabBtn>
            <TabBtn active={mode==="periodo"} onClick={()=>setMode("periodo")}>Por período</TabBtn>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"flex-end"}}>
            {mode==="dia"?<DateIn label="Fecha" value={fecha} onChange={setFecha}/>:<><PeriodMonthYear fechaD={fechaD} fechaH={fechaH} setFechaD={setFechaD} setFechaH={setFechaH}/><DateIn label="Desde" value={fechaD} onChange={setFechaD} max={fechaH||undefined}/><DateIn label="Hasta" value={fechaH} onChange={setFechaH} min={fechaD||undefined} warn={fechaH&&fechaD&&fechaH<fechaD?"≥ Desde":null}/></>}
            <MultiSel label="Tipo de Máquina" value={tipoMaquina} onChange={v=>{setTipoMaquina(v);set("maquina","todas");}} options={ROP05_TIPOS_MAQUINA.map(t=>({value:t.value,label:t.label}))}/>
            <MultiSel label="Proyecto" value={vals.proyecto} onChange={v=>set("proyecto",v)} options={[{value:"todos",label:"Todos"},...opts.proyecto.map(p=>({value:p,label:p}))]}/>
            <MultiSel label="Equipo" value={vals.maquina} onChange={v=>set("maquina",v)} options={[{value:"todas",label:"Todos"},...opts.maquina.filter(m=>multiIsAll(tipoMaquina,"todas")||tipoMatchMachineROP05(tipoMaquina,m)).map(m=>({value:m,label:m}))]}/>
            <MultiSel label="Supervisor" value={vals.supervisor} onChange={v=>set("supervisor",v)} options={[{value:"todos",label:"Todos"},...opts.supervisor.map(s=>({value:s,label:s}))]}/>
            <MultiSel label="Operario" value={vals.operario} onChange={v=>set("operario",v)} options={[{value:"todos",label:"Todos"},...opts.operario.map(o=>({value:o,label:o}))]}/>
            <button onClick={reset} style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,border:`1px solid ${C.red}44`,background:C.redDim,color:C.red,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"Inter",opacity:hayFiltros?1:0.3,pointerEvents:hayFiltros?"auto":"none"}}>
              <Icon name="close" size={11} color={C.red}/>Limpiar filtros
            </button>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10}}>
        <StatCard icon="fuel" label="Combustible Total" value={fmtNum(stats.total)} sub="litros" color={C.teal} small/>
        <StatCard icon="hours" label="Horas Trabajadas" value={fmtNum(stats.horas)} color={C.yellow} small/>
        <StatCard icon="parts" label="Cargas Registradas" value={stats.registrosConCarga} color={C.blue} small/>
        <StatCard icon="equip" label="Equipos con Carga" value={stats.equiposConCarga} color={C.purple} small/>
        <StatCard icon="fuel" label="Litros / Carga" value={fmtNum(stats.promedioPorCarga)} color={C.teal} small/>
        <StatCard icon="fuel" label="Litros / Hora" value={fmtNum(stats.ratio)} color={C.accent} small/>
      </div>

      {/* Evolución temporal */}
      {mode==="periodo"&&combFecha.length>0&&(
        <Card title="Combustible por Fecha">
          <div style={{padding:"10px 6px"}}>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={combFecha} margin={{left:0,right:10}}>
                <defs><linearGradient id="gc" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.teal} stopOpacity={.35}/><stop offset="95%" stopColor={C.teal} stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                <XAxis dataKey="fecha" tick={{fill:C.textMuted,fontSize:9}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:C.textMuted,fontSize:10}} axisLine={false} tickLine={false}/>
                <Tooltip content={<ChartTip/>}/>
                <Area type="monotone" dataKey="combustible" stroke={C.teal} fill="url(#gc)" name="Combustible (L)" strokeWidth={2}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Ranking + distribución por proyecto */}
      <div style={{display:"grid",gridTemplateColumns:"1.3fr 1fr",gap:12}}>
        <Card title={`Ranking de Consumo por Equipo (${rankingEquipos.length})`}>
          <div style={{padding:"10px 6px"}}>
            <ResponsiveContainer width="100%" height={Math.max(220,rankingEquipos.slice(0,12).length*32)}>
              <BarChart data={rankingEquipos.slice(0,12)} layout="vertical" margin={{left:10,right:20}}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false}/>
                <XAxis type="number" tick={{fill:C.textMuted,fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis type="category" dataKey="maquina" tick={{fill:C.textSub,fontSize:10}} axisLine={false} tickLine={false} width={80}/>
                <Tooltip content={<ChartTip/>}/>
                <Bar dataKey="total" name="Combustible (L)" fill={C.teal} radius={[0,4,4,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Distribución por Proyecto">
          <div style={{padding:"10px 6px"}}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={porProyecto} dataKey="total" nameKey="proyecto" cx="50%" cy="50%" outerRadius={75} label={({proyecto,total})=>`${proyecto}: ${fmtNum(total)}L`}>
                  {porProyecto.map((p,i)=><Cell key={i} fill={p.color}/>)}
                </Pie>
                <Tooltip content={<ChartTip/>}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Tabla de ranking detallado */}
      <Card title="Detalle por Equipo">
        <div className="dm-table-scroll" style={{overflowX:"auto",overflowY:"auto",maxHeight:520,scrollbarGutter:"stable"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{background:C.surface}}>
                {["Equipo","Tipo","Litros Totales","Horas","Litros/Hora","Cargas"].map(h=>(
                  <th key={h} style={{padding:"8px 14px",fontSize:11,fontWeight:700,color:C.textMuted,textAlign:"left",borderBottom:`1px solid ${C.border}`}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rankingEquipos.map((r,i)=>(
                <tr key={r.maquina} style={{background:i%2===0?"rgba(255,255,255,0.055)":"rgba(255,255,255,0.10)"}}
                  onMouseEnter={ev=>ev.currentTarget.style.background=C.accent+"11"}
                  onMouseLeave={ev=>ev.currentTarget.style.background=i%2===0?"transparent":C.surface+"33"}
                >
                  <td style={{padding:"8px 14px",fontSize:12,fontWeight:600,borderBottom:`1px solid ${C.border}18`}}><Badge color={C.purple}>{r.maquina}</Badge></td>
                  <td style={{padding:"8px 14px",fontSize:11,color:C.textSub,borderBottom:`1px solid ${C.border}18`}}>{r.tipo||"—"}</td>
                  <td style={{padding:"8px 14px",fontSize:12,fontWeight:700,color:C.teal,borderBottom:`1px solid ${C.border}18`}}>{fmtNum(r.total)} L</td>
                  <td style={{padding:"8px 14px",fontSize:12,color:C.accent,borderBottom:`1px solid ${C.border}18`}}>{fmtNum(r.horas)}</td>
                  <td style={{padding:"8px 14px",fontSize:12,color:C.text,borderBottom:`1px solid ${C.border}18`}}>{fmtNum(r.ratio)}</td>
                  <td style={{padding:"8px 14px",fontSize:12,color:C.textSub,borderBottom:`1px solid ${C.border}18`}}>{r.cargas}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rankingEquipos.length===0&&<div style={{padding:20,textAlign:"center",color:C.textMuted,fontSize:12}}>Sin cargas de combustible con los filtros seleccionados</div>}
        </div>
      </Card>

      {/* Tabla de registros */}
      <Card title={`Registros con Combustible (${conCombustible.length})`} action={<BtnExcel onClick={()=>excelFromCols(cols,filteredSorted,"Combustible_ROP02")}/>}>
        <Table cols={cols} rows={filteredSorted} maxH={400} emptyMsg="Sin registros de combustible con los filtros seleccionados"/>
      </Card>
    </div>
  );
}

// ─── ViewCHC — Indicador Control de Horas Contratadas ────────────────────────
function ViewCHC({rop02All,extState,setExtState}){
  const rop02Prod=useMemo(()=>rop02All.filter(r=>!r._excluded),[rop02All]);
  const proyecto=extState?.proyecto??"todos";
  const setProyecto=v=>setExtState(s=>({...s,proyecto:v}));
  const tipoMaquina=extState?.tipoMaquina??"todas";
  const setTipoMaquina=v=>setExtState(s=>({...s,tipoMaquina:v}));
  const HS_MES=180;

  // Meses disponibles: lista fija de nombres
  const MESES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  // Años disponibles a partir de los datos
  const años=useMemo(()=>{
    const ys=new Set(["2025","2026","2027","2028"]); // años mínimos garantizados
    rop02All.forEach(r=>{if(r.fecha)ys.add(r.fecha.slice(0,4));});
    return [...ys].sort();
  },[rop02All]);

  const añoSelec=extState?.añoSelec??String(new Date().getFullYear());
  const setAñoSelec=v=>setExtState(s=>({...s,añoSelec:v}));
  const mesIdx=extState?.mesIdx??new Date().getMonth(); // 0=Enero
  const setMesIdx=v=>setExtState(s=>({...s,mesIdx:v}));

  const proyectos=useMemo(()=>uniq(rop02All.filter(r=>!r._excluded&&!(["FILO SUR","EL ZORRO"].includes(r.proyecto))).map(r=>r.proyecto)),[rop02All]);

  // Sub-pestaña: período "26-25" (José María / Filo del Sol) vs período de
  // mes calendario (Filo Sur, donde el mes coincide con el período 1-fin de mes)
  const chcTab=extState?.chcTab??"principal";
  const setChcTab=v=>setExtState(s=>({...s,chcTab:v}));

  // Calcular fechaD y fechaH a partir del mes/año seleccionado
  // - "principal": del 26 del mes anterior al 25 del mes seleccionado
  //   Ej: Mayo = del 26/04 al 25/05
  // - "filosur": mes calendario completo (1 al último día del mes)
  const{fechaD,fechaH,diasPeriodo}=useMemo(()=>{
    const y=parseFloat(añoSelec);
    const m=mesIdx; // 0=Enero
    if(chcTab==="filosur"||chcTab==="zorro"){
      const dD=`${y}-${String(m+1).padStart(2,"0")}-01`;
      const lastDay=new Date(y,m+1,0).getDate();
      const dH=`${y}-${String(m+1).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;
      return{fechaD:dD,fechaH:dH,diasPeriodo:lastDay};
    }
    // Inicio: 26 del mes anterior al mes seleccionado
    // Si enero (m=0): inicio = 26/12 del año anterior
    const mesAnteriorNum=m===0?12:m;          // número de mes (1-12) del mes anterior
    const añoInicio=m===0?y-1:y;             // año del inicio
    const dD=`${añoInicio}-${String(mesAnteriorNum).padStart(2,"0")}-26`;
    // Fin: 25 del mes seleccionado en el año seleccionado
    const dH=`${y}-${String(m+1).padStart(2,"0")}-25`;
    const dias=Math.round((new Date(dH)-new Date(dD))/(1000*60*60*24))+1;
    return{fechaD:dD,fechaH:dH,diasPeriodo:dias};
  },[añoSelec,mesIdx,chcTab]);

  // Base: solo equipos productivos filtrados por proyecto y período
  const base=useMemo(()=>rop02All.filter(r=>{
    if(r._excluded)return false;
    if(chcTab==="filosur"){
      if(r.proyecto!=="FILO SUR")return false;
    }else if(chcTab==="zorro"){
      if(r.proyecto!=="EL ZORRO")return false;
    }else{
      if(r.proyecto==="FILO SUR"||r.proyecto==="EL ZORRO")return false;
      if(!matchMulti(r.proyecto,proyecto,"todos"))return false;
    }
    if(!dmMatchTipoMaquinaSeleccion(r.maquina,tipoMaquina))return false;
    if(r.fecha<fechaD||r.fecha>fechaH)return false;
    return true;
  }),[rop02All,proyecto,fechaD,fechaH,chcTab,tipoMaquina]);

  // Agrupar por máquina y calcular métricas
  const rows=useMemo(()=>{
    const m={};
    base.forEach(r=>{
      if(!m[r.maquina])m[r.maquina]={
        maquina:r.maquina,
        proyecto:r.proyecto,
        fechas:[],
        horasTrabajo:0,
        diasFS:0,
        diasOD:0,
        diasFaltaOp:0,
      };
      const eq=m[r.maquina];
      eq.fechas.push(r.fecha);
      if(r.estado==="TRABAJO")eq.horasTrabajo+=r.horas;
      else if(r.estado==="FS")eq.diasFS+=1;
      else if(r.estado==="OD")eq.diasOD+=1;
    });

    return Object.values(m).map(eq=>{
      const fechasOrd=[...new Set(eq.fechas)].sort();
      const primerRegistro=fechasOrd[0]||fechaD;
      const ultimaFecha=fechasOrd[fechasOrd.length-1]||fechaH;
      // Fecha inicio: la más tardía entre el inicio del período y el primer registro del equipo
      const fechaInicio=primerRegistro>fechaD?primerRegistro:fechaD;
      // Fecha fin: la más temprana entre el fin del período y el último registro del equipo
      const fechaFin=ultimaFecha<fechaH?ultimaFecha:fechaH;
      // Días totales del equipo en el período (por diferencia de fechas)
      const diasTotalesEquipo=fechaInicio&&fechaFin?
        Math.round((new Date(fechaFin)-new Date(fechaInicio))/(1000*60*60*24))+1:diasPeriodo;
      // diasEfectivos (trabajo + OD) = días totales - días FS
      // Garantiza que diasEfectivos + diasFS = diasTotalesEquipo
      const diasEfectivos=Math.max(0, diasTotalesEquipo-eq.diasFS);
      // Horas contratadas proporcionales a días trabajados
      // Rodillos compactadores en FILO DEL SOL tienen 100hs, en JOSE MARIA 180hs
      const esRodillo=/^(ROD|RPC|RCP)/.test(eq.maquina);
      const esFilo=eq.proyecto==="FILO DEL SOL";
      const HS_EQUIPO=esRodillo&&esFilo?100:HS_MES;
      // Hs contratadas = (hs_equipo / días_período) × días_totales_equipo (fecha inicio a fecha fin)
      const hsContratadas=diasPeriodo>0?Math.round((HS_EQUIPO/diasPeriodo)*diasTotalesEquipo*10)/10:HS_EQUIPO;
      const diasEfectivosYOD=diasEfectivos;
      // Horas OD = días OD × (180hs / días del período)
      const hsOD=diasPeriodo>0?Math.round((HS_EQUIPO/diasPeriodo)*eq.diasOD*10)/10:0;
      // % CHC = (hs trabajadas + hs OD) / hs contratadas
      const pct=hsContratadas>0?Math.round(((eq.horasTrabajo+hsOD)/hsContratadas)*10000)/100:0;
      return{
        ...eq,
        fechaInicio,
        fechaFin,
        diasEfectivos:diasEfectivosYOD,
        hsOD,
        hsContratadas,
        pct,
      };
    }).sort((a,b)=>a.maquina.localeCompare(b.maquina));
  },[base,fechaD,fechaH,diasPeriodo]);

  // Totales
  const totales=useMemo(()=>{
    const horasTrabajo=rows.reduce((s,r)=>s+r.horasTrabajo,0);
    const hsOD=Math.round(rows.reduce((s,r)=>s+r.hsOD,0)*10)/10;
    const hsContratadas=Math.round(rows.reduce((s,r)=>s+r.hsContratadas,0)*10)/10;
    const pct=hsContratadas>0?Math.round(((horasTrabajo+hsOD)/hsContratadas)*1000)/10:0;
    // Promedio simple de los porcentajes individuales para la fila TOTAL de la tabla.
    const pctPromedio=rows.length>0
      ? Math.round((rows.reduce((s,r)=>s+(Number(r.pct)||0),0)/rows.length)*100)/100
      : 0;
    return{
      horasTrabajo,
      diasFS:rows.reduce((s,r)=>s+r.diasFS,0),
      diasOD:rows.reduce((s,r)=>s+r.diasOD,0),
      hsOD,
      hsContratadas,
      pct,
      pctPromedio,
    };
  },[rows]);

  const semPct=(p)=>{
    if(p>=90)return{color:C.green,bg:C.greenDim};
    if(p>=70)return{color:C.yellow,bg:C.yellowDim};
    return{color:C.red,bg:C.redDim};
  };


  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Sub-pestañas de Calidad: principal 26-25 y proyectos especiales por mes calendario */}
      <div style={{borderBottom:`1px solid ${C.border}`,paddingBottom:2}}>
        <SubTab active={chcTab==="principal"} onClick={()=>setChcTab("principal")}>José María / Filo del Sol</SubTab>
        <SubTab active={chcTab==="filosur"} onClick={()=>setChcTab("filosur")}>Filo Sur</SubTab>
        <SubTab active={chcTab==="zorro"} onClick={()=>setChcTab("zorro")}>El Zorro</SubTab>
      </div>
      {/* Filtros */}
      <Card>
        <div style={{padding:"12px 14px",display:"flex",flexWrap:"wrap",alignItems:"flex-end",gap:12}}>
          <Icon name="filter" size={14} color={C.textSub}/>
          <Sel label="Mes" value={String(mesIdx)} onChange={v=>setMesIdx(Number(v))}
            options={MESES.map((m,i)=>({value:String(i),label:m}))}/>
          <Sel label="Año" value={añoSelec} onChange={setAñoSelec}
            options={años.map(y=>({value:y,label:y}))}/>
          <div style={{display:"flex",flexDirection:"column",gap:3}}>
            <label style={{fontSize:10,color:C.textMuted,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase"}}>Período</label>
            <div style={{fontSize:12,color:C.textSub,padding:"7px 10px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,whiteSpace:"nowrap"}}>
              {fmtFecha(fechaD)} → {fmtFecha(fechaH)}
            </div>
          </div>
          <MultiSel label="Tipo de Máquina" value={tipoMaquina} onChange={setTipoMaquina} options={dmTipoMaquinaOptions()}/>
          {chcTab==="principal"?(
            <MultiSel label="Proyecto" value={proyecto} onChange={setProyecto}
              options={[{value:"todos",label:"Todos"},...proyectos.map(p=>({value:p,label:p}))]}/>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:3}}>
              <label style={{fontSize:10,color:C.textMuted,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase"}}>Proyecto</label>
              <div style={{fontSize:12,padding:"7px 10px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:7}}>
                <Badge color={proyColor(chcTab==="zorro"?"EL ZORRO":"FILO SUR")}>{chcTab==="zorro"?"EL ZORRO":"FILO SUR"}</Badge>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
        <StatCard icon="equip" label="Equipos" value={rows.length} color={C.purple} small/>
        <StatCard icon="hours" label="Hs Trabajadas" value={fmtNum(totales.horasTrabajo)} color={C.accent} small/>
        <StatCard icon="hours" label="Hs Contratadas" value={fmtNum(totales.hsContratadas)} color={C.blue} small/>
        <StatCard icon="warn" label="Días FS Total" value={totales.diasFS} color={C.red} small/>
        <StatCard icon="parts" label="Días OD Total" value={totales.diasOD} color={C.yellow} small/>
        <StatCard icon="prod" label="% Cumplimiento" value={`${totales.pct}%`} sub={totales.pct>=90?"ÓPTIMO":totales.pct>=70?"ATENCIÓN":"CRÍTICO"} color={semPct(totales.pct).color} small/>
      </div>


      {/* Tabla */}
      <Card title={`Control de Horas Contratadas (${rows.length} equipos)`} action={
        <button onClick={()=>{const label=`${MESES[mesIdx]}_${añoSelec}`;generarExcelICHC(rows,totales,label);}} style={{display:"flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:7,border:`1px solid ${C.teal}44`,background:C.tealDim,color:C.teal,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"Inter"}}>⬇ Excel</button>
      }>
        <div className="dm-table-scroll" style={{overflowX:"auto",overflowY:"auto",maxHeight:520,scrollbarGutter:"stable"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead>
              <tr style={{background:C.surface}}>
                {["Máquina","Proyecto","Hs Efectivas","Fecha Inicio","Fecha Fin","Días Efect.+OD","Días FS","Días OD","Hs Op. a Disposición","Días Sin Operador","Hs Contratadas","% CHC"].map((h,i)=>(
                  <th key={i} style={{padding:"9px 10px",textAlign:i>=2?"center":"left",color:C.textSub,fontWeight:600,fontSize:11,letterSpacing:".04em",textTransform:"uppercase",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap",position:"sticky",top:0,background:C.surface}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length===0?(
                <tr><td colSpan={11} style={{padding:28,textAlign:"center",color:C.textMuted}}>Sin datos para el período seleccionado</td></tr>
              ):rows.map((r,i)=>{
                const sem=semPct(r.pct);
                return(
                  <tr key={r.maquina} style={{background:i%2===0?"transparent":C.surface+"66"}}>
                    <td style={{padding:"8px 10px",borderBottom:`1px solid ${C.border}18`}}><Badge color={C.purple}>{r.maquina}</Badge></td>
                    <td style={{padding:"8px 10px",borderBottom:`1px solid ${C.border}18`}}><Badge color={proyColor(r.proyecto)}>{r.proyecto||"—"}</Badge></td>
                    <td style={{padding:"8px 10px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:C.accent,fontWeight:700}}>{fmtNum(r.horasTrabajo)}</td>
                    <td style={{padding:"8px 10px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:C.textSub}}>{fmtFecha(r.fechaInicio)}</td>
                    <td style={{padding:"8px 10px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:C.textSub}}>{fmtFecha(r.fechaFin)}</td>
                    <td style={{padding:"8px 10px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:C.text,fontWeight:600}}>{r.diasEfectivos}</td>
                    <td style={{padding:"8px 10px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:r.diasFS>0?C.red:C.textMuted,fontWeight:r.diasFS>0?700:400}}>{r.diasFS||"—"}</td>
                    <td style={{padding:"8px 10px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:r.diasOD>0?C.yellow:C.textMuted,fontWeight:r.diasOD>0?700:400}}>{r.diasOD||"—"}</td>
                    <td style={{padding:"8px 10px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:r.hsOD>0?C.yellow:C.textMuted,fontWeight:r.hsOD>0?700:400}}>{r.hsOD>0?fmtNum(r.hsOD):"—"}</td>
                    <td style={{padding:"8px 10px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:r.diasFaltaOp>0?C.purple:C.textMuted}}>{r.diasFaltaOp||"—"}</td>
                    <td style={{padding:"8px 10px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:C.blue,fontWeight:600}}>{fmtNum(r.hsContratadas)}</td>
                    <td style={{padding:"8px 10px",textAlign:"center",borderBottom:`1px solid ${C.border}18`}}>
                      <span style={{display:"inline-block",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,color:sem.color,background:sem.bg,border:`1px solid ${sem.color}44`}}>{Number(r.pct).toFixed(2)}%</span>
                    </td>
                  </tr>
                );
              })}
              {/* Fila de totales */}
              {rows.length>0&&(
                <tr style={{background:C.surface,borderTop:`2px solid ${C.border}`}}>
                  <td colSpan={2} style={{padding:"10px 10px",fontFamily:"Inter",fontWeight:700,color:C.text}}>TOTAL</td>
                  <td style={{padding:"10px",textAlign:"center",fontFamily:"Inter",fontWeight:800,color:C.accent}}>{fmtNum(totales.horasTrabajo)}</td>
                  <td colSpan={2}/>
                  <td style={{padding:"10px",textAlign:"center",fontFamily:"Inter",fontWeight:700,color:C.text}}/>
                  <td style={{padding:"10px",textAlign:"center",fontFamily:"Inter",fontWeight:700,color:C.red}}>{totales.diasFS||"—"}</td>
                  <td style={{padding:"10px",textAlign:"center",fontFamily:"Inter",fontWeight:700,color:C.yellow}}>{totales.diasOD||"—"}</td>
                  <td style={{padding:"10px",textAlign:"center",fontFamily:"Inter",fontWeight:700,color:C.yellow}}>{totales.hsOD>0?fmtNum(totales.hsOD):"—"}</td>
                  <td/>
                  <td style={{padding:"10px",textAlign:"center",fontFamily:"Inter",fontWeight:800,color:C.blue}}>{fmtNum(totales.hsContratadas)}</td>
                  <td style={{padding:"10px",textAlign:"center"}}>
                    <span style={{display:"inline-block",padding:"3px 10px",borderRadius:20,fontSize:12,fontWeight:800,color:semPct(totales.pctPromedio).color,background:semPct(totales.pctPromedio).bg,border:`1px solid ${semPct(totales.pctPromedio).color}44`}}>{Number(totales.pctPromedio).toFixed(2)}%</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Dashboards ICHC ─────────────────────────────────────────────── */}
      {/* 1. Gauge general — ancho completo */}
      <Card title="Cumplimiento General — % CHC">
        <div style={{padding:"20px 16px",display:"flex",alignItems:"center",gap:24,flexWrap:"wrap",justifyContent:"center"}}>
          {(()=>{
            const sem=semPct(totales.pct);
            return(<>
              <div style={{width:130,height:130,borderRadius:"50%",border:`8px solid ${sem.color}`,background:sem.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",boxShadow:`0 0 40px ${sem.color}44`,flexShrink:0}}>
                <span style={{fontFamily:"Inter",fontSize:34,fontWeight:800,color:sem.color,lineHeight:1}}>{totales.pct}%</span>
                <span style={{fontSize:10,color:sem.color,fontWeight:700,letterSpacing:".1em",marginTop:2}}>CHC</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8,minWidth:220}}>
                {[{l:"Hs Efectivas",v:fmtNum(totales.horasTrabajo),c:C.accent},{l:"Hs Op. a Disposición",v:fmtNum(totales.hsOD),c:C.yellow},{l:"Hs Contratadas",v:fmtNum(totales.hsContratadas),c:C.blue}].map(({l,v,c})=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 12px",background:c+"15",borderRadius:7,border:`1px solid ${c}33`,gap:16}}>
                    <span style={{fontSize:11,color:C.textSub}}>{l}</span>
                    <span style={{fontFamily:"Inter",fontWeight:700,color:c,fontSize:13}}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {[["≥ 90%","Óptimo",C.green],["70% – 89%","Atención",C.yellow],["< 70%","Crítico",C.red]].map(([r,l,c])=>(
                  <div key={l} style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:10,height:10,borderRadius:"50%",background:c,flexShrink:0}}/>
                    <span style={{fontSize:11,color:C.textSub}}><strong style={{color:c}}>{r}</strong> — {l}</span>
                  </div>
                ))}
              </div>
            </>);
          })()}
        </div>
      </Card>

      {/* 2 y 3 — Side by side con mismo orden de equipos en eje Y */}
      {(()=>{
        const rowsSorted=[...rows].sort((a,b)=>a.maquina.localeCompare(b.maquina));
        const h=Math.max(220,rowsSorted.length*30+50);
        return(
          <div style={{display:"grid",gridTemplateColumns:"2fr 3fr",gap:14}}>
            {/* % CHC por equipo */}
            <Card title="% CHC por Equipo">
              <div style={{padding:"8px 16px 0",display:"flex",gap:16,flexWrap:"wrap"}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:20,borderTop:`2px dashed ${C.green}`}}/>
                  <span style={{fontSize:10,color:C.textSub}}><strong style={{color:C.green}}>90%</strong> Óptimo</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:20,borderTop:`2px dashed ${C.yellow}`}}/>
                  <span style={{fontSize:10,color:C.textSub}}><strong style={{color:C.yellow}}>70%</strong> Atención</span>
                </div>
              </div>
              <div style={{padding:"8px 6px 12px"}}>
                <ResponsiveContainer width="100%" height={h}>
                  <BarChart data={rowsSorted} layout="vertical" margin={{left:8,right:36}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false}/>
                    <XAxis type="number" domain={[0,Math.max(150,Math.ceil(Math.max(...rowsSorted.map(r=>r.pct),0)/10)*10)]} tick={{fill:C.textMuted,fontSize:10}} axisLine={false} tickLine={false} unit="%"/>
                    <YAxis type="category" dataKey="maquina" tick={{fill:C.textSub,fontSize:10}} width={88} axisLine={false} tickLine={false}/>
                    <Tooltip content={({active,payload})=>{
                      if(!active||!payload?.length)return null;
                      const d=payload[0].payload;const sem=semPct(d.pct);
                      return(<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 14px",fontSize:12}}>
                        <div style={{fontFamily:"Inter",fontWeight:700,color:sem.color,marginBottom:4}}>{d.maquina}</div>
                        <div style={{color:C.textSub}}>CHC: <strong style={{color:sem.color}}>{d.pct}%</strong></div>
                        <div style={{color:C.textSub}}>Hs efectivas: <strong style={{color:C.accent}}>{fmtNum(d.horasTrabajo)}</strong></div>
                        <div style={{color:C.textSub}}>Hs contratadas: <strong style={{color:C.blue}}>{fmtNum(d.hsContratadas)}</strong></div>
                      </div>);
                    }}/>
                    <ReferenceLine x={90} stroke={C.green} strokeDasharray="4 4" strokeWidth={1.5}/>
                    <ReferenceLine x={70} stroke={C.yellow} strokeDasharray="4 4" strokeWidth={1.5}/>
                    <Bar dataKey="pct" name="% CHC" radius={[0,4,4,0]} barSize={16}>
                      {rowsSorted.map((r,i)=>{const s=semPct(r.pct);return<Cell key={i} fill={s.color}/>;} )}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Composición de días */}
            <Card title="Composición de Días por Equipo">
              <div style={{padding:"8px 16px 0",display:"flex",gap:16,flexWrap:"wrap"}}>
                {[["Días Efectivos+OD",C.green],["Días FS",C.red]].map(([l,c])=>(
                  <div key={l} style={{display:"flex",alignItems:"center",gap:5}}>
                    <div style={{width:10,height:10,borderRadius:2,background:c}}/>
                    <span style={{fontSize:10,color:C.textSub}}>{l}</span>
                  </div>
                ))}
              </div>
              <div style={{padding:"8px 6px 12px"}}>
                <ResponsiveContainer width="100%" height={h}>
                  <BarChart data={rowsSorted} layout="vertical" margin={{left:8,right:16}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false}/>
                    <XAxis type="number" tick={{fill:C.textMuted,fontSize:10}} axisLine={false} tickLine={false} unit=" días"/>
                    <YAxis type="category" dataKey="maquina" tick={{fill:C.textSub,fontSize:10}} width={88} axisLine={false} tickLine={false}/>
                    <Tooltip content={({active,payload,label})=>{
                      if(!active||!payload?.length)return null;
                      return(<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 14px",fontSize:12}}>
                        <div style={{fontFamily:"Inter",fontWeight:700,color:C.text,marginBottom:6}}>{label}</div>
                        {payload.map((p,i)=><div key={i} style={{color:p.fill,fontWeight:600}}>{p.name}: {p.value} días</div>)}
                      </div>);
                    }}/>
                    <Bar dataKey="diasEfectivos" name="Días Efectivos+OD" fill={C.green} stackId="a" barSize={16}/>
                    <Bar dataKey="diasFS" name="Días FS" fill={C.red} stackId="a" radius={[0,4,4,0]} barSize={16}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        );
      })()}
    </div>
  );
}

function TallerCentralSummary({rows=[]}){
  const [boxTooltip,setBoxTooltip]=useState(null);
  const [boxTooltipPinned,setBoxTooltipPinned]=useState(false);
  const hideTimerRef=useRef(null);

  const getVal=useCallback((row,cands)=>{
    const keys=Object.keys(row||{});
    for(const cand of cands){
      const wanted=String(cand||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
      for(const k of keys){
        const kk=String(k||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
        if(kk===wanted||kk.includes(wanted)||wanted.includes(kk))return row[k];
      }
    }
    return "";
  },[]);

  const countBy=useCallback((cands)=>{
    const m=new Map();
    rows.forEach(r=>{
      const raw=String(getVal(r,cands)||"Sin dato").trim()||"Sin dato";
      if(!m.has(raw))m.set(raw,[]);
      m.get(raw).push(r);
    });
    return [...m.entries()]
      .map(([name,matchedRows])=>[name,matchedRows.length,matchedRows])
      .sort((a,b)=>b[1]-a[1]||String(a[0]).localeCompare(String(b[0])));
  },[rows,getVal]);

  const tipos=useMemo(()=>countBy(["Familia","Tipo de equipo","Tipo","Equipo"]),[countBy]);
  const propiedades=useMemo(()=>countBy(["Propiedad"]),[countBy]);
  const marcas=useMemo(()=>countBy(["Marca"]),[countBy]);
  const combustibles=useMemo(()=>countBy(["Tipo de Combustible","Tipo Combustible","Combustible"]),[countBy]);
  const modelos=useMemo(()=>countBy(["Modelo","Modelo Equipo","Modelo de Equipo"]),[countBy]);
  const anios=useMemo(()=>rows.map(r=>Number(String(getVal(r,["Año de Fabricacion","Año Fabricacion","Anio Fabricacion","Año Fabricación"])||"").replace(/[^0-9]/g,""))).filter(n=>n>1900&&n<2200),[rows,getVal]);
  const antigProm=anios.length?((new Date().getFullYear()-anios.reduce((a,b)=>a+b,0)/anios.length).toFixed(1)):"—";

  const equipmentLabel=useCallback((r)=>{
    const nuevo=String(getVal(r,["Código Nuevo","Codigo Nuevo","Código nuevo","Codigo nuevo"])||"").trim();
    const drusila=String(getVal(r,["Código Drusila","Codigo Drusila","Código de Drusila","Codigo de Drusila"])||"").trim();
    const familia=String(getVal(r,["Familia","Tipo de equipo","Tipo"])||"").trim();
    const modelo=String(getVal(r,["Modelo","Modelo Equipo","Modelo de Equipo"])||"").trim();
    const codigo=nuevo||drusila||"Sin código";
    const extra=[familia,modelo].filter(Boolean).join(" · ");
    return extra?`${codigo} — ${extra}`:codigo;
  },[getVal]);

  const clearHideTimer=useCallback(()=>{
    if(hideTimerRef.current){clearTimeout(hideTimerRef.current);hideTimerRef.current=null;}
  },[]);

  useEffect(()=>()=>clearHideTimer(),[clearHideTimer]);

  const buildTooltip=useCallback((title,name,matchedRows,e)=>{
    const rect=e.currentTarget.getBoundingClientRect();
    return{
      key:`${title}::${name}`,
      title,
      name,
      equipos:(matchedRows||[]).map(equipmentLabel).sort((a,b)=>a.localeCompare(b)),
      x:rect.right,
      y:rect.top
    };
  },[equipmentLabel]);

  const showRowTooltip=useCallback((title,name,matchedRows,e)=>{
    clearHideTimer();
    const next=buildTooltip(title,name,matchedRows,e);
    setBoxTooltip(prev=>prev?.key===next.key?prev:next);
  },[buildTooltip,clearHideTimer]);

  const scheduleHide=useCallback(()=>{
    clearHideTimer();
    if(boxTooltipPinned)return;
    hideTimerRef.current=setTimeout(()=>setBoxTooltip(null),110);
  },[boxTooltipPinned,clearHideTimer]);

  const togglePinned=useCallback((title,name,matchedRows,e)=>{
    e.preventDefault();
    e.stopPropagation();
    clearHideTimer();
    const next=buildTooltip(title,name,matchedRows,e);
    if(boxTooltipPinned&&boxTooltip?.key===next.key){
      setBoxTooltipPinned(false);
      setBoxTooltip(null);
      return;
    }
    setBoxTooltip(next);
    setBoxTooltipPinned(true);
  },[boxTooltipPinned,boxTooltip,buildTooltip,clearHideTimer]);

  useEffect(()=>{
    if(!boxTooltipPinned)return;
    const close=e=>{
      if(e.target?.closest?.('[data-taller-tooltip="true"], [data-taller-box-row="true"]'))return;
      setBoxTooltipPinned(false);
      setBoxTooltip(null);
    };
    document.addEventListener("pointerdown",close,true);
    return()=>document.removeEventListener("pointerdown",close,true);
  },[boxTooltipPinned]);

  // Se devuelve JSX directamente en vez de crear un componente nuevo en cada hover.
  // Así React conserva el mismo nodo scrolleable y no vuelve arriba al mostrar/ocultar el tooltip.
  const renderBoxList=useCallback((title,items,color)=>(
    <div key={title} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:12,minHeight:170,position:"relative"}}>
      <div style={{fontSize:12,fontWeight:900,color,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>{title}</div>
      <div
        data-taller-scroll-list="true"
        style={{display:"flex",flexDirection:"column",gap:3,maxHeight:132,overflowY:"auto",overflowX:"hidden",overscrollBehavior:"contain",paddingRight:4}}
        onWheel={e=>e.stopPropagation()}
      >
        {items.map(([name,count,matchedRows])=>{
          const active=boxTooltip?.key===`${title}::${name}`;
          return(
            <div
              key={name}
              data-taller-box-row="true"
              onMouseEnter={e=>showRowTooltip(title,name,matchedRows,e)}
              onMouseLeave={scheduleHide}
              onClick={e=>togglePinned(title,name,matchedRows,e)}
              style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,fontSize:12,color:C.text,padding:"4px 3px",borderRadius:7,cursor:"pointer",background:active?`${color}18`:"transparent",flex:"0 0 auto"}}
            >
              <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</span>
              <Badge color={color}>{fmtNum(count)}</Badge>
            </div>
          );
        })}
        {!items.length&&<div style={{fontSize:12,color:C.textMuted}}>Sin datos cargados.</div>}
      </div>
    </div>
  ),[boxTooltip?.key,showRowTooltip,scheduleHide,togglePinned]);

  const tooltipNode=boxTooltip&&typeof document!=="undefined"?ReactDOM.createPortal((()=>{
    const width=390;
    const viewportW=window.innerWidth||1200;
    const viewportH=window.innerHeight||800;
    const rightSpace=viewportW-boxTooltip.x;
    const left=rightSpace>=width+24?boxTooltip.x+12:Math.max(10,boxTooltip.x-width-12);
    const estimatedHeight=Math.min(410,96+boxTooltip.equipos.length*25);
    const top=Math.max(10,Math.min(boxTooltip.y,viewportH-estimatedHeight-12));
    return(
      <div
        data-taller-tooltip="true"
        onMouseEnter={clearHideTimer}
        onMouseLeave={scheduleHide}
        onClick={e=>e.stopPropagation()}
        style={{position:"fixed",left,top,width,maxWidth:"calc(100vw - 20px)",zIndex:2147483646,background:"rgba(17,17,17,.98)",border:`1px solid ${boxTooltipPinned?C.blue:C.border}`,borderRadius:11,boxShadow:"0 18px 52px rgba(0,0,0,.82)",overflow:"hidden",pointerEvents:"auto",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",contain:"layout paint"}}
      >
        <div style={{padding:"10px 12px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
          <div>
            <div style={{fontSize:11,fontWeight:900,color:C.textMuted,textTransform:"uppercase",letterSpacing:".06em"}}>{boxTooltip.title}</div>
            <div style={{fontSize:14,fontWeight:900,color:C.text,marginTop:3}}>{boxTooltip.name}</div>
            <div style={{fontSize:11,color:C.textSub,marginTop:2}}>{fmtNum(boxTooltip.equipos.length)} equipos considerados</div>
          </div>
          <div style={{fontSize:10,color:boxTooltipPinned?C.blue:C.textMuted,textAlign:"right",lineHeight:1.35,fontWeight:800}}>
            {boxTooltipPinned?"FIJADO · click en la fila para soltar":"Click en la fila para fijar"}
          </div>
        </div>
        <div style={{maxHeight:300,overflowY:"auto",overscrollBehavior:"contain",padding:"7px 10px"}}>
          {boxTooltip.equipos.map((label,index)=>(
            <div key={`${label}-${index}`} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 3px",borderBottom:index<boxTooltip.equipos.length-1?`1px solid ${C.border}66`:"none",fontSize:12,color:C.text}}>
              <span style={{minWidth:24,color:C.textMuted,fontVariantNumeric:"tabular-nums"}}>{index+1}.</span>
              <span style={{overflowWrap:"anywhere"}}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  })(),document.body):null;

  return(
    <>
      <Card title="Taller Central">
        <div style={{padding:14,display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
            <StatCard icon="equip" label="Equipos cargados" value={fmtNum(rows.length)} sub="Lista Maestra de Equipos" color={C.teal} small/>
            <StatCard icon="database" label="Tipos de equipo" value={fmtNum(tipos.length)} sub="Familias distintas" color={C.blue} small/>
            <StatCard icon="check" label="Propiedades" value={fmtNum(propiedades.length)} sub="Delta / alquilados / terceros" color={C.green} small/>
            <StatCard icon="parts" label="Marcas" value={fmtNum(marcas.length)} sub="Marcas distintas" color={C.yellow} small/>
            <StatCard icon="truck" label="Modelos" value={fmtNum(modelos.length)} sub="Modelos distintos" color={C.purple} small/>
            <StatCard icon="fuel" label="Combustibles" value={fmtNum(combustibles.length)} sub="Tipos registrados" color={C.red} small/>
            <StatCard icon="hours" label="Antigüedad prom." value={antigProm} sub="Años aproximados" color={C.textSub} small/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:12}}>
            {renderBoxList("Equipos por tipo",tipos,C.blue)}
            {renderBoxList("Equipos por propiedad",propiedades,C.green)}
            {renderBoxList("Equipos por marca",marcas,C.yellow)}
            {renderBoxList("Tipo de combustible",combustibles,C.red)}
          </div>
        </div>
      </Card>
      {tooltipNode}
    </>
  );
}

function ViewTallerCentral({listaEquipos=[],rop02All=[],onReloadLista}){
  const rows=Array.isArray(listaEquipos)?listaEquipos:[];
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <TallerCentralSummary rows={rows}/>
      {rows.length>0
        ? <ViewListaMaestraEquipos rows={rows} rop02All={rop02All||[]} rop05={[]} rma15={[]} onReloadLista={onReloadLista}/>
        : <BlockingDataLoader label="Cargando Lista Maestra de Equipos..." />
      }
    </div>
  );
}


const OFFICE_VIEW_NAMES = new Set([
  "dashboard","listaEquipos","tallerCentral","rop02","horometros","vehiculos","controlROP02",
  "controlErrores","ctrlEquipo","atrasoROP02","combustible","rop05",
  "rop05Discriminacion","rma15CtrlEquipo","chc","control"
]);

function Loader({label}){
  return BlockingDataLoader ? <BlockingDataLoader label={label}/> : null;
}

const remoteFilterValue=(value,empty)=>Array.isArray(value)?(value.length===1?value[0]:""):(value&&value!==empty?value:"");
function remoteTableParams(state={}){
  const vals=state.vals||{},mode=state.mode||"dia";
  return{
    desde:mode==="dia"?(state.fecha||""):(state.fechaD||""),hasta:mode==="dia"?(state.fecha||""):(state.fechaH||""),
    proyecto:remoteFilterValue(vals.proyecto,"todos"),equipo:remoteFilterValue(vals.maquina,"todas"),supervisor:remoteFilterValue(vals.supervisor,"todos"),
    operario:remoteFilterValue(vals.operario,"todos"),estado:remoteFilterValue(state.estado,"todos"),tipo:remoteFilterValue(state.tipoMaquina,"todas"),tarea:remoteFilterValue(state.tarea,"todas"),unidad:remoteFilterValue(vals.unidad,"todas"),
    sortBy:state.sortBy||"fecha",sortDirection:state.sortDirection||"desc",
  };
}

export function OficinaTecnicaModule({
  view,
  deps,
  dataHydrated=false,
  rawSources={},
  sourceHasData=()=>false,
  listaEquipos=[],rop02All=[],rop02ControlAll=[],rop05=[],rma15=[],control={},dashSt,setDashSt,
  onReloadLista,
  st02,setSt02,stHorometros,setStHorometros,stVeh,setStVeh,
  stControlROP02,setStControlROP02,stControlErrores,setStControlErrores,
  stCtrlEquipo,setStCtrlEquipo,stComb,setStComb,st05,setSt05,
  stRma15CtrlEquipo,setStRma15CtrlEquipo,stCHC,setStCHC,stCtrl,setStCtrl,
  health,loading,onLoadAll,
}){
  applyDeps(deps);
  // ROP02 / ROP05: carga completa una sola vez por pestaña.
  // Los filtros NO vuelven a consultar Apps Script: se aplican localmente,
  // igual que en Mantenimiento.
  const [remoteTable,setRemoteTable]=useState({
    dataset:"",
    rows:[],
    total:0,
    hasMore:false,
    loading:false,
    loadedOnce:false,
    error:""
  });
  const fullDatasetCacheRef=useRef({rop02:null,rop05:null});
  const fullDatasetPendingRef=useRef({rop02:null,rop05:null});
  const remoteDataset=view==="rop02"?"rop02":view==="rop05"?"rop05":"";

  const loadFullDataset=useCallback(async(dataset,{force=false}={})=>{
    if(!dataset)return [];
    if(!force&&fullDatasetCacheRef.current[dataset]){
      return fullDatasetCacheRef.current[dataset];
    }
    if(!force&&fullDatasetPendingRef.current[dataset]){
      return fullDatasetPendingRef.current[dataset];
    }

    const task=(async()=>{
      const getter=dataset==="rop02"?getRop02:getRop05;
      const result=await getter({
        limit:"all",
        offset:0,
        sortBy:"fecha",
        sortDirection:"desc"
      });
      const raw=Array.isArray(result?.data)?result.data:[];
      const rows=dataset==="rop02"?normalizeROP02(raw):normalizeROP05(raw);
      fullDatasetCacheRef.current[dataset]=rows;
      return rows;
    })();

    fullDatasetPendingRef.current[dataset]=task;
    try{
      return await task;
    }finally{
      if(fullDatasetPendingRef.current[dataset]===task){
        fullDatasetPendingRef.current[dataset]=null;
      }
    }
  },[]);

  useEffect(()=>{
    if(!remoteDataset)return;
    let alive=true;

    const cached=fullDatasetCacheRef.current[remoteDataset];
    if(cached){
      setRemoteTable({
        dataset:remoteDataset,
        rows:cached,
        total:cached.length,
        hasMore:false,
        loading:false,
        loadedOnce:true,
        error:""
      });
      return()=>{alive=false;};
    }

    setRemoteTable(previous=>({
      dataset:remoteDataset,
      rows:previous.dataset===remoteDataset?previous.rows:[],
      total:previous.dataset===remoteDataset?previous.total:0,
      hasMore:false,
      loading:true,
      loadedOnce:previous.dataset===remoteDataset&&previous.loadedOnce,
      error:""
    }));

    loadFullDataset(remoteDataset).then(rows=>{
      if(!alive)return;
      setRemoteTable({
        dataset:remoteDataset,
        rows,
        total:rows.length,
        hasMore:false,
        loading:false,
        loadedOnce:true,
        error:""
      });
    }).catch(error=>{
      if(!alive)return;
      setRemoteTable(previous=>({
        ...previous,
        dataset:remoteDataset,
        loading:false,
        error:error?.message||"No se pudieron cargar los datos"
      }));
    });

    return()=>{alive=false;};
  },[remoteDataset,loadFullDataset]);

  // Ya no hay paginación remota al filtrar. Toda la base está en memoria.
  const loadMoreRemote=useCallback(()=>Promise.resolve(),[]);
  const exportRemote=useCallback(async()=>{
    if(!remoteDataset)return[];
    const rows=fullDatasetCacheRef.current[remoteDataset]||await loadFullDataset(remoteDataset);
    return rows;
  },[remoteDataset,loadFullDataset]);

  // Control ROP05 vs ROP02 usa EXACTAMENTE los mismos históricos completos
  // que las pestañas Equipos y Productividad. No depende de la copia legacy
  // de rawSources, que podía quedar atrasada respecto de query_dataset.
  const [controlRemote,setControlRemote]=useState({loaded:false,rop02:[],rop05:[]});
  useEffect(()=>{
    if(view!=="control")return;
    let alive=true;
    Promise.all([loadFullDataset("rop02"),loadFullDataset("rop05")])
      .then(([rows02,rows05])=>{
        if(!alive)return;
        // Respetar el universo de proyectos ya habilitado para este usuario.
        const allowedProjects=new Set((rop02All||[]).map(r=>r.proyecto).filter(Boolean));
        const restrict=allowedProjects.size>0;
        const next02=restrict?rows02.filter(r=>allowedProjects.has(r.proyecto)):rows02;
        const next05=restrict?rows05.filter(r=>allowedProjects.has(r.proyecto)):rows05;
        setControlRemote({loaded:true,rop02:next02,rop05:next05});
      })
      .catch(()=>{if(alive)setControlRemote({loaded:false,rop02:[],rop05:[]});});
    return()=>{alive=false;};
  },[view,loadFullDataset,rop02All]);

  const controlLive=useMemo(
    ()=>controlRemote.loaded?calcControl(controlRemote.rop02,controlRemote.rop05):control,
    [controlRemote,control]
  );

  if(!OFFICE_VIEW_NAMES.has(view))return null;
  if(view==="dashboard"){
    if(Object.keys(rawSources||{}).length===0)return <HealthDashboard health={health} loading={loading} onLoadAll={onLoadAll}/>;
    return <ViewDashboard rop02All={rop02All} rop05={rop05} rma15={rma15} control={control} dashSt={dashSt} setDashSt={setDashSt}/>;
  }
  if(view==="tallerCentral")return dataHydrated&&sourceHasData("lista_equipos")?<ViewTallerCentral listaEquipos={listaEquipos} rop02All={rop02All} onReloadLista={onReloadLista}/>:<Loader label="Cargando Taller Central..."/>;
  if(view==="listaEquipos")return dataHydrated&&sourceHasData("lista_equipos")?<ViewListaMaestraEquipos rows={listaEquipos} rop02All={rop02All} rop05={rop05} rma15={rma15} onReloadLista={onReloadLista}/>:<Loader label="Cargando Lista de Equipos..."/>;
  if(view==="rop02"){
    if(remoteTable.dataset!=="rop02"||!remoteTable.loadedOnce)return <Loader label="Cargando ROP02..."/>;
    return <ViewROP02 rop02All={remoteTable.rows} listaEquipos={listaEquipos} extState={st02} setExtState={setSt02} remoteTotal={remoteTable.total} remoteHasMore={false} onRemoteMore={loadMoreRemote} onRemoteExport={exportRemote}/>;
  }
  if(view==="horometros")return dataHydrated&&rop02All.length>0?<ViewHorometros rop02All={rop02All} extState={stHorometros} setExtState={setStHorometros}/>:<Loader label="Cargando Horómetros..."/>;
  if(view==="vehiculos")return dataHydrated&&rop02All.length>0?<ViewVehiculos rop02All={rop02All} listaEquipos={listaEquipos} extState={stVeh} setExtState={setStVeh}/>:<Loader label="Cargando Vehículos..."/>;
  if(view==="controlROP02")return dataHydrated&&(rop02All.length>0||rop02ControlAll.length>0)?<ViewControlROP02 rop02All={rop02All} rop02ControlAll={rop02ControlAll} tabState={stControlROP02} setTabState={setStControlROP02} stControlErrores={stControlErrores} setStControlErrores={setStControlErrores} stCtrlEquipo={stCtrlEquipo} setStCtrlEquipo={setStCtrlEquipo}/>:<Loader label="Cargando Control de ROP02..."/>;
  if(view==="controlErrores")return dataHydrated&&rop02All.length>0?<ControlDeErrores rop02All={rop02All} extState={stControlErrores} setExtState={setStControlErrores}/>:<Loader label="Cargando Control de errores..."/>;
  if(view==="ctrlEquipo")return dataHydrated&&rop02All.length>0?<ControlPorEquipo rop02All={rop02All} extState={stCtrlEquipo} setExtState={setStCtrlEquipo}/>:<Loader label="Cargando Control por Equipo..."/>;
  if(view==="atrasoROP02")return <ViewAtrasoROP02 rop02All={rop02ControlAll} onLegacyFallback={onLoadAll}/>;
  if(view==="combustible")return dataHydrated&&rop02All.length>0?<ViewCombustible rop02All={rop02All} extState={stComb} setExtState={setStComb}/>:<Loader label="Cargando Combustible..."/>;
  if(view==="rop05"){
    if(remoteTable.dataset!=="rop05"||!remoteTable.loadedOnce)return <Loader label="Cargando Productividad..."/>;
    return <ViewROP05 rop05={remoteTable.rows} extState={st05} setExtState={setSt05} remoteTotal={remoteTable.total} remoteHasMore={false} onRemoteMore={loadMoreRemote} onRemoteExport={exportRemote}/>;
  }
  if(view==="rop05Discriminacion")return dataHydrated&&rop05.length>0?<ViewROP05Discriminacion rop05={rop05} extState={st05} setExtState={setSt05}/>:<Loader label="Cargando Discriminación por tarea..."/>;
  if(view==="rma15CtrlEquipo")return dataHydrated&&rma15.length>0?<ControlRMA15PorEquipo rma15={rma15} extState={stRma15CtrlEquipo} setExtState={setStRma15CtrlEquipo}/>:<Loader label="Cargando Control por Equipo..."/>;
  if(view==="chc")return dataHydrated&&rop02All.length>0?<ViewCHC rop02All={rop02All} extState={stCHC} setExtState={setStCHC}/>:<Loader label="Cargando ICHC..."/>;
  if(view==="control"){
    if(!controlRemote.loaded)return <Loader label="Cargando Control ROP05 vs ROP02..."/>;
    return <ViewControl control={controlLive} rop02All={controlRemote.rop02} rop05={controlRemote.rop05} extState={stCtrl} setExtState={setStCtrl}/>;
  }
  return null;
}

export const OficinaTecnicaView = React.memo(OficinaTecnicaModule);
export { OFFICE_VIEW_NAMES };
