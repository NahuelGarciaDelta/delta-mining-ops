import {useCallback,useEffect,useMemo,useState} from "react";
import {APPS_SCRIPT_URL} from "../config/app.js";
import {fetchAction,fetchSyncVersions} from "./appsScriptApi.js";
import {postToAppsScript} from "./writeActions.js";
import {readCachedSource,writeCachedSource} from "./appCache.js";
import {registerRefreshTask} from "./refreshManager.js";
import {equipmentProjectKey,normalizeRop02Project} from "../modules/home/homeAvailability.js";
import {appendEquipmentMovementLinkMetadata,getMovimientoVigentePorEquipo,movementsToAtrasoMap,normalizeEquipmentMovementCode} from "./equipmentMovementsDomain.js";
import {getAllTallerMovements,getCachedTallerMovements} from "./tallerMovements.js";

export {getMovimientoVigentePorEquipo,movementsToAtrasoMap} from "./equipmentMovementsDomain.js";

let cache={data:[],loaded:false,loading:null,error:"",version:0};
const listeners=new Set();
const emit=()=>listeners.forEach(listener=>listener(cache));
const CACHE_KEY="movimientos_equipos";
const ERROR_ACCEPTANCE_MARKER="[DM_ERROR_ACCEPTED_V1]";
const isErrorAcceptanceMovement_=movement=>String(movement?.observacion||"").includes(ERROR_ACCEPTANCE_MARKER);
const TALLER_ATRASO_TYPES=new Set(["BAJA","MOVILIZACION","CAMBIO_EQUIPO"]);
const persistCache_=async(version=0)=>{
  cache={...cache,version:Number(version||cache.version||0)};
  return writeCachedSource(CACHE_KEY,{ok:true,data:cache.data,meta:{serverVersion:cache.version}}).catch(()=>{});
};

const toIsoDate_=value=>{
  const raw=String(value||"").trim();
  if(!raw)return"";
  let m=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(m)return`${m[1]}-${String(m[2]).padStart(2,"0")}-${String(m[3]).padStart(2,"0")}`;
  m=raw.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/);
  if(m)return`${m[3]}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`;
  return"";
};
const field_=(row,...keys)=>{for(const key of keys){const value=row?.[key];if(value!==undefined&&value!==null&&String(value).trim()!=="")return value;}return"";};
const tallerRowIsActive_=row=>{
  const estado=String(field_(row,"ESTADO","estado")||"").trim().toUpperCase();
  const activo=field_(row,"ACTIVO","activo");
  if(["CANCELADO","ELIMINADO","SUPERADO","INACTIVO"].includes(estado))return false;
  if(activo===false||String(activo).trim().toUpperCase()==="FALSE")return false;
  return true;
};

export async function loadEquipmentMovements({force=false,revalidate=true}={}){
  if(cache.loading)return cache.loading;
  cache.loading=(async()=>{
    let record=null;
    if(!cache.loaded){
      record=await readCachedSource(CACHE_KEY).catch(()=>null);
      if(record?.data?.ok&&Array.isArray(record.data.data)){
        cache={data:record.data.data,loaded:true,loading:cache.loading,error:"",version:Number(record.data?.meta?.serverVersion||record.version||0)};emit();
      }
    }
    if(cache.loaded&&!force&&!revalidate)return cache;
    const versions=force?null:await fetchSyncVersions(APPS_SCRIPT_URL);
    const localVersion=Number(cache.version||record?.data?.meta?.serverVersion||0);
    const serverVersion=Number(versions?.versions?.[CACHE_KEY]||0);
    if(!force&&cache.loaded&&serverVersion>0&&localVersion===serverVersion)return cache;
    const response=await fetchAction(APPS_SCRIPT_URL,"get_equipment_movements",{force,compact:false});
    cache={data:(Array.isArray(response.data)?response.data:[]).filter(item=>!isErrorAcceptanceMovement_(item)),loaded:true,loading:cache.loading,error:"",version:Number(response?.meta?.serverVersion||serverVersion||0)};
    await persistCache_(response?.meta?.serverVersion||serverVersion);emit();return cache;
  })().catch(error=>{
    cache={...cache,loaded:true,loading:null,error:error?.message||"No fue posible cargar movimientos de equipos."};emit();
    if(cache.data.length)return cache;
    throw error;
  }).finally(()=>{cache={...cache,loading:null};emit();});
  return cache.loading;
}

export async function saveEquipmentMovement(movement){
  const prepared={...movement};
  if(String(prepared.tipoMovimiento||"").toUpperCase()==="CAMBIO_PROYECTO"){
    const pending=typeof window!=="undefined"?window.__dmPendingEquipmentMovementLink:null;
    if(!prepared.internoDestino&&pending?.valid){
      const pendingProject=normalizeRop02Project(pending.destinationProject||"");
      const movementProject=normalizeRop02Project(prepared.proyectoDestino||"");
      if(!pendingProject||!movementProject||pendingProject===movementProject){
        prepared.internoDestino=pending.destinationCode||"";
        prepared.fechaPrimerRop02Destino=pending.firstDestinationDate||"";
      }
    }
    if(prepared.internoDestino){
      prepared.observacion=appendEquipmentMovementLinkMetadata(prepared.observacion,prepared.internoDestino,prepared.fechaPrimerRop02Destino);
    }
  }
  const response=await postToAppsScript({action:"save_equipment_movement",movement:prepared});
  if(typeof window!=="undefined")window.__dmPendingEquipmentMovementLink=null;
  const saved=response?.movement;
  if(saved){
    const next=cache.data.map(item=>item.activo&&item.internoNormalizado===saved.internoNormalizado&&item.proyectoOrigen===saved.proyectoOrigen
      ?{...item,activo:false,estado:"SUPERADO"}:item);
    cache={data:[...next,saved],loaded:true,loading:null,error:"",version:Number(response.version||cache.version||0)};
    await persistCache_(response.version);emit();
  }
  return response;
}

export async function cancelEquipmentMovement(id,usuario){
  const response=await postToAppsScript({action:"cancel_equipment_movement",id,usuario});
  cache={data:cache.data.map(item=>String(item.id)===String(id)?{...item,activo:false,estado:"CANCELADO"}:item),loaded:true,loading:null,error:"",version:Number(response.version||cache.version||0)};
  await persistCache_(response.version);emit();
  return response;
}

export function useEquipmentMovements(rop02Rows=[],views=[]){
  const[snapshot,setSnapshot]=useState(cache);
  const[tallerRows,setTallerRows]=useState(()=>["BAJA","MOVILIZACION","CAMBIO_EQUIPO"].flatMap(type=>getCachedTallerMovements(type)));
  const viewsKey=JSON.stringify(views);
  const wantsTallerAtraso=useMemo(()=>Array.isArray(views)&&views.some(view=>String(view||"").toLowerCase().includes("atraso")),[viewsKey]);
  const wantsTallerProfile=useMemo(()=>Array.isArray(views)&&views.some(view=>String(view||"").toLowerCase().includes("equipmentprofile")),[viewsKey]);
  const wantsTaller= wantsTallerAtraso||wantsTallerProfile;
  const loadTaller=useCallback(async()=>{
    if(!wantsTaller)return[];
    try{
      const rows=await getAllTallerMovements();
      const relevant=rows.filter(row=>TALLER_ATRASO_TYPES.has(String(row?.TIPO||"").toUpperCase()));
      setTallerRows(prev=>relevant.length?relevant:prev);
      return relevant;
    }catch(_){return[];}
  },[wantsTaller]);

  useEffect(()=>{listeners.add(setSnapshot);loadEquipmentMovements().catch(()=>{});return()=>listeners.delete(setSnapshot)},[]);
  useEffect(()=>registerRefreshTask("equipment-movements",()=>loadEquipmentMovements({revalidate:true}),{views,priority:15}),[viewsKey]);
  useEffect(()=>{if(wantsTaller)loadTaller();},[wantsTaller,loadTaller]);
  useEffect(()=>wantsTaller?registerRefreshTask("taller-movements-shared",loadTaller,{views,priority:16}):()=>{},[wantsTaller,viewsKey,loadTaller]);

  const rop02Index=useMemo(()=>{
    const latest=new Map(),dates=new Map();
    for(const row of Array.isArray(rop02Rows)?rop02Rows:[]){
      const code=normalizeEquipmentMovementCode(row?.maquina||row?._internoRaw||row?.interno);
      const project=normalizeRop02Project(row?.proyecto||row?.lugar);
      const date=toIsoDate_(row?.fecha);
      const key=equipmentProjectKey(code,project);
      if(!code||!project||!date)continue;
      if(!latest.has(key)||date>latest.get(key))latest.set(key,date);
      if(!dates.has(key))dates.set(key,[]);
      dates.get(key).push(date);
    }
    dates.forEach((arr,key)=>dates.set(key,[...new Set(arr)].sort()));
    return{latest,dates};
  },[rop02Rows]);
  const latestRop02ByEquipmentProject=rop02Index.latest;

  const tallerCanonical=useMemo(()=>{
    if(!wantsTaller)return[];
    return (Array.isArray(tallerRows)?tallerRows:[]).map((row,index)=>{
      if(!tallerRowIsActive_(row))return null;
      const type=String(field_(row,"TIPO","tipo","TIPO_MOVIMIENTO","tipoMovimiento")||"").trim().toUpperCase();
      if(!TALLER_ATRASO_TYPES.has(type))return null;
      const interno=String(field_(row,"INTERNO_ORIGEN","internoOrigen","INTERNO","interno")||"").trim();
      const internoDestino=String(field_(row,"INTERNO_DESTINO","internoDestino")||"").trim();
      const code=normalizeEquipmentMovementCode(interno);
      const project=normalizeRop02Project(field_(row,"PROYECTO_ORIGEN","proyectoOrigen","ORIGEN","origen"));
      const movementDate=toIsoDate_(field_(row,"FECHA_HORA","fechaHora","FECHA","fecha"));
      if(!code||!project||!movementDate)return null;
      const key=equipmentProjectKey(code,project);
      const history=rop02Index.dates.get(key)||[];
      let fechaUltimoRop02="";
      for(const date of history){if(date<=movementDate)fechaUltimoRop02=date;else break;}
      if(!fechaUltimoRop02&&wantsTallerAtraso&&!wantsTallerProfile)return null;
      const rawId=String(field_(row,"ID","id")||`${code}_${project}_${movementDate}_${index}`);
      return{
        id:`taller:${rawId}`,
        interno:interno||code,
        internoNormalizado:code,
        internoDestino,
        proyectoOrigen:project,
        proyectoDestino:normalizeRop02Project(field_(row,"PROYECTO_DESTINO","proyectoDestino","DESTINO","destino"))||String(field_(row,"PROYECTO_DESTINO","proyectoDestino","DESTINO","destino")||"").trim(),
        tipoMovimiento:`TALLER_${type}`,
        motivo:String(field_(row,"MOTIVO","motivo")||type.replace(/_/g," ")).trim(),
        observacion:String(field_(row,"OBSERVACION","observacion")||"").trim(),
        usuario:String(field_(row,"USUARIO","usuario")||"").trim(),
        fechaHora:movementDate,
        fechaUltimoRop02,
        activo:true,
        estado:"ACTIVO",
      };
    }).filter(Boolean);
  },[wantsTaller,wantsTallerAtraso,wantsTallerProfile,tallerRows,rop02Index]);

  const combinedMovements=useMemo(()=>[...(Array.isArray(snapshot.data)?snapshot.data:[]),...tallerCanonical],[snapshot.data,tallerCanonical]);
  const activeMovementByEquipment=useMemo(()=>getMovimientoVigentePorEquipo(combinedMovements,latestRop02ByEquipmentProject),[combinedMovements,latestRop02ByEquipmentProject]);
  const historicalMovementMap=useMemo(()=>{
    const map=new Map();
    for(const movement of combinedMovements){
      const estado=String(movement?.estado||"").toUpperCase();
      if(movement?.activo===false||["CANCELADO","ELIMINADO"].includes(estado)||!toIsoDate_(movement?.fechaUltimoRop02))continue;
      map.set(`history:${movement?.id||map.size}`,movement);
    }
    return map;
  },[combinedMovements]);
  const admitidos=useMemo(()=>({...movementsToAtrasoMap(historicalMovementMap),...movementsToAtrasoMap(activeMovementByEquipment)}),[historicalMovementMap,activeMovementByEquipment]);
  // La Ficha Única usa como fuente histórica solamente los movimientos realmente
  // cargados en las pestañas de Movimiento/Taller. El cache legado de MOVIMIENTOS_EQUIPOS
  // puede contener proyecciones o registros derivados y no debe crear filas duplicadas.
  const profileMovements=useMemo(()=>{
    if(!wantsTallerProfile)return snapshot.data;
    const unique=new Map();
    for(const movement of tallerCanonical){
      const key=String(movement.id||`${movement.fechaHora}|${movement.internoNormalizado}|${movement.proyectoOrigen}|${movement.proyectoDestino}|${movement.internoDestino}`);
      if(!unique.has(key))unique.set(key,movement);
    }
    return[...unique.values()];
  },[wantsTallerProfile,tallerCanonical,snapshot.data]);
  return{...snapshot,loading:Boolean(snapshot.loading)||!snapshot.loaded,movements:profileMovements,activeMovementByEquipment,admitidos,reload:useCallback(()=>loadEquipmentMovements({force:true}),[])};
}
