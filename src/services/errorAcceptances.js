import {useCallback,useEffect,useMemo,useState} from "react";
import {APPS_SCRIPT_URL} from "../config/app.js";
import {fetchAction} from "./appsScriptApi.js";
import {postToAppsScript} from "./writeActions.js";
import {registerRefreshTask} from "./refreshManager.js";
import {normalizeRop02Project} from "../modules/home/homeAvailability.js";

const MARKER="[DM_ERROR_ACCEPTED_V1]";
const MAX_JUSTIFICATION_LENGTH=2000;

const text=value=>String(value??"").trim();
const upper=value=>text(value).toUpperCase();

function normalizedValue(value){
  return upper(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ");
}

function errorSnapshot(error={}){
  return {
    tipo:text(error._tipo||error.tipo),
    proyecto:normalizeRop02Project(error.proyecto||""),
    maquina:text(error.maquina),
    fecha:text(error.fecha).slice(0,10),
    turno:upper(error.turno),
    supervisor:text(error.supervisor),
    numeroIncorrecto:text(error.numeroIncorrecto||error.parte),
    numeroCorrecto:text(error.numeroCorrecto),
    hiActual:text(error.hiActual),
    hfAnterior:text(error.hfAnterior),
    diff:text(error.diff),
    fechaAnterior:text(error.fechaAnterior).slice(0,10),
    turnoAnterior:upper(error.turnoAnterior),
    parteAnterior:text(error.parteAnterior),
    detalle:text(error.detalle),
  };
}

export function errorAcceptanceKey(error={}){
  const row=errorSnapshot(error);
  return [
    row.tipo,row.proyecto,row.maquina,row.fecha,row.turno,
    row.numeroIncorrecto,row.numeroCorrecto,row.hiActual,row.hfAnterior,
    row.diff,row.fechaAnterior,row.turnoAnterior,row.parteAnterior,
  ].map(normalizedValue).join("|");
}

function hashKey(value){
  let hash=2166136261;
  for(let index=0;index<value.length;index++){
    hash^=value.charCodeAt(index);
    hash=Math.imul(hash,16777619);
  }
  return (hash>>>0).toString(36).toUpperCase();
}

function isActive(movement={}){
  const state=upper(movement.estado);
  return movement.activo!==false&&!["CANCELADO","SUPERADO","ELIMINADO"].includes(state);
}

function parseAcceptance(movement={}){
  if(upper(movement.tipoMovimiento)!=="OTRO"||!isActive(movement))return null;
  const observation=text(movement.observacion);
  const index=observation.indexOf(MARKER);
  if(index<0)return null;
  try{
    const metadata=JSON.parse(observation.slice(index+MARKER.length).trim());
    if(!metadata?.key||!metadata?.error||!metadata?.justificacion)return null;
    return {
      id:text(movement.id),
      key:text(metadata.key),
      ...metadata.error,
      proyecto:normalizeRop02Project(metadata.error.proyecto||movement.proyectoOrigen||""),
      justificacion:text(metadata.justificacion),
      usuario:text(movement.usuario)||"Usuario",
      fechaAceptacion:text(movement.fechaHora),
    };
  }catch(_){
    return null;
  }
}

export async function loadErrorAcceptances(){
  const response=await fetchAction(APPS_SCRIPT_URL,"get_equipment_movements",{force:true,compact:false});
  return (Array.isArray(response?.data)?response.data:[])
    .map(parseAcceptance)
    .filter(Boolean);
}

export async function saveErrorAcceptance(error,justificacion,usuario){
  const snapshot=errorSnapshot(error);
  const key=errorAcceptanceKey(snapshot);
  const reason=text(justificacion);
  if(!snapshot.proyecto||!snapshot.maquina||!snapshot.fecha||!snapshot.tipo)throw new Error("El error no contiene los datos necesarios para aceptarlo.");
  if(!reason)throw new Error("Ingresá una justificación para aceptar el error.");
  if(reason.length>MAX_JUSTIFICATION_LENGTH)throw new Error(`La justificación no puede superar los ${MAX_JUSTIFICATION_LENGTH} caracteres.`);

  const metadata={version:1,key,error:snapshot,justificacion:reason};
  const observation=`${MARKER} ${JSON.stringify(metadata)}`;
  await postToAppsScript({
    action:"save_equipment_movement",
    movement:{
      interno:`ERR-${hashKey(key)}`,
      internoNormalizado:`ERR-${hashKey(key)}`,
      proyectoOrigen:snapshot.proyecto,
      proyectoDestino:"",
      tipoMovimiento:"OTRO",
      motivo:`Error de ${snapshot.tipo} aceptado`,
      observacion:observation,
      usuario:text(usuario)||"Usuario",
      fechaUltimoRop02:snapshot.fecha,
    }
  });
}

export async function cancelErrorAcceptance(id,usuario){
  const acceptanceId=text(id);
  if(!acceptanceId)throw new Error("No se encontró la aceptación a restaurar.");
  await postToAppsScript({action:"cancel_equipment_movement",id:acceptanceId,usuario:text(usuario)||"Usuario"});
}

export function useErrorAcceptances(allowedProjects=[],views=[]){
  const [snapshot,setSnapshot]=useState({data:[],loading:false,error:""});
  const projectsKey=Array.isArray(allowedProjects)?allowedProjects.map(normalizeRop02Project).filter(Boolean).sort().join("|"):"";
  const viewsKey=JSON.stringify(views);

  const reload=useCallback(async()=>{
    setSnapshot(previous=>({...previous,loading:true,error:""}));
    try{
      const data=await loadErrorAcceptances();
      setSnapshot({data,loading:false,error:""});
      return data;
    }catch(error){
      setSnapshot(previous=>({...previous,loading:false,error:error?.message||"No se pudieron cargar los errores aceptados."}));
      throw error;
    }
  },[]);

  useEffect(()=>{reload().catch(()=>{});},[reload]);
  useEffect(()=>registerRefreshTask("error-acceptances",reload,{views,priority:16}),[reload,viewsKey]);

  const data=useMemo(()=>{
    const allowed=new Set(projectsKey.split("|").filter(Boolean));
    return snapshot.data.filter(row=>allowed.has(normalizeRop02Project(row.proyecto)));
  },[snapshot.data,projectsKey]);

  const byKey=useMemo(()=>new Map(data.map(row=>[row.key,row])),[data]);
  return {data,byKey,loading:snapshot.loading,error:snapshot.error,reload};
}
