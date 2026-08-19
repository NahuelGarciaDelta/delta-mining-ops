import {APPS_SCRIPT_URL} from "../config/app.js";
import {fetchAction} from "./appsScriptApi.js";
import {postToAppsScript} from "./writeActions.js";

const CACHE_PREFIX="dm_taller_movements_v5_";
const normalizeType=value=>String(value||"").trim().toUpperCase().replace(/\s+/g,"_");
const normalizeRows=res=>Array.isArray(res?.data)?res.data:[];
const text=value=>String(value||"").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const cacheKey=type=>`${CACHE_PREFIX}${normalizeType(type)}`;

function classifyMovement(row){
  const explicit=normalizeType(row?.TIPO||row?.tipo||row?.TIPO_MOVIMIENTO||row?.tipoMovimiento);
  const motivo=text(row?.MOTIVO||row?.motivo);
  const observacion=text(row?.OBSERVACION||row?.observacion);
  const combined=`${motivo} ${observacion}`;
  const incoming=String(row?.INTERNO_ENTRA||row?.internoEntra||row?.EQUIPO_ENTRA||row?.equipoEntra||"").trim();
  const destino=text(row?.PROYECTO_DESTINO||row?.proyectoDestino);

  // Señales semánticas fuertes: tienen prioridad sobre etiquetas viejas mal guardadas.
  if(incoming||combined.includes("CAMBIO_EQUIPO")||combined.includes("TALLER_CAMBIO_EQUIPO")||combined.includes("SE CAMBIA EQUIPO")||combined.includes("CAMBIA EQUIPO POR"))return "CAMBIO_EQUIPO";
  if(combined.includes("SE BAJA")||combined.includes("TALLER_BAJA")||explicit==="BAJA")return "BAJA";
  if(combined.includes("SE MOVILIZA")||combined.includes("MOVILIZACION")||combined.includes("TALLER_MOVILIZACION"))return "MOVILIZACION";
  if(combined.includes("SUBIDA DE EQUIPO")||combined.includes("TALLER_SUBIDA")||explicit==="SUBIDA")return "SUBIDA";

  // Solo después de las señales semánticas se acepta el tipo explícito.
  if(["SUBIDA","BAJA","MOVILIZACION","CAMBIO_EQUIPO"].includes(explicit))return explicit;

  // Compatibilidad mínima para registros antiguos sin tipo.
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

export async function getAllTallerMovements(){
  const res=await fetchAction(APPS_SCRIPT_URL,"get_taller_movements",{force:true,compact:false});
  const rows=normalizeRows(res).map(normalizeMovement).filter(row=>row.TIPO);
  ["SUBIDA","BAJA","MOVILIZACION","CAMBIO_EQUIPO"].forEach(type=>saveCache(type,rows.filter(row=>row.TIPO===type)));
  return rows;
}

export async function getTallerMovements(type){
  const expected=normalizeType(type);
  if(!["SUBIDA","BAJA","MOVILIZACION","CAMBIO_EQUIPO"].includes(expected))throw new Error(`Tipo de movimiento no soportado: ${type}`);

  // La Web App productiva ya expone este endpoint. No se llaman endpoints
  // nuevos que puedan devolver "Acción inválida".
  const rows=await getAllTallerMovements();
  return rows.filter(row=>row.TIPO===expected);
}

export const saveTallerMovement=movement=>postToAppsScript({action:"save_taller_movement",movement});
export const updateTallerMovement=(id,movement)=>postToAppsScript({action:"update_taller_movement",id,movement});
export const deleteTallerMovement=(id,usuario)=>postToAppsScript({action:"delete_taller_movement",id,usuario});
