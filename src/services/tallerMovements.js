import {APPS_SCRIPT_URL} from "../config/app.js";
import {fetchAction} from "./appsScriptApi.js";
import {postToAppsScript} from "./writeActions.js";

const DIRECT_APPS_SCRIPT_URL="https://script.google.com/macros/s/AKfycbxU-ihsxXTNn2wa5EO1OkSM5FjJ43MwxSx8dY0RjbnJRFBKF0BiNNq7QsuohWxmmeOhog/exec";
const CACHE_PREFIX="dm_taller_movements_v6_";
const normalizeType=value=>String(value||"").trim().toUpperCase().replace(/\s+/g,"_");
const normalizeRows=res=>Array.isArray(res?.data)?res.data:[];
const text=value=>String(value||"").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const cacheKey=type=>`${CACHE_PREFIX}${normalizeType(type)}`;
const VALID_TYPES=["SUBIDA","BAJA","MOVILIZACION","CAMBIO_EQUIPO"];

function classifyMovement(row){
  const explicit=normalizeType(row?.TIPO||row?.tipo||row?.TIPO_MOVIMIENTO||row?.tipoMovimiento);
  const motivo=text(row?.MOTIVO||row?.motivo);
  const observacion=text(row?.OBSERVACION||row?.observacion);
  const combined=`${motivo} ${observacion}`;
  const incoming=String(row?.INTERNO_ENTRA||row?.internoEntra||row?.EQUIPO_ENTRA||row?.equipoEntra||"").trim();
  const destino=text(row?.PROYECTO_DESTINO||row?.proyectoDestino);

  if(incoming||combined.includes("CAMBIO_EQUIPO")||combined.includes("TALLER_CAMBIO_EQUIPO")||combined.includes("SE CAMBIA EQUIPO")||combined.includes("CAMBIA EQUIPO POR"))return "CAMBIO_EQUIPO";
  if(combined.includes("SE BAJA")||combined.includes("TALLER_BAJA")||explicit==="BAJA")return "BAJA";
  if(combined.includes("SE MOVILIZA")||combined.includes("MOVILIZACION")||combined.includes("TALLER_MOVILIZACION"))return "MOVILIZACION";
  if(combined.includes("SUBIDA DE EQUIPO")||combined.includes("TALLER_SUBIDA")||explicit==="SUBIDA")return "SUBIDA";
  if(VALID_TYPES.includes(explicit))return explicit;
  if(destino==="SAN JUAN")return "BAJA";
  return "";
}

function normalizeMovement(row){
  const type=classifyMovement(row);
  return {...row,TIPO:type};
}

export function getCachedTallerMovements(type){
  const expected=normalizeType(type);
  if(!expected)return[];
  try{
    const parsed=JSON.parse(localStorage.getItem(cacheKey(expected))||"[]");
    if(!Array.isArray(parsed))return[];
    return parsed.map(normalizeMovement).filter(row=>row.TIPO===expected);
  }catch(_){return[];}
}

function saveCache(type,rows){
  try{localStorage.setItem(cacheKey(type),JSON.stringify(rows));}catch(_){}
}

async function fetchSupabaseTallerMovements(){
  const target=encodeURIComponent("/rest/v1/rpc/app_taller_movements_read");
  const controller=typeof AbortController!=="undefined"?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),15000):null;
  try{
    const response=await fetch(`/api/supabase-read?target=${target}`,{
      method:"POST",
      cache:"no-store",
      signal:controller?.signal,
      headers:{Accept:"application/json","Content-Type":"application/json"},
      body:"{}",
    });
    const raw=await response.text();
    if(!response.ok)throw new Error(`Supabase HTTP ${response.status}: ${raw.slice(0,220)}`);
    let payload;
    try{payload=JSON.parse(raw);}catch(_){throw new Error("Supabase devolvió una respuesta no válida");}
    if(!payload?.ok||!Array.isArray(payload?.data))throw new Error("Supabase no devolvió el historial de Taller");
    return payload;
  }catch(error){
    if(error?.name==="AbortError")throw new Error("Supabase no respondió dentro de 15 segundos");
    throw error;
  }finally{if(timer)clearTimeout(timer);}
}

async function fetchFreshTallerMovements(){
  try{
    return await fetchSupabaseTallerMovements();
  }catch(supabaseError){
    try{
      return await fetchAction(APPS_SCRIPT_URL,"get_taller_movements",{force:true,compact:false,retries:1,timeoutMs:30000});
    }catch(proxyError){
      try{
        return await fetchAction(DIRECT_APPS_SCRIPT_URL,"get_taller_movements",{force:true,compact:false,retries:1,timeoutMs:30000});
      }catch(directError){
        const supabaseMessage=String(supabaseError?.message||supabaseError||"Error desconocido");
        const proxyMessage=String(proxyError?.message||proxyError||"Error desconocido");
        const directMessage=String(directError?.message||directError||"Error desconocido");
        throw new Error(`No se pudo actualizar Movimientos de equipos. Supabase: ${supabaseMessage}. Proxy Apps Script: ${proxyMessage}. Apps Script directo: ${directMessage}.`);
      }
    }
  }
}

export async function getAllTallerMovements(){
  const res=await fetchFreshTallerMovements();
  const rows=normalizeRows(res).map(normalizeMovement).filter(row=>row.TIPO);
  VALID_TYPES.forEach(type=>saveCache(type,rows.filter(row=>row.TIPO===type)));
  return rows;
}

export async function getTallerMovements(type){
  const expected=normalizeType(type);
  const rows=await getAllTallerMovements();
  if(!expected)return rows;
  if(!VALID_TYPES.includes(expected))throw new Error(`Tipo de movimiento no soportado: ${type}`);
  return rows.filter(row=>row.TIPO===expected);
}

export const saveTallerMovement=movement=>postToAppsScript({action:"save_taller_movement",movement});
export const updateTallerMovement=(id,movement)=>postToAppsScript({action:"update_taller_movement",id,movement});
export const deleteTallerMovement=(id,usuario)=>postToAppsScript({action:"delete_taller_movement",id,usuario});
