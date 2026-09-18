import {SUPABASE_TYPED_SOURCES,fetchSupabaseDatasetQuery,fetchSupabaseHealth,fetchSupabasePmSnapshot,fetchSupabaseSource,fetchSupabaseVersions} from "./supabaseReadApi.js";

const ROP02_BUNDLE_SOURCES=Object.freeze(["rop02_jm","rop02_fs","rop02_filosur","rop02_zorro"]);
let rop02BundleMemo_={key:"",value:null,at:0,promise:null};
let syncVersionsMemo_={value:null,at:0,promise:null};
const typedSourceInflight_=new Map();
const SYNC_VERSIONS_MEMO_MS=15000;

function sourceReplicaMaxAgeMs_(source){
  const key=String(source||"");
  if(key.startsWith("rop02_"))return 90*1000;
  if(key==="rop05"||key.startsWith("rma15_"))return 5*60*1000;
  if(key==="lista_equipos"||key==="insumos")return 30*60*1000;
  return 10*60*1000;
}

function sourceReplicaAgeMs_(response){
  const raw=response?.meta?.serverTime||response?.meta?.updatedAt||response?.updatedAt||"";
  const time=new Date(raw||0).getTime();
  if(!Number.isFinite(time)||time<=0)return Number.POSITIVE_INFINITY;
  return Math.max(0,Date.now()-time);
}

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

export async function runWithConcurrency_(items,limit,worker){
  const results=new Array(items.length);let cursor=0;
  const concurrency=Math.min(Math.max(1,Number(limit)||1),items.length);
  const runners=Array.from({length:concurrency},async()=>{
    while(true){const index=cursor++;if(index>=items.length)return;try{results[index]={status:"fulfilled",value:await worker(items[index],index)};}catch(reason){results[index]={status:"rejected",reason};}}
  });
  await Promise.all(runners);return results;
}

async function fetchAppsScriptActionDirect_(url,action,{force=false,compact=true,retries=2,since="",timeoutMs=45000,params:extraParams={}}={}){
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

// Apps Script queda reservado para acciones no migradas, escrituras y como respaldo
// de frescura cuando la réplica de Supabase quedó atrasada.
export async function fetchAction(url,action,options={}){
  const actionKey=String(action||"");
  if(actionKey==="mantenimiento_programado")return fetchSupabasePmSnapshot();
  if(SUPABASE_TYPED_SOURCES.has(actionKey))return fetchSource(url,actionKey,options);
  return fetchAppsScriptActionDirect_(url,actionKey,options);
}

// Compatibilidad para consumidores antiguos: el bundle se arma directamente desde
// Supabase. No vuelve a abrir las cuatro Google Sheets ni depende de Apps Script.
export async function fetchRop02Bundle(_url,{force=false}={}){
  const key=force?"force":"normal",now=Date.now();
  if(!force&&rop02BundleMemo_.key===key&&rop02BundleMemo_.value&&now-rop02BundleMemo_.at<30000)return rop02BundleMemo_.value;
  if(rop02BundleMemo_.key===key&&rop02BundleMemo_.promise)return rop02BundleMemo_.promise;
  const task=Promise.all(ROP02_BUNDLE_SOURCES.map(source=>fetchTypedSupabaseSource_(source))).then(values=>{
    const sources={};values.forEach((value,index)=>{sources[ROP02_BUNDLE_SOURCES[index]]=value;});
    const bundle={ok:true,source:"supabase",bundleId:`supabase-${Date.now()}`,sources};
    rop02BundleMemo_={key,value:bundle,at:Date.now(),promise:null};return bundle;
  }).catch(error=>{if(rop02BundleMemo_.promise===task)rop02BundleMemo_={key:"",value:null,at:0,promise:null};throw error;});
  rop02BundleMemo_={key,value:null,at:now,promise:task};return task;
}

export async function fetchHealth(_url){return fetchSupabaseHealth();}

export async function fetchSource(_url,source,_options={}){
  const sourceKey=String(source||"");
  if(!SUPABASE_TYPED_SOURCES.has(sourceKey))return fetchAppsScriptActionDirect_(_url,sourceKey,_options);

  // Camino rápido: Supabase responde primero. Si la réplica está razonablemente fresca,
  // no se toca Sheets. Esto mantiene la navegación rápida y reduce ejecuciones de Apps Script.
  const replica=await fetchTypedSupabaseSource_(sourceKey);
  const replicaAge=sourceReplicaAgeMs_(replica);
  const staleReplica=replicaAge>sourceReplicaMaxAgeMs_(sourceKey);

  // En el primer arranque sin cache devolvemos la réplica enseguida aunque esté vieja,
  // para no bloquear la interfaz. Cuando ya existe una copia local (since) o el usuario
  // pulsa Actualizar (force), sí intentamos traer la fuente viva desde Google Sheets.
  const canRefreshLive=Boolean(_options?.force||_options?.since);
  if(!staleReplica||!canRefreshLive){
    return {...replica,meta:{...(replica?.meta||{}),staleReplica,replicaAgeMs:Number.isFinite(replicaAge)?Math.round(replicaAge):null}};
  }

  try{
    const live=await fetchAppsScriptActionDirect_(_url,sourceKey,{..._options,retries:0});
    return {
      ...live,
      source:live?.source||"apps-script-live",
      meta:{
        ...(live?.meta||{}),
        staleReplica:false,
        freshnessSource:"google-sheets",
        replicaAgeMs:Number.isFinite(replicaAge)?Math.round(replicaAge):null,
        replicaServerTime:replica?.meta?.serverTime||null,
      }
    };
  }catch(error){
    console.warn(`[freshness] ${sourceKey}: Supabase está atrasado y Sheets no respondió; se conserva la réplica.`,error);
    return {
      ...replica,
      meta:{
        ...(replica?.meta||{}),
        staleReplica:true,
        liveRefreshFailed:true,
        replicaAgeMs:Number.isFinite(replicaAge)?Math.round(replicaAge):null,
      }
    };
  }
}

// El heartbeat sigue saliendo de Supabase; es liviano y no abre una planilla.
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
