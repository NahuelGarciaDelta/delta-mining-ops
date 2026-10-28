import test from "node:test";
import assert from "node:assert/strict";
import {readCompleteSheetSource,decoratePhysicalRows} from "../src/services/contingencySheetApi.js";
import {fetchSource,EMERGENCY_READ_MODE} from "../src/services/appsScriptApi.js";

const headers=["Fecha","Interno","Proyecto"];
function fakePage(total,source,offset,limit,{stamp="v1"}={}){
  const qty=Math.min(limit,Math.max(total-offset,0));
  const objects=Array.from({length:qty},(_,i)=>({
    Fecha:"2026-10-28",Interno:"TOP-"+String(offset+i).padStart(4,"0"),Proyecto:"JOSE MARIA"
  }));
  return {ok:true,source:"google-apps-script",meta:{
    source,rows:total,offset,limit,headerRow:4,
    hasMore:offset+limit<total,nextOffset:offset+limit<total?offset+limit:null,
    serverVersion:stamp,serverStamp:stamp,serverTime:"2026-10-28T12:00:00.000Z"
  },data:objects};
}
test("contingencia obtiene 2505 filas físicas en tres páginas sin duplicados",async()=>{
  let calls=[];
  const result=await readCompleteSheetSource("rop02_jm",async(source,{offset,limit})=>{
    calls.push(offset);return fakePage(2505,source,offset,limit);
  },{pageSize:900,maxPages:5});
  assert.equal(result.data.length,2505);
  assert.deepEqual(calls,[0,900,1800]);
  assert.equal(result.meta.physicalRows,2505);
  assert.equal(result.data[0]._sourceRow,5);
  assert.equal(result.data.at(-1)._sourceRow,2509);
  assert.equal(new Set(result.data.map(r=>r._sourceRow)).size,2505);
  assert.equal(result.source,"google-sheets-contingency");
});
test("si cambia la versión de la hoja entre páginas se rechaza el historial",async()=>{
  await assert.rejects(()=>readCompleteSheetSource("rop05",async(source,{offset,limit})=>
    fakePage(1200,source,offset,limit,{stamp:offset>0?"v2":"v1"})
  ),/cambió durante la lectura/);
});
test("se rechaza una página fallida en lugar de mostrar valores parciales",async()=>{
  await assert.rejects(()=>readCompleteSheetSource("rma15_jm",async(source,{offset,limit})=>
    offset?{ok:false,error:{message:"No disponible"}}:fakePage(1500,source,offset,limit)
  ),/página 2 inválida/);
});
test("El Fierro no se sustituye con registros de otro proyecto",async()=>{
  await assert.rejects(()=>readCompleteSheetSource("rop02_fierro",()=>fakePage(1,"rop02_fierro",0,900)),
    /no tiene una hoja configurada/);
});
test("si hay filas físicas vacías no se inventan números de fila",()=>{
  const rows=decoratePhysicalRows([{Interno:"A"},{Interno:"B"}],
    {offset:0,limit:10,rows:10,headerRow:4},"rop02_jm");
  assert.deepEqual(rows.map(r=>r._sourceRow),[null,null]);
});
test("lecturas de fuentes tipadas prescinden de Supabase en contingencia",async t=>{
  assert.equal(EMERGENCY_READ_MODE,true);
  const prior=globalThis.fetch;
  const requested=[];
  globalThis.fetch=async url=>{
    requested.push(String(url));
    const u=new URL(String(url));
    assert.equal(u.searchParams.get("action"),"lista_equipos");
    const source="lista_equipos";
    return {ok:true,status:200,text:async()=>JSON.stringify(fakePage(3,source,0,900)),headers:{get:()=>null}};
  };
  t.after(()=>{globalThis.fetch=prior;});
  const r=await fetchSource("https://example.test/api/apps-script","lista_equipos",{retries:0});
  assert.equal(r.data.length,3);
  assert.equal(r.source,"google-sheets-contingency");
  assert.equal(requested.length,1);
  assert.ok(requested.every(u=>!u.includes("supabase")));
});
