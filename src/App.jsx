import React, { useState, useCallback, useMemo, useEffect, useRef, startTransition } from "react";
import { C, STYLES, Icon, LoadingMotoniveladora, Spinner, Badge, StatCard, Card, Table, tableSortValue, compareTableValues, sortRowsForTable, SortableTH, Sel, multiDefault, normalizeMultiValue, multiIsAll, multiIncludes, matchMulti, multiSummary, multiSelectedLabels, dmNormalizeAssignedProject, dmAssignedProject, dmProjectMatches, MultiSel, DateIn, MONTH_OPTIONS, YEAR_OPTIONS, PeriodMonthYear, ChartTip, TabBtn, SubTab, AlertBanner, HelpTip } from "./components/ui/index.jsx";
import { InformeCostosRoute } from "./modules/informe-costos/index.js";
import { AbastecimientoRoute } from "./modules/abastecimiento/index.js";
import { MantenimientoRoute } from "./modules/mantenimiento/index.js";
import { LicitacionesRoute } from "./modules/licitaciones/index.js";
import { OficinaTecnicaRoute } from "./modules/oficina-tecnica/index.js";
import UserSettingsModal from "./components/UserSettingsModal.jsx";
import { APPS_SCRIPT_URL } from "./config/app.js";
import { VIEW_SOURCES } from "./config/viewSources.js";
import { fetchAction, fetchHealth, fetchSource, fetchSyncVersions, runWithConcurrency_ } from "./services/appsScriptApi.js";
import { appAlert, appConfirm, setAppDialogHandler } from "./services/dialogService.js";
import { APP_FILTERS_STATE_KEY, readSavedAppFilters, readSavedDataSources, saveDataSourcesToStorage, getCachedSourceTimestamp, mergeIncrementalSource, readCachedSourceRecords, readCachedSource, writeCachedSource } from "./services/appCache.js";
import { useGlobalThreeStateTableSort } from "./hooks/useGlobalThreeStateTableSort.js";
import ErrorScreen from "./components/ErrorScreen.jsx";
import { Login } from "./modules/auth/index.js";
import { ViewBienvenida } from "./modules/home/index.js";
import { dmNormalizeArea, dmCanEditArea } from "./shared/access.js";
import { ViewCostosUnitarios, ViewRankingOperarios, ViewCambiosTurno } from "./modules/analytics/index.js";
import ReactDOM from "react-dom";
import * as XLSX from "xlsx";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, Legend, ReferenceLine } from "recharts";


import {
  IMG_LOGIN_FONDO,
  EXCLUDED_TYPES,
  MACHINE_TYPE_MAP,
  PREFIX_TYPE_MAP,
  normalizeMachineCode,
  getMachineType,
  isExcluded,
  isRop02ControlMachineExcluded,
  fmtNum,
  fmtPct,
  fmtFecha,
  uniq,
  semaforo,
  DM_ALIAS_MAPS,
  dmNormKey,
  dmApplyAlias,
  dmNormalizeProject,
  dmNormalizeTipoEquipo,
  ROP05_TIPOS_MAQUINA,
  tipoMatchMachineROP05,
  dmTipoMaquinaOptions,
  dmMatchTipoMaquinaSeleccion,
  dmTitleCaseText,
  dmDisplayTarea,
  dmNormalizeTarea,
  dmNormalizeUnidad,
  cleanKey,
  cleanKeyLoose,
  getValue,
  toNumber,
  normalizeInflatedMoneyValue,
  toMoneyNumber,
  getExactValue,
  getInsumoExtra,
  normDate,
  cleanMachine,
  canonicalEquivalentMachineCode,
  machineCodeOutsideParentheses,
  validPropiedadValue,
  normalizeVehicleFamily,
  getListaVehicleVal,
  getVehicleTipoFromListaRow,
  getProyectoVehiculoFromListaRow,
  getSitioVehiculoFromListaRow,
  getPropiedadVehiculoFromListaRow,
  getCodigoNuevoFromListaRow,
  getCodigoViejoFromListaRow,
  buildVehicleListaIndex,
  getListaVehicleMatch,
  getListaEquipoAllCodes,
  addListaEquipoIndexKey,
  buildListaEquipoInfoIndex,
  getListaEquipoInfoMatch,
  COL_STOPWORDS,
  tokenizeLabel,
  findColumnKey,
  mainMachineCode,
  EQUIPO_SIN_INFO_EXCLUDED_CODES,
  isValidEquipoCodigoParaCorrelacion,
  machineLookupVariants,
  turnoOrder,
  buildHorometroMapForLista,
  detectEstado,
  _canonicalMap,
  _tareaMap,
  SUPERVISOR_EMAIL_MAP,
  normalizeName,
  levenshtein,
  buildTareaMap,
  normTarea,
  buildCanonicalMap,
  normName,
  normProject,
  proyColor,
  byDateFilter,
  normalizeROP02,
  normSupervisorROP05,
  fmtARS,
  fmtUSD,
  normalizeInsumoCode,
  normalizeRMA15,
  normalizeROP05,
  esNoProductivo,
  calcControl,
  LISTA_COLUMNS,
  LISTA_EQUIPOS_YEAR_OPTIONS,
  normalizeYearValue,
  isYearOnlyListaField,
  ListaEquipoFieldInput,
  generarExcelListaMaestra,
  generarReporteControl,
  IMG_CARGADORA_FRONTAL,
  IMG_EXCAVADORA,
  IMG_TOPADORA,
  IMG_MOTONIVELADORA,
  IMG_RETROPALA,
  IMG_RODILLO_COMPACTADOR,
  IMG_MINICARGADORA,
  VEH_COMBUSTIBLE,
  VEH_CAMIONETA,
  VEH_VOLCADOR,
  VEH_REGADOR,
  VEH_TRACTOR,
  LOGO,
  generarExcelICHC,
  generarExcelMantenimiento,
  generarExcelCodigosSinPrecio,
  excelFromCols,
  tipoEquipoCosto,
  esMaquinaCosto,
  MESES_ES,
  monthKeyCosto,
  monthLabelCosto,
  addMonthCosto,
  buildMonthKeysCosto
} from "./shared/domain/index.jsx";

import { ABASTECIMIENTO_DEPS, COSTOS_UNITARIOS_DEPS, INFORME_COSTOS_DEPS, LICITACIONES_DEPS, MANTENIMIENTO_DEPS, OPERATIONAL_ANALYTICS_DEPS, createOficinaTecnicaDeps } from "./config/moduleDeps.jsx";

export default function App(){
  useGlobalThreeStateTableSort();
  const [pwaInstallAvailable,setPwaInstallAvailable]=useState(()=>Boolean(window.dmPwaInstallAvailable));
  useEffect(()=>{
    const onAvailable=()=>setPwaInstallAvailable(true);
    const onUnavailable=()=>setPwaInstallAvailable(false);
    window.addEventListener("dm-pwa-install-available",onAvailable);
    window.addEventListener("dm-pwa-install-unavailable",onUnavailable);
    setPwaInstallAvailable(Boolean(window.dmPwaInstallAvailable));
    return()=>{
      window.removeEventListener("dm-pwa-install-available",onAvailable);
      window.removeEventListener("dm-pwa-install-unavailable",onUnavailable);
    };
  },[]);
  const installPwa=useCallback(async()=>{
    if(typeof window.dmInstallPWA!=="function")return;
    const installed=await window.dmInstallPWA();
    if(installed)setPwaInstallAvailable(false);
  },[]);
  const [appDialog,setAppDialog]=useState(null);
  useEffect(()=>{
    setAppDialogHandler((payload)=>new Promise(resolve=>{
      setAppDialog({...payload,resolve});
    }));
    return()=>setAppDialogHandler(null);
  },[]);
  const closeAppDialog=useCallback((answer)=>{
    setAppDialog(current=>{
      if(current?.resolve)current.resolve(answer);
      return null;
    });
  },[]);
  const savedAppFilters=readSavedAppFilters();
  const savedAppData=readSavedDataSources();
  const normalizeSavedState=(saved,def)=>{
    if(saved===undefined||saved===null)return def;
    if(!def||typeof def!=="object"||Array.isArray(def))return saved;
    const base={...def,...saved};
    if(def.vals||saved.vals)base.vals={...(def.vals||{}),...((saved&&saved.vals)||{})};
    return base;
  };
  const savedOr=(key,def)=>normalizeSavedState(savedAppFilters&&savedAppFilters[key],def);
  const[auth,setAuth]=useState(()=>sessionStorage.getItem("dm_auth")==="1");
  const[profileRevision,setProfileRevision]=useState(0);
  const[settingsOpen,setSettingsOpen]=useState(false);
  const[forcePasswordChange,setForcePasswordChange]=useState(()=>sessionStorage.getItem("dm_must_change_password")==="1");
  const nombreUsuario=useMemo(()=>{
    const guardado=String(sessionStorage.getItem("dm_name")||"").trim();
    if(guardado)return guardado;
    const mail=String(sessionStorage.getItem("dm_user")||"").trim();
    const base=(mail.split("@")[0]||"Usuario").split(/[._-]+/)[0]||"Usuario";
    return base.replace(/^./,c=>c.toUpperCase());
  },[auth,profileRevision]);
  const rolUsuario=useMemo(()=>String(sessionStorage.getItem("dm_role")||"USUARIO").trim().toUpperCase(),[auth]);
  const proyectoUsuario=useMemo(()=>dmNormalizeAssignedProject(sessionStorage.getItem("dm_project")||"TODO"),[auth]);
  const areaUsuario=useMemo(()=>String(sessionStorage.getItem("dm_area")||"").trim(),[auth,profileRevision]);
  const areaNormalizada=useMemo(()=>dmNormalizeArea(areaUsuario),[areaUsuario]);
  const proyectoRestringido=proyectoUsuario!=="TODO";
  const esAdministrativo=rolUsuario==="ADMINISTRATIVO";
  const[view,setView]=useState("bienvenida");
  const[activeModule,setActiveModule]=useState("home");
  const areaRequeridaVista=useMemo(()=>{
    const map={
      dashboard:"OFICINA TÉCNICA",
      rop02:"OFICINA TÉCNICA",
      horometros:"OFICINA TÉCNICA",
      vehiculos:"OFICINA TÉCNICA",
      combustible:"OFICINA TÉCNICA",
      cambiosTurno:"OFICINA TÉCNICA",
      controlROP02:"OFICINA TÉCNICA",
      controlErrores:"OFICINA TÉCNICA",
      ctrlEquipo:"OFICINA TÉCNICA",
      atrasoROP02:"OFICINA TÉCNICA",
      rop05:"OFICINA TÉCNICA",
      rop05Discriminacion:"OFICINA TÉCNICA",
      ranking:"OFICINA TÉCNICA",
      chc:"OFICINA TÉCNICA",
      control:"OFICINA TÉCNICA",
      mant:"MANTENIMIENTO",
      distMant:"MANTENIMIENTO",
      rma15CtrlEquipo:"MANTENIMIENTO",
      costosMant:"MANTENIMIENTO",
      costosUnitarios:"MANTENIMIENTO",
      listaEquipos:"TALLER CENTRAL",
      tallerCentral:"TALLER CENTRAL",
      abastecimiento:"ABASTECIMIENTO",
      abastecimientoDashboard:"ABASTECIMIENTO",
      abastecimientoPendientes:"ABASTECIMIENTO",
      abastecimientoParciales:"ABASTECIMIENTO",
      abastecimientoCerradas:"ABASTECIMIENTO",
      abastecimientoRechazadas:"ABASTECIMIENTO",
      abastecimientoRemito:"ABASTECIMIENTO",
      abastecimientoStock:"ABASTECIMIENTO",
      abastecimientoStockDashboard:"ABASTECIMIENTO",
      abastecimientoRABA03:"ABASTECIMIENTO",
      abastecimientoEditarCodigos:"ABASTECIMIENTO",
      licitaciones:"LICITACIONES"
    };
    return map[view]||"";
  },[view]);
  const puedeEditarVista=!areaRequeridaVista||dmCanEditArea(areaRequeridaVista);
  const[loading,setLoading]=useState(false);
  const[syncing,setSyncing]=useState(false);
  const[rop02All,setRop02All]=useState([]);
  const[rop05,setRop05]=useState([]);
  const[lastUpdate,setLastUpdate]=useState(()=>savedAppData.updatedAt?new Date(savedAppData.updatedAt):null);
  const[sidebarOpen,setSidebarOpen]=useState(()=>savedOr("sidebarOpen",true));
  const[sidebarTooltip,setSidebarTooltip]=useState(null);
  const navTooltipProps=useCallback((label)=>({
    onMouseEnter:(e)=>{
      if(!sidebarOpen){
        const r=e.currentTarget.getBoundingClientRect();
        setSidebarTooltip({label,x:r.right+10,y:r.top+r.height/2});
      }
    },
    onMouseLeave:()=>setSidebarTooltip(null),
    onFocus:(e)=>{
      if(!sidebarOpen){
        const r=e.currentTarget.getBoundingClientRect();
        setSidebarTooltip({label,x:r.right+10,y:r.top+r.height/2});
      }
    },
    onBlur:()=>setSidebarTooltip(null)
  }),[sidebarOpen]);
  const[errors,setErrors]=useState([]);
  const[fatalError,setFatalError]=useState(null);
  const[health,setHealth]=useState(null);
  const[rawSources,setRawSources]=useState(()=>savedAppData.sources||{});
  const[loadedSources,setLoadedSources]=useState(()=>Object.fromEntries(Object.keys(savedAppData.sources||{}).map(k=>[k,true])));
  const loadedSourcesRef=useRef(Object.fromEntries(Object.keys(savedAppData.sources||{}).map(k=>[k,true])));
  const rawSourcesRef=useRef(savedAppData.sources||{});
  const[listaEquipos,setListaEquipos]=useState([]);
  const[dataHydrated,setDataHydrated]=useState(false);
  useEffect(()=>{loadedSourcesRef.current=loadedSources;},[loadedSources]);
  useEffect(()=>{rawSourcesRef.current=rawSources;},[rawSources]);

  // Precarga silenciosa desde caché local: al abrir la app, las vistas ya tienen
  // datos disponibles antes de consultar Google Sheets. La sincronización real
  // sigue ocurriendo en segundo plano al entrar a cada módulo.
  useEffect(()=>{
    let cancelled=false;
    const allSources=[...new Set(Object.values(VIEW_SOURCES).flat())];
    const run=async()=>{
      const recordMap=await readCachedSourceRecords(allSources).catch(()=>({}));
      if(cancelled)return;
      const valid=Object.entries(recordMap||{}).filter(([,rec])=>rec?.value?.ok&&Array.isArray(rec.value.data));
      if(!valid.length)return;
      startTransition(()=>{
        setRawSources(prev=>{
          const next={...prev};let changed=false;
          valid.forEach(([key,rec])=>{if(!(next[key]?.ok&&Array.isArray(next[key].data))){next[key]=rec.value;changed=true;}});
          if(!changed)return prev;
          rawSourcesRef.current=next;
          return next;
        });
        setLoadedSources(prev=>{
          const next={...prev};let changed=false;
          valid.forEach(([key])=>{if(!next[key]){next[key]=true;changed=true;}});
          if(!changed)return prev;
          loadedSourcesRef.current=next;
          return next;
        });
      });
      const times=valid.map(([,rec])=>new Date(rec.updatedAt||0).getTime()).filter(Number.isFinite);
      if(times.length)setLastUpdate(new Date(Math.max(...times)));
    };
    const id=typeof window.requestIdleCallback==="function"?window.requestIdleCallback(run,{timeout:500}):window.setTimeout(run,120);
    return()=>{
      cancelled=true;
      if(typeof window.cancelIdleCallback==="function")window.cancelIdleCallback(id);
      else window.clearTimeout(id);
    };
  },[]);

  const sourceHasData=useCallback((key)=>{
    const src=rawSources&&rawSources[key];
    return !!(src&&src.ok&&Array.isArray(src.data)&&src.data.length>0);
  },[rawSources]);

  const viewDataReady=useMemo(()=>{
    if(view==="rop05"||view==="rop05Discriminacion")return sourceHasData("rop05");
    if(view==="rop02")return sourceHasData("rop02_jm")||sourceHasData("rop02_fs")||sourceHasData("rop02_filosur")||sourceHasData("rop02_zorro");
    if(view==="rma15")return sourceHasData("rma15_jm")||sourceHasData("rma15_fs");
    if(view==="insumos")return sourceHasData("insumos")||sourceHasData("rma15_jm")||sourceHasData("rma15_fs");
    if(view==="listaEquipos")return sourceHasData("lista_equipos");
    if(view==="control")return sourceHasData("rop05")&&(sourceHasData("rop02_jm")||sourceHasData("rop02_fs")||sourceHasData("rop02_filosur")||sourceHasData("rop02_zorro"));
    return Object.keys(rawSources||{}).some(sourceHasData);
  },[view,sourceHasData,rawSources]);

  const BlockingDataLoader=useCallback(({label="Cargando"})=>(
    <div style={{
      margin:16,
      minHeight:"55vh",
      display:"flex",
      alignItems:"center",
      justifyContent:"center",
      background:"rgba(0,0,0,.62)",
      border:`1px solid ${C.border}`,
      borderRadius:16,
      backdropFilter:"blur(8px)",
      WebkitBackdropFilter:"blur(8px)"
    }}>
      <div style={{textAlign:"center"}}>
        <LoadingMotoniveladora size={340} label={label}/>
      </div>
    </div>
  ),[]);


  const control=useMemo(()=>calcControl(rop02All,rop05),[rop02All,rop05]);
  // Estados persistentes de filtros por pestaña
  const[dashSt,setDashSt]=useState(()=>savedOr("dashSt",{proyecto:"todos",modeD:"todo",fechaD:"",fechaDD:"",fechaDH:""}));
  const[rma15,setRma15]=useState([]);
  const[stMant,setStMant]=useState(()=>savedOr("stMant",{modo:"dia",proyecto:"todos",tipoMant:"todos",maquina:"todas",fechaD:"",fechaH:"",fechaDia:"",filtroCosto:"total",insumoFiltro:"todos",verGastosExcesivos:false}));
  const[stRma15CtrlEquipo,setStRma15CtrlEquipo]=useState(()=>savedOr("stRma15CtrlEquipo",{proyecto:"todos",maquina:"todas",año:String(new Date().getFullYear()),mesIdx:new Date().getMonth(),fechaSel:""}));
  const[stCHC,setStCHC]=useState(()=>savedOr("stCHC",{proyecto:"todos",añoSelec:String(new Date().getFullYear()),mesIdx:new Date().getMonth()}));
  const[stRanking,setStRanking]=useState(()=>savedOr("stRanking",{proyecto:"todos",modeR:"periodo",fecha:"",fechaD:"",fechaH:""}));
  const[navOpen,setNavOpen]=useState(()=>savedOr("navOpen",{grp_rop02:true,grp_control_rop02:true,grp_rop05:true,grp_rma15:true,grp_abastecimiento:true,grp_stockcritico:true,grp_admin:true}));
  const[usdRate,setUsdRate]=useState(null);

  // Tipo de cambio: se pide recién cuando una vista de costos/mantenimiento lo necesita.
  useEffect(()=>{
    const needsUsd=["mant","costosMant","costosUnitarios"].includes(view);
    if(!needsUsd||usdRate)return;
    let alive=true;
    fetch("https://api.exchangerate-api.com/v4/latest/USD")
      .then(r=>r.json())
      .then(d=>{if(alive&&d.rates?.ARS)setUsdRate(d.rates.ARS);})
      .catch(()=>{
        fetch("https://dolarapi.com/v1/dolares/blue")
          .then(r=>r.json())
          .then(d=>{if(alive&&d.venta)setUsdRate(d.venta);})
          .catch(()=>{if(alive)setUsdRate(1300);});
      });
    return()=>{alive=false;};
  },[view,usdRate]);
  const[insumos,setInsumos]=useState({});
  const[st02,setSt02]=useState(()=>savedOr("st02",{mode:"dia",fecha:"",fechaD:"",fechaH:"",vals:{proyecto:"todos",maquina:"todas",supervisor:"todos",operario:"todos"}}));
  const[stHorometros,setStHorometros]=useState(()=>savedOr("stHorometros",{mode:"periodo",fecha:"",fechaD:"",fechaH:"",vals:{proyecto:"todos",maquina:"todas",supervisor:"todos",operario:"todos"}}));
  const[stVeh,setStVeh]=useState(()=>savedOr("stVeh",{mode:"dia",fecha:"",fechaD:"",fechaH:"",vals:{proyecto:"todos",maquina:"todas",supervisor:"todos",operario:"todos"}}));
  const[stComb,setStComb]=useState(()=>savedOr("stComb",{mode:"dia",fecha:"",fechaD:"",fechaH:"",vals:{proyecto:"todos",maquina:"todas",supervisor:"todos",operario:"todos"}}));
  const[stControlErrores,setStControlErrores]=useState(()=>savedOr("stControlErrores",{proyecto:"todos",maquina:"todas",año:String(new Date().getFullYear()),mesIdx:new Date().getMonth(),tipo:"todos",fechaDesde:"",fechaHasta:""}));
  const[stCtrlEquipo,setStCtrlEquipo]=useState(()=>savedOr("stCtrlEquipo",{proyecto:"todos",maquina:"todas",año:String(new Date().getFullYear()),mesIdx:new Date().getMonth(),fechaSel:"",controlActivo:"numeracion"}));
  const[stControlROP02,setStControlROP02]=useState(()=>savedOr("stControlROP02",{tab:"errores"}));
  const[st05,setSt05]=useState(()=>savedOr("st05",{mode:"dia",fecha:"",fechaD:"",fechaH:"",vals:{proyecto:"todos",maquina:"todas",supervisor:"todos",unidad:"todas"}}));
  const[stCtrl,setStCtrl]=useState(()=>savedOr("stCtrl",{mode:"dia",fecha:"",fechaD:"",fechaH:"",vals:{proyecto:"todos",maquina:"todas",supervisor:"todos"}}));

  // Cuando el usuario tiene un proyecto asignado, los datos ya llegan recortados
  // a ese proyecto. Se limpian filtros de proyecto guardados anteriormente para
  // evitar que un valor oculto (por ejemplo FILO DEL SOL) deje sin resultados a
  // un usuario que ahora pertenece a JOSE MARIA.
  useEffect(()=>{
    if(!proyectoRestringido)return;
    const resetSimple=(setter)=>setter(prev=>prev?.proyecto==="todos"?prev:{...prev,proyecto:"todos"});
    const resetVals=(setter)=>setter(prev=>prev?.vals?.proyecto==="todos"?prev:{...prev,vals:{...(prev?.vals||{}),proyecto:"todos"}});
    resetSimple(setDashSt);
    resetSimple(setStMant);
    resetSimple(setStRma15CtrlEquipo);
    resetSimple(setStCHC);
    resetSimple(setStRanking);
    resetSimple(setStControlErrores);
    resetSimple(setStCtrlEquipo);
    resetVals(setSt02);
    resetVals(setStHorometros);
    resetVals(setStVeh);
    resetVals(setStComb);
    resetVals(setSt05);
    resetVals(setStCtrl);
  },[proyectoRestringido,proyectoUsuario]);

  useEffect(()=>{
    const t=setTimeout(()=>{
      try{
        window.localStorage.setItem(APP_FILTERS_STATE_KEY,JSON.stringify({
          sidebarOpen,dashSt,stMant,stCHC,stRanking,navOpen,st02,stHorometros,stVeh,stComb,stControlErrores,stCtrlEquipo,stControlROP02,st05,stCtrl
        }));
      }catch(_){}
    },250);
    return()=>clearTimeout(t);
  },[sidebarOpen,dashSt,stMant,stCHC,stRanking,navOpen,st02,stHorometros,stVeh,stComb,stControlErrores,stCtrlEquipo,stControlROP02,st05,stCtrl]);


  // Normaliza todo cada vez que llega una fuente nueva.
  // Ventaja: podemos cargar por pestaña sin perder consistencia entre ROP02, ROP05, RMA15 e insumos.
  useEffect(()=>{
    const src=rawSources||{};
    const errs=[];

    const rop05Raw=src.rop05?.ok&&src.rop05.data?normalizeROP05(src.rop05.data):[];
    if(src.rop05&&!src.rop05.ok)errs.push({source:"ROP05",...src.rop05.error});

    if(rop05Raw.length){
      buildTareaMap(rop05Raw.map(r=>r.tarea).filter(Boolean));
      setRop05(rop05Raw.filter(r=>dmProjectMatches(r.proyecto,proyectoUsuario)).map(r=>({...r,tarea:normTarea(r.tarea)})));
    }else if(src.rop05){
      setRop05([]);
    }

    const rFS=src.rop02_fs?.ok&&src.rop02_fs.data?normalizeROP02(src.rop02_fs.data,"FILO DEL SOL"):[];
    const rJM=src.rop02_jm?.ok&&src.rop02_jm.data?normalizeROP02(src.rop02_jm.data,"JOSE MARIA"):[];
    const rFSur=src.rop02_filosur?.ok&&src.rop02_filosur.data?normalizeROP02(src.rop02_filosur.data,"FILO SUR"):[];
    const rZorro=src.rop02_zorro?.ok&&src.rop02_zorro.data?normalizeROP02(src.rop02_zorro.data,"EL ZORRO"):[];
    if(src.rop02_fs&&!src.rop02_fs.ok)errs.push({source:"ROP02 — Filo del Sol",...src.rop02_fs.error});
    if(src.rop02_jm&&!src.rop02_jm.ok)errs.push({source:"ROP02 — José María",...src.rop02_jm.error});
    if(src.rop02_filosur&&!src.rop02_filosur.ok)errs.push({source:"ROP02 — Filo Sur",...src.rop02_filosur.error});
    if(src.rop02_zorro&&!src.rop02_zorro.ok)errs.push({source:"ROP02 — El Zorro",...src.rop02_zorro.error});

    const allRop02=[...rFS,...rJM,...rFSur,...rZorro];
    if(allRop02.length || src.rop02_fs || src.rop02_jm || src.rop02_filosur || src.rop02_zorro){
      const allNames=[...allRop02.map(r=>r.supervisor),...allRop02.map(r=>r.operario),...rop05Raw.map(r=>r.supervisor)].filter(Boolean);
      buildCanonicalMap(allNames);
      setRop02All(allRop02.filter(r=>dmProjectMatches(r.proyecto,proyectoUsuario)).map(r=>({...r,supervisor:normName(r.supervisor),operario:normName(r.operario)})));
    }

    const insumosMap={};
    if(src.insumos?.ok&&src.insumos.data){
      src.insumos.data.forEach(r=>{
        const cod=normalizeInsumoCode(getValue(r,["CODIGO","Codigo","Código","codigo","código","Cod","cod"])||"");
        if(cod){
          const descripcion=String(getValue(r,["DESCRIPCIÓN","DESCRIPCION","Descripción","Descripcion","descripcion","Artículo","Articulo","ARTICULO","Insumo","Nombre"])||"").trim();
          insumosMap[cod]={
            descripcion,
            descripcionAdicional:getInsumoExtra(r,descripcion),
            costoUnitario:toMoneyNumber(getValue(r,["COSTO UNITARIO","Costo Unitario","Costo unitario","Precio unitario con IVA","PRECIO UNITARIO CON IVA","precio unitario con IVA","Precio unitario","PRECIO UNITARIO","Precio","PRECIO","Costo","COSTO"])),
          };
        }
      });
      setInsumos(insumosMap);
    }

    const rmaFS=src.rma15_fs?.ok&&src.rma15_fs.data?src.rma15_fs.data:[];
    const rmaJM=src.rma15_jm?.ok&&src.rma15_jm.data?src.rma15_jm.data:[];
    if(src.rma15_fs&&!src.rma15_fs.ok)errs.push({source:"RMA15 — Filo del Sol",...src.rma15_fs.error});
    if(src.rma15_jm&&!src.rma15_jm.ok)errs.push({source:"RMA15 — José María",...src.rma15_jm.error});
    if(rmaFS.length || rmaJM.length || src.rma15_fs || src.rma15_jm){
      setRma15([
        ...rmaFS.map(r=>normalizeRMA15({...r,_proyectoForzado:"FILO DEL SOL"},insumosMap)),
        ...rmaJM.map(r=>normalizeRMA15({...r,_proyectoForzado:"JOSE MARIA"},insumosMap)),
      ].filter(r=>dmProjectMatches(r.proyecto,proyectoUsuario)));
    }

    if(src.lista_equipos?.ok&&src.lista_equipos.data){
      setListaEquipos(src.lista_equipos.data);
    }else if(src.lista_equipos&&!src.lista_equipos.ok){
      errs.push({source:"Lista Maestra de Equipos",...src.lista_equipos.error});
      setListaEquipos([]);
    }

    setErrors(errs);
    setDataHydrated(true);
  },[rawSources,proyectoUsuario]);

  const loadInitial=useCallback(async()=>{
    setLoading(true);setErrors([]);setFatalError(null);
    try{
      const h=await fetchHealth(APPS_SCRIPT_URL);
      setHealth(h);
      setLastUpdate(new Date());
    }catch(err){setFatalError(err.message);}
    finally{setLoading(false);}
  },[]);

  const hydratedCacheKeysRef=useRef(new Set());
  const sourceRequestsRef=useRef(new Map());
  const lastCheckedBySourceRef=useRef({});
  const welcomePreloadStartedRef=useRef(false);
  const activeSyncCountRef=useRef(0);
  const SYNC_FRESH_MS=5*60*1000;

  const beginBackgroundSync=useCallback(()=>{
    activeSyncCountRef.current+=1;
    if(activeSyncCountRef.current===1)setSyncing(true);
  },[]);
  const endBackgroundSync=useCallback(()=>{
    activeSyncCountRef.current=Math.max(0,activeSyncCountRef.current-1);
    if(activeSyncCountRef.current===0)setSyncing(false);
  },[]);

  const hydrateSourcesFromCache=useCallback(async requested=>{
    const keys=(requested||[]).filter(key=>
      !hydratedCacheKeysRef.current.has(key)&&
      !(rawSourcesRef.current?.[key]?.ok&&Array.isArray(rawSourcesRef.current[key].data))
    );
    if(!keys.length)return {};

    keys.forEach(key=>hydratedCacheKeysRef.current.add(key));
    const recordMap=await readCachedSourceRecords(keys).catch(()=>({}));
    const records=keys.map(key=>[key,recordMap[key]||null]);
    const valid=records.filter(([,rec])=>rec?.value?.ok&&Array.isArray(rec.value.data));
    if(!valid.length)return recordMap;

    startTransition(()=>{
      setRawSources(prev=>{
        let changed=false;
        const next={...prev};
        valid.forEach(([key,rec])=>{
          if(!(next[key]?.ok&&Array.isArray(next[key].data))){next[key]=rec.value;changed=true;}
        });
        if(!changed)return prev;
        rawSourcesRef.current=next;
        return next;
      });
      setLoadedSources(prev=>{
        let changed=false;
        const next={...prev};
        valid.forEach(([key])=>{if(!next[key]){next[key]=true;changed=true;}});
        if(!changed)return prev;
        loadedSourcesRef.current=next;
        return next;
      });
    });

    const times=valid.map(([,rec])=>new Date(rec.updatedAt||0).getTime()).filter(Number.isFinite);
    if(times.length)setLastUpdate(new Date(Math.max(...times)));
    return recordMap;
  },[]);

  const fetchOneSource=useCallback(async(key,{force=false,serverVersions={},cacheRecords={}}={})=>{
    const existingRequest=sourceRequestsRef.current.get(key);
    if(existingRequest&&!force)return existingRequest;

    const task=(async()=>{
      const cacheRecord=cacheRecords[key]||await readCachedSource(key).catch(()=>null);
      const localSource=rawSourcesRef.current?.[key]||cacheRecord?.value||null;
      const localVersion=Number(localSource?.meta?.serverVersion||cacheRecord?.value?.meta?.serverVersion||0);
      const serverVersion=Number(serverVersions[key]||0);

      if(!force&&localSource?.ok&&Array.isArray(localSource.data)&&serverVersion>0&&localVersion===serverVersion){
        lastCheckedBySourceRef.current[key]=Date.now();
        return {key,value:localSource,skipped:true};
      }

      const fetched=await fetchSource(APPS_SCRIPT_URL,key,{force,since:force?'':getCachedSourceTimestamp(cacheRecord)});
      if(!fetched?.ok||!Array.isArray(fetched.data))throw new Error(fetched?.error?.message||'Respuesta sin datos válidos');
      const previous=localSource?.ok&&Array.isArray(localSource.data)?localSource:null;
      const value=mergeIncrementalSource(previous,fetched);
      const confirmsEmpty=Number(fetched?.meta?.rows)===0||fetched?.empty===true;
      if(previous?.data?.length>0&&value?.data?.length===0&&!confirmsEmpty)throw new Error('El servidor devolvió una respuesta vacía no confirmada');
      await writeCachedSource(key,value);
      lastCheckedBySourceRef.current[key]=Date.now();
      return {key,value,skipped:false};
    })();

    sourceRequestsRef.current.set(key,task);
    try{return await task;}
    finally{if(sourceRequestsRef.current.get(key)===task)sourceRequestsRef.current.delete(key);}
  },[]);

  const loadSources=useCallback(async(sources,{force=false,background=true}={})=>{
    const requested=[...new Set((sources||[]).filter(Boolean))];
    if(!requested.length)return;

    setFatalError(null);
    const cacheRecords=await hydrateSourcesFromCache(requested);
    const now=Date.now();
    const toCheck=force?requested:requested.filter(key=>{
      const hasData=rawSourcesRef.current?.[key]?.ok&&Array.isArray(rawSourcesRef.current[key].data);
      const fresh=now-Number(lastCheckedBySourceRef.current[key]||0)<SYNC_FRESH_MS;
      return !hasData||!fresh;
    });
    if(!toCheck.length)return;

    const hasVisible=toCheck.some(key=>rawSourcesRef.current?.[key]?.ok&&Array.isArray(rawSourcesRef.current[key].data));
    if(background||hasVisible)beginBackgroundSync();else setLoading(true);

    try{
      const syncInfo=force?null:await fetchSyncVersions(APPS_SCRIPT_URL);
      const serverVersions=syncInfo?.versions||{};
      const results=await Promise.allSettled(toCheck.map(key=>fetchOneSource(key,{force,serverVersions,cacheRecords})));
      const entries=[];
      const softErrors=[];
      results.forEach((result,index)=>{
        const key=toCheck[index];
        if(result.status==='fulfilled'){
          if(!result.value.skipped)entries.push([key,result.value.value]);
        }else{
          const previous=rawSourcesRef.current?.[key];
          softErrors.push({source:key.toUpperCase(),message:previous?.ok&&Array.isArray(previous.data)
            ?`No se pudo actualizar (${result.reason?.message||'error desconocido'}). Se conservan los datos guardados.`
            :(result.reason?.message||'No se pudo cargar la fuente.')});
        }
      });

      if(entries.length){
        startTransition(()=>{
          setRawSources(prev=>{
            let changed=false;
            const next={...prev};
            entries.forEach(([key,val])=>{if(next[key]!==val){next[key]=val;changed=true;}});
            if(!changed)return prev;
            rawSourcesRef.current=next;
            return next;
          });
          setLoadedSources(prev=>{
            let changed=false;
            const next={...prev};
            entries.forEach(([key])=>{if(!next[key]){next[key]=true;changed=true;}});
            if(!changed)return prev;
            loadedSourcesRef.current=next;
            return next;
          });
        });
        setLastUpdate(new Date());
      }

      if(softErrors.length)setErrors(prev=>[...softErrors,...(prev||[]).filter(e=>!softErrors.some(se=>se.source===e.source))]);
      else setErrors(prev=>(prev||[]).filter(e=>!toCheck.some(k=>e.source===k.toUpperCase())));

      const hasAnyUsable=requested.some(key=>rawSourcesRef.current?.[key]?.ok&&Array.isArray(rawSourcesRef.current[key].data))||entries.length>0;
      if(!hasAnyUsable&&softErrors.length===toCheck.length)setFatalError('No se pudieron cargar los datos y no existe una copia local disponible.');
    }catch(err){
      const hasAnyData=requested.some(key=>rawSourcesRef.current?.[key]?.ok&&Array.isArray(rawSourcesRef.current[key].data));
      if(hasAnyData)setErrors(prev=>[{source:'Apps Script',message:`No se pudo actualizar (${err.message}). Se conservan los datos guardados.`},...(prev||[])]);
      else setFatalError(err.message);
    }finally{
      setLoading(false);
      if(background||hasVisible)endBackgroundSync();
    }
  },[hydrateSourcesFromCache,fetchOneSource,beginBackgroundSync,endBackgroundSync]);

  const loadData=useCallback(async()=>{
    const sources=VIEW_SOURCES[view]||[];
    if(sources.length) await loadSources(sources,{force:true,background:false});
    else await loadInitial();
  },[view,loadSources,loadInitial]);


  // Precarga silenciosa en Bienvenida.
  // Versión liviana: sólo calienta la caché local/remota, pero NO mete todas las
  // fuentes en el estado de React mientras estás en la portada. Eso evita que un
  // click a cualquier módulo tenga que competir contra renders/cálculos enormes.
  useEffect(()=>{
    if(view!=="bienvenida"||welcomePreloadStartedRef.current)return;
    welcomePreloadStartedRef.current=true;
    let cancelled=false;

    const stopPreload=()=>{cancelled=true;};
    window.addEventListener("pointerdown",stopPreload,{once:true,passive:true});
    window.addEventListener("keydown",stopPreload,{once:true});

    const preloadSources=[...new Set([
      "lista_equipos",
      "insumos",
      "rma15_fs",
      "rma15_jm",
      "rop02_fs",
      "rop02_jm",
      "rop02_filosur",
      "rop02_zorro",
      "rop05",
      "raba03",
      "remitos_cargados"
    ].filter(Boolean))];

    const run=async()=>{
      try{
        const cacheRecords=await hydrateSourcesFromCache(preloadSources).catch(()=>({}));
        if(cancelled)return;

        let serverVersions={};
        try{
          const syncInfo=await fetchSyncVersions(APPS_SCRIPT_URL);
          serverVersions=syncInfo?.versions||{};
        }catch(_){serverVersions={};}

        // Una fuente por vez y con pausa: no actualiza UI, sólo deja la caché lista.
        for(let i=0;i<preloadSources.length&&!cancelled;i++){
          const key=preloadSources[i];
          try{await fetchOneSource(key,{force:false,serverVersions,cacheRecords});}catch(_){}
          await new Promise(resolve=>setTimeout(resolve,350));
        }
      }catch(_){
        // Silencioso: si falla la precarga, no interrumpe ni muestra errores.
      }
    };

    const id=typeof window.requestIdleCallback==="function"
      ?window.requestIdleCallback(run,{timeout:1800})
      :window.setTimeout(run,900);

    return()=>{
      cancelled=true;
      window.removeEventListener("pointerdown",stopPreload);
      window.removeEventListener("keydown",stopPreload);
      if(typeof window.cancelIdleCallback==="function")window.cancelIdleCallback(id);
      else window.clearTimeout(id);
    };
  },[view,hydrateSourcesFromCache,fetchOneSource]);

  useEffect(()=>{
    if(view==="bienvenida")return;
    if(view==="dashboard"&&Object.keys(rawSourcesRef.current||{}).length===0){loadInitial();return;}
    let cancelled=false;
    const run=()=>{if(!cancelled)loadSources(VIEW_SOURCES[view]||[],{background:true});};
    const id=typeof window.requestIdleCallback==="function"
      ?window.requestIdleCallback(run,{timeout:250})
      :window.setTimeout(run,60);
    return()=>{
      cancelled=true;
      if(typeof window.cancelIdleCallback==="function")window.cancelIdleCallback(id);
      else window.clearTimeout(id);
    };
  },[view,loadSources,loadInitial]);

  // ─── Auto-refresh: recarga los datos del sheet cada 15 minutos ──────────────
  // Llama a loadData (mismo comportamiento que el botón "Actualizar", con force)
  // para las fuentes de la vista actual. Si la pestaña del navegador está oculta,
  // no refresca (para no gastar cuota del Apps Script); al volver a la pestaña,
  // refresca automáticamente si pasaron más de 15 minutos desde la última carga.
  const lastAutoRefreshRef=useRef(Date.now());
  useEffect(()=>{
    if(view==="bienvenida")return;
    const AUTO_REFRESH_MS=5*60*1000; // 5 minutos

    const doRefresh=()=>{
      lastAutoRefreshRef.current=Date.now();
      loadSources(VIEW_SOURCES[view]||[]);
    };

    const id=setInterval(()=>{
      if(document.hidden)return; // pestaña oculta: no refrescar
      doRefresh();
    },AUTO_REFRESH_MS);

    const onVisible=()=>{
      if(document.hidden)return;
      // Si el usuario vuelve a la pestaña y los datos quedaron viejos, refrescamos.
      if(Date.now()-lastAutoRefreshRef.current>=AUTO_REFRESH_MS)doRefresh();
    };
    const onOnline=()=>{if(!document.hidden)doRefresh();};
    document.addEventListener("visibilitychange",onVisible);
    window.addEventListener("online",onOnline);

    return ()=>{
      clearInterval(id);
      document.removeEventListener("visibilitychange",onVisible);
      window.removeEventListener("online",onOnline);
    };
  },[view,loadSources]);

  const costosUnitariosBadge=useMemo(()=>{
    const m={};
    const fechaMinima=`${new Date().getFullYear()}-06-01`;
    const esCodigoValido=(v)=>{
      const c=normalizeInsumoCode(v);
      if(!c||c.length>60)return false;
      if(["0","-","--","S/C","SC","SINCODIGO","SIN-CODIGO","N/A","NA","NOAPLICA"].includes(c))return false;
      return /^[A-Z0-9._/-]+$/.test(c) && /\d/.test(c);
    };
    const insumosPorCodigo=new Map(
      Object.entries(insumos||{}).map(([codigo,info])=>[normalizeInsumoCode(codigo),info])
    );
    (rma15||[]).forEach(r=>{
      const fecha=normDate(r?.fecha);
      if(!fecha||fecha<fechaMinima)return;
      (r.insumos||[]).forEach(i=>{
        const codigo=normalizeInsumoCode(i.codigo);
        if(!codigo||!esCodigoValido(codigo))return;
        const infoCosto=insumosPorCodigo.get(codigo);
        const existe=!!infoCosto;
        const precio=Number(infoCosto?.costoUnitario??i.costoUnitario??0);
        if(!existe||precio<=0)m[codigo]=true;
      });
    });
    return Object.keys(m).length;
  },[rma15,insumos]);

  const navStructure=[
    {id:"bienvenida",icon:"home",label:"Bienvenida",type:"item",color:C.accent},
    {id:"dashboard",icon:"dashboard",label:"Dashboard",type:"item",color:C.accent},
    {id:"grp_rop02",icon:"fileSpreadsheet",label:"ROP02",type:"group",color:C.purple,children:[
      {id:"rop02",icon:"truck",label:"Equipos"},
      {id:"vehiculos",icon:"car",label:"Vehículos"},
      {id:"combustible",icon:"fuel",label:"Combustible"},
      {id:"horometros",icon:"hours",label:"Horómetros"},
      {id:"cambiosTurno",icon:"usersRound",label:"Cambios de turno"},
    ]},
    {id:"grp_control_rop02",icon:"shieldCheck",label:"Control de ROP02",type:"group",color:C.accent,children:[
      {id:"controlErrores",icon:"circleAlert",label:"Control de errores"},
      {id:"ctrlEquipo",icon:"clipboardCheck",label:"Control por Equipo"},
      {id:"atrasoROP02",icon:"warn",label:"Atraso"},
    ]},
    {id:"grp_rop05",icon:"prod",label:"ROP05",type:"group",color:C.green,children:[
      {id:"rop05",icon:"prod",label:"Productividad"},
      {id:"rop05Discriminacion",icon:"listTree",label:"Discriminación por tarea"},
      {id:"ranking",icon:"medal",label:"Ranking Operarios"},
    ]},
    {id:"grp_rma15",icon:"gear",label:"RMA15",type:"group",color:C.yellow,children:[
      {id:"mant",icon:"wrench",label:"Mantenimiento"},
      {id:"distMant",icon:"consist",label:"Distribución de mantenimientos"},
      {id:"rma15CtrlEquipo",icon:"hardHat",label:"Control por Equipo"},
      {id:"costosMant",icon:"fileBarChart",label:"Informe de Costos"},
      {id:"costosUnitarios",icon:"badgeDollarSign",label:"Costos Unitarios",badge:costosUnitariosBadge>0?costosUnitariosBadge:null},
    ]},
    {id:"control",icon:"clipboardCheck",label:"Control ROP05 vs ROP02",type:"item",color:C.blue,badge:(control.problemasPost31??0)>0?control.problemasPost31:null},
    {id:"listaEquipos",icon:"database",label:"Lista Maestra de Equipos",type:"item",color:C.yellow},
    {id:"chc",icon:"clipboardList",label:"ICHC",type:"item",color:C.green},
  ];
  const titles={bienvenida:"Bienvenida",dashboard:"Dashboard",costosMant:"Informe de Costos de Mantenimiento",listaEquipos:"Lista Maestra de Equipos",tallerCentral:"Taller Central",rop02:"Equipos",horometros:"Horómetros",vehiculos:"Vehículos y Camionetas",controlErrores:"Control de errores",ctrlEquipo:"Control por Equipo",controlROP02:"Control de ROP02",atrasoROP02:"Atraso ROP02",combustible:"Análisis de Combustible",cambiosTurno:"Cambios de turno",rop05:"Productividad",rop05Discriminacion:"Discriminación por tarea",ranking:"Ranking de Operarios",chc:"ICHC — Indicador Control de Horas Contratadas",mant:"Mantenimiento",distMant:"Distribución de mantenimientos",rma15CtrlEquipo:"Control por Equipo",costosUnitarios:"Costos Unitarios",control:"Consistencia ROP02 vs ROP05",abastecimiento:"Solicitudes realizadas",abastecimientoDashboard:"Dashboard Abastecimiento",abastecimientoPendientes:"Pendientes",abastecimientoParciales:"Parciales",abastecimientoCerradas:"Cerradas",abastecimientoRechazadas:"Solicitudes rechazadas",abastecimientoEnviosSinSolicitud:"Envíos sin solicitud",abastecimientoRemito:"Remito",abastecimientoStock:"Control de stock",abastecimientoStockDashboard:"Dashboard Stock",abastecimientoRABA03:"RABA03",abastecimientoEditarCodigos:"Editar códigos",licitaciones:"Licitaciones",licitacionesNueva:"Nueva Licitación",licitacionesEquipos:"Costos de Equipos",licitacionesControl:"Control de Licitaciones",plan180hs:"180 hs",plan150hs:"150 HS",planSeguros:"Seguros y Garantías",planImpuestos:"Impuestos",planGastosGenerales:"Gastos Generales",planMovilizacion:"Movilización",planOperacionObrador:"Operación de Obrador",planHistograma:"Histograma",planCostosVarios:"Costos Varios",planResumenHsMaquina:"Resumen de hs maquina",planComparativaEquipos:"Comparativa Equipos",planHM:"HM",planMantenimiento:"Mantenimiento",planHombreVestido:"Hombre Vestido",planUOCRA:"UOCRA",planAOMA:"AOMA",planComparativaConvenios:"Comparativa UOCRA vs AOMA"};
  const titleHelp={
    dashboard:"Resumen general de la operación: KPIs y gráficos de Equipos, Productividad y Mantenimiento.",
    listaEquipos:"Listado maestro de equipos tomado desde la planilla nueva. Se carga bajo demanda para no demorar el inicio de la app.",
    tallerCentral:"Dashboard y Lista Maestra de Equipos para taller central: equipos por tipo, propiedad, marca, combustible y tabla completa.",
    rop02:"ROP02 = Reporte de Operación de máquinas: parte diario por turno (TD = turno día, TN = turno noche), con horómetros, tareas y observaciones.",
    horometros:"Resume por máquina el horómetro inicial del primer registro filtrado y el horómetro final del último registro del período seleccionado.",
    vehiculos:"Mismo reporte que ROP02 (TD/TN, horómetros, km), pero para camiones y camionetas en lugar de máquinas.",
    ctrlEquipo:"Ficha por equipo: muestra el detalle día por turno (TD/TN) y controla automáticamente que la numeración de partes y los horómetros sean consistentes entre registros.",
    combustible:"Análisis de litros de combustible cargados por equipo, proyecto y período, con ranking de consumo.",
    cambiosTurno:"Calendario de rotación de supervisores por grupos y control de horas acumuladas por equipo en período 26 al 25.",
    rop05:"ROP05 = Reporte de Producción: cantidad y tipo de trabajo productivo realizado por cada equipo (m³, m², horas, etc.).",
    ranking:"Ranking de operarios según horas trabajadas, días activos y equipos operados.",
    chc:"ICHC = Indicador de Control de Horas Contratadas: compara las horas efectivamente trabajadas contra las horas pactadas por contrato (180 hs/mes por equipo).",
    mant:"RMA15 = Registro de Mantenimiento: órdenes de trabajo (OT), insumos y costos de mantenimiento de cada equipo.",
    distMant:"Calendario mensual de mantenimientos preventivos y correctivos por equipo. Incluye KPI de correctivos realizados pocos días después de un preventivo.",
    rma15CtrlEquipo:"Ficha por equipo de RMA15: muestra día por turno el tipo de mantenimiento, km/hs, reparación, estado operativo, observaciones e insumos utilizados.",
    costosMant:"Resume los costos de mantenimiento, mano de obra y amortización. Permite analizar costos mensuales acumulados y obtener costos por hora en USD por equipo.",
    costosUnitarios:"Listado de artículos de la Base de datos costos: código, artículo y precio unitario usado para valorizar insumos de mantenimiento.",
    licitaciones:"Módulo para crear, comparar y guardar análisis de costos de licitaciones, incluyendo equipos, convenios, hombre vestido y gastos generales.",
    control:"Cruza ROP02 (partes diarios) contra ROP05 (producción) para detectar registros de un lado que no tienen su contraparte en el otro (turnos sin producción cargada o producción sin parte diario).",
  };
  const SW=sidebarOpen?240:64;
  const openModuleFromWelcome=useCallback((module,targetView)=>{
    // Navegación inmediata: el click cambia la pantalla en el mismo tick.
    // La carga pesada queda en los effects en segundo plano.
    setActiveModule(module||"oficina");
    setSidebarOpen(true);
    setView(targetView||"rop02");
  },[]);
  const navigateToView=useCallback((targetView)=>{
    // No envolver en startTransition: hacía que, si había precarga/cálculos, el click pareciera congelado.
    if(targetView==="bienvenida")setActiveModule("home");
    setView(targetView);
  },[]);
  const displayedNavStructure=useMemo(()=>{
    if(esAdministrativo){
      if(activeModule==="administrativoSolicitudes"){
        return [
          {id:"bienvenida",icon:"home",label:"Bienvenida",type:"item",color:C.accent},
          {id:"grp_control_solicitudes",icon:"report",label:"Control de solicitudes",type:"group",color:C.yellow,children:[
            {id:"abastecimiento",icon:"report",label:"Solicitudes"},
            {id:"abastecimientoPendientes",icon:"warn",label:"Pendientes"},
            {id:"abastecimientoParciales",icon:"report",label:"Parciales"},
            {id:"abastecimientoCerradas",icon:"check",label:"Cerradas"},
            {id:"abastecimientoRechazadas",icon:"close",label:"Solicitudes rechazadas"},
          ]},
        ];
      }
      return [
        {id:"bienvenida",icon:"home",label:"Bienvenida",type:"item",color:C.accent},
        {id:"grp_control_rop02",icon:"shieldCheck",label:"Control de ROP02",type:"group",color:C.accent,children:[
          {id:"controlErrores",icon:"circleAlert",label:"Control de errores"},
          {id:"ctrlEquipo",icon:"clipboardCheck",label:"Control por Equipo"},
          {id:"atrasoROP02",icon:"warn",label:"Atraso"},
        ]},
        {id:"control",icon:"clipboardCheck",label:"Control ROP05 vs ROP02",type:"item",color:C.blue,badge:(control.problemasPost31??0)>0?control.problemasPost31:null},
      ];
    }
    if(activeModule==="calidad"){
      return [
        {id:"bienvenida",icon:"home",label:"Bienvenida",type:"item",color:C.accent},
        {id:"chc",icon:"clipboardList",label:"ICHC",type:"item",color:C.green},
      ];
    }
    if(activeModule==="mantenimiento"){
      return [
        {id:"bienvenida",icon:"home",label:"Bienvenida",type:"item",color:C.accent},
        {id:"grp_rma15",icon:"gear",label:"RMA15",type:"group",color:C.yellow,children:[
          {id:"mant",icon:"wrench",label:"Mantenimiento"},
          {id:"distMant",icon:"consist",label:"Distribución de mantenimientos"},
          {id:"rma15CtrlEquipo",icon:"hardHat",label:"Control por Equipo"},
          {id:"costosMant",icon:"fileBarChart",label:"Informe de Costos"},
          {id:"costosUnitarios",icon:"badgeDollarSign",label:"Costos Unitarios",badge:costosUnitariosBadge>0?costosUnitariosBadge:null},
        ]},
      ];
    }
    if(activeModule==="tallerCentral"){
      return [
        {id:"bienvenida",icon:"home",label:"Bienvenida",type:"item",color:C.accent},
        {id:"tallerCentral",icon:"database",label:"Taller Central",type:"item",color:C.teal},
      ];
    }
    if(activeModule==="licitaciones"){
      return [
        {id:"bienvenida",icon:"home",label:"Bienvenida",type:"item",color:C.accent},
        {id:"licitacionesNueva",icon:"fileSpreadsheet",label:"Nueva Licitación",type:"item",color:C.blue},
        {id:"licitacionesControl",icon:"dashboard",label:"Control de Licitaciones",type:"item",color:C.green},
        {id:"licitacionesEquipos",icon:"truck",label:"Costos de Equipos",type:"item",color:C.accent},
        {id:"costosMant",icon:"fileBarChart",label:"Informe de Costos",type:"item",color:C.yellow},
      ];
    }
    if(activeModule==="abastecimiento"){
      return [
        {id:"bienvenida",icon:"home",label:"Bienvenida",type:"item",color:C.accent},
        {id:"grp_abastecimiento",icon:"report",label:"Abastecimiento",type:"group",color:C.yellow,children:[
          {id:"abastecimientoDashboard",icon:"dashboard",label:"Dashboard"},
          {id:"abastecimientoRABA03",icon:"fileSpreadsheet",label:"RABA03"},
          {id:"abastecimientoRemito",icon:"truck",label:"Remito"},
        ]},
        {id:"grp_solicitudes",icon:"clipboardList",label:"Solicitudes",type:"group",color:C.accent,children:[
          {id:"abastecimiento",icon:"report",label:"Realizadas"},
          {id:"abastecimientoPendientes",icon:"warn",label:"Pendientes"},
          {id:"abastecimientoParciales",icon:"report",label:"Parciales"},
          {id:"abastecimientoCerradas",icon:"check",label:"Cerradas"},
          {id:"abastecimientoRechazadas",icon:"close",label:"Rechazadas"},
          {id:"abastecimientoEnviosSinSolicitud",icon:"warn",label:"Envíos sin solicitud"},
        ]},
        {id:"abastecimientoEditarCodigos",icon:"fileSpreadsheet",label:"Editar códigos",type:"item",color:C.blue},
        {id:"grp_stockcritico",icon:"database",label:"Stock crítico",type:"group",color:C.teal,children:[
          {id:"abastecimientoStockDashboard",icon:"dashboard",label:"Dashboard Stock"},
          {id:"abastecimientoStock",icon:"database",label:"Control de stock"},
        ]},
      ];
    }
    return navStructure.filter(item=>!["dashboard","chc"].includes(item.id));
  },[activeModule,navStructure,costosUnitariosBadge,control.problemasPost31,esAdministrativo]);
  const vistasAdministrativo=new Set(["bienvenida","controlErrores","ctrlEquipo","atrasoROP02","control","abastecimiento","abastecimientoPendientes","abastecimientoParciales","abastecimientoCerradas","abastecimientoRechazadas"]);
  useEffect(()=>{
    if(esAdministrativo&&!vistasAdministrativo.has(view)){
      setView("bienvenida");
      setActiveModule("home");
    }
  },[esAdministrativo,view]);
  const showSidebar=view!=="bienvenida";

  const cambiarUsuario=useCallback(()=>{
    ["dm_auth","dm_user","dm_role","dm_project","dm_name","dm_area","dm_must_change_password"].forEach(k=>sessionStorage.removeItem(k));
    setAuth(false);
    setView("bienvenida");
    setActiveModule("home");
  },[]);

  if(!auth)return<Login C={C} APPS_SCRIPT_URL={APPS_SCRIPT_URL} IMG_LOGIN_FONDO={IMG_LOGIN_FONDO} LOGO={LOGO} dmNormalizeAssignedProject={dmNormalizeAssignedProject} onLogin={()=>{sessionStorage.setItem("dm_auth","1");setForcePasswordChange(sessionStorage.getItem("dm_must_change_password")==="1");setAuth(true);}}/>;
  return(
    <>
      <style>{STYLES}</style>
      <UserSettingsModal
        APPS_SCRIPT_URL={APPS_SCRIPT_URL}
        C={C}
        Spinner={Spinner}
        Icon={Icon}
        open={settingsOpen||forcePasswordChange}
        forced={forcePasswordChange}
        onClose={()=>setSettingsOpen(false)}
        onSaved={()=>{setSettingsOpen(false);setForcePasswordChange(false);setProfileRevision(v=>v+1);}}
      />
      {appDialog&&ReactDOM.createPortal(
        <div role="dialog" aria-modal="true" style={{position:"fixed",inset:0,zIndex:2147483647,background:"rgba(0,0,0,.62)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onMouseDown={e=>{if(e.target===e.currentTarget&&appDialog.type!=="confirm")closeAppDialog(true);}}>
          <div style={{width:"min(440px,calc(100vw - 32px))",background:"rgba(25,25,25,.98)",border:`1px solid ${appDialog.type==="confirm"?C.yellow:C.red}66`,borderRadius:16,boxShadow:"0 24px 70px rgba(0,0,0,.55)",overflow:"hidden",fontFamily:"Inter,Arial,sans-serif"}}>
            <div style={{padding:"16px 18px 10px",fontSize:15,fontWeight:900,color:C.text,borderBottom:`1px solid ${C.border}55`}}>{appDialog.title||"Aviso"}</div>
            <div style={{padding:"18px",fontSize:13,lineHeight:1.55,color:C.textSub,whiteSpace:"pre-wrap"}}>{appDialog.message}</div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:10,padding:"0 18px 18px"}}>
              {appDialog.type==="confirm"&&<button autoFocus onClick={()=>closeAppDialog(false)} style={{border:`1px solid ${C.border}`,background:C.surface,color:C.textSub,borderRadius:10,padding:"9px 16px",fontWeight:800,cursor:"pointer"}}>Cancelar</button>}
              <button autoFocus={appDialog.type!=="confirm"} onClick={()=>closeAppDialog(true)} style={{border:`1px solid ${appDialog.type==="confirm"?C.yellow:C.red}88`,background:appDialog.type==="confirm"?`${C.yellow}20`:`${C.red}20`,color:appDialog.type==="confirm"?C.yellow:C.red,borderRadius:10,padding:"9px 18px",fontWeight:900,cursor:"pointer"}}>Aceptar</button>
            </div>
          </div>
        </div>,document.body
      )}
      <div style={{display:"flex",height:"100vh",overflow:"hidden",background:"transparent"}}>
        {showSidebar&&(
        <div style={{width:SW,flexShrink:0,background:"rgba(22,22,22,0.55)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",borderRight:`1px solid ${C.border}44`,display:"flex",flexDirection:"column",transition:"width .25s ease",overflow:"hidden",position:"relative"}}>
          <div style={{padding:sidebarOpen?"18px 16px 14px":"18px 0 14px",borderBottom:`1px solid ${C.border}33`,display:"flex",alignItems:"center",gap:8,justifyContent:sidebarOpen?"flex-start":"center",minHeight:88,transition:"padding .25s ease"}}>
            {sidebarOpen&&(<div style={{display:"flex",alignItems:"center",gap:6}}><img src={LOGO} alt="Delta Mining" style={{height:58,display:"block",padding:"4px 6px",background:"transparent"}}/><div style={{display:"flex",flexDirection:"column",lineHeight:1.1}}><span style={{fontFamily:"Inter",fontWeight:800,fontSize:16,color:C.accent}}>DELTA MINING</span><span style={{fontFamily:"Inter",fontWeight:700,fontSize:16,color:C.accent}}>APP</span></div></div>)}
            <button
              onClick={()=>setSidebarOpen(o=>!o)}
              title={sidebarOpen?"Ocultar barra lateral":"Mostrar barra lateral"}
              style={{position:"absolute",top:14,right:10,width:28,height:28,background:"rgba(255,255,255,.04)",border:`1px solid ${C.border}55`,borderRadius:8,cursor:"pointer",color:C.textSub,padding:0,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"background .15s ease,border-color .15s ease,color .15s ease"}}
            >
              <Icon name={sidebarOpen?"chevronLeft":"chevronRight"} size={18} color="currentColor"/>
            </button>
          </div>
          <nav style={{flex:1,padding:"8px 0",overflowY:"auto"}}>
            {displayedNavStructure.map(item=>{
              if(item.type==="group"){
                const open=!!navOpen[item.id];
                return(
                  <div key={item.id}>
                    <button onClick={()=>setNavOpen(o=>({...o,[item.id]:!o[item.id]}))}
                      {...navTooltipProps(item.label)}
                      title={!sidebarOpen?item.label:undefined}
                      style={{width:"100%",background:"none",border:"none",borderLeft:`2px solid ${item.color}55`,padding:sidebarOpen?"10px 14px":"10px 0",display:"flex",alignItems:"center",gap:9,justifyContent:sidebarOpen?"flex-start":"center",cursor:"pointer",transition:"all .15s"}}>
                      <Icon name={item.icon} size={17} color={item.color}/>
                      {sidebarOpen&&(<>
                        <span style={{fontSize:12,fontWeight:600,color:C.textSub,flex:1,textAlign:"left"}}>{item.label}</span>
                        <Icon name="chevronDown" size={14} color={C.textMuted} style={{transform:open?"rotate(0deg)":"rotate(-90deg)",transition:"transform .15s"}}/>
                      </>)}
                    </button>
                    {open&&item.children.map(child=>{
                      const active=view===child.id;
                      return(
                        <button key={child.id} onClick={()=>navigateToView(child.id)}
                          {...navTooltipProps(child.label)}
                          title={!sidebarOpen?child.label:undefined}
                          style={{width:"100%",background:active?C.accentDim:"none",border:"none",borderLeft:`2px solid ${active?C.accent:item.color+"22"}`,padding:sidebarOpen?"10px 14px 10px 28px":"10px 0",display:"flex",alignItems:"center",gap:9,justifyContent:sidebarOpen?"flex-start":"center",cursor:"pointer",transition:"all .15s"}}>
                          <Icon name={child.icon} size={17} color={active?C.accent:item.color+"cc"}/>
                          {sidebarOpen&&(<><span style={{fontSize:12,fontWeight:500,color:active?C.accent:C.textSub,flex:1,textAlign:"left"}}>{child.label}</span>{child.badge&&<span style={{background:C.red,color:"#fff",borderRadius:9,fontSize:9,fontWeight:700,padding:"1px 5px"}}>{child.badge}</span>}</>)}
                        </button>
                      );
                    })}
                  </div>
                );
              }
              const active=view===item.id;
              return(
                <button key={item.id} onClick={()=>navigateToView(item.id)}
                  {...navTooltipProps(item.label)}
                  title={!sidebarOpen?item.label:undefined}
                  style={{width:"100%",background:active?C.accentDim:"none",border:"none",borderLeft:`2px solid ${active?C.accent:item.color+"22"}`,padding:sidebarOpen?"10px 14px":"10px 0",display:"flex",alignItems:"center",gap:9,justifyContent:sidebarOpen?"flex-start":"center",cursor:"pointer",transition:"all .15s"}}>
                  <Icon name={item.icon} size={17} color={active?C.accent:item.color}/>
                  {sidebarOpen&&(<><span style={{fontSize:12,fontWeight:500,color:active?C.accent:C.textSub,flex:1,textAlign:"left"}}>{item.label}</span>{item.badge&&<span style={{background:C.red,color:"#fff",borderRadius:9,fontSize:9,fontWeight:700,padding:"1px 5px"}}>{item.badge}</span>}</>)}
                </button>
              );
            })}
          </nav>
          <div style={{padding:sidebarOpen?"10px 12px 14px":"10px 0 14px",borderTop:`1px solid ${C.border}44`}}>
            <button type="button" onClick={()=>setSettingsOpen(true)} {...navTooltipProps("Configuración")} title={!sidebarOpen?"Configuración":undefined} style={{width:"100%",background:"rgba(255,255,255,.035)",border:`1px solid ${C.border}55`,borderRadius:9,padding:sidebarOpen?"10px 12px":"10px 0",display:"flex",alignItems:"center",justifyContent:sidebarOpen?"flex-start":"center",gap:9,color:C.textSub,cursor:"pointer"}}>
              <Icon name="gear" size={18} color={C.textSub}/>
              {sidebarOpen&&<span style={{fontSize:12,fontWeight:700}}>Configuración</span>}
            </button>
          </div>
        </div>
        )}
        {showSidebar&&sidebarTooltip&&!sidebarOpen&&(<div style={{position:"fixed",left:sidebarTooltip.x,top:sidebarTooltip.y,transform:"translateY(-50%)",background:"rgba(18,18,18,.96)",border:`1px solid ${C.border}`,boxShadow:"0 10px 24px rgba(0,0,0,.35)",borderRadius:8,padding:"7px 10px",fontSize:12,fontWeight:700,color:C.text,whiteSpace:"nowrap",zIndex:9999,pointerEvents:"none"}}>{sidebarTooltip.label}</div>)}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:"transparent",transition:"all .25s ease"}}>
          {showSidebar&&(<div style={{height:50,flexShrink:0,background:"rgba(22,22,22,0.65)",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",borderBottom:`1px solid ${C.border}44`,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 18px"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
              <h1 style={{fontFamily:"Inter",fontWeight:700,fontSize:14,color:C.text,whiteSpace:"nowrap"}}>{titles[view]}</h1>
              {titleHelp[view]&&<HelpTip text={titleHelp[view]}/>}
              {pwaInstallAvailable&&<button type="button" onClick={installPwa} style={{display:"flex",alignItems:"center",gap:6,marginLeft:14,padding:"6px 12px",borderRadius:7,border:`1px solid ${C.blue}66`,background:C.blueDim,color:C.blue,fontSize:11,fontWeight:700,fontFamily:"Inter",cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
                <span aria-hidden="true">⬇</span> Instalar aplicación
              </button>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:7,padding:"5px 9px",borderRadius:7,background:"rgba(0,0,0,.18)",border:`1px solid ${C.border}55`,minWidth:0,maxWidth:"52vw",whiteSpace:"nowrap",overflow:"hidden"}}>
                <Icon name="user" size={13} color={C.textSub}/>
                <span style={{fontSize:10,color:C.textSub,overflow:"hidden",textOverflow:"ellipsis"}}>
                  <strong style={{color:C.text}}>{nombreUsuario}</strong>
                  <span style={{color:C.textMuted}}> · {rolUsuario} · </span>
                  <strong style={{color:C.yellow}}>{areaUsuario||"SIN ÁREA"}</strong>
                  <span style={{color:C.textMuted}}> · </span>
                  <strong style={{color:proyectoRestringido?C.blue:C.green}}>{proyectoUsuario}</strong>
                </span>
              </div>
              {syncing&&<span style={{fontSize:11,color:C.textSub,fontWeight:600}}>Actualizando datos...</span>}
              {lastUpdate&&<span style={{fontSize:10,color:C.textMuted}}>Actualizado: {lastUpdate.toLocaleTimeString("es-AR")}</span>}
              <button onClick={loadData} disabled={loading||syncing} style={{display:"flex",alignItems:"center",gap:5,background:C.accentDim,border:`1px solid ${C.accent}44`,borderRadius:7,padding:"6px 12px",cursor:loading?"not-allowed":"pointer",color:C.accent,fontSize:12,fontWeight:600,fontFamily:"Inter",flexShrink:0}}>
                {loading||syncing?<Spinner size={12}/>:<Icon name="refresh" size={13} color={C.accent}/>}
                {loading||syncing?"Cargando...":"Actualizar"}
              </button>
            </div>
          </div>)}
          <div style={{flex:1,overflow:"auto",padding:showSidebar?16:0,background:"transparent"}}>
            {areaRequeridaVista&&!puedeEditarVista&&view!=="bienvenida"&&(
              <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:12,padding:"10px 13px",background:`${C.blue}12`,border:`1px solid ${C.blue}55`,borderRadius:9,color:C.textSub,fontSize:12,fontWeight:700}}>
                <Icon name="eye" size={14} color={C.blue}/>
                Modo solo lectura. El usuario pertenece a <strong style={{color:C.text}}>{areaUsuario||"SIN ÁREA"}</strong>. Solo <strong style={{color:C.blue}}>{areaRequeridaVista}</strong> y <strong style={{color:C.accent}}>OFICINA TÉCNICA</strong> pueden realizar modificaciones en esta sección.
              </div>
            )}
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
            {!fatalError&&(loading&&!lastUpdate&&Object.keys(rawSources).length===0||(view==="dashboard"&&loading&&Object.keys(rawSources).length===0))&&(
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"60vh",gap:14}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <LoadingMotoniveladora size={340}/>
                </div>
                <div style={{color:C.text,fontSize:22,fontWeight:800}}>Cargando datos...</div>
                <div style={{color:C.textMuted,fontSize:13}}>Sincronizando información</div>
              </div>
            )}
            {!fatalError&&(lastUpdate||Object.keys(rawSources).length>0||(!loading&&!fatalError))&&!(view==="dashboard"&&loading&&Object.keys(rawSources).length===0)&&(
              <>
                {view==="bienvenida"&&<ViewBienvenida nombreUsuario={nombreUsuario} esAdministrativo={esAdministrativo} onCambiarUsuario={cambiarUsuario} onOpenModule={openModuleFromWelcome} listaEquipos={listaEquipos} rop02All={rop02All} onReloadLista={()=>loadSources(["lista_equipos"],{force:true})} C={C}/>}
                {["dashboard","listaEquipos","tallerCentral","rop02","horometros","vehiculos","controlROP02","controlErrores","ctrlEquipo","atrasoROP02","combustible","rop05","rop05Discriminacion","rma15CtrlEquipo","chc","control"].includes(view)&&<OficinaTecnicaRoute
                  view={view} deps={createOficinaTecnicaDeps(BlockingDataLoader)} dataHydrated={dataHydrated} rawSources={rawSources}
                  sourceHasData={sourceHasData} listaEquipos={listaEquipos} rop02All={rop02All} rop05={rop05} rma15={rma15}
                  control={control} dashSt={dashSt} setDashSt={setDashSt} health={health} loading={loading}
                  onLoadAll={()=>loadSources(["lista_equipos","rop02_fs","rop02_jm","rop02_filosur","rop02_zorro","rop05","rma15_fs","rma15_jm","insumos"])}
                  onReloadLista={()=>loadSources(["lista_equipos"],{force:true})}
                  st02={st02} setSt02={setSt02} stHorometros={stHorometros} setStHorometros={setStHorometros}
                  stVeh={stVeh} setStVeh={setStVeh} stControlROP02={stControlROP02} setStControlROP02={setStControlROP02}
                  stControlErrores={stControlErrores} setStControlErrores={setStControlErrores} stCtrlEquipo={stCtrlEquipo} setStCtrlEquipo={setStCtrlEquipo}
                  stComb={stComb} setStComb={setStComb} st05={st05} setSt05={setSt05}
                  stRma15CtrlEquipo={stRma15CtrlEquipo} setStRma15CtrlEquipo={setStRma15CtrlEquipo}
                  stCHC={stCHC} setStCHC={setStCHC} stCtrl={stCtrl} setStCtrl={setStCtrl}
                />}
                {view==="cambiosTurno"&&(dataHydrated&&rop02All.length>0?<ViewCambiosTurno deps={OPERATIONAL_ANALYTICS_DEPS} rop02All={rop02All}/>:<BlockingDataLoader label="Cargando cambios de turno..." />)}
                {view==="ranking"&&(dataHydrated&&rop02All.length>0?<ViewRankingOperarios deps={OPERATIONAL_ANALYTICS_DEPS} rop02All={rop02All} rop05={rop05} extState={stRanking} setExtState={setStRanking}/>:<BlockingDataLoader label="Cargando Ranking..." />)}
                {view==="mant"&&(viewDataReady?<MantenimientoRoute mode="mantenimiento" deps={MANTENIMIENTO_DEPS} rma15={rma15} insumos={insumos} usdRate={usdRate} extState={stMant} setExtState={setStMant}/>:<BlockingDataLoader label="Cargando" />)}
                {view==="distMant"&&(dataHydrated&&rma15.length>0?<MantenimientoRoute mode="distribucion" deps={MANTENIMIENTO_DEPS} rma15={rma15}/>:<BlockingDataLoader label="Cargando Distribución de mantenimientos..." />)}
                {view==="costosMant"&&(dataHydrated&&rma15.length>0?<InformeCostosRoute rma15={rma15} insumos={insumos} listaEquipos={listaEquipos} usdRate={usdRate} deps={INFORME_COSTOS_DEPS}/>:<BlockingDataLoader label="Cargando Informe de Costos..." />)}
                {view==="costosUnitarios"&&(dataHydrated&&Object.keys(insumos||{}).length>0?<ViewCostosUnitarios deps={COSTOS_UNITARIOS_DEPS} insumos={insumos} rma15={rma15} usdRate={usdRate}/>:<BlockingDataLoader label="Cargando Costos Unitarios..." />)}
                {["abastecimiento","abastecimientoDashboard","abastecimientoPendientes","abastecimientoParciales","abastecimientoCerradas","abastecimientoRechazadas","abastecimientoEnviosSinSolicitud","abastecimientoRemito","abastecimientoStock","abastecimientoStockDashboard","abastecimientoRABA03","abastecimientoEditarCodigos"].includes(view)&&(<AbastecimientoRoute deps={ABASTECIMIENTO_DEPS} readOnly={!dmCanEditArea("ABASTECIMIENTO")} assignedProject={proyectoUsuario} initialTab={({abastecimiento:"solicitudes",abastecimientoDashboard:"dashboard",abastecimientoEditarCodigos:"editarCodigos",abastecimientoPendientes:"pendientes",abastecimientoParciales:"parciales",abastecimientoCerradas:"cerradas",abastecimientoRechazadas:"rechazadas",abastecimientoEnviosSinSolicitud:"enviosSinSolicitud",abastecimientoRemito:"remito",abastecimientoStock:"stock",abastecimientoStockDashboard:"stockDashboard",abastecimientoRABA03:"raba03"})[view]}/>) }
                {["licitaciones","licitacionesNueva","licitacionesControl","licitacionesEquipos"].includes(view)&&<LicitacionesRoute deps={LICITACIONES_DEPS} listaEquipos={listaEquipos} initialTab={({"licitaciones":"nueva","licitacionesNueva":"nueva","licitacionesControl":"control","licitacionesEquipos":"equipos"})[view]}/>}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
