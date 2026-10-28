import {SUPABASE_TYPED_SOURCES,fetchSupabaseDatasetQuery,fetchSupabaseHealth,fetchSupabasePmSnapshot,fetchSupabaseSource,fetchSupabaseVersions} from "./supabaseReadApi.js";
import {ROP02_SOURCE_KEYS} from "../config/rop02Sources.js";
import {CONTINGENCY_SHEET_SOURCES,readCompleteSheetSource,shareSheetRead} from "./contingencySheetApi.js";

// Exclusivo de esta rama; main conserva íntegra la arquitectura original.
export const EMERGENCY_READ_MODE=true;
import {appsScriptRequestKey,resetAppsScriptInflightForTests,shareAppsScriptRequest} from "./appsScriptRequestCoordinator.js";

const ROP02_BUNDLE_SOURCES=ROP02_SOURCE_KEYS;
let rop02BundleMemo_={key:"",value:null,at:0,promise:null};
let syncVersionsMemo_={value:null,at:0,promise:null};
const typedSourceInflight_=new Map();
const SYNC_VERSIONS_MEMO_MS=15000;

function fetchTypedSupabaseSource_(source){
  const sourceKey=String(source||"");
  if(typedSourceInflight_.has(sourceKey))return typedSourceInflight_.get(sourceKey);
  const task=Promise.resolve()
    .then(()=>fetchSupabaseSource(sourceKey))
    .finally(()=>{if(typedSourceInflight_.get(sourceKey)===task)typedSourceInflight_.delete(sourceKey);});
  typedSourceInflight_.set(sourceKey,task);
  return task;
}

export function expandCompactSource(src){
  if(!src||!src.compact||!Array.isArray(src.headers)||!Array.isArray(src.rows))return src;
  return {...src,compact:false,data:src.rows.map(arr=>{const obj={};src.headers.forEach((h,i)=>{obj[h]=arr?.[i]??"";});return obj;})};
}

export function expandCompactResponse(json){
  if(!json)return json;
  if(json.compact)return expandCompactSource(json);
  if(json.sources){const sources={};Object.entries(json.sources).forEach(([key,val])=>{sources[key]=expandCompactSource(val);});return {...json,sources};}
  return json;
}

export function buildAppsScriptUrl(baseUrl,action,params={}){
  const cleanBase=String(baseUrl||"").trim().replace(/\/+$/,"");
  const origin=typeof window!=="undefined"&&window.location?.origin?window.location.origin:"http://localhost";
  const u=new URL(cleanBase,origin);u.searchParams.set("action",action);u.searchParams.set("_t",String(Date.now()));
  Object.entries(params||{}).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=="")u.searchParams.set(k,String(v));});
  return u.toString();
}

export function sleep_(ms){return new Promise(resolve=>setTimeout(resolve,ms));}

export {resetAppsScriptInflightForTests};

export async function runWithConcurrency_(items,limit,worker){
  const results=new Array(items.length);let cursor=0;
  const concurrency=Math.min(Math.max(1,Number(limit)||1),items.length);
  const runners=Array.from({length:concurrency},async()=>{
    while(true){const index=cursor++;if(index>=items.length)return;try{results[index]={status:"fulfilled",value:await worker(items[index],index)};}catch(reason){results[index]={status:"rejected",reason};}}
  });
  await Promise.all(runners);return results;
}

// Apps Script queda reservado para acciones que todavía no fueron migradas y para
// escrituras. Los datasets pesados ya no pasan por este camino.
export async function fetchAction(url,action,{force=false,compact=true,retries=2,since="",timeoutMs=45000,params:extraParams={}}={}){
  if(!EMERGENCY_READ_MODE&&String(action||"")==="mantenimiento_programado")return fetchSupabasePmSnapshot();
  if(!EMERGENCY_READ_MODE&&SUPABASE_TYPED_SOURCES.has(String(action||"")))return fetchTypedSupabaseSource_(String(action||""));

  const requestParams={...(extraParams||{})};
  if(force)requestParams.force="1";
  if(since&&!force)requestParams.since=since;
  if(compact&&!['health','diag','clear_cache','sync','versions','get_data_versions'].includes(action))requestParams.compact="1";
  if(action==="rop05"&&requestParams.limit===undefined)requestParams.limit="all";

  const key=appsScriptRequestKey(url,action,requestParams,{timeoutMs,retries});
  return shareAppsScriptRequest(key,async()=>{
    let lastErr=null;
    for(let attempt=0;attempt<=retries;attempt++){
      const controller=typeof AbortController!=="undefined"?new AbortController():null;
      const timer=controller?setTimeout(()=>controller.abort(),timeoutMs):null;
      try{
        const requestUrl=buildAppsScriptUrl(url,action,requestParams);
        const res=await fetch(requestUrl,{cache:"no-store",redirect:"follow",signal:controller?.signal});
        if(!res.ok)throw new Error(`HTTP ${res.status} desde el Apps Script`);
        const text=await res.text();let json;
        try{json=JSON.parse(text);}catch(_){throw new Error("El Apps Script devolvió HTML. Verificá que esté publicado como 'Cualquier persona'.");}
        json=expandCompactResponse(json);
        if(!json.ok&&!json.sources)throw new Error(json.error?.message||"Respuesta inválida del Apps Script");
        return json;
      }catch(err){
        lastErr=err?.name==="AbortError"?new Error(`La consulta ${action} superó ${Math.round(timeoutMs/1000)} segundos`):err;
        if(attempt<retries)await sleep_(700*(attempt+1));
      }finally{if(timer)clearTimeout(timer);}
    }
    throw lastErr;
  });
}

// Compatibilidad para consumidores antiguos: el bundle se arma directamente desde
// Supabase. No vuelve a abrir las cuatro Google Sheets ni depende de Apps Script.
async function readSheetSource_(url,source,{force=false}={}){
  return shareSheetRead(source,()=>readCompleteSheetSource(source,async(key,{offset,limit})=>
    fetchAction(url,key,{force,compact:true,retries:0,timeoutMs:52000,
      params:{offset,limit}})));
}

export async function fetchRop02Bundle(url,{force=false}={}){
  if(!EMERGENCY_READ_MODE){
    const sources={};
    for(const key of ROP02_BUNDLE_SOURCES)sources[key]=await fetchTypedSupabaseSource_(key);
    return {ok:true,source:"supabase",sources};
  }
  const sources={};
  for(const key of ROP02_BUNDLE_SOURCES){
    try{sources[key]=await readSheetSource_(url,key,{force});}
    catch(error){sources[key]={ok:false,error:{message:String(error?.message||error)}};}
  }
  return {ok:Object.values(sources).every(v=>v.ok),source:"google-sheets-contingency",
    fetchedAt:new Date().toISOString(),sources};
}

export async function fetchHealth(url){
  if(!EMERGENCY_READ_MODE)return fetchSupabaseHealth();
  const status=await fetchAction(url,"backend_version",{retries:0,timeoutMs:20000,compact:false});
  if(!status?.ok)throw new Error("Backend Apps Script sin respuesta");
  return {ok:true,source:"google-sheets-contingency",version:status.backendVersion||status.version,
    checkedAt:new Date().toISOString()};
}

export async function fetchSource(url,source,options={}){
  const key=String(source||"");
  if(EMERGENCY_READ_MODE&&SUPABASE_TYPED_SOURCES.has(key)){
    return readSheetSource_(url,key,options);
  }
  if(SUPABASE_TYPED_SOURCES.has(key))return fetchTypedSupabaseSource_(key);
  return fetchAction(url,key,options);
}

export async function fetchSyncVersions(url,{force=false}={}){
  const now=Date.now();
  if(!force&&syncVersionsMemo_.value&&now-syncVersionsMemo_.at<SYNC_VERSIONS_MEMO_MS)return syncVersionsMemo_.value;
  if(syncVersionsMemo_.promise)return syncVersionsMemo_.promise;
  const task=EMERGENCY_READ_MODE
    ?fetchAction(url,"get_data_versions",{retries:0,timeoutMs:30000,compact:false})
    :fetchSupabaseVersions();
  syncVersionsMemo_={value:syncVersionsMemo_.value,at:syncVersionsMemo_.at,promise:task};
  try{
    const value=await task;
    if(value?.ok)syncVersionsMemo_={value,at:Date.now(),promise:null};
    return value;
  }finally{
    if(syncVersionsMemo_.promise===task)syncVersionsMemo_={...syncVersionsMemo_,promise:null};
  }
}

// Las vistas históricas ROP02/ROP05/RMA15 leen Supabase directamente. Sólo se
// conserva query_dataset de Apps Script como compatibilidad para datasets ajenos.
export async function fetchDatasetQuery(url,params={},options={}){
  const dataset=String(params?.dataset||"").trim().toLowerCase();
  if(!EMERGENCY_READ_MODE&&["rop02","rop05","rma15"].includes(dataset))return fetchSupabaseDatasetQuery(params);

  const timeoutMs=Number(options?.timeoutMs)||60000;
  const controller=typeof AbortController!=="undefined"?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),timeoutMs):null;
  try{
    const response=await fetch(buildAppsScriptUrl(url,"query_dataset",params),{cache:"no-store",redirect:"follow",signal:controller?.signal});
    if(!response.ok)throw new Error(`HTTP ${response.status} desde Apps Script`);
    const text=await response.text();let json;
    try{json=JSON.parse(text);}catch(_){throw new Error("Apps Script no devolvió JSON válido");}
    if(!json?.ok)throw new Error(json?.error?.message||"Consulta de dataset inválida");
    return {...json,payloadBytes:new Blob([text]).size};
  }finally{if(timer)clearTimeout(timer);}
}
