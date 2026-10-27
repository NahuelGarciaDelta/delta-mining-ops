import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";

const code=readFileSync(new URL("../supabase/functions/rop02-jm-tail-reconcile/index.ts",import.meta.url),"utf8")
  .replace(/^import "jsr:[^\n]+";\s*/,"");

const raw=(index)=>({
  Fecha:"26/10/2026",Interno:"PCA-"+String(index).padStart(4,"0")+"-JM",
  Equipo:"Cargadora frontal",Operador:"Operario", "Supervisor Delta":"Supervisor",
  "Supervisor Vial Cliente":"Cliente","Turno de trabajo":"TURNO DIA",
  "N° Parte":String(index),"Proyecto ":"JOSE MARIA",
  "Horómetro inicial":"100","Horómetro final":"108","Cant. Hs.":"8",
  Combustible:"100",Aceite:"Sin carga",
  "Descripción de los trabajos realizados":"Ensanche de camino",
  "Información sobre Desgaste":"Sin consumos de desgaste",
  Observaciones:"Vicuña"
});
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}});
function harness(options={}){
 const state={
  source:Array.from({length:options.total||5},(_,i)=>raw(i+5)),
  present:new Set(options.present||[5,7,9]),
  calls:[], writes:[], health:[], published:0,
  failRpc:options.failRpc||false,
  missingPhysical:options.missingPhysical||false,
  wrongGid:options.wrongGid||false,
  stamp:"2026-10-27T19:55:00.000Z"
 };
 let handler;
 const fetchMock=async(url,req={})=>{
  const u=new URL(url);
  const method=String(req.method||"GET").toUpperCase();
  state.calls.push({url:u.pathname,params:u.search,method});
  if(u.pathname==="/rest/v1/rpc/verify_rop02_sync_token")return json(true);
  if(u.pathname==="/rest/v1/rop02"){
   if(method==="HEAD")return new Response(null,{status:200,headers:{"Content-Range":"0-0/"+state.present.size}});
   if(u.searchParams.get("order")==="source_row.desc"){
    const last=Math.max(4,...state.present);
    return json(last===4?[]:[{source_row:last}]);
   }
   if(u.searchParams.has("source_row")){
    const from=Number(u.searchParams.get("source_row").replace("gte.",""));
    const to=Number(u.searchParams.getAll("source_row")[1]?.replace("lte.","")||Infinity);
    return json([...state.present].filter(n=>n>=from&&n<=to).sort((a,b)=>a-b).map(source_row=>({source_row})));
   }
  }
  if(u.pathname==="/rest/v1/rpc/apply_rop02_external_delta_v2"){
   const data=JSON.parse(req.body);
   assert.equal(data.p_dataset,"rop02_jm");
   assert.deepEqual(Array.from(data.p_delete_source_rows),[]);
   state.writes.push(data.p_upserts);
   if(state.failRpc){state.failRpc=false;return json({error:"upstream request timeout"},504)}
   for(const r of data.p_upserts)state.present.add(r.source_row);
   return json({ok:true,inputUpserts:data.p_upserts.length,inputDeletes:0,writtenUpserts:data.p_upserts.length});
  }
  if(u.pathname==="/rest/v1/sheet_sync_health"){
   if(method==="POST"){state.health.push(JSON.parse(req.body)[0]);return new Response(null,{status:204})}
   return json([{consecutive_failures:state.health.at(-1)?.consecutive_failures||0}]);
  }
  if(u.pathname.endsWith("/exec")){
   const offset=Number(u.searchParams.get("offset"));
   const size=Number(u.searchParams.get("limit"));
   assert.equal(u.searchParams.get("action"),"rop02_jm");
   assert.equal(u.searchParams.get("force"),"1");
   const section=state.source.slice(offset,offset+size);
   if(state.missingPhysical&&section.length>1)section.splice(1,1);
   return json({ok:true,meta:{
    source:"rop02_jm",sheetNameUsed:"R_OP02_JM",
    sheetGidUsed:state.wrongGid?99:967767400,
    headerRow:4,lastRow:state.source.length+4,rows:state.source.length,
    offset,hasMore:offset+size<state.source.length,
    sourceModifiedAt:state.stamp
   },data:section});
  }
  throw Error("UNEXPECTED_MOCK_REQUEST: "+method+" "+u.toString());
 };
 vm.runInNewContext(code,{
  Deno:{env:{get:k=>({SUPABASE_URL:"https://mock.supabase.co",SUPABASE_SERVICE_ROLE_KEY:"sb_secret_test_key"})[k]||""},serve:fn=>handler=fn},
  Response,Request,Headers,URL,AbortController,Date,Array,Math,Number,Boolean,String,RegExp,Set,Map,
  Object,JSON,Error,Promise,console,setTimeout,clearTimeout,fetch:fetchMock
 },{filename:"rop02-jm-tail-reconcile/index.ts"});
 assert.equal(typeof handler,"function");
 return {state,run:async authorized=>{
  const req=new Request("https://mock.supabase.co/functions/v1/rop02-jm-tail-reconcile",{method:"POST",headers:{
   ...(authorized===false?{}:{"x-delta-sync-token":"test-real-token"})
  }});
  const reply=await handler(req);
  return{status:reply.status,data:await reply.json()};
 }};
}
test("recupera sólo filas omitidas del webhook, sin borrar ni sobrescribir presentes",async()=>{
 const h=harness();
 const r=await h.run();
 assert.equal(r.status,200,JSON.stringify(r.data));
 assert.equal(r.data.missingFound,2);
 assert.equal(r.data.recovered,2);
 assert.deepEqual([...h.state.present].sort((a,b)=>a-b),[5,6,7,8,9]);
 assert.equal(h.state.writes.length,1);
 assert.deepEqual(Array.from(h.state.writes[0].map(r=>r.source_row)),[6,8]);
 assert.equal(h.state.writes[0][0].fecha,"2026-10-26");
 assert.equal(h.state.writes[0][0].proyecto,"JOSE MARIA");
 assert.equal(h.state.health.at(-1).last_error,"");
});
test("segundo paso idempotente sin actualizar otros partes",async()=>{
 const h=harness();await h.run();
 const next=await h.run();
 assert.equal(next.status,200);
 assert.equal(next.data.missingFound,0);
 assert.equal(h.state.writes.length,1);
});
test("la vista de origen con fila física vacía bloquea toda escritura",async()=>{
 const h=harness({missingPhysical:true});
 const r=await h.run();
 assert.equal(r.status,500);
 assert.match(r.data.error,/PHYSICAL_BLANK_ROW_NEEDS_APPS_SCRIPT_SOURCE_ROW/);
 assert.equal(h.state.writes.length,0);
 assert.equal(h.state.health.at(-1).consecutive_failures,1);
});
test("GID inesperado bloquea actualización",async()=>{
 const h=harness({wrongGid:true});
 const r=await h.run();
 assert.equal(r.status,500);
 assert.match(r.data.error,/WRONG_SHEET_IDENTITY/);
 assert.equal(h.state.writes.length,0);
});
test("RPC HTTP 504 no marca éxito; luego recupera sin pérdida",async()=>{
 const h=harness({failRpc:true});
 const failed=await h.run();
 assert.equal(failed.status,500);
 assert.match(failed.data.error,/UPSTREAM_HTTP_504/);
 assert.equal(h.state.present.size,3);
 const recovered=await h.run();
 assert.equal(recovered.status,200,JSON.stringify(recovered.data));
 assert.equal(recovered.data.remainingInWindow,0);
 assert.equal(h.state.present.size,5);
 assert.equal(h.state.health.at(-1).consecutive_failures,0);
});
test("la autorización es obligatoria incluso para consulta",async()=>{
 const h=harness();
 const rejected=await h.run(false);
 assert.equal(rejected.status,401);
 assert.equal(h.state.writes.length,0);
 assert.equal(h.state.calls.filter(x=>x.url.endsWith("/exec")).length,0);
});
test("paginación de más de 400 filas sin saltos y con límite máximo",async()=>{
 const h=harness({total:430,present:[5,6,7]});
 const r=await h.run();
 assert.equal(r.status,200,JSON.stringify(r.data));
 assert.equal(r.data.scanned,430);
 assert.equal(r.data.recovered,427);
 assert.equal(h.state.present.size,430);
 assert.equal(h.state.calls.filter(x=>x.url.endsWith("/exec")).length,2);
});
test("no altera camionetas ni estados OD/FS: solo completa filas que faltan",async()=>{
 const h=harness({present:[5,7,9]});
 h.state.source[1].Interno="CTA-1800-JM";
 h.state.source[1]["Cant. Hs."]="99";
 h.state.source[3].Interno="MOT-0091-JM";
 h.state.source[3]["Cant. Hs."]="OD";
 const r=await h.run();
 assert.equal(r.status,200);
 assert.equal(h.state.writes[0][0].cantidad_horas,99);
 assert.equal(h.state.writes[0][1].cantidad_horas,null);
 assert.equal(h.state.writes[0][1].interno,"MOT-0091-JM");
});


test("hueco antiguo fuera de ventana se informa como incidente, no como éxito",async()=>{
 const existing=Array.from({length:450},(_,i)=>i+5).filter(n=>n!==10);
 const h=harness({total:450,present:existing});
 const result=await h.run();
 assert.equal(result.status,500);
 assert.match(result.data.error,/SOURCE_DESTINATION_COUNT_DRIFT_1/);
 assert.equal(h.state.writes.length,0);
 assert.equal(h.state.health.at(-1).consecutive_failures,1);
});
