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
  const u=new URL(cleanBase);
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
  const runners=Array.from({length:Math.min(Math.max(1,limit),items.length)},async()=>{
    while(true){
      const index=cursor++;
      if(index>=items.length)return;
      try{results[index]={status:"fulfilled",value:await worker(items[index],index)};}
      catch(reason){results[index]={status:"rejected",reason};}
    }
  });
  await Promise.all(runners);
  return results;
}

export async function fetchAction(url,action,{force=false,compact=true,retries=2,since="",timeoutMs=45000}={}){
  const params={};
  if(force)params.force="1";
  if(since&&!force)params.since=since;
  if(compact&&!['health','diag','clear_cache','sync','versions','get_data_versions'].includes(action))params.compact="1";
  if(action==="rop05")params.limit="all";

  let lastErr=null;
  for(let attempt=0;attempt<=retries;attempt++){
    const controller=typeof AbortController!=="undefined"?new AbortController():null;
    const timer=controller?setTimeout(()=>controller.abort(),timeoutMs):null;
    try{
      const requestUrl=buildAppsScriptUrl(url,action,params);
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

export async function fetchHealth(url){return fetchAction(url,"health",{compact:false});}
export async function fetchSource(url,source,{force=false,since="",retries=2,timeoutMs=45000}={}){return fetchAction(url,source,{force,compact:true,since,retries,timeoutMs});}
export async function fetchSyncVersions(url,{timeoutMs=7000}={}){
  // Version checking is only an optimization. It must never hold a view open
  // while the Apps Script endpoint is slow or unavailable.
  const options={compact:false,retries:0,timeoutMs};
  try{return await fetchAction(url,"get_data_versions",options);}
  catch(_){
    try{return await fetchAction(url,"sync",options);}
    catch(__){return null;}
  }
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
