// Independent V9 read adapter: original-Sheets relay, never legacy production writes.
import {fetchSupabaseSource} from "../standalone/adapters/supabaseReadApi.js";
import {requestAppsScript,newOperationId} from "../standalone/adapters/confirmedWrites.js";

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
export async function getTallerMovements({force=false}={}){
 if(force){cached=null;fetchedAt=0;}
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

export async function getTallerWriteStatus(){
  return requestAppsScript("/api/v9-write",{action:"v9_taller_write_status"},{timeoutMs:15000});
}
async function perform(action,details){
 const operationId=newOperationId();
 // One POST only. A timeout or lost acknowledgement is uncertain and MUST NOT be retried.
 const result=await requestAppsScript("/api/v9-write",{action,operationId,...details},{timeoutMs:29000});
 if(result?.ok!==true)throw new Error(result?.error?.message||result?.error||"V9_WRITE_UNCONFIRMED");
 const id=String(result.movement?.ID||result.movement?.id||details.id||"").trim();
 if(!id)return {ok:true,status:"confirmation_pending",operationId};
 try{
  const list=await getTallerMovements({force:true});
  const matches=list.filter(row=>String(row.ID??row.id??"")===id);
  if(action==="delete_taller_movement"){
   const active=matches.filter(row=>!["ELIMINADO","CANCELADO"].includes(String(row.ESTADO??row.estado??"").toUpperCase()));
   return {ok:true,status:active.length===0?"confirmed":"confirmation_pending",operationId,id};
  }
  if(matches.length!==1)return {ok:true,status:"confirmation_pending",operationId,id};
  // For edits, do not treat a merely matching ID as proof the new data was saved.
  if(action==="update_taller_movement"){
   const expected=details.movement||{};
   const row=matches[0];
   const normalize=value=>String(value??"").trim().toUpperCase();
   const storedObservation=row.OBSERVACION??row.observacion;
   const storedInterno=row.INTERNO??row.interno;
   if(normalize(storedObservation)!==normalize(expected.observacion)||
      normalize(storedInterno)!==normalize(expected.interno))
     return {ok:true,status:"confirmation_pending",operationId,id};
  }
  return {ok:true,status:"confirmed",operationId,id};
 }catch{
  return {ok:true,status:"confirmation_pending",operationId,id};
 }
}
export const saveTallerMovement=movement=>perform("save_taller_movement",{movement});
export const updateTallerMovement=(id,movement)=>perform("update_taller_movement",{id,movement});
export const deleteTallerMovement=(id,usuario)=>perform("delete_taller_movement",{id,usuario});
