import test from "node:test";
import assert from "node:assert/strict";
import {fetchSource} from "../src/services/appsScriptApi.js";

const sheetSource={
  ok:true,compact:true,
  headers:["Codigo nuevo","Código de Drusila","Familia","Marca"],
  rows:[["TOP-0082","TOP-0082","Topadora","CAT"],["EXC-0055","EXC-0055","Excavadora","CAT"]],
  meta:{source:"lista_equipos",rows:2,headerRow:5,hasMore:false}
};
const response=(value,status=200)=>({ok:status>=200&&status<300,status,text:async()=>JSON.stringify(value),headers:{get:()=>null}});
test("al fallar 504 la Lista Maestra se recupera sin duplicados desde Apps Script",async t=>{
  const previous=globalThis.fetch,calls=[];
  globalThis.fetch=async(url)=>{
    calls.push(String(url));
    if(String(url).includes("/rest/v1/lista_equipos"))return response({message:"gateway timeout"},504);
    if(String(url).includes("action=lista_equipos"))return response(sheetSource);
    throw new Error("endpoint inesperado "+url);
  };
  t.after(()=>{globalThis.fetch=previous;});
  const result=await fetchSource("/api/apps-script","lista_equipos",{retries:0});
  assert.equal(result.ok,true);
  assert.equal(result.source,"google-sheets-fallback");
  assert.equal(result.data.length,2);
  assert.deepEqual(result.data.map(x=>x._sourceRow),[6,7]);
  assert.deepEqual(result.data.map(x=>x["Codigo nuevo"]),["TOP-0082","EXC-0055"]);
  assert.equal(result.meta.hasMore,false);
  assert.equal(calls.length,2,"una lectura fallida, una única recuperación");
});

test("nunca aceptar silenciosamente una hoja parcial",async t=>{
  const previous=globalThis.fetch;
  globalThis.fetch=async url=>String(url).includes("/rest/v1/lista_equipos")?
    response({message:"timeout"},504):
    response({...sheetSource,meta:{rows:5,hasMore:true,headerRow:5}});
  t.after(()=>{globalThis.fetch=previous;});
  await assert.rejects(()=>fetchSource("/api/apps-script","lista_equipos",{retries:0}),/incompleta/);
});
