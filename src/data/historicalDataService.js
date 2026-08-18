import {APPS_SCRIPT_URL} from "../config/app.js";
import {fetchDatasetQuery,fetchSyncVersions} from "../services/appsScriptApi.js";
import {readCachedSource,writeCachedSource} from "../services/appCache.js";
import {DATA_REFRESH_INTERVAL_MS} from "../services/dataRefreshPolicy.js";
import {buildDatasetQueryKey} from "./historicalQueryParams.js";
import {createPagedDatasetController as createPagedController} from "./pagedDatasetController.js";
export {buildDatasetQueryKey,operationalMonthRange,yearsForRange} from "./historicalQueryParams.js";
export {createPagedDatasetController} from "./pagedDatasetController.js";

const memory=new Map();
const pending=new Map();
const lastRevalidatedAt=new Map();
const MAX_MEMORY_QUERIES=8;
const HISTORICAL_UPDATED_EVENT="dm-historical-dataset-updated";
const COMMON_HISTORICAL_QUERY=Object.freeze({limit:"all",offset:0,sortBy:"fecha",sortDirection:"desc"});

function remember_(key,value){
  memory.delete(key);memory.set(key,value);
  while(memory.size>MAX_MEMORY_QUERIES)memory.delete(memory.keys().next().value);
}

function versionsDiffer_(localVersions={},remoteVersions={}){
  const local=localVersions||{};
  const remote=remoteVersions||{};
  const keys=new Set([...Object.keys(local),...Object.keys(remote)]);
  if(!keys.size)return false;
  for(const key of keys){
    if(Number(local[key]||0)!==Number(remote[key]||0))return true;
  }
  return false;
}

function notifyDatasetUpdated_(dataset,key,value,params){
  if(typeof window==="undefined"||typeof window.dispatchEvent!=="function")return;
  try{
    window.dispatchEvent(new CustomEvent(HISTORICAL_UPDATED_EVENT,{detail:{dataset,key,value,params:{...(params||{})}}}));
  }catch(_){}
}

function normalizeHomeProject_(value){
  const raw=String(value||"").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ");
  if(!raw||raw==="TODOS"||raw==="TODO")return "TODOS";
  if(raw==="JM"||raw.includes("JOSE MARIA"))return "JOSE MARIA";
  if(raw==="FS"||raw==="FDS"||raw==="FILO"||raw.includes("FILO DEL SOL")||raw.includes("VICUNA"))return "FILO DEL SOL";
  if(raw==="FILOSUR"||raw.includes("FILO SUR"))return "FILO SUR";
  if(raw==="ZORRO"||raw.includes("EL ZORRO"))return "EL ZORRO";
  return raw;
}

function currentHomeProject_(){
  if(typeof window==="undefined")return "TODOS";
  return normalizeHomeProject_(window.__dmHomeSummaryProject||"TODOS");
}

function usesExternalHomeFilter_(){
  return typeof window!=="undefined"&&window.__dmHomeSummaryExternalFilter===true;
}

function rowProject_(row){
  return normalizeHomeProject_(row?.PROYECTO??row?.proyecto??row?.Proyecto??row?.LUGAR??row?.lugar??row?.Lugar??"");
}

function filterHomeProjectResponse_(response){
  const project=currentHomeProject_();
  if(project==="TODOS"||!Array.isArray(response?.data))return response;
  const data=response.data.filter(row=>rowProject_(row)===project);
  return {...response,data,rows:data.length,total:data.length};
}

function normalizeEquipmentSnapshotCode_(value){
  return String(value||"")
    .trim()
    .toUpperCase()
    .replace(/\s*\(.*?\)/g,"")
    .replace(/[^A-Z0-9]/g,"");
}

function isVehicleSnapshotRow_(row){
  const code=normalizeEquipmentSnapshotCode_(row?.INTERNO??row?.equipo??row?.maquina??row?.Interno??"");
  if(!code)return false;
  if(/^CTA/.test(code))return true;
  if(/^(AG|AH|AI)[0-9A-Z]{4,}$/.test(code))return true;
  if(["CAC","CAR","CAV","CAA"].some(prefix=>code.startsWith(prefix)))return true;
  if(code==="CAT0073")return true;
  return false;
}

function filterEquipmentOnlySnapshot_(response){
  if(!Array.isArray(response?.data))return response;
  const data=response.data.filter(row=>!isVehicleSnapshotRow_(row));
  return {...response,data,rows:data.length,total:data.length};
}

export async function readDatasetQuery(dataset,params={}){
  const key=buildDatasetQueryKey(dataset,params);
  if(memory.has(key)){const value=memory.get(key);remember_(key,value);return{...value,cacheHit:true,cacheLevel:"memory"};}
  const record=await readCachedSource(`query:${key}`).catch(()=>null);
  if(record?.data?.ok){remember_(key,record.data);return{...record.data,cacheHit:true,cacheLevel:"indexeddb",cacheUpdatedAt:record.updatedAt||null};}
  return null;
}

export async function fetchDatasetPage(dataset,params={}){
  const key=buildDatasetQueryKey(dataset,params);
  if(pending.has(key))return pending.get(key);
  const started=performance.now();
  const task=fetchDatasetQuery(APPS_SCRIPT_URL,{dataset,...params,limit:params.limit||250,offset:params.offset||0}).then(async response=>{
    const value={...response,cacheHit:false,cacheLevel:"network",elapsedMs:Math.round(performance.now()-started)};
    remember_(key,value);
    lastRevalidatedAt.set(key,Date.now());
    await writeCachedSource(`query:${key}`,value);
    notifyDatasetUpdated_(dataset,key,value,params);
    if(import.meta.env.DEV)console.debug("[dataset-query]",{dataset,requestedLimit:params.limit||250,rowsRead:response.rowsRead,rowsFiltered:response.rowsFiltered,received:response.rows,total:response.total,backendMs:response.backendMs,elapsedMs:value.elapsedMs,payloadBytes:response.payloadBytes,cache:"miss"});
    return value;
  }).finally(()=>{if(pending.get(key)===task)pending.delete(key);});
  pending.set(key,task);return task;
}

function shouldRevalidate_(key){
  const last=Number(lastRevalidatedAt.get(key)||0);
  return !last||Date.now()-last>=DATA_REFRESH_INTERVAL_MS;
}

function revalidateDatasetInBackground_(dataset,params,cached){
  const key=buildDatasetQueryKey(dataset,params);
  if(!shouldRevalidate_(key))return;
  lastRevalidatedAt.set(key,Date.now());
  fetchSyncVersions(APPS_SCRIPT_URL).then(sync=>{
    if(!versionsDiffer_(cached?.versions||{},sync?.versions||{}))return null;
    return fetchDatasetPage(dataset,params);
  }).catch(()=>{
    // El cache visible permanece intacto si falla la revalidación.
  });
}

export async function getDataset(dataset,params={}){
  const cached=await readDatasetQuery(dataset,params);
  if(!cached)return fetchDatasetPage(dataset,params);

  // Controles críticos que consultan un rango concreto deben validar frescura antes
  // de calcular. El resto de la app usa stale-while-revalidate: pinta el cache ya
  // disponible y comprueba datos nuevos sin bloquear la interfaz.
  const requireFresh=Boolean(params?.requireFresh||params?.desde||params?.hasta);
  if(requireFresh){
    try{
      const sync=await fetchSyncVersions(APPS_SCRIPT_URL);
      if(versionsDiffer_(cached.versions||{},sync?.versions||{})){
        return await fetchDatasetPage(dataset,params);
      }
      lastRevalidatedAt.set(buildDatasetQueryKey(dataset,params),Date.now());
    }catch(_){}
    return cached;
  }

  revalidateDatasetInBackground_(dataset,params,cached);
  return cached;
}

export const getRop02=params=>getDataset("rop02",params);
export const getRop05=params=>getDataset("rop05",params);
export const getRma15=params=>getDataset("rma15",params);
export const refreshHistoricalDataset=(dataset,params={})=>fetchDatasetPage(dataset,params);
export const HISTORICAL_DATASET_UPDATED_EVENT=HISTORICAL_UPDATED_EVENT;

export async function refreshCommonHistoricalDatasets(){
  const results=await Promise.allSettled([
    fetchDatasetPage("rop02",COMMON_HISTORICAL_QUERY),
    fetchDatasetPage("rop05",COMMON_HISTORICAL_QUERY),
    fetchDatasetPage("rma15",COMMON_HISTORICAL_QUERY),
  ]);
  return results;
}

async function fetchSpecialAction_(action,params={}){
  const key=`special:${buildDatasetQueryKey(action,params)}`;
  const record=await readCachedSource(key).catch(()=>null);
  if(record?.data?.ok){
    const sync=await fetchSyncVersions(APPS_SCRIPT_URL).catch(()=>null);
    const local=record.data.versions||{},remote=sync?.versions||{};
    if(sync&&!versionsDiffer_(local,remote))return{...record.data,cacheHit:true,cacheLevel:"indexeddb"};
  }
  const started=performance.now(),response=await fetch(`${APPS_SCRIPT_URL}?${new URLSearchParams({action,...params,_t:String(Date.now())})}`,{cache:"no-store",redirect:"follow"});
  if(!response.ok)throw new Error(`HTTP ${response.status} desde Apps Script`);
  const text=await response.text();let json;try{json=JSON.parse(text);}catch(_){throw new Error("Apps Script no devolvió JSON válido");}
  if(!json?.ok)throw new Error(json?.error?.message||`Falló ${action}`);
  const value={...json,elapsedMs:Math.round(performance.now()-started),payloadBytes:new Blob([text]).size};await writeCachedSource(key,value);return value;
}

export async function getRop02LatestByEquipmentProject(params={}){
  if(usesExternalHomeFilter_())throw new Error("Snapshot de bienvenida desactivado: usar ROP02 ya cargado");
  const response=await fetchSpecialAction_("get_rop02_latest_by_equipment_project",params);
  return filterEquipmentOnlySnapshot_(filterHomeProjectResponse_(response));
}
export const getRop02MonthlySummary=params=>fetchSpecialAction_("get_rop02_monthly_summary",params);
export const getRma15EquipmentUniverse=params=>fetchSpecialAction_("get_rma15_equipment_universe",params);
export async function getRma15OpenOtSummary(params={}){
  if(usesExternalHomeFilter_())return{ok:true,data:null,externalFilter:true};
  const response=await fetchSpecialAction_("get_rma15_open_ot_summary",params);
  const project=currentHomeProject_();
  const filtered=filterHomeProjectResponse_(response);
  if(project!=="TODOS")return filtered;
  if(!Array.isArray(response?.data)||response.data.length===0){
    throw new Error("Resumen de OT abiertas vacío; recalcular desde RMA15 completo");
  }
  return response;
}
export async function getEquipmentHistory({equipo,desde="",hasta=""}){
  if(!String(equipo||"").trim())return{rop02:[],rop05:[],rma15:[]};
  const params={equipo,desde,hasta,limit:"all",offset:0};
  const [rop02,rop05,rma15]=await Promise.all([getRop02(params),getRop05(params),getRma15(params)]);
  return{rop02:rop02.data||[],rop05:rop05.data||[],rma15:rma15.data||[],meta:{rop02,rop05,rma15}};
}
export function clearHistoricalQueryMemory(){memory.clear();pending.clear();lastRevalidatedAt.clear();}

export function createHistoricalPagedController(){return createPagedController(fetchDatasetPage);}

export async function fetchAllDatasetPages(dataset,params={},onPage){
  let offset=0,total=0,hasMore=true;
  while(hasMore){
    const page=await fetchDatasetPage(dataset,{...params,limit:2000,offset});
    const rows=page.data||[];total=Number(page.total||total);hasMore=Boolean(page.hasMore);offset=Number(page.nextOffset||offset+rows.length);
    await onPage(rows,{offset,total,hasMore});
    if(!rows.length)break;
  }
  return{total};
}
