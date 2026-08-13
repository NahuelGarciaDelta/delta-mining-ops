import {useCallback,useEffect,useMemo,useState} from "react";
import {APPS_SCRIPT_URL} from "../config/app.js";
import {fetchAction} from "./appsScriptApi.js";
import {postToAppsScript} from "./writeActions.js";
import {registerRefreshTask} from "./refreshManager.js";
import {equipmentProjectKey,normalizeRop02Project} from "../modules/home/homeAvailability.js";
import {getMovimientoVigentePorEquipo,movementsToAtrasoMap,normalizeEquipmentMovementCode} from "./equipmentMovementsDomain.js";

export {getMovimientoVigentePorEquipo,movementsToAtrasoMap} from "./equipmentMovementsDomain.js";

let cache={data:[],loaded:false,loading:null,error:""};
const listeners=new Set();
const emit=()=>listeners.forEach(listener=>listener(cache));
export async function loadEquipmentMovements({force=false}={}){
  if(cache.loading)return cache.loading;
  if(cache.loaded&&!force)return cache;
  cache.loading=fetchAction(APPS_SCRIPT_URL,"get_equipment_movements",{force,compact:false}).then(response=>{
    cache={data:Array.isArray(response.data)?response.data:[],loaded:true,loading:null,error:""};emit();return cache;
  }).catch(error=>{cache={...cache,loaded:true,loading:null,error:error?.message||"No fue posible cargar movimientos de equipos."};emit();throw error;});
  return cache.loading;
}

export async function saveEquipmentMovement(movement){
  const response=await postToAppsScript({action:"save_equipment_movement",movement});
  await loadEquipmentMovements({force:true});
  return response;
}

export async function cancelEquipmentMovement(id,usuario){
  const response=await postToAppsScript({action:"cancel_equipment_movement",id,usuario});
  await loadEquipmentMovements({force:true});
  return response;
}

export function useEquipmentMovements(rop02Rows=[],views=[]){
  const[snapshot,setSnapshot]=useState(cache);
  useEffect(()=>{listeners.add(setSnapshot);loadEquipmentMovements().catch(()=>{});return()=>listeners.delete(setSnapshot)},[]);
  useEffect(()=>registerRefreshTask("equipment-movements",()=>loadEquipmentMovements({force:true}),{views,priority:15}),[JSON.stringify(views)]);
  const latestRop02ByEquipmentProject=useMemo(()=>{
    const latest=new Map();
    for(const row of Array.isArray(rop02Rows)?rop02Rows:[]){
      const code=normalizeEquipmentMovementCode(row?.maquina||row?._internoRaw);
      const project=normalizeRop02Project(row?.proyecto||row?.lugar);
      const date=String(row?.fecha||"").slice(0,10);
      const key=equipmentProjectKey(code,project);
      if(code&&project&&date&&(!latest.has(key)||date>latest.get(key)))latest.set(key,date);
    }
    return latest;
  },[rop02Rows]);
  const activeMovementByEquipment=useMemo(()=>getMovimientoVigentePorEquipo(snapshot.data,latestRop02ByEquipmentProject),[snapshot.data,latestRop02ByEquipmentProject]);
  const admitidos=useMemo(()=>movementsToAtrasoMap(activeMovementByEquipment),[activeMovementByEquipment]);
  return{...snapshot,loading:Boolean(snapshot.loading)||!snapshot.loaded,movements:snapshot.data,activeMovementByEquipment,admitidos,reload:useCallback(()=>loadEquipmentMovements({force:true}),[])};
}
