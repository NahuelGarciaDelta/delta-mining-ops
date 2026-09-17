import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const cache=fs.readFileSync(new URL("../src/services/appCache.js",import.meta.url),"utf8");
const plugin=fs.readFileSync(new URL("../scripts/intelligent-refresh-vite-plugin.mjs",import.meta.url),"utf8");
const abastoPlugin=fs.readFileSync(new URL("../scripts/abastecimiento-instant-vite-plugin.mjs",import.meta.url),"utf8");
const views=fs.readFileSync(new URL("../src/config/viewSources.js",import.meta.url),"utf8");
const api=fs.readFileSync(new URL("../src/services/appsScriptApi.js",import.meta.url),"utf8");
const supabaseRead=fs.readFileSync(new URL("../src/services/supabaseReadApi.js",import.meta.url),"utf8");
const proxy=fs.readFileSync(new URL("../api/apps-script.js",import.meta.url),"utf8");
const stockService=fs.readFileSync(new URL("../src/services/stockService.js",import.meta.url),"utf8");
const stockHook=fs.readFileSync(new URL("../src/modules/abastecimiento/stock/useSharedStock.js",import.meta.url),"utf8");

test("IndexedDB acepta ROP02 independientes sin exigir bundleId",()=>{
  assert.doesNotMatch(cache,/atomicRop02Records_/);
  assert.doesNotMatch(cache,/bundleIds/);
  assert.match(cache,/return Object\.fromEntries\(wanted\.map/);
});

test("arranque pinta cache antes de red y publica cada fuente al terminar",()=>{
  assert.match(plugin,/rawSourcesRef\.current=cachedRaw/);
  assert.match(plugin,/loadedSourcesRef\.current=cachedLoaded/);
  assert.match(plugin,/runWithConcurrency_\(toCheck,4/);
  assert.match(plugin,/_publishedImmediately:true/);
  assert.match(plugin,/window\.setTimeout\(run,0\)/);
});

test("refrescos de lectura no fuerzan Sheets ni duplican reintentos",()=>{
  assert.match(plugin,/loadSources\(sources,\{force:false,background\}\)/);
  assert.match(plugin,/retries:0,timeoutMs:isRop02Source\?45000:20000/);
});

test("bienvenida prioriza ROP02 y RMA15 principales y precarga ROP05",()=>{
  assert.match(views,/bienvenida:\["rop02_fs","rop02_jm","rma15_fs","rma15_jm"/);
  assert.match(views,/bienvenida:\[[^\]]*"rop05"/);
});

test("lecturas pesadas usan Supabase y no Apps Script",()=>{
  assert.match(api,/SUPABASE_TYPED_SOURCES\.has/);
  assert.match(api,/fetchSupabaseSource/);
  assert.match(api,/fetchSupabaseDatasetQuery/);
  assert.match(api,/fetchSupabaseVersions/);
  assert.match(supabaseRead,/rop02_frontend/);
  assert.match(supabaseRead,/rma15_frontend/);
  assert.match(supabaseRead,/PAGE_CONCURRENCY=4/);
  // Los datasets pesados usan 45 s para tolerar respuestas grandes sin volver a
  // Apps Script ni introducir reintentos agresivos.
  assert.match(supabaseRead,/REQUEST_TIMEOUT_MS=45000/);
});

test("el pool respeta el limite pedido y coalesce heartbeats de versiones",()=>{
  assert.match(api,/Math\.min\(Math\.max\(1,Number\(limit\)\|\|1\),items\.length\)/);
  assert.match(api,/SYNC_VERSIONS_MEMO_MS=15000/);
  assert.match(api,/syncVersionsMemo_\.promise/);
});

test("el proxy nunca reintenta POST ni repite un timeout",()=>{
  assert.match(proxy,/const maxAttempts = req\.method === "GET" \? 2 : 1/);
  assert.match(proxy,/error\?\.name === "AbortError"/);
  assert.doesNotMatch(proxy,/RETRYABLE_STATUS = new Set\(\[[^\]]*504/);
});

test("Abastecimiento reutiliza RABA03 local y no bloquea si ya existe",()=>{
  assert.match(abastoPlugin,/RABA03_VIEW_CACHE_KEY/);
  assert.match(abastoPlugin,/rows\.length===0/);
  assert.match(abastoPlugin,/Promise\.allSettled/);
});

test("Stock abre desde IndexedDB y se revalida en segundo plano",()=>{
  assert.match(stockService,/STOCK_CACHE_KEY="stock_excel_data"/);
  assert.match(stockService,/readCachedStockData/);
  assert.match(stockHook,/readCachedStockData\(\)/);
  assert.match(stockHook,/load\(\{silent:true\}\)/);
});
