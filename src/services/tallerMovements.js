import {APPS_SCRIPT_URL} from "../config/app.js";
import {fetchAction} from "./appsScriptApi.js";
import {postToAppsScript} from "./writeActions.js";

const TYPE_ACTION={
  SUBIDA:"get_taller_subidas",
  BAJA:"get_taller_bajadas",
  CAMBIO_EQUIPO:"get_taller_cambios_equipo",
  MOVILIZACION:"get_taller_movilizaciones",
};
const CACHE_PREFIX="dm_taller_movements_v3_";
const normalizeType=value=>String(value||"").trim().toUpperCase().replace(/\s+/g,"_");
const normalizeRows=res=>Array.isArray(res?.data)?res.data:[];
const rowType=row=>normalizeType(row?.TIPO||row?.tipo||row?.TIPO_MOVIMIENTO||row?.tipoMovimiento);
const cacheKey=type=>`${CACHE_PREFIX}${normalizeType(type)}`;

function isExactType(row,expected){
  return rowType(row)===expected;
}

export function getCachedTallerMovements(type){
  const expected=normalizeType(type);
  if(!expected)return[];
  try{
    const parsed=JSON.parse(localStorage.getItem(cacheKey(expected))||"[]");
    if(!Array.isArray(parsed))return[];
    return parsed.filter(row=>isExactType(row,expected));
  }catch(_){return[];}
}

function saveCache(type,rows){
  try{localStorage.setItem(cacheKey(type),JSON.stringify(rows));}catch(_){}
}

export async function getTallerMovements(type){
  const expected=normalizeType(type);
  const action=TYPE_ACTION[expected];
  if(!action)throw new Error(`Tipo de movimiento no soportado: ${type}`);

  try{
    const res=await fetchAction(APPS_SCRIPT_URL,action,{force:true,compact:false});
    const remote=normalizeRows(res).filter(row=>isExactType(row,expected));
    saveCache(expected,remote);
    return remote;
  }catch(primaryError){
    const cached=getCachedTallerMovements(expected);
    if(cached.length)return cached;

    try{
      const legacy=await fetchAction(APPS_SCRIPT_URL,"get_taller_movements",{force:true,compact:false});
      const rows=normalizeRows(legacy).filter(row=>isExactType(row,expected));
      if(rows.length){saveCache(expected,rows);return rows;}
    }catch(_){}
    throw primaryError;
  }
}

export const saveTallerMovement=movement=>postToAppsScript({action:"save_taller_movement",movement});
export const updateTallerMovement=(id,movement)=>postToAppsScript({action:"update_taller_movement",id,movement});
export const deleteTallerMovement=(id,usuario)=>postToAppsScript({action:"delete_taller_movement",id,usuario});
