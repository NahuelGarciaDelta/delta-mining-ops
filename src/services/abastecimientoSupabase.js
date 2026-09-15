import { getAuthenticatedUser } from "./authSession.js";
import { requireSupabase } from "./supabaseClient.js";

let backendUrl="";
let snapshotPromise=null,snapshotCache=null,snapshotAt=0;
const SNAPSHOT_TTL_MS=5000;

export function configureAbastecimientoBackend(url){backendUrl=String(url||"").trim();}
export function invalidateAbastecimientoSnapshot(){snapshotCache=null;snapshotAt=0;}
const actor=()=>{const u=getAuthenticatedUser();return{email:String(u?.email||sessionStorage.getItem("dm_user")||"").trim().toLowerCase(),token:String(u?.authToken||u?.token||sessionStorage.getItem("dm_auth_token")||"")};};
async function postBackend(payload){
  if(!backendUrl)throw new Error("Backend de Abastecimiento no configurado.");
  const a=actor();
  if(!a.email||!a.token)throw new Error("Tu sesión no tiene un token válido. Cerrá sesión e iniciá nuevamente.");
  const res=await fetch(backendUrl,{method:"POST",cache:"no-store",redirect:"follow",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},body:new URLSearchParams({payload:JSON.stringify({...payload,actor:a})}).toString()});
  const text=await res.text();let json;try{json=text?JSON.parse(text):{};}catch(_){throw new Error("El backend devolvió una respuesta no válida.");}
  if(!res.ok||!json?.ok)throw new Error(json?.error?.message||`Error HTTP ${res.status}`);
  invalidateAbastecimientoSnapshot();return json;
}

export async function getAbastecimientoSnapshot({force=false}={}){
  const now=Date.now();
  if(!force&&snapshotCache&&now-snapshotAt<SNAPSHOT_TTL_MS)return snapshotCache;
  if(snapshotPromise&&!force)return snapshotPromise;
  snapshotPromise=(async()=>{
    const {data,error}=await requireSupabase().rpc("abastecimiento_snapshot",{});
    if(error)throw new Error(`Supabase Abastecimiento: ${error.message}`);
    const value={ok:true,raba03:[],remitos:[],estados:[],...(data||{}),raba03Source:"supabase"};
    snapshotCache=value;snapshotAt=Date.now();return value;
  })();
  try{return await snapshotPromise;}finally{snapshotPromise=null;}
}

export async function getStockSnapshotFromSupabase(){
  const {data,error}=await requireSupabase().rpc("app_stock_snapshot",{});
  if(error)throw new Error(`Supabase Stock: ${error.message}`);
  return data||{};
}

export const saveAbastecimientoRemito=remito=>postBackend({action:"save_remito_cargado",remito:{...(remito||{}),usuarioCarga:sessionStorage.getItem("dm_user")||"APP"}});
export const deleteAbastecimientoRemito=id=>postBackend({action:"delete_remito_cargado",idRemito:String(id||"")});
export const setAbastecimientoEstado=payload=>postBackend(payload||{});
export const appendAbastecimientoRaba03=rows=>postBackend({action:"add_raba03_rows_append_only",rows:Array.isArray(rows)?rows:[]});
export function updateAbastecimientoRaba03(action,rows){const normalized=String(action||"").trim().toLowerCase();const backendAction=normalized==="cant_enviada"?"save_raba03_cant_enviada":normalized==="codigos"?"save_raba03_codigos":"";if(!backendAction)throw new Error(`Acción RABA03 no soportada: ${action}`);return postBackend({action:backendAction,rows:Array.isArray(rows)?rows:[]});}
export const deleteAbastecimientoRaba03Solicitud=numeroSolicitud=>postBackend({action:"delete_raba03_solicitud_numero",numeroSolicitud:String(numeroSolicitud||"").trim()});
