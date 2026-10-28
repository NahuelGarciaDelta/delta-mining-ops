import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fetchSupabaseVersions,fetchSupabaseVersionsLightweight} from "../src/services/supabaseReadApi.js";

const app=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
const historical=readFileSync(new URL("../src/data/historicalDataService.js",import.meta.url),"utf8");
const supabase=readFileSync(new URL("../src/services/supabaseReadApi.js",import.meta.url),"utf8");

test("Nano: el manifiesto automático jamás consulta tablas privadas ni COUNT(*)",async t=>{
  const before=globalThis.fetch,calls=[];
  globalThis.fetch=async url=>{calls.push(String(url));throw Error("Red no permitida");};
  t.after(()=>{globalThis.fetch=before;});
  assert.equal(await fetchSupabaseVersions(),null);
  assert.deepEqual(calls,[]);
});

test("Diagnóstico opcional consulta una fila por fuente sin pedir COUNT(*)",async t=>{
  const before=globalThis.fetch,calls=[];
  globalThis.fetch=async(url,opts={})=>{
    calls.push({url:String(url),prefer:opts.headers?.Prefer});
    return {ok:true,status:200,text:async()=>JSON.stringify([{synced_at:"2026-10-28T12:34:00.000Z"}]),
      headers:{get:()=>null}};
  };
  t.after(()=>{globalThis.fetch=before;});
  const result=await fetchSupabaseVersionsLightweight();
  assert.equal(result.ok,true);
  assert.equal(Object.keys(result.versions).length,10);
  assert.equal(result.rowCounts,undefined,"un timestamp no confirma cantidad de filas");
  for(const req of calls)assert.notEqual(req.prefer,"count=exact");
});

test("Refresco manual real y ventana de 20 min en caché",()=>{
  assert.match(app,/SYNC_FRESH_MS=20\*60\*1000/);
  assert.match(app,/force:reason==="manual"/);
  assert.doesNotMatch(app,/fetchSyncVersions\(APPS_SCRIPT_URL,\{force:reason==="manual"\}\)/);
  assert.match(app,/La vigencia de la copia local no pudo verificarse/);
});

test("ROP02 falla de forma explícita; no inventa dataset vacío ni deja Promise.race activo",()=>{
  assert.doesNotMatch(historical,/cacheLevel:"rop02-timeout"/);
  assert.doesNotMatch(historical,/const guarded=isLiveDataset_/);
  assert.match(historical,/No se confirmó la fuente/);
  assert.match(historical,/throw error/);
  assert.doesNotMatch(historical,/withHardTimeout_\(/);
  assert.doesNotMatch(historical,/Promise\.allSettled\(sources\.map/);
  assert.match(historical,/total:response\.total\?\?null/);
});

test("Paginación histórica no solicita conteos exactos en ruta principal",()=>{
  const from=supabase.indexOf("async function fetchAll(");
  const to=supabase.indexOf("function yieldMainThread_",from);
  assert.ok(from>=0&&to>from);
  const code=supabase.slice(from,to);
  assert.match(code,/count:false/);
  assert.doesNotMatch(code,/count:true/);
});
