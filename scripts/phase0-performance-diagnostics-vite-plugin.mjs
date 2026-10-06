const normalizeId=id=>String(id||"").replace(/\\/g,"/");

function replaceOnce(code,needle,replacement,label){
  code=code.replace(/\r\n/g,"\n");
  if(!code.includes(needle))throw new Error(`[phase0-performance] No se encontró ${label}`);
  return code.replace(needle,replacement);
}

function transformMain(code){
  code=replaceOnce(
    code,
    'import {installWelcomeRefreshButton} from "./services/welcomeRefreshButton.js";\n',
    'import {installWelcomeRefreshButton} from "./services/welcomeRefreshButton.js";\nimport {installPerformanceDiagnostics,markPerf} from "./services/performanceDiagnostics.js";\n',
    "import de main.jsx",
  );
  code=replaceOnce(
    code,
    '// Una sola política para toda la aplicación: cache inmediato + revalidación cada 5 minutos.\n',
    'installPerformanceDiagnostics();\nmarkPerf("app:bootstrap",{readyState:typeof document!=="undefined"?document.readyState:""});\n\n// Una sola política para toda la aplicación: cache inmediato + revalidación cada 5 minutos.\n',
    "instalación de diagnósticos en main.jsx",
  );
  code=replaceOnce(
    code,
    'function mountApp(){\n  // No se precalientan datasets antes del primer render. La hidratación normal de App\n',
    'function mountApp(){\n  markPerf("app:mount-start");\n  // No se precalientan datasets antes del primer render. La hidratación normal de App\n',
    "inicio de mountApp",
  );
  code=replaceOnce(
    code,
    '  );\n  preloadFrequentModules();\n}\nmountApp();\n',
    '  );\n  markPerf("app:mount-rendered");\n  preloadFrequentModules();\n}\nmountApp();\n',
    "fin de mountApp",
  );
  return code;
}

function transformApp(code){
  code=replaceOnce(
    code,
    'import { runRefreshTasks } from "./services/refreshManager.js";\n',
    'import { runRefreshTasks } from "./services/refreshManager.js";\nimport {beginPerfSpan,markPerf,markViewReady,markViewStart,recordCacheRead} from "./services/performanceDiagnostics.js";\n',
    "import de App.jsx",
  );
  code=replaceOnce(
    code,
    '  const[activeModule,setActiveModule]=useState("home");\n',
    '  const[activeModule,setActiveModule]=useState("home");\n  useEffect(()=>{markViewStart(view,activeModule);},[view,activeModule]);\n',
    "medición de inicio de vista",
  );
  code=replaceOnce(
    code,
    '  const[dataHydrated,setDataHydrated]=useState(false);\n',
    '  const[dataHydrated,setDataHydrated]=useState(false);\n  useEffect(()=>{\n    if(!dataHydrated)return;\n    const sources=rawSourcesRef.current||{};\n    const rows=Object.values(sources).reduce((sum,source)=>sum+(Array.isArray(source?.data)?source.data.length:0),0);\n    markPerf("app:data-hydrated",{sourceCount:Object.keys(sources).length,rows});\n  },[dataHydrated]);\n',
    "medición de hidratación",
  );
  code=replaceOnce(
    code,
    '  const BlockingDataLoader=useCallback(({label="Cargando"})=>(\n',
    '  useEffect(()=>{if(viewDataReady)markViewReady(view,activeModule,{dataHydrated});},[view,activeModule,viewDataReady,dataHydrated]);\n\n  const BlockingDataLoader=useCallback(({label="Cargando"})=>(\n',
    "medición de vista lista",
  );
  code=replaceOnce(
    code,
    '    const recordMap=await readCachedSourceRecords(keys).catch(()=>({}));\n',
    '    const recordMap=await readCachedSourceRecords(keys).catch(()=>({}));\n    recordCacheRead(keys,recordMap);\n',
    "medición de lectura de cache",
  );
  code=replaceOnce(
    code,
    '    if(!requested.length)return;\n\n    setFatalError(null);\n',
    '    if(!requested.length)return;\n    const finishSourcesPerf=beginPerfSpan("sources:load",{sources:requested,force,background});\n\n    setFatalError(null);\n',
    "inicio de loadSources",
  );
  code=replaceOnce(
    code,
    '    if(!toCheck.length)return;\n',
    '    if(!toCheck.length){finishSourcesPerf({checked:0,cacheOnly:true});return;}\n',
    "loadSources sin red",
  );
  code=replaceOnce(
    code,
    '    }finally{\n      setLoading(false);\n      if(background||hasVisible)endBackgroundSync();\n    }\n  },[hydrateSourcesFromCache,fetchOneSource,beginBackgroundSync,endBackgroundSync]);\n',
    '    }finally{\n      finishSourcesPerf({checked:toCheck.length,cacheOnly:false});\n      setLoading(false);\n      if(background||hasVisible)endBackgroundSync();\n    }\n  },[hydrateSourcesFromCache,fetchOneSource,beginBackgroundSync,endBackgroundSync]);\n',
    "fin de loadSources",
  );
  code=replaceOnce(
    code,
    '  const refreshCurrentView=useCallback(async({background=false,reason="manual"}={})=>{\n    const refreshedAt=Date.now();\n',
    '  const refreshCurrentView=useCallback(async({background=false,reason="manual"}={})=>{\n    const finishRefreshPerf=beginPerfSpan("refresh:view",{view,background,reason});\n    const refreshedAt=Date.now();\n',
    "inicio de refreshCurrentView",
  );
  code=replaceOnce(
    code,
    '    }finally{if(!background)setLoading(false);}\n  },[view,loadSources,loadInitial]);\n',
    '    }finally{finishRefreshPerf();if(!background)setLoading(false);}\n  },[view,loadSources,loadInitial]);\n',
    "fin de refreshCurrentView",
  );
  return code;
}

function transformSupabase(code){
  code='import {beginPerfSpan,estimatePerfBytes} from "./performanceDiagnostics.js";\n'+code;
  code=replaceOnce(
    code,
    'export async function fetchSupabaseSource(source){\n  const config=sourceConfig(String(source||""));\n  if(!config)throw new Error(`Fuente ${source} no disponible en Supabase`);\n',
    'export async function fetchSupabaseSource(source){\n  const dataset=String(source||"");\n  const finishDatasetPerf=beginPerfSpan("dataset:load",{dataset,provider:"supabase"});\n  const config=sourceConfig(dataset);\n  if(!config){finishDatasetPerf({ok:false,error:"source-config-missing"});throw new Error(`Fuente ${source} no disponible en Supabase`);}\n',
    "inicio de fetchSupabaseSource",
  );
  code=replaceOnce(
    code,
    '  return {ok:true,source:"supabase",data,meta:{source:String(source||""),rows:data.length,returnedRows:data.length,hasMore:false,serverVersion:latest||Date.now(),serverTime:new Date(latest||Date.now()).toISOString()}};\n}\n',
    '  const result={ok:true,source:"supabase",data,meta:{source:dataset,rows:data.length,returnedRows:data.length,hasMore:false,serverVersion:latest||Date.now(),serverTime:new Date(latest||Date.now()).toISOString()}};\n  const pages=Math.max(1,Math.ceil(raw.length/PAGE_SIZE));\n  finishDatasetPerf({ok:true,table:config.table,rows:data.length,rawRows:raw.length,pages,requests:pages,estimatedBytes:estimatePerfBytes(raw)});\n  return result;\n}\n',
    "fin de fetchSupabaseSource",
  );
  return code;
}

function transformAppCache(code){
  code='import {recordCacheWrite} from "./performanceDiagnostics.js";\n'+code;
  return replaceOnce(
    code,
    'async function writeCachedSources(sources){\n  const entries=Object.entries(sources||{}).filter(([key,data])=>key&&data);\n',
    'async function writeCachedSources(sources){\n  recordCacheWrite(sources);\n  const entries=Object.entries(sources||{}).filter(([key,data])=>key&&data);\n',
    "medición de escritura de cache",
  );
}

export function phase0PerformanceDiagnosticsVitePlugin(){
  return{
    name:"phase0-performance-diagnostics",
    enforce:"pre",
    transform(code,id){
      const file=normalizeId(id).split("?")[0];
      if(file.endsWith("/src/main.jsx"))return{code:transformMain(code),map:null};
      if(file.endsWith("/src/App.jsx"))return{code:transformApp(code),map:null};
      if(file.endsWith("/src/services/supabaseReadApi.js"))return{code:transformSupabase(code),map:null};
      if(file.endsWith("/src/services/appCache.js"))return{code:transformAppCache(code),map:null};
      return null;
    },
  };
}
