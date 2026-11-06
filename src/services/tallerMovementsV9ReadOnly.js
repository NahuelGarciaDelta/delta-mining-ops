// Independent V9 read adapter: original-Sheets relay, never legacy production writes.
import {fetchSupabaseSource} from "../standalone/adapters/supabaseReadApi.js";

let inflight=null;
let cached=null;
let fetchedAt=0;
const TTL_MS=120000;

function classify(row){
 const raw=String(row?.TIPO??row?.tipo??"").trim().toUpperCase().replace(/\s+/g,"_");
 if(["SUBIDA","BAJA","MOVILIZACION","CAMBIO_EQUIPO"].includes(raw))return raw;
 const motivo=String(row?.MOTIVO??row?.motivo??"").toUpperCase();
 if(motivo.includes("CAMBIA EQUIPO")||motivo.includes("CAMBIO_EQUIPO"))return "CAMBIO_EQUIPO";
 if(motivo.includes("SE BAJA"))return "BAJA";
 if(motivo.includes("SE MOVILIZA"))return "MOVILIZACION";
 if(motivo.includes("SUBIDA"))return "SUBIDA";
 return raw;
}
export async function getTallerMovements(){
 if(cached&&Date.now()-fetchedAt<TTL_MS)return cached;
 if(inflight)return inflight;
 inflight=fetchSupabaseSource("movimientos_taller").then(result=>{
  if(!Array.isArray(result?.data))throw new Error("V9_TALLER_INVALID_ROWS");
  cached=result.data.map(row=>({...row,TIPO:classify(row)}));
  fetchedAt=Date.now();
  return cached;
 }).finally(()=>{inflight=null});
 return inflight;
}
const protectedWrite=async()=>{throw new Error("V9_WRITE_NOT_VERIFIED: primero validar las operaciones en sandbox.");};
export const saveTallerMovement=protectedWrite;
export const updateTallerMovement=protectedWrite;
export const deleteTallerMovement=protectedWrite;
