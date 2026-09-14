const ROP02_BUNDLE_SOURCES=Object.freeze(["rop02_jm","rop02_fs","rop02_filosur","rop02_zorro"]);
const ROP02_BUNDLE_SOURCE_SET=new Set(ROP02_BUNDLE_SOURCES);
const ROP02_CORE_SOURCE_SET=new Set(["rop02_jm","rop02_fs"]);
const ROP02_OPTIONAL_SOURCE_SET=new Set(["rop02_filosur","rop02_zorro"]);
// Estas fuentes ya tienen una versión de dataset en Apps Script. La clave de
// CacheService incluye esa versión, por lo que cuando cambia la planilla el
// trigger invalida naturalmente la respuesta anterior. No hace falta forzar una
// relectura completa de Google Sheets cada 5 minutos desde el frontend.
const VERSIONED_SERVER_CACHE_SOURCES=new Set([
  "rop02_jm","rop02_fs","rop02_filosur","rop02_zorro",
  "rma15_jm","rma15_fs","insumos","rop05","lista_equipos"
]);
let rop02BundleMemo_={key:"",value:null,at:0,promise:null};
let syncVersionsMemo_={url:"",value:null,at:0,promise:null};
const SYNC_VERSIONS_MEMO_MS=15000;

export function expandCompactSource(src){
  if(!src||!src.compact||!Array.isArray(src.headers)||!Array.isArray(src.rows))return src;
  return {
    ...src,
    compact:false,
    data:src.rows.map(arr=>{
      const obj={};
      src.headers.forEach((h,i)=>{obj[h]=arr?.[i]??"";});
      return obj;
    })
  };
}

export function expandCompactResponse(json){
  if(!json)return json;
  if(json.compact)return expandCompactSource(json);
  if(json.sources){
    const sources={};
    Object.entries(json.sources).forEach(([key,val])=>{sources[key]=expandCompactSource(val);});
    return {...json,sources};
  }
  return json;
}

export function buildAppsScriptUrl(baseUrl,action,params={}){
  const cleanBase=String(baseUrl||"").trim().replace(/\/+$/,"");
  const origin=typeof window!=="undefined"&&window.location?.origin?window.location.origin:"http://localhost";
  const u=new URL(cleanBase,origin);
  u.searchParams.set("action",action);
  u.searchParams.set("_t",String(Date.now()));
  Object.entries(params||{}).forEach(([k,v])=>{
    if(v!==undefined&&v!==null&&v!=="")u.searchParams.set(k,String(v));
  });
  return u.toString();
}

export function sleep_(ms){return new Promise(resolve=>setTimeout(resolve,ms));}

export async function runWithConcurrency_(items,limit,worker){
  const results=new Array(items.length);
  let cursor=0;
  // Respetar el límite pedido por cada flujo. App.jsx usa 4 para la precarga
  // principal; otros módulos pueden pedir menos para no competir entre sí.
  const concurrency=Math.min(Math.max(1,Number(limit)||1),items.length);
  const runners=Array.from({length:concurrency},async()=>{
    while(true){
      const index=cursor++;
      if(index>=items.length)return;
      try{results[index]={status:"fulfilled",value:await worker(items[index],index)};}
      catch(reason){results[index]={status:"rejected",reason};}
    }
  });
  await Promise.all(runners);

  // Cada fuente se resuelve de forma independiente. Una falla de JM, FDS,
  // Filo Sur o El Zorro nunca convierte artificialmente otra fuente exitosa
  // en fallida; la capa superior conserva únicamente la última copia válida
  // de la fuente que haya fallado.
  return results;
}

export async function fetchAction(url,action,{force=false,compact=true,retries=2,since="",timeoutMs=45000,params:extraParams={}}={}){
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
      const text=await res.text();
      let json;
      try{json=JSON.parse(text);}catch(_){throw new Error("El Apps Script devolvió HTML. Verificá que esté publicado como 'Cualquier persona'.");}
      json=expandCompactResponse(json);
      if(!json.ok&&!json.sources)throw new Error(json.error?.message||"Respuesta inválida del Apps Script");
      return json;
    }catch(err){
      lastErr=err?.name==="AbortError"
        ?new Error(`La consulta ${action} superó ${Math.round(timeoutMs/1000)} segundos`)
        :err;
      if(attempt<retries)await sleep_(700*(attempt+1));
    }finally{
      if(timer)clearTimeout(timer);
    }
  }
  throw lastErr;
}

// Se conserva sólo para diagnóstico/precalentamiento. El frontend ya no depende
// de una única llamada gigante que en frío lee las cuatro planillas secuencialmente.
export async function fetchRop02Bundle(url,{force=false,retries=0,timeoutMs=45000}={}){
  const key=force?"force":"normal";
  const now=Date.now();
  if(!force&&rop02BundleMemo_.key===key&&rop02BundleMemo_.value&&now-rop02BundleMemo_.at<30000){
    return rop02BundleMemo_.value;
  }
  if(rop02BundleMemo_.key===key&&rop02BundleMemo_.promise)return rop02BundleMemo_.promise;

  const task=fetchAction(url,"rop02_bundle",{
    force,
    compact:true,
    retries,
    timeoutMs,
    params:{sources:ROP02_BUNDLE_SOURCES.join(",")}
  }).then(bundle=>{
    if(!bundle?.ok||!bundle?.sources)throw new Error(bundle?.error?.message||"El backend no devolvió el bundle ROP02 completo.");
    for(const source of ROP02_BUNDLE_SOURCES){
      const value=bundle.sources[source];
      if(!value?.ok||!Array.isArray(value.data)||value.data.length===0){
        throw new Error(`ROP02_BUNDLE_INCOMPLETO: falta ${source}.`);
      }
      value.meta={...(value.meta||{}),bundleId:bundle.bundleId||value.meta?.bundleId||""};
    }
    rop02BundleMemo_={key,value:bundle,at:Date.now(),promise:null};
    return bundle;
  }).catch(error=>{
    if(rop02BundleMemo_.promise===task)rop02BundleMemo_={key:"",value:null,at:0,promise:null};
    throw error;
  });

  rop02BundleMemo_={key,value:null,at:now,promise:task};
  return task;
}

export async function fetchHealth(url){return fetchAction(url,"health",{compact:false});}

export async function fetchSource(url,source,{force=false,since="",retries=2,timeoutMs=45000}={}){
  const sourceKey=String(source||"");
  // Para datasets versionados se reutiliza siempre la caché compartida del
  // Apps Script. Si la hoja cambió, el trigger incrementa la versión y la nueva
  // clave obliga a reconstruir sólo esa fuente. Esto elimina las relecturas
  // completas periódicas que hacían esperar al usuario sin necesidad.
  const effectiveForce=VERSIONED_SERVER_CACHE_SOURCES.has(sourceKey)?false:force;

  if(ROP02_CORE_SOURCE_SET.has(sourceKey)){
    return fetchAction(url,sourceKey,{
      force:effectiveForce,
      compact:true,
      since,
      retries:Math.min(1,Math.max(0,Number(retries)||0)),
      timeoutMs:Math.min(45000,Math.max(20000,Number(timeoutMs)||30000))
    });
  }

  if(ROP02_OPTIONAL_SOURCE_SET.has(sourceKey)){
    return fetchAction(url,sourceKey,{
      force:effectiveForce,
      compact:true,
      since,
      retries:0,
      timeoutMs:Math.min(20000,Math.max(10000,Number(timeoutMs)||15000))
    });
  }

  return fetchAction(url,sourceKey,{force:effectiveForce,compact:true,since,retries,timeoutMs});
}

export async function fetchSyncVersions(url,{timeoutMs=7000}={}){
  const key=String(url||"");
  const now=Date.now();
  if(syncVersionsMemo_.url===key&&syncVersionsMemo_.value&&now-syncVersionsMemo_.at<SYNC_VERSIONS_MEMO_MS){
    return syncVersionsMemo_.value;
  }
  if(syncVersionsMemo_.url===key&&syncVersionsMemo_.promise)return syncVersionsMemo_.promise;

  const options={compact:false,retries:0,timeoutMs};
  const task=(async()=>{
    let value=null;
    try{value=await fetchAction(url,"get_data_versions",options);}
    catch(_){
      try{value=await fetchAction(url,"sync",options);}
      catch(__){value=null;}
    }
    if(value)syncVersionsMemo_={url:key,value,at:Date.now(),promise:null};
    return value;
  })();

  syncVersionsMemo_={url:key,value:syncVersionsMemo_.url===key?syncVersionsMemo_.value:null,at:syncVersionsMemo_.url===key?syncVersionsMemo_.at:0,promise:task};
  try{return await task;}
  finally{if(syncVersionsMemo_.promise===task)syncVersionsMemo_={...syncVersionsMemo_,promise:null};}
}

export async function fetchDatasetQuery(url,params={},options={}){
  const timeoutMs=Number(options?.timeoutMs)||60000;
  const controller=typeof AbortController!=="undefined"?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),timeoutMs):null;
  try{
    const response=await fetch(buildAppsScriptUrl(url,"query_dataset",params),{cache:"no-store",redirect:"follow",signal:controller?.signal});
    if(!response.ok)throw new Error(`HTTP ${response.status} desde Apps Script`);
    const text=await response.text();
    let json;try{json=JSON.parse(text);}catch(_){throw new Error("Apps Script no devolvió JSON válido");}
    if(!json?.ok)throw new Error(json?.error?.message||"Consulta de dataset inválida");
    return{...json,payloadBytes:new Blob([text]).size};
  }finally{if(timer)clearTimeout(timer);}
}
