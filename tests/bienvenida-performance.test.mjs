import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app=fs.readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
const home=fs.readFileSync(new URL("../src/modules/home/ViewBienvenida.jsx",import.meta.url),"utf8");
const main=fs.readFileSync(new URL("../src/main.jsx",import.meta.url),"utf8");

test("Bienvenida se monta aunque la carga global todavía esté activa",()=>{
  assert.match(app,/view!=="bienvenida"&&\(loading/);
  assert.match(app,/view==="bienvenida"\|\|lastUpdate/);
});

test("Resumen difiere cálculos y muestra loading granular sin ceros falsos",()=>{
  assert.match(home,/requestIdleCallback\(calculate/);
  assert.match(home,/loading:\{\s*flota:/);
  for(const block of ["flota","disponibilidad","ot"]){
    assert.match(home,new RegExp(`summaryLoading\\.${block}`));
  }
  assert.match(home,/loading:\{flota:true,disponibilidad:true,ot:true,stock:true\}/);
  assert.match(home,/sharedStockRows/);
  assert.match(home,/"Cargando…"/);
});

test("Bienvenida reutiliza cache de métricas y stock entre montajes",()=>{
  assert.match(home,/let bienvenidaSummaryCache=null/);
  assert.match(home,/let bienvenidaStockCache=null/);
  assert.match(home,/useState\(\(\)=>bienvenidaSummaryCache\|\|readWelcomeSummaryCache_\(\)/);
  assert.match(home,/if\(!welcomeSnapshotSettled\|\|bienvenidaStockCache\)return/);
  assert.match(home,/WELCOME_SUMMARY_CACHE_MAX_AGE_MS=24\*60\*60\*1000/);
  assert.match(home,/Actualizando…/);
  assert.match(home,/cachedSummaryOnStart\.current&&!\(flotaInputsReady&&otInputsReady\)/);
});

test("Inicio evita precargar historiales completos que no necesita y arranca su carga sin idle delay",()=>{
  const viewSources=fs.readFileSync(new URL("../src/config/viewSources.js",import.meta.url),"utf8");
  assert.match(viewSources,/bienvenida:\["lista_equipos"\]/);
  assert.match(app,/if\(view==="bienvenida"\)\{\s*run\(\);\s*return/);
});

test("la bienvenida se monta sin esperar el catálogo dinámico de ROP02",()=>{
  assert.match(main,/mountApp\(\);\s*bootstrapRop02Catalog\(\)\.then/);
  assert.match(main,/dm-rop02-catalog-ready/);
  assert.match(app,/addEventListener\("dm-rop02-catalog-ready"/);
});

test("el Resumen General conserva Cargando hasta disponer de ROP02 y Lista Maestra",()=>{
  const service=fs.readFileSync(new URL("../src/data/historicalDataService.js",import.meta.url),"utf8");
  assert.match(home,/getRop02LatestByEquipmentProject\(\{welcomeBootstrap:true\}\)/);
  assert.match(home,/const flotaInputsReady=\(fullRop02Ready\|\|Array\.isArray\(snapshotRop02\)\|\|fallbackRop02Settled\)&&listaEquiposReady/);
  assert.match(home,/flota:!flotaInputsReady/);
  assert.match(home,/disponibilidad:!flotaInputsReady\|\|!movimientosLoaded/);
  assert.match(service,/usesExternalHomeFilter_\(\)&&!params\?\.welcomeBootstrap/);
  assert.match(service,/params\?\.welcomeBootstrap\?filtered:filterEquipmentOnlySnapshot_\(filtered\)/);
});

test("Bienvenida prioriza la familia/tipo de Lista Maestra sobre el prefijo de patente",()=>{
  assert.match(home,/classifyHomeEquipment\(code,equipos,\{getMachineType,canonicalize:canonicalEquivalentMachineCode\}\)/);
  assert.match(home,/onLoadWelcomeRop02/);
  const app=fs.readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
  assert.match(app,/onLoadWelcomeRop02=\{loadWelcomeRop02Fallback\}/);
});
