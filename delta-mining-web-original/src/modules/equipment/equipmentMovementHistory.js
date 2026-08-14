import {canonicalEquipmentCode} from "./equipmentCode.js";
import {normalizeRop02Project} from "../home/homeAvailability.js";

const dateISO=value=>{if(!value)return"";const direct=String(value).slice(0,10);if(/^\d{4}-\d{2}-\d{2}$/.test(direct))return direct;const parsed=new Date(value);return Number.isNaN(parsed.getTime())?"":parsed.toISOString().slice(0,10);};
const displayProject=value=>{const project=normalizeRop02Project(value);return project==="JOSE MARIA"?"José María":project==="FILO DEL SOL"?"Filo del Sol":project==="FILO SUR"?"Filo Sur":project==="EL ZORRO"?"El Zorro":project==="SAN JUAN"?"San Juan":project||"—";};
const displayDate=value=>{const iso=dateISO(value);if(!iso)return"—";const[y,m,d]=iso.split("-");return`${d}/${m}/${y}`;};
const dayDistance=(a,b)=>Math.abs((new Date(`${a}T00:00:00`)-new Date(`${b}T00:00:00`))/86400000);
const routeKey=row=>`${normalizeRop02Project(row.desdeRaw)}|${normalizeRop02Project(row.hastaRaw)}`;

export function inferRop02ProjectMovements(rows=[]){
  const sorted=[...(Array.isArray(rows)?rows:[])].sort((a,b)=>String(a.fecha||"").localeCompare(String(b.fecha||"")));
  const out=[];let previous="";
  for(const row of sorted){const project=normalizeRop02Project(row.proyecto);if(!project||project===previous)continue;const iso=dateISO(row.fecha);out.push({fechaISO:iso,fecha:displayDate(iso),desdeRaw:previous,hastaRaw:project,desde:displayProject(previous),hasta:displayProject(project),source:"ROP02",motivo:"",usuario:""});previous=project;}
  return out;
}

export function persistedProjectMovements(movements=[],equipmentCode=""){
  const selected=canonicalEquipmentCode(equipmentCode);
  return (Array.isArray(movements)?movements:[]).filter(movement=>canonicalEquipmentCode(movement.internoNormalizado||movement.interno)===selected).map(movement=>{
    const type=String(movement.tipoMovimiento||"").toUpperCase(),origin=normalizeRop02Project(movement.proyectoOrigen);
    const destination=normalizeRop02Project(movement.proyectoDestino)||(type==="BAJO_SAN_JUAN"?"SAN JUAN":type==="DESMOVILIZADO"?"DESMOVILIZADO":""),iso=dateISO(movement.fechaHora);
    return{fechaISO:iso,fecha:displayDate(iso),desdeRaw:origin,hastaRaw:destination,desde:displayProject(origin),hasta:displayProject(destination),source:"MANUAL",motivo:movement.motivo||type,observacion:movement.observacion||"",usuario:movement.usuario||"",id:movement.id||""};
  }).filter(movement=>movement.fechaISO&&(movement.desdeRaw||movement.hastaRaw));
}

export function mergeEquipmentMovements(rop02Rows=[],persistedMovements=[],equipmentCode="",approximateDays=14){
  const inferred=inferRop02ProjectMovements(rop02Rows),manual=persistedProjectMovements(persistedMovements,equipmentCode);
  const retained=inferred.filter(auto=>!manual.some(saved=>routeKey(saved)===routeKey(auto)&&dayDistance(saved.fechaISO,auto.fechaISO)<=approximateDays));
  return[...retained,...manual].sort((a,b)=>b.fechaISO.localeCompare(a.fechaISO)||(a.source==="MANUAL"?-1:1)).slice(0,30);
}

export function indexPersistedMovementsByEquipment(movements=[]){
  const index=new Map();for(const movement of Array.isArray(movements)?movements:[]){const code=canonicalEquipmentCode(movement.internoNormalizado||movement.interno);if(!code)continue;if(!index.has(code))index.set(code,[]);index.get(code).push(movement);}return index;
}
