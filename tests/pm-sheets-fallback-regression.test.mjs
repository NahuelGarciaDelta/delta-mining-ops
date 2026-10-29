import test from "node:test";
import assert from "node:assert/strict";
import {fetchAction} from "../src/services/appsScriptApi.js";

const PM_DATA={ok:true,config:[{interno:"TOP-0014",fechaUltimoPM:"2026-10-10"}],
  registros:[{idPM:"PM-1",interno:"TOP-0014",fecha:"2026-10-23",estado:"REALIZADO"}],
  programaciones:[],repuestos:[]};
const response=(value,status=200)=>({
  ok:status>=200&&status<300,status,text:async()=>JSON.stringify(value),headers:{get:()=>null}
});

test("PM usa snapshot Supabase correcto y evita respaldo si responde",async t=>{
  const previous=globalThis.fetch,calls=[];
  globalThis.fetch=async url=>{calls.push(String(url));return response(PM_DATA);};
  t.after(()=>{globalThis.fetch=previous;});
  const actual=await fetchAction("/api/apps-script","mantenimiento_programado",{retries:0});
  assert.equal(actual.ok,true);
  assert.equal(actual.registros.length,1);
  assert.equal(actual.pmReadSource,"supabase");
  assert.equal(calls.length,1);
  assert.match(calls[0],/\/rest\/v1\/rpc\/app_pm_snapshot/);
});

test("PM HTTP 504 vuelve a Google Sheets sin inventar registros",async t=>{
  const previous=globalThis.fetch,calls=[];
  globalThis.fetch=async url=>{
    calls.push(String(url));
    if(String(url).includes("/rest/v1/rpc/app_pm_snapshot"))return response({message:"timeout"},504);
    if(String(url).includes("action=mantenimiento_programado"))return response(PM_DATA);
    throw new Error("Endpoint inesperado");
  };
  t.after(()=>{globalThis.fetch=previous;});
  const actual=await fetchAction("/api/apps-script","mantenimiento_programado",{force:true});
  assert.equal(actual.ok,true);
  assert.equal(actual.registros[0].idPM,"PM-1");
  assert.equal(actual.pmReadSource,"google-sheets-fallback");
  assert.equal(calls.length,2);
});

test("Si el respaldo es incompleto, lanza error en lugar de renderizar cero",async t=>{
  const previous=globalThis.fetch;
  globalThis.fetch=async url=>{
    if(String(url).includes("action=mantenimiento_programado"))
      return response({ok:true,config:[],programaciones:[],repuestos:[]});
    throw new Error("No debería invocar Supabase durante enfriamiento");
  };
  t.after(()=>{globalThis.fetch=previous;});
  await assert.rejects(
    fetchAction("/api/apps-script","mantenimiento_programado"),
    /no devolvió las cuatro colecciones completas/
  );
});
