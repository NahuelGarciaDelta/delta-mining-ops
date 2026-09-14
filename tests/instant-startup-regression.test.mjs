import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const cache=fs.readFileSync(new URL("../src/services/appCache.js",import.meta.url),"utf8");
const plugin=fs.readFileSync(new URL("../scripts/intelligent-refresh-vite-plugin.mjs",import.meta.url),"utf8");
const views=fs.readFileSync(new URL("../src/config/viewSources.js",import.meta.url),"utf8");

test("IndexedDB acepta ROP02 independientes sin exigir bundleId",()=>{
  assert.doesNotMatch(cache,/atomicRop02Records_/);
  assert.doesNotMatch(cache,/bundleIds/);
  assert.match(cache,/return Object\.fromEntries\(wanted\.map/);
});

test("arranque pinta cache antes de red y usa cuatro workers",()=>{
  assert.match(plugin,/rawSourcesRef\.current=cachedRaw/);
  assert.match(plugin,/loadedSourcesRef\.current=cachedLoaded/);
  assert.match(plugin,/runWithConcurrency_\(toCheck,4/);
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
