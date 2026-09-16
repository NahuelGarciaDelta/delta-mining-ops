import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {abastecimientoLineEndingsVitePlugin} from "../scripts/abastecimiento-line-endings-vite-plugin.mjs";
import {localFirstNormalizationVitePlugin} from "../scripts/local-first-normalization-vite-plugin.mjs";
import {registerRefreshTask,runRefreshTasks} from "../src/services/refreshManager.js";

const appPath=new URL("../src/App.jsx",import.meta.url);

function transformPlugin(plugin,code,id="C:/repo/src/App.jsx"){
  const result=plugin.transform(code,id);
  return result?.code??code;
}

test("normalización local-first reemplaza el reprocesamiento monolítico",()=>{
  const source=fs.readFileSync(appPath,"utf8");
  const transformed=transformPlugin(localFirstNormalizationVitePlugin(),source);
  assert.match(transformed,/const normalizedSourcesRef=useRef/);
  assert.match(transformed,/const rop05Changed=cache\.rop05Source!==src\.rop05/);
  assert.match(transformed,/const rop02Changed=rop05Changed\|\|/);
  assert.match(transformed,/const insumosChanged=cache\.insumosSource!==src\.insumos/);
  assert.match(transformed,/const rmaChanged=insumosChanged\|\|/);
  assert.doesNotMatch(transformed,/Normaliza todo cada vez que llega una fuente nueva/);
});

test("normalización local-first funciona con CRLF de Windows",()=>{
  const source=fs.readFileSync(appPath,"utf8").replace(/\r?\n/g,"\r\n");
  const normalized=transformPlugin(abastecimientoLineEndingsVitePlugin(),source);
  const transformed=transformPlugin(localFirstNormalizationVitePlugin(),normalized);
  assert.match(transformed,/normalizedSourcesRef/);
  assert.match(transformed,/setRop02ControlAll\(normalizedRop02\)/);
});

test("refreshManager ejecuta en paralelo tareas de igual prioridad",async()=>{
  const starts=[];
  let release;
  const gate=new Promise(resolve=>{release=resolve;});
  const cleanupA=registerRefreshTask("perf-test-a",async()=>{starts.push("a");await gate;return "A";},{views:["perf-test"],priority:7});
  const cleanupB=registerRefreshTask("perf-test-b",async()=>{starts.push("b");return "B";},{views:["perf-test"],priority:7});
  try{
    const pending=runRefreshTasks("perf-test");
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.deepEqual(new Set(starts),new Set(["a","b"]));
    release();
    const results=await pending;
    assert.equal(results.filter(r=>r.ok).length,2);
  }finally{cleanupA();cleanupB();release?.();}
});

test("refreshManager conserva la barrera entre prioridades",async()=>{
  const events=[];
  let release;
  const gate=new Promise(resolve=>{release=resolve;});
  const cleanupFirst=registerRefreshTask("perf-priority-first",async()=>{events.push("first-start");await gate;events.push("first-end");},{views:["perf-priority"],priority:1});
  const cleanupSecond=registerRefreshTask("perf-priority-second",async()=>{events.push("second-start");},{views:["perf-priority"],priority:2});
  try{
    const pending=runRefreshTasks("perf-priority");
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.deepEqual(events,["first-start"]);
    release();
    await pending;
    assert.deepEqual(events,["first-start","first-end","second-start"]);
  }finally{cleanupFirst();cleanupSecond();release?.();}
});
