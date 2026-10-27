import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Verificador anti-pérdida de ROP02 José María. No reemplaza al webhook.
 * Escanea únicamente la cola (320 filas físicas), compara source_row
 * y recupera sólo las ausentes. Nunca borra ni reescribe partes existentes.
 *
 * Apps Script V9 no devuelve _sourceRow en su endpoint público:
 * la posición sólo se infiere si la página no tiene NINGUNA fila vacía.
 * Si no se cumple, abortar y solicitar parche al script, sin adivinar índices.
 */
const VERSION="2026-10-27-ROP02-JM-TAIL-RECONCILE-V1";
const DATASET="rop02_jm";
const PROJECT="JOSE MARIA";
const SHEET_NAME="R_OP02_JM";
const HEADER_ROW=4;
const SHEET_GID=967767400;
const WINDOW_ROWS=320;
const PAGE_SIZE=400;
const MAX_PAGES=3;
const SOURCE_URL="https://script.google.com/macros/s/AKfycbxU-ihsxXTNn2wa5EO1OkSM5FjJ43MwxSx8dY0RjbnJRFBKF0BiNNq7QsuohWxmmeOhog/exec";
const HEALTH_KEY="rop02_jm_tail_reconcile";
const str=x=>x===null||x===undefined?"":String(x).trim();
const out=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
const supabaseUrl=()=>str(Deno.env.get("SUPABASE_URL")).replace(/\/+$/,"");
function serviceKey(){
 const legacy=str(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
 if(legacy)return legacy;
 try{return str(JSON.parse(str(Deno.env.get("SUPABASE_SECRET_KEYS"))).default)}catch{return""}
}
async function fetchJson(url,options={},timeout=40000){
 const ctl=new AbortController();
 const t=setTimeout(()=>ctl.abort(),timeout);
 try{
  const response=await fetch(url,{...options,signal:ctl.signal,redirect:"follow"});
  const body=await response.text();
  if(!response.ok)throw Error("UPSTREAM_HTTP_"+response.status);
  if(!body.trim())return {data:null,response};
  let data;try{data=JSON.parse(body)}catch{throw Error("UPSTREAM_INVALID_JSON")}
  return {data,response};
 }finally{clearTimeout(t)}
}
async function rest(path,options={}){
 const key=serviceKey();if(!key)throw Error("SERVICE_KEY_MISSING");
 const headers={apikey:key,...(key.startsWith("sb_secret_")?{}:{Authorization:"Bearer "+key}),...(options.headers||{})};
 return fetchJson(supabaseUrl()+"/rest/v1/"+path,{...options,headers},30000);
}
async function rpc(name,payload){
 const {data}=await rest("rpc/"+name,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
 return data;
}
function isoDate(raw){
 const s=str(raw);
 if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
 const m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
 return m?m[3]+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0"):"";
}
function numeric(raw){
 let s=str(raw).replace(/\s+/g,"");
 if(!s||["OD","FS","EM","SIN CARGA"].includes(s.toUpperCase()))return null;
 s=s.replace(/[^0-9,.\-]/g,"");
 if(s.includes(",")&&s.includes("."))s=s.lastIndexOf(",")>s.lastIndexOf(".")?s.replace(/\./g,"").replace(",","."):s.replace(/,/g,"");
 else if(s.includes(","))s=s.replace(",",".");
 const n=Number(s);return Number.isFinite(n)?n:null;
}
const norm=x=>str(x).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Za-z0-9]/g,"").toUpperCase();
function value(row,...names){
 const accepted=new Set(names.map(norm));
 for(const [k,v] of Object.entries(row||{}))if(accepted.has(norm(k)))return v;
 return "";
}
function mapPart(row,sourceRow){
 const fecha=isoDate(value(row,"Fecha","Fecha del Parte Diario"));
 const interno=str(value(row,"Interno","Codigo Interno del Equipo","Codigo Int"));
 if(!fecha||!interno)throw Error("INCOMPLETE_PART_AT_SOURCE_ROW_"+sourceRow);
 return{
  source_row:sourceRow,fecha,interno,proyecto:PROJECT,
  equipo:str(value(row,"Equipo")),operador:str(value(row,"Operador")),
  supervisor_delta:str(value(row,"Supervisor Delta")),
  supervisor_vial_cliente:str(value(row,"Supervisor Vial Cliente")),
  turno_trabajo:str(value(row,"Turno de trabajo","Turno")),
  numero_parte:str(value(row,"N° Parte","Nº Parte","Numero de Parte")),
  horometro_inicial:numeric(value(row,"Horómetro inicial","Horometro inicial")),
  horometro_final:numeric(value(row,"Horómetro final","Horometro final")),
  cantidad_horas:numeric(value(row,"Cant. Hs.","Cant Hs","Horas")),
  combustible:numeric(value(row,"Combustible")),
  aceite_num:numeric(value(row,"Aceite")),
  aceite:str(value(row,"Aceite")),
  descripcion_trabajos:str(value(row,"Descripción de los trabajos realizados")),
  informacion_desgaste:str(value(row,"Información sobre Desgaste")),
  observaciones:str(value(row,"Observaciones"))
 };
}
async function getSheetPage(offset){
 const u=new URL(SOURCE_URL);
 for(const [key,v] of Object.entries({action:DATASET,offset:String(offset),limit:String(PAGE_SIZE),compact:"0",force:"1"}))u.searchParams.set(key,v);
 const {data}=await fetchJson(u.toString(),{headers:{Accept:"application/json"},cache:"no-store"},45000);
 if(!data?.ok||!Array.isArray(data.data))throw Error("SHEET_UNAVAILABLE_OR_INVALID");
 const meta=data.meta||{};
 const physicalLast=Number(meta.lastRow),allRows=Number(meta.rows),start=Number(meta.offset);
 if(meta.source!==DATASET||meta.sheetNameUsed!==SHEET_NAME||Number(meta.sheetGidUsed)!==SHEET_GID||Number(meta.headerRow)!==HEADER_ROW)throw Error("WRONG_SHEET_IDENTITY");
 if(!Number.isSafeInteger(physicalLast)||!Number.isSafeInteger(allRows)||allRows!==physicalLast-HEADER_ROW||start!==offset)throw Error("INVALID_SHEET_PAGINATION");
 const expected=Math.max(0,Math.min(PAGE_SIZE,allRows-offset));
 if(data.data.length!==expected)throw Error("PHYSICAL_BLANK_ROW_NEEDS_APPS_SCRIPT_SOURCE_ROW");
 // Respuestas actuales V9 NO incluyen _sourceRow. Sólo es seguro inferir el número
 // físico si el recuento confirma que no se ha omitido ninguna fila de esta página.
 const parts=data.data.map((row,i)=>{
  const derivedRow=HEADER_ROW+1+offset+i;
  if(row._sourceRow!==undefined&&Number(row._sourceRow)!==derivedRow)throw Error("SOURCE_ROW_DISAGREEMENT");
  return mapPart(row,derivedRow);
 });
 if(Boolean(meta.hasMore)!==(offset+expected<allRows))throw Error("SHEET_PAGINATION_INCONSISTENT");
 return{parts,hasMore:Boolean(meta.hasMore),nextOffset:offset+expected,lastRow:physicalLast,stamp:str(meta.sourceModifiedAt),allRows};
}
async function lastStoredRow(){
 const {data}=await rest("rop02?source_dataset=eq."+DATASET+"&select=source_row&order=source_row.desc&limit=1");
 if(!Array.isArray(data))throw Error("INVALID_LAST_SOURCE_ROW");
 const n=Number(data[0]?.source_row||HEADER_ROW);
 if(!Number.isSafeInteger(n)||n<HEADER_ROW)throw Error("INVALID_LAST_SOURCE_ROW");
 return n;
}
async function getExistingRows(first,last){
 const path="rop02?source_dataset=eq."+DATASET+"&source_row=gte."+first+"&source_row=lte."+last+"&select=source_row&order=source_row.asc&limit=1300";
 const {data}=await rest(path);
 if(!Array.isArray(data))throw Error("INVALID_EXISTING_ROWS");
 return new Set(data.map(x=>Number(x.source_row)));
}
async function dbCount(){
 const {response}=await rest("rop02?source_dataset=eq."+DATASET+"&select=id",{method:"HEAD",headers:{Prefer:"count=exact"}});
 const n=Number(str(response.headers.get("content-range")).split("/").pop());
 if(!Number.isSafeInteger(n)||n<0)throw Error("DESTINATION_COUNT_UNAVAILABLE");
 return n;
}
async function saveHealth(obj){
 const body=[{dataset:HEALTH_KEY,updated_at:new Date().toISOString(),...obj}];
 await rest("sheet_sync_health?on_conflict=dataset",{method:"POST",headers:{"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(body)});
}
async function reconcile(){
 const startTime=Date.now();
 const maxDb=await lastStoredRow();
 let offset=Math.max(0,maxDb-HEADER_ROW-WINDOW_ROWS);
 const pages=[];
 let latestMeta=null;
 for(let page=0;page<MAX_PAGES;page++){
  const chunk=await getSheetPage(offset);
  if(latestMeta&&(chunk.lastRow!==latestMeta.lastRow||chunk.stamp!==latestMeta.stamp))throw Error("SOURCE_CHANGED_DURING_SCAN");
  latestMeta={lastRow:chunk.lastRow,stamp:chunk.stamp,allRows:chunk.allRows};
  pages.push(...chunk.parts);
  offset=chunk.nextOffset;
  if(!chunk.hasMore)break;
  if(page===MAX_PAGES-1)throw Error("SOURCE_BEHIND_MAX_PAGES_ALERT");
 }
 const first=pages[0]?.source_row,last=pages[pages.length-1]?.source_row;
 if(!first||!last)throw Error("EMPTY_SOURCE_SCAN_BLOCKED");
 const sourceIds=pages.map(p=>p.source_row);
 if(new Set(sourceIds).size!==sourceIds.length)throw Error("DUPLICATE_SOURCE_ROWS");
 const existing=await getExistingRows(first,last);
 const missing=pages.filter(p=>!existing.has(p.source_row));
 let written=0,submitted=false;
 if(missing.length){
  submitted=true;
  const result=await rpc("apply_rop02_external_delta_v2",{p_dataset:DATASET,p_upserts:missing,p_delete_source_rows:[]});
  if(result?.ok!==true||Number(result?.inputUpserts)!==missing.length||Number(result?.inputDeletes)!==0)throw Error("RECOVERY_RPC_UNCONFIRMED");
  written=Number(result.writtenUpserts||0);
 }
 // Segunda comprobación independiente: jamás declarar OK si persiste un hueco.
 const checked=await getExistingRows(first,last);
 const remain=sourceIds.filter(sourceRow=>!checked.has(sourceRow));
 if(remain.length)throw Error("RECOVERY_UNCONFIRMED_REMAINING_"+remain.length);
 const currentCount=await dbCount();
 const gapsInAllRows=Math.max(0,latestMeta.lastRow-HEADER_ROW-currentCount);
 const now=new Date().toISOString();
 const durationMs=Date.now()-startTime;
 await saveHealth({last_attempt_at:now,last_success_at:now,last_error:"",consecutive_failures:0,source_rows:latestMeta.allRows,destination_rows:currentCount,duration_ms:durationMs,details:{version:VERSION,scanned:pages.length,sourceFrom:first,sourceTo:last,foundMissing:missing.length,written,gapsInAllRows,sourceModifiedAt:latestMeta.stamp}});
 return{ok:true,version:VERSION,dataset:DATASET,scanned:pages.length,sourceFrom:first,sourceTo:last,recovered:written,missingFound:missing.length,remainingInWindow:0,potentialGapsOutsideWindow:gapsInAllRows,durationMs};
}
Deno.serve(async req=>{
 if(req.method!=="POST")return out({ok:false,error:"METHOD_NOT_ALLOWED"},405);
 let authorized=false;
 try{
  const token=str(req.headers.get("x-delta-sync-token"));
  if(!token||await rpc("verify_rop02_sync_token",{p_token:token})!==true)return out({ok:false,error:"UNAUTHORIZED"},401);
  authorized=true;
  const result=await reconcile();
  return out(result);
 }catch(e){
  const message=e instanceof Error?e.message:String(e);
  console.error(VERSION+" "+message);
  if(authorized){
   try{
    const prev=await rest("sheet_sync_health?dataset=eq."+HEALTH_KEY+"&select=consecutive_failures");
    const failures=Math.max(0,Number(prev.data?.[0]?.consecutive_failures||0))+1;
    await saveHealth({last_attempt_at:new Date().toISOString(),last_error:message.slice(0,350),consecutive_failures:failures,details:{version:VERSION,lastError:message.slice(0,350)}});
   }catch(err){console.error("HEALTH_RECORD_FAILED",err instanceof Error?err.message:String(err))}
  }
  // Puede haber habido una escritura confirmada aunque la respuesta posterior
  // haya fallado. El próximo cron vuelve a verificar source_row antes de escribir.
  return out({ok:false,error:message,version:VERSION,retryAtNextSchedule:true},500);
 }
});