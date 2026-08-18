import {APPS_SCRIPT_URL} from "../config/app.js";
import {fetchAction} from "./appsScriptApi.js";
import {postToAppsScript} from "./writeActions.js";

const normalizeRows=res=>Array.isArray(res?.data)?res.data:[];

export async function getTallerMovements(){
  const actions=[
    ["get_taller_subidas","SUBIDA"],
    ["get_taller_bajadas","BAJA"],
    ["get_taller_cambios_equipo","CAMBIO_EQUIPO"],
    ["get_taller_movilizaciones","MOVILIZACION"],
  ];
  const results=await Promise.allSettled(actions.map(([action])=>fetchAction(APPS_SCRIPT_URL,action,{force:true,compact:false})));
  const rows=[];
  results.forEach((result,index)=>{
    if(result.status!=="fulfilled")return;
    const fallbackType=actions[index][1];
    normalizeRows(result.value).forEach(row=>rows.push({...row,TIPO:row?.TIPO||row?.tipo||fallbackType}));
  });
  if(rows.length)return rows;
  const legacy=await fetchAction(APPS_SCRIPT_URL,"get_taller_movements",{force:true,compact:false});
  return normalizeRows(legacy);
}
export const saveTallerMovement=movement=>postToAppsScript({action:"save_taller_movement",movement});
export const updateTallerMovement=(id,movement)=>postToAppsScript({action:"update_taller_movement",id,movement});
export const deleteTallerMovement=(id,usuario)=>postToAppsScript({action:"delete_taller_movement",id,usuario});
