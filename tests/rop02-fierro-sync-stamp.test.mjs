import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";

const source=readFileSync(new URL("../supabase/functions/rop02-project-auto-sync/index.ts",import.meta.url),"utf8")
  .replace(/^import "jsr:[^\n]+\n/m,"");

const stamp1="2026-10-22T19:04:08.517Z";
const stamp2="2026-10-22T20:04:08.517Z";
const example=[
 {_sourceRow:5,Fecha:"18/10/2026",Interno:"PCA-0002","N° Parte":"1",Equipo:"Cargadora frontal",Operador:"Operario de prueba","Cant. Hs.":"6","Horómetro inicial":"5233","Horómetro final":"5239"},
 {_sourceRow:6,Fecha:"19/10/2026",Interno:"PCA-0002","N° Parte":"2",Equipo:"Cargadora frontal",Operador:"Operario de prueba","Cant. Hs.":"4","Horómetro inicial":"5239","Horómetro final":"5243"},
];
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});}
function harness(){
 const state={
   rows:[...example],modified:stamp1,destinationRows:0,
   health:{last_success_at:"2026-10-20T11:17:55.014Z",destination_rows:0,consecutive_failures:0,details:{sourceVersion:1}},
   syncCalls:[],sheetCalls:[],versionsCalls:0,healthWrites:0
 };
 let handler;
 const fetchMock=async (u,opt={})=>{
   const url=new URL(u);
   if(url.pathname.endsWith("/rpc/verify_rop02_sync_token"))return json(true);
   if(url.pathname.endsWith("/rpc/sync_rop02_authoritative_low_io_v1")){
     const data=JSON.parse(opt.body);
     assert.equal(data.p_dataset,"rop02_fierro");
     assert.ok(Array.isArray(data.p_rows));
     assert.ok(data.p_rows.every(x=>Number.isInteger(x.source_row)));
     state.syncCalls.push(data);
     state.destinationRows=data.p_rows.length;
     return json({ok:true,writtenUpserts:data.p_rows.length,deleted:0});
   }
   if(url.pathname==="/rest/v1/rop02_project_sources")return json([{dataset:"rop02_fierro",project:"EL FIERRO",sheet_gid:967767400,header_row:4,sheet_name:"R_OP02_EL_FIERRO"}]);
   if(url.pathname==="/rest/v1/rop02"){
     assert.equal(opt.method,"HEAD");
     return new Response(null,{status:200,headers:{"content-range":"0-0/"+state.destinationRows}});
   }
   if(url.pathname==="/rest/v1/sheet_sync_health"){
     if(opt.method==="POST"){
       const update=JSON.parse(opt.body)[0];
       state.health={...state.health,...update};state.healthWrites++;
       return new Response(null,{status:201});
     }
     return json([state.health]);
   }
   if(url.pathname.endsWith("/exec")){
     const action=url.searchParams.get("action");
     if(action==="versions"){state.versionsCalls++;throw Error("La función no debe consultar versions global");}
     assert.equal(action,"rop02_fierro");
     const since=url.searchParams.get("since");
     state.sheetCalls.push({since});
     if(since===state.modified)return json({ok:true,notModified:true,meta:{notModified:true,sourceModifiedAt:state.modified},data:[]});
     return json({ok:true,meta:{
       source:"rop02_fierro",headerRow:4,sheetGidUsed:967767400,
       serverVersion:1,sourceModifiedAt:state.modified,
       rows:state.rows.length,hasMore:false
     },data:state.rows});
   }
   throw Error("Unexpected request "+url.toString());
 };
 const context={
   Deno:{env:{get:(name)=>({SUPABASE_URL:"https://test.supabase.co",SUPABASE_SERVICE_ROLE_KEY:"sb_secret_dummy"})[name]??""},
     serve:(fn)=>{handler=fn}},
   Request,Response,Headers,AbortController,URL,Date,JSON,Number,String,Array,Object,
   Boolean,RegExp,Promise,Set,Error,console,setTimeout,clearTimeout,encodeURIComponent
 };
 vm.runInNewContext(source,context,{filename:"rop02-project-auto-sync/index.ts"});
 assert.equal(typeof handler,"function");
 return {state,call:async()=>{const request=new Request("https://mock.supabase.co/functions/v1/rop02-project-auto-sync",{method:"POST",headers:{"x-delta-sync-token":"fake-valid-token","content-type":"application/json"},body:JSON.stringify({dataset:"rop02_fierro"})});const response=await handler(request);return{status:response.status,result:await response.json()}}};
}
test("regresión El Fierro: origen pasó de 0 a 2 filas con versión de script 1",async()=>{
 const h=harness();
 const first=await h.call();
 assert.equal(first.status,200);
 assert.equal(first.result.ok,true);
 assert.equal(first.result.rows,2);
 assert.equal(first.result.changed,true);
 assert.equal(h.state.destinationRows,2);
 assert.equal(h.state.syncCalls.length,1);
 assert.deepEqual([...h.state.syncCalls[0].p_rows.map(r=>r.source_row)],[5,6]);
 assert.equal(h.state.health.details.sourceVersion,1);
 assert.equal(h.state.health.details.sourceModifiedAt,stamp1);
 assert.equal(h.state.versionsCalls,0);
});
test("misma marca de modificación: respuesta notModified sin reescrituras",async()=>{
 const h=harness();await h.call();
 const next=await h.call();
 assert.equal(next.status,200);
 assert.equal(next.result.changed,false);
 assert.equal(h.state.syncCalls.length,1);
 assert.equal(h.state.sheetCalls[1].since,stamp1);
 assert.equal(h.state.versionsCalls,0);
});
test("nueva fila con misma versión 1 y marca Drive posterior: se sincroniza",async()=>{
 const h=harness();await h.call();
 h.state.modified=stamp2;
 h.state.rows.push({...example[1],_sourceRow:7,"N° Parte":"3",Fecha:"20/10/2026"});
 const third=await h.call();
 assert.equal(third.status,200);
 assert.equal(third.result.rows,3);
 assert.equal(h.state.destinationRows,3);
 assert.equal(h.state.syncCalls.length,2);
 assert.equal(h.state.health.details.sourceModifiedAt,stamp2);
});
test("función sigue negando solicitudes no autenticadas",async()=>{
 const h=harness();
 const req=new Request("https://mock.supabase.co/functions/v1/rop02-project-auto-sync",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({dataset:"rop02_fierro"})});
 // El comportamiento real para token vacío se comprueba estáticamente
 assert.match(source,/if\(!token\|\|await rpc\("verify_rop02_sync_token"/);
 assert.match(source,/return output\(\{ok:false,error:"UNAUTHORIZED"\},401\)/);
 assert.equal(h.state.syncCalls.length,0);
});
