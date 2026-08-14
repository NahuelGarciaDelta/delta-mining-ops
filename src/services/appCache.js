export const APP_FILTERS_STATE_KEY="dm_app_filters_state_v1";
const APP_IDB_NAME="delta_mining_cache_backend_20260814_v4";
const APP_IDB_VERSION=1;
const APP_IDB_STORE="datasets";
const APP_CACHE_VERSION=4;
const APP_CACHE_MANIFEST_KEY="dm_app_cache_manifest_v4";
const APP_LOCAL_CACHE_PREFIX="dm_app_cache_source_v4_";

let appCacheDBPromise_=null;
const memoryCache_=new Map();

export function readSavedAppFilters(){
  try{return JSON.parse(window.localStorage.getItem(APP_FILTERS_STATE_KEY)||"{}");}
  catch(_){return{};}
}

function openAppCacheDB(){
  if(appCacheDBPromise_)return appCacheDBPromise_;
  appCacheDBPromise_=new Promise((resolve,reject)=>{
    if(!window.indexedDB){reject(new Error("IndexedDB no está disponible"));return;}
    const req=window.indexedDB.open(APP_IDB_NAME,APP_IDB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(APP_IDB_STORE))db.createObjectStore(APP_IDB_STORE,{keyPath:"key"});
    };
    req.onsuccess=()=>{
      const db=req.result;
      db.onversionchange=()=>{db.close();appCacheDBPromise_=null;};
      resolve(db);
    };
    req.onerror=()=>{appCacheDBPromise_=null;reject(req.error||new Error("No se pudo abrir IndexedDB"));};
    req.onblocked=()=>{appCacheDBPromise_=null;reject(new Error("IndexedDB está bloqueada por otra pestaña"));};
  });
  return appCacheDBPromise_;
}
function idbRequest_(request){return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
function idbTransactionDone_(tx){return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error("Transacción IndexedDB cancelada"));});}
function readCacheManifest_(){try{return JSON.parse(window.localStorage.getItem(APP_CACHE_MANIFEST_KEY)||"{}");}catch(_){return{};}}
function writeCacheManifest_(manifest){try{window.localStorage.setItem(APP_CACHE_MANIFEST_KEY,JSON.stringify(manifest||{}));}catch(_){} }
function updateCacheManifest_(key,record){
  const manifest=readCacheManifest_();
  manifest[key]={updatedAt:record?.updatedAt||new Date().toISOString(),count:record?.count||0,version:APP_CACHE_VERSION};
  writeCacheManifest_(manifest);
}
function normalizeRecord_(record){
  if(!record)return null;
  const data=record.data??record.value;
  if(!data)return null;
  // Compatibilidad del contrato de cache: App.jsx consume `record.value`, mientras
  // la versión nueva persiste el payload bajo `record.data`. Exponer ambos evita
  // perder el snapshot completo antes de fusionar una respuesta incremental.
  return {...record,data,value:data,version:Number(record.version||data?.meta?.serverVersion||0)};
}
export async function readCachedSourceRecords(keys){
  const wanted=[...new Set((keys||[]).filter(Boolean))];
  if(!wanted.length)return{};
  try{
    const missing=wanted.filter(key=>!memoryCache_.has(key));
    if(!missing.length)return Object.fromEntries(wanted.map(key=>[key,memoryCache_.get(key)]));
    const db=await openAppCacheDB();
    const tx=db.transaction(APP_IDB_STORE,"readonly");
    const store=tx.objectStore(APP_IDB_STORE);
    const pairs=await Promise.all(missing.map(async key=>[key,normalizeRecord_(await idbRequest_(store.get(key)).catch(()=>null))]));
    pairs.forEach(([key,record])=>{if(record)memoryCache_.set(key,record);});
    return Object.fromEntries(wanted.map(key=>[key,memoryCache_.get(key)||null]));
  }catch(_){
    return Object.fromEntries(wanted.map(key=>[key,memoryCache_.get(key)||null]));
  }
}
export async function readCachedSources(keys){
  const records=await readCachedSourceRecords(keys);
  const out={};
  Object.entries(records).forEach(([key,rec])=>{if(rec?.data)out[key]=rec.data;});
  return out;
}
async function writeCachedSources(sources){
  const entries=Object.entries(sources||{});
  if(!entries.length)return;
  const updatedAt=new Date().toISOString();
  const records=entries.map(([key,data])=>({key,data,updatedAt,count:Array.isArray(data?.data)?data.data.length:0,version:Number(data?.meta?.serverVersion||APP_CACHE_VERSION)}));
  records.forEach(rec=>{memoryCache_.set(rec.key,normalizeRecord_(rec));updateCacheManifest_(rec.key,rec);try{window.localStorage.removeItem(APP_LOCAL_CACHE_PREFIX+rec.key);}catch(_){}});
  try{
    const db=await openAppCacheDB();
    const tx=db.transaction(APP_IDB_STORE,"readwrite");
    const store=tx.objectStore(APP_IDB_STORE);
    records.forEach(rec=>store.put(rec));
    await idbTransactionDone_(tx);
  }catch(_){/* La copia de sesión sigue disponible; no duplicamos datasets grandes en localStorage. */}
}
export function readSavedDataSources(){
  const manifest=readCacheManifest_();
  const times=Object.values(manifest||{}).map(r=>new Date(r?.updatedAt||0).getTime()).filter(Number.isFinite);
  return{sources:{},updatedAt:times.length?new Date(Math.max(...times)).toISOString():null};
}
export function saveDataSourcesToStorage(sources){writeCachedSources(sources).catch(()=>{});}
export function getCachedSourceTimestamp(record){return record?.updatedAt||record?.data?.meta?.updatedAt||record?.data?.updatedAt||null;}
function getRowIdentity_(row,index){
  if(!row||typeof row!=="object")return `idx:${index}:${String(row)}`;
  const keys=["id","ID","_id","rowId","rowIndex","fila","Fila","N° Parte","N Parte","Numero Parte","Código Nuevo","Codigo Nuevo","Código","Codigo","nSolicitud","N° de solicitud","Nº de solicitud","numeroRemito","N° Remito"];
  for(const k of keys){const v=row[k];if(v!==undefined&&v!==null&&String(v)!=="")return `${k}:${String(v)}`;}
  return JSON.stringify(row);
}
export function mergeIncrementalSource(previous,next){
  const incremental=next?.incremental===true||next?.meta?.incremental===true||next?.mode==="incremental";
  if(!incremental||!Array.isArray(previous?.data)||!Array.isArray(next?.data))return next;
  const map=new Map(previous.data.map((r,i)=>[getRowIdentity_(r,i),r]));
  next.data.forEach((r,i)=>map.set(getRowIdentity_(r,i),r));
  const deleted=new Set(next?.deletedKeys||next?.meta?.deletedKeys||[]);
  deleted.forEach(k=>map.delete(String(k)));
  const data=[...map.values()];
  return {...previous,...next,data,meta:{...(previous.meta||{}),...(next.meta||{}),rows:data.length,returnedRows:data.length,hasMore:false,incremental:false}};
}

export async function readCachedSource(key){const rows=await readCachedSourceRecords([key]);return rows[key]||null;}
export async function writeCachedSource(key,value){return writeCachedSources({[key]:value});}
export async function clearDatasetCache(keys){
  const wanted=keys?[...new Set((Array.isArray(keys)?keys:[keys]).filter(Boolean))]:null;
  if(wanted)wanted.forEach(key=>memoryCache_.delete(key));else memoryCache_.clear();
  const db=await openAppCacheDB();
  const tx=db.transaction(APP_IDB_STORE,"readwrite");
  const store=tx.objectStore(APP_IDB_STORE);
  if(wanted)wanted.forEach(key=>store.delete(key));else store.clear();
  await idbTransactionDone_(tx);
  const manifest=readCacheManifest_();
  if(wanted)wanted.forEach(key=>delete manifest[key]);else Object.keys(manifest).forEach(key=>delete manifest[key]);
  writeCacheManifest_(manifest);
}
