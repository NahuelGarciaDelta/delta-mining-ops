const inflight=new Map();

export function stableRequestValue(value){
  if(Array.isArray(value))return value.map(stableRequestValue);
  if(value&&typeof value==="object")return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stableRequestValue(value[key])]));
  return value;
}

export function appsScriptRequestKey(url,action,params,{timeoutMs,retries}={}){
  const base=String(url||"").trim().replace(/\/+$/,"");
  return JSON.stringify({base,action:String(action||""),params:stableRequestValue(params),timeoutMs:Number(timeoutMs),retries:Number(retries)});
}

export function shareAppsScriptRequest(key,request){
  const pending=inflight.get(key);
  if(pending)return pending;
  const task=Promise.resolve().then(request);
  inflight.set(key,task);
  const clear=()=>{if(inflight.get(key)===task)inflight.delete(key);};
  task.then(clear,clear);
  return task;
}

export function resetAppsScriptInflightForTests(){inflight.clear();}
