import fs from "node:fs";
import {execSync} from "node:child_process";

const appPath="src/App.jsx";

function fail(message){
  console.error("\nERROR:",message);
  process.exit(1);
}

if(!fs.existsSync(appPath)){
  fail("No se encontró src/App.jsx. Descomprimí este ZIP en la raíz del proyecto.");
}

let s=fs.readFileSync(appPath,"utf8");
const original=s;

// Import del precargador histórico
const importAnchor='import { runRefreshTasks } from "./services/refreshManager.js";';
const preloadImport='import { preloadHistoricalDatasets } from "./services/globalPreload.js";';

if(!s.includes(preloadImport)){
  if(!s.includes(importAnchor))fail("No se encontró el import de refreshManager.");
  s=s.replace(importAnchor,`${importAnchor}\n${preloadImport}`);
}

// Lista única de TODAS las fuentes compartidas por las vistas.
const functionAnchor='export default function App(){';
const globalConst=`const ALL_APP_PRELOAD_SOURCES=Object.freeze(
  Array.from(new Set(Object.values(VIEW_SOURCES).flat()))
);

`;
if(!s.includes("ALL_APP_PRELOAD_SOURCES")){
  if(!s.includes(functionAnchor))fail("No se encontró export default function App().");
  s=s.replace(functionAnchor,globalConst+functionAnchor);
}

// Actualizar comentario viejo que decía explícitamente que no se precargaba.
s=s.replace(
`  // loadSources hidrata únicamente las fuentes de la vista activa. Precargar aquí
  // todos los históricos duplicaba grandes datasets en memoria desde Bienvenida.
`,
`  // Las fuentes de la vista activa siguen teniendo prioridad, pero además la app
  // precarga en segundo plano todas las fuentes compartidas para que las demás
  // pestañas abran con datos ya disponibles.
`
);

// Insertar precarga global inmediatamente antes de refreshCurrentView,
// es decir, después de que loadSources ya fue definido.
const marker='  const refreshCurrentView=useCallback(async({background=false,reason="manual"}={})=>{';

if(!s.includes("dm_global_preload_started")){
  if(!s.includes(marker))fail("No se encontró refreshCurrentView; no se pudo ubicar la precarga.");

  const preloadBlock=`  // ─── Precarga global ─────────────────────────────────────────────────────
  // Al autenticarse, llena en segundo plano el cache de TODAS las fuentes comunes.
  // No bloquea Bienvenida ni muestra loaders. Las vistas posteriores reutilizan
  // memoria / local cache y solo comprueban versiones en el servidor.
  const globalPreloadRef=useRef(false);
  useEffect(()=>{
    if(!auth||globalPreloadRef.current)return;
    globalPreloadRef.current=true;
    try{sessionStorage.setItem("dm_global_preload_started","1");}catch(_){}

    let cancelled=false;
    let idleId=null;
    let timeoutId=null;

    const run=async()=>{
      if(cancelled)return;
      try{
        // Primero las fuentes normales que comparten prácticamente todas las vistas.
        await loadSources(ALL_APP_PRELOAD_SOURCES,{background:true});
      }catch(_){}

      if(cancelled)return;

      // Después calienta también el cache usado por query_dataset
      // (ROP02 / ROP05 / RMA15 históricos).
      try{await preloadHistoricalDatasets();}catch(_){}
    };

    if(typeof window.requestIdleCallback==="function"){
      idleId=window.requestIdleCallback(run,{timeout:1500});
    }else{
      timeoutId=window.setTimeout(run,350);
    }

    return()=>{
      cancelled=true;
      if(idleId!=null&&typeof window.cancelIdleCallback==="function"){
        window.cancelIdleCallback(idleId);
      }
      if(timeoutId!=null)window.clearTimeout(timeoutId);
    };
  },[auth,loadSources]);

`;
  s=s.replace(marker,preloadBlock+marker);
}

if(s===original){
  console.log("App.jsx ya tenía aplicada la precarga global.");
}else{
  const backup=appPath+".backup-antes-precarga-global";
  if(!fs.existsSync(backup))fs.copyFileSync(appPath,backup);
  fs.writeFileSync(appPath,s,"utf8");
  console.log("Precarga global aplicada en App.jsx");
  console.log("Backup:",backup);
}

// Validaciones
const checks=[
  ["ALL_APP_PRELOAD_SOURCES",s.includes("ALL_APP_PRELOAD_SOURCES")],
  ["preloadHistoricalDatasets",s.includes("preloadHistoricalDatasets")],
  ["loadSources global",s.includes("loadSources(ALL_APP_PRELOAD_SOURCES")],
];

for(const [name,ok] of checks){
  if(!ok)fail(`Validación fallida: ${name}`);
}

console.log("\nNUEVO COMPORTAMIENTO");
console.log("- Bienvenida aparece normalmente.");
console.log("- En segundo plano se precargan todas las fuentes compartidas.");
console.log("- ROP02, ROP05 y RMA15 históricos también quedan calientes en cache.");
console.log("- Al entrar a otra pestaña, reutiliza datos ya descargados.");
console.log("- Los filtros locales no vuelven a arrancar desde cero.");

try{
  console.log("\nEjecutando npm run build...\n");
  execSync("npm run build",{stdio:"inherit",shell:true});
  console.log("\n========================================");
  console.log("BUILD OK - LISTO PARA PUSH");
  console.log("========================================");
  console.log("\ngit add src/App.jsx src/services/globalPreload.js");
  console.log('git commit -m "Precargar datos de toda la app en segundo plano"');
  console.log("git push origin main");
}catch(error){
  console.error("\nBUILD FALLÓ. No hagas push.");
  process.exit(2);
}
