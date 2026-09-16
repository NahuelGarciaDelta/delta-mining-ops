import {getAuthenticatedUser} from "./authSession.js";

const env=(typeof import.meta!=="undefined"&&import.meta.env)?import.meta.env:{};
const SUPABASE_URL=String(env.VITE_SUPABASE_URL||"https://jwfocqaxlckuxoklwyxs.supabase.co").replace(/\/+$/,"");
const SUPABASE_KEY=String(env.VITE_SUPABASE_ANON_KEY||"sb_publishable_XZAcQcWEDdgtZY_NWADy1g_HxoV0UZ2").trim();
const RPC_NAME="app_mirror_sheet_mutation_v1";
const QUEUE_KEY="dm_sheet_supabase_mirror_queue_v1";
const MAX_PERSISTED_BYTES=180000;
const MIRROR_TIMEOUT_MS=8000;
const RETRY_INTERVAL_MS=30000;

const MIRRORED_ACTIONS=new Set([
  "stock_excel_upload","stock_excel_replace","stock_excel_clear","upload_stock",
  "add_lista_equipo","update_lista_equipo","bulk_update_lista_equipos_from_app","update_rop02_row",
  "add_raba03_rows_append_only","add_raba03_rows","upsert_raba03_rows","upsert_raba03_rows_safe_v2",
  "save_raba03_cant_enviada","save_raba03_codigos","delete_raba03_solicitud_numero",
  "save_remito_cargado","delete_remito_cargado",
  "save_estado_solicitud","save_estados_solicitudes_bulk","delete_estado_solicitud","delete_estados_solicitudes_bulk",
  "guardar_licitacion","save_licitacion","eliminar_licitacion","delete_licitacion",
  "save_pm_config","registrar_pm_realizado","save_pm_programacion","save_pm_repuesto",
  "save_equipment_movement","cancel_equipment_movement",
  "save_taller_movement","update_taller_movement","delete_taller_movement",
  "save_articulos_desgaste","save_user_preferences","upload_user_background","update_user_profile"
]);

const NEVER_PERSIST_ACTIONS=new Set(["update_user_profile","upload_user_background","stock_excel_upload","stock_excel_replace","upload_stock"]);
let originalFetch=null;
let retryTimer=0;
let draining=false;

const normalizeAction=value=>String(value||"").trim().toLowerCase();
const isAppsScriptTarget=url=>{
  const value=String(url||"");
  return value.includes("/api/apps-script")||value.includes("script.google.com/macros/s/");
};
const authToken=()=>String(getAuthenticatedUser()?.authToken||getAuthenticatedUser()?.token||sessionStorage.getItem("dm_auth_token")||"").trim();
const newMutationId=()=>{
  try{return `sheet-${crypto.randomUUID()}`;}catch(_){return `sheet-${Date.now()}-${Math.random().toString(36).slice(2)}`;}
};

function readQueue(){
  try{const parsed=JSON.parse(localStorage.getItem(QUEUE_KEY)||"[]");return Array.isArray(parsed)?parsed:[];}catch(_){return[];}
}
function writeQueue(queue){
  try{localStorage.setItem(QUEUE_KEY,JSON.stringify(queue.slice(-100)));}catch(_){}
}
function queueMirror(item){
  if(NEVER_PERSIST_ACTIONS.has(item.action))return false;
  let encoded="";try{encoded=JSON.stringify(item);}catch(_){return false;}
  if(encoded.length>MAX_PERSISTED_BYTES)return false;
  const queue=readQueue();
  if(!queue.some(x=>x.mutationId===item.mutationId))queue.push(item);
  writeQueue(queue);
  return true;
}

async function parsePayload(body){
  if(!body)return null;
  try{
    if(body instanceof URLSearchParams){const raw=body.get("payload");return raw?JSON.parse(raw):null;}
    if(typeof FormData!=="undefined"&&body instanceof FormData){const raw=body.get("payload");return typeof raw==="string"?JSON.parse(raw):null;}
    if(typeof body==="string"){
      if(body.trim().startsWith("{"))return JSON.parse(body);
      const params=new URLSearchParams(body);const raw=params.get("payload");return raw?JSON.parse(raw):null;
    }
  }catch(_){return null;}
  return null;
}

async function requestPayload(input,init){
  const direct=await parsePayload(init?.body);if(direct)return direct;
  if(typeof Request!=="undefined"&&input instanceof Request){
    try{const clone=input.clone();return parsePayload(await clone.text());}catch(_){return null;}
  }
  return null;
}

async function rpcMirror(item){
  const token=authToken();
  if(!token)throw new Error("No hay sesión autenticada para confirmar el mirror en Supabase.");
  const controller=typeof AbortController!=="undefined"?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),MIRROR_TIMEOUT_MS):0;
  try{
    const response=await originalFetch(`${SUPABASE_URL}/rest/v1/rpc/${RPC_NAME}`,{
      method:"POST",cache:"no-store",signal:controller?.signal,
      headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,"Content-Type":"application/json",Accept:"application/json"},
      body:JSON.stringify({
        p_action:item.action,p_payload:item.payload,p_sheet_response:item.sheetResponse,
        p_mutation_id:item.mutationId,p_auth_token:token
      })
    });
    const raw=await response.text();
    let data={};try{data=raw?JSON.parse(raw):{};}catch(_){data={};}
    if(!response.ok)throw new Error(data?.message||data?.error?.message||`Supabase mirror HTTP ${response.status}`);
    if(data?.ok===false)throw new Error(data?.error?.message||data?.message||"Supabase rechazó el mirror.");
    return data;
  }catch(error){
    if(error?.name==="AbortError")throw new Error("Timeout al confirmar la escritura en Supabase.");
    throw error;
  }finally{if(timer)clearTimeout(timer);}
}

async function drainQueue(){
  if(draining||typeof window==="undefined"||navigator.onLine===false||!authToken())return;
  const queue=readQueue();if(!queue.length)return;
  draining=true;
  const pending=[];
  try{
    for(const item of queue){
      try{await rpcMirror(item);}catch(error){pending.push({...item,attempts:Number(item.attempts||0)+1,lastError:String(error?.message||error),lastAttemptAt:new Date().toISOString()});}
    }
    writeQueue(pending);
  }finally{draining=false;}
}

async function mirrorConfirmedMutation(payload,sheetResponse){
  const action=normalizeAction(payload?.action);
  if(!MIRRORED_ACTIONS.has(action))return;
  const item={
    action,payload,
    sheetResponse:sheetResponse&&typeof sheetResponse==="object"?sheetResponse:{ok:true},
    mutationId:String(payload?.mutationId||payload?.mutation_id||newMutationId()),
    createdAt:new Date().toISOString(),attempts:0
  };
  try{
    await rpcMirror(item);
    window.dispatchEvent(new CustomEvent("dm-sheet-supabase-synced",{detail:{action,mutationId:item.mutationId}}));
  }catch(error){
    const queued=queueMirror({...item,lastError:String(error?.message||error)});
    window.dispatchEvent(new CustomEvent("dm-sheet-supabase-pending",{detail:{action,mutationId:item.mutationId,queued,error:String(error?.message||error)}}));
  }
}

export function installSheetMutationSupabaseMirror(){
  if(typeof window==="undefined"||typeof fetch!=="function")return()=>{};
  if(window.__dmSheetSupabaseMirrorInstalled)return()=>{};
  window.__dmSheetSupabaseMirrorInstalled=true;
  originalFetch=window.fetch.bind(window);

  window.fetch=async function dmBidirectionalFetch(input,init={}){
    const method=String(init?.method||(typeof Request!=="undefined"&&input instanceof Request?input.method:"GET")||"GET").toUpperCase();
    const url=typeof input==="string"?input:(input?.url||"");
    if(method!=="POST"||!isAppsScriptTarget(url))return originalFetch(input,init);

    const payload=await requestPayload(input,init);
    const action=normalizeAction(payload?.action);
    if(!MIRRORED_ACTIONS.has(action))return originalFetch(input,init);

    const response=await originalFetch(input,init);
    if(!response.ok)return response;
    let sheetResponse=null;
    try{sheetResponse=await response.clone().json();}catch(_){return response;}
    if(sheetResponse?.ok!==true)return response;
    await mirrorConfirmedMutation(payload,sheetResponse);
    return response;
  };

  const onOnline=()=>drainQueue();
  window.addEventListener("online",onOnline);
  retryTimer=window.setInterval(drainQueue,RETRY_INTERVAL_MS);
  window.setTimeout(drainQueue,1500);
  return()=>{
    if(originalFetch)window.fetch=originalFetch;
    window.removeEventListener("online",onOnline);
    if(retryTimer)window.clearInterval(retryTimer);
    retryTimer=0;window.__dmSheetSupabaseMirrorInstalled=false;
  };
}

export const SHEET_MIRROR_ACTIONS=Object.freeze([...MIRRORED_ACTIONS]);
