Warning: truncated output (original token count: 61825)
Total output lines: 4089

import React from "react";
import * as XLSX from "xlsx";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, Legend, ReferenceLine } from "recharts";
import { diagCount, diagEvent, diagGauge, diagReset, diagSnapshot, diagTiming, subscribeDiagnostics } from "./services/informeCostosDiagnostics.js";
import CostosTabPanel from "./components/CostosTabPanel.jsx";
import { getCostoHorarioAmortizacionOAlquiler, esEquipoPropioDelta } from "./utils/amortizationCost.js";
import ComparisonStrip from "../../components/ComparisonStrip.jsx";
import { previousComparablePeriod } from "../../shared/periodCompare.js";
import { isExcludedFromMaintenanceCostReport } from "../equipment/equipmentCode.js";
import { buildVisibleCategoryRowSpans } from "./utils/categoryRowSpan.js";
import { buildEquipmentRangeIndex, buildEquipmentWithRop02Activity2026, belongsToMaintenanceUniverse2026, clampInformeCostosDate, indexMaintenanceCostRows, maintenanceEquipmentCode, prepareMaintenanceCostRows, prepareRop02CostRows, queryEquipmentRangeIndex } from "./utils/equipmentUniverse2026.js";
import { matchesAmortizationTypeFilter } from "./engine/InformeCostosEngine.js";
import { buildCostEquipmentOptions, buildCostPropertyOptions } from "./utils/costGroups.js";
import { terminateInformeCostosWorker } from "./services/informeCostosWorkerClient.js";

const setBoundedCache=(cache,key,value,maxEntries=6)=>{
  if(cache.has(key))cache.delete(key);
  cache.set(key,value);
  while(cache.size>maxEntries)cache.delete(cache.keys().next().value);
};

function InformeCostosDiagnosticsPanel({ open, onClose, colors, dataCounts }) {
  const [snapshot,setSnapshot]=React.useState(()=>diagSnapshot());
  React.useEffect(()=>{
    if(!open)return undefined;
    const refresh=()=>setSnapshot(diagSnapshot());
    refresh();
    const unsubscribe=subscribeDiagnostics(refresh);
    const timer=window.setInterval(refresh,700);
    return()=>{unsubscribe();window.clearInterval(timer);};
  },[open]);
  if(!open)return null;
  const C=colors||{};
  const timings=Object.entries(snapshot.timings||{}).sort((a,b)=>(b[1]?.lastMs||0)-(a[1]?.lastMs||0));
  const slowest=timings[0];
  const fmt=v=>`${Number(v||0).toFixed(1)} ms`;
  const domCounts=typeof document!=="undefined"?{
    filas:document.querySelectorAll("table tbody tr").length,
    selects:document.querySelectorAll("select").length,
    inputs:document.querySelectorAll("input").length,
    nodos:document.querySelectorAll("*").length,
  }:{};
  const copyReport=async()=>{
    const report={generatedAt:new Date().toISOString(),dataCounts,domCounts,...snapshot};
    try{await navigator.clipboard.writeText(JSON.stringify(report,null,2));}
    catch(_){console.log("[InformeCostos Diagnóstico]",report);}
  };
  return <div style={{position:"fixed",inset:0,zIndex:999999,background:"rgba(0,0,0,.72)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div style={{width:"min(980px,96vw)",maxHeight:"88vh",overflow:"auto",background:C.surface||"#171717",border:`1px solid ${C.border||"#444"}`,borderRadius:14,boxShadow:"0 24px 80px rgba(0,0,0,.65)",color:C.text||"#fff"}}>
      <div style={{position:"sticky",top:0,zIndex:2,display:"flex",alignItems:"center",gap:10,padding:"13px 16px",background:C.surface||"#171717",borderBottom:`1px solid ${C.border||"#444"}`}}>
        <div><div style={{fontWeight:900,fontSize:16}}>Diagnóstico de rendimiento</div><div style={{fontSize:11,color:C.textMuted||"#999"}}>Mediciones reales de cálculo, Worker y render.</div></div>
        <div style={{marginLeft:"auto",display:"flex",gap:8}}><button onClick={copyReport} style={{padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border||"#555"}`,background:"rgba(255,255,255,.06)",color:"inherit",cursor:"pointer"}}>Copiar informe</button><button onClick={()=>{diagReset();setSnapshot(diagSnapshot());}} style={{padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border||"#555"}`,background:"rgba(255,255,255,.06)",color:"inherit",cursor:"pointer"}}>Reiniciar</button><button onClick={onClose} style={{padding:"7px 11px",borderRadius:7,border:"1px solid #ef4444",background:"rgba(239,68,68,.14)",color:"#ff8a8a",cursor:"pointer"}}>Cerrar</button></div>
      </div>
      <div style={{padding:16,display:"grid",gap:14}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>
          {[
            ["RMA15",dataCounts?.rma15||0],["RMA15 filtrados",dataCounts?.rma15Filtrado||0],["Insumos",dataCounts?.insumos||0],["Equipos",dataCounts?.equipos||0],
            ["Filas DOM",domCounts.filas||0],["Selects vivos",domCounts.selects||0],["Inputs vivos",domCounts.inputs||0],["Nodos DOM",domCounts.nodos||0]
          ].map(([label,value])=><div key={label} style={{padding:11,border:`1px solid ${C.border||"#444"}`,borderRadius:9,background:"rgba(255,255,255,.035)"}}><div style={{fontSize:10,color:C.textMuted||"#999",textTransform:"uppercase"}}>{label}</div><div style={{fontSize:20,fontWeight:900,marginTop:3}}>{Number(value).toLocaleString("es-AR")}</div></div>)}
        </div>
        {slowest&&<div style={{padding:12,border:"1px solid rgba(239,68,68,.55)",background:"rgba(239,68,68,.09)",borderRadius:9}}><b>Operación más lenta (última ejecución):</b> {slowest[0]} · {fmt(slowest[1].lastMs)}</div>}
        <div><div style={{fontWeight:900,marginBottom:7}}>Tiempos</div><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr>{["Operación","Último","Promedio","Máximo","Ejecuciones"].map(h=><th key={h} style={{textAlign:h==="Operación"?"left":"right",padding:"7px 8px",borderBottom:`1px solid ${C.border||"#444"}`,color:C.textMuted||"#aaa"}}>{h}</th>)}</tr></thead><tbody>{timings.map(([name,t])=><tr key={name}><td style={{padding:"7px 8px",borderBottom:`1px solid ${C.border||"#333"}`}}>{name}</td><td style={{padding:"7px 8px",textAlign:"right",fontWeight:800}}>{fmt(t.lastMs)}</td><td style={{padding:"7px 8px",textAlign:"right"}}>{fmt(t.avgMs)}</td><td style={{padding:"7px 8px",textAlign:"right",color:t.maxMs>1000?"#ff8a8a":undefined}}>{fmt(t.maxMs)}</td><td style={{padding:"7px 8px",textAlign:"right"}}>{t.count}</td></tr>)}</tbody></table></div></div>
        <div><div style={{fontWeight:900,marginBottom:7}}>Contadores</div><div style={{display:"flex",flexWrap:"wrap",gap:7}}>{Object.entries(snapshot.counters||{}).map(([name,value])=><span key={name} style={{padding:"6px 8px",borderRadius:7,border:`1px solid ${C.border||"#444"}`,fontSize:11}}>{name}: <b>{value}</b></span>)}</div></div>
        <div><div style={{fontWeight:900,marginBottom:7}}>Últimos eventos</div><div style={{display:"grid",gap:5,maxHeight:210,overflow:"auto"}}>{(snapshot.events||[]).slice(0,30).map((ev,i)=><div key={`${ev.at}_${i}`} style={{fontSize:11,padding:"6px 8px",borderRadius:6,background:"rgba(255,255,255,.035)"}}><span style={{color:C.textMuted||"#999"}}>{new Date(ev.at).toLocaleTimeString("es-AR")}</span> · <b>{ev.name}</b>{ev.durationMs!=null?` · ${fmt(ev.durationMs)}`:""}</div>)}</div></div>
      </div>
    </div>
  </div>;
}

function ViewCostosMantCore({rma15,rop02,insumos,listaEquipos,usdRate,deps,readOnly=false,equiposConMantenimiento2026,costDataIndex,rop02RangeIndex}){
  const {
    AmortRow, Badge, C, Card, CategoriaModeloTableRow, DateIn, HIST_COSTO_MENSUAL_ACUMULADO, MultiSel, ParamInput:BaseParamInput, PeriodMonthYear, SortableTH, appAlert, appConfirm, buildMonthKeysCosto, byDateFilter, canonicalEquivalentMachineCode, cleanKey, cleanMachine, dmCategoriasCommand, findColumnKey, fmtNum, getMachineType, getValue, mainMachineCode, matchMulti, monthKeyCosto, monthLabelCosto, multiIsAll, normalizeInsumoCode, normalizeMachineCode, normalizeMultiValue, positionTip, proyColor, sortRowsForTable, toNumber, uniq
  } = deps;
  React.useEffect(()=>()=>terminateInformeCostosWorker(),[]);
  const ParamInput=React.useCallback((props)=><BaseParamInput {...props} set={readOnly?(()=>{}):props.set} disabled={readOnly||props.disabled}/>,[BaseParamInput,readOnly]);
  const [diagnosticoAbierto,setDiagnosticoAbierto]=React.useState(false);
  React.useEffect(()=>{
    diagGauge("RMA15",rma15?.length||0);
    diagGauge("Insumos",insumos?.length||0);
    diagGauge("Lista equipos",listaEquipos?.length||0);
    diagEvent("Informe de Costos montado",{rma15:rma15?.length||0,insumos:insumos?.length||0,equipos:listaEquipos?.length||0});
    return()=>diagEvent("Informe de Costos desmontado");
  },[]);
  // Persistencia local para que los filtros no se pierdan al salir y volver a entrar
  // a la pestaña Costo de Mantenimientos.
  const COSTOS_MANT_STATE_KEY="delta_costos_mant_state_v1";
  const AMORT_CATEGORIES_KEY="dm_amortization_categories_v2";
  const readAmortizationConfig=React.useCallback(()=>{
    try{
      const raw=window.localStorage.getItem(AMORT_CATEGORIES_KEY);
      if(!raw)return{};
      const parsed=JSON.parse(raw);
      return parsed&&typeof parsed==="object"?parsed:{};
    }catch(_){return{};}
  },[]);
  const readCostosMantState=React.useCallback(()=>{
    try{
      const raw=window.localStorage.getItem(COSTOS_MANT_STATE_KEY);
      const parsed=raw?JSON.parse(raw):{};
      const base=parsed&&typeof parsed==="object"?parsed:{};
      const amort=readAmortizationConfig();
      if(amort.assignments&&typeof amort.assignments==="object")base.amortizacionCategorias=amort.assignments;
      if(Array.isArray(amort.categories))base.amortizacionCategoriasLista=amort.categories;
      return base;
    }catch(_){return{};}
  },[readAmortizationConfig]);
  const initialCostosMantState=React.useMemo(()=>readCostosMantState(),[readCostosMantState]);
  const readSavedNumber=React.useCallback((key,fallback)=>{
    const n=Number(initialCostosMantState?.[key]);
    return Number.isFinite(n)?n:fallback;
  },[initialCostosMantState]);

  const [tab,setTab]=React.useState(initialCostosMantState.tab||"t1");
  const renderStartedAt=performance.now();
  diagCount("Render · InformeCostosView");
  React.useLayoutEffect(()=>{
    const elapsed=performance.now()-renderStartedAt;
    diagTiming("Render/commit · InformeCostosView",elapsed,{tab});
  });
  const [amortizacionSubtab,setAmortizacionSubtab]=React.useState(initialCostosMantState.amortizacionSubtab||"tabla");
  const [amortizacionCategorias,setAmortizacionCategorias]=React.useState(()=>initialCostosMantState.amortizacionCategorias&&typeof initialCostosMantState.amortizacionCategorias==="object"?initialCostosMantState.amortizacionCategorias:{});
  const [amortizacionCategoriasLista,setAmortizacionCategoriasLista]=React.useState(()=>Array.isArray(initialCostosMantState.amortizacionCategoriasLista)?initialCostosMantState.amortizacionCategoriasLista:null);
  const [nuevaCategoriaAmortizacion,setNuevaCategoriaAmortizacion]=React.useState("");
  const [categoriaAmortizacionDrafts,setCategoriaAmortizacionDrafts]=React.useState({});
  const [categoriaAmortizacionReasignacion,setCategoriaAmortizacionReasignacion]=React.useState({});
  const persistAmortizationConfig=React.useCallback((assignments,categories)=>{
    try{
      const payload={
        assignments:assignments&&typeof assignments==="object"?assignments:{},
        categories:Array.isArray(categories)?categories:null,
        updatedAt:new Date().toISOString()
      };
      window.localStorage.setItem(AMORT_CATEGORIES_KEY,JSON.stringify(payload));
      window.dispatchEvent(new CustomEvent("dm-amortization-categories-updated",{detail:payload}));
      window.dispatchEvent(new CustomEvent("dm-costos-mant-state-updated"));
    }catch(err){console.error("No se pudieron guardar las categorías de amortización",err);}
  },[]);
  React.useEffect(()=>{
    persistAmortizationConfig(amortizacionCategorias,amortizacionCategoriasLista);
  },[amortizacionCategorias,amortizacionCategoriasLista,persistAmortizationConfig]);
  // Cambio directo de pestaña: primero responde el click y después se cargan/calculan datos.
  // No usar startTransition acá: bajo carga de datos React puede demorar el cambio visual.
  const costosRenderTab=tab;
  const isCostosTabPending=false;
  const setTabCostosFluido=React.useCallback((nextTab)=>{
    if(nextTab===tab)return;
    diagEvent("Cambio de tabla",{desde:tab,hacia:nextTab});
    setTab(nextTab);
  },[tab]);
  const useCostoDebouncedValue=(value,delay=180)=>{
    const [debounced,setDebounced]=React.useState(value);
    React.useEffect(()=>{
      const id=window.setTimeout(()=>setDebounced(value),delay);
      return ()=>window.clearTimeout(id);
    },[value,delay]);
    return debounced;
  };
  // Monta tablas grandes por tandas. Los cálculos y totales usan la colección
  // completa; sólo se distribuye el trabajo de crear nodos DOM entre varios frames.
  const useProgressiveRows=(rows,active=true,initial=60,step=60)=>{
    const total=(rows||[]).length;
    const [visible,setVisible]=React.useState(()=>Math.min(total,initial));
    React.useEffect(()=>{
      if(!active){setVisible(0);return;}
      setVisible(Math.min(total,initial));
      if(total<=initial)return;
      let alive=true;
      let handle=null;
      const schedule=()=>{
        const run=()=>{
          if(!alive)return;
          setVisible(v=>{
            const next=Math.min(total,v+step);
            if(next<total)schedule();
            return next;
          });
        };
        if(typeof window.requestIdleCallback==="function")handle=window.requestIdleCallback(run,{timeout:250});
        else handle=window.setTimeout(run,16);
      };
      schedule();
      return()=>{
        alive=false;
        if(typeof window.cancelIdleCallback==="function"&&handle!=null)window.cancelIdleCallback(handle);
        else if(handle!=null)window.clearTimeout(handle);
      };
    },[rows,active,total,initial,step]);
    return (rows||[]).slice(0,visible);
  };
  // Ventana virtual para tablas pesadas: React sólo crea las filas visibles.
  // Los cálculos y exportaciones siguen usando la colección completa.
  const useFixedVirtualRows=(rows,active=true,rowHeight=46,viewportHeight=520,overscan=6,minRows=18)=>{
    const safeRows=rows||[];
    const [scrollTop,setScrollTop]=React.useState(0);
    React.useEffect(()=>{ setScrollTop(0); },[safeRows,active]);
    // Virtualizar incluso tablas medianas. El diagnóstico real mostró que 58 filas
    // de Amortización generaban ~1.400 nodos y commits de 2,5–5,5 s, mientras el
    // Worker tardaba sólo ~20–30 ms. El cuello estaba en pintar el DOM, no calcular.
    const enabled=active&&safeRows.length>minRows;
    const visibleCount=Math.ceil(viewportHeight/rowHeight);
    const startIndex=enabled?Math.max(0,Math.floor(scrollTop/rowHeight)-overscan):0;
    const endIndex=enabled?Math.min(safeRows.length,startIndex+visibleCount+overscan*2):safeRows.length;
    const visibleRows=React.useMemo(()=>safeRows.slice(startIndex,endIndex),[safeRows,startIndex,endIndex]);
    const onScroll=React.useCallback((e)=>{
      if(enabled)setScrollTop(e.currentTarget.scrollTop);
    },[enabled]);
    return {
      enabled,visibleRows,startIndex,endIndex,onScroll,
      topPad:enabled?startIndex*rowHeight:0,
      bottomPad:enabled?(safeRows.length-endIndex)*rowHeight:0,
      total:safeRows.length
    };
  };
  const [usdRate2,setUsdRate2]=React.useState(()=>readSavedNumber("usdRate2",1400));
  const [hsEfJM,setHsEfJM]=React.useState(()=>readSavedNumber("hsEfJM",180));
  const [hsEfFS,setHsEfFS]=React.useState(()=>readSavedNumber("hsEfFS",180));
  const [mecJM,setMecJM]=React.useState(()=>readSavedNumber("mecJM",8));
  const [ctaMecJM,setCtaMecJM]=React.useState(()=>readSavedNumber("ctaMecJM",readSavedNumber("ctaMec",2)));
  const [mecFS,setMecFS]=React.useState(()=>readSavedNumber("mecFS",8));
  const [ctaMecFS,setCtaMecFS]=React.useState(()=>readSavedNumber("ctaMecFS",readSavedNumber("ctaMec",1)));
  const [ctaJM,setCtaJM]=React.useState(()=>readSavedNumber("ctaJM",2));
  const [ctaFS,setCtaFS]=React.useState(()=>readSavedNumber("ctaFS",1));
  const [costMec,setCostMec]=React.useState(()=>readSavedNumber("costMec",2390.27));
  const [costCTA,setCostCTA]=React.useState(()=>readSavedNumber("costCTA",3000));
  const [monthlyDollar,setMonthlyDollar]=React.useState(()=>({
    ...Object.fromEntries((HIST_COSTO_MENSUAL_ACUMULADO.months||[]).map(m=>[m.key,Number(m.dollar)||1400])),
    ...(initialCostosMantState.monthlyDollar||{})
  }));
  // Borrador separado para que escribir el dólar no recalcule ni mueva la tabla
  // en cada tecla. Se recalcula recién al salir del input o apretar Enter.
  const [monthlyDollarDraft,setMonthlyDollarDraft]=React.useState(()=>
    Object.fromEntries(Object.entries(monthlyDollar||{}).map(([k,v])=>[k,String(v)]))
  );
  const costoMensualScrollRef=React.useRef(null);
  const costoMensualScrollLeftRef=React.useRef(Number(initialCostosMantState.costoMensualScrollLeft)||0);
  const rememberCostoMensualScroll=React.useCallback(()=>{
    if(costoMensualScrollRef.current)costoMensualScrollLeftRef.current=costoMensualScrollRef.current.scrollLeft||0;
    return costoMensualScrollLeftRef.current||0;
  },[]);
  const restoreCostoMensualScroll=React.useCallback((left)=>{
    const target=Number.isFinite(Number(left))?Number(left):(costoMensualScrollLeftRef.current||0);
    window.requestAnimationFrame(()=>{
      if(costoMensualScrollRef.current)costoMensualScrollRef.current.scrollLeft=target;
      window.requestAnimationFrame(()=>{
        if(costoMensualScrollRef.current)costoMensualScrollRef.current.scrollLeft=target;
      });
    });
  },[]);
  const [acumData,setAcumData]=React.useState(null);
  const [acumError,setAcumError]=React.useState(null);
  const [acumParsing,setAcumParsing]=React.useState(false);
  const [modoFecha,setModoFecha]=React.useState(initialCostosMantState.modoFecha||"periodo");
  const [fechaDia,setFechaDia]=React.useState(initialCostosMantState.fechaDia||"");
  const [fechaD,setFechaD]=React.useState(initialCostosMantState.fechaD||"");
  const [fechaH,setFechaH]=React.useState(initialCostosMantState.fechaH||"");
  const [fMaquinas,setFMaquinas]=React.useState(initialCostosMantState.fMaquinas||"todos");
  const [fTipoEquipo,setFTipoEquipo]=React.useState(initialCostosMantState.fTipoEquipo||"todos");
  const [fProyecto,setFProyecto]=React.useState(initialCostosMantState.fProyecto||"todos");
  const [fInsumos,setFInsumos]=React.useState(initialCostosMantState.fInsumos||"todos");
  const [fPropiedad,setFPropiedad]=React.useState(initialCostosMantState.fPropiedad||"todos");

  // Filtros independientes por tabla dentro de Costos de Mantenimiento.
  // Cada pestaña mantiene su propia selección para no arrastrar filtros de otra tabla.
  const COSTOS_TABLAS_FILTRABLES=React.useMemo(()=>["t1","t7","t6","t4","t5","t8","t9","t10"],[]);
  const defaultFiltroPrincipalTabla=React.useCallback(()=>({fechaD:"",fechaH:"",proyecto:"todos",insumos:"todos"}),[]);
  const defaultCostosFiltrosTabla=React.useCallback(()=>({
    t1:{...defaultFiltroPrincipalTabla(),tipo:"todos",equipo:"todos",propiedad:"todos",contrato:"todos"},
    t7:{...defaultFiltroPrincipalTabla(),tipo:"todos",equipo:"todos",propiedad:"todos",contrato:"todos"},
    t6:{...defaultFiltroPrincipalTabla(),tipo:"todos",equipo:"todos",propiedad:"todos",contrato:"todos"},
    t4:{...defaultFiltroPrincipalTabla(),tipo:"todos",equipo:"todos",propiedad:"todos",contrato:"todos"},
    t5:{...defaultFiltroPrincipalTabla(),tipo:"todos",equipo:"todos",propiedad:"todos",contrato:"todos"},
    t8:{...defaultFiltroPrincipalTabla(),tipo:"todos",equipo:"todos",propiedad:"todos",contrato:"todos"},
    t9:{...defaultFiltroPrincipalTabla(),tipo:"todos",equipo:"todos",propiedad:"DELTA",contrato:"todos"},
    t10:{...defaultFiltroPrincipalTabla(),tipo:"todos",equipo:"todos",propiedad:"todos",contrato:"todos"},
  }),[defaultFiltroPrincipalTabla]);
  const [costosFiltrosTabla,setCostosFiltrosTabla]=React.useState(()=>({
    ...defaultCostosFiltrosTabla(),
    ...(initialCostosMantState.costosFiltrosTabla||initialCostosMantState.costosFiltrosPorTabla||{})
  }));
  const getCostosFiltrosTabla=React.useCallback((key)=>{
    const base=defaultCostosFiltrosTabla();
    return {...(base[key]||base.t1),...((costosFiltrosTabla||{})[key]||{})};
  },[costosFiltrosTabla,defaultCostosFiltrosTabla]);
  const setCostoFiltroTabla=React.useCallback((key,campo,value)=>{
    const apply=()=>setCostosFiltrosTabla(prev=>{
      const base=defaultCostosFiltrosTabla();
      const actual={...(base[key]||base.t1),...((prev||{})[key]||{})};
      return {...(prev||{}),[key]:{...actual,[campo]:value}};
    });
    if(React.startTransition)React.startTransition(apply);
    else apply();
  },[defaultCostosFiltrosTabla]);
  const resetCostoFiltroTabla=React.useCallback((key)=>{
    const apply=()=>setCostosFiltrosTabla(prev=>({...(prev||{}),[key]:defaultCostosFiltrosTabla()[key]||defaultCostosFiltrosTabla().t1}));
    if(React.startTransition)React.startTransition(apply);
    else apply();
  },[defaultCostosFiltrosTabla]);
  const resetCostosFiltrosTodasTablas=React.useCallback(()=>{
    const apply=()=>setCostosFiltrosTabla(defaultCostosFiltrosTabla());
    if(React.startTransition)React.startTransition(apply);
    else apply();
  },[defaultCostosFiltrosTabla]);
  const activeCostosFiltroKey=COSTOS_TABLAS_FILTRABLES.includes(costosRenderTab)?costosRenderTab:"t1";
  const isCostosTabTabla=costosRenderTab==="t1";
  const isCostosTabTop3=costosRenderTab==="t7";
  const isCostosTabAcumulado=costosRenderTab==="t6";
  const isCostosTabManoObra=costosRenderTab==="t4";
  const isCostosTabAmortizacion=costosRenderTab==="t5";
  const isCostosTabResumen=costosRenderTab==="t8";
  const isCostosTabAmortizacionHistorica=costosRenderTab==="t9";
  const isCostosTabResumenHistorico=costosRenderTab==="t10";

  // Sólo se recalcula el motor que necesita la pestaña visible. Los resultados de
  // las demás pestañas permanecen en sus caches y se refrescan al volver a ellas.
  // Antes, una pestaña quedaba "activada" para siempre y cada cambio de filtro
  // recalculaba simultáneamente Tabla, Costo mensual, Mano de Obra, Amortización y
  // Resumen, que era la principal causa de congelamientos del Informe de Costos.
  const calcTablaCostos=isCostosTabTabla||isCostosTabTop3;
  const calcCostoMensual=isCostosTabAcumulado||isCostosTabManoObra||isCostosTabAmortizacion||isCostosTabResumen;
  // Amortización y su resumen consumen el valor exacto de Mano de Obra por equipo;
  // mantener esa dependencia evita mostrar costos horarios incompletos.
  const calcManoObra=isCostosTabManoObra||isCostosTabAmortizacion||isCostosTabResumen;
  const costosBaseCalcReady=calcTablaCostos||calcCostoMensual;
  const needsManoObraCostos=calcManoObra;
  const filtrosCostosActivos=getCostosFiltrosTabla(activeCostosFiltroKey);
  const dFCMaquinas=useCostoDebouncedValue(filtrosCostosActivos.equipo,180);
  const dFCTipoEquipo=useCostoDebouncedValue(filtrosCostosActivos.tipo,180);
  const dFCPropiedad=useCostoDebouncedValue(filtrosCostosActivos.propiedad,180);
  const dFContrato=useCostoDebouncedValue(filtrosCostosActivos.contrato,180);

  // Filtros principales AISLADOS por subtabla. Sólo el filtro de la pestaña visible
  // alimenta sus cálculos; cambiar de pestaña recupera exactamente su selección propia.
  const dFMaquinas=useCostoDebouncedValue(filtrosCostosActivos.equipo,180);
  const dFTipoEquipo=useCostoDebouncedValue(filtrosCostosActivos.tipo,180);
  const dFProyecto=useCostoDebouncedValue(filtrosCostosActivos.proyecto,380);
  const dFInsumos=useCostoDebouncedValue(filtrosCostosActivos.insumos,380);
  const dFPropiedad=useCostoDebouncedValue(filtrosCostosActivos.propiedad,180);
  const dFechaDia="";
  const dFechaD=useCostoDebouncedValue(filtrosCostosActivos.fechaD,420);
  const dFechaH=useCostoDebouncedValue(filtrosCostosActivos.fechaH,420);
  const setFiltroFluido=React.useCallback((setter,value)=>{
    if(React.startTransition)React.startTransition(()=>setter(value));
    else setter(value);
  },[]);
  const setFMaquinasFluido=React.useCallback(v=>setFiltroFluido(setFMaquinas,v),[setFiltroFluido]);
  const setFTipoEquipoFluido=React.useCallback(v=>setFiltroFluido(setFTipoEquipo,v),[setFiltroFluido]);
  const setFProyectoFluido=React.useCallback(v=>setFiltroFluido(setFProyecto,v),[setFiltroFluido]);
  const setFInsumosFluido=React.useCallback(v=>setFiltroFluido(setFInsumos,v),[setFiltroFluido]);
  const setFPropiedadFluido=React.useCallback(v=>setFiltroFluido(setFPropiedad,v),[setFiltroFluido]);

  const [fechaDCostoMensual,setFechaDCostoMensual]=React.useState(initialCostosMantState.fechaDCostoMensual||"");
  const [fechaHCostoMensual,setFechaHCostoMensual]=React.useState(initialCostosMantState.fechaHCostoMensual||"");
  const historicalDefaultUntil=React.useMemo(()=>clampInformeCostosDate(new Date().toISOString().slice(0,10),"2026-12-31"),[]);
  const [fechaHistoricaDesde,setFechaHistoricaDesde]=React.useState(()=>clampInformeCostosDate(initialCostosMantState.fechaHistoricaDesde||"2026-01-01"));
  const [fechaHistoricaHasta,setFechaHistoricaHasta]=React.useState(()=>clampInformeCostosDate(initialCostosMantState.fechaHistoricaHasta||historicalDefaultUntil,historicalDefaultUntil));
  // Filtros AISLADOS exclusivamente para la tabla Mano de Obra.
  // El proyecto NO se filtra acá: Mano de Obra usa el filtro general fProyecto.
  const [fMOMaquinas,setFMOMaquinas]=React.useState(initialCostosMantState.fMOMaquinas||"todos");
  const [fMOTipoEquipo,setFMOTipoEquipo]=React.useState(initialCostosMantState.fMOTipoEquipo||"todos");
  const [fMOPropiedad,setFMOPropiedad]=React.useState(initialCostosMantState.fMOPropiedad||"todos");
  const filtrosMOTabla=getCostosFiltrosTabla("t4");
  const dFMOMaquinas=useCostoDebouncedValue(filtrosMOTabla.equipo,180);
  const dFMOTipoEquipo=useCostoDebouncedValue(filtrosMOTabla.tipo,180);
  const dFMOPropiedad=useCostoDebouncedValue(filtrosMOTabla.propiedad,180);
  const setFMOMaquinasFluido=React.useCallback(v=>setFiltroFluido(setFMOMaquinas,v),[setFiltroFluido]);
  const setFMOTipoEquipoFluido=React.useCallback(v=>setFiltroFluido(setFMOTipoEquipo,v),[setFiltroFluido]);
  const setFMOPropiedadFluido=React.useCallback(v=>setFiltroFluido(setFMOPropiedad,v),[setFiltroFluido]);
  // Filtros propios del Resumen por equipo: no afectan las demás tablas.
  // Aceptan selección múltiple igual que el resto de filtros de la app.
  const [fResumenTipo,setFResumenTipo]=React.useState(initialCostosMantState.fResumenTipo||"todos");
  const [fResumenEquipo,setFResumenEquipo]=React.useState(initialCostosMantState.fResumenEquipo||"todos");
  const [fResumenPropiedad,setFResumenPropiedad]=React.useState(initialCostosMantState.fResumenPropiedad||"todos");
  // Diferimos estos filtros para que el menú responda al instante y el cálculo pesado
  // del resumen se haga un momento después, sin trabar la interfaz.
  const filtrosResumenTabla=getCostosFiltrosTabla("t8");
  const dFResumenTipo=useCostoDebouncedValue(filtrosResumenTabla.tipo,180);
  const dFResumenEquipo=useCostoDebouncedValue(filtrosResumenTabla.equipo,180);
  const dFResumenPropiedad=useCostoDebouncedValue(filtrosResumenTabla.propiedad,180);
  // Estado combinado para useListaVidaUtil y vidaUtilOverride en un solo objeto
  // → garantiza que ambos se actualicen en el mismo render, sin estados intermedios
  const [vidaUtilState,setVidaUtilState]=React.useState(()=>{
    const lista0=initialCostosMantState.useListaVidaUtil||{};
    const override0=initialCostosMantState.vidaUtilOverride||{};
    // Sanear: si lista tiene false pero override no tiene valor → resetear a true
    // para evitar inputs en blanco al arrancar
    const listaClean={};
    Object.entries(lista0).forEach(([eq,v])=>{
      if(v===false&&!(override0[eq]>0)) listaClean[eq]=true; // reset a lista maestra
      else listaClean[eq]=v;
    });
    return {lista:listaClean,override:override0};
  });
  const useListaVidaUtil=vidaUtilState.lista;
  const vidaUtilOverride=vidaUtilState.override;
  const setUseListaVidaUtil=React.useCallback((fn)=>setVidaUtilState(s=>({...s,lista:typeof fn==='function'?fn(s.lista):fn})),[]);
  const setVidaUtilOverride=React.useCallback((fn)=>setVidaUtilState(s=>({...s,override:typeof fn==='function'?fn(s.override):fn})),[]);
  // Refs para que los useMemo pesados no se invaliden en cada tecla
  const useListaVidaUtilRef=React.useRef(useListaVidaUtil);
  const vidaUtilOverrideRef=React.useRef(vidaUtilOverride);
  React.useLayoutEffect(()=>{useListaVidaUtilRef.current=useListaVidaUtil;},[useListaVidaUtil]);
  React.useLayoutEffect(()=>{vidaUtilOverrideRef.current=vidaUtilOverride;},[vidaUtilOverride]);
  const [hombreVestido,setHombreVestido]=React.useState(()=>readSavedNumber("hombreVestido",0));
  // Horas efectivas por tipo de propiedad: propios = propiedad DELTA, arrendados = el resto
  const [hsPropios,setHsPropios]=React.useState(()=>readSavedNumber("hsPropios",0));
  const [hsArrendados,setHsArrendados]=React.useState(()=>readSavedNumber("hsArrendados",0));
  const [costosMantSorts,setCostosMantSorts]=React.useState(initialCostosMantState.costosMantSorts||{});

  const saveCostosMantRef=React.useRef(null);
  const costosMantSnapshotRef=React.useRef({});
  React.useEffect(()=>{
    const snapshot={
      tab,usdRate2,hsEfJM,hsEfFS,mecJM,ctaMecJM,mecFS,ctaMecFS,ctaJM,ctaFS,costMec,costCTA,
      modoFecha,fechaDia,fechaD,fechaH,fMaquinas,fTipoEquipo,fProyecto,fInsumos,fPropiedad,
      fechaDCostoMensual,fechaHCostoMensual,monthlyDollar,
      costosFiltrosTabla,
      fMOMaquinas,fMOTipoEquipo,fMOPropiedad,
      fResumenTipo,fResumenEquipo,fResumenPropiedad,
      costosMantSorts,
      costoMensualScrollLeft:costoMensualScrollLeftRef.current||0,
      useListaVidaUtil,vidaUtilOverride,hombreVestido,hsPropios,hsArrendados,
      amortizacionSubtab,amortizacionCategorias,amortizacionCategoriasLista
    };
    costosMantSnapshotRef.current=snapshot;
    // Guardado breve y diferido: mantiene fluidez, pero no pierde el último cambio.
    if(saveCostosMantRef.current)window.clearTimeout(saveCostosMantRef.current);
    saveCostosMantRef.current=window.setTimeout(()=>{
      const guardar=()=>{try{window.localStorage.setItem(COSTOS_MANT_STATE_KEY,JSON.stringify(costosMantSnapshotRef.current));window.dispatchEvent(new CustomEvent("dm-costos-mant-state-updated"));}catch(_){}};
      if(typeof window.requestIdleCallback==="function")window.requestIdleCallback(guardar,{timeout:1200});
      else guardar();
    },450);
    return ()=>{
      if(saveCostosMantRef.current)window.clearTimeout(saveCostosMantRef.current);
    };
  },[
    tab,usdRate2,hsEfJM,hsEfFS,mecJM,ctaMecJM,mecFS,ctaMecFS,ctaJM,ctaFS,costMec,costCTA,
    monthlyDollar,modoFecha,fechaDia,fechaD,fechaH,fMaquinas,fTipoEquipo,fProyecto,fInsumos,fPropiedad,
    fechaDCostoMensual,fechaHCostoMensual,costosFiltrosTabla,
    fMOMaquinas,fMOTipoEquipo,fMOPropiedad,
    fResumenTipo,fResumenEquipo,fResumenPropiedad,costosMantSorts,
    vidaUtilState,hombreVestido,hsPropios,hsArrendados,amortizacionSubtab,amortizacionCategorias,amortizacionCategoriasLista
  ]);

  // Al salir de Informe de Costos, guardar inmediatamente el último estado de todos los filtros.
  React.useEffect(()=>()=>{
    if(saveCostosMantRef.current)window.clearTimeout(saveCostosMantRef.current);
    try{window.localStorage.setItem(COSTOS_MANT_STATE_KEY,JSON.stringify(costosMantSnapshotRef.current));window.dispatchEvent(new CustomEvent("dm-costos-mant-state-updated"));}catch(_){}
  },[]);

  const hastaCostoMensual=dFechaH||"";

  // Mantener el período mensual alineado con el filtro general Mes/Año.
  // Al seleccionar un mes, PeriodMonthYear genera el corte operativo 26 → 25;
  // ambas fechas deben llegar también a las tablas mensuales.
  React.useEffect(()=>{
    setFechaDCostoMensual(dFechaD||"");
    setFechaHCostoMensual(dFechaH||"");
  },[dFechaD,dFechaH]);

  const rma15PorFechaBase=React.useMemo(()=>byDateFilter(rma15||[],modoFecha,dFechaDia,dFechaD,dFechaH),[rma15,modoFecha,dFechaDia,dFechaD,dFechaH]);
  const rma15CostoMensualPorFechaBase=React.useMemo(()=>
    byDateFilter(rma15||[],"periodo","",fechaDCostoMensual,hastaCostoMensual),
    [rma15,fechaDCostoMensual,hastaCostoMensual]
  );

  // Filtro general de insumos del Informe de Costos. Mantiene las OT y demás datos
  // de cada registro, pero deja dentro de `insumos` únicamente los seleccionados.
  // De esta forma se recalculan los costos sin alterar Mano de Obra ni otros conteos.
  const costoInsumoCode=React.useCallback((ins)=>String(ins?.codigo||ins?.code||ins?.cod||"").trim(),[]);
  const costoInsumoNombre=React.useCallback((ins)=>String(ins?.nombre||ins?.descripcion||ins?.insumo||"").trim(),[]);
  const insumosCostoOpts=React.useMemo(()=>{
    const map=new Map();
    [...(rma15PorFechaBase||[]),...(rma15CostoMensualPorFechaBase||[])].forEach(r=>{
      (r.insumos||[]).forEach(ins=>{
        const cod=costoInsumoCode(ins);
        if(!cod)return;
        const info=(insumos||{})[normalizeInsumoCode(cod)]||(insumos||{})[cod]||{};
        const desc=costoInsumoNombre(ins)||String(info?.descripcion||info?.nombre||"").trim()||cod;
        if(!map.has(cod)||map.get(cod)===cod)map.set(cod,desc);
      });
    });
    return [
      {value:"todos",label:"Todos"},
      ...[...map.entries()].sort((a,b)=>String(a[0]).localeCompare(String(b[0]),undefined,{numeric:true})).map(([cod,desc])=>({value:cod,label:`${cod} — ${desc}`}))
    ];
  },[rma15PorFechaBase,rma15CostoMensualPorFechaBase,insumos,costoInsumoCode,costoInsumoNombre]);

  const filtrarInsumosCosto=React.useCallback((rows,seleccion)=>{
    if(multiIsAll(seleccion,"todos"))return rows||[];
    const selected=new Set((Array.isArray(seleccion)?seleccion:[seleccion]).map(v=>String(v||"").trim()).filter(Boolean));
    return (rows||[]).map(r=>({...r,_costNeedsRecalc:true,insumos:(r.insumos||[]).filter(ins=>selected.has(costoInsumoCode(ins)))}));
  },[costoInsumoCode]);

  // Precalcular una sola vez los importes de cada registro. Varias tablas usaban
  // volver a recorrer todos los insumos para obtener exactamente el mismo total.
  // Mantener los insumos originales permite que Top 3 siga mostrando el detalle.
  const costoFilaPreparadaMemo=React.useMemo(()=>new WeakMap(),[rma15]);
  const prepararFilasCosto=React.useCallback((rows)=>(rows||[]).map(r=>{
    if(r&&typeof r==="object"&&costoFilaPreparadaMemo.has(r))return costoFilaPreparadaMemo.get(r);
    let totalARS=r?._costNeedsRecalc?NaN:Number(r?._costoTotalARS);
    if(!Number.isFinite(totalARS)){
      totalARS=0;
      (r.insumos||[]).forEach(ins=>{totalARS+=Number(ins?.costoTotal)||0;});
    }
    const out=!r?._costNeedsRecalc&&r?._dateKey?r:{...r,_costNeedsRecalc:false,_costoTotalARS:totalARS,_esPreventivo:String(r.tipoMant||"").toUpperCase().includes("PREV")};
    if(r&&typeof r==="object")costoFilaPreparadaMemo.set(r,out);
    return out;
  }),[costoFilaPreparadaMemo]);
  const rma15PorFecha=React.useMemo(()=>prepararFilasCosto(filtrarInsumosCosto(rma15PorFechaBase,dFInsumos)),[rma15PorFechaBase,dFInsumos,filtrarInsumosCosto,prepararFilasCosto]);
  const rma15CostoMensualPorFecha=React.useMemo(()=>prepararFilasCosto(filtrarInsumosCosto(rma15CostoMensualPorFechaBase,dFInsumos)),[rma15CostoMensualPorFechaBase,dFInsumos,filtrarInsumosCosto,prepararFilasCosto]);

  // Mapa de Lista Maestra para correlación.
  // REGLA DEFINITIVA:
  // - El Código Viejo se usa SOLO para encontrar el equipo en Lista Maestra.
  // - En las tablas NO se muestra ni se concatena el Código Viejo.
  // - Si en RMA15 viene algo como "MOT-0024-(MOT-0047)", para mostrar se usa
  //   el Código Drusila real de Lista Maestra o, como respaldo, el código externo.
  const isInvalidEquipoCodeCosto=React.useCallback((code)=>{
    const raw=String(code||"").trim().toUpperCase();
    const compact=raw.replace(/[^A-Z0-9]/g,"");
    return !raw || raw==="-" || raw==="—" || raw==="S/D" || raw==="SD" || raw==="N/A" || raw==="NA" || raw==="NO TIENE" || raw==="SIN DATO" || compact==="";
  },[]);

  const codeLookupVariantsCosto=React.useCallback((code)=>{
    const raw=String(code||"").trim().toUpperCase();
    if(isInvalidEquipoCodeCosto(raw))return[];
    const clean=cleanMachine(raw);
    const norm=normalizeMachineCode(raw);
    const canon=canonicalEquivalentMachineCode(clean);
    const noParen=raw.replace(/\s*\(.*?\)/g,"").replace(/[-\s]+$/g,"");
    const canonNoParen=canonicalEquivalentMachineCode(noParen);
    const compact=raw.replace(/[^A-Z0-9]/g,"");
    const cleanCompact=String(clean||"").replace(/[^A-Z0-9]/g,"");
    const normCompact=String(norm||"").replace(/[^A-Z0-9]/g,"");
    const canonCompact=String(canon||"").replace(/[^A-Z0-9]/g,"");
    const canonNoParenCompact=String(canonNoParen||"").replace(/[^A-Z0-9]/g,"");
    return [...new Set([raw,clean,norm,canon,noParen,canonNoParen,compact,cleanCompact,normCompact,canonCompact,canonNoParenCompact].map(v=>String(v||"").trim().toUpperCase()).filter(v=>v&&!isInvalidEquipoCodeCosto(v)))];
  },[isInvalidEquipoCodeCosto]);

  // Correlación definitiva de códigos de equipos.
  // - El código viejo SOLO se usa para encontrar la fila de Lista Maestra.
  // - Para mostrar en tablas se usa Código Drusila si existe; si no, el código real sin paréntesis.
  // - Se aceptan variantes con/sin guion: MOT-0049 = MOT0049.
  // - Si una clave aparece en varias columnas, gana Código Drusila > Código Nuevo > Código Viejo.
  const extraerCodigosCosto=React.useCallback((maquina)=>{
    const raw=String(maquina||"").trim().toUpperCase();
    const main=mainMachineCode(raw);
    const sinParentesis=raw.replace(/\s*\(.*?\)/g,"").replace(/[-\s]+$/g,"");
    const viejos=[];
    const re=/\(([^()]+)\)/g;
    let m;
    while((m=re.exec(raw))!==null){
      const cod=String(m[1]||"").trim().toUpperCase();
      if(cod)viejos.push(cod);
    }
    return {raw,main,sinParentesis,viejos};
  },[]);

  const machineLookupKeysMemo=React.useMemo(()=>new Map(),[listaEquipos]);
  const machineLookupKeysCosto=React.useCallback((maquina)=>{
    const cacheKey=String(maquina||"").trim().toUpperCase();
    if(machineLookupKeysMemo.has(cacheKey))return machineLookupKeysMemo.get(cacheKey);
    const {raw,main,sinParentesis,viejos}=extraerCodigosCosto(maquina);
    // Primero código real / externo. Código viejo entre paréntesis queda al final,
    // sólo como respaldo de correlación.
    const base=[main,sinParentesis,raw,...viejos];
    const keys=[];
    base.forEach(code=>{
      codeLookupVariantsCosto(code).forEach(k=>keys.push(k));
    });
    const out=[...new Set(keys)];
    machineLookupKeysMemo.set(cacheKey,out);
    return out;
  },[extraerCodigosCosto,codeLookupVariantsCosto,machineLookupKeysMemo]);

  const listaEquiposIndex=React.useMemo(()=>{
    const bestMap={};
    const allMap={};

    const getListaVal=(e,mainLabel,aliases=[])=>{
      const keys=Object.keys(e||{});
      const k=findColumnKey(keys,mainLabel,aliases);
      return k?e[k]:"";
    };

    const put=(code,e,priority)=>{
      codeLookupVariantsCosto(code).forEach(k=>{
        if(!k)return;
        if(!allMap[k])allMap[k]=[];
        allMap[k].push({row:e,priority});
        if(!bestMap[k]||priority>bestMap[k].priority){
          bestMap[k]={row:e,priority};
        }
      });
    };

    (listaEquipos||[]).forEach(e=>{
      const codDrusila=getListaVal(e,"Código Drusila",["Codigo Drusila","Código de Drusila","Cod Drusila","Cod. Drusila","Interno Drusila"]);
      const codNuevo=getListaVal(e,"Código Nuevo",["Codigo Nuevo","Código nuevo","Codigo nuevo","Codigo Interno","Código Interno","CODIGO N° INTERNO","Interno","Código Actual","Codigo Actual"]);
      const codViejo=getListaVal(e,"Código Viejo",["Codigo Viejo","Código viejo","Codigo viejo","Código Anterior","Codigo Anterior","Cod Viejo","Cod. Viejo","Cod viejo","Cod. viejo","Código Antiguo","Codigo Antiguo","Código Alternativo","Codigo Alternativo"]);

      // Se cargan TODAS las coincidencias en allMap.
      // Para mostrar equipo se sigue usando el mejor match, pero para el filtro
      // Propiedad se consideran todas las propiedades posibles asociadas al código.
      // Así no se pierden equipos cuando RMA15 usa Código Viejo o variantes sin guion.
      put(codViejo,e,60);
      put(codNuevo,e,90);
      put(codDrusila,e,100);
    });

    return {bestMap,allMap};
  },[listaEquipos,codeLookupVariantsCosto]);

  const equipoListaMaestraMemo=React.useMemo(()=>new Map(),[listaEquiposIndex]);
  const equiposListaMaestraAllMemo=React.useMemo(()=>new Map(),[listaEquiposIndex]);
  const getEquipoListaMaestra=React.useCallback((maquina)=>{
    const cacheKey=String(maquina||"").trim().toUpperCase();
    if(equipoListaMaestraMemo.has(cacheKey))return equipoListaMaestraMemo.get(cacheKey);
    const keys=machineLookupKeysCosto(maquina);
    let best=null;
    for(const k of keys){
      const hit=listaEquiposIndex.bestMap[k];
      if(hit&&(!best||hit.priority>best.priority))best=hit;
      if(best&&best.priority>=100)break;
    }
    const out=best?.row||null;
    equipoListaMaestraMemo.set(cacheKey,out);
    return out;
  },[listaEquiposIndex,machineLookupKeysCosto,equipoListaMaestraMemo]);

  const getEquiposListaMaestraAll=React.useCallback((maquina)=>{
    const cacheKey=String(maquina||"").trim().toUpperCase();
    if(equiposListaMaestraAllMemo.has(cacheKey))return equiposListaMaestraAllMemo.get(cacheKey);
    const keys=machineLookupKeysCosto(maquina);
    const seen=new WeakSet();
    const out=[];
    keys.forEach(k=>{
      (listaEquiposIndex.allMap[k]||[]).forEach(hit=>{
        const row=hit.row;
        if(!row)return;
        if(seen.has(row))return;
        seen.add(row);
        out.push(row);
      });
    });
    equiposListaMaestraAllMemo.set(cacheKey,out);
    return out;
  },[listaEquiposIndex,machineLookupKeysCosto,equiposListaMaestraAllMemo]);

  // Identidad canónica única para toda la app: todas las variantes de una fila
  // de Lista Maestra apuntan al Código Nuevo. Si no existe, se usa Código Drusila
  // y, como último respaldo, Código Viejo.
  const identidadCanonicaEquipos=React.useMemo(()=>{
    const map=new Map();
    const getListaVal=(e,mainLabel,aliases=[])=>{
      const keys=Object.keys(e||{});
      const k=findColumnKey(keys,mainLabel,aliases);
      return k?String(e[k]||"").trim():"";
    };
    (listaEquipos||[]).forEach(e=>{
      const codNuevo=getListaVal(e,"Código Nuevo",["Codigo Nuevo","Código nuevo","Codigo nuevo","Código Actual","Codigo Actual","Código Interno","Codigo Interno","CODIGO N° INTERNO","Interno"]);
      const codDrusila=getListaVal(e,"Código Drusila",["Codigo Drusila","Código de Drusila","Codigo de Drusila","Cod Drusila","Cod. Drusila","Interno Drusila"]);
      const codViejo=getListaVal(e,"Código Viejo",["Codigo Viejo","Código viejo","Codigo viejo","Código Anterior","Codigo Anterior","Cod Viejo","Cod. Viejo","Código Antiguo","Codigo Antiguo","Código Alternativo","Codigo Alternativo"]);
      const canon=cleanMachine(codNuevo||codDrusila||codViejo);
      if(!canon||isInvalidEquipoCodeCosto(canon))return;
      [codNuevo,codDrusila,codViejo].forEach(code=>{
        codeLookupVariantsCosto(code).forEach(k=>map.set(k,canon));
      });
      codeLookupVariantsCosto(canon).forEach(k=>map.set(k,canon));
    });
    return map;
  },[listaEquipos,codeLookupVariantsCosto,isInvalidEquipoCodeCosto]);

  const codigoCanonicoEquipoMemo=React.useMemo(()=>new Map(),[identidadCanonicaEquipos,listaEquiposIndex]);
  const codigoCanonicoEquipo=React.useCallback((maquina)=>{
    const cacheKey=String(maquina||"").trim().toUpperCase();
    if(codigoCanonicoEquipoMemo.has(cacheKey))return codigoCanonicoEquipoMemo.get(cacheKey);
    // Equivalencias históricas confirmadas: estos códigos CFN fueron
    // reemplazados por los PCA indicados. Se aplican antes de cualquier
    // agrupamiento para consolidar todos los meses en una sola fila.
    const equivalenciasHistoricasForzadas={
      "CFN-0101":"PCA-0101",
      "CFN-0041":"PCA-0081",
      "CFN-0043":"PCA-0093",
      "CFN-0044":"PCA-0095",
      "CFN-0045":"PCA-0095",
      "EXC-0014":"EXC-0034",
      "EXC-0019":"EXC-0048",
      "MOT-0024":"MOT-0047",
      "RTP-0010":"RTP-0016",
      "RTP-0012":"RTP-0024",
      "TOP-0014":"TOP-0032",
      "TOP-0059":"TOP-0058",
    };
    const codigoLimpioForzado=cleanMachine(String(maquina||"").replace(/\s*\(.*?\)/g,""));
    if(equivalenciasHistoricasForzadas[codigoLimpioForzado]){
      const out=equivalenciasHistoricasForzadas[codigoLimpioForzado];
      codigoCanonicoEquipoMemo.set(cacheKey,out);
      return out;
    }
    const keys=machineLookupKeysCosto(maquina);
    for(const k of keys){
      const canon=identidadCanonicaEquipos.get(k);
      if(canon){codigoCanonicoEquipoMemo.set(cacheKey,canon);return canon;}
    }
    const eq=getEquipoListaMaestra(maquina);
    if(eq){
      const keysEq=Object.keys(eq||{});
      const read=(label,aliases=[])=>{const k=findColumnKey(keysEq,label,aliases);return k?String(eq[k]||"").trim():"";};
      const canon=read("Código Nuevo",["Codigo Nuevo","Código nuevo","Codigo nuevo","Código Actual","Codigo Actual","Código Interno","Codigo Interno","CODIGO N° INTERNO","Interno"])||
        read("Código Drusila",["Codigo Drusila","Código de Drusila","Codigo de Drusila","Cod Drusila","Cod. Drusila","Interno Drusila"])||
        read("Código Viejo",["Codigo Viejo","Código Anterior","Codigo Anterior","Cod Viejo","Cod. Viejo"]);
      if(canon){const out=cleanMachine(canon);codigoCanonicoEquipoMemo.set(cacheKey,out);return out;}
    }
    const {main,sinParentesis}=extraerCodigosCosto(maquina);
    const out=cleanMachine(main||sinParentesis||maquina)||"—";
    codigoCanonicoEquipoMemo.set(cacheKey,out);
    return out;
  },[identidadCanonicaEquipos,machineLookupKeysCosto,getEquipoListaMaestra,extraerCodigosCosto,codigoCanonicoEquipoMemo]);

  const equipoCostoDisplay=React.useCallback((maquina)=>codigoCanonicoEquipo(maquina),[codigoCanonicoEquipo]);

  // ROP02 y RMA15 no siempre conservan el mismo interno (código viejo,
  // Drusila o el actual). Este acumulador usa la identidad canónica visible
  // en el informe, de modo que el divisor horario coincide con cada fila.
  const horasRop02PorEquipoCanonico=React.useMemo(()=>{
    const byEquipment=new Map();
    (rop02||[]).forEach(row=>{
      const date=String(row?._dateKey||row?.fecha||"").slice(0,10);
      const hours=Math.max(0,Number(row?.horas)||0);
      const code=codigoCanonicoEquipo(row?.maquina||row?.interno||row?.equipo);
      if(!date.startsWith("2026-")||!code||code==="—"||hours<=0)return;
      if(!byEquipment.has(code))byEquipment.set(code,new Map());
      const days=byEquipment.get(code);
      days.set(date,(days.get(date)||0)+hours);
    });
    return byEquipment;
  },[rop02,codigoCanonicoEquipo]);

  const getPropiedadFromListaRow=React.useCallback((eq)=>{
    const keys=Object.keys(eq||{});
    const k=findColumnKey(keys,"Propiedad",["PROPIEDAD","Dueño","Dueno","Empresa","Proveedor","Propietario","Titular","Empresa Propietaria","Empresa propietaria","Owner","Rental","Arrendadora"]);
    return String(k?eq[k]:"S/D").trim().toUpperCase()||"S/D";
  },[]);

  const propiedadesEquipoMemo=React.useMemo(()=>new Map(),[listaEquiposIndex]);
  const propiedadesEquipo=React.useCallback((maquina)=>{
    const raw=String(maquina||"").trim().toUpperCase();
    if(propiedadesEquipoMemo.has(raw))return propiedadesEquipoMemo.get(raw);
    if(isInvalidEquipoCodeCosto(raw))return ["S/D"];

    const rows=getEquiposListaMaestraAll(maquina);
    const props=uniq(rows.map(getPropiedadFromListaRow).filter(Boolean));

    // Regla: S/D sólo se usa cuando el equipo NO tiene una propiedad real.
    // Si un equipo cruza con DELTA, SULLAIR, DIESEL LANGE, etc., no debe aparecer
    // también dentro de S/D por culpa de filas con Código Viejo = "-".
    const reales=props.filter(p=>p&&p!=="S/D"&&p!=="-"&&p!=="—");
    const out=reales.length?reales:["S/D"];
    propiedadesEquipoMemo.set(raw,out);
    return out;
  },[getEquiposListaMaestraAll,getPropiedadFromListaRow,isInvalidEquipoCodeCosto,propiedadesEquipoMemo]);

  const propiedadEquipo=React.useCallback((maquina)=>{
    const props=propiedadesEquipo(maquina);
    const real=props.find(p=>p&&p!=="S/D");
    return real||props[0]||"S/D";
  },[propiedadesEquipo]);

  const familiaEquipoCostoMemo=React.useMemo(()=>new Map(),[listaEquiposIndex]);
  const familiaEquipoCosto=React.useCallback((maquina)=>{
    const cacheKey=String(maquina||"").trim().toUpperCase();
    if(familiaEquipoCostoMemo.has(cacheKey))return familiaEquipoCostoMemo.get(cacheKey);
    const eq=getEquipoListaMaestra(maquina);
    const familia=String(getValue(eq||{},["Familia","FAMILIA"])||"").trim().toUpperCase();
    familiaEquipoCostoMemo.set(cacheKey,familia);
    return familia;
  },[getEquipoListaMaestra,getValue,familiaEquipoCostoMemo]);

  const lugarAlquilerEquipoCostoMemo=React.useMemo(()=>new Map(),[listaEquiposIndex]);
  const lugarAlquilerEquipoCosto=React.useCallback((maquina)=>{
    const cacheKey=String(maquina||"").trim().toUpperCase();
    if(lugarAlquilerEquipoCostoMemo.has(cacheKey))return lugarAlquilerEquipoCostoMemo.get(cacheKey);
    const eq=getEquipoListaMaestra(maquina);
    const lugar=String(getValue(eq||{},[
      "Lugar de alquiler","Lugar De Alquiler","LUGAR DE ALQUILER","Lugar alquiler","Lugar","Proyecto de alquiler"
    ])||"").trim().toUpperCase();
    lugarAlquilerEquipoCostoMemo.set(cacheKey,lugar);
    return lugar;
  },[getEquipoListaMaestra,getValue,lugarAlquilerEquipoCostoMemo]);

  // El filtro Tipo máquina se define por Familia de Lista Maestra. Las
  // categorías operativas derivadas exclusivamente de Familia.
  const categoriaTipoMaquina=React.useCallback((familia="")=>{
    const value=String(familia||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toUpperCase();
    if(value.startsWith("CAMIONETA"))return "CAMIONETAS";
    if(value.startsWith("CAMION"))return "CAMIONES";
    if(value.includes("EXCAVADORA"))return "EXCAVADORA";
    if(value.includes("MINICARGADORA"))return "MINICARGADORA";
    if(value.includes("MOTONIVELADORA"))return "MOTONIVELADORA";
    if(value.includes("CARGADOR"))return "CARGADOR FRONTAL";
    if(value.includes("RETROPALA"))return "RETROPALA";
    if(value.includes("RODILLO")||value.includes("COMPACTADOR"))return "RODILLO";
    if(value.includes("TOPADORA"))return "TOPADORA";
    return "OTROS";
  },[]);
  const coincideTipoFiltro=React.useCallback((tipo,seleccion)=>{
    if(multiIsAll(seleccion,"todos"))return true;
    const selected=Array.isArray(seleccion)?seleccion:[seleccion];
    const road=new Set(["EXCAVADORA","MINICARGADORA","MOTONIVELADORA","CARGADOR FRONTAL","RETROPALA","RODILLO","TOPADORA"]);
    return selected.includes(tipo)||(selected.includes("MAQUINAS")&&road.has(tipo));
  },[multiIsAll]);

  const matchPropiedadEquipo=React.useCallback((maquina,seleccion)=>{
    if(multiIsAll(seleccion,"todos"))return true;
    const props=propiedadesEquipo(maquina);
    const sel=Array.isArray(seleccion)?seleccion:[seleccion].filter(Boolean);
    return sel.some(p=>props.includes(String(p||"").trim().toUpperCase()));
  },[propiedadesEquipo]);

  // Cache liviana por equipo para que los filtros no recalculen la correlación
  // contra Lista Maestra miles de veces en cada render. No cambia resultados:
  // sólo guarda display, propiedades y tipo ya calculados para cada máquina
  // visible dentro del rango de fecha actual.
  const rma15MetaMap=React.useMemo(()=>{
    const map=new Map();
    [...(rma15PorFecha||[]),...(rma15CostoMensualPorFecha||[])].forEach(r=>{
      const key=String(r.maquina||"");
      if(map.has(key))return;
      const props=propiedadesEquipo(r.maquina);
      const real=props.find(p=>p&&p!=="S/D");
      const familia=familiaEquipoCosto(r.maquina);
      const lugarAlquiler=lugarAlquilerEquipoCosto(r.maquina);
      map.set(key,{
        display:equipoCostoDisplay(r.maquina),
        props,
        propiedad:real||props[0]||"S/D",
        familia,
        lugarAlquiler,
        tipo:categoriaTipoMaquina(familia),
      });
    });
    return map;
  },[rma15PorFecha,rma15CostoMensualPorFecha,propiedadesEquipo,equipoCostoDisplay,codigoCanonicoEquipo,familiaEquipoCosto,lugarAlquilerEquipoCosto,categoriaTipoMaquina]);

  const metaEquipoFallbackMemo=React.useMemo(()=>new Map(),[listaEquiposIndex,identidadCanonicaEquipos]);
  const metaEquipoCosto=React.useCallback((maquina)=>{
    const key=String(maquina||"");
    const ready=rma15MetaMap.get(key);
    if(ready)return ready;
    if(metaEquipoFallbackMemo.has(key))return metaEquipoFallbackMemo.get(key);
    const props=propiedadesEquipo(maquina);
    const real=props.find(p=>p&&p!=="S/D");
    const familia=familiaEquipoCosto(maquina);
    const lugarAlquiler=lugarAlquilerEquipoCosto(maquina);
    const out={
      display:equipoCostoDisplay(maquina),
      props,
      propiedad:real||props[0]||"S/D",
      familia,
      lugarAlquiler,
      tipo:categoriaTipoMaquina(familia),
    };
    metaEquipoFallbackMemo.set(key,out);
    return out;
  },[rma15MetaMap,equipoCostoDisplay,propiedadesEquipo,codigoCanonicoEquipo,familiaEquipoCosto,lugarAlquilerEquipoCosto,categoriaTipoMaquina,metaEquipoFallbackMemo]);

  const matchPropiedadMeta=React.useCallback((meta,seleccion)=>{
    if(multiIsAll(seleccion,"todos"))return true;
    const props=meta?.props||[];
    const sel=Array.isArray(seleccion)?seleccion:[seleccion].filter(Boolean);
    return sel.some(p=>props.includes(String(p||"").trim().toUpperCase()));
  },[]);
  const matchContratoMeta=React.useCallback((meta,seleccion)=>
    matchMulti(String(meta?.lugarAlquiler||"S/D").trim()||"S/D",seleccion,"todos"),[matchMulti]);

  const costoRowsProyectoOpts=React.useMemo(()=>rma15PorFecha||[],[rma15PorFecha]);

  const costoRowsPropiedadOpts=React.useMemo(()=>
    costoRowsProyectoOpts.filter(r=>matchMulti(r.proyecto,dFProyecto,"todos")&&matchContratoMeta(metaEquipoCosto(r.maquina),dFContrato)),
    [costoRowsProyectoOpts,dFProyecto,dFContrato,metaEquipoCosto,matchContratoMeta]
  );

  const costoRowsTipoEquipoOpts=React.useMemo(()=>
    costoRowsPropiedadOpts.filter(r=>matchPropiedadMeta(metaEquipoCosto(r.maquina),dFPropiedad)),
    [costoRowsPropiedadOpts,dFPropiedad,metaEquipoCosto,matchPropiedadMeta]
  );

  const costoRowsMaquinaOpts=React.useMemo(()=>
    costoRowsTipoEquipoOpts.filter(r=>{
      if(multiIsAll(dFTipoEquipo,"todos"))return true;
      const meta=metaEquipoCosto(r.maquina);
      const tipo=meta.tipo;
      const sel=Array.isArray(dFTipoEquipo)?dFTipoEquipo:[];
      return coincideTipoFiltro(tipo,sel);
    }),
    [costoRowsTipoEquipoOpts,dFTipoEquipo,metaEquipoCosto,coincideTipoFiltro]
  );

  const proyectoOpts=React.useMemo(()=>[
    {value:"todos",label:"Todos los proyectos"},
    ...uniq(costoRowsProyectoOpts.map(r=>r.proyecto).filter(Boolean)).map(p=>({value:p,label:p}))
  ],[costoRowsProyectoOpts]);

  const propiedadOpts=React.useMemo(()=>buildCostPropertyOptions(costoRowsPropiedadOpts.flatMap(r=>(metaEquipoCosto(r.maquina).props||[]).map(propiedad=>({propiedad})))),[costoRowsPropiedadOpts,metaEquipoCosto]);
  const contratoOpts=React.useMemo(()=>[
    {value:"todos",label:"Todos los contratos"},
    ...uniq(costoRowsProyectoOpts.map(r=>String(metaEquipoCosto(r.maquina).lugarAlquiler||"S/D").trim()||"S/D")).map(contrato=>({value:contrato,label:contrato}))
  ],[costoRowsProyectoOpts,metaEquipoCosto]);

  const tipoEquipoOpts=React.useMemo(()=>[
    {value:"todos",label:"Todos los equipos"},{value:"MAQUINAS",label:"Máquinas"},
    {value:"CAMIONES",label:"Camiones"},{value:"CAMIONETAS",label:"Camionetas"},
    {value:"EXCAVADORA",label:"Excavadora"},{value:"MINICARGADORA",label:"Minicargadora"},
    {value:"MOTONIVELADORA",label:"Motoniveladora"},{value:"CARGADOR FRONTAL",label:"Cargador frontal"},
    {value:"RETROPALA",label:"Retropala"},{value:"RODILLO",label:"Rodillo"},
    {value:"TOPADORA",label:"Topadora"},{value:"OTROS",label:"Otros"}
  ],[]);

  const maquinaOpts=React.useMemo(()=>[
    {value:"todos",label:"Todas"},
    ...uniq(costoRowsMaquinaOpts.map(r=>metaEquipoCosto(r.maquina).display).filter(Boolean)).map(m=>({value:m,label:m}))
  ],[costoRowsMaquinaOpts,metaEquipoCosto]);

  const sameCostoFilterValue=React.useCallback((a,b)=>{
    if(a===b)return true;
    const aa=Array.isArray(a)?a:[a];
    const bb=Array.isArray(b)?b:[b];
    return aa.length===bb.length&&aa.every((v,i)=>v===bb[i]);
  },[]);
  React.useEffect(()=>{
    setFProyecto(v=>{const n=normalizeMultiValue(v,proyectoOpts);return sameCostoFilterValue(v,n)?v:n;});
  },[proyectoOpts,sameCostoFilterValue]);
  React.useEffect(()=>{
    setFInsumos(v=>{const n=normalizeMultiValue(v,insumosCostoOpts);return sameCostoFilterValue(v,n)?v:n;});
  },[insumosCostoOpts,sameCostoFilterValue]);
  React.useEffect(()=>{
    setFPropiedad(v=>{const n=normalizeMultiValue(v,propiedadOpts);return sameCostoFilterValue(v,n)?v:n;});
  },[propiedadOpts,sameCostoFilterValue]);
  React.useEffect(()=>{
    setFMaquinas(v=>{const n=normalizeMultiValue(v,maquinaOpts);return sameCostoFilterValue(v,n)?v:n;});
  },[maquinaOpts,sameCostoFilterValue]);
  React.useEffect(()=>{
    setFTipoEquipo(v=>{const n=normalizeMultiValue(v,tipoEquipoOpts);return sameCostoFilterValue(v,n)?v:n;});
  },[tipoEquipoOpts,sameCostoFilterValue]);
  const normalizarTipoFiltroCosto=React.useCallback((value)=>{
    if(multiIsAll(value,"todos"))return value;
    const migration={"CARGADORA FRONTAL":"CARGADOR FRONTAL","COMPACTACION":"RODILLO"};
    const current=Array.isArray(value)?value:[value];
    const mapped=[...new Set(current.map(v=>migration[String(v||"").toUpperCase()]||v))];
    return normalizeMultiValue(mapped,tipoEquipoOpts);
  },[multiIsAll,normalizeMultiValue,tipoEquipoOpts]);
  React.useEffect(()=>{
    const filtros=getCostosFiltrosTabla(activeCostosFiltroKey);
    const proyecto=normalizeMultiValue(filtros.proyecto,proyectoOpts);
    const insumo=normalizeMultiValue(filtros.insumos,insumosCostoOpts);
    const contrato=normalizeMultiValue(filtros.contrato,contratoOpts);
    const tipo=normalizarTipoFiltroCosto(filtros.tipo);
    if(!sameCostoFilterValue(filtros.proyecto,proyecto))setCostoFiltroTabla(activeCostosFiltroKey,"proyecto",proyecto);
    if(!sameCostoFilterValue(filtros.insumos,insumo))setCostoFiltroTabla(activeCostosFiltroKey,"insumos",insumo);
    if(!sameCostoFilterValue(filtros.contrato,contrato))setCostoFiltroTabla(activeCostosFiltroKey,"contrato",contrato);
    if(!sameCostoFilterValue(filtros.tipo,tipo))setCostoFiltroTabla(activeCostosFiltroKey,"tipo",tipo);
  },[activeCostosFiltroKey,proyectoOpts,insumosCostoOpts,contratoOpts,getCostosFiltrosTabla,normalizeMultiValue,normalizarTipoFiltroCosto,sameCostoFilterValue,setCostoFiltroTabla]);

  // Opciones y filtrado AISLADOS para Mano de Obra.
  // Proyecto se toma del filtro general fProyecto para que coincida con el resto de la app.
  const moRowsProyectoOpts=React.useMemo(()=>
    (rma15PorFecha||[]).filter(r=>matchMulti(r.proyecto,dFProyecto,"todos")),
    [rma15PorFecha,dFProyecto]
  );
  const moRowsPropiedadOpts=React.useMemo(()=>moRowsProyectoOpts,[moRowsProyectoOpts]);
  const moRowsTipoEquipoOpts=React.useMemo(()=>
    moRowsPropiedadOpts.filter(r=>matchPropiedadMeta(metaEquipoCosto(r.maquina),dFMOPropiedad)),
    [moRowsPropiedadOpts,dFMOPropiedad,metaEquipoCosto,matchPropiedadMeta]
  );
  const moRowsMaquinaOpts=React.useMemo(()=>
    moRowsTipoEquipoOpts.filter(r=>{
      if(multiIsAll(dFMOTipoEquipo,"todos"))return true;
      const meta=metaEquipoCosto(r.maquina);
 …31825 tokens truncated…ortableCostHead("tablaCostos","propiedad","Propiedad",thS)}
            {sortableCostHead("tablaCostos","prev","Preventivo",thS)}
            {sortableCostHead("tablaCostos","corr","Correctivo",thS)}
            {sortableCostHead("tablaCostos","total","Total",thS)}
          </tr></thead>
          <tbody>
            {datosRender.map((x,i)=>(
              <tr key={x.equipo} style={{background:i%2===0?"rgba(255,255,255,0.055)":"rgba(255,255,255,0.10)"}}>
                <td style={tdL}>{x.equipo}</td>
                <td style={{...tdS,color:C.textSub,fontWeight:600}}>{x.propiedad||"S/D"}</td>
                <td style={tdS}>{fmtCostoTablaUSD(x.prev)}</td>
                <td style={tdS}>{fmtCostoTablaUSD(x.corr)}</td>
                <td style={{...tdS,color:C.yellow,fontWeight:700}}>{fmtCostoTablaUSD(x.total)}</td>
              </tr>
            ))}
            <RowTotalTabla label="TOTAL DELTA" total={resumen.delta} accent={C.green}/>
            <RowTotalTabla label="TOTAL ALQUILADO" total={resumen.alquilado} accent={C.yellow}/>
            <RowTotalTabla label="TOTAL" total={tot||resumen.total} accent={C.accent}/>
          </tbody>
        </table>
      </div>
      <div style={{padding:"8px 14px",fontSize:11,color:C.textMuted,borderTop:`1px solid ${C.border}22`}}>
        Costos calculados desde RMA15 y convertidos a USD con el valor del dólar cargado en Parámetros.
      </div>
    </Card>
    );
  };

  const soloFiltroMesCostos = tab==="t1" || tab==="t7";


  const renderCostosQuickFilters=React.useCallback((tableKey="t1",compact=false,config={})=>{
    const filtros=getCostosFiltrosTabla(tableKey);
    const tipoOptions=config.tipoOptions||tipoEquipoOpts;
    const equipoOptions=config.equipoOptions||maquinaOpts;
    const propiedadOptions=config.propiedadOptions||propiedadOpts;
    const contratoOptions=config.contratoOptions||contratoOpts;
    return (
      <div style={{display:"flex",gap:10,alignItems:"end",flexWrap:"wrap",padding:"10px 14px",borderBottom:`1px solid ${C.border}33`,background:compact?"rgba(0,0,0,.18)":"rgba(0,0,0,.14)"}}>
        <span style={{fontWeight:800,fontSize:12,color:C.text,paddingBottom:8}}>Filtros</span>
        <PeriodMonthYear fechaD={filtros.fechaD||""} fechaH={filtros.fechaH||""} setFechaD={v=>setCostoFiltroTabla(tableKey,"fechaD",v)} setFechaH={v=>setCostoFiltroTabla(tableKey,"fechaH",v)}/>
        <MultiSel label="Proyecto" value={filtros.proyecto} onChange={v=>setCostoFiltroTabla(tableKey,"proyecto",v)} options={proyectoOpts} commitOnClose commitDelay={180}/>
        <MultiSel label="Insumos" value={filtros.insumos} onChange={v=>setCostoFiltroTabla(tableKey,"insumos",v)} options={insumosCostoOpts} commitOnClose commitDelay={180}/>
        <MultiSel label="Tipo máquina" value={filtros.tipo} onChange={v=>setCostoFiltroTabla(tableKey,"tipo",v)} options={tipoOptions} commitOnClose commitDelay={180}/>
        <MultiSel label="Equipo" value={filtros.equipo} onChange={v=>setCostoFiltroTabla(tableKey,"equipo",v)} options={equipoOptions} commitOnClose commitDelay={180}/>
        {config.showProperty!==false&&<MultiSel label="Propiedad" value={filtros.propiedad} onChange={v=>setCostoFiltroTabla(tableKey,"propiedad",v)} options={propiedadOptions} commitOnClose commitDelay={180}/>}
        <MultiSel label="Contrato" value={filtros.contrato} onChange={v=>setCostoFiltroTabla(tableKey,"contrato",v)} options={contratoOptions} commitOnClose commitDelay={180}/>
        {config.extra||null}
        <button onClick={()=>resetCostoFiltroTabla(tableKey)} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:7,color:C.textSub,padding:"7px 10px",fontSize:12,cursor:"pointer",height:33}}>Limpiar filtros</button>
        {config.counter!=null&&<span style={{marginLeft:"auto",fontSize:11,color:C.textMuted,paddingBottom:8}}>Equipos considerados: <b style={{color:C.text}}>{config.counter}</b></span>}
        {config.note&&<span style={{marginLeft:"auto",fontSize:11,color:C.textMuted,paddingBottom:8}}>{config.note}</span>}
      </div>
    );
  },[getCostosFiltrosTabla,setCostoFiltroTabla,resetCostoFiltroTabla,tipoEquipoOpts,maquinaOpts,propiedadOpts,contratoOpts,proyectoOpts,insumosCostoOpts]);

  React.useEffect(()=>{
    diagEvent("Filtros actualizados",{tab,fechaD:dFechaD,fechaH:dFechaH,proyecto:dFProyecto,insumos:dFInsumos,tipo:dFTipoEquipo,maquinas:dFMaquinas,propiedad:dFPropiedad});
  },[tab,dFechaD,dFechaH,dFProyecto,dFInsumos,dFTipoEquipo,dFMaquinas,dFPropiedad]);

  React.useEffect(()=>{
    diagGauge("RMA15 filtrados",rma15Filtrado?.length||0);
  },[rma15Filtrado?.length]);

  React.useEffect(()=>{
    const started=performance.now();
    const id=window.requestAnimationFrame(()=>diagTiming(`Pintado de tabla · ${tab}`,performance.now()-started,{tab}));
    return()=>window.cancelAnimationFrame(id);
  },[tab,costosRenderTab,rma15Filtrado?.length]);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {readOnly&&<div style={{padding:"10px 13px",borderRadius:9,border:"1px solid rgba(59,130,246,.45)",background:"rgba(59,130,246,.10)",color:"#93c5fd",fontSize:12,fontWeight:800}}>Modo solo lectura: puede consultar y exportar el Informe de Costos, pero los parámetros económicos sólo pueden ser modificados por Oficina Técnica.</div>}
      <InformeCostosDiagnosticsPanel open={diagnosticoAbierto} onClose={()=>setDiagnosticoAbierto(false)} colors={C} dataCounts={{rma15:rma15?.length||0,rma15Filtrado:rma15Filtrado?.length||0,insumos:insumos?.length||0,equipos:listaEquipos?.length||0}}/>

      {/* Header parámetros */}
      <div style={{display:"flex",flexDirection:"column",gap:10,padding:"12px 14px",background:"rgba(28,28,28,0.86)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",borderRadius:12,border:`1px solid ${C.border}55`,overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontWeight:900,fontSize:14,color:C.text}}>Parámetros</span>
            <span style={{fontSize:11,color:C.textMuted}}>Valores guardados automáticamente</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <span style={{fontSize:12,color:C.green}}>JM: <b>U$S {fmtNum(Math.round(subtotalJM))}</b></span>
            <span style={{fontSize:12,color:C.teal}}>FS: <b>U$S {fmtNum(Math.round(subtotalFS))}</b></span>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"minmax(330px,1.05fr) minmax(330px,1.05fr) minmax(300px,.9fr)",gap:10,alignItems:"stretch"}}>
          {[
            {titulo:"Costos base",items:[
              {label:"USD/ARS",full:"Tipo de cambio USD/ARS",val:usdRate2,set:setUsdRate2,w:96},
              {label:"Mec. Unit.",full:"Costo mensual por mecánico (USD/mes)",val:costMec,set:setCostMec,w:112},
              {label:"CTA Unit.",full:"Costo mensual por CTA (USD/mes)",val:costCTA,set:setCostCTA,w:112},
              {label:"Hombre Vest.",full:"Costo Hombre Vestido (USD/hora)",val:hombreVestido,set:setHombreVestido,w:112},
            ]},
            {titulo:"Horas de referencia",items:[
              {label:"Hs ef. JM",full:"Horas efectivas de referencia para José María",val:hsEfJM,set:setHsEfJM,w:88},
              {label:"Hs ef. FS",full:"Horas efectivas de referencia para Filo del Sol",val:hsEfFS,set:setHsEfFS,w:88},
              {label:"Hs Eq. Prop.",full:"Horas mensuales de equipos propios",val:hsPropios,set:setHsPropios,w:88},
              {label:"Hs Eq. Arr.",full:"Horas mensuales de equipos arrendados",val:hsArrendados,set:setHsArrendados,w:88},
            ]},
          ].map((grupo)=>(
            <div key={grupo.titulo} style={{padding:"10px 12px",border:`1px solid ${C.border}44`,borderRadius:10,background:"rgba(10,10,10,0.24)",minWidth:0}}>
              <div style={{fontSize:11,fontWeight:900,color:C.textSub,textTransform:"uppercase",letterSpacing:.3,marginBottom:8}}>{grupo.titulo}</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(140px,1fr))",gap:8}}>
                {grupo.items.map(({label,full,val,set,w})=>(
                  <label key={grupo.titulo+label} title={full} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,minWidth:0,cursor:"help"}}>
                    <span style={{fontSize:10,color:C.textMuted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{label}</span>
                    <ParamInput value={val} set={set} style={{...inp,width:w,padding:"6px 8px"}}/>
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div style={{padding:"10px 12px",border:`1px solid ${C.border}44`,borderRadius:10,background:"rgba(10,10,10,0.24)",minWidth:0}}>
            <div style={{fontSize:11,fontWeight:900,color:C.textSub,textTransform:"uppercase",letterSpacing:.3,marginBottom:8}}>Dotación</div>
            <div style={{display:"grid",gridTemplateColumns:"42px 1fr 1fr",gap:8,alignItems:"center"}}>
              <span style={{fontSize:10,color:C.textMuted,fontWeight:800}}>Proyecto</span>
              <span title="Cantidad de mecánicos asignados" style={{fontSize:10,color:C.textMuted,fontWeight:800,cursor:"help"}}>Mecánicos</span>
              <span title="Cantidad de CTA mecánicos asignados" style={{fontSize:10,color:C.textMuted,fontWeight:800,cursor:"help"}}>CTA mec.</span>

              <span style={{fontSize:11,color:C.green,fontWeight:900}}>JM</span>
              <ParamInput value={mecJM} set={setMecJM} style={{...inp,width:"100%",padding:"6px 8px"}}/>
              <ParamInput value={ctaMecJM} set={setCtaMecJM} style={{...inp,width:"100%",padding:"6px 8px"}}/>

              <span style={{fontSize:11,color:C.teal,fontWeight:900}}>FS</span>
              <ParamInput value={mecFS} set={setMecFS} style={{...inp,width:"100%",padding:"6px 8px"}}/>
              <ParamInput value={ctaMecFS} set={setCtaMecFS} style={{...inp,width:"100%",padding:"6px 8px"}}/>
            </div>
          </div>
        </div>

        <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",padding:"8px 10px",border:`1px solid ${C.border}33`,borderRadius:9,background:"rgba(0,0,0,0.18)"}}>
          <span style={{fontSize:12,fontWeight:800,color:C.text}}>Subtotal mecánico</span>
          <span style={{fontSize:12,color:C.green}}>JM: <b>U$S {fmtNum(Math.round(subtotalJM))}</b></span>
          <span style={{fontSize:12,color:C.teal}}>FS: <b>U$S {fmtNum(Math.round(subtotalFS))}</b></span>
          <span style={{fontSize:11,color:C.textMuted}}>Mec. Unit × Mec. + CTA Unit × CTA MEC.</span>
        </div>
      </div>


      {/* Tabs */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {[["t1","Tabla de costos"],["t7","Top 3 Insumos"],["t6","Costo mensual acumulado"],["t4","Mano de Obra"],["t5","Amortización"],["t8","Resumen de costo mensual por grupo"],["t9","Amortización histórica"],["t10","Resumen de costo histórico por grupo"]].map(([id,lbl])=>(
          <TabBtn key={id} id={id} label={lbl}/>
        ))}
      </div>

      {<CostosTabPanel active={costosRenderTab==="t1"} version={`${tabla1.length}|${totCostos?.total||0}`}><TablaCostos datos={tabla1} tot={totCostos} titulo={`Tabla de costos (${proyectoTitulo}) (${tabla1.length} equipos)`} filename="Tabla_de_costos_filtrada"/></CostosTabPanel>}

      {<CostosTabPanel active={costosRenderTab==="t6"} version={`${costoMensualAcumulado?.length||0}|${mesesCostoMensual?.length||0}`}><TablaCostoMensualAcumulado/></CostosTabPanel>}

      {costosRenderTab==="t4"&&(
        <Card
          title="Mano de Obra"
          action={<BotonDescargar onClick={()=>descargarExcel("Mano_de_Obra",buildRowsManoObraExcel())}/>}
        >
          {manoObraWorkerUpdating&&<div style={{fontSize:12,color:C.cyan,fontWeight:800,marginBottom:8}}>Actualizando Mano de Obra en segundo plano…</div>}
          {renderCostosQuickFilters("t4",true,{tipoOptions:moTipoEquipoOpts,equipoOptions:moMaquinaOpts,propiedadOptions:moPropiedadOpts,note:`Registros: ${rma15FiltradoMO.length}`})}
          <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap",padding:"10px 14px",borderBottom:`1px solid ${C.border}33`,background:C.surface+"55"}}>
            <span style={{fontSize:12,fontWeight:800,color:C.text}}>Cantidad de camionetas</span>
            <label style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:C.textSub}}>CTA FS
              <ParamInput value={ctaFS} set={v=>setCtaFS(v||0)} style={{...inp,width:70}}/>
            </label>
            <label style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:C.textSub}}>CTA JM
              <ParamInput value={ctaJM} set={v=>setCtaJM(v||0)} style={{...inp,width:70}}/>
            </label>
            <span style={{fontSize:11,color:C.textMuted}}>Las filas CTA usan el promedio de mantenimiento y de costo de adquisición de las camionetas del proyecto.</span>
          </div>
          <div className="dm-table-scroll" style={{overflowX:"auto",overflowY:"auto",maxHeight:520,scrollbarGutter:"stable"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr>
                {sortableCostHead("manoObra","equipo","Equipo",thL)}
                {sortableCostHead("manoObra","propiedad","Propiedad",thS)}
                {sortableCostHead("manoObra","proyecto","Proyecto",thS)}
                {sortableCostHead("manoObra","mantenimiento","Mantenimiento (USD)",thS)}
                {sortableCostHead("manoObra","porcentaje","% Mantenimiento",thS)}
                {sortableCostHead("manoObra","manoObra","Mano de Obra (USD)",thS)}
                {sortableCostHead("manoObra","costoAdquisicion","Costo de Adquisición/Alquiler (USD)",thS)}
                {sortableCostHead("manoObra","total","Total (USD)",thS)}
              </tr></thead>
              <tbody>
                {rowsManoObraRender.map((x,i)=>(
                  <tr key={x.proyecto+"__"+x.equipo} style={{background:x.isCTA?C.tealDim:(i%2===0?"transparent":C.surface+"33")}}>
                    <td style={{...tdL,fontWeight:x.isCTA?900:700,color:x.isCTA?C.teal:C.text}}>{x.equipo}{x.isCTA&&x.cantidadCTA?` (${x.cantidadCTA})`:""}</td>
                    <td style={{...tdS,textAlign:"left",color:C.textSub,fontWeight:600}}>{x.propiedad||"S/D"}</td>
                    <td style={{...tdS,textAlign:"left"}}><Badge color={proyColor(x.proyecto)}>{x.proyecto}</Badge></td>
                    <td style={tdS}>{x.mantenimiento>0?"U$S "+fmtNum(Math.round(x.mantenimiento)):"—"}</td>
                    <td style={{...tdS,color:C.textSub}}>{x.porcentaje>0?(x.porcentaje*100).toFixed(2)+"%":"—"}</td>
                    <td style={{...tdS,color:C.purple}}>{x.manoObra>0?"U$S "+fmtNum(Math.round(x.manoObra)):"—"}</td>
                    <td style={{...tdS,color:C.yellow}}>{x.costoAdquisicion>0?"U$S "+fmtNum(Math.round(x.costoAdquisicion)):"—"}</td>
                    <td style={{...tdS,color:C.accent,fontWeight:700}}>{x.total>0?"U$S "+fmtNum(Math.round(x.total)):"—"}</td>
                  </tr>
                ))}
                {(rowsManoObraTotales||[]).map((x,i)=>(
                  <tr key={x.equipo} style={{background:i===2?"rgba(220,38,38,.10)":C.surface+"66"}}>
                    <td style={{...tdL,fontWeight:900,color:i===2?C.accent:C.text}}>{x.equipo}</td>
                    <td style={{...tdS,textAlign:"left",color:C.textSub,fontWeight:800}}>{x.propiedad||""}</td>
                    <td style={tdS}>—</td>
                    <td style={{...tdS,fontWeight:900}}>{x.mantenimiento>0?"U$S "+fmtNum(Math.round(x.mantenimiento)):"—"}</td>
                    <td style={{...tdS,color:C.textSub}}>—</td>
                    <td style={{...tdS,color:C.purple,fontWeight:900}}>{x.manoObra>0?"U$S "+fmtNum(Math.round(x.manoObra)):"—"}</td>
                    <td style={{...tdS,color:C.yellow}}>—</td>
                    <td style={{...tdS,color:C.accent,fontWeight:900}}>{x.total>0?"U$S "+fmtNum(Math.round(x.total)):"—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {costosRenderTab==="t7"&&(()=>{
        // Top 3 insumos más caros por equipo, separados en correctivo y preventivo
        const byEquipo={};
        (rma15Filtrado||[]).forEach(r=>{
          const eq=metaEquipoCosto(r.maquina).display;
          const esPrev=String(r.tipoMant||"").toUpperCase().includes("PREV");
          if(!byEquipo[eq])byEquipo[eq]={equipo:eq,corr:{},prev:{}};
          const bucket=esPrev?byEquipo[eq].prev:byEquipo[eq].corr;
          (r.insumos||[]).forEach(ins=>{
            if(!ins.codigo)return;
            const k=ins.codigo;
            if(!bucket[k])bucket[k]={codigo:ins.codigo,descripcion:ins.nombre||ins.codigo,cantidad:0,costoTotal:0};
            bucket[k].cantidad+=Number(ins.cantidad)||0;
            bucket[k].costoTotal+=Number(ins.costoTotal)||0;
          });
        });
        const equipos=Object.values(byEquipo).sort((a,b)=>a.equipo.localeCompare(b.equipo));
        const top3=(bucket)=>Object.values(bucket).sort((a,b)=>b.costoTotal-a.costoTotal).slice(0,3);
        const rowsTop3InsumosExcel=()=>{
          // Formato solicitado:
          // Equipo | Correctivo: Codigo, Costo_ARS, Descripcion, Cantidad | Preventivo: Codigo, Costo_ARS, Descripcion, Cantidad
          // Siempre se dejan 3 filas por equipo, aunque no tenga los 3 insumos cargados.
          const rows=[["Equipo","Codigo","Costo_ARS","Descripcion","Cantidad","Codigo","Costo_ARS","Descripcion","Cantidad"]];
          equipos.forEach(eq=>{
            const corr=top3(eq.corr);
            const prev=top3(eq.prev);
            for(let i=0;i<3;i++){
              const c=corr[i]||{};
              const p=prev[i]||{};
              rows.push([
                i===0?eq.equipo:"",
                c.codigo||"",
                c.codigo?Math.round(Number(c.costoTotal)||0):"",
                c.descripcion||"",
                c.codigo?(Number(c.cantidad)||0):"",
                p.codigo||"",
                p.codigo?Math.round(Number(p.costoTotal)||0):"",
                p.descripcion||"",
                p.codigo?(Number(p.cantidad)||0):"",
              ]);
            }
          });
          return rows;
        };
        const thTop={padding:"7px 10px",textAlign:"left",fontWeight:700,fontSize:11,color:C.textSub,borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap",background:"rgba(20,20,20,0.96)"};
        const thTopN={...thTop,textAlign:"right"};
        const tdTop={padding:"6px 10px",fontSize:11,borderBottom:`1px solid ${C.border}55`,color:C.text,background:"rgba(20,20,20,0.72)"};
        const tdTopN={...tdTop,textAlign:"right"};
        return(
          <Card title={`Top 3 Insumos (${equipos.length} equipos)`} action={<BotonDescargar onClick={()=>descargarExcel("Top_3_Insumos",rowsTop3InsumosExcel())}/>}>
            {renderCostosQuickFilters("t7",true)}
            <div style={{display:"flex",flexDirection:"column",gap:20,padding:12}}>
            <div style={{display:"flex",flexDirection:"column",gap:20}}>
            {equipos.map(eq=>{
              const corrRows=top3(eq.corr);
              const prevRows=top3(eq.prev);
              const corrRowsOrdenados=sortRowsForTable(corrRows,costosMantSorts[`top3Corr_${eq.equipo}`],{codigo:r=>r.codigo,descripcion:r=>r.descripcion,cantidad:r=>r.cantidad,costoARS:r=>r.costoTotal});
              const prevRowsOrdenados=sortRowsForTable(prevRows,costosMantSorts[`top3Prev_${eq.equipo}`],{codigo:r=>r.codigo,descripcion:r=>r.descripcion,cantidad:r=>r.cantidad,costoARS:r=>r.costoTotal});
              if(!corrRows.length&&!prevRows.length)return null;
              return(
                <div key={eq.equipo} style={{background:"rgba(18,18,18,0.88)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",border:`1px solid ${C.borderLight}`,borderRadius:10,overflow:"hidden",boxShadow:"0 8px 28px rgba(0,0,0,.45)"}}>
                  <div style={{padding:"10px 16px",background:"rgba(16,16,16,0.94)",borderBottom:`1px solid ${C.borderLight}`,display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontWeight:800,fontSize:13,color:C.text}}>{eq.equipo}</span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
                    {/* CORRECTIVO */}
                    <div style={{borderRight:`1px solid ${C.border}`}}>
                      <div style={{padding:"7px 14px",background:"rgba(232,0,29,0.32)",borderBottom:`1px solid ${C.borderLight}`,display:"flex",alignItems:"center",gap:6}}>
                        <span style={{fontSize:11,fontWeight:700,color:C.red,textTransform:"uppercase",letterSpacing:".04em"}}>Correctivo</span>
                      </div>
                      {corrRows.length===0?(
                        <div style={{padding:"12px 14px",color:C.textMuted,fontSize:11}}>Sin insumos correctivos</div>
                      ):(
                        <table style={{width:"100%",borderCollapse:"collapse"}}>
                          <thead><tr>
                            {sortableCostHead(`top3Corr_${eq.equipo}`,"codigo","Código",thTop)}
                            {sortableCostHead(`top3Corr_${eq.equipo}`,"descripcion","Descripción",thTop)}
                            {sortableCostHead(`top3Corr_${eq.equipo}`,"cantidad","Cant.",thTopN)}
                            {sortableCostHead(`top3Corr_${eq.equipo}`,"costoARS","Costo (ARS)",thTopN)}
                          </tr></thead>
                          <tbody>
                            {corrRowsOrdenados.map((ins,i)=>(
                              <tr key={ins.codigo} style={{background:i%2===0?"rgba(255,255,255,0.055)":"rgba(255,255,255,0.10)"}}>
                                <td style={{...tdTop,fontWeight:700,color:C.purple}}>{ins.codigo}</td>
                                <td style={{...tdTop,color:C.text,maxWidth:200}}>{ins.descripcion}</td>
                                <td style={{...tdTopN,color:C.text}}>{ins.cantidad>0?ins.cantidad.toFixed(ins.cantidad%1===0?0:2):"—"}</td>
                                <td style={{...tdTopN,color:C.red,fontWeight:700}}>{"$"+Math.round(ins.costoTotal).toLocaleString("es-AR")}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                    {/* PREVENTIVO */}
                    <div>
                      <div style={{padding:"7px 14px",background:"rgba(34,197,94,0.28)",borderBottom:`1px solid ${C.borderLight}`,display:"flex",alignItems:"center",gap:6}}>
                        <span style={{fontSize:11,fontWeight:700,color:C.green,textTransform:"uppercase",letterSpacing:".04em"}}>Preventivo</span>
                      </div>
                      {prevRows.length===0?(
                        <div style={{padding:"12px 14px",color:C.textMuted,fontSize:11}}>Sin insumos preventivos</div>
                      ):(
                        <table style={{width:"100%",borderCollapse:"collapse"}}>
                          <thead><tr>
                            {sortableCostHead(`top3Prev_${eq.equipo}`,"codigo","Código",thTop)}
                            {sortableCostHead(`top3Prev_${eq.equipo}`,"descripcion","Descripción",thTop)}
                            {sortableCostHead(`top3Prev_${eq.equipo}`,"cantidad","Cant.",thTopN)}
                            {sortableCostHead(`top3Prev_${eq.equipo}`,"costoARS","Costo (ARS)",thTopN)}
                          </tr></thead>
                          <tbody>
                            {prevRowsOrdenados.map((ins,i)=>(
                              <tr key={ins.codigo} style={{background:i%2===0?"rgba(255,255,255,0.055)":"rgba(255,255,255,0.10)"}}>
                                <td style={{...tdTop,fontWeight:700,color:C.purple}}>{ins.codigo}</td>
                                <td style={{...tdTop,color:C.text,maxWidth:200}}>{ins.descripcion}</td>
                                <td style={{...tdTopN,color:C.text}}>{ins.cantidad>0?ins.cantidad.toFixed(ins.cantidad%1===0?0:2):"—"}</td>
                                <td style={{...tdTopN,color:C.green,fontWeight:700}}>{"$"+Math.round(ins.costoTotal).toLocaleString("es-AR")}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {equipos.length===0&&(
              <div style={{padding:32,textAlign:"center",color:C.textMuted,fontSize:13}}>
                Sin datos para el período filtrado.
              </div>
            )}
            </div>
            </div>
          </Card>
        );
      })()}

      {costosRenderTab==="t5"&&(
        <Card
          title="Costo horario de amortización y mantenimiento"
          action={amortizacionSubtab==="tabla"?<BotonDescargar onClick={()=>descargarExcel("Amortizacion_y_Mantenimiento",buildRowsAmortizacionExcel())}/>:null}
        >
          <div style={{display:"flex",gap:8,padding:"10px 14px",borderBottom:`1px solid ${C.border}`,background:"rgba(0,0,0,.12)"}}>
            <button onClick={()=>setAmortizacionSubtab("tabla")} style={{padding:"8px 14px",borderRadius:8,border:`1px solid ${amortizacionSubtab==="tabla"?C.teal:C.border}`,background:amortizacionSubtab==="tabla"?"rgba(45,212,191,.18)":"rgba(255,255,255,.04)",color:amortizacionSubtab==="tabla"?C.teal:C.textSub,fontWeight:800,cursor:"pointer"}}>Amortización</button>
            <button onClick={()=>setAmortizacionSubtab("categorias")} style={{padding:"8px 14px",borderRadius:8,border:`1px solid ${amortizacionSubtab==="categorias"?C.teal:C.border}`,background:amortizacionSubtab==="categorias"?"rgba(45,212,191,.18)":"rgba(255,255,255,.04)",color:amortizacionSubtab==="categorias"?C.teal:C.textSub,fontWeight:800,cursor:"pointer"}}>Categorías por modelo</button>
          </div>
          {amortizacionSubtab==="tabla"&&renderCostosQuickFilters("t5",true)}
          {amortizacionSubtab==="tabla"&&isCostosTabAmortizacion&&(!amortizacionCalcEnabled||amortizacionWorkerUpdating)&&listaEquipos&&listaEquipos.length>0&&(
            <div style={{padding:"7px 14px",fontSize:11,color:C.textMuted,borderBottom:`1px solid ${C.border}55`,background:"rgba(0,0,0,.12)"}}>
              {amortizacionWorkerUpdating?"Actualizando Amortización en segundo plano…":"Preparando datos…"}
            </div>
          )}
          {amortizacionSubtab==="tabla"&&((!listaEquipos||listaEquipos.length===0)?(
            <div style={{padding:24,textAlign:"center",color:C.textMuted,fontSize:13}}>
              Cargá la <b>Lista Maestra de Equipos</b> desde el menú lateral para ver esta tabla.
            </div>
          ):(
            <div className="dm-table-scroll" style={{overflowX:"auto",overflowY:"auto",maxHeight:520,scrollbarGutter:"stable",contain:"layout paint"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:14}}>
                <thead><tr>
                  {sortableCostHead("amortizacion","equipo","Equipo",thL)}
                  {sortableCostHead("amortizacion","propiedad","Propiedad",thS)}
                  {sortableCostHead("amortizacion","tipo","Tipo",thS)}
                  {sortableCostHead("amortizacion","modelo","Modelo",thS)}
                  {sortableCostHead("amortizacion","adq","C. Adq./Alquiler (USD)",thS)}
                  <SortableTH sortId="amortizacion" sortKey="vida" sorts={costosMantSorts} setSorts={setCostosMantSorts} style={{...thS,minWidth:180}}>
                    <div style={{display:"flex",flexDirection:"column",gap:3,alignItems:"center"}}>
                      <span>Vida Útil (hs) / Hs Mensuales</span>
                      <label onClick={e=>e.stopPropagation()} style={{display:"flex",alignItems:"center",gap:4,cursor:"pointer",fontWeight:500,fontSize:10,textTransform:"none",letterSpacing:0,color:C.textSub,whiteSpace:"nowrap"}}
                        title="Solo aplica a equipos Delta. Al tildar, usa la Vida Útil de Lista Maestra. Al destildar, ingresás el valor manual.">
                        <input type="checkbox"
                          checked={Object.keys(useListaVidaUtil).length===0||Object.values(useListaVidaUtil).every(v=>v!==false)}
                          onChange={e=>{
                            if(e.target.checked){
                              setVidaUtilState(s=>({...s,lista:{}}));
                            }else{
                              setVidaUtilState(s=>{
                                const lista={};
                                const override={...s.override};
                                rowsAmortizacionOrdenadasFiltradas.filter(x=>x._esDelta).forEach(x=>{
                                  lista[x.equipo]=false;
                                  // Usar getVidaUtilListaMaestra directamente — fuente de verdad pura
                                  if(!(override[x.equipo]>0)){
                                    override[x.equipo]=Math.round(getVidaUtilListaMaestra(x.equipo))||8000;
                                  }
                                });
                                return {lista,override};
                              });
                            }
                          }}
                          style={{accentColor:C.teal,cursor:"pointer",background:"rgba(0,0,0,0.6)",borderRadius:3}}
                        />
                        <span style={{color:C.teal}}>Delta:</span> Lista de Equipos
                      </label>
                    </div>
                  </SortableTH>
                  {sortableCostHead("amortizacion","amort","Amortización / Alquiler (USD/h)",thS)}
                  {sortableCostHead("amortizacion","hhHombreVestido","HH (Hombre Vestido/hs)",thS)}
                  {sortableCostHead("amortizacion","mantUSDhs","Mant. (USD/hs)",thS)}
                  {sortableCostHead("amortizacion","totalUSDhs","Total (USD/hs)",thS)}
                  {sortableCostHead("amortizacion","pctMant","% Mant.",thS)}
                  {sortableCostHead("amortizacion","promTipo","Promedio por tipo",{...thS,textAlign:"center"})}
                </tr></thead>
                <tbody>
                  {amortizacionVisibleRows.map((x,i)=>(
                    <AmortRow
                      key={x.equipo}
                      x={x}
                      i={i}
                      useListaVidaUtil={useListaVidaUtil}
                      vidaUtilOverride={vidaUtilOverride}
                      setVidaUtilState={setVidaUtilState}
                      tdL={tdL}
                      tdS={tdS}
                      C={C}
                      fmtNum={fmtNum}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {amortizacionSubtab==="categorias"&&(
            <div style={{padding:14}}>
              <div style={{display:"grid",gridTemplateColumns:"minmax(320px,.8fr) minmax(520px,1.7fr)",gap:14,alignItems:"start"}}>
                <div style={{border:`1px solid ${C.border}`,borderRadius:12,background:"rgba(0,0,0,.18)",overflow:"hidden"}}>
                  <div style={{padding:"12px 14px",borderBottom:`1px solid ${C.border}`,background:"rgba(255,255,255,.04)"}}>
                    <div style={{fontSize:14,fontWeight:900,color:C.text}}>Administrar categorías</div>
                    <div style={{fontSize:11,color:C.textMuted,marginTop:3}}>Creá, renombrá o eliminá las categorías usadas para calcular los promedios.</div>
                  </div>
                  <div style={{padding:12,display:"flex",gap:8}}>
                    <input value={nuevaCategoriaAmortizacion} onChange={e=>setNuevaCategoriaAmortizacion(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")agregarCategoriaAmortizacion();}} placeholder="Nueva categoría" style={{flex:1,minWidth:0,padding:"9px 10px",borderRadius:8,border:`1px solid ${C.border}`,background:"rgba(0,0,0,.30)",color:C.text,fontWeight:700}}/>
                    <button onClick={agregarCategoriaAmortizacion} style={{padding:"9px 12px",borderRadius:8,border:`1px solid ${C.teal}`,background:"rgba(45,212,191,.16)",color:C.teal,fontWeight:900,cursor:"pointer"}}>Agregar</button>
                  </div>
                  <div style={{maxHeight:465,overflow:"auto",padding:"0 12px 12px"}}>
                    {(categoriasAmortizacionDisponibles||[]).map(cat=>{
                      const afectados=cantidadModelosPorCategoria[cat]||0;
                      const opcionesReasignacion=(categoriasAmortizacionDisponibles||[]).filter(c=>c!==cat);
                      return <div key={cat} style={{padding:"10px 0",borderTop:`1px solid ${C.border}66`}}>
                        <div style={{display:"flex",gap:7,alignItems:"center"}}>
                          <input key={cat} defaultValue={categoriaAmortizacionDrafts[cat]??cat} onBlur={e=>setCategoriaAmortizacionDrafts(prev=>({...prev,[cat]:e.target.value}))} onKeyDown={e=>{if(e.key==="Enter"){setCategoriaAmortizacionDrafts(prev=>({...prev,[cat]:e.currentTarget.value}));e.currentTarget.blur();}}} style={{flex:1,minWidth:0,padding:"8px 9px",borderRadius:7,border:`1px solid ${C.border}`,background:"rgba(0,0,0,.28)",color:C.text,fontWeight:800}}/>
                          <button onClick={()=>renombrarCategoriaAmortizacion(cat)} title="Guardar nuevo nombre" style={{padding:"8px 10px",borderRadius:7,border:`1px solid ${C.blue||C.teal}`,background:"rgba(59,130,246,.14)",color:C.blue||C.teal,fontWeight:900,cursor:"pointer"}}>Guardar</button>
                        </div>
                        <div style={{display:"flex",gap:7,alignItems:"center",marginTop:7}}>
                          <span style={{fontSize:11,color:C.textMuted,whiteSpace:"nowrap"}}>{afectados} modelo(s)</span>
                          <select value={categoriaAmortizacionReasignacion[cat]||""} onChange={e=>setCategoriaAmortizacionReasignacion(prev=>({...prev,[cat]:e.target.value}))} style={{flex:1,minWidth:0,padding:"7px 8px",borderRadius:7,border:`1px solid ${C.border}`,background:"rgba(0,0,0,.28)",color:C.text,fontSize:11}}>
                            <option value="">Eliminar y dejar sin categoría</option>
                            {opcionesReasignacion.map(c=><option key={c} value={c}>Mover modelos a {c}</option>)}
                          </select>
                          <button onClick={()=>eliminarCategoriaAmortizacion(cat)} style={{padding:"7px 9px",borderRadius:7,border:"1px solid rgba(239,68,68,.65)",background:"rgba(239,68,68,.12)",color:"#ff7b7b",fontWeight:900,cursor:"pointer"}}>Eliminar</button>
                        </div>
                      </div>;
                    })}
                    {(!categoriasAmortizacionDisponibles||categoriasAmortizacionDisponibles.length===0)&&<div style={{padding:18,textAlign:"center",color:C.textMuted,fontSize:12}}>No hay categorías creadas.</div>}
                  </div>
                  <div style={{padding:12,borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"flex-end"}}>
                    <button onClick={restablecerCategoriasAmortizacion} style={{padding:"8px 12px",borderRadius:8,border:`1px solid ${C.border}`,background:"rgba(255,255,255,.05)",color:C.textSub,fontWeight:700,cursor:"pointer"}}>Restablecer originales</button>
                  </div>
                </div>

                <div style={{border:`1px solid ${C.border}`,borderRadius:12,background:"rgba(0,0,0,.18)",overflow:"hidden"}}>
                  <div style={{padding:"12px 14px",borderBottom:`1px solid ${C.border}`,background:"rgba(255,255,255,.04)"}}>
                    <div style={{fontSize:14,fontWeight:900,color:C.text}}>Asignación por tipo y modelo</div>
                    <div style={{fontSize:11,color:C.textMuted,marginTop:3}}>La tabla Amortización y el Promedio por tipo usan directamente esta clasificación.</div>
                  </div>
                  <div className="dm-table-scroll" onScroll={categoriasVirtual.onScroll} style={{overflow:"auto",maxHeight:540,contain:"layout paint",transform:"translateZ(0)"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr><th style={thL}>Tipo de equipo</th><th style={thS}>Marca</th><th style={thS}>Modelo</th><th style={thS}>Equipos</th><th style={{...thL,minWidth:220}}>Categoría de amortización</th></tr></thead>
                      <tbody>
                        {categoriasVirtual.topPad>0&&<tr style={{height:categoriasVirtual.topPad}}><td colSpan={5} style={{padding:0,border:"none"}}/></tr>}
                        {categoriasVirtual.visibleRows.map((r,i)=><CategoriaModeloTableRow key={r.key} row={r} index={categoriasVirtual.startIndex+i} value={categoriaEfectivaPorModelo[r.key]||"SIN CATEGORIA"} options={categoriasAmortizacionDisponibles} onCommit={commitCategoriaModelo} colors={{border:C.border,text:C.text,textSub:C.textSub}}/>)}
                        {categoriasVirtual.bottomPad>0&&<tr style={{height:categoriasVirtual.bottomPad}}><td colSpan={5} style={{padding:0,border:"none"}}/></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {costosRenderTab==="t8"&&(
        <Card
          title="Resumen de costo mensual por grupo"
          action={<BotonDescargar onClick={()=>descargarExcel("Resumen_costo_mensual_por_grupo",buildRowsResumenPorEquipoExcel())}/>}
        >
          {resumenWorkerUpdating&&<div style={{fontSize:12,color:"#60a5fa",marginBottom:8}}>Actualizando Resumen por equipo en segundo plano…</div>}
          {renderCostosQuickFilters("t8",true,{tipoOptions:resumenTipoOptions,equipoOptions:resumenEquipoOptions,propiedadOptions:resumenPropiedadOptions,counter:resumenEquiposConsiderados})}
          {(!rowsResumenPorEquipo||rowsResumenPorEquipo.length===0)?(
            <div style={{padding:24,textAlign:"center",color:C.textMuted,fontSize:13}}>
              Sin datos para mostrar. Revisá los filtros o cargá la Lista Maestra de Equipos.
            </div>
          ):(
            <div className="dm-table-scroll" onScroll={resumenVirtual.onScroll} style={{overflowX:"auto",overflowY:"auto",maxHeight:520,scrollbarGutter:"stable",contain:"layout paint"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:14}}>
                <thead>
                  <tr>
                    <th style={{...thS,background:C.yellow,color:"#111",border:`1px solid ${C.borderLight}`}}>Maquina</th>
                    <th style={{...thS,background:C.yellow,color:"#111",border:`1px solid ${C.borderLight}`}}>Modelo Tipo</th>
                    <th style={{...thS,background:C.yellow,color:"#111",border:`1px solid ${C.borderLight}`}}>Costo Horario de Amortización</th>
                    <th style={{...thS,background:C.yellow,color:"#111",border:`1px solid ${C.borderLight}`}}>% Mantenimiento</th>
                    <th style={{...thS,background:C.yellow,color:"#111",border:`1px solid ${C.borderLight}`}}>Costo Horario</th>
                    <th style={{...thS,background:C.yellow,color:"#111",border:`1px solid ${C.borderLight}`}}>Costo Total Horario</th>
                  </tr>
                </thead>
                <tbody>
                  {resumenVirtual.topPad>0&&<tr style={{height:resumenVirtual.topPad}}><td colSpan={6} style={{padding:0,border:"none"}}/></tr>}
                  {resumenVirtual.visibleRows.map((x,i)=>{
                    const absI=resumenVirtual.startIndex+i;
                    return (
                    <tr
                      key={`${x.maquina}_${x.modelo}_${absI}`}
                      style={{background:absI%2===0?"rgba(255,255,255,0.055)":"rgba(255,255,255,0.10)",cursor:"pointer"}}
                      onMouseEnter={e=>{
                        const old=document.getElementById("resumen-equipo-tip");
                        if(old)old.remove();
                        const esc=v=>String(v??"").replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[ch]));
                        const rows=(x._detalleMaquinas||[]).map(d=>`
                          <tr>
                            <td style="padding:4px 8px;border-bottom:1px solid rgba(255,255,255,.10);color:#fff;font-weight:700;white-space:nowrap">${esc(d.equipo)}</td>
                            <td style="padding:4px 8px;border-bottom:1px solid rgba(255,255,255,.10);color:#ddd;white-space:nowrap">${esc(d.propiedad||"S/D")}</td>
                            <td style="padding:4px 8px;border-bottom:1px solid rgba(255,255,255,.10);color:#ffb300;font-weight:800;text-align:right;white-space:nowrap">${Number(d.amort)>0?"USD "+Math.round(Number(d.amort)):"—"}</td>
                            <td style="padding:4px 8px;border-bottom:1px solid rgba(255,255,255,.10);color:#b86cff;font-weight:800;text-align:right;white-space:nowrap">${Number(d.pctMant)>0?(Number(d.pctMant)*100).toFixed(0)+"%":"—"}</td>
                          </tr>`).join("");
                        const tip=document.createElement("div");
                        tip.id="resumen-equipo-tip";
                        tip.style.cssText=`position:fixed;z-index:999999;background:${C.surface};border:1px solid ${C.border};border-radius:12px;padding:12px 14px;font-size:12px;font-family:Inter,sans-serif;max-width:520px;box-shadow:0 12px 36px rgba(0,0,0,.65);pointer-events:none;visibility:hidden`;
                        tip.innerHTML=`
                          <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Máquinas del grupo</div>
                          <div style="color:#fff;font-size:13px;font-weight:800;margin-bottom:8px">${esc(x.maquina)} · ${esc(x.modelo||"—")}</div>
                          <table style="border-collapse:collapse;width:100%">
                            <thead>
                              <tr>
                                <th style="padding:4px 8px;text-align:left;color:#999;border-bottom:1px solid rgba(255,255,255,.18);font-size:11px">Máquina</th>
                                <th style="padding:4px 8px;text-align:left;color:#999;border-bottom:1px solid rgba(255,255,255,.18);font-size:11px">Propiedad</th>
                                <th style="padding:4px 8px;text-align:right;color:#999;border-bottom:1px solid rgba(255,255,255,.18);font-size:11px">Amort.</th>
                                <th style="padding:4px 8px;text-align:right;color:#999;border-bottom:1px solid rgba(255,255,255,.18);font-size:11px">% Mant.</th>
                              </tr>
                            </thead>
                            <tbody>${rows||`<tr><td colspan="4" style="padding:6px 8px;color:#777">Sin detalle</td></tr>`}</tbody>
                          </table>`;
                        positionTip(tip,e.clientX,e.clientY);
                      }}
                      onMouseMove={e=>{
                        const tip=document.getElementById("resumen-equipo-tip");
                        if(tip)positionTip(tip,e.clientX,e.clientY);
                      }}
                      onMouseLeave={()=>{
                        const tip=document.getElementById("resumen-equipo-tip");
                        if(tip)tip.remove();
                      }}
                    >
                      <td style={{...tdS,textAlign:"left",fontWeight:700,color:C.text}}>{x.maquina}</td>
                      <td style={{...tdS,textAlign:"left",fontWeight:600,color:C.textSub}}>{x.modelo||"—"}</td>
                      <td style={{...tdS,fontWeight:700,color:C.yellow}}>{x.costoAmort>0?"USD "+fmtNum(Math.round(x.costoAmort)):"—"}</td>
                      <td style={{...tdS,fontWeight:700,color:C.textSub}}>{x.pctMant>0?(x.pctMant*100).toFixed(0)+"%":"—"}</td>
                      <td style={{...tdS,fontWeight:800,color:C.cyan}}>{x.costoHorario>0?"USD "+fmtNum(Math.round(x.costoHorario)):"—"}</td>
                      <td style={{...tdS,fontWeight:800,color:C.green}}>{x.costoTotal>0?"USD "+fmtNum(Math.round(x.costoTotal)):"—"}</td>
                    </tr>
                  );})}
                  {resumenVirtual.bottomPad>0&&<tr style={{height:resumenVirtual.bottomPad}}><td colSpan={6} style={{padding:0,border:"none"}}/></tr>}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {isCostosTabAmortizacionHistorica&&(
        <Card
          title="Costo horario de amortización y mantenimiento — histórico 2026"
          action={<BotonDescargar onClick={()=>descargarExcel("Amortizacion_historica_2026",buildRowsAmortizacionHistoricaExcel())}/>}
        >
          {renderCostosQuickFilters("t9",true,{showProperty:false,tipoOptions:tipoEquipoOpts,equipoOptions:historicoEquipoOptions,note:"Solo equipos propios con mantenimiento 2026 · sin HH"})}
          <div className="dm-table-scroll" style={{overflowX:"visible",overflowY:"auto",maxHeight:620,scrollbarGutter:"stable"}}>
            <table style={{width:"100%",maxWidth:"100%",borderCollapse:"collapse",tableLayout:"fixed",fontSize:14}}>
              <colgroup>
                {[6,5.2,9.5,5.2,8.5,12,10,7,10,7,7,5.3,7.3].map((width,index)=><col key={index} style={{width:`${width}%`}}/>)}
              </colgroup>
              <thead><tr>
                <th style={{...thL,padding:"7px 4px",whiteSpace:"normal",lineHeight:1.2}}>EQUIPO</th>
                <th style={{...thS,padding:"7px 3px",whiteSpace:"normal",lineHeight:1.2}}>PROPIEDAD</th>
                <th style={{...thS,padding:"7px 4px",whiteSpace:"normal",lineHeight:1.2}}>TIPO</th>
                <th style={{...thS,padding:"7px 3px",whiteSpace:"normal",lineHeight:1.2}}>MODELO</th>
                <th style={{...thS,padding:"7px 4px",whiteSpace:"normal",lineHeight:1.2}}>C. ADQ./ALQUILER<br/>(USD)</th>
                <th style={{...thS,padding:"7px 4px",whiteSpace:"normal",lineHeight:1.2}}>
                  <div style={{display:"flex",flexDirection:"column",gap:3,alignItems:"center"}}>
                    <span>VIDA ÚTIL (HS) / HS MENSUALES</span>
                    <label onClick={e=>e.stopPropagation()} style={{display:"flex",alignItems:"center",gap:4,cursor:"pointer",fontWeight:500,fontSize:10,textTransform:"none",letterSpacing:0,color:C.textSub,whiteSpace:"nowrap"}}
                      title="Solo aplica a equipos Delta. Al tildar, usa la Vida Útil de Lista Maestra. Al destildar, permite usar el valor manual.">
                      <input
                        type="checkbox"
                        checked={Object.keys(useListaVidaUtil).length===0||rowsAmortizacionHistorica.every(x=>useListaVidaUtil[x.equipo]!==false)}
                        onChange={e=>{
                          if(e.target.checked){
                            setVidaUtilState(s=>({...s,lista:{}}));
                          }else{
                            setVidaUtilState(s=>{
                              const lista={...s.lista};
                              const override={...s.override};
                              rowsAmortizacionHistorica.forEach(x=>{
                                lista[x.equipo]=false;
                                if(!(override[x.equipo]>0))override[x.equipo]=Math.round(getVidaUtilListaMaestra(x.equipo))||8000;
                              });
                              return {lista,override};
                            });
                          }
                        }}
                        style={{accentColor:C.teal,cursor:"pointer",background:"rgba(0,0,0,0.6)",borderRadius:3}}
                      />
                      <span style={{color:C.teal}}>Delta:</span> Lista de Equipos
                    </label>
                  </div>
                </th>
                <th style={{...thS,padding:"7px 4px",whiteSpace:"normal",lineHeight:1.2}}>MANTENIMIENTO<br/>ACUMULADO 2026</th>
                <th style={{...thS,padding:"7px 3px",whiteSpace:"normal",lineHeight:1.2}}>HS EFECTIVAS<br/>2026</th>
                <th style={{...thS,padding:"7px 4px",whiteSpace:"normal",lineHeight:1.2}}>AMORTIZACIÓN / ALQUILER<br/>(USD/H)</th>
                <th style={{...thS,padding:"7px 3px",whiteSpace:"normal",lineHeight:1.2}}>MANT.<br/>(USD/HS)</th>
                <th style={{...thS,padding:"7px 3px",whiteSpace:"normal",lineHeight:1.2}}>TOTAL<br/>(USD/HS)</th>
                <th style={{...thS,padding:"7px 3px",whiteSpace:"normal",lineHeight:1.2}}>% MANT.</th>
                <th style={{...thS,padding:"7px 3px",textAlign:"center",whiteSpace:"normal",lineHeight:1.2}}>PROMEDIO<br/>POR TIPO</th>
              </tr></thead>
              <tbody>{amortizacionHistoricaVisibleRows.map((x,i)=>{
                const groupTop={};
                const manual=useListaVidaUtil[x.equipo]===false;
                return <tr key={x.equipo} style={{height:52,background:i%2===0?"rgba(255,255,255,0.055)":"rgba(255,255,255,0.10)"}}>
                  <td style={{...tdL,...groupTop,padding:"7px 4px",color:C.blue,fontWeight:800,whiteSpace:"nowrap"}}>{x.equipo}</td>
                  <td style={{...tdS,...groupTop,padding:"7px 3px",color:C.textSub,fontWeight:600,whiteSpace:"nowrap"}}>DELTA</td>
                  <td style={{...tdS,...groupTop,padding:"7px 4px",textAlign:"left",color:C.textSub,fontWeight:700,whiteSpace:"nowrap"}}>{x.tipo}</td>
                  <td style={{...tdS,...groupTop,padding:"7px 3px",color:C.textSub,whiteSpace:"nowrap"}}>{x.modelo||"—"}</td>
                  <td style={{...tdS,...groupTop,padding:"7px 4px",fontWeight:800,whiteSpace:"nowrap"}}>{x.valor>0?`U$S ${fmtNum(Math.round(x.valor))}`:"—"}</td>
                  <td style={{...tdS,...groupTop,padding:"4px 3px",whiteSpace:"nowrap"}}>
                    <div style={{display:"flex",alignItems:"center",gap:5,justifyContent:"center"}}>
                      <input
                        type="checkbox"
                        checked={!manual}
                        onChange={e=>{
                          const checked=e.target.checked;
                          setVidaUtilState(state=>{
                            const lista={...state.lista,[x.equipo]:checked?undefined:false};
                            const override={...state.override};
                            if(!checked&&!(override[x.equipo]>0))override[x.equipo]=Math.round(getVidaUtilListaMaestra(x.equipo))||8000;
                            return {lista,override};
                          });
                        }}
                        style={{accentColor:C.teal,cursor:"pointer",flexShrink:0,appearance:"auto",width:14,height:14,background:"rgba(0,0,0,0.7)",borderRadius:3}}
                        title={manual?"Usar Vida Útil de Lista Maestra":"Usando Vida Útil de Lista Maestra"}
                      />
                      {manual?(
                        <input
                          value={vidaUtilOverride[x.equipo]??Math.round(x.vida)}
                          onChange={e=>{
                            const raw=String(e.target.value||"").replace(/[^\d.,]/g,"").replace(",",".");
                            const value=Number(raw)||0;
                            setVidaUtilState(state=>({lista:{...state.lista,[x.equipo]:false},override:{...state.override,[x.equipo]:value}}));
                          }}
                          style={{width:"min(72px,70%)",background:"rgba(0,0,0,0.6)",border:"1px solid #f5c518aa",borderRadius:5,color:"#f5c518",fontWeight:700,fontSize:12,padding:"3px 4px",outline:"none",textAlign:"right",fontFamily:"Inter"}}
                        />
                      ):<span style={{color:C.textSub,textAlign:"right"}}>{x.vida>0?fmtNum(Math.round(x.vida)):"—"}</span>}
                    </div>
                  </td>
                  <td style={{...tdS,...groupTop,padding:"7px 4px",color:C.purple,fontWeight:800,whiteSpace:"nowrap"}}>{x.mantenimiento>0?`U$S ${fmtNum(Math.round(x.mantenimiento))}`:"—"}</td>
                  <td style={{...tdS,...groupTop,padding:"7px 3px",fontWeight:800,whiteSpace:"nowrap"}}>{x.horas>0?fmtNum(x.horas):"—"}</td>
                  <td style={{...tdS,...groupTop,padding:"7px 4px",color:C.yellow,fontWeight:800,whiteSpace:"nowrap"}}>{x.amort>0?`U$S ${Number(x.amort).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}`:"—"}</td>
                  <td style={{...tdS,...groupTop,padding:"7px 3px",color:C.purple,fontWeight:800,whiteSpace:"nowrap"}}>{x.horas>0?`U$S ${Number(x.mantHs).toLocaleString("es-AR",{maximumFractionDigits:0})}`:"—"}</td>
                  <td style={{...tdS,...groupTop,padding:"7px 3px",color:"#ff1717",fontWeight:900,whiteSpace:"nowrap"}}>{x.totalHs>0?`U$S ${Number(x.totalHs).toLocaleString("es-AR",{maximumFractionDigits:0})}`:"—"}</td>
                  <td style={{...tdS,...groupTop,padding:"7px 3px",color:C.textSub,whiteSpace:"nowrap"}}>{x.pctMant>0?(x.pctMant*100).toFixed(2)+"%":"—"}</td>
                  {x._firstTipoDisplay&&<td rowSpan={x._grupoSizeDisplay||1} style={{...tdS,padding:"7px 3px",background:"rgba(59,130,246,.16)",color:C.blue,fontWeight:900,fontSize:15,borderLeft:`1px solid ${C.blue}55`,borderTop:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`,verticalAlign:"middle",whiteSpace:"nowrap"}}>{x.promedioEquipo>0?(x.promedioEquipo*100).toFixed(0)+"%":"—"}</td>}
                </tr>;
              })}</tbody>
            </table>
          </div>
        </Card>
      )}

      {isCostosTabResumenHistorico&&(
        <Card
          title="Resumen de costo histórico por grupo"
          action={<BotonDescargar onClick={()=>descargarExcel("Resumen_costo_historico_por_grupo_2026",buildRowsResumenHistoricoExcel())}/>}
        >
          {renderCostosQuickFilters("t10",true,{tipoOptions:resumenTipoOptions,equipoOptions:resumenHistoricoEquipoOptions,propiedadOptions:resumenPropiedadOptions,counter:rowsResumenHistoricoDetalle.length})}
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr>
                {["MAQUINA","MODELO TIPO","MANTENIMIENTO ACUMULADO 2026","HS EFECTIVAS 2026","COSTO HORARIO DE AMORTIZACIÓN","% MANTENIMIENTO","COSTO HORARIO","COSTO TOTAL HORARIO"].map(h=><th key={h} style={{...thS,background:C.yellow,color:"#111",fontWeight:900}}>{h}</th>)}
              </tr></thead>
              <tbody>{rowsResumenHistorico.map((x,i)=><tr key={`${x.maquina}-${x.modelo}`} style={{background:i%2===0?"rgba(255,255,255,.14)":"rgba(255,255,255,.09)"}}>
                <td style={{...tdS,textAlign:"left",fontWeight:700,color:C.text}}>{x.maquina}</td>
                <td style={{...tdS,textAlign:"left",fontWeight:600,color:C.textSub}}>{x.modelo||"—"}</td>
                <td style={{...tdS,fontWeight:800,color:C.purple}}>{x.mantenimiento>0?`USD ${fmtNum(Math.round(x.mantenimiento))}`:"—"}</td>
                <td style={{...tdS,fontWeight:800,color:C.text}}>{x.horas>0?fmtNum(x.horas):"—"}</td>
                <td style={{...tdS,fontWeight:700,color:C.yellow}}>{x.amort>0?`USD ${fmtNum(Math.round(x.amort))}`:"—"}</td>
                <td style={{...tdS,fontWeight:700,color:C.textSub}}>{x.pctMant>0?(x.pctMant*100).toFixed(0)+"%":"—"}</td>
                <td style={{...tdS,fontWeight:800,color:C.cyan}}>{x.costoHorario>0?`USD ${fmtNum(Math.round(x.costoHorario))}`:"—"}</td>
                <td style={{...tdS,fontWeight:800,color:C.green}}>{x.costoTotal>0?`USD ${fmtNum(Math.round(x.costoTotal))}`:"—"}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// El contenedor principal recibe nuevas referencias de arrays en cada ciclo de
// sincronización, incluso cuando Google Sheets no cambió. Comparar sólo por
// referencia hacía que todo InformeCostosView se renderizara nuevamente cada
// pocos segundos. El fingerprint completo se calcula una sola vez por array
// (WeakMap) y evita esos renders sin ocultar cambios reales en los datos.
const dmDatasetFingerprintCache=new WeakMap();
function dmDatasetFingerprint(rows){
  if(!Array.isArray(rows))return "no-array";
  const cached=dmDatasetFingerprintCache.get(rows);
  if(cached)return cached;
  let h1=2166136261>>>0,h2=0x9e3779b9>>>0;
  for(let i=0;i<rows.length;i++){
    const row=rows[i];
    let text;
    try{text=JSON.stringify(row)||"";}catch(_){text=String(row||"");}
    for(let j=0;j<text.length;j++){
      const code=text.charCodeAt(j);
      h1=Math.imul(h1^code,16777619)>>>0;
      h2=(Math.imul(h2^code,2246822519)+i+j)>>>0;
    }
  }
  const out=`${rows.length}:${h1.toString(36)}:${h2.toString(36)}`;
  dmDatasetFingerprintCache.set(rows,out);
  return out;
}
function sameInformeCostosProps(prev,next){
  return prev.usdRate===next.usdRate&&
    prev.deps===next.deps&&
    prev.equipmentUniverse===next.equipmentUniverse&&
    (prev.rma15===next.rma15||dmDatasetFingerprint(prev.rma15)===dmDatasetFingerprint(next.rma15))&&
    (prev.rop02===next.rop02||dmDatasetFingerprint(prev.rop02)===dmDatasetFingerprint(next.rop02))&&
    (prev.insumos===next.insumos||dmDatasetFingerprint(prev.insumos)===dmDatasetFingerprint(next.insumos))&&
    (prev.listaEquipos===next.listaEquipos||dmDatasetFingerprint(prev.listaEquipos)===dmDatasetFingerprint(next.listaEquipos));
}
function rowHasExcludedMaintenanceCostCode(row){
  if(!row||typeof row!=="object")return false;
  return Object.entries(row).some(([key,value])=>
    /codigo|código|interno/i.test(key)&&isExcludedFromMaintenanceCostReport(value)
  );
}

function ViewCostosMant(props){
  const preparedRma15=React.useMemo(()=>prepareMaintenanceCostRows(props.rma15),[props.rma15]);
  const preparedRop02=React.useMemo(()=>prepareRop02CostRows(props.rop02),[props.rop02]);
  // ROP02 define el universo visible del informe. Así un equipo con costo pero
  // sin actividad real no puede aparecer ni distorsionar USD/h.
  const equiposConMantenimiento2026=React.useMemo(()=>buildEquipmentWithRop02Activity2026(preparedRop02),[preparedRop02]);
  const filteredRma15=React.useMemo(()=>preparedRma15.filter(row=>
    !isExcludedFromMaintenanceCostReport(row?.maquina||row?.equipo||row?.interno||row?.codigo)&&belongsToMaintenanceUniverse2026(row,equiposConMantenimiento2026)
  ),[preparedRma15,equiposConMantenimiento2026]);
  const costDataIndex=React.useMemo(()=>indexMaintenanceCostRows(filteredRma15),[filteredRma15]);
  const filteredRop02=React.useMemo(()=>preparedRop02.filter(row=>belongsToMaintenanceUniverse2026(row,equiposConMantenimiento2026)),[preparedRop02,equiposConMantenimiento2026]);
  const rop02RangeIndex=React.useMemo(()=>buildEquipmentRangeIndex(filteredRop02,equiposConMantenimiento2026,row=>row._effectiveHours),[filteredRop02,equiposConMantenimiento2026]);
  const filteredListaEquipos=React.useMemo(()=>(props.listaEquipos||[]).filter(row=>
    !rowHasExcludedMaintenanceCostCode(row)
  ),[props.listaEquipos]);
  return <ViewCostosMantCore {...props} rma15={filteredRma15} rop02={filteredRop02} listaEquipos={filteredListaEquipos} equiposConMantenimiento2026={equiposConMantenimiento2026} costDataIndex={costDataIndex} rop02RangeIndex={rop02RangeIndex}/>;
}

export const MemoViewCostosMant=React.memo(ViewCostosMant,sameInformeCostosProps);
export default MemoViewCostosMant;
