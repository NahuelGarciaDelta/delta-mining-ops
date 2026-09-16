const LEDGER_STORAGE_KEY="dm_mutation_guard_v1";
const SUCCESS_TTL_MS=90*1000;
const UNCERTAIN_TTL_MS=60*1000;
const PENDING_TTL_MS=75*1000;
const MAX_LEDGER_ENTRIES=120;
const VOLATILE_KEYS=new Set(["mutationId","_mutationId","requestId","_requestId","nonce","_t"]);
const inFlight=new Map();
const memoryLedger=new Map();
let installed=false;
let nativeFetch=null;

const lower=value=>String(value??"").trim().toLowerCase();
const fold=value=>String(value??"").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Z0-9]+/g,"");

function normalizeDate(value){
  const raw=String(value??"").trim();
  if(!raw)return"";
  let m=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(m)return`${m[1]}-${String(m[2]).padStart(2,"0")}-${String(m[3]).padStart(2,"0")}`;
  m=raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})/);
  if(m){let year=Number(m[3]);if(year<100)year+=2000;return`${year}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`;}
  const parsed=new Date(raw);
  return Number.isNaN(parsed.getTime())?raw:parsed.toISOString().slice(0,10);
}

function hash32(value,seed){
  let hash=seed>>>0;
  const text=String(value??"");
  for(let index=0;index<text.length;index++){
    hash^=text.charCodeAt(index);
    hash=Math.imul(hash,16777619);
  }
  return hash>>>0;
}

function digest(value){
  const a=hash32(value,2166136261).toString(36).padStart(7,"0");
  const b=hash32(value,2246822519).toString(36).padStart(7,"0");
  return`${a}${b}`.toUpperCase();
}

function shouldIgnoreKey(action,path,key){
  if(VOLATILE_KEYS.has(key))return true;
  const parent=path[path.length-1]||"";
  if(action==="save_remito_cargado"&&parent==="remito"&&["id","ID_REMITO"].includes(key))return true;
  if(["save_equipment_movement","save_taller_movement","registrar_pm_realizado"].includes(action)&&["movement","movimiento","registro"].includes(parent)&&["id","ID","uuid","_id"].includes(key))return true;
  return false;
}

function canonicalize(value,action,path=[]){
  if(value===null||value===undefined)return value??null;
  if(value instanceof Date)return value.toISOString();
  if(Array.isArray(value))return value.map((item,index)=>canonicalize(item,action,[...path,String(index)]));
  if(typeof value!=="object")return value;
  const out={};
  Object.keys(value).sort().forEach(key=>{
    if(shouldIgnoreKey(action,path,key))return;
    out[key]=canonicalize(value[key],action,[...path,key]);
  });
  return out;
}

export function stableStringify(value,action=""){
  return JSON.stringify(canonicalize(value,lower(action)));
}

export function mutationFingerprint(payload={}){
  const action=lower(payload?.action);
  return`${action||"mutation"}:${digest(stableStringify(payload,action))}`;
}

export function remitoBusinessKey(remito={}){
  const comprobante=fold(remito.comprobante||remito.nRemito||remito.N_REMITO||"");
  const fecha=normalizeDate(remito.fecha||remito.FECHA_REMITO||"");
  const proyecto=fold(remito.proyecto||remito.centroCosto||remito.destino||remito.observaciones||"");
  if(comprobante&&comprobante!=="SN")return`NUM|${comprobante}|${fecha}|${proyecto}`;
  const origen=fold(remito.origen||"");
  const destino=fold(remito.destino||"");
  const observaciones=fold(remito.observaciones||"");
  const items=(Array.isArray(remito.items)?remito.items:[]).map(item=>{
    const codigo=fold(item?.codigo||item?.codigoArticulo||item?.CODIGO_ARTICULO||"");
    const cantidad=Number(item?.cantidad??item?.cantidadEnviada??item?.CANTIDAD_ENVIADA??0)||0;
    const descripcion=fold(item?.descripcion||item?.DESCRIPCION||"");
    return`${codigo}:${cantidad}:${descripcion}`;
  }).filter(Boolean).sort().join(";");
  return`SN|${fecha}|${proyecto}|${origen}|${destino}|${observaciones}|${items}`;
}

function readCachedRemitos(){
  if(typeof window==="undefined")return[];
  try{const rows=JSON.parse(window.localStorage.getItem("dm_raba08_remitos_v1")||"[]");return Array.isArray(rows)?rows:[];}catch(_){return[];}
}

export function stableRemitoId(remito={},existingRemitos){
  const key=remitoBusinessKey(remito);
  const rows=Array.isArray(existingRemitos)?existingRemitos:readCachedRemitos();
  const existing=rows.find(row=>remitoBusinessKey(row)===key&&String(row?.id||row?.ID_REMITO||"").trim());
  if(existing)return String(existing.id||existing.ID_REMITO).trim();
  return`raba08-${digest(key)}`;
}

export function prepareMutationPayload(payload={}){
  let prepared;
  try{prepared=JSON.parse(JSON.stringify(payload||{}));}catch(_){prepared={...(payload||{})};}
  const action=lower(prepared?.action);
  if(action==="save_remito_cargado"&&prepared.remito){
    prepared.remito.id=stableRemitoId(prepared.remito);
  }
  const fingerprint=mutationFingerprint(prepared);
  prepared.mutationId=fingerprint;
  return{payload:prepared,fingerprint,action};
}

export function isProtectedMutationAction(action){
  const normalized=lower(action);
  return Boolean(normalized&&normalized!=="authenticate_user");
}

function parseLedgerStorage(){
  if(typeof window==="undefined")return{};
  try{return JSON.parse(window.localStorage.getItem(LEDGER_STORAGE_KEY)||"{}")||{};}catch(_){return{};}
}

function cleanupLedgerObject(object){
  const now=Date.now();
  const entries=Object.entries(object||{}).filter(([,entry])=>Number(entry?.until||0)>now);
  entries.sort((a,b)=>Number(b[1]?.at||0)-Number(a[1]?.at||0));
  return Object.fromEntries(entries.slice(0,MAX_LEDGER_ENTRIES));
}

function readLedgerEntry(fingerprint){
  const memory=memoryLedger.get(fingerprint);
  if(memory&&Number(memory.until)>Date.now())return memory;
  if(memory)memoryLedger.delete(fingerprint);
  const object=cleanupLedgerObject(parseLedgerStorage());
  const entry=object[fingerprint]||null;
  if(entry)memoryLedger.set(fingerprint,entry);
  return entry;
}

function writeLedgerEntry(fingerprint,state,ttlMs,action){
  const entry={state,action:String(action||""),at:Date.now(),until:Date.now()+ttlMs};
  memoryLedger.set(fingerprint,entry);
  if(typeof window!=="undefined"){
    try{
      const object=cleanupLedgerObject(parseLedgerStorage());
      object[fingerprint]=entry;
      window.localStorage.setItem(LEDGER_STORAGE_KEY,JSON.stringify(cleanupLedgerObject(object)));
    }catch(_){}
  }
  return entry;
}

function matchesAppsScriptUrl(input,configuredUrl){
  try{
    const raw=typeof Request!=="undefined"&&input instanceof Request?input.url:String(input||"");
    const base=typeof window!=="undefined"?window.location.href:"http://localhost/";
    const target=new URL(raw,base);
    if(target.pathname==="/api/apps-script"||target.pathname.endsWith("/api/apps-script"))return true;
    if(target.hostname==="script.google.com"&&target.pathname.includes("/macros/s/"))return true;
    if(configuredUrl){
      const configured=new URL(configuredUrl,base);
      return configured.origin===target.origin&&configured.pathname===target.pathname;
    }
  }catch(_){}
  return false;
}

function payloadFromBody(body){
  if(body===null||body===undefined)return null;
  if(typeof URLSearchParams!=="undefined"&&body instanceof URLSearchParams){
    const raw=body.get("payload");
    if(!raw)return null;
    try{return{payload:JSON.parse(raw),kind:"params",body};}catch(_){return null;}
  }
  if(typeof FormData!=="undefined"&&body instanceof FormData){
    const raw=body.get("payload");
    if(typeof raw!=="string")return null;
    try{return{payload:JSON.parse(raw),kind:"formdata",body};}catch(_){return null;}
  }
  if(typeof body==="string"){
    try{
      const params=new URLSearchParams(body);
      if(params.has("payload"))return{payload:JSON.parse(params.get("payload")),kind:"string-params",body};
    }catch(_){}
    try{
      const json=JSON.parse(body);
      if(json&&typeof json==="object"&&json.action)return{payload:json,kind:"json",body};
    }catch(_){}
  }
  return null;
}

async function extractMutation(input,init,configuredUrl){
  const requestMethod=typeof Request!=="undefined"&&input instanceof Request?input.method:"GET";
  const method=String(init?.method||requestMethod||"GET").toUpperCase();
  if(method!=="POST"||!matchesAppsScriptUrl(input,configuredUrl))return null;
  let body=init?.body;
  let fromRequest=false;
  if((body===null||body===undefined)&&typeof Request!=="undefined"&&input instanceof Request){
    try{body=await input.clone().text();fromRequest=true;}catch(_){return null;}
  }
  const parsed=payloadFromBody(body);
  if(!parsed||!isProtectedMutationAction(parsed.payload?.action))return null;
  return{...parsed,fromRequest};
}

function rewriteBody(parsed,preparedPayload){
  const raw=JSON.stringify(preparedPayload);
  if(parsed.kind==="params"){
    const params=new URLSearchParams(parsed.body);params.set("payload",raw);return params;
  }
  if(parsed.kind==="string-params"){
    const params=new URLSearchParams(parsed.body);params.set("payload",raw);return params.toString();
  }
  if(parsed.kind==="formdata"){
    const form=new FormData();for(const [key,value] of parsed.body.entries())form.append(key,value);form.set("payload",raw);return form;
  }
  if(parsed.kind==="json")return raw;
  return parsed.body;
}

async function responseSnapshot(response){
  const body=await response.text();
  const headers={};
  response.headers?.forEach?.((value,key)=>{headers[key]=value;});
  let json=null;
  try{json=body?JSON.parse(body):null;}catch(_){}
  return{status:response.status,statusText:response.statusText||"",headers,body,json};
}

function responseFromSnapshot(snapshot){
  return new Response(snapshot.body,{status:snapshot.status,statusText:snapshot.statusText,headers:snapshot.headers});
}

function duplicateSuccessResponse(fingerprint,action){
  return new Response(JSON.stringify({
    ok:true,
    deduplicated:true,
    duplicatePrevented:true,
    mutationId:fingerprint,
    action,
    message:"La operación ya había sido confirmada. Se evitó enviarla por segunda vez."
  }),{status:200,headers:{"Content-Type":"application/json; charset=utf-8","X-Delta-Duplicate-Prevented":"1"}});
}

function blockedError(state){
  const error=new Error(state==="uncertain"
    ?"La operación anterior quedó sin confirmación. Para evitar duplicar datos, no se reenviará todavía. Actualizá la vista para verificar el resultado antes de intentar nuevamente."
    :"La misma operación ya se está procesando. Se evitó enviarla por segunda vez.");
  error.code=state==="uncertain"?"MUTATION_CONFIRMATION_UNKNOWN":"MUTATION_ALREADY_PENDING";
  return error;
}

function emitState(detail){
  if(typeof window==="undefined"||typeof window.dispatchEvent!=="function")return;
  try{window.dispatchEvent(new CustomEvent("dm-mutation-guard",{detail}));}catch(_){}
}

async function executeGuarded(input,init,fingerprint,action){
  const existing=readLedgerEntry(fingerprint);
  if(existing?.state==="success")return{duplicate:true,response:duplicateSuccessResponse(fingerprint,action)};
  if(existing&&["pending","uncertain"].includes(existing.state))throw blockedError(existing.state);

  writeLedgerEntry(fingerprint,"pending",PENDING_TTL_MS,action);
  emitState({state:"pending",fingerprint,action});
  try{
    const response=await nativeFetch(input,init);
    const snapshot=await responseSnapshot(response);
    const confirmed=snapshot.status>=200&&snapshot.status<300&&snapshot.json?.ok===true;
    if(confirmed){
      writeLedgerEntry(fingerprint,"success",SUCCESS_TTL_MS,action);
      emitState({state:"success",fingerprint,action});
    }else{
      writeLedgerEntry(fingerprint,"uncertain",UNCERTAIN_TTL_MS,action);
      emitState({state:"uncertain",fingerprint,action,status:snapshot.status});
    }
    return{duplicate:false,snapshot};
  }catch(cause){
    writeLedgerEntry(fingerprint,"uncertain",UNCERTAIN_TTL_MS,action);
    emitState({state:"uncertain",fingerprint,action,error:String(cause?.message||cause||"")});
    const error=blockedError("uncertain");
    error.cause=cause;
    throw error;
  }
}

async function withCrossTabLock(fingerprint,worker){
  if(typeof navigator!=="undefined"&&navigator.locks?.request){
    return navigator.locks.request(`dm-mutation-${digest(fingerprint)}`,{mode:"exclusive"},worker);
  }
  return worker();
}

export function installMutationGuard({appsScriptUrl=""}={}){
  if(typeof window==="undefined"||installed||window.__dmMutationGuardInstalled)return;
  installed=true;
  window.__dmMutationGuardInstalled=true;
  nativeFetch=window.fetch.bind(window);
  window.dmStableRemitoId=stableRemitoId;
  window.fetch=function guardedFetch(input,init={}){
    return(async()=>{
      const parsed=await extractMutation(input,init,appsScriptUrl);
      if(!parsed)return nativeFetch(input,init);

      const prepared=prepareMutationPayload(parsed.payload);
      const rewrittenBody=rewriteBody(parsed,prepared.payload);
      let nextInput=input;
      let nextInit={...init};
      if(parsed.fromRequest&&typeof Request!=="undefined"&&input instanceof Request){
        nextInput=new Request(input,{method:"POST",body:rewrittenBody});
        nextInit={...init,body:undefined};
      }else nextInit.body=rewrittenBody;

      const existingTask=inFlight.get(prepared.fingerprint);
      if(existingTask){
        const result=await existingTask;
        if(result.response)return result.response.clone();
        return responseFromSnapshot(result.snapshot);
      }

      const task=withCrossTabLock(prepared.fingerprint,()=>executeGuarded(nextInput,nextInit,prepared.fingerprint,prepared.action));
      inFlight.set(prepared.fingerprint,task);
      try{
        const result=await task;
        if(result.response)return result.response.clone();
        return responseFromSnapshot(result.snapshot);
      }finally{
        if(inFlight.get(prepared.fingerprint)===task)inFlight.delete(prepared.fingerprint);
      }
    })();
  };
}

export function resetMutationGuardForTests(){
  inFlight.clear();memoryLedger.clear();installed=false;
  if(typeof window!=="undefined"){
    if(nativeFetch)window.fetch=nativeFetch;
    try{window.localStorage.removeItem(LEDGER_STORAGE_KEY);}catch(_){}
    delete window.__dmMutationGuardInstalled;
    delete window.dmStableRemitoId;
  }
  nativeFetch=null;
}
