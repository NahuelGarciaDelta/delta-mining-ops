import {APPS_SCRIPT_URL} from "../config/app.js";
import {appAlert} from "./dialogService.js";
import {dmCanEditArea} from "../shared/access.js";
const DM_ACTION_REQUIRED_AREA={add_lista_equipo:"TALLER CENTRAL",update_lista_equipo:"TALLER CENTRAL",bulk_update_lista_equipos_from_app:"TALLER CENTRAL",update_rop02_row:"OFICINA TÉCNICA"};
export async function postToAppsScript(payloadObj){
 const requiredArea=DM_ACTION_REQUIRED_AREA[String(payloadObj?.action||"")];
 if(requiredArea&&!dmCanEditArea(requiredArea)){const msg=`Modo solo lectura: únicamente el área ${requiredArea} puede guardar cambios en esta sección.`;await appAlert(msg,"Sin permiso de edición");throw new Error(msg);}
 const res=await fetch(APPS_SCRIPT_URL,{method:"POST",body:new URLSearchParams({payload:JSON.stringify(payloadObj)}),redirect:"follow"});
 if(!res.ok)throw new Error(`HTTP ${res.status} al actualizar planilla`);
 const text=await res.text();let json;try{json=JSON.parse(text);}catch(_){throw new Error("Apps Script no devolvió JSON. Revisá permisos/publicación.");}
 if(!json.ok)throw new Error(json.error?.message||"No se pudo actualizar la planilla.");return json;
}
export const postAddListaEquipo=row=>postToAppsScript({action:"add_lista_equipo",row});
export const postUpdateListaEquipo=(originalKeys,row)=>postToAppsScript({action:"update_lista_equipo",originalKeys,row});
export const postBulkUpdateListaEquipos=updates=>postToAppsScript({action:"bulk_update_lista_equipos_from_app",updates});
export const postUpdateROP02Row=(target,rowKey,fields)=>postToAppsScript({action:"update_rop02_row",target,rowKey,fields});
