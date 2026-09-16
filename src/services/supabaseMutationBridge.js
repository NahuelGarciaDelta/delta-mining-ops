import { getAuthenticatedUser } from "./authSession.js";

const env=(typeof import.meta!=="undefined"&&import.meta.env)?import.meta.env:{};
const SUPABASE_URL=String(env.VITE_SUPABASE_URL||"https://jwfocqaxlckuxoklwyxs.supabase.co").replace(/\/+$/,"");
const SUPABASE_KEY=String(env.VITE_SUPABASE_ANON_KEY||"sb_publishable_XZAcQcWEDdgtZY_NWADy1g_HxoV0UZ2").trim();
const RPC_URL=`${SUPABASE_URL}/rest/v1/rpc/app_write_action_v3`;
const BRIDGE_HEADER="x-dm-write-backend";

const PASSTHROUGH_ACTIONS=new Set(["authenticate_user"]);
const SUPABASE_WRITE_ACTIONS=new Set([
  "add_lista_equipo","update_lista_equipo","bulk_update_lista_equipos_from_app","update_rop02_row",
  "save_equipment_movement","cancel_equipment_movement",
  "save_taller_movement","update_taller_movement","delete_taller_movement",
  "add_raba03_rows_append_only","add_raba03_rows","upsert_raba03_rows","upsert_raba03_rows_safe_v2",
  "save_raba03_cant_enviada","save_raba03_codigos","delete_raba03_solicitud_numero",
  "save_remito_cargado","delete_remito_cargado",
  "save_estado_solicitud","save_estados_solicitudes_bulk","delete_estado_solicitud","delete_estados_solicitudes_bulk",
  "stock_excel_upload","stock_excel_replace","stock_excel_clear","upload_stock",
  "guardar_licitacion","save_licitacion","eliminar_licitacion","delete_licitacion",
  "save_pm_config","registrar_pm_realizado","save_pm_programacion","save_pm_repuesto",
  "save_articulos_desgaste","save_user_preferences","upload_user_background","update_user_profile"
]);

function jsonResponse(body,status=200){
  return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8",[BRIDGE_HEADER]:"supabase-first"}});
}
function actionName(value){return String(value||"").trim().toLowerCase();}
function isAppsScriptWriteUrl(input){
  try{
    const raw=typeof input==="string"?input:input?.url||"";
    const url=new URL(raw,window.location.href);
    if(url.pathname==="/api/apps-script")return true;
    return /script\.google\.com$/i.test(url.hostname)&&/\/macros\/s\//.test(url.pathname);
  }catch{return false;}
}
function bodyText(body){
  if(typeof body==="string")return body;
  if(body instanceof URLSearchParams)return body.toString();
  return "";
}
function parsePayload(init={}){
  const body=init?.body;
  if(body&&typeof body==="object"&&!(body instanceof URLSearchParams)&&!(body instanceof FormData)&&!(body instanceof Blob)&&!(body instanceof ArrayBuffer)){
    if(body.action)return body;
  }
  const text=bodyText(body);
  if(!text)return null;
  try{
    const direct=JSON.parse(text);
    if(direct&&typeof direct==="object")return direct;
  }catch(_){ }
  try{
    const params=new URLSearchParams(text);
    const encoded=params.get("payload");
    if(!encoded)return null;
    const parsed=JSON.parse(encoded);
    return parsed&&typeof parsed==="object"?parsed:null;
  }catch{return null;}
}
function sessionToken(){
  const user=getAuthenticatedUser();
  return String(user?.authToken||user?.token||sessionStorage.getItem("dm_auth_token")||"").trim();
}
async function callSupabaseWrite(nativeFetch,action,payload){
  const token=sessionToken();
  if(!token)return jsonResponse({ok:false,error:{code:"AUTH_TOKEN_MISSING",message:"Tu sesión no tiene un token válido. Cerrá sesión e iniciá nuevamente."}},401);
  let response;
  try{
    response=await nativeFetch(RPC_URL,{
      method:"POST",cache:"no-store",
      headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,Accept:"application/json","Content-Type":"application/json"},
      body:JSON.stringify({p_action:action,p_payload:payload,p_auth_token:token})
    });
  }catch(error){
    return jsonResponse({ok:false,error:{code:"SUPABASE_WRITE_NETWORK",message:error?.message||"No se pudo confirmar el cambio en Supabase."}},503);
  }
  const text=await response.text();
  let data=null;
  try{data=text?JSON.parse(text):null;}catch(_){ }
  if(!response.ok){
    const message=data?.message||data?.error?.message||data?.hint||`Supabase HTTP ${response.status}`;
    return jsonResponse({ok:false,error:{code:"SUPABASE_WRITE_FAILED",message},details:data||text.slice(0,400)},response.status||500);
  }
  if(!data||typeof data!=="object")return jsonResponse({ok:false,error:{code:"SUPABASE_WRITE_RESPONSE_INVALID",message:"Supabase devolvió una respuesta inválida."}},502);
  if(data.ok===false)return jsonResponse(data,409);
  return jsonResponse({...data,ok:true,supabaseCommitted:true,sheetSync:"queued"},200);
}

export function installSupabaseMutationBridge(){
  if(typeof window==="undefined"||window.__dmSupabaseMutationBridgeInstalled)return;
  const nativeFetch=window.fetch.bind(window);
  window.__dmNativeFetch=nativeFetch;
  window.fetch=async function dmSupabaseFirstFetch(input,init={}){
    const method=String(init?.method||((typeof Request!=="undefined"&&input instanceof Request)?input.method:"GET")||"GET").toUpperCase();
    if(method!=="POST"||!isAppsScriptWriteUrl(input))return nativeFetch(input,init);
    const payload=parsePayload(init);
    const action=actionName(payload?.action);
    if(!action)return jsonResponse({ok:false,error:{code:"WRITE_ACTION_MISSING",message:"La escritura no indicó una acción."}},400);
    if(PASSTHROUGH_ACTIONS.has(action))return nativeFetch(input,init);
    if(!SUPABASE_WRITE_ACTIONS.has(action)){
      return jsonResponse({ok:false,error:{code:"UNMAPPED_WRITE_ACTION",message:`La acción ${action} no está habilitada para escritura Supabase-first.`}},409);
    }
    return callSupabaseWrite(nativeFetch,action,payload);
  };
  window.__dmSupabaseMutationBridgeInstalled=true;
}

export const DM_SUPABASE_WRITE_ACTIONS=Object.freeze([...SUPABASE_WRITE_ACTIONS]);
