import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fetchSupabaseSource,fetchSupabaseVersions} from "../src/services/supabaseReadApi.js";

test("ROP02 se pagina completo y en orden sin ejecutar count=exact",async t=>{
  const previous=globalThis.fetch,requests=[];
  const total=2057;
  globalThis.fetch=async(url,options={})=>{
    const parsed=new URL(String(url));
    assert.equal(parsed.pathname,"/rest/v1/rop02_frontend");
    assert.equal(options.method,"GET");
    assert.notEqual(options.headers?.Prefer,"count=exact");
    const offset=Number(parsed.searchParams.get("offset")||0);
    const limit=Number(parsed.searchParams.get("limit")||0);
    assert.equal(limit,1000);
    requests.push({offset,limit});
    const count=Math.min(limit,Math.max(total-offset,0));
    const rows=Array.from({length:count},(_,i)=>({
      source_key:`rop02_jm|${offset+i+5}`,fecha:"2026-10-26",interno:"TOP-0014",
      numero_parte:String(offset+i+5),synced_at:"2026-10-27T00:00:00Z"
    }));
    return {ok:true,status:200,text:async()=>JSON.stringify(rows),headers:{get:()=>null}};
  };
  t.after(()=>{globalThis.fetch=previous;});
  const result=await fetchSupabaseSource("rop02_jm");
  assert.equal(result.ok,true);
  assert.equal(result.data.length,total);
  assert.deepEqual(requests.map(r=>r.offset),[0,1000,2000]);
  assert.equal(new Set(result.data.map(r=>r._sourceRow)).size,total);
  assert.equal(result.data[0]._sourceRow,5);
  assert.equal(result.data.at(-1)._sourceRow,2061);
});

test("en indisponibilidad de Supabase no se disparan 10 consultas exactas",async t=>{
  const before=globalThis.fetch;
  const requests=[];
  globalThis.fetch=async(url)=>{
    requests.push(String(url));
    return {ok:false,status:504,text:async()=>JSON.stringify({message:"timeout"}),headers:{get:()=>null}};
  };
  t.after(()=>{globalThis.fetch=before;});
  const manifest=await fetchSupabaseVersions();
  assert.equal(manifest,null);
  assert.equal(requests.length,1);
  assert.match(requests[0],/rpc\/delta_source_versions/);
});

test("error de health es no fatal y la UI advierte copias no verificadas",()=>{
  const app=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
  const views=readFileSync(new URL("../src/config/viewSources.js",import.meta.url),"utf8");
  const plugin=readFileSync(new URL("../scripts/intelligent-refresh-vite-plugin.mjs",import.meta.url),"utf8");
  const api=readFileSync(new URL("../src/services/supabaseReadApi.js",import.meta.url),"utf8");
  const start=app.indexOf("const loadInitial=useCallback");
  const end=app.indexOf("const hydratedCacheKeysRef",start);
  const initial=app.slice(start,end);
  assert.match(initial,/setServiceWarning\(/);
  assert.doesNotMatch(initial,/setFatalError\(/);
  assert.doesNotMatch(initial,/setLastUpdate\(new Date/);
  assert.match(app,/Estado de datos sin confirmar/);
  assert.match(app,/No se pudo verificar si los datos guardados siguen vigentes/);
  assert.match(views,/bienvenida:\["lista_equipos"\]/);
  assert.match(plugin,/runWithConcurrency_\(toCheck,2,async key/);
  assert.match(api,/const limitSupabasePageRequest=createRequestLimiter\(2\)/);
  assert.match(api,/if\(batch\.length<PAGE_SIZE\)return rows/);
  assert.doesNotMatch(api,/const first=await fetchPage\(table,params,0,\{count:true\}\)/);
});
