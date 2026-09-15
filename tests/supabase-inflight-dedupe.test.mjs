import test from "node:test";
import assert from "node:assert/strict";
import {fetchSource} from "../src/services/appsScriptApi.js";

test("deduplica lecturas concurrentes de una misma fuente Supabase sin cachear llamadas posteriores",async t=>{
  const originalFetch=globalThis.fetch;
  let calls=0;
  globalThis.fetch=async()=>{
    calls+=1;
    await new Promise(resolve=>setTimeout(resolve,15));
    return{
      ok:true,
      text:async()=>JSON.stringify([{
        source_row:1,
        raw_data:{},
        fecha:"2026-09-14",
        proyecto:"JOSE MARIA",
        interno:"EXC0001",
        horas_productivas:1,
      }]),
      headers:{get:name=>String(name||"").toLowerCase()==="content-range"?"0-0/1":null},
    };
  };
  t.after(()=>{globalThis.fetch=originalFetch;});

  const [first,second]=await Promise.all([
    fetchSource("","rop05"),
    fetchSource("","rop05"),
  ]);

  assert.equal(calls,1,"dos lecturas concurrentes deben compartir una sola petición Supabase");
  assert.deepEqual(first,second);
  assert.equal(first?.data?.length,1);

  await fetchSource("","rop05");
  assert.equal(calls,2,"una lectura posterior debe volver a consultar y no reutilizar datos vencidos");
});
