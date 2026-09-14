import {SUPABASE_TYPED_SOURCES,fetchSupabaseDatasetQuery,fetchSupabaseHealth,fetchSupabasePmSnapshot,fetchSupabaseSource,fetchSupabaseVersions} from "./supabaseReadApi.js";

const ROP02_BUNDLE_SOURCES=Object.freeze(["rop02_jm","rop02_fs","rop02_filosur","rop02_zorro"]);
let rop02BundleMemo_={key:"",value:null,at:0,promise:null};
let syncVersionsMemo_={value:null,at:0,promise:null};
const SYNC_VERSIONS_MEMO_MS=15000;

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
  if(String(action||"")==="mantenimiento_programado")return fetchSupabasePmSnapshot();
  if(SUPABASE_TYPED_SOURCES.has(String(action||"")))return fetchSupabaseSource(String(action||""));

  const requestParams={...(extraParams||{})};
  if(force)requestParams.force="1";
  if(since&&!force)requestParams.since=since;
  if(compact&&!['health','diag','clear_cache','sync','versions','get_data_versions'].includes(action))requestParams.compact="1";
  if(action==="rop05")requestParams.limit="all";

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
}

// Compatibilidad para consumidores antiguos: el bundle se arma directamente desde
// Supabase. No vuelve a abrir las cuatro Google Sheets ni depende de Apps Script.
export async function fetchRop02Bundle(_url,{force=false}={}){
  const key=force?"force":"normal",now=Date.now();
  if(!force&&rop02BundleMemo_.key===key&&rop02BundleMemo_.value&&now-rop02BundleMemo_.at<30000)return rop02BundleMemo_.value;
  if(rop02BundleMemo_.key===key&&rop02BundleMemo_.promise)return rop02BundleMemo_.promise;
  const task=Promise.all(ROP02_BUNDLE_SOURCES.map(source=>fetchSupabaseSource(source))).then(values=>{
    const sources={};values.forEach((value,index)=>{sources[ROP02_BUNDLE_SOURCES[index]]=value;});
    const bundle={ok:true,source:"supabase",bundleId:`supabase-${Date.now()}`,sources};
    rop02BundleMemo_={key,value:bundle,at:Date.now(),promise:null};return bundle;
  }).catch(error=>{if(rop02BundleMemo_.promise===task)rop02BundleMemo_={key:"",value:null,at:0,promise:null};throw error;});
  rop02BundleMemo_={key,value:null,at:now,promise:task};return task;
}

export async function fetchHealth(_url){return fetchSupabaseHealth();}

export async function fetchSource(_url,source,_options={}){
  const sourceKey=String(source||"");
  if(SUPABASE_TYPED_SOURCES.has(sourceKey))return fetchSupabaseSource(sourceKey);
  return fetchAction(_url,sourceKey,_options);
}

// El heartbeat también sale de Supabase. Así una simple comprobación de vigencia
// nunca dispara una ejecución de Apps Script ni abre una planilla.
export async function fetchSyncVersions(_url){
  const now=Date.now();
  if(syncVersionsMemo_.value&&now-syncVersionsMemo_.at<SYNC_VERSIONS_MEMO_MS)return syncVersionsMemo_.value;
  if(syncVersionsMemo_.promise)return syncVersionsMemo_.promise;
  const task=fetchSupabaseVersions().then(value=>{if(value)syncVersionsMemo_={value,at:Date.now(),promise:null};return value;});
  syncVersionsMemo_={value:syncVersionsMemo_.value,at:syncVersionsMemo_.at,promise:task};
  try{return await task;}finally{if(syncVersionsMemo_.promise===task)syncVersionsMemo_={...syncVersionsMemo_,promise:null};}
}

// Las vistas históricas ROP02/ROP05/RMA15 leen Supabase directamente. Sólo se
// conserva query_dataset de Apps Script como compatibilidad para datasets ajenos.
export async function fetchDatasetQuery(url,params={},options={}){
  const dataset=String(params?.dataset||"").trim().toLowerCase();
  if(["rop02","rop05","rma15"].includes(dataset))return fetchSupabaseDatasetQuery(params);

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
