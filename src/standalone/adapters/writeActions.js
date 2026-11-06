// V9-only replacement for the legacy Apps Script write client.
// Every mutation uses the authenticated V9 relay. Never call the V8 endpoint.
import {requestAppsScript,newOperationId} from "./confirmedWrites.js";

const EDIT_AREA={
 add_lista_equipo:"TALLER CENTRAL",
 update_lista_equipo:"TALLER CENTRAL",
 bulk_update_lista_equipos_from_app:"TALLER CENTRAL",
 update_rop02_row:"OFICINA TECNICA"
};
const MUTATION_ID_ACTIONS=new Set([
 "save_taller_movement","update_taller_movement","delete_taller_movement",
 "bulk_update_lista_equipos_from_app"
]);
export async function postToAppsScript(payloadObj){
 const payload=payloadObj&&typeof payloadObj==="object"?{...payloadObj}:{};
 const action=String(payload.action||"");
 if(!action)throw Error("V9_WRITE_ACTION_REQUIRED");
 if(MUTATION_ID_ACTIONS.has(action)&&!payload.operationId)
  payload.operationId=newOperationId();
 // Do not retry uncertain writes (including after a network timeout).
 const result=await requestAppsScript("/api/v9-write",payload,{timeoutMs:29000});
 if(result?.ok!==true)throw Error(result?.error?.message||result?.error||"V9_WRITE_UNCONFIRMED");
 return result;
}
export const postAddListaEquipo=row=>postToAppsScript({action:"add_lista_equipo",row});
export const postUpdateListaEquipo=(originalKeys,row)=>postToAppsScript({action:"update_lista_equipo",originalKeys,row});
export const postBulkUpdateListaEquipos=updates=>postToAppsScript({action:"bulk_update_lista_equipos_from_app",updates,operationId:newOperationId()});
export const postUpdateROP02Row=(target,rowKey,fields)=>postToAppsScript({action:"update_rop02_row",target,rowKey,fields});
