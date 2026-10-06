import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {phase0PerformanceDiagnosticsVitePlugin} from "../scripts/phase0-performance-diagnostics-vite-plugin.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const plugin=phase0PerformanceDiagnosticsVitePlugin();

function transform(relative){
  const full=path.join(root,relative);
  const code=fs.readFileSync(full,"utf8");
  const result=plugin.transform(code,full);
  assert.ok(result?.code,`Se esperaba transformación para ${relative}`);
  return result.code;
}

test("instrumenta main sin cambiar la política funcional",()=>{
  const code=transform("src/main.jsx");
  assert.match(code,/installPerformanceDiagnostics\(\)/);
  assert.match(code,/markPerf\("app:mount-start"\)/);
  assert.match(code,/preloadFrequentModules\(\)/);
  assert.match(code,/dispatchDataRefreshPolicyTick\("auto"\)/);
});

test("instrumenta App para vista, cache, cargas y refresh",()=>{
  const code=transform("src/App.jsx");
  assert.match(code,/markViewStart\(view,activeModule\)/);
  assert.match(code,/markViewReady\(view,activeModule/);
  assert.match(code,/recordCacheRead\(keys,recordMap\)/);
  assert.match(code,/beginPerfSpan\("sources:load"/);
  assert.match(code,/beginPerfSpan\("refresh:view"/);
  assert.match(code,/runRefreshTasks\(view,/);
});

test("instrumenta cargas Supabase sin alterar select ni filtros",()=>{
  const original=fs.readFileSync(path.join(root,"src/services/supabaseReadApi.js"),"utf8");
  const code=transform("src/services/supabaseReadApi.js");
  assert.match(code,/beginPerfSpan\("dataset:load"/);
  assert.match(code,/estimatedBytes:estimatePerfBytes\(raw\)/);
  assert.equal((code.match(/select:\"\*\"/g)||[]).length,(original.match(/select:\"\*\"/g)||[]).length);
  assert.match(code,/const PAGE_SIZE=1000/);
  assert.match(code,/const PAGE_CONCURRENCY=4/);
});

test("instrumenta escrituras de cache sin cambiar su implementación",()=>{
  const code=transform("src/services/appCache.js");
  assert.match(code,/recordCacheWrite\(sources\)/);
  assert.match(code,/store\.put\(rec\)/);
  assert.match(code,/APP_IDB_STORE=\"datasets\"/);
});

test("no transforma archivos ajenos a la Fase 0",()=>{
  const result=plugin.transform("export const x=1;",path.join(root,"src/other.js"));
  assert.equal(result,null);
});
