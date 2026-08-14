import React from "react";
import * as XLSX from "xlsx";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, Legend, ReferenceLine } from "recharts";
import { diagCount, diagEvent, diagGauge, diagReset, diagSnapshot, diagTiming, subscribeDiagnostics } from "./services/informeCostosDiagnostics.js";
import CostosTabPanel from "./components/CostosTabPanel.jsx";
import { getCostoHorarioAmortizacionOAlquiler, esEquipoPropioDelta } from "./utils/amortizationCost.js";
import ComparisonStrip from "../../components/ComparisonStrip.jsx";
import { previousComparablePeriod } from "../../shared/periodCompare.js";
import { isExcludedFromMaintenanceCostReport, isMaintenanceCostMachine } from "../equipment/equipmentCode.js";
import { buildVisibleCategoryRowSpans } from "./utils/categoryRowSpan.js";
import { buildEquipmentRangeIndex, buildEquipmentWithMaintenance2026, belongsToMaintenanceUniverse2026, clampInformeCostosDate, indexMaintenanceCostRows, maintenanceEquipmentCode, prepareMaintenanceCostRows, prepareRop02CostRows, queryEquipmentRangeIndex } from "./utils/equipmentUniverse2026.js";
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
    AmortRow, Badge, C, Card, CategoriaModeloTableRow, DateIn, HIST_COSTO_MENSUAL_ACUMULADO, MultiSel, ParamInput:BaseParamInput, PeriodMonthYear, SortableTH, appAlert, appConfirm, buildMonthKeysCosto, byDateFilter, canonicalEquivalentMachineCode, cleanKey, cleanMachine, dmCategoriasCommand, esMaquinaCosto, findColumnKey, fmtNum, getMachineType, getValue, mainMachineCode, matchMulti, monthKeyCosto, monthLabelCosto, multiIsAll, normalizeInsumoCode, normalizeMachineCode, normalizeMultiValue, positionTip, proyColor, sortRowsForTable, tipoEquipoCosto, toNumber, uniq
  } = deps;
  React.useEffect(()=>()=>terminateInformeCostosWorker(),[]);
  const esEquipoMaquinaCosto=React.useCallback((maquina,tipo,familia="")=>
    isMaintenanceCostMachine({code:maquina,type:tipo,family:familia})||esMaquinaCosto(tipo,maquina,familia),
  [esMaquinaCosto]);
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
  const COSTOS_TABLAS_FILTRABLES=React.useMemo(()=>["t1","t7","t6","t5","t9","t10"],[]);
  const defaultCostosFiltrosTabla=React.useCallback(()=>({
    t1:{tipo:"todos",equipo:"todos",propiedad:"todos"},
    t7:{tipo:"todos",equipo:"todos",propiedad:"todos"},
    t6:{tipo:"todos",equipo:"todos",propiedad:"todos"},
    t5:{tipo:"todos",equipo:"todos",propiedad:"todos"},
    t9:{tipo:"todos",equipo:"todos",propiedad:"DELTA"},
    t10:{tipo:"todos",equipo:"todos",propiedad:"todos"},
  }),[]);
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

  // Filtros generales diferidos para que elegir opciones no congele la pantalla.
  // El selector cambia al instante y los cálculos pesados se actualizan un momento después.
  const dFMaquinas=useCostoDebouncedValue(fMaquinas,180);
  const dFTipoEquipo=useCostoDebouncedValue(fTipoEquipo,180);
  const dFProyecto=useCostoDebouncedValue(fProyecto,380);
  const dFInsumos=useCostoDebouncedValue(fInsumos,380);
  const dFPropiedad=useCostoDebouncedValue(fPropiedad,180);
  // Fechas diferidas: los controles responden al instante y los cálculos pesados
  // se ejecutan cuando el usuario termina de cambiar el período.
  const dFechaDia=useCostoDebouncedValue(fechaDia,420);
  const dFechaD=useCostoDebouncedValue(fechaD,420);
  const dFechaH=useCostoDebouncedValue(fechaH,420);
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
  const dFMOMaquinas=useCostoDebouncedValue(fMOMaquinas,180);
  const dFMOTipoEquipo=useCostoDebouncedValue(fMOTipoEquipo,180);
  const dFMOPropiedad=useCostoDebouncedValue(fMOPropiedad,180);
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
  const dFResumenTipo=useCostoDebouncedValue(fResumenTipo,180);
  const dFResumenEquipo=useCostoDebouncedValue(fResumenEquipo,180);
  const dFResumenPropiedad=useCostoDebouncedValue(fResumenPropiedad,180);
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
        tipo:tipoEquipoCosto(codigoCanonicoEquipo(r.maquina),familia),
      });
    });
    return map;
  },[rma15PorFecha,rma15CostoMensualPorFecha,propiedadesEquipo,equipoCostoDisplay,codigoCanonicoEquipo,familiaEquipoCosto,lugarAlquilerEquipoCosto,tipoEquipoCosto]);

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
      tipo:tipoEquipoCosto(codigoCanonicoEquipo(maquina),familia),
    };
    metaEquipoFallbackMemo.set(key,out);
    return out;
  },[rma15MetaMap,equipoCostoDisplay,propiedadesEquipo,codigoCanonicoEquipo,familiaEquipoCosto,lugarAlquilerEquipoCosto,tipoEquipoCosto,metaEquipoFallbackMemo]);

  const matchPropiedadMeta=React.useCallback((meta,seleccion)=>{
    if(multiIsAll(seleccion,"todos"))return true;
    const props=meta?.props||[];
    const sel=Array.isArray(seleccion)?seleccion:[seleccion].filter(Boolean);
    return sel.some(p=>props.includes(String(p||"").trim().toUpperCase()));
  },[]);

  const costoRowsProyectoOpts=React.useMemo(()=>rma15PorFecha||[],[rma15PorFecha]);

  const costoRowsPropiedadOpts=React.useMemo(()=>
    costoRowsProyectoOpts.filter(r=>matchMulti(r.proyecto,dFProyecto,"todos")),
    [costoRowsProyectoOpts,dFProyecto]
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
      return sel.includes(tipo)||(sel.includes("MAQUINAS")&&esEquipoMaquinaCosto(r.maquina,tipo,meta.familia));
    }),
    [costoRowsTipoEquipoOpts,dFTipoEquipo,metaEquipoCosto,esEquipoMaquinaCosto]
  );

  const proyectoOpts=React.useMemo(()=>[
    {value:"todos",label:"Todos los proyectos"},
    ...uniq(costoRowsProyectoOpts.map(r=>r.proyecto).filter(Boolean)).map(p=>({value:p,label:p}))
  ],[costoRowsProyectoOpts]);

  const propiedadOpts=React.useMemo(()=>buildCostPropertyOptions(costoRowsPropiedadOpts.flatMap(r=>(metaEquipoCosto(r.maquina).props||[]).map(propiedad=>({propiedad})))),[costoRowsPropiedadOpts,metaEquipoCosto]);

  const tipoEquipoOpts=React.useMemo(()=>{
    const presentes=new Set(costoRowsTipoEquipoOpts.map(r=>metaEquipoCosto(r.maquina).tipo).filter(Boolean));
    const base=[
      {value:"todos",label:"Todos los equipos"},
      {value:"MAQUINAS",label:"Máquinas"},
      {value:"CAMIONES",label:"Camiones"},
      {value:"CAMIONETAS",label:"Camionetas"},
      {value:"EXCAVADORA",label:"Excavadoras"},
      {value:"CARGADORA FRONTAL",label:"Cargadoras frontales"},
      {value:"MOTONIVELADORA",label:"Motoniveladoras"},
      {value:"TOPADORA",label:"Topadoras"},
      {value:"RETROPALA",label:"Retropalas"},
      {value:"COMPACTACION",label:"Rodillos compactadores"},
      {value:"MINICARGADORA",label:"Minicargadoras"},
      {value:"OTROS",label:"Otros"},
    ];
    return base.filter(o=>o.value==="todos"||o.value==="MAQUINAS"||presentes.has(o.value));
  },[costoRowsTipoEquipoOpts,metaEquipoCosto]);

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

  // Opciones y filtrado AISLADOS para Mano de Obra.
  // Proyecto se toma del filtro general fProyecto para que coincida con el resto de la app.
  const moRowsProyectoOpts=React.useMemo(()=>
    (rma15PorFecha||[]).filter(r=>matchMulti(r.proyecto,fProyecto,"todos")),
    [rma15PorFecha,fProyecto]
  );
  const moRowsPropiedadOpts=React.useMemo(()=>moRowsProyectoOpts,[moRowsProyectoOpts]);
  const moRowsTipoEquipoOpts=React.useMemo(()=>
    moRowsPropiedadOpts.filter(r=>matchPropiedadMeta(metaEquipoCosto(r.maquina),fMOPropiedad)),
    [moRowsPropiedadOpts,fMOPropiedad,metaEquipoCosto,matchPropiedadMeta]
  );
  const moRowsMaquinaOpts=React.useMemo(()=>
    moRowsTipoEquipoOpts.filter(r=>{
      if(multiIsAll(fMOTipoEquipo,"todos"))return true;
      const meta=metaEquipoCosto(r.maquina);
      const tipo=meta.tipo;
      const sel=Array.isArray(fMOTipoEquipo)?fMOTipoEquipo:[];
      return sel.includes(tipo)||(sel.includes("MAQUINAS")&&esEquipoMaquinaCosto(r.maquina,tipo,meta.familia));
    }),
    [moRowsTipoEquipoOpts,fMOTipoEquipo,metaEquipoCosto,esEquipoMaquinaCosto]
  );
  const moPropiedadOpts=React.useMemo(()=>[
    {value:"todos",label:"Todas las propiedades"},
    ...uniq(moRowsPropiedadOpts.flatMap(r=>metaEquipoCosto(r.maquina).props||[]).filter(Boolean)).map(p=>({value:p,label:p}))
  ],[moRowsPropiedadOpts,metaEquipoCosto]);
  const moTipoEquipoOpts=React.useMemo(()=>{
    const presentes=new Set(moRowsTipoEquipoOpts.map(r=>metaEquipoCosto(r.maquina).tipo).filter(Boolean));
    const base=[
      {value:"todos",label:"Todos los equipos"},{value:"MAQUINAS",label:"Máquinas"},
      {value:"CAMIONES",label:"Camiones"},{value:"CAMIONETAS",label:"Camionetas"},
      {value:"EXCAVADORA",label:"Excavadoras"},{value:"CARGADORA FRONTAL",label:"Cargadoras frontales"},
      {value:"MOTONIVELADORA",label:"Motoniveladoras"},{value:"TOPADORA",label:"Topadoras"},
      {value:"RETROPALA",label:"Retropalas"},{value:"COMPACTACION",label:"Rodillos compactadores"},
      {value:"MINICARGADORA",label:"Minicargadoras"},{value:"OTROS",label:"Otros"},
    ];
    return base.filter(o=>o.value==="todos"||o.value==="MAQUINAS"||presentes.has(o.value));
  },[moRowsTipoEquipoOpts,metaEquipoCosto]);
  const moMaquinaOpts=React.useMemo(()=>[
    {value:"todos",label:"Todas"},
    ...uniq(moRowsMaquinaOpts.map(r=>metaEquipoCosto(r.maquina).display).filter(Boolean)).map(m=>({value:m,label:m}))
  ],[moRowsMaquinaOpts,metaEquipoCosto]);

  // Caches de filtros base: evita refiltrar toda la fuente cuando la pestaña no los necesita.
  const rma15FiltradoMOCacheRef=React.useRef([]);
  const rma15FiltradoCacheRef=React.useRef([]);
  const rma15CostoMensualFiltradoCacheRef=React.useRef([]);
  const historialAcumuladoFiltradoCacheRef=React.useRef([]);
  const historialAcumuladoFiltradoMOCacheRef=React.useRef([]);

  // rma15 filtrado SOLO para Mano de Obra (usa fMO*)
  const rma15FiltradoMO=React.useMemo(()=>{
    if(!needsManoObraCostos)return rma15FiltradoMOCacheRef.current||[];
    const out=(rma15PorFecha||[]).filter(r=>{
      const meta=metaEquipoCosto(r.maquina);
      if(!matchMulti(r.proyecto,dFProyecto,"todos"))return false;
      if(!matchPropiedadMeta(meta,dFMOPropiedad))return false;
      if(!matchMulti(meta.display,dFMOMaquinas,"todos"))return false;
      if(multiIsAll(dFMOTipoEquipo,"todos"))return true;
      const tipo=meta.tipo;
      const sel=Array.isArray(dFMOTipoEquipo)?dFMOTipoEquipo:[];
      return sel.includes(tipo)||(sel.includes("MAQUINAS")&&esEquipoMaquinaCosto(r.maquina,tipo,meta.familia));
    });
    rma15FiltradoMOCacheRef.current=out;
    return out;
  },[needsManoObraCostos,rma15PorFecha,dFProyecto,dFMOPropiedad,dFMOMaquinas,dFMOTipoEquipo,metaEquipoCosto,matchPropiedadMeta,esEquipoMaquinaCosto]);

  const rma15Filtrado=React.useMemo(()=>{
    const activeCalc=calcTablaCostos;
    if(!activeCalc)return rma15FiltradoCacheRef.current||[];
    const out=(rma15PorFecha||[]).filter(r=>{
      const meta=metaEquipoCosto(r.maquina);
      if(!matchMulti(r.proyecto,dFProyecto,"todos"))return false;
      if(!matchPropiedadMeta(meta,dFCPropiedad))return false;
      if(!matchMulti(meta.display,dFCMaquinas,"todos"))return false;
      if(multiIsAll(dFCTipoEquipo,"todos"))return true;
      const tipo=meta.tipo;
      const sel=Array.isArray(dFCTipoEquipo)?dFCTipoEquipo:[];
      return sel.includes(tipo)||(sel.includes("MAQUINAS")&&esEquipoMaquinaCosto(r.maquina,tipo,meta.familia));
    });
    rma15FiltradoCacheRef.current=out;
    return out;
  },[calcTablaCostos,rma15PorFecha,dFProyecto,dFCPropiedad,dFCMaquinas,dFCTipoEquipo,metaEquipoCosto,matchPropiedadMeta,esEquipoMaquinaCosto]);

  // Comparación independiente de los filtros internos de cada tabla.
  // Antes heredaba Tipo/Equipo/Propiedad de Amortización y por eso podía mostrar 0
  // aunque el período tuviera RMA15. Sólo respeta los filtros generales visibles.
  const periodoAnteriorCostos=React.useMemo(()=>dFechaD&&dFechaH?previousComparablePeriod(dFechaD,dFechaH):null,[dFechaD,dFechaH]);
  const rma15ComparacionActual=React.useMemo(()=>
    (rma15PorFecha||[]).filter(r=>matchMulti(r.proyecto,dFProyecto,"todos")),
    [rma15PorFecha,dFProyecto,matchMulti]
  );
  const rma15AnteriorCostos=React.useMemo(()=>{
    if(!periodoAnteriorCostos)return[];
    const dated=byDateFilter(rma15||[],"periodo","",periodoAnteriorCostos.from,periodoAnteriorCostos.to);
    const base=prepararFilasCosto(filtrarInsumosCosto(dated,dFInsumos));
    return base.filter(r=>matchMulti(r.proyecto,dFProyecto,"todos"));
  },[periodoAnteriorCostos,rma15,byDateFilter,dFInsumos,filtrarInsumosCosto,prepararFilasCosto,dFProyecto,matchMulti]);

  const rma15CostoMensualFiltrado=[]; // Fase 3A: filtrado trasladado al Web Worker.

  const fmtU=v=>v==null||v===0?"—":"$"+fmtNum(Math.round(v));
  const fmtUSD2=v=>v==null||v===0?"—":"U$S "+fmtNum(Math.round(v));

  // Tabla de costos desde RMA15
  const tabla1CacheRef=React.useRef([]);
  const tabla1=React.useMemo(()=>{
    const activeCalc=calcTablaCostos;
    if(!activeCalc)return tabla1CacheRef.current||[];
    const map={};
    (rma15Filtrado||[]).forEach(r=>{
      const meta=metaEquipoCosto(r.maquina);
      const eq=meta.display;
      if(!map[eq])map[eq]={equipo:eq,propiedad:meta.propiedad||"S/D",prev:0,corr:0};
      const costo=Number(r._costoTotalARS)||0;
      if(r._esPreventivo)map[eq].prev+=costo;
      else map[eq].corr+=costo;
    });
    const out=Object.values(map).filter(x=>x.prev>0||x.corr>0).sort((a,b)=>a.equipo.localeCompare(b.equipo)).map(x=>({...x,total:x.prev+x.corr}));
    tabla1CacheRef.current=out;
    return out;
  },[calcTablaCostos,rma15Filtrado,metaEquipoCosto]);

  const tabla2=tabla1;
  /* const tabla2=React.useMemo(()=>{
    const map={};
    (rma15Filtrado||[]).forEach(r=>{
      const meta=metaEquipoCosto(r.maquina);
      const eq=meta.display;
      if(!map[eq])map[eq]={equipo:eq,propiedad:meta.propiedad||"S/D",prev:0,corr:0};
      (r.insumos||[]).forEach(ins=>{
        const t=String(r.tipoMant||"").toUpperCase();
        if(t.includes("PREV"))map[eq].prev+=ins.costoTotal||0;
        else map[eq].corr+=ins.costoTotal||0;
      });
    });
    return Object.values(map).filter(x=>x.prev>0||x.corr>0).sort((a,b)=>a.equipo.localeCompare(b.equipo)).map(x=>({...x,total:x.prev+x.corr}));
  },[rma15Filtrado,metaEquipoCosto]); */

  const mesesAcumuladoCacheRef=React.useRef([]);
  const mesesAcumulado=React.useMemo(()=>{
    const activeCalc=calcTablaCostos;
    if(!activeCalc)return mesesAcumuladoCacheRef.current||[];
    const out=buildMonthKeysCosto(rma15Filtrado||[],modoFecha,dFechaDia,dFechaD,dFechaH);
    mesesAcumuladoCacheRef.current=out;
    return out;
  },[calcTablaCostos,rma15Filtrado,modoFecha,dFechaDia,dFechaD,dFechaH]);

  // Debe calcularse ANTES de acumuladoEquipos. Si queda debajo, React intenta usar
  // subtotalJM/subtotalFS antes de inicializarlos y la pestaña se pone en blanco.
  const subtotalJM=(Number(mecJM)||0)*(Number(costMec)||0)+(Number(ctaMecJM)||0)*(Number(costCTA)||0);
  const subtotalFS=(Number(mecFS)||0)*(Number(costMec)||0)+(Number(ctaMecFS)||0)*(Number(costCTA)||0);

  // Cache de cálculos pesados: al cambiar de ventana o seleccionar filtros,
  // no se recalculan pestañas ocultas. Esto evita los tirones al navegar.
  const acumuladoEquiposCacheRef=React.useRef([]);
  const costoMensualAcumuladoCacheRef=React.useRef([]);
  const costoMensualAcumuladoMOCacheRef=React.useRef([]);
  const rowsAmortizacionCacheRef=React.useRef([]);
  const rowsAmortizacionHHCacheRef=React.useRef([]);
  const rowsAmortizacionOrdCacheRef=React.useRef([]);
  const rowsAmortizacionFiltCacheRef=React.useRef([]);
  // Amortización puede ser pesada al entrar porque arma filas, inputs y promedios.
  // Se habilita el cálculo después del primer pintado y se renderiza en tandas.
  const [amortizacionCalcEnabled,setAmortizacionCalcEnabled]=React.useState(false);
  // Mantener el cache de Amortización habilitado, pero ejecutar sus cálculos
  // únicamente cuando la pestaña visible realmente los necesita. Antes, una vez
  // habilitada, cada actualización de Mano de Obra o filtros ocultos volvía a
  // recorrer y renderizar Amortización/Resumen aunque el usuario estuviera en otra tabla.
  const amortizacionCalcActive=amortizacionCalcEnabled&&(isCostosTabAmortizacion||isCostosTabResumen);

  // Amortización se habilita sólo cuando el usuario abre Amortización o Resumen.
  // El primer frame muestra la pestaña; el cálculo comienza después, sin precargarlo
  // al entrar al informe.
  React.useEffect(()=>{
    if(amortizacionCalcEnabled)return;
    if(!(isCostosTabAmortizacion||isCostosTabResumen))return;
    let alive=true;
    const run=()=>{if(alive)setAmortizacionCalcEnabled(true);};
    const id=window.setTimeout(run,0);
    return()=>{alive=false;window.clearTimeout(id);};
  },[isCostosTabAmortizacion,isCostosTabResumen,amortizacionCalcEnabled]);

  // Fase 3A: el acumulado se recibe del Worker persistente. React conserva el
  // último resultado visible mientras se procesa una nueva consulta.
  const [acumuladoEquipos,setAcumuladoEquipos]=React.useState(()=>acumuladoEquiposCacheRef.current||[]);

  const acumuladoSubtotales=React.useMemo(()=>{
    const mk=()=>({prev:0,corr:0,total:0,months:Object.fromEntries((mesesAcumulado||[]).map(m=>[m.key,{prev:0,corr:0,total:0}])),promedio:0,mo:0,hsEf:0,usdHs:0});
    const out={FS:mk(),JM:mk(),TOTAL:mk()};
    (acumuladoEquipos||[]).forEach(x=>{
      const sec=out[x.section]||out.FS;
      [sec,out.TOTAL].forEach(t=>{
        t.prev+=x.prev||0;t.corr+=x.corr||0;t.total+=x.total||0;t.promedio+=x.promedio||0;t.mo+=x.mo||0;
        (mesesAcumulado||[]).forEach(m=>{
          t.months[m.key].prev+=x.months[m.key]?.prev||0;
          t.months[m.key].corr+=x.months[m.key]?.corr||0;
          t.months[m.key].total+=x.months[m.key]?.total||0;
        });
      });
    });
    out.FS.hsEf=Number(hsEfFS)||0;out.JM.hsEf=Number(hsEfJM)||0;out.TOTAL.hsEf=out.FS.hsEf+out.JM.hsEf;
    out.FS.usdHs=out.FS.hsEf>0?(out.FS.total+out.FS.mo)/out.FS.hsEf:0;
    out.JM.usdHs=out.JM.hsEf>0?(out.JM.total+out.JM.mo)/out.JM.hsEf:0;
    out.TOTAL.usdHs=out.TOTAL.hsEf>0?(out.TOTAL.total+out.TOTAL.mo)/out.TOTAL.hsEf:0;
    return out;
  },[acumuladoEquipos,mesesAcumulado,hsEfFS,hsEfJM]);

  const totJM=React.useMemo(()=>({
    prev:tabla1.reduce((s,x)=>s+x.prev,0),
    corr:tabla1.reduce((s,x)=>s+x.corr,0),
    total:tabla1.reduce((s,x)=>s+x.total,0),
  }),[tabla1]);

  const totFS=React.useMemo(()=>({
    prev:tabla2.reduce((s,x)=>s+x.prev,0),
    corr:tabla2.reduce((s,x)=>s+x.corr,0),
    total:tabla2.reduce((s,x)=>s+x.total,0),
  }),[tabla2]);

  const totCostos=totJM;

  const proyectoSeleccionadoArr=React.useMemo(()=>multiIsAll(fProyecto,"todos")?[]:(Array.isArray(fProyecto)?fProyecto:[fProyecto]).filter(Boolean),[fProyecto]);
  const incluyeJM=React.useMemo(()=>multiIsAll(fProyecto,"todos")||proyectoSeleccionadoArr.some(p=>String(p).toUpperCase().includes("JOSE")||String(p).toUpperCase().includes("JM")),[fProyecto,proyectoSeleccionadoArr]);
  const incluyeFS=React.useMemo(()=>multiIsAll(fProyecto,"todos")||proyectoSeleccionadoArr.some(p=>String(p).toUpperCase().includes("FILO")||String(p).toUpperCase().includes("FS")),[fProyecto,proyectoSeleccionadoArr]);
  const subtotalProyecto=(incluyeJM?subtotalJM:0)+(incluyeFS?subtotalFS:0);
  const hsEfProyecto=(incluyeJM?(Number(hsEfJM)||0):0)+(incluyeFS?(Number(hsEfFS)||0):0);

  const proyectoTitulo=React.useMemo(()=>{
    if(multiIsAll(fProyecto,"todos"))return "Todos los proyectos";
    const arr=Array.isArray(fProyecto)?fProyecto:[fProyecto];
    return arr.filter(Boolean).join(" + ")||"Todos los proyectos";
  },[fProyecto]);

  const handleAcumUpload=async(e)=>{
    const file=e.target.files?.[0];
    if(!file)return;
    setAcumParsing(true);setAcumError(null);
    try{
      const buf=await file.arrayBuffer();
      const arr=new Uint8Array(buf);
      // Use SheetJS from CDN if available
      if(typeof XLSX==="undefined"){setAcumError("Librería XLSX no disponible. Recargá la página.");setAcumParsing(false);return;}
      const wb=XLSX.read(arr,{type:"array"});
      const ws=wb.Sheets["Acumulado"]||wb.Sheets[wb.SheetNames[0]];
      const raw=XLSX.utils.sheet_to_json(ws,{header:1,defval:null});
      const monthRow=raw[2]||[];
      const months=[];
      for(let i=1;i<monthRow.length;i++){
        if(monthRow[i]&&String(monthRow[i])!=="-"&&isNaN(Number(monthRow[i]))){
          months.push({name:String(monthRow[i]),col:i});
          i+=2; // skip the 3 cols per month, next month starts 3 cols later
        }
      }
      const dataRows=raw.slice(4);
      let section="FS";
      const equipos=[];
      dataRows.forEach((row,ri)=>{
        if(!row||!row[0])return;
        const eq=String(row[0]);
        if(eq==="Subtotal FS"||eq==="Subtotal FS "){section="JM";return;}
        if(eq.startsWith("Subtotal JM")||eq==="TOTAL A"||eq==="-")return;
        const mdata={};
        months.forEach(m=>{
          const prev=parseFloat(row[m.col])||0;
          const corr=parseFloat(row[m.col+1])||0;
          const tot=parseFloat(row[m.col+2])||(prev+corr);
          mdata[m.name]={prev,corr,total:tot};
        });
        const lastDataCol=months.length>0?months[months.length-1].col+3:4;
        equipos.push({
          equipo:eq,section,months:mdata,
          totalB:parseFloat(row[lastDataCol])||0,
          promedio:parseFloat(row[lastDataCol+1])||0,
          mo:parseFloat(row[lastDataCol+3])||0,
          hsEf:parseFloat(row[lastDataCol+4])||180,
          usdHs:parseFloat(row[lastDataCol+5])||0,
        });
      });
      setAcumData({months,equipos});
    }catch(err){setAcumError("Error: "+err.message);}
    setAcumParsing(false);
  };

  const thS={padding:"7px 10px",fontSize:10,fontWeight:700,color:C.textSub,textTransform:"uppercase",letterSpacing:".05em",background:C.surface,borderBottom:`1px solid ${C.border}`,textAlign:"center",whiteSpace:"nowrap"};
  const thL={...thS,textAlign:"left"};
  const tdS={padding:"7px 10px",borderBottom:`1px solid ${C.border}18`,fontSize:12,textAlign:"center",color:C.text};
  const tdL={...tdS,textAlign:"left",fontWeight:600,color:C.blue};
  const tdT={...tdS,fontWeight:700,background:C.surface+"55"};
  const inp={background:"rgba(255,255,255,0.06)",border:`1px solid ${C.border}`,borderRadius:6,color:C.text,padding:"5px 9px",fontSize:12,fontFamily:"Inter",outline:"none",width:"100%"};

  const TabBtn=({id,label})=>(
    <button onClick={()=>setTabCostosFluido(id)} style={{padding:"8px 16px",borderRadius:7,
      border:`1px solid ${tab===id?"transparent":"rgba(255,255,255,0.18)"}`,
      background:tab===id?C.accent:"rgba(28,28,28,0.82)",color:tab===id?"#fff":C.text,
      cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"Inter",transition:"all .15s",
      backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)"}}>
      {label}
    </button>
  );

  const excelBtnStyle={background:C.greenDim,border:`1px solid ${C.green}55`,borderRadius:7,color:C.green,padding:"7px 10px",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"Inter"};

  const descargarExcel=(nombre,rows)=>{
    const wb=XLSX.utils.book_new();
    // Permite exportar tablas con encabezados repetidos, como Top 3 Insumos
    // Correctivo / Preventivo. Para esos casos se envía un array de arrays.
    const isAOA=Array.isArray(rows)&&Array.isArray(rows[0]);
    const ws=isAOA?XLSX.utils.aoa_to_sheet(rows||[]):XLSX.utils.json_to_sheet(rows||[]);
    if(isAOA){
      const maxCols=(rows||[]).reduce((m,r)=>Math.max(m,Array.isArray(r)?r.length:0),0);
      ws["!cols"]=Array.from({length:maxCols},(_,i)=>{
        if(i===0)return {wch:18};
        const header=String((rows?.[0]?.[i]||rows?.[1]?.[i]||"")).toLowerCase();
        if(header.includes("descripcion")||header.includes("descripción"))return {wch:42};
        if(header.includes("propiedad"))return {wch:16};
        if(header.includes("hs"))return {wch:13};
        if(header.includes("usd"))return {wch:13};
        return {wch:13};
      });
    }
    XLSX.utils.book_append_sheet(wb,ws,"Datos");
    XLSX.writeFile(wb,`${nombre}.xlsx`);
  };

  const tablaCostosUsdRate=Number(usdRate2)||1;
  const costoToUSD=v=>(Number(v)||0)/tablaCostosUsdRate;
  const fmtCostoTablaUSD=v=>v==null||Number(v)===0?"U$S 0":"U$S "+fmtNum(Math.round(costoToUSD(v)));

  const sortableCostHead=(sortId,sortKey,children,style)=>
    <SortableTH sortId={sortId} sortKey={sortKey} sorts={costosMantSorts} setSorts={setCostosMantSorts} style={style}>{children}</SortableTH>;

  const esPropiedadDeltaTabla=prop=>String(prop||"").trim().toUpperCase().includes("DELTA");

  const totalesPorPropiedadTabla=React.useCallback((datos)=>{
    const base={delta:{prev:0,corr:0,total:0},alquilado:{prev:0,corr:0,total:0},total:{prev:0,corr:0,total:0}};
    (datos||[]).forEach(x=>{
      const bucket=esPropiedadDeltaTabla(x.propiedad)?base.delta:base.alquilado;
      bucket.prev+=Number(x.prev)||0;
      bucket.corr+=Number(x.corr)||0;
      bucket.total+=Number(x.total)||0;
      base.total.prev+=Number(x.prev)||0;
      base.total.corr+=Number(x.corr)||0;
      base.total.total+=Number(x.total)||0;
    });
    return base;
  },[]);

  const rowsTablaCostosExcel=(datos,tot)=>{
    const resumen=totalesPorPropiedadTabla(datos);
    const rowTotal=(nombre,t)=>({
      EQUIPO:nombre,
      Propiedad:"",
      Preventivo:Math.round(costoToUSD(t?.prev||0)),
      Correctivo:Math.round(costoToUSD(t?.corr||0)),
      Total:Math.round(costoToUSD(t?.total||0)),
    });
    return [
      ...(datos||[]).map(x=>({
        EQUIPO:x.equipo,
        Propiedad:x.propiedad||"S/D",
        Preventivo:Math.round(costoToUSD(x.prev||0)),
        Correctivo:Math.round(costoToUSD(x.corr||0)),
        Total:Math.round(costoToUSD(x.total||0)),
      })),
      rowTotal("TOTAL DELTA",resumen.delta),
      rowTotal("TOTAL ALQUILADO",resumen.alquilado),
      rowTotal("TOTAL",tot||resumen.total),
    ];
  };

  const buildRowsAcumuladoExcel=()=>{
    const rows=[];
    [{id:"FS",label:"FILO DEL SOL"},{id:"JM",label:"JOSE MARIA"}].forEach(sec=>{
      (acumuladoEquipos||[]).filter(x=>x.section===sec.id).forEach(x=>{
        const row={Proyecto:sec.label,Equipo:x.equipo};
        (mesesAcumulado||[]).forEach(m=>{
          const d=x.months[m.key]||{prev:0,corr:0,total:0};
          row[`${m.label} Preventivo USD`]=Math.round(d.prev||0);
          row[`${m.label} Correctivo USD`]=Math.round(d.corr||0);
          row[`${m.label} Total USD`]=Math.round(d.total||0);
        });
        row["Total B USD"]=Math.round(x.total||0);
        row["Promedio USD"]=Math.round(x.promedio||0);
        row["MO USD"]=Math.round(x.mo||0);
        row["Hs Ef."]=x.hsEf||0;
        row["USD/Hs"]=Math.round(x.usdHs||0);
        rows.push(row);
      });
    });
    return rows;
  };


  const monthInFechaFiltroCosto=React.useCallback((key)=>{
    if(!key)return false;
    if(fechaDCostoMensual&&key<monthKeyCosto(fechaDCostoMensual))return false;
    if(hastaCostoMensual&&key>monthKeyCosto(hastaCostoMensual))return false;
    return true;
  },[fechaDCostoMensual,hastaCostoMensual]);

  const sectionProyectoCosto=React.useCallback((section)=>{
    return section==="JM"?"JOSE MARIA":"FILO DEL SOL";
  },[]);

  const historialAcumuladoFiltrado=[]; // Fase 3A: filtrado trasladado al Web Worker.

  // Historial filtrado con filtros MO aislados (para Mano de Obra)
  const historialAcumuladoFiltradoMO=[]; // Fase 3A: filtrado trasladado al Web Worker.

  const mesesFijosAcumuladoMensual=React.useMemo(()=>
    // Los meses 2025 se conservan siempre para poder consolidarlos en TOTAL 2025,
    // aunque el usuario filtre un período que comience en 2026.
    (HIST_COSTO_MENSUAL_ACUMULADO.months||[]).filter(m=>
      String(m.key||"").startsWith("2026-")&&monthInFechaFiltroCosto(m.key)
    ),
    [monthInFechaFiltroCosto]
  );

  const mesesDinamicosAcumuladoMensual=React.useMemo(()=>{
    const set=new Set();
    (rma15CostoMensualPorFecha||[]).forEach(r=>{
      const k=monthKeyCosto(r.fecha);
      if(k&&k>="2026-01")set.add(k);
    });
    return [...set].sort().map(k=>({key:k,label:monthLabelCosto(k),dollar:Number(monthlyDollar[k])||Number(usdRate2)||1400}));
  },[rma15CostoMensualPorFecha,monthlyDollar,usdRate2]);

  const mesesCostoMensual=React.useMemo(()=>{
    const map=new Map();
    [...mesesFijosAcumuladoMensual,...mesesDinamicosAcumuladoMensual].forEach(m=>map.set(m.key,{...m,dollar:Number(monthlyDollar[m.key])||Number(m.dollar)||Number(usdRate2)||1400}));
    return [...map.values()].sort((a,b)=>a.key.localeCompare(b.key));
  },[mesesFijosAcumuladoMensual,mesesDinamicosAcumuladoMensual,monthlyDollar,usdRate2]);

  const ultimoDolarCostoMensual=React.useMemo(()=>{
    const meses=[...(mesesCostoMensual||[])].filter(m=>m?.key).sort((a,b)=>String(a.key).localeCompare(String(b.key)));
    const ultimo=meses[meses.length-1];
    if(!ultimo)return Number(usdRate2)||1400;
    return Number(monthlyDollar[ultimo.key])||Number(ultimo.dollar)||Number(usdRate2)||1400;
  },[mesesCostoMensual,monthlyDollar,usdRate2]);

  // Fase 3A: cálculo y filtrado de Costo mensual ejecutados en Web Worker.
  const [costoMensualAcumulado,setCostoMensualAcumulado]=React.useState(()=>costoMensualAcumuladoCacheRef.current||[]);

  // costoMensualAcumulado con filtros MO aislados (para distribuir MO sobre todas las máquinas seleccionadas en MO)
  const [costoMensualAcumuladoMO,setCostoMensualAcumuladoMO]=React.useState(()=>costoMensualAcumuladoMOCacheRef.current||[]);
  const [costoMensualUniversoMO,setCostoMensualUniversoMO]=React.useState(()=>costoMensualAcumuladoMOCacheRef.current||[]);
  const [costoMensualWorkerUpdating,setCostoMensualWorkerUpdating]=React.useState(false);
  const [costoMensualWorkerReady,setCostoMensualWorkerReady]=React.useState(false);
  const costoMensualWorkerInitRef=React.useRef(0);
  const costoMensualWorkerQueryRef=React.useRef(0);
  const costoMensualWorkerSourcesRef=React.useRef(null);
  const costoMensualQueryCacheRef=React.useRef(new Map());

  // Inicializa el motor de Costo mensual en lotes pequeños. La compactación se
  // reparte entre frames para no bloquear la interfaz; luego el Worker conserva
  // las fuentes en memoria y los cambios de filtros sólo envían parámetros.
  React.useEffect(()=>{
    if(!calcCostoMensual){setCostoMensualWorkerUpdating(false);return;}
    const initialized=costoMensualWorkerSourcesRef.current;
    if(initialized?.monthly===rma15CostoMensualPorFecha&&initialized?.labor===rma15PorFecha){
      setCostoMensualWorkerReady(true);
      return;
    }
    const token=++costoMensualWorkerInitRef.current;
    let cancelled=false;
    setCostoMensualWorkerReady(false);
    setCostoMensualWorkerUpdating(true);
    const compact=(source,onDone)=>{
      const out=[];let i=0;
      const step=()=>{
        if(cancelled||token!==costoMensualWorkerInitRef.current)return;
        const end=Math.min(i+300,(source||[]).length);
        for(;i<end;i++){
          const r=source[i]||{};
          out.push({fecha:r.fecha,mes:monthKeyCosto(r.fecha),proyecto:r.proyecto,maquina:r.maquina,costo:Number(r._costoTotalARS)||0,esPrev:!!r._esPreventivo});
        }
        if(i<(source||[]).length)window.setTimeout(step,0);else onDone(out);
      };
      step();
    };
    compact(rma15CostoMensualPorFecha,(dynamicMonthly)=>{
      compact(rma15PorFecha,(dynamicMO)=>{
        if(cancelled||token!==costoMensualWorkerInitRef.current)return;
        const machineKeys=new Set();
        dynamicMonthly.forEach(r=>machineKeys.add(String(r.maquina||"")));
        dynamicMO.forEach(r=>machineKeys.add(String(r.maquina||"")));
        (HIST_COSTO_MENSUAL_ACUMULADO.rows||[]).forEach(r=>machineKeys.add(String(r.equipo||"")));
        const meta={};
        machineKeys.forEach(k=>{const m=metaEquipoCosto(k);meta[k]={display:m.display,props:m.props,propiedad:m.propiedad,tipo:m.tipo,familia:m.familia,lugarAlquiler:m.lugarAlquiler};});
        dmCategoriasCommand("INIT_COST_MONTHLY_ENGINE",{
          historicalRows:HIST_COSTO_MENSUAL_ACUMULADO.rows||[],dynamicMonthly,dynamicMO,meta
        }).then(()=>{
          if(cancelled||token!==costoMensualWorkerInitRef.current)return;
          costoMensualWorkerSourcesRef.current={monthly:rma15CostoMensualPorFecha,labor:rma15PorFecha};
          costoMensualQueryCacheRef.current.clear();
          setCostoMensualWorkerReady(true);
        }).catch(err=>{
          console.error("No se pudo inicializar el motor de Costo mensual",err);
          if(!cancelled)setCostoMensualWorkerUpdating(false);
        });
      });
    });
    return()=>{cancelled=true;};
  },[calcCostoMensual,rma15CostoMensualPorFecha,rma15PorFecha,metaEquipoCosto]);

  React.useEffect(()=>{
    if(!calcCostoMensual||!costoMensualWorkerReady)return;
    const token=++costoMensualWorkerQueryRef.current;
    setCostoMensualWorkerUpdating(true);
    dmCategoriasCommand("QUERY_COST_MONTHLY",{
      months:mesesCostoMensual,fixedMonths:mesesFijosAcumuladoMensual,monthsAccum:mesesAcumulado,
      rates:monthlyDollar,baseRate:Number(usdRate2)||1,hsJM:hsEfJM,hsFS:hsEfFS,subtotalJM,subtotalFS,
      filters:{proyecto:dFProyecto,propiedad:dFCPropiedad,maquina:dFCMaquinas,tipo:dFCTipoEquipo},
      filtersHistorical:{proyecto:dFProyecto,propiedad:dFPropiedad,maquina:dFMaquinas,tipo:dFTipoEquipo},
      filtersMO:{proyecto:dFProyecto,propiedad:dFMOPropiedad,maquina:dFMOMaquinas,tipo:dFMOTipoEquipo}
    }).then(result=>{
      if(token!==costoMensualWorkerQueryRef.current)return;
      const apply=()=>{
        const monthly=result?.monthly||[],monthlyMO=result?.monthlyMO||[],monthlyMOUniverse=result?.monthlyMOUniverse||monthly,acumulado=result?.acumulado||[];
        costoMensualAcumuladoCacheRef.current=monthly;costoMensualAcumuladoMOCacheRef.current=monthlyMO;acumuladoEquiposCacheRef.current=acumulado;
        setCostoMensualAcumulado(monthly);setCostoMensualAcumuladoMO(monthlyMO);setCostoMensualUniversoMO(monthlyMOUniverse);setAcumuladoEquipos(acumulado);
      };
      React.startTransition?React.startTransition(apply):apply();
    }).catch(err=>console.error("No se pudo actualizar Costo mensual en el Worker",err)).finally(()=>{
      if(token===costoMensualWorkerQueryRef.current)setCostoMensualWorkerUpdating(false);
    });
  },[calcCostoMensual,costoMensualWorkerReady,mesesCostoMensual,mesesFijosAcumuladoMensual,mesesAcumulado,monthlyDollar,usdRate2,hsEfJM,hsEfFS,subtotalJM,subtotalFS,dFProyecto,dFCPropiedad,dFCMaquinas,dFCTipoEquipo,dFPropiedad,dFMaquinas,dFTipoEquipo,dFMOPropiedad,dFMOMaquinas,dFMOTipoEquipo]);

  React.useLayoutEffect(()=>{
    if(tab==="t6")restoreCostoMensualScroll();
  },[tab,restoreCostoMensualScroll,costoMensualAcumulado.length,mesesCostoMensual.length,monthlyDollar,usdRate2,hsEfJM,hsEfFS,mecJM,ctaMecJM,mecFS,ctaMecFS,ctaJM,ctaFS,costMec,costCTA,modoFecha,fechaDia,fechaD,fechaH,fMaquinas,fTipoEquipo,fProyecto,fPropiedad,fechaDCostoMensual,fechaHCostoMensual]);

  const costoMensualTotales=React.useMemo(()=>{
    const mk=()=>({prev:0,corr:0,total:0,months:Object.fromEntries((mesesCostoMensual||[]).map(m=>[m.key,{prev:0,corr:0,total:0}]))});
    const out={FS:mk(),JM:mk(),TOTAL:mk()};
    (costoMensualAcumulado||[]).forEach(x=>{
      const sec=out[x.section]||out.FS;
      [sec,out.TOTAL].forEach(t=>{
        t.prev+=x.prev||0;t.corr+=x.corr||0;t.total+=x.total||0;
        (mesesCostoMensual||[]).forEach(m=>{
          const d=x.months[m.key]||{};
          if(!t.months[m.key])t.months[m.key]={prev:0,corr:0,total:0};
          t.months[m.key].prev+=d.prev||0;
          t.months[m.key].corr+=d.corr||0;
          t.months[m.key].total+=d.total||0;
        });
      });
    });
    return out;
  },[costoMensualAcumulado,mesesCostoMensual]);

  const buildRowsCostoMensualExcel=()=>{
    const rows=[];
    (costoMensualAcumulado||[]).forEach(x=>{
      const row={Proyecto:sectionProyectoCosto(x.section),Equipo:x.equipo};
      let sumPrev=0,sumCorr=0,sumTotal=0,cantPrev=0,cantCorr=0,cantTotal=0;
      (mesesCostoMensual||[]).forEach(m=>{
        const d=x.months[m.key]||{};
        const prev=Number(d.prev)||0;
        const corr=Number(d.corr)||0;
        const total=Number(d.total)||0;
        row[`${m.label} Preventivo`]=Math.round(prev);
        row[`${m.label} Correctivo`]=Math.round(corr);
        row[`${m.label} Total`]=Math.round(total);
        if(prev!==0){sumPrev+=prev;cantPrev++;}
        if(corr!==0){sumCorr+=corr;cantCorr++;}
        if(total!==0){sumTotal+=total;cantTotal++;}
      });
      row["Total B"]=Math.round(x.total||0);
      row["Promedio Preventivo"]=cantPrev?Math.round(sumPrev/cantPrev):0;
      row["Promedio Correctivo"]=cantCorr?Math.round(sumCorr/cantCorr):0;
      row["Promedio Total"]=cantTotal?Math.round(sumTotal/cantTotal):0;
      rows.push(row);
    });
    return rows;
  };

  const setDollarMesCostoDraft=(key,val)=>{
    setMonthlyDollarDraft(prev=>({...prev,[key]:val}));
  };

  const commitDollarMesCosto=(key,val)=>{
    const scrollLeft=rememberCostoMensualScroll();
    const n=Number(String(val).replace(",","."));
    if(Number.isFinite(n)&&n>0){
      setMonthlyDollar(prev=>({...prev,[key]:n}));
      setMonthlyDollarDraft(prev=>({...prev,[key]:String(n)}));
      restoreCostoMensualScroll(scrollLeft);
    }else{
      const fallback=String(monthlyDollar[key]||usdRate2||1400);
      setMonthlyDollarDraft(prev=>({...prev,[key]:fallback}));
      restoreCostoMensualScroll(scrollLeft);
    }
  };

  const promedioCostoMensual=(x)=>{
    const meses=mesesCostoMensual||[];
    const acc=meses.reduce((a,m)=>{
      const d=x.months?.[m.key]||{};
      const prev=Number(d.prev)||0;
      const corr=Number(d.corr)||0;
      const total=Number(d.total)||0;
      if(prev!==0){a.prev+=prev;a.nPrev++;}
      if(corr!==0){a.corr+=corr;a.nCorr++;}
      if(total!==0){a.total+=total;a.nTotal++;}
      return a;
    },{prev:0,corr:0,total:0,nPrev:0,nCorr:0,nTotal:0});
    return {
      prev:acc.nPrev?acc.prev/acc.nPrev:0,
      corr:acc.nCorr?acc.corr/acc.nCorr:0,
      total:acc.nTotal?acc.total/acc.nTotal:0,
    };
  };

  const promedioTotalesCostoMensual=(section)=>{
    const meses=mesesCostoMensual||[];
    const src=costoMensualTotales?.[section]?.months||{};
    const acc=meses.reduce((a,m)=>{
      const d=src[m.key]||{};
      const prev=Number(d.prev)||0;
      const corr=Number(d.corr)||0;
      const total=Number(d.total)||0;
      if(prev!==0){a.prev+=prev;a.nPrev++;}
      if(corr!==0){a.corr+=corr;a.nCorr++;}
      if(total!==0){a.total+=total;a.nTotal++;}
      return a;
    },{prev:0,corr:0,total:0,nPrev:0,nCorr:0,nTotal:0});
    return {
      prev:acc.nPrev?acc.prev/acc.nPrev:0,
      corr:acc.nCorr?acc.corr/acc.nCorr:0,
      total:acc.nTotal?acc.total/acc.nTotal:0,
    };
  };

  const getCostoLocalUSDEquipo=React.useCallback((maquina)=>{
    const eq=getEquipoListaMaestra(maquina);
    if(!eq)return 0;
    const keys=Object.keys(eq||{});
    const k=findColumnKey(keys,"Costo local USD",[
      "Costo Local USD",
      "Costo Local USD (s/IVA)",
      "Costo local USD (s/IVA)",
      "Costo local usd",
      "Costo Local",
      "Costo local",
      "Costo USD",
      "Valor USD",
      "Valor local USD",
      "Costo adquisición USD",
      "Costo de adquisición USD"
    ]);
    return toNumber(k?eq[k]:0);
  },[getEquipoListaMaestra]);

  // Tarifa mensual de alquiler (para equipos no propios)
  const getTarifaAlquilerEquipo=React.useCallback((maquina)=>{
    const eq=getEquipoListaMaestra(maquina);
    if(!eq)return 0;
    const keys=Object.keys(eq||{});
    const k=findColumnKey(keys,"Tarifa mensual de alquiler",[
      "TARIFA MENSUAL DE ALQUILER","Tarifa Mensual Alquiler","TARIFA MENSUAL ALQUILER",
      "Tarifa alquiler","TARIFA ALQUILER","Alquiler mensual","ALQUILER MENSUAL",
      "Tarifa mensual","TARIFA MENSUAL","Rental mensual","Monthly rental"
    ]);
    return toNumber(k?eq[k]:0);
  },[getEquipoListaMaestra]);

  // Indica si un equipo es propiedad de DELTA (comparación estricta normalizada).
  const esDelta=React.useCallback((maquina)=>esEquipoPropioDelta(propiedadEquipo(maquina)),[propiedadEquipo]);

  const getCostoAdqAlquilerEquipo=React.useCallback((maquina)=>{
    const costoInfo=getCostoHorarioAmortizacionOAlquiler({
      propiedad:propiedadEquipo(maquina),
      costoAdquisicion:getCostoLocalUSDEquipo(maquina),
      vidaUtil:1,
      tarifaMensual:getTarifaAlquilerEquipo(maquina),
      horasMensuales:1,
    });
    // Esta columna muestra la base económica: adquisición para equipos Delta
    // y tarifa mensual para equipos alquilados. El costo horario se calcula
    // exclusivamente en getCostoHorarioAmortizacionOAlquiler.
    return Number(costoInfo.base)||0;
  },[propiedadEquipo,getCostoLocalUSDEquipo,getTarifaAlquilerEquipo]);

  const getHorasMensualesEquipo=React.useCallback((maquina)=>{
    const eq=getEquipoListaMaestra(maquina);
    if(!eq)return 200;
    const keys=Object.keys(eq||{});
    const k=findColumnKey(keys,"Horas trabajadas por mes",[
      "Horas trab. por mes","HORAS TRAB. POR MES","Horas trabajadas por mes","HORAS TRABAJADAS POR MES",
      "Horas mensuales","HORAS MENSUALES","Hs mensuales","HS MENSUALES","Horas por mes","HORAS POR MES"
    ]);
    const valor=toNumber(k?eq[k]:0);
    return valor>0?valor:200;
  },[getEquipoListaMaestra]);

  const getCostoLocalUSDFromListaRow=React.useCallback((eq)=>{
    const keys=Object.keys(eq||{});
    const k=findColumnKey(keys,"Costo local USD",[
      "Costo Local USD",
      "Costo Local USD (s/IVA)",
      "Costo local USD (s/IVA)",
      "Costo local usd",
      "Costo Local",
      "Costo local",
      "Costo USD",
      "Valor USD",
      "Valor local USD",
      "Costo adquisición USD",
      "Costo de adquisición USD"
    ]);
    return toNumber(k?eq[k]:0);
  },[]);

  const costoAdquisicionPromedioCamionetas=React.useMemo(()=>{
    const valores=(listaEquipos||[])
      .filter(eq=>{
        const familia=String(getValue(eq,["Familia","FAMILIA"])||"").trim().toUpperCase();
        return familia.includes("CAMIONETA");
      })
      .map(eq=>getCostoLocalUSDFromListaRow(eq))
      .filter(v=>Number(v)>0);
    return valores.length?valores.reduce((s,v)=>s+Number(v),0)/valores.length:0;
  },[listaEquipos,getCostoLocalUSDFromListaRow]);

  const totalMantenimientoPromedioPorProyecto=React.useMemo(()=>{
    const out={JM:0,FS:0};
    (costoMensualAcumulado||[]).forEach(x=>{
      const section=x.section==="JM"?"JM":"FS";
      out[section]+=Number(promedioCostoMensual(x).total)||0;
    });
    return out;
  },[costoMensualAcumulado,mesesCostoMensual]);

  // Versión MO (con filtros aislados) de totalMantenimientoPromedioPorProyecto
  const totalMantenimientoPromedioPorProyectoMO=React.useMemo(()=>{
    const out={JM:0,FS:0};
    (costoMensualAcumuladoMO||[]).forEach(x=>{
      const section=x.section==="JM"?"JM":"FS";
      out[section]+=Number(promedioCostoMensual(x).total)||0;
    });
    return out;
  },[costoMensualAcumuladoMO,mesesCostoMensual]);

  const esCamionetaManoObra=React.useCallback((maquina, rowRma15=null)=>{
    // Para las filas CTA no dependemos sólo de Lista Maestra: en RMA15 muchas
    // camionetas vienen por patente/código y no siempre cruzan perfecto contra
    // Código Drusila/Código Viejo. Por eso se consideran todas estas señales:
    // 1) columna EQUIPO de RMA15, 2) tipo/familia de Lista Maestra,
    // 3) códigos visibles típicos de camioneta (CTA, AG, AH).
    const tipoRma=String(rowRma15?.tipoEquipo||rowRma15?.equipo||"").toUpperCase();
    if(tipoRma.includes("CAMIONETA"))return true;

    const meta=metaEquipoCosto(maquina);
    const tipo=String(meta?.tipo||"").toUpperCase();
    const code=String(maquina||"").toUpperCase().replace(/\s+/g,"");
    const display=String(meta?.display||"").toUpperCase().replace(/\s+/g,"");

    if(tipo==="CAMIONETAS"||tipo==="CAMIONETA"||tipo.includes("CAMIONETA"))return true;
    if(/^CTA/.test(code)||/^CTA/.test(display)||/^AG-?[0-9]/.test(code)||/^AH-?[0-9]/.test(code)||/^AG-?[0-9]/.test(display)||/^AH-?[0-9]/.test(display))return true;

    const filas=getEquiposListaMaestraAll(maquina)||[];
    return filas.some(eq=>{
      const familia=String(getValue(eq,["Familia","FAMILIA","Tipo","Tipo de equipo","Tipo Equipo","EQUIPO"])||"").toUpperCase();
      const codDrusila=String(getValue(eq,["Código Drusila","Codigo Drusila"])||"").toUpperCase().replace(/\s+/g,"");
      const codNuevo=String(getValue(eq,["Código Nuevo","Codigo Nuevo","Codigo Interno","Código Interno"])||"").toUpperCase().replace(/\s+/g,"");
      const codViejo=String(getValue(eq,["Código Viejo","Codigo Viejo","Codigo Anterior","Código Anterior"])||"").toUpperCase().replace(/\s+/g,"");
      return familia.includes("CAMIONETA")||/^CTA/.test(codDrusila)||/^CTA/.test(codNuevo)||/^CTA/.test(codViejo)||/^AG-?[0-9]/.test(codDrusila+codNuevo+codViejo)||/^AH-?[0-9]/.test(codDrusila+codNuevo+codViejo);
    });
  },[metaEquipoCosto,getEquiposListaMaestraAll]);

  const ctaStatsManoObra=React.useMemo(()=>{
    const build=(section)=>{
      const cantManual=section==="JM"?Number(ctaJM)||0:Number(ctaFS)||0;
      const byCamioneta=new Map();

      const rateCTA=Number(ultimoDolarCostoMensual)||Number(usdRate2)||1400;

      // Usar RMA15 filtrado sólo por fecha, NO rma15Filtrado completo.
      // Si se usaba rma15Filtrado, al tener Tipo de equipo = Máquinas,
      // Propiedad o Máquina seleccionada, las camionetas quedaban afuera y
      // el mantenimiento de CTA daba vacío.
      (rma15PorFecha||[]).forEach(r=>{
        const proy=String(r.proyecto||"").toUpperCase();
        const sec=(proy.includes("JOSE")||proy.includes("JM"))?"JM":"FS";
        if(sec!==section)return;
        if(!esCamionetaManoObra(r.maquina,r))return;

        const equipo=metaEquipoCosto(r.maquina).display||cleanMachine(r.maquina)||r.maquina;
        if(!byCamioneta.has(equipo))byCamioneta.set(equipo,{total:0,months:new Set()});
        const acc=byCamioneta.get(equipo);
        acc.total+=(Number(r.costoTotal)||0)/rateCTA;
        if(r.fecha)acc.months.add(String(r.fecha).slice(0,7));
      });

      const promedios=[...byCamioneta.values()]
        .map(acc=>{
          const divisor=Math.max(1,acc.months.size||mesesCostoMensual.length||1);
          return Number(acc.total||0)/divisor;
        })
        .filter(v=>Number(v)>0);

      const mantenimientoPromedio=promedios.length
        ? promedios.reduce((s,v)=>s+v,0)/promedios.length
        : 0;

      const cantidadBase=cantManual>0?cantManual:byCamioneta.size;

      return {
        section,
        cantidad:cantidadBase,
        mantenimientoPromedio,
        mantenimientoPeso:mantenimientoPromedio*Math.max(1,cantidadBase||0),
        costoAdquisicionPromedio:costoAdquisicionPromedioCamionetas,
        tieneFila:(cantidadBase>0||mantenimientoPromedio>0||costoAdquisicionPromedioCamionetas>0),
      };
    };
    return {FS:build("FS"),JM:build("JM")};
  },[rma15PorFecha,ctaJM,ctaFS,esCamionetaManoObra,metaEquipoCosto,mesesCostoMensual,costoAdquisicionPromedioCamionetas,ultimoDolarCostoMensual,usdRate2]);

  const totalMantenimientoConCTAPorProyecto=React.useMemo(()=>({
    // El % de mantenimiento se calcula contra la misma columna visible
    // "Mantenimiento (USD)". Para CTA no se usa el peso oculto por cantidad,
    // porque si no una CTA con mantenimiento visible menor podía llevarse más
    // porcentaje que una máquina con mantenimiento visible mayor.
    FS:(Number(totalMantenimientoPromedioPorProyecto.FS)||0)+(Number(ctaStatsManoObra.FS?.mantenimientoPromedio)||0),
    JM:(Number(totalMantenimientoPromedioPorProyecto.JM)||0)+(Number(ctaStatsManoObra.JM?.mantenimientoPromedio)||0),
  }),[totalMantenimientoPromedioPorProyecto,ctaStatsManoObra]);

  // Versión MO de totalMantenimientoConCTAPorProyecto (usa filtros aislados MO)
  const totalMantenimientoConCTAPorProyectoMO=React.useMemo(()=>({
    FS:(Number(totalMantenimientoPromedioPorProyectoMO.FS)||0)+(Number(ctaStatsManoObra.FS?.mantenimientoPromedio)||0),
    JM:(Number(totalMantenimientoPromedioPorProyectoMO.JM)||0)+(Number(ctaStatsManoObra.JM?.mantenimientoPromedio)||0),
  }),[totalMantenimientoPromedioPorProyectoMO,ctaStatsManoObra]);

  // Fase 3B: Mano de Obra se calcula en el Worker persistente.
  // React sólo prepara metadatos livianos por equipo y conserva el último
  // resultado visible mientras llega la actualización.
  const [rowsManoObra,setRowsManoObra]=React.useState([]);
  const [rowsManoObraTotales,setRowsManoObraTotales]=React.useState([]);
  const [rowsManoObraOrdenadas,setRowsManoObraOrdenadas]=React.useState([]);
  const [manoObraWorkerUpdating,setManoObraWorkerUpdating]=React.useState(false);
  const manoObraWorkerReqRef=React.useRef(0);
  const manoObraResultCacheRef=React.useRef(new Map());

  const manoObraEquipmentMeta=React.useMemo(()=>{
    const out={};
    [...(costoMensualUniversoMO||[]),...(costoMensualAcumuladoMO||[])].forEach(x=>{
      const key=String(x.equipo||"");
      if(!key||out[key])return;
      const value={
        propiedad:propiedadEquipo(key),
        costoAdquisicion:getCostoAdqAlquilerEquipo(key)
      };
      out[key]=value;
      out[`${x.section==="JM"?"JM":"FS"}__${canonicalEquivalentMachineCode(key)}`]=value;
    });
    return out;
  },[costoMensualUniversoMO,costoMensualAcumuladoMO,propiedadEquipo,getCostoAdqAlquilerEquipo,canonicalEquivalentMachineCode]);

  const manoObraPayloadSigRef=React.useRef("");
  React.useEffect(()=>{
    if(!needsManoObraCostos||!costoMensualWorkerReady)return;
    const payloadSig=JSON.stringify({
      rows:(costoMensualAcumuladoMO||[]).map(x=>[x.section,x.equipo,Number(x.total||0)]),
      universe:(costoMensualUniversoMO||[]).map(x=>[x.section,x.equipo]),
      months:(mesesCostoMensual||[]).map(x=>x.key||x),subtotalJM,subtotalFS,ctaJM,ctaFS,
      rate:Number(ultimoDolarCostoMensual)||Number(usdRate2)||1,projectFilter:fProyecto,
      sort:costosMantSorts.manoObra||null
    });
    if(manoObraPayloadSigRef.current===payloadSig)return;
    manoObraPayloadSigRef.current=payloadSig;
    const token=++manoObraWorkerReqRef.current;
    const cached=manoObraResultCacheRef.current.get(payloadSig);
    if(cached){
      setRowsManoObra(cached.rows||[]);
      setRowsManoObraTotales(cached.totals||[]);
      setRowsManoObraOrdenadas(cached.sortedRows||cached.rows||[]);
      setManoObraWorkerUpdating(false);
      return;
    }
    setManoObraWorkerUpdating(true);
    let cancelled=false;
    dmCategoriasCommand("PROCESS_MANO_OBRA",{
      monthlyRows:costoMensualAcumuladoMO||[],
      universeRows:costoMensualUniversoMO||[],
      months:mesesCostoMensual||[],
      subtotalJM,subtotalFS,ctaJM,ctaFS,
      rateCTA:Number(ultimoDolarCostoMensual)||Number(usdRate2)||1,
      baseRate:Number(usdRate2)||1,
      costoAdquisicionPromedioCamionetas,
      equipmentMeta:manoObraEquipmentMeta,
      projectLabels:{JM:sectionProyectoCosto("JM"),FS:sectionProyectoCosto("FS")},
      projectFilter:fProyecto,
      sort:costosMantSorts.manoObra||null
    }).then(result=>{
      if(cancelled||token!==manoObraWorkerReqRef.current)return;
      setBoundedCache(manoObraResultCacheRef.current,payloadSig,result||{});
      const apply=()=>{
        setRowsManoObra(result?.rows||[]);
        setRowsManoObraTotales(result?.totals||[]);
        setRowsManoObraOrdenadas(result?.sortedRows||result?.rows||[]);
      };
      React.startTransition?React.startTransition(apply):apply();
    }).catch(err=>console.error("No se pudo calcular Mano de Obra en el Worker",err)).finally(()=>{
      if(!cancelled&&token===manoObraWorkerReqRef.current)setManoObraWorkerUpdating(false);
    });
    return()=>{cancelled=true;};
  },[
    needsManoObraCostos,costoMensualWorkerReady,costoMensualUniversoMO,costoMensualAcumuladoMO,mesesCostoMensual,
    subtotalJM,subtotalFS,ctaJM,ctaFS,ultimoDolarCostoMensual,usdRate2,
    costoAdquisicionPromedioCamionetas,manoObraEquipmentMeta,sectionProyectoCosto,
    fProyecto,costosMantSorts.manoObra
  ]);

  const buildRowsManoObraExcel=()=>[
    ...(rowsManoObra||[]).map(x=>({
      Equipo:x.equipo,
      Propiedad:x.propiedad||"S/D",
      "Mantenimiento (USD)":Math.round(x.mantenimiento||0),
      "Adquisición":Math.round(x.costoAdquisicion||0),
      "Mano de obra":Math.round(x.manoObra||0),
      Total:Math.round(x.total||0),
    })),
    ...(rowsManoObraTotales||[]).map(x=>({
      Equipo:x.equipo,
      Propiedad:x.propiedad||"",
      "Mantenimiento (USD)":Math.round(x.mantenimiento||0),
      "Adquisición":"",
      "Mano de obra":Math.round(x.manoObra||0),
      Total:Math.round(x.total||0),
    })),
  ];

  const monthThemeCosto=(key)=>{
    const n=Number(String(key||"").slice(5,7))||0;
    const themes={
      1:{head:"#1e40af",sub:"#2563eb",soft:"rgba(37,99,235,.07)",line:"rgba(37,99,235,.35)"},
      2:{head:"#b91c1c",sub:"#dc2626",soft:"rgba(220,38,38,.07)",line:"rgba(220,38,38,.35)"},
      3:{head:"#0891b2",sub:"#06b6d4",soft:"rgba(6,182,212,.07)",line:"rgba(6,182,212,.35)"},
      4:{head:"#15803d",sub:"#22c55e",soft:"rgba(34,197,94,.07)",line:"rgba(34,197,94,.35)"},
      5:{head:"#166534",sub:"#16a34a",soft:"rgba(22,163,74,.08)",line:"rgba(22,163,74,.35)"},
      6:{head:"#7c3aed",sub:"#8b5cf6",soft:"rgba(139,92,246,.07)",line:"rgba(139,92,246,.35)"},
      7:{head:"#c2410c",sub:"#f97316",soft:"rgba(249,115,22,.07)",line:"rgba(249,115,22,.35)"},
      8:{head:"#0f766e",sub:"#14b8a6",soft:"rgba(20,184,166,.07)",line:"rgba(20,184,166,.35)"},
      9:{head:"#1e3a8a",sub:"#3b82f6",soft:"rgba(59,130,246,.07)",line:"rgba(59,130,246,.35)"},
      10:{head:"#0e7490",sub:"#06b6d4",soft:"rgba(6,182,212,.07)",line:"rgba(6,182,212,.35)"},
      11:{head:"#166534",sub:"#22c55e",soft:"rgba(34,197,94,.07)",line:"rgba(34,197,94,.35)"},
      12:{head:"#5b21b6",sub:"#7c3aed",soft:"rgba(124,58,237,.07)",line:"rgba(124,58,237,.35)"},
    };
    return themes[n]||{head:"#334155",sub:"#475569",soft:"rgba(71,85,105,.08)",line:"rgba(148,163,184,.35)"};
  };

  const cellMonthStyleCosto=(key,extra={})=>{
    const t=monthThemeCosto(key);
    return {...tdS,background:t.soft,borderBottom:`1px solid ${C.border}20`,borderLeft:`1px solid ${t.line}`,...extra};
  };

  const rowProyectoStyleCosto=(sec)=>({
    padding:"9px 12px",
    textAlign:"center",
    fontWeight:900,
    letterSpacing:".08em",
    fontSize:12,
    color:"#fff",
    background:sec==="JM"?"#0e7490":"#991b1b",
    borderTop:`2px solid ${sec==="JM"?"#06b6d4":"#ef4444"}`,
    borderBottom:`2px solid ${C.border}`
  });

  const rowSubtotalStyleCosto={
    background:"#78350f",
    color:"#fde68a",
    fontWeight:900,
    borderTop:"2px solid rgba(245,158,11,.65)",
    borderBottom:"2px solid rgba(245,158,11,.35)"
  };

  const rowTotalStyleCosto={
    background:"#7f1d1d",
    color:"#fecaca",
    fontWeight:900,
    borderTop:"2px solid rgba(239,68,68,.75)",
    borderBottom:"2px solid rgba(239,68,68,.45)"
  };


  const manoObraPorEquipoCostoMensual=React.useMemo(()=>{
    // Copia EXACTAMENTE el valor visible en la tabla "Mano de Obra".
    // La clave usa el código canónico para que internos viejos y nuevos
    // coincidan (MOT-0024 -> MOT-0047, TOP-0014 -> TOP-0032, etc.).
    const porProyecto=new Map();
    const porEquipo=new Map();
    (rowsManoObra||[]).forEach(r=>{
      if(r?.isCTA)return;
      const proyectoNorm=String(r.proyecto||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
      const section=proyectoNorm.includes("jose")?"JM":"FS";
      const equipo=codigoCanonicoEquipo(r.equipo);
      const valor=Number(r.manoObra)||0;
      if(!equipo||equipo==="—")return;
      // La tabla Mano de Obra ya está consolidada: conservar el valor exacto,
      // sin recalcularlo ni volver a prorratearlo.
      porProyecto.set(section+"__"+equipo,valor);
      porEquipo.set(equipo,valor);
    });
    return {porProyecto,porEquipo};
  },[rowsManoObra,codigoCanonicoEquipo]);

  const getManoObraCostoMensual=React.useCallback((x)=>{
    const section=x?.section==="JM"?"JM":"FS";
    const equipo=codigoCanonicoEquipo(x?.equipo);
    const exacto=manoObraPorEquipoCostoMensual.porProyecto.get(section+"__"+equipo);
    if(exacto!==undefined)return Number(exacto)||0;
    // Respaldo para históricos cuyo proyecto/section venga con otro formato.
    return Number(manoObraPorEquipoCostoMensual.porEquipo.get(equipo))||0;
  },[manoObraPorEquipoCostoMensual,codigoCanonicoEquipo]);

  const getUsdHoraCostoMensual=React.useCallback((x)=>{
    const p=promedioCostoMensual(x);
    const mo=getManoObraCostoMensual(x);
    const hs=x?.section==="JM"?(Number(hsEfJM)||0):(Number(hsEfFS)||0);
    return hs>0?((Number(p.total)||0)+mo)/hs:0;
  },[getManoObraCostoMensual,hsEfJM,hsEfFS,mesesCostoMensual]);

  const getManoObraTotalCostoMensual=React.useCallback((section)=>{
    if(section==="TOTAL")return (costoMensualAcumulado||[]).reduce((sum,x)=>sum+getManoObraCostoMensual(x),0);
    return (costoMensualAcumulado||[])
      .filter(x=>x.section===section)
      .reduce((sum,x)=>sum+getManoObraCostoMensual(x),0);
  },[costoMensualAcumulado,getManoObraCostoMensual]);

  const getUsdHoraTotalCostoMensual=React.useCallback((section)=>{
    const p=promedioTotalesCostoMensual(section);
    const mo=getManoObraTotalCostoMensual(section);
    const hs=section==="JM"?(Number(hsEfJM)||0):(section==="FS"?(Number(hsEfFS)||0):(Number(hsEfJM)||0)+(Number(hsEfFS)||0));
    return hs>0?((Number(p.total)||0)+mo)/hs:0;
  },[promedioTotalesCostoMensual,getManoObraTotalCostoMensual,hsEfJM,hsEfFS]);


  const tipoEquipoListaMaestra=React.useCallback((equipo)=>{
    const eq=getEquipoListaMaestra(equipo);
    const v=getValue(eq||{},["Familia","FAMILIA","Tipo","Tipo de equipo","Tipo Equipo","EQUIPO"]);
    return String(v||getMachineType(equipo)||"S/D").trim().toUpperCase()||"S/D";
  },[getEquipoListaMaestra]);

  // Lee vida util SOLO de lista maestra, sin ningún override
  const getVidaUtilListaMaestra=React.useCallback((equipo)=>{
    const eq=getEquipoListaMaestra(equipo);
    if(!eq)return 8000;
    const keys=Object.keys(eq||{});
    const k=findColumnKey(keys,"Vida Útil hs",[
      "Vida Util hs","Vida Útil hs/km","Vida Util hs/km","Vida útil","Vida Util",
      "Vida útil hs/km","Vida util hs/km","Vida útil horas","Vida util horas"
    ]);
    const v=toNumber(k?eq[k]:0);
    return v>0?v:8000;
  },[getEquipoListaMaestra]);

  // Usa refs para no invalidar los useMemo pesados en cada tecla/checkbox
  const getVidaUtilEquipo=React.useCallback((equipo)=>{
    if(useListaVidaUtilRef.current[equipo]===false){
      const ov=Number(vidaUtilOverrideRef.current[equipo]||0);
      return ov>0?ov:getVidaUtilListaMaestra(equipo);
    }
    return getVidaUtilListaMaestra(equipo);
  },[getVidaUtilListaMaestra]);

  const AMORTIZACION_GRUPOS=React.useMemo(()=>[
    // Orden y agrupación definitiva para Amortización.
    // 1) Primero se respeta la coincidencia exacta de equipos especiales.
    // 2) Después, los equipos nuevos entran por prefijo en el grupo indicado.
    {tipo:"MOTONIVELADORA 1", equipos:["MOT-0014","MOT-0047","MOT-0049","MOT-0051","MOT-0069"], prefixes:["MOT"]},
    {tipo:"MINICARGADORA", equipos:["MCA-0005","MNC-0001","MNC-001"], prefixes:["MCA","MNC"]},
    {tipo:"EXCAVADORA 1", equipos:["EXC-0034"], prefixes:[]},
    {tipo:"EXCAVADORA", equipos:["EXC-0005","EXC-0017","EXC-0048","EXC-0055"], prefixes:["EXC"]},
    {tipo:"CARGADORA 1", equipos:["PCA-0093"], prefixes:[]},
    {tipo:"CARGADORA", equipos:["PCA-0081","PCA-0095","PCA-0017","PCA-0021","PCA-0051","PCA-0070","PCA-0074","PCA-0101"], prefixes:["CFN","PCA"]},
    {tipo:"COMPACTACIÓN", equipos:["ROD-0001","RCP-0016","RPC-0016","RCP-0036","RPC-0036","RPC-0039"], prefixes:["ROD","RCP","RPC"]},
    {tipo:"RETROPALA", equipos:["RTP-0016","RTP-0011","RTP-0024","RTP-0018","RTP-0030"], prefixes:["RTP"]},
    {tipo:"TOPADORA", equipos:["TOP-0032","TOP-0022","TOP-0036","TOP-0048","TOP-0051","TOP-0058"], prefixes:["TOP"]},
  ],[]);

  const normalizarCategoriaTexto=React.useCallback((v)=>String(v||"")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toUpperCase().replace(/\s+/g," ").trim(),[]);

  const claveCategoriaAmortizacion=React.useCallback((equipo)=>{
    const code=codigoCanonicoEquipo(cleanMachine(mainMachineCode(equipo)));
    const eq=getEquipoListaMaestra(code)||{};
    const familia=normalizarCategoriaTexto(getValue(eq,["Familia","FAMILIA","Tipo","Tipo de equipo","Tipo Equipo","EQUIPO"])||getMachineType(code)||"S/D");
    const modelo=normalizarCategoriaTexto(getValue(eq,["Modelo","MODELO","Modelo Tipo","Modelo/Tipo","Marca / Modelo","Marca/Modelo"])||"");
    return modelo?`${familia}|||${modelo}`:"";
  },[codigoCanonicoEquipo,getEquipoListaMaestra,normalizarCategoriaTexto]);

  const categoriasAmortizacionDisponibles=React.useMemo(()=>{
    const base=amortizacionCategoriasLista===null
      ?(AMORTIZACION_GRUPOS||[]).map(g=>normalizarCategoriaTexto(g.tipo)).filter(Boolean)
      :(amortizacionCategoriasLista||[]).map(normalizarCategoriaTexto).filter(Boolean);
    const vals=new Set();
    const ordered=[];
    base.forEach(value=>{if(!vals.has(value)){vals.add(value);ordered.push(value);}});
    Object.values(amortizacionCategorias||{}).forEach(v=>{
      const t=normalizarCategoriaTexto(v);
      if(t&&t!=="SIN CATEGORIA"&&!vals.has(t)){vals.add(t);ordered.push(t);}
    });
    return ordered;
  },[AMORTIZACION_GRUPOS,amortizacionCategorias,amortizacionCategoriasLista,normalizarCategoriaTexto]);
  const categoriasAmortizacionSet=React.useMemo(()=>new Set(categoriasAmortizacionDisponibles),[categoriasAmortizacionDisponibles]);

  const catalogoCategoriasAmortizacion=React.useMemo(()=>{
    const map=new Map();
    const codigoLista=(eq)=>{
      const keys=Object.keys(eq||{});
      const read=(label,aliases=[])=>{const k=findColumnKey(keys,label,aliases);return k?String(eq[k]||"").trim():"";};
      return read("Código Nuevo",["Codigo Nuevo","Código nuevo","Codigo nuevo","Código Actual","Codigo Actual","Código Interno","Codigo Interno","CODIGO N° INTERNO","Interno"])||
        read("Código Drusila",["Codigo Drusila","Código de Drusila","Codigo de Drusila","Cod Drusila","Cod. Drusila","Interno Drusila"])||
        read("Código Viejo",["Codigo Viejo","Código viejo","Codigo viejo","Código Anterior","Codigo Anterior","Cod Viejo","Cod. Viejo"]);
    };
    (listaEquipos||[]).forEach(eq=>{
      const code=codigoCanonicoEquipo(codigoLista(eq));
      if(!code||isInvalidEquipoCodeCosto(code))return;
      const familia=normalizarCategoriaTexto(getValue(eq,["Familia","FAMILIA","Tipo","Tipo de equipo","Tipo Equipo","EQUIPO"])||getMachineType(code)||"S/D");
      const marca=String(getValue(eq,["Marca","MARCA"])||"").trim();
      const modelo=String(getValue(eq,["Modelo","MODELO","Modelo Tipo","Modelo/Tipo","Marca / Modelo","Marca/Modelo"])||"").trim();
      if(!modelo)return;
      const modeloNorm=normalizarCategoriaTexto(modelo);
      const key=`${familia}|||${modeloNorm}`;
      if(!map.has(key))map.set(key,{key,familia,marca,modelo,cantidad:0,equipos:[]});
      const row=map.get(key);row.cantidad+=1;if(row.equipos.length<8)row.equipos.push(code);
    });
    return Array.from(map.values()).sort((a,b)=>a.familia.localeCompare(b.familia,"es")||a.modelo.localeCompare(b.modelo,"es"));
  },[listaEquipos,codigoCanonicoEquipo,isInvalidEquipoCodeCosto,normalizarCategoriaTexto]);

  const amortizacionGrupoInfo=React.useCallback((equipo)=>{
    const code=codigoCanonicoEquipo(cleanMachine(mainMachineCode(equipo)));
    const prefix=String(code||"").split("-")[0];

    // Los equipos de mayor porte se separan por MODELO, independientemente de
    // que hayan cambiado de código interno. De este modo, una equivalencia
    // Código Drusila -> Código Nuevo no puede mezclarlos con el grupo general.
    const eqLista=getEquipoListaMaestra(code)||{};
    const modeloEspecial=String(getValue(eqLista,["Modelo","MODELO","Modelo Tipo","Modelo/Tipo","Marca / Modelo","Marca/Modelo"])||"")
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[\s\-_/]+/g,"");
    const claveCategoria=claveCategoriaAmortizacion(code);
    const categoriaManual=claveCategoria?normalizarCategoriaTexto(amortizacionCategorias?.[claveCategoria]):"";
    if(categoriaManual){
      const gi=AMORTIZACION_GRUPOS.findIndex(g=>normalizarCategoriaTexto(g.tipo)===categoriaManual);
      return {grupo:categoriaManual,grupoIndex:gi>=0?gi:998,orden:0};
    }
    if(modeloEspecial.includes("PC350")){
      const gi=AMORTIZACION_GRUPOS.findIndex(g=>g.tipo==="EXCAVADORA 1");
      return {grupo:"EXCAVADORA 1",grupoIndex:gi>=0?gi:2,orden:0};
    }
    if(modeloEspecial.includes("L120")){
      const gi=AMORTIZACION_GRUPOS.findIndex(g=>g.tipo==="CARGADORA 1");
      return {grupo:"CARGADORA 1",grupoIndex:gi>=0?gi:4,orden:0};
    }

    // 1) Coincidencia exacta: respeta equipos aislados y orden fijo.
    for(let gi=0;gi<AMORTIZACION_GRUPOS.length;gi++){
      const idx=AMORTIZACION_GRUPOS[gi].equipos.findIndex(e=>canonicalEquivalentMachineCode(e)===canonicalEquivalentMachineCode(code));
      if(idx!==-1)return {grupo:AMORTIZACION_GRUPOS[gi].tipo,grupoIndex:gi,orden:idx};
    }

    // 2) Equipos nuevos: entran automáticamente al grupo por prefijo.
    for(let gi=0;gi<AMORTIZACION_GRUPOS.length;gi++){
      const g=AMORTIZACION_GRUPOS[gi];
      if((g.prefixes||[]).includes(prefix)){
        return {grupo:g.tipo,grupoIndex:gi,orden:1000};
      }
    }

    const fallback=tipoEquipoListaMaestra(equipo)||getMachineType(equipo)||"S/D";
    return {grupo:fallback,grupoIndex:999,orden:9999};
  },[AMORTIZACION_GRUPOS,tipoEquipoListaMaestra,getEquipoListaMaestra,codigoCanonicoEquipo,claveCategoriaAmortizacion,amortizacionCategorias,normalizarCategoriaTexto]);

  // Índice liviano para la subpestaña de categorías. Evita recorrer todo el
  // catálogo una vez por cada categoría y otra vez por cada fila renderizada.
  const categoriaEfectivaPorModelo=React.useMemo(()=>{
    const out={};
    (catalogoCategoriasAmortizacion||[]).forEach(r=>{
      const muestra=r.equipos?.[0]||"";
      out[r.key]=normalizarCategoriaTexto(
        amortizacionCategorias[r.key]||amortizacionGrupoInfo(muestra).grupo||r.familia||"SIN CATEGORIA"
      )||"SIN CATEGORIA";
    });
    return out;
  },[catalogoCategoriasAmortizacion,amortizacionCategorias,amortizacionGrupoInfo,normalizarCategoriaTexto]);

  const cantidadModelosPorCategoria=React.useMemo(()=>{
    const out={};
    Object.values(categoriaEfectivaPorModelo||{}).forEach(cat=>{out[cat]=(out[cat]||0)+1;});
    return out;
  },[categoriaEfectivaPorModelo]);


  const commitCategoriaModelo=React.useCallback(async(modelKey,value)=>{
    const v=normalizarCategoriaTexto(value);
    const actual=normalizarCategoriaTexto(amortizacionCategorias?.[modelKey]||categoriaEfectivaPorModelo?.[modelKey]||"");
    if(actual===v)return;
    try{
      const next=await dmCategoriasCommand("SET_MODEL_CATEGORY",{assignments:amortizacionCategorias||{},modelKey,value:v});
      setAmortizacionCategorias(next.assignments||{});
    }catch(err){console.error("No se pudo asignar categoría",err);}
  },[normalizarCategoriaTexto,categoriaEfectivaPorModelo,amortizacionCategorias]);


  const agregarCategoriaAmortizacion=React.useCallback(()=>{
    const nueva=normalizarCategoriaTexto(nuevaCategoriaAmortizacion);
    if(!nueva)return;
    if(categoriasAmortizacionDisponibles.includes(nueva)){
      appAlert(`La categoría "${nueva}" ya existe.`,"Categoría duplicada");
      return;
    }
    setAmortizacionCategoriasLista(prev=>{
      const base=prev===null?(AMORTIZACION_GRUPOS||[]).map(g=>normalizarCategoriaTexto(g.tipo)).filter(Boolean):[...(prev||[])];
      return Array.from(new Set([...base,nueva])).sort((a,b)=>a.localeCompare(b,"es"));
    });
    setNuevaCategoriaAmortizacion("");
  },[nuevaCategoriaAmortizacion,categoriasAmortizacionDisponibles,AMORTIZACION_GRUPOS,normalizarCategoriaTexto]);

  const renombrarCategoriaAmortizacion=React.useCallback(async(categoriaActual)=>{
    const anterior=normalizarCategoriaTexto(categoriaActual);
    const nueva=normalizarCategoriaTexto(categoriaAmortizacionDrafts[anterior]??anterior);
    if(!nueva||nueva===anterior){
      setCategoriaAmortizacionDrafts(prev=>{const next={...prev};delete next[anterior];return next;});
      return;
    }
    if(categoriasAmortizacionDisponibles.includes(nueva)){
      appAlert(`La categoría "${nueva}" ya existe.`,"Categoría duplicada");
      return;
    }
    setAmortizacionCategoriasLista(prev=>{
      const base=prev===null?(AMORTIZACION_GRUPOS||[]).map(g=>normalizarCategoriaTexto(g.tipo)).filter(Boolean):[...(prev||[])];
      return Array.from(new Set(base.map(c=>normalizarCategoriaTexto(c)===anterior?nueva:normalizarCategoriaTexto(c)))).sort((a,b)=>a.localeCompare(b,"es"));
    });
    try{
      const next=await dmCategoriasCommand("RENAME_CATEGORY",{
        assignments:amortizacionCategorias||{},
        effective:categoriaEfectivaPorModelo||{},
        catalog:(catalogoCategoriasAmortizacion||[]).map(r=>({key:r.key,familia:r.familia})),
        oldName:anterior,newName:nueva
      });
      setAmortizacionCategorias(next.assignments||{});
    }catch(err){console.error("No se pudo renombrar categoría",err);return;}
    setCategoriaAmortizacionDrafts(prev=>{const next={...prev};delete next[anterior];return next;});
    setCategoriaAmortizacionReasignacion(prev=>{
      const next={...prev};
      if(next[anterior]!==undefined){next[nueva]=next[anterior];delete next[anterior];}
      Object.keys(next).forEach(k=>{if(normalizarCategoriaTexto(next[k])===anterior)next[k]=nueva;});
      return next;
    });
  },[categoriaAmortizacionDrafts,categoriasAmortizacionDisponibles,AMORTIZACION_GRUPOS,catalogoCategoriasAmortizacion,categoriaEfectivaPorModelo,normalizarCategoriaTexto,amortizacionCategorias]);

  const eliminarCategoriaAmortizacion=React.useCallback(async(categoriaActual)=>{
    const categoria=normalizarCategoriaTexto(categoriaActual);
    const reemplazo=normalizarCategoriaTexto(categoriaAmortizacionReasignacion[categoria]||"");
    const afectados=(catalogoCategoriasAmortizacion||[]).filter(r=>
      normalizarCategoriaTexto(categoriaEfectivaPorModelo[r.key]||r.familia)===categoria
    );
    const mensaje=afectados.length
      ?`La categoría "${categoria}" tiene ${afectados.length} modelo(s) asignado(s). ${reemplazo?`Se reasignarán a "${reemplazo}".`:'Quedarán como "SIN CATEGORIA".'} ¿Continuar?`
      :`¿Eliminar la categoría "${categoria}"?`;
    if(!(await appConfirm(mensaje,"Eliminar categoría")))return;
    setAmortizacionCategoriasLista(prev=>{
      const base=prev===null?(AMORTIZACION_GRUPOS||[]).map(g=>normalizarCategoriaTexto(g.tipo)).filter(Boolean):[...(prev||[])];
      return base.filter(c=>normalizarCategoriaTexto(c)!==categoria);
    });
    setAmortizacionCategorias(prev=>{
      const next={...prev};
      (catalogoCategoriasAmortizacion||[]).forEach(r=>{
        const efectiva=normalizarCategoriaTexto(prev[r.key]||categoriaEfectivaPorModelo[r.key]||r.familia);
        if(efectiva===categoria)next[r.key]=reemplazo||"SIN CATEGORIA";
      });
      Object.keys(next).forEach(k=>{if(normalizarCategoriaTexto(next[k])===categoria)next[k]=reemplazo||"SIN CATEGORIA";});
      return next;
    });
    setCategoriaAmortizacionDrafts(prev=>{const next={...prev};delete next[categoria];return next;});
    setCategoriaAmortizacionReasignacion(prev=>{const next={...prev};delete next[categoria];return next;});
  },[categoriaAmortizacionReasignacion,catalogoCategoriasAmortizacion,amortizacionCategorias,categoriaEfectivaPorModelo,AMORTIZACION_GRUPOS,normalizarCategoriaTexto]);

  const restablecerCategoriasAmortizacion=React.useCallback(async()=>{
    if(!(await appConfirm("Se restaurarán las categorías originales y se eliminarán todas las asignaciones manuales. ¿Continuar?","Restablecer categorías")))return;
    setAmortizacionCategorias({});
    setAmortizacionCategoriasLista(null);
    setCategoriaAmortizacionDrafts({});
    setCategoriaAmortizacionReasignacion({});
  },[]);

  const rowsAmortizacion=React.useMemo(()=>{
    if(!amortizacionCalcActive)return rowsAmortizacionCacheRef.current||[];
    // Colapsar por equipo: si un equipo opera en FS y JM aparece dos veces en
    // costoMensualAcumulado. Sumamos mantUSDhs de todas las secciones y mostramos
    // una sola fila por equipo (adq y vida son propiedades del equipo, no de la sección).
    const byEquipo={};
    (costoMensualAcumulado||[]).forEach(x=>{
      if(!x.equipo)return;
      const equipoCanonico=codigoCanonicoEquipo(x.equipo);
      if(!equipoCanonico||isInvalidEquipoCodeCosto(equipoCanonico))return;
      if(!byEquipo[equipoCanonico]){
        byEquipo[equipoCanonico]={equipo:equipoCanonico,mantUSDhsTotal:0,proyectos:[],sections:[],_fromLista:false};
      }
      byEquipo[equipoCanonico].mantUSDhsTotal+=getUsdHoraCostoMensual(x);
      const p=sectionProyectoCosto(x.section);
      if(p&&!byEquipo[equipoCanonico].proyectos.includes(p))byEquipo[equipoCanonico].proyectos.push(p);
      if(x.section&&!byEquipo[equipoCanonico].sections.includes(x.section))byEquipo[equipoCanonico].sections.push(x.section);
    });

    const base=Object.values(byEquipo).map(e=>{
      const eq=getEquipoListaMaestra(e.equipo);
      const prop=propiedadEquipo(e.equipo);
      const costoAdquisicion=getCostoLocalUSDEquipo(e.equipo);
      const tarifaMensual=getTarifaAlquilerEquipo(e.equipo);
      const horasMensuales=getHorasMensualesEquipo(e.equipo);
      const vidaListaMaestra=getVidaUtilListaMaestra(e.equipo);
      const vida=getVidaUtilEquipo(e.equipo);
      const costoCapital=getCostoHorarioAmortizacionOAlquiler({propiedad:prop,costoAdquisicion,vidaUtil:vida,tarifaMensual,horasMensuales});
      const adq=costoCapital.base;
      const amort=costoCapital.costoHorario;
      const mantUSDhs=e.mantUSDhsTotal;
      const totalUSDhs=amort+mantUSDhs;
      const g=amortizacionGrupoInfo(e.equipo);
      const pctMant=amort>0?mantUSDhs/amort:0;
      return {
        equipo:e.equipo,
        proyecto:e.proyectos.join(" + ")||"—",
        sections:e.sections,
        propiedad:prop,
        tipo:g.grupo,
        modelo:getValue(eq||{},["Modelo","MODELO","Modelo Tipo","Modelo/Tipo","Marca / Modelo","Marca/Modelo"])||"",
        adq,vida,vidaListaMaestra,amort,mantUSDhs,totalUSDhs,
        costoAdquisicion,tarifaMensual,horasMensuales,costoCapitalTipo:costoCapital.tipo,costoCapitalDetalle:costoCapital.detalle,
        pctMant,
        promTipo:0,
        _firstTipo:false,
        _grupoSize:0,
        _grupoIndex:g.grupoIndex,
        _ordenGrupo:g.orden,
      };
    });

    const grupos={};
    base.forEach(x=>{(grupos[x.tipo]=grupos[x.tipo]||[]).push(x);});
    Object.values(grupos).forEach(arr=>{
      const vals=arr.map(x=>Number(x.pctMant)||0).filter(v=>v>0);
      const prom=vals.length?vals.reduce((s,v)=>s+v,0)/vals.length:0;
      arr.sort((a,b)=>a._ordenGrupo-b._ordenGrupo||a.equipo.localeCompare(b.equipo));
      arr.forEach((x,i)=>{x.promTipo=prom;x._firstTipo=i===0;x._grupoSize=i===0?arr.length:0;});
    });

    const out=base.sort((a,b)=>
      a._grupoIndex-b._grupoIndex ||
      normalizarCategoriaTexto(a.tipo).localeCompare(normalizarCategoriaTexto(b.tipo),"es") ||
      a._ordenGrupo-b._ordenGrupo ||
      a.equipo.localeCompare(b.equipo)
    );
    rowsAmortizacionCacheRef.current=out;
    return out;
  },[amortizacionCalcActive,costoMensualAcumulado,listaEquipos,AMORTIZACION_GRUPOS,getEquipoListaMaestra,getCostoAdqAlquilerEquipo,propiedadEquipo,getVidaUtilEquipo,getUsdHoraCostoMensual,amortizacionGrupoInfo,sectionProyectoCosto,isInvalidEquipoCodeCosto,codigoCanonicoEquipo]);

  // Enriquecer con HH Hombre Vestido y lógica no-Delta (depende de estado hombreVestido, hsEf)
  // vidaBase = vida de lista maestra (sin override), para mostrarlo en la celda cuando override=false
  const rowsAmortizacionConHH=React.useMemo(()=>{
    if(!amortizacionCalcActive)return rowsAmortizacionHHCacheRef.current||[];
    const out=(rowsAmortizacion||[]).map(x=>{
      const sections=x.sections||[];
      const tieneJM=sections.includes("JM");
      const tieneFS=sections.includes("FS");
      let hs=0;let cnt=0;
      if(tieneJM){hs+=Number(hsEfJM)||0;cnt++;}
      if(tieneFS){hs+=Number(hsEfFS)||0;cnt++;}
      if(cnt===0){hs=(Number(hsEfJM)||0)+(Number(hsEfFS)||0);cnt=2;}
      const hsPorProyecto=cnt>0?hs/cnt:0;

      const esDeltaEq=esEquipoPropioDelta(x.propiedad);
      // Hs paramétricas por propiedad:
      // - Equipos Delta: Hs Eq. Propios
      // - Equipos no Delta / arrendados: Hs Eq. Arrendados
      // Si el parámetro está vacío o en 0, se usa como respaldo el promedio JM/FS anterior.
      const hsParam=esDeltaEq?(Number(hsPropios)||0):(Number(hsArrendados)||0);
      const hsEf=hsParam>0?hsParam:hsPorProyecto;

      // vidaBase: la vida sin override (de lista maestra). Para Delta es x.vida que viene de getVidaUtilEquipo
      // pero como getVidaUtilEquipo ya usa refs, necesitamos la vida de lista maestra pura para el display
      const vidaBase=x.vida; // vida que viene de rowsAmortizacion (puede ser override via ref)
      // Para equipos arrendados, el divisor del alquiler NO sale de la Lista Maestra.
      // Debe usar el parámetro global “Hs Eq. Arr.” de Horas de referencia.
      // Si ese parámetro no es válido, se conserva el respaldo de 200 h/mes.
      const horasArrendadoReferencia=(Number(hsArrendados)||0)>0?(Number(hsArrendados)||0):200;
      const vidaFinal=esDeltaEq?x.vida:horasArrendadoReferencia;
      const costoCapital=getCostoHorarioAmortizacionOAlquiler({
        propiedad:x.propiedad,costoAdquisicion:x.costoAdquisicion,vidaUtil:vidaFinal,
        tarifaMensual:x.tarifaMensual,horasMensuales:horasArrendadoReferencia
      });
      const amortFinal=costoCapital.costoHorario;

      const hhHombreVestido=hsEf>0?(Number(hombreVestido)||0)/hsEf:0;
      const totalUSDhs=amortFinal+hhHombreVestido+x.mantUSDhs;
      const pctMant=amortFinal>0?x.mantUSDhs/amortFinal:0;
      return {...x,vida:vidaFinal,horasMensuales:esDeltaEq?x.horasMensuales:horasArrendadoReferencia,vidaBase:x.vidaListaMaestra||x.vidaBase||vidaFinal,amort:amortFinal,costoCapitalTipo:costoCapital.tipo,costoCapitalDetalle:costoCapital.detalle,hhHombreVestido,totalUSDhs,pctMant,_esDelta:esDeltaEq,_hsEf:hsEf};
    });
    rowsAmortizacionHHCacheRef.current=out;
    return out;
  },[amortizacionCalcActive,rowsAmortizacion,hombreVestido,hsEfJM,hsEfFS,hsPropios,hsArrendados]);


  const rowsAmortizacionOrdenadas=React.useMemo(()=>{
    if(!amortizacionCalcActive)return rowsAmortizacionOrdCacheRef.current||[];
    // Recalcular promTipo usando el pctMant final (post HH / no-Delta)
    const categoriaKey=(v)=>normalizarCategoriaTexto(v||"S/D")||"S/D";
    const gruposConHH=new Map();
    (rowsAmortizacionConHH||[]).forEach((x,index)=>{
      const key=categoriaKey(x.tipo);
      if(!gruposConHH.has(key))gruposConHH.set(key,{display:String(x.tipo||"S/D").trim()||"S/D",firstIndex:index,rows:[]});
      gruposConHH.get(key).rows.push(x);
    });

    const grupos=[...gruposConHH.values()].map(g=>{
      const vals=g.rows.map(x=>Number(x.pctMant)||0).filter(v=>v>0);
      const prom=vals.length?vals.reduce((s,v)=>s+v,0)/vals.length:0;
      let rows=g.rows.map(x=>({...x,tipo:g.display,promTipo:prom}));
      const sort=costosMantSorts.amortizacion;
      if(sort?.key&&sort.key!=="tipo"){
        rows=sortRowsForTable(rows,sort,{
          equipo:r=>r.equipo,propiedad:r=>r.propiedad,tipo:r=>r.tipo,modelo:r=>r.modelo,adq:r=>r.adq,vida:r=>r.vida,amort:r=>r.amort,hhHombreVestido:r=>r.hhHombreVestido,mantUSDhs:r=>r.mantUSDhs,totalUSDhs:r=>r.totalUSDhs,pctMant:r=>r.pctMant,promTipo:r=>r.promTipo
        });
      }
      return {...g,rows};
    });
    const sort=costosMantSorts.amortizacion;
    if(sort?.key==="tipo"){
      const dir=sort.dir==="desc"?-1:1;
      grupos.sort((a,b)=>dir*a.display.localeCompare(b.display,"es",{sensitivity:"base"}));
    }else grupos.sort((a,b)=>a.firstIndex-b.firstIndex||a.display.localeCompare(b.display,"es",{sensitivity:"base"}));

    const out=[];
    grupos.forEach(g=>g.rows.forEach((x,i)=>out.push({...x,_firstTipoDisplay:i===0,_grupoSizeDisplay:i===0?g.rows.length:0})));
    rowsAmortizacionOrdCacheRef.current=out;
    return out;
  },[amortizacionCalcActive,rowsAmortizacionConHH,costosMantSorts.amortizacion,normalizarCategoriaTexto]);


  const filtrosAmortizacion=getCostosFiltrosTabla("t5");
  // Debounce determinista en lugar de useDeferredValue. Bajo renders largos,
  // useDeferredValue podía dejar filtros de Amortización esperando demasiado tiempo.
  const dFAmortEquipo=useCostoDebouncedValue(filtrosAmortizacion.equipo,220);
  const dFAmortTipo=useCostoDebouncedValue(filtrosAmortizacion.tipo,220);
  const dFAmortPropiedad=useCostoDebouncedValue(filtrosAmortizacion.propiedad,220);
  // Fase 2 del motor: filtrado, recálculo de vida útil, promedios por categoría,
  // ordenamiento y rowSpan se procesan fuera del hilo principal.
  const [rowsAmortizacionOrdenadasFiltradas,setRowsAmortizacionOrdenadasFiltradas]=React.useState(()=>rowsAmortizacionFiltCacheRef.current||[]);
  const [amortizacionWorkerUpdating,setAmortizacionWorkerUpdating]=React.useState(false);
  const [amortizacionWorkerReady,setAmortizacionWorkerReady]=React.useState(false);
  const amortizacionWorkerRequestRef=React.useRef(0);
  const amortizacionWorkerInitRef=React.useRef(0);
  const amortizacionPayloadSigRef=React.useRef("");
  const amortizacionWorkerSourceRef=React.useRef("");
  const amortizacionResultCacheRef=React.useRef(new Map());
  const rowsAmortizacionWorkerPayload=React.useMemo(()=>(rowsAmortizacionConHH||[]).map(x=>({
    ...x,
    metaTipo:metaEquipoCosto(x.equipo).tipo||"",
    metaFamilia:metaEquipoCosto(x.equipo).familia||""
  })),[rowsAmortizacionConHH,metaEquipoCosto]);
  // Identidad semántica de la fuente. Comparar el array por referencia provocaba
  // INIT repetidos cuando React reconstruía derivados equivalentes.
  const amortizacionWorkerSourceKey=React.useMemo(()=>JSON.stringify(rowsAmortizacionWorkerPayload.map(x=>[
    x.equipo,x.tipo,x.propiedad,Number(x.amort)||0,Number(x.mantUSDhs)||0,Number(x.pctMant)||0,
    Number(x.vidaListaMaestra||x.vidaBase||x.vida)||0,x.metaTipo,x.metaFamilia
  ])),[rowsAmortizacionWorkerPayload]);
  React.useEffect(()=>{
    if(!amortizacionCalcActive)return;
    if(amortizacionWorkerSourceRef.current===amortizacionWorkerSourceKey)return;
    const initToken=++amortizacionWorkerInitRef.current;
    // Reservar la versión antes de enviar impide que renders concurrentes manden
    // el mismo INIT mientras la primera promesa todavía está pendiente.
    amortizacionWorkerSourceRef.current=amortizacionWorkerSourceKey;
    setAmortizacionWorkerReady(false);
    dmCategoriasCommand("INIT_AMORTIZATION_ROWS",{rows:rowsAmortizacionWorkerPayload}).then(()=>{
      if(initToken!==amortizacionWorkerInitRef.current)return;
      amortizacionResultCacheRef.current.clear();
      setAmortizacionWorkerReady(true);
    }).catch(err=>{
      if(amortizacionWorkerSourceRef.current===amortizacionWorkerSourceKey)amortizacionWorkerSourceRef.current="";
      console.error("No se pudo inicializar Amortización en el Worker",err);
    });
  },[amortizacionCalcActive,amortizacionWorkerSourceKey,rowsAmortizacionWorkerPayload]);
  React.useEffect(()=>{
    if(!amortizacionCalcActive||!amortizacionWorkerReady)return;
    const payloadSig=JSON.stringify({
      filters:{equipo:dFAmortEquipo,tipo:dFAmortTipo,propiedad:dFAmortPropiedad},
      useListaVidaUtil,vidaUtilOverride,sort:costosMantSorts.amortizacion||null
    });
    if(amortizacionPayloadSigRef.current===payloadSig)return;
    amortizacionPayloadSigRef.current=payloadSig;
    const requestToken=++amortizacionWorkerRequestRef.current;
    const cached=amortizacionResultCacheRef.current.get(payloadSig);
    if(cached){
      rowsAmortizacionFiltCacheRef.current=cached;
      setRowsAmortizacionOrdenadasFiltradas(cached);
      setAmortizacionWorkerUpdating(false);
      return;
    }
    setAmortizacionWorkerUpdating(true);
    let cancelled=false;
    dmCategoriasCommand("QUERY_AMORTIZATION_ROWS",{
      filters:{equipo:dFAmortEquipo,tipo:dFAmortTipo,propiedad:dFAmortPropiedad},
      useListaVidaUtil:useListaVidaUtil||{},
      vidaUtilOverride:vidaUtilOverride||{},
      sort:costosMantSorts.amortizacion||null
    }).then(result=>{
      if(requestToken!==amortizacionWorkerRequestRef.current)return;
      if(cancelled)return;
      const out=Array.isArray(result?.rows)?result.rows:[];
      setBoundedCache(amortizacionResultCacheRef.current,payloadSig,out);
      rowsAmortizacionFiltCacheRef.current=out;
      // Con la tabla virtualizada el commit ya es liviano; actualizar de forma
      // normal evita que React postergue indefinidamente el resultado del filtro.
      setRowsAmortizacionOrdenadasFiltradas(out);
    }).catch(err=>{
      console.error("No se pudo procesar Amortización en el Worker",err);
    }).finally(()=>{
      if(!cancelled&&requestToken===amortizacionWorkerRequestRef.current)setAmortizacionWorkerUpdating(false);
    });
    return()=>{cancelled=true;};
  },[
    amortizacionCalcActive,amortizacionWorkerReady,costosMantSorts.amortizacion,
    dFAmortEquipo,dFAmortTipo,dFAmortPropiedad,
    useListaVidaUtil,vidaUtilOverride
  ]);

  // Diferimos el render de la tabla final y lo montamos en tandas para que al entrar
  // a Amortización no se clave la pantalla armando todas las filas/inputs de una vez.
  const rowsAmortizacionDeferred=React.useDeferredValue?React.useDeferredValue(rowsAmortizacionOrdenadasFiltradas):rowsAmortizacionOrdenadasFiltradas;
  const costosTablasReady=amortizacionCalcActive;

  const buildRowsAmortizacionExcel=()=>(rowsAmortizacionOrdenadasFiltradas||[]).map(x=>({
    Equipo:x.equipo,
    Propiedad:x.propiedad||"S/D",
    Tipo:x.tipo||"S/D",
    Modelo:x.modelo||"",
    "Costo de Adquisición/Alquiler (USD)":Math.round(x.adq||0),
    "Vida Útil (Hs) / Hs Mensuales":Math.round(x.vida||0),
    "Amortización / Alquiler (USD/h)":Number((x.amort||0).toFixed(2)),
    "Cálculo aplicado":x.costoCapitalDetalle||"",
    "HH (Hombre Vestido/hs)":Math.round(x.hhHombreVestido||0),
    "Mant. (USD/hs)":Math.round(x.mantUSDhs||0),
    "Total (USD/hs)":Math.round(x.totalUSDhs||0),
    "% Mant.":x.pctMant>0?(x.pctMant*100).toFixed(2)+"%":"—",
    "Promedio por tipo":x._firstTipoDisplay?(x.promTipo>0?(x.promTipo*100).toFixed(0)+"%":"—"):"",
  }));


  const getModeloFromListaRow=React.useCallback((eq,modeloFallback="")=>{
    const modelo=getValue(eq||{},[
      "Modelo",
      "MODELO",
      "Modelo Tipo",
      "Modelo tipo",
      "Modelo/Tipo",
      "Modelo / Tipo",
      "Marca / Modelo",
      "Marca/Modelo"
    ]);
    return String(modelo||modeloFallback||"").trim();
  },[]);

  const modeloListaEquipo=React.useCallback((equipo,modeloFallback="")=>{
    const code=canonicalEquivalentMachineCode(cleanMachine(mainMachineCode(equipo)));

    // Helper local: getListaVal antes existía sólo dentro de listaEquiposIndex,
    // por eso Informe de Costos quedaba en blanco al calcular este resumen.
    const getListaValLocal=(eq,mainLabel,aliases=[])=>{
      const keys=Object.keys(eq||{});
      const k=findColumnKey(keys,mainLabel,aliases);
      return k?eq[k]:"";
    };

    const matches=[];
    (listaEquipos||[]).forEach((eq,idx)=>{
      const checks=[
        {v:getListaValLocal(eq,"Código Nuevo",["Codigo Nuevo","Código nuevo","Codigo nuevo","Codigo Interno","Código Interno","CODIGO N° INTERNO","Interno","Código Actual","Codigo Actual"]),score:300},
        {v:getListaValLocal(eq,"Código Drusila",["Codigo Drusila","Código de Drusila","Cod Drusila","Cod. Drusila","Interno Drusila"]),score:200},
        {v:getListaValLocal(eq,"Código Viejo",["Codigo Viejo","Código viejo","Codigo viejo","Código Anterior","Codigo Anterior","Cod Viejo","Cod. Viejo","Cod viejo","Cod. viejo","Código Antiguo","Codigo Antiguo","Código Alternativo","Codigo Alternativo"]),score:100},
      ];
      checks.forEach(ch=>{
        if(!ch.v)return;
        if(canonicalEquivalentMachineCode(cleanMachine(ch.v))!==code)return;
        matches.push({eq,score:ch.score,idx});
      });
    });

    matches.sort((a,b)=>b.score-a.score||a.idx-b.idx);
    const eq=matches[0]?.eq||getEquipoListaMaestra(equipo);
    return getModeloFromListaRow(eq,modeloFallback);
  },[listaEquipos,getEquipoListaMaestra,getModeloFromListaRow]);

  const resumenFiltroRows=React.useMemo(()=>{
    // Enriquecemos una sola vez la tabla fuente del resumen. Antes, cada filtro
    // volvía a buscar modelo/tipo contra toda la Lista Maestra y eso hacía que se tilde.
    return (rowsAmortizacionOrdenadas||[]).map(x=>{
      const modeloResumen=modeloListaEquipo(x?.equipo,x?.modelo)||x?.modelo||"";
      const tipoLabel=normalizarCategoriaTexto(x?.tipo)||"";
      if(!tipoLabel||!categoriasAmortizacionSet.has(tipoLabel))return null;
      const tipoValue=tipoLabel;
      const equipoValue=String(x.equipo||"").trim();
      const propiedadValue=String(x.propiedad||"S/D").trim()||"S/D";
      return {
        ...x,
        _resumenModelo:modeloResumen,
        _resumenTipoLabel:tipoLabel,
        _resumenTipoValue:tipoValue,
        _resumenEquipoValue:equipoValue,
        _resumenPropiedadValue:propiedadValue,
      };
    }).filter(Boolean);
  },[rowsAmortizacionOrdenadas,modeloListaEquipo,normalizarCategoriaTexto,categoriasAmortizacionSet]);

  const resumenTipoOptions=React.useMemo(()=>[
    {value:"todos",label:"Todos los tipos"},
    ...(categoriasAmortizacionDisponibles||[]).map(categoria=>({value:categoria,label:categoria}))
  ],[categoriasAmortizacionDisponibles]);

  const resumenEquipoOptions=React.useMemo(()=>{
    const rows=(resumenFiltroRows||[]).filter(x=>matchMulti(x._resumenTipoValue,fResumenTipo)&&matchMulti(x._resumenPropiedadValue,fResumenPropiedad));
    return buildCostEquipmentOptions(rows);
  },[resumenFiltroRows,fResumenTipo,fResumenPropiedad,matchMulti]);

  const resumenPropiedadOptions=propiedadOpts;

  // Fase 3C: filtrado y agrupación de Resumen por equipo fuera del hilo principal.
  // React conserva el último resultado visible mientras el Worker procesa los cambios.
  const [rowsResumenPorEquipo,setRowsResumenPorEquipo]=React.useState([]);
  const [resumenWorkerUpdating,setResumenWorkerUpdating]=React.useState(false);
  const [resumenEquiposConsiderados,setResumenEquiposConsiderados]=React.useState(0);
  const resumenWorkerRequestRef=React.useRef(0);
  const resumenPayloadSigRef=React.useRef("");
  React.useEffect(()=>{
    if(!isCostosTabResumen)return;
    const payloadSig=JSON.stringify({
      rows:(resumenFiltroRows||[]).map(x=>[x.equipo,x._resumenTipoValue,x._resumenPropiedadValue,Number(x.amort||0),Number(x.pctMant||0)]),
      tipo:dFResumenTipo,equipo:dFResumenEquipo,propiedad:dFResumenPropiedad
    });
    if(resumenPayloadSigRef.current===payloadSig)return;
    resumenPayloadSigRef.current=payloadSig;
    const token=++resumenWorkerRequestRef.current;
    setResumenWorkerUpdating(true);
    dmCategoriasCommand("PROCESS_RESUMEN_EQUIPO",{
      rows:resumenFiltroRows||[],
      filters:{tipo:dFResumenTipo,equipo:dFResumenEquipo,propiedad:dFResumenPropiedad}
    }).then(result=>{
      if(token!==resumenWorkerRequestRef.current)return;
      const next=Array.isArray(result?.rows)?result.rows:[];
      React.startTransition(()=>{
        setRowsResumenPorEquipo(next);
        setResumenEquiposConsiderados(Number(result?.filteredCount)||0);
      });
    }).catch(err=>{
      console.error("No se pudo procesar Resumen por equipo en el Worker",err);
    }).finally(()=>{
      if(token===resumenWorkerRequestRef.current)setResumenWorkerUpdating(false);
    });
  },[isCostosTabResumen,resumenFiltroRows,dFResumenTipo,dFResumenEquipo,dFResumenPropiedad]);

  React.useEffect(()=>{
    try{
      localStorage.setItem("dm_costos_resumen_equipos",JSON.stringify((rowsResumenPorEquipo||[]).map(x=>({
        maquina:x.maquina,modelo:x.modelo,costoAmort:Number(x.costoAmort)||0,pctMant:Number(x.pctMant)||0,costoHorario:Number(x.costoHorario)||0,costoTotal:Number(x.costoTotal)||0
      }))));
      localStorage.setItem("dm_costo_hombre_vestido_hora",String(Number(hombreVestido)||0));
    }catch(_){ }
  },[rowsResumenPorEquipo,hombreVestido]);

  const buildRowsResumenPorEquipoExcel=()=>(rowsResumenPorEquipo||[]).map(x=>({
    "Maquina":x.maquina,
    "Modelo Tipo":x.modelo,
    "Costo Horario de Amortización":x.costoAmort>0?"USD "+Math.round(x.costoAmort):"—",
    "% Mantenimiento":x.pctMant>0?(x.pctMant*100).toFixed(0)+"%":"—",
    "Costo Horario":x.costoHorario>0?"USD "+Math.round(x.costoHorario):"—",
    "Costo Total Horario":x.costoTotal>0?"USD "+Math.round(x.costoTotal):"—",
  }));

  const historicalCalcActive=isCostosTabAmortizacionHistorica||isCostosTabResumenHistorico;
  const historicalRowsCacheRef=React.useRef([]);
  const maintenanceUsdRangeIndex=React.useMemo(()=>historicalCalcActive?buildEquipmentRangeIndex(
    rma15,equiposConMantenimiento2026,row=>{
      const month=row._monthKey||String(row.fecha||"").slice(0,7);
      const rate=Number(monthlyDollar[month])||Number(usdRate2)||1;
      return (Number(row._costoTotalARS)||0)/rate;
    }
  ):null,[historicalCalcActive,rma15,equiposConMantenimiento2026,monthlyDollar,usdRate2]);
  const horasHistoricasPorEquipo=React.useMemo(()=>historicalCalcActive?queryEquipmentRangeIndex(
    rop02RangeIndex,fechaHistoricaDesde,fechaHistoricaHasta
  ):new Map(),[historicalCalcActive,rop02RangeIndex,fechaHistoricaDesde,fechaHistoricaHasta]);

  const mantenimientoHistoricoPorEquipo=React.useMemo(()=>historicalCalcActive?queryEquipmentRangeIndex(
    maintenanceUsdRangeIndex,fechaHistoricaDesde,fechaHistoricaHasta
  ):new Map(),[historicalCalcActive,maintenanceUsdRangeIndex,fechaHistoricaDesde,fechaHistoricaHasta]);

  /*
      // `rma15` llega acá sin pasar necesariamente por prepararFilasCosto.
      // Por eso no dependemos de _costoTotalARS: si no existe, sumamos los
      // insumos de la OT directamente. Esto corrige los históricos en “—”.
      const costoARS=Number.isFinite(Number(r._costoTotalARS))
        ? Number(r._costoTotalARS)
        : (r.insumos||[]).reduce((sum,ins)=>sum+(Number(ins?.costoTotal)||0),0);
      current.mantenimiento+=costoARS/rate;
      if(r.proyecto)current.proyecto=r.proyecto;
      map.set(code,current);
    }
    return map;
  */

  const rowsAmortizacionHistoricaBase=React.useMemo(()=>{
    if(!historicalCalcActive)return historicalRowsCacheRef.current;
    const rows=[];
    for(const [code,mantenimiento] of mantenimientoHistoricoPorEquipo){
      const equipo=costDataIndex?.displayByEquipment?.get(code)||code;
      if(!esDelta(equipo))continue;
      const meta=metaEquipoCosto(equipo);
      const groupInfo=amortizacionGrupoInfo(equipo)||{};
      const tipo=groupInfo.grupo||meta.familia||meta.tipo||"S/D";
      const modelo=modeloListaEquipo(equipo)||meta.modelo||"";
      const valor=getCostoLocalUSDEquipo(equipo);
      const vida=getVidaUtilEquipo(equipo);
      const amort=vida>0?valor/vida:0;
      const horas=Number(horasHistoricasPorEquipo.get(code))||0;
      const mantHs=horas>0?mantenimiento/horas:0;
      const pctMant=amort>0?mantHs/amort:0;
      const totalHs=amort+mantHs;
      const maquinaResumen=normalizarCategoriaTexto(groupInfo.grupo)||"";
      if(!maquinaResumen||!categoriasAmortizacionSet.has(maquinaResumen))continue;
      rows.push({
        equipo,tipo,modelo,valor,vida,mantenimiento,horas,mantHs,amort,totalHs,pctMant,
        metaTipo:meta.tipo||"",metaFamilia:meta.familia||"",
        _resumenTipoValue:maquinaResumen,_resumenTipoLabel:maquinaResumen,
        _resumenEquipoValue:equipo,_resumenPropiedadValue:"DELTA",
        maquinaResumen,
        _grupoIndex:Number(groupInfo.grupoIndex??998),
        _ordenGrupo:Number(groupInfo.orden??0)
      });
    }
    const averages=new Map();
    rows.forEach(x=>{
      const a=averages.get(x.tipo)||{sum:0,count:0};
      if(x.pctMant>0){a.sum+=x.pctMant;a.count++;}
      averages.set(x.tipo,a);
    });
    const result=rows.map(x=>({...x,propiedad:"DELTA",promedioEquipo:averages.get(x.tipo)?.count?averages.get(x.tipo).sum/averages.get(x.tipo).count:0}))
      .sort((a,b)=>a._grupoIndex-b._grupoIndex||a._ordenGrupo-b._ordenGrupo||a.tipo.localeCompare(b.tipo,"es")||a.equipo.localeCompare(b.equipo));
    historicalRowsCacheRef.current=result;
    return result;
  },[historicalCalcActive,mantenimientoHistoricoPorEquipo,costDataIndex,esDelta,metaEquipoCosto,amortizacionGrupoInfo,modeloListaEquipo,getCostoLocalUSDEquipo,getVidaUtilEquipo,horasHistoricasPorEquipo,useListaVidaUtil,vidaUtilOverride,normalizarCategoriaTexto,categoriasAmortizacionSet]);

  const filtrosAmortHistorica=getCostosFiltrosTabla("t9");
  const filtrosResumenHistorico=getCostosFiltrosTabla("t10");
  const rowsAmortizacionHistorica=React.useMemo(()=>rowsAmortizacionHistoricaBase.filter(x=>matchesAmortizationTypeFilter(x,filtrosAmortHistorica.tipo)&&(multiIsAll(filtrosAmortHistorica.equipo,"todos")||matchMulti(x.equipo,filtrosAmortHistorica.equipo))),[rowsAmortizacionHistoricaBase,filtrosAmortHistorica,multiIsAll,matchMulti]);
  const rowsResumenHistoricoDetalle=React.useMemo(()=>rowsAmortizacionHistoricaBase.filter(x=>matchMulti(x._resumenTipoValue,filtrosResumenHistorico.tipo)&&matchMulti(x._resumenEquipoValue,filtrosResumenHistorico.equipo)&&matchMulti(x._resumenPropiedadValue,filtrosResumenHistorico.propiedad)),[rowsAmortizacionHistoricaBase,filtrosResumenHistorico,matchMulti]);
  const historicoEquipoOptions=React.useMemo(()=>[{value:"todos",label:"Todas"},...uniq(rowsAmortizacionHistoricaBase.filter(x=>matchesAmortizationTypeFilter(x,filtrosAmortHistorica.tipo)).map(x=>x.equipo)).map(v=>({value:v,label:v}))],[rowsAmortizacionHistoricaBase,filtrosAmortHistorica.tipo,uniq]);
  React.useEffect(()=>{
    const tipoNormalizado=normalizeMultiValue(filtrosAmortHistorica.tipo,tipoEquipoOpts);
    const equipoNormalizado=normalizeMultiValue(filtrosAmortHistorica.equipo,historicoEquipoOptions);
    if(!sameCostoFilterValue(filtrosAmortHistorica.tipo,tipoNormalizado))setCostoFiltroTabla("t9","tipo",tipoNormalizado);
    if(!sameCostoFilterValue(filtrosAmortHistorica.equipo,equipoNormalizado))setCostoFiltroTabla("t9","equipo",equipoNormalizado);
  },[filtrosAmortHistorica.tipo,filtrosAmortHistorica.equipo,tipoEquipoOpts,historicoEquipoOptions,normalizeMultiValue,sameCostoFilterValue,setCostoFiltroTabla]);
  const resumenHistoricoEquipoOptions=React.useMemo(()=>buildCostEquipmentOptions(rowsAmortizacionHistoricaBase.filter(x=>matchMulti(x._resumenTipoValue,filtrosResumenHistorico.tipo)&&matchMulti(x._resumenPropiedadValue,filtrosResumenHistorico.propiedad))),[rowsAmortizacionHistoricaBase,filtrosResumenHistorico.tipo,filtrosResumenHistorico.propiedad,matchMulti]);
  React.useEffect(()=>{
    setFResumenTipo(value=>{const next=normalizeMultiValue(value,resumenTipoOptions);return sameCostoFilterValue(value,next)?value:next;});
    setFResumenEquipo(value=>{const next=normalizeMultiValue(value,resumenEquipoOptions);return sameCostoFilterValue(value,next)?value:next;});
    setFResumenPropiedad(value=>{const next=normalizeMultiValue(value,resumenPropiedadOptions);return sameCostoFilterValue(value,next)?value:next;});
  },[resumenTipoOptions,resumenEquipoOptions,resumenPropiedadOptions,normalizeMultiValue,sameCostoFilterValue]);
  React.useEffect(()=>{
    const tipo=normalizeMultiValue(filtrosResumenHistorico.tipo,resumenTipoOptions);
    const equipo=normalizeMultiValue(filtrosResumenHistorico.equipo,resumenHistoricoEquipoOptions);
    const propiedad=normalizeMultiValue(filtrosResumenHistorico.propiedad,resumenPropiedadOptions);
    if(!sameCostoFilterValue(tipo,filtrosResumenHistorico.tipo))setCostoFiltroTabla("t10","tipo",tipo);
    if(!sameCostoFilterValue(equipo,filtrosResumenHistorico.equipo))setCostoFiltroTabla("t10","equipo",equipo);
    if(!sameCostoFilterValue(propiedad,filtrosResumenHistorico.propiedad))setCostoFiltroTabla("t10","propiedad",propiedad);
  },[filtrosResumenHistorico.tipo,filtrosResumenHistorico.equipo,filtrosResumenHistorico.propiedad,resumenTipoOptions,resumenHistoricoEquipoOptions,resumenPropiedadOptions,normalizeMultiValue,sameCostoFilterValue,setCostoFiltroTabla]);

  const buildRowsAmortizacionHistoricaExcel=()=>rowsAmortizacionHistorica.map(x=>({
    Equipo:x.equipo,
    Propiedad:"DELTA",
    Tipo:x.tipo,
    Modelo:x.modelo,
    "C. Adq. (USD)":Math.round(x.valor),
    "Vida útil (hs)":Math.round(x.vida),
    "Mantenimiento acumulado 2026 (USD)":Math.round(x.mantenimiento),
    "Hs efectivas ROP02 2026":Number(x.horas.toFixed(2)),
    "Costo amortización (USD/h)":Number(x.amort.toFixed(2)),
    "Mant. (USD/h)":x.horas>0?Number(x.mantHs.toFixed(2)):"—",
    "Total (USD/h)":Number(x.totalHs.toFixed(2)),
    "% Mant.":x.pctMant>0?(x.pctMant*100).toFixed(2)+"%":"—",
    "Promedio por tipo":x.promedioEquipo>0?(x.promedioEquipo*100).toFixed(2)+"%":"—"
  }));

  const rowsResumenHistorico=React.useMemo(()=>{
    const groups=new Map();
    rowsResumenHistoricoDetalle.forEach(x=>{
      const label=String(x.maquinaResumen||x.tipo||"S/D").trim()||"S/D";
      const key=cleanKey(label)||label;
      const g=groups.get(key)||{
        maquina:label,
        modelos:new Map(),
        mantenimiento:0,horas:0,
        amorts:[],mantHsVals:[],pctVals:[],
        _grupoIndex:x._grupoIndex,_ordenGrupo:x._ordenGrupo
      };
      g.mantenimiento+=Number(x.mantenimiento)||0;
      g.horas+=Number(x.horas)||0;
      if(x.amort>0)g.amorts.push(x.amort);
      if(x.mantHs>0)g.mantHsVals.push(x.mantHs);
      if(x.pctMant>0)g.pctVals.push(x.pctMant);
      const modelo=String(x.modelo||"—")||"—";
      const mk=cleanKey(modelo)||modelo;
      const modelRec=g.modelos.get(mk)||{modelo,count:0,orden:g.modelos.size};
      modelRec.count++;
      g.modelos.set(mk,modelRec);
      g._grupoIndex=Math.min(Number(g._grupoIndex??998),Number(x._grupoIndex??998));
      g._ordenGrupo=Math.min(Number(g._ordenGrupo??999),Number(x._ordenGrupo??999));
      groups.set(key,g);
    });
    const avg=a=>a.length?a.reduce((sum,v)=>sum+v,0)/a.length:0;
    return [...groups.values()].map(g=>{
      const modelos=[...g.modelos.values()].sort((a,b)=>b.count-a.count||a.orden-b.orden||String(a.modelo).localeCompare(String(b.modelo),"es"));
      const amort=avg(g.amorts);
      const pctMant=avg(g.pctVals);
      const costoHorario=avg(g.mantHsVals);
      return {
        maquina:g.maquina,
        modelo:modelos[0]?.modelo||"—",
        mantenimiento:g.mantenimiento,
        horas:g.horas,
        amort,
        pctMant,
        costoHorario,
        costoTotal:amort>0?amort*(1+pctMant):0,
        _grupoIndex:g._grupoIndex,
        _ordenGrupo:g._ordenGrupo
      };
    }).sort((a,b)=>a._grupoIndex-b._grupoIndex||a._ordenGrupo-b._ordenGrupo||a.maquina.localeCompare(b.maquina,"es"));
  },[rowsResumenHistoricoDetalle,cleanKey]);

  const buildRowsResumenHistoricoExcel=()=>rowsResumenHistorico.map(x=>({
    "Maquina":x.maquina,
    "Modelo Tipo":x.modelo,
    "Mantenimiento acumulado 2026 (USD)":Math.round(x.mantenimiento),
    "Hs efectivas ROP02 2026":Number(x.horas.toFixed(2)),
    "Costo Horario de Amortización":x.amort>0?"USD "+Math.round(x.amort):"—",
    "% Mantenimiento":x.pctMant>0?(x.pctMant*100).toFixed(0)+"%":"—",
    "Costo Horario":x.costoHorario>0?"USD "+Math.round(x.costoHorario):"—",
    "Costo Total Horario":x.costoTotal>0?"USD "+Math.round(x.costoTotal):"—"
  }));

  const amortizacionHistoricaVisibleRows=React.useMemo(()=>buildVisibleCategoryRowSpans(rowsAmortizacionHistorica),[rowsAmortizacionHistorica]);

  const rowsManoObraRender=useProgressiveRows(rowsManoObraOrdenadas,isCostosTabManoObra,80,80);
  // Un rowSpan real necesita que el grupo completo exista en el DOM. Virtualizar
  // por filas cortaba las categorías en ventanas y repetía el cuadro azul al
  // desplazarse. Las filas ya están memoizadas y el cálculo pesado sigue en el
  // Worker, por lo que se renderiza la colección completa y contigua.
  const amortizacionVisibleRows=React.useMemo(()=>buildVisibleCategoryRowSpans(rowsAmortizacionDeferred||[]),[rowsAmortizacionDeferred]);
  const categoriasVirtual=useFixedVirtualRows(catalogoCategoriasAmortizacion,isCostosTabAmortizacion&&amortizacionSubtab==="categorias",48,540,10);
  const resumenVirtual=useFixedVirtualRows(rowsResumenPorEquipo,isCostosTabResumen,46,520,5,18);

  const costoMensualRowsPorSection=React.useCallback((section)=>
    (costoMensualAcumulado||[]).filter(x=>x.section===section),[costoMensualAcumulado]);

  const sumCostoMensualVisible=React.useCallback((section,kind,monthKey=null)=>{
    const rows=section==="TOTAL"?(costoMensualAcumulado||[]):costoMensualRowsPorSection(section);
    return rows.reduce((sum,x)=>{
      if(monthKey){
        const d=x.months?.[monthKey]||{};
        return sum+Math.round(Number(d[kind])||0);
      }
      if(kind==="totalB")return sum+Math.round(Number(x.total)||0);
      if(kind==="mo")return sum+Math.round(Number(getManoObraCostoMensual(x))||0);
      if(kind==="usdHs")return sum+Math.round(Number(getUsdHoraCostoMensual(x))||0);
      const p=promedioCostoMensual(x);
      return sum+Math.round(Number(p[kind])||0);
    },0);
  },[costoMensualAcumulado,costoMensualRowsPorSection,getManoObraCostoMensual,getUsdHoraCostoMensual,mesesCostoMensual]);

  const TablaCostoMensualAcumulado=()=>{
    const mesDesde=fechaDCostoMensual?monthKeyCosto(fechaDCostoMensual):"";
    const mesHasta=hastaCostoMensual?monthKeyCosto(hastaCostoMensual):"";
    // Desde 2026 se siguen mostrando los meses individualmente.
    const mesesCM=(mesesCostoMensual||[]).filter(m=>{
      if(String(m.key||"")<"2026-01")return false;
      if(mesDesde&&m.key<mesDesde)return false;
      if(mesHasta&&m.key>mesHasta)return false;
      return true;
    });
    const rowsCM=(costoMensualAcumulado||[]).map(x=>{
      // Solo se conserva la fila si el interno consolidado tiene al menos un registro en 2026.
      const tieneRegistro2026=Object.entries(x.months||{}).some(([key,d])=>{
        if(!String(key).startsWith("2026-"))return false;
        const prev=Number(d?.prev)||0;
        const corr=Number(d?.corr)||0;
        const total=Number(d?.total)||prev+corr;
        return total>0;
      });
      const months={};
      let prev=0,corr=0,total2026=0;
      mesesCM.forEach(m=>{
        const d=x.months?.[m.key]||{prev:0,corr:0,total:0};
        const p=Number(d.prev)||0;
        const c=Number(d.corr)||0;
        const t=Number(d.total)||p+c;
        months[m.key]={prev:p,corr:c,total:t};
        prev+=p;corr+=c;total2026+=t;
      });
      return {...x,months,prev,corr,total2026,total:total2026,tieneRegistro2026};
    }).filter(x=>x.tieneRegistro2026);
    const mkTot=()=>({prev:0,corr:0,total:0,months:Object.fromEntries((mesesCM||[]).map(m=>[m.key,{prev:0,corr:0,total:0}]))});
    const totalesCM={FS:mkTot(),JM:mkTot(),TOTAL:mkTot()};
    rowsCM.forEach(x=>{
      const sec=totalesCM[x.section]||totalesCM.FS;
      [sec,totalesCM.TOTAL].forEach(t=>{
        t.prev+=x.prev||0;t.corr+=x.corr||0;t.total+=x.total||0;
        mesesCM.forEach(m=>{
          const d=x.months?.[m.key]||{};
          if(!t.months[m.key])t.months[m.key]={prev:0,corr:0,total:0};
          t.months[m.key].prev+=d.prev||0;
          t.months[m.key].corr+=d.corr||0;
          t.months[m.key].total+=d.total||0;
        });
      });
    });
    const promedioCM=(x)=>{
      const acc=mesesCM.reduce((a,m)=>{
        const d=x.months?.[m.key]||{};
        const prev=Number(d.prev)||0,corr=Number(d.corr)||0,total=Number(d.total)||0;
        if(prev!==0){a.prev+=prev;a.nPrev++;}
        if(corr!==0){a.corr+=corr;a.nCorr++;}
        if(total!==0){a.total+=total;a.nTotal++;}
        return a;
      },{prev:0,corr:0,total:0,nPrev:0,nCorr:0,nTotal:0});
      return {prev:acc.nPrev?acc.prev/acc.nPrev:0,corr:acc.nCorr?acc.corr/acc.nCorr:0,total:acc.nTotal?acc.total/acc.nTotal:0};
    };
    const getUsdHoraCM=(x)=>{
      const p=promedioCM(x);
      const mo=getManoObraCostoMensual(x);
      const hs=x?.section==="JM"?(Number(hsEfJM)||0):(Number(hsEfFS)||0);
      return hs>0?((Number(p.total)||0)+mo)/hs:0;
    };
    // Hs efectivas por equipo según propiedad: DELTA = equipos propios, resto = arrendados
    const getHsEfectivasCM=(x)=>{
      const prop=String(propiedadEquipo(x.equipo)||"").trim().toUpperCase();
      return prop.includes("DELTA")?(Number(hsPropios)||0):(Number(hsArrendados)||0);
    };
    // Los subtotales se pedían decenas de veces durante cada render y cada
    // llamada volvía a recorrer todas las filas. Se calculan una sola vez.
    const sumCMCache=React.useMemo(()=>{
      const mk=()=>({totalB:0,mo:0,usdHs:0,hsEf:0,prev:0,corr:0,total:0,months:{}});
      const out={FS:mk(),JM:mk(),TOTAL:mk()};
      (rowsCM||[]).forEach(x=>{
        const targets=[out[x.section]||out.FS,out.TOTAL];
        const p=promedioCM(x);
        const values={
          totalB:Math.round(Number(x.total)||0),
          mo:Math.round(Number(getManoObraCostoMensual(x))||0),
          usdHs:Math.round(Number(getUsdHoraCM(x))||0),
          hsEf:Math.round(Number(getHsEfectivasCM(x))||0),
          prev:Math.round(Number(p.prev)||0),
          corr:Math.round(Number(p.corr)||0),
          total:Math.round(Number(p.total)||0),
        };
        targets.forEach(t=>{
          Object.keys(values).forEach(k=>{t[k]+=values[k];});
          (mesesCM||[]).forEach(m=>{
            const d=x.months?.[m.key]||{};
            if(!t.months[m.key])t.months[m.key]={prev:0,corr:0,total:0};
            t.months[m.key].prev+=Math.round(Number(d.prev)||0);
            t.months[m.key].corr+=Math.round(Number(d.corr)||0);
            t.months[m.key].total+=Math.round(Number(d.total)||0);
          });
        });
      });
      return out;
    },[rowsCM,mesesCM,hsEfJM,hsEfFS,hsPropios,hsArrendados,manoObraPorEquipoCostoMensual,propiedadEquipo]);
    const sumCM=(section,kind,monthKey=null)=>monthKey
      ?(sumCMCache?.[section]?.months?.[monthKey]?.[kind]||0)
      :(sumCMCache?.[section]?.[kind]||0);
    const sections=[{id:"FS",label:"FILO DEL SOL"},{id:"JM",label:"JOSE MARIA"}].filter(sec=>
      rowsCM.some(x=>x.section===sec.id)
    );

    const buildRowsExcelCM=()=>{
      // Formato especial para el Excel de Costo mensual acumulado 2026.
      const mesesDesdeEnero=mesesCM;
      const round=v=>Math.round(Number(v)||0);
      const emptyRow=()=>[];
      const rowLen=2+(mesesDesdeEnero.length*3)+1+3+3;

      const head1=["Equipo","Propiedad"];
      mesesDesdeEnero.forEach(m=>head1.push(m.label,"",""));
      head1.push("Total B","Promedio","","","MO","Hs Efectivas","USD/Hs");

      const head2=["",""];
      mesesDesdeEnero.forEach(()=>head2.push("Preventivo","Correctivo","Total"));
      head2.push("","Preventivo","Correctivo","Total","","","");

      const out=[head1,head2];

      const pushSectionTitle=(label)=>{
        const row=emptyRow();
        row[0]=label;
        out.push(row);
      };

      const pushEquipo=(x)=>{
        const row=[x.equipo,propiedadEquipo(x.equipo)||"S/D"];
        mesesDesdeEnero.forEach(m=>{
          const d=x.months?.[m.key]||{};
          row.push(round(d.prev),round(d.corr),round(d.total));
        });
        const p=promedioCM(x);
        row.push(
          round(x.total||0),
          round(p.prev||0),
          round(p.corr||0),
          round(p.total||0),
          round(getManoObraCostoMensual(x)||0),
          round(getHsEfectivasCM(x)||0),
          round(getUsdHoraCM(x)||0)
        );
        while(row.length<rowLen)row.push("");
        out.push(row);
      };

      const pushSubtotal=(sectionId,label)=>{
        const row=[label,""];
        mesesDesdeEnero.forEach(m=>{
          row.push(round(sumCM(sectionId,"prev",m.key)),round(sumCM(sectionId,"corr",m.key)),round(sumCM(sectionId,"total",m.key)));
        });
        row.push(
          round(sumCM(sectionId,"totalB")),
          round(sumCM(sectionId,"prev")),
          round(sumCM(sectionId,"corr")),
          round(sumCM(sectionId,"total")),
          round(sumCM(sectionId,"mo")),
          round(sumCM(sectionId,"hsEf")),
          round(sumCM(sectionId,"usdHs"))
        );
        while(row.length<rowLen)row.push("");
        out.push(row);
      };

      sections.forEach(sec=>{
        pushSectionTitle(sec.label);
        rowsCM.filter(x=>x.section===sec.id).forEach(pushEquipo);
        pushSubtotal(sec.id,`Subtotal ${sec.id}`);
      });
      pushSubtotal("TOTAL","TOTAL");
      return out;
    };

    const costoMensualGetters={
      equipo:x=>x.equipo,
      totalB:x=>x.total,
      promPrev:x=>promedioCM(x).prev,
      promCorr:x=>promedioCM(x).corr,
      promTotal:x=>promedioCM(x).total,
      mo:x=>getManoObraCostoMensual(x),
      hsEf:x=>getHsEfectivasCM(x),
      usdHs:x=>getUsdHoraCM(x),
    };
    (mesesCM||[]).forEach(m=>{
      costoMensualGetters[`${m.key}_prev`]=x=>x.months?.[m.key]?.prev||0;
      costoMensualGetters[`${m.key}_corr`]=x=>x.months?.[m.key]?.corr||0;
      costoMensualGetters[`${m.key}_total`]=x=>x.months?.[m.key]?.total||0;
    });
    const costoMensualRowsPorSeccion=React.useMemo(()=>({
      FS:sortRowsForTable((rowsCM||[]).filter(x=>x.section==="FS"),costosMantSorts.costoMensual,costoMensualGetters),
      JM:sortRowsForTable((rowsCM||[]).filter(x=>x.section==="JM"),costosMantSorts.costoMensual,costoMensualGetters),
    }),[rowsCM,costosMantSorts.costoMensual,mesesCM]);
    const costoMensualRowsFSRender=useProgressiveRows(costoMensualRowsPorSeccion.FS,isCostosTabAcumulado,45,45);
    const costoMensualRowsJMRender=useProgressiveRows(costoMensualRowsPorSeccion.JM,isCostosTabAcumulado,45,45);
    const costoMensualRowsOrdenadas=(section)=>section==="JM"?costoMensualRowsJMRender:costoMensualRowsFSRender;

    const DollarMesInput=({m})=>{
      const initial=String(monthlyDollar[m.key]??m.dollar??usdRate2??1400);
      const commit=(el)=>commitDollarMesCosto(m.key,el.value);
      return <input type="text" inputMode="decimal" defaultValue={initial}
        onBlur={e=>commit(e.currentTarget)}
        onKeyDown={e=>{if(e.key==="Enter"){commit(e.currentTarget);e.currentTarget.blur();}}}
        style={{...inp,width:86,minWidth:86,maxWidth:86,textAlign:"center",padding:"3px 6px",background:"rgba(0,0,0,.18)",color:"#fff",border:"1px solid rgba(255,255,255,.32)",boxShadow:"inset 0 1px 0 rgba(255,255,255,.12)"}}/>;
    };

    return(
      <Card
        title={`Costo mensual acumulado (Todos los proyectos) (${rowsCM.length} equipos)`}
        action={<BotonDescargar onClick={()=>descargarExcel("Costo_mensual_acumulado",buildRowsExcelCM())}/>}
      >
        {renderCostosQuickFilters("t6",true)}
        <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",padding:"10px 14px",borderBottom:`1px solid ${C.border}33`,background:"rgba(20,30,20,0.6)"}}>
          <span style={{fontSize:12,fontWeight:800,color:C.green}}>Filtros Costo mensual</span>
          <DateIn label="Desde" value={fechaDCostoMensual} onChange={setFechaDCostoMensual} max={hastaCostoMensual||undefined}/>
          <DateIn label="Hasta" value={hastaCostoMensual} onChange={()=>{}} min={fechaDCostoMensual||undefined} disabled warn={hastaCostoMensual&&fechaDCostoMensual&&hastaCostoMensual<fechaDCostoMensual?"≥ Desde":null}/>
          <button onClick={()=>{setFechaDCostoMensual("");}}
            style={{background:"none",border:`1px solid ${C.border}`,borderRadius:7,color:C.textSub,padding:"7px 10px",fontSize:12,cursor:"pointer"}}>Limpiar</button>
          <span style={{marginLeft:"auto",fontSize:11,color:C.textMuted}}>Meses: <b style={{color:C.text}}>{mesesCM.length}</b></span>
        </div>
        <div ref={costoMensualScrollRef} onScroll={rememberCostoMensualScroll} style={{overflowX:"auto",overflowY:"scroll",maxHeight:620,scrollbarGutter:"stable",borderTop:`1px solid ${C.border}`}}>
          <table style={{borderCollapse:"separate",borderSpacing:0,fontSize:12,minWidth:Math.max(1370,300+(mesesCM.length*270)+120+270+220),width:"max-content",tableLayout:"fixed"}}>
            <thead>
              <tr>
                <th style={{...thL,position:"sticky",left:0,top:0,zIndex:8,minWidth:170,background:"#111827",color:"#fff",boxShadow:`2px 0 0 ${C.border}`}}>Equipo</th>
                {mesesCM.map(m=>{
                  const t=monthThemeCosto(m.key);
                  return(
                  <th key={m.key+"usd"} colSpan={3} style={{...thS,textAlign:"center",background:t.head,color:"#fff",top:0,position:"sticky",zIndex:6,borderLeft:`1px solid ${t.line}`}}>
                    <DollarMesInput m={m}/>
                  </th>
                  );
                })}
                <th style={{...thS,position:"sticky",top:0,zIndex:6,minWidth:110,background:"#166534",color:"#fff"}}>Total B</th>
                <th colSpan={3} style={{...thS,textAlign:"center",background:"#7c2d12",color:"#fff",top:0,position:"sticky",zIndex:6}}>Promedio</th>
                <th colSpan={3} style={{...thS,textAlign:"center",background:"#312e81",color:"#fff",top:0,position:"sticky",zIndex:6}}>Mano de obra</th>
              </tr>
              <tr>
                <SortableTH sortId="costoMensual" sortKey="equipo" sorts={costosMantSorts} setSorts={setCostosMantSorts} style={{...thL,position:"sticky",left:0,top:31,zIndex:8,background:"#2563eb",color:"#fff",boxShadow:`2px 0 0 ${C.border}`}}>Equipo</SortableTH>
                {mesesCM.map(m=>{
                  const t=monthThemeCosto(m.key);
                  return <th key={m.key+"label"} colSpan={3} style={{...thS,textAlign:"center",background:t.sub,color:"#fff",top:31,position:"sticky",zIndex:6,borderLeft:`1px solid ${t.line}`,fontWeight:900}}>{m.label}</th>;
                })}
                <th style={{...thS,top:31,position:"sticky",zIndex:6,background:"#15803d",color:"#fff"}}>Total B</th>
                <th colSpan={3} style={{...thS,textAlign:"center",background:"#9a3412",color:"#fff",top:31,position:"sticky",zIndex:6}}>PROMEDIO</th>
                <th colSpan={3} style={{...thS,textAlign:"center",background:"#3730a3",color:"#fff",top:31,position:"sticky",zIndex:6}}>MANO DE OBRA</th>
              </tr>
              <tr>
                <th style={{...thL,position:"sticky",left:0,top:62,zIndex:8,background:"#111827",color:"#fff",boxShadow:`2px 0 0 ${C.border}`}}> </th>
                {mesesCM.map(m=>{
                  const t=monthThemeCosto(m.key);
                  return(
                  <React.Fragment key={m.key+"heads"}>
                    <SortableTH sortId="costoMensual" sortKey={`${m.key}_prev`} sorts={costosMantSorts} setSorts={setCostosMantSorts} style={{...thS,top:62,position:"sticky",zIndex:6,background:t.head,color:"#e5e7eb",borderLeft:`1px solid ${t.line}`}}>Preventivo</SortableTH>
                    <SortableTH sortId="costoMensual" sortKey={`${m.key}_corr`} sorts={costosMantSorts} setSorts={setCostosMantSorts} style={{...thS,top:62,position:"sticky",zIndex:6,background:t.head,color:"#e5e7eb"}}>Correctivo</SortableTH>
                    <SortableTH sortId="costoMensual" sortKey={`${m.key}_total`} sorts={costosMantSorts} setSorts={setCostosMantSorts} style={{...thS,top:62,position:"sticky",zIndex:6,background:t.head,color:"#fff",fontWeight:900}}>Total</SortableTH>
                  </React.Fragment>
                  );
                })}
                <SortableTH sortId="costoMensual" sortKey="totalB" sorts={costosMantSorts} setSorts={setCostosMantSorts} style={{...thS,top:62,position:"sticky",zIndex:6,background:"#052e16",color:"#bbf7d0"}}>Total</SortableTH>
                <SortableTH sortId="costoMensual" sortKey="promPrev" sorts={costosMantSorts} setSorts={setCostosMantSorts} style={{...thS,top:62,position:"sticky",zIndex:6,background:"#431407",color:"#fed7aa"}}>Preventivo</SortableTH>
                <SortableTH sortId="costoMensual" sortKey="promCorr" sorts={costosMantSorts} setSorts={setCostosMantSorts} style={{...thS,top:62,position:"sticky",zIndex:6,background:"#431407",color:"#fed7aa"}}>Correctivo</SortableTH>
                <SortableTH sortId="costoMensual" sortKey="promTotal" sorts={costosMantSorts} setSorts={setCostosMantSorts} style={{...thS,top:62,position:"sticky",zIndex:6,background:"#431407",color:"#fed7aa"}}>Total</SortableTH>
                <SortableTH sortId="costoMensual" sortKey="mo" sorts={costosMantSorts} setSorts={setCostosMantSorts} style={{...thS,top:62,position:"sticky",zIndex:6,background:"#1e1b4b",color:"#c4b5fd"}}>Mano de Obra</SortableTH>
                <SortableTH sortId="costoMensual" sortKey="hsEf" sorts={costosMantSorts} setSorts={setCostosMantSorts} style={{...thS,top:62,position:"sticky",zIndex:6,background:"#1e1b4b",color:"#c4b5fd"}}>Hs efectivas</SortableTH>
                <SortableTH sortId="costoMensual" sortKey="usdHs" sorts={costosMantSorts} setSorts={setCostosMantSorts} style={{...thS,top:62,position:"sticky",zIndex:6,background:"#1e1b4b",color:"#c4b5fd"}}>USD/hora</SortableTH>
              </tr>
            </thead>
            <tbody>
              {sections.map(sec=>(
                <React.Fragment key={sec.id}>
                  <tr><td colSpan={4+mesesCM.length*3+4} style={rowProyectoStyleCosto(sec.id)}>{sec.label}</td></tr>
                  {costoMensualRowsOrdenadas(sec.id).map((x,i)=>(
                    <tr key={sec.id+"__"+x.equipo} style={{background:i%2===0?"rgba(255,255,255,0.055)":"rgba(255,255,255,0.10)"}}>
                      <td style={{...tdL,position:"sticky",left:0,zIndex:2,background:i%2===0?C.card:C.surface}}>{x.equipo}</td>
                      {mesesCM.map(m=>{
                        const d=x.months[m.key]||{};
                        return(
                          <React.Fragment key={x.equipo+m.key}>
                            <td style={cellMonthStyleCosto(m.key)}>{fmtU(d.prev||0)}</td>
                            <td style={cellMonthStyleCosto(m.key)}>{fmtU(d.corr||0)}</td>
                            <td style={cellMonthStyleCosto(m.key,{fontWeight:800,color:"#fff"})}>{fmtU(d.total||0)}</td>
                          </React.Fragment>
                        );
                      })}
                      <td style={{...tdS,color:C.yellow,fontWeight:800}}>{fmtU(x.total||0)}</td>
                      {(()=>{const p=promedioCM(x);return(
                        <>
                          <td style={{...tdS,background:C.yellow+"10"}}>{fmtU(p.prev||0)}</td>
                          <td style={{...tdS,background:C.yellow+"10"}}>{fmtU(p.corr||0)}</td>
                          <td style={{...tdS,background:C.yellow+"10",fontWeight:800}}>{fmtU(p.total||0)}</td>
                        </>
                      )})()}
                      <td style={{...tdS,background:C.purple+"12",color:C.purple,fontWeight:800}}>{fmtU(getManoObraCostoMensual(x))}</td>
                      <td style={{...tdS,background:C.purple+"12",color:C.teal,fontWeight:800}}>{getHsEfectivasCM(x)>0?fmtNum(Math.round(getHsEfectivasCM(x))):"—"}</td>
                      <td style={{...tdS,background:C.purple+"12",color:"#ddd",fontWeight:800}}>{fmtU(getUsdHoraCM(x))}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{...tdL,position:"sticky",left:0,zIndex:2,...rowSubtotalStyleCosto}}>Subtotal {sec.id}</td>
                    {mesesCM.map(m=>{
                      const d=totalesCM[sec.id]?.months?.[m.key]||{};
                      return(
                        <React.Fragment key={sec.id+m.key+"sub"}>
                          <td style={{...tdT,...rowSubtotalStyleCosto}}>{fmtU(sumCM(sec.id,"prev",m.key))}</td>
                          <td style={{...tdT,...rowSubtotalStyleCosto}}>{fmtU(sumCM(sec.id,"corr",m.key))}</td>
                          <td style={{...tdT,...rowSubtotalStyleCosto,color:"#fff"}}>{fmtU(sumCM(sec.id,"total",m.key))}</td>
                        </React.Fragment>
                      );
                    })}
                    <td style={{...tdT,...rowSubtotalStyleCosto,color:"#fff"}}>{fmtU(sumCM(sec.id,"totalB"))}</td>
                    <td style={{...tdT,...rowSubtotalStyleCosto,background:"#92400e"}}>{fmtU(sumCM(sec.id,"prev"))}</td>
                    <td style={{...tdT,...rowSubtotalStyleCosto,background:"#92400e"}}>{fmtU(sumCM(sec.id,"corr"))}</td>
                    <td style={{...tdT,...rowSubtotalStyleCosto,background:"#92400e",color:"#fff"}}>{fmtU(sumCM(sec.id,"total"))}</td>
                    <td style={{...tdT,...rowSubtotalStyleCosto,background:"#4c1d95",color:"#fff"}}>{fmtU(sumCM(sec.id,"mo"))}</td>
                    <td style={{...tdT,...rowSubtotalStyleCosto,background:"#4c1d95",color:"#fff"}}>{fmtNum(sumCM(sec.id,"hsEf"))}</td>
                    <td style={{...tdT,...rowSubtotalStyleCosto,background:"#4c1d95",color:"#fff"}}>{fmtU(sumCM(sec.id,"usdHs"))}</td>
                  </tr>
                </React.Fragment>
              ))}
              <tr>
                <td style={{...tdL,position:"sticky",left:0,zIndex:2,...rowTotalStyleCosto,color:"#fff"}}>TOTAL</td>
                {mesesCM.map(m=>{
                  const d=totalesCM.TOTAL?.months?.[m.key]||{};
                  return(
                    <React.Fragment key={m.key+"total"}>
                      <td style={{...tdT,...rowTotalStyleCosto}}>{fmtU(sumCM("TOTAL","prev",m.key))}</td>
                      <td style={{...tdT,...rowTotalStyleCosto}}>{fmtU(sumCM("TOTAL","corr",m.key))}</td>
                      <td style={{...tdT,...rowTotalStyleCosto,color:"#fff"}}>{fmtU(sumCM("TOTAL","total",m.key))}</td>
                    </React.Fragment>
                  );
                })}
                <td style={{...tdT,...rowTotalStyleCosto,color:"#fff"}}>{fmtU(sumCM("TOTAL","totalB"))}</td>
                <td style={{...tdT,...rowTotalStyleCosto,background:"#991b1b"}}>{fmtU(sumCM("TOTAL","prev"))}</td>
                <td style={{...tdT,...rowTotalStyleCosto,background:"#991b1b"}}>{fmtU(sumCM("TOTAL","corr"))}</td>
                <td style={{...tdT,...rowTotalStyleCosto,background:"#991b1b",color:"#fff"}}>{fmtU(sumCM("TOTAL","total"))}</td>
                <td style={{...tdT,...rowTotalStyleCosto,background:"#581c87",color:"#fff"}}>{fmtU(sumCM("TOTAL","mo"))}</td>
                <td style={{...tdT,...rowTotalStyleCosto,background:"#581c87",color:"#fff"}}>{fmtNum(sumCM("TOTAL","hsEf"))}</td>
                <td style={{...tdT,...rowTotalStyleCosto,background:"#581c87",color:"#fff"}}>{fmtU(sumCM("TOTAL","usdHs"))}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{padding:"8px 14px",fontSize:11,color:C.textMuted,borderTop:`1px solid ${C.border}22`}}>
          Solo se muestran equipos con mantenimiento en 2026. El informe comienza el 01/01/2026 y no utiliza acumulados anteriores.
        </div>
      </Card>
    );
  };

  const BotonDescargar=({onClick})=><button onClick={onClick} style={excelBtnStyle}>Descargar Excel</button>;

  const TablaCostos=({datos,tot,titulo,filename})=>{
    const datosOrdenados=React.useMemo(()=>sortRowsForTable(datos,costosMantSorts.tablaCostos,{
      equipo:r=>r.equipo,propiedad:r=>r.propiedad,prev:r=>r.prev,corr:r=>r.corr,total:r=>r.total
    }),[datos,costosMantSorts.tablaCostos]);
    const datosRender=useProgressiveRows(datosOrdenados,true,80,80);
    const resumen=React.useMemo(()=>totalesPorPropiedadTabla(datos),[datos]);
    const RowTotalTabla=({label,total,accent})=>(
      <tr>
        <td style={{...tdL,background:C.surface+"55",color:C.text}}>{label}</td>
        <td style={{...tdS,background:C.surface+"55",color:C.textSub}}></td>
        <td style={tdT}>{fmtCostoTablaUSD(total.prev)}</td>
        <td style={tdT}>{fmtCostoTablaUSD(total.corr)}</td>
        <td style={{...tdT,color:accent||C.accent}}>{fmtCostoTablaUSD(total.total)}</td>
      </tr>
    );
    return(
    <Card title={titulo} action={<BotonDescargar onClick={()=>descargarExcel(filename,rowsTablaCostosExcel(datos,tot))}/>}>
      {renderCostosQuickFilters("t1",true)}
      <div className="dm-table-scroll" style={{overflowX:"auto",overflowY:"auto",maxHeight:520,scrollbarGutter:"stable"}}> 
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr>
            {sortableCostHead("tablaCostos","equipo","Equipo",thL)}
            {sortableCostHead("tablaCostos","propiedad","Propiedad",thS)}
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
    return (
      <div style={{display:"flex",gap:10,alignItems:"end",flexWrap:"wrap",padding:"10px 14px",borderBottom:`1px solid ${C.border}33`,background:compact?"rgba(0,0,0,.18)":"rgba(0,0,0,.14)"}}>
        <MultiSel label="Tipo máquina" value={filtros.tipo} onChange={v=>setCostoFiltroTabla(tableKey,"tipo",v)} options={tipoOptions} commitOnClose commitDelay={180}/>
        <MultiSel label="Equipo" value={filtros.equipo} onChange={v=>setCostoFiltroTabla(tableKey,"equipo",v)} options={equipoOptions} commitOnClose commitDelay={180}/>
        {config.showProperty!==false&&<MultiSel label="Propiedad" value={filtros.propiedad} onChange={v=>setCostoFiltroTabla(tableKey,"propiedad",v)} options={propiedadOptions} commitOnClose commitDelay={180}/>}
        {config.extra||null}
        <button onClick={()=>resetCostoFiltroTabla(tableKey)} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:7,color:C.textSub,padding:"7px 10px",fontSize:12,cursor:"pointer",height:33}}>Limpiar filtros</button>
        {config.counter!=null&&<span style={{marginLeft:"auto",fontSize:11,color:C.textMuted,paddingBottom:8}}>Equipos considerados: <b style={{color:C.text}}>{config.counter}</b></span>}
        {config.note&&<span style={{marginLeft:"auto",fontSize:11,color:C.textMuted,paddingBottom:8}}>{config.note}</span>}
      </div>
    );
  },[getCostosFiltrosTabla,setCostoFiltroTabla,resetCostoFiltroTabla,tipoEquipoOpts,maquinaOpts,propiedadOpts]);

  React.useEffect(()=>{
    diagEvent("Filtros actualizados",{tab,fechaD,fechaH,proyecto:fProyecto,insumos:fInsumos,tipo:fTipoEquipo,maquinas:fMaquinas,propiedad:fPropiedad});
  },[tab,fechaD,fechaH,fProyecto,fInsumos,fTipoEquipo,fMaquinas,fPropiedad]);

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
      {/* Filtros de fecha */}
      <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"nowrap",overflowX:"auto",padding:"10px 14px",background:"rgba(28,28,28,0.82)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",borderRadius:10,border:`1px solid ${C.border}55`}}>
        <span style={{fontWeight:800,fontSize:13,color:C.text}}>Filtros</span>
        <PeriodMonthYear fechaD={fechaD} fechaH={fechaH} setFechaD={setFechaD} setFechaH={setFechaH}/>
        {!soloFiltroMesCostos&&<>
          <DateIn label="Desde" value={fechaD} onChange={setFechaD}/>
          <DateIn label="Hasta" value={fechaH} onChange={setFechaH}/>
        </>}
        <MultiSel label="Proyecto" value={fProyecto} onChange={setFProyectoFluido} options={proyectoOpts}/>
        <MultiSel label="Insumos" value={fInsumos} onChange={setFInsumosFluido} options={insumosCostoOpts}/>
        <button onClick={()=>{setFechaDia("");setFechaD("");setFechaH("");setFProyecto("todos");setFInsumos("todos");setFPropiedad("todos");setFTipoEquipo("todos");setFMaquinas("todos");resetCostosFiltrosTodasTablas();}} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:7,color:C.textSub,padding:"7px 10px",fontSize:12,cursor:"pointer"}}>Limpiar filtros</button>
        <button onClick={()=>setDiagnosticoAbierto(true)} style={{background:"rgba(59,130,246,.12)",border:"1px solid rgba(96,165,250,.65)",borderRadius:7,color:"#93c5fd",padding:"7px 10px",fontSize:12,fontWeight:800,cursor:"pointer",whiteSpace:"nowrap"}}>🧪 Diagnóstico</button>
        <span style={{marginLeft:"auto",fontSize:11,color:C.textMuted}}>Registros RMA15 filtrados: <b style={{color:C.text}}>{rma15Filtrado.length}</b> / {rma15?.length||0}</span>
      </div>


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
          {/* Filtros AISLADOS para Mano de Obra — independientes de los filtros del resto de tablas */}
          <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",padding:"10px 14px",borderBottom:`1px solid ${C.border}33`,background:"rgba(20,30,20,0.6)"}}>
            <span style={{fontSize:12,fontWeight:800,color:C.green}}>Filtros Mano de Obra</span>
            <MultiSel label="Propiedad MO" value={fMOPropiedad} onChange={setFMOPropiedadFluido} options={moPropiedadOpts} commitOnClose commitDelay={180}/>
            <MultiSel label="Tipo equipo MO" value={fMOTipoEquipo} onChange={setFMOTipoEquipoFluido} options={moTipoEquipoOpts} commitOnClose commitDelay={180}/>
            <MultiSel label="Máquinas MO" value={fMOMaquinas} onChange={setFMOMaquinasFluido} options={moMaquinaOpts} commitOnClose commitDelay={180}/>
            <button onClick={()=>{setFMOPropiedad("todos");setFMOTipoEquipo("todos");setFMOMaquinas("todos");}}
              style={{background:"none",border:`1px solid ${C.border}`,borderRadius:7,color:C.textSub,padding:"7px 10px",fontSize:12,cursor:"pointer"}}>Limpiar</button>
            <span style={{marginLeft:"auto",fontSize:11,color:C.textMuted}}>Registros: <b style={{color:C.text}}>{rma15FiltradoMO.length}</b></span>
          </div>
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
          <div style={{display:"flex",gap:10,alignItems:"end",flexWrap:"wrap",padding:"12px 14px",borderBottom:`1px solid ${C.border}55`,background:"rgba(0,0,0,.18)"}}>
            <MultiSel label="Tipo máquina" value={fResumenTipo} onChange={v=>setFiltroFluido(setFResumenTipo,v)} options={resumenTipoOptions} commitOnClose commitDelay={180}/>
            <MultiSel label="Equipo" value={fResumenEquipo} onChange={v=>setFiltroFluido(setFResumenEquipo,v)} options={resumenEquipoOptions} commitOnClose commitDelay={180}/>
            <MultiSel label="Propiedad" value={fResumenPropiedad} onChange={v=>setFiltroFluido(setFResumenPropiedad,v)} options={resumenPropiedadOptions} commitOnClose commitDelay={180}/>
            <button onClick={()=>{setFResumenTipo("todos");setFResumenEquipo("todos");setFResumenPropiedad("todos");}}
              style={{background:"none",border:`1px solid ${C.border}`,borderRadius:7,color:C.textSub,padding:"7px 10px",fontSize:12,cursor:"pointer",height:33}}>Limpiar filtros</button>
            <span style={{marginLeft:"auto",fontSize:11,color:C.textMuted,paddingBottom:8}}>Equipos considerados: <b style={{color:C.text}}>{resumenEquiposConsiderados}</b></span>
          </div>
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
          {renderCostosQuickFilters("t9",true,{showProperty:false,tipoOptions:tipoEquipoOpts,equipoOptions:historicoEquipoOptions,extra:<><DateIn label="Desde" value={fechaHistoricaDesde} min="2026-01-01" max={fechaHistoricaHasta} onChange={v=>setFechaHistoricaDesde(clampInformeCostosDate(v))}/><DateIn label="Hasta" value={fechaHistoricaHasta} min={fechaHistoricaDesde} onChange={v=>setFechaHistoricaHasta(clampInformeCostosDate(v,historicalDefaultUntil))}/></>,note:"Solo equipos propios con mantenimiento 2026 · sin HH"})}
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
          {renderCostosQuickFilters("t10",true,{tipoOptions:resumenTipoOptions,equipoOptions:resumenHistoricoEquipoOptions,propiedadOptions:resumenPropiedadOptions,extra:<><DateIn label="Desde" value={fechaHistoricaDesde} min="2026-01-01" max={fechaHistoricaHasta} onChange={v=>setFechaHistoricaDesde(clampInformeCostosDate(v))}/><DateIn label="Hasta" value={fechaHistoricaHasta} min={fechaHistoricaDesde} onChange={v=>setFechaHistoricaHasta(clampInformeCostosDate(v,historicalDefaultUntil))}/></>,counter:rowsResumenHistoricoDetalle.length})}
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
  const equiposConMantenimiento2026=React.useMemo(()=>props.equipmentUniverse instanceof Set?props.equipmentUniverse:buildEquipmentWithMaintenance2026(preparedRma15),[props.equipmentUniverse,preparedRma15]);
  const filteredRma15=React.useMemo(()=>preparedRma15.filter(row=>
    !isExcludedFromMaintenanceCostReport(row?.maquina||row?.equipo||row?.interno||row?.codigo)&&belongsToMaintenanceUniverse2026(row,equiposConMantenimiento2026)
  ),[preparedRma15,equiposConMantenimiento2026]);
  const costDataIndex=React.useMemo(()=>indexMaintenanceCostRows(filteredRma15),[filteredRma15]);
  const preparedRop02=React.useMemo(()=>prepareRop02CostRows(props.rop02),[props.rop02]);
  const filteredRop02=React.useMemo(()=>preparedRop02.filter(row=>belongsToMaintenanceUniverse2026(row,equiposConMantenimiento2026)),[preparedRop02,equiposConMantenimiento2026]);
  const rop02RangeIndex=React.useMemo(()=>buildEquipmentRangeIndex(filteredRop02,equiposConMantenimiento2026,row=>row._effectiveHours),[filteredRop02,equiposConMantenimiento2026]);
  const filteredListaEquipos=React.useMemo(()=>(props.listaEquipos||[]).filter(row=>
    !rowHasExcludedMaintenanceCostCode(row)
  ),[props.listaEquipos]);
  return <ViewCostosMantCore {...props} rma15={filteredRma15} rop02={filteredRop02} listaEquipos={filteredListaEquipos} equiposConMantenimiento2026={equiposConMantenimiento2026} costDataIndex={costDataIndex} rop02RangeIndex={rop02RangeIndex}/>;
}

export const MemoViewCostosMant=React.memo(ViewCostosMant,sameInformeCostosProps);
export default MemoViewCostosMant;
