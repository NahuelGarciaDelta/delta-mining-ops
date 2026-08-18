import {canonicalEquipmentCode} from "./equipmentCode.js";
import {normalizeRop02Project} from "../home/homeAvailability.js";
import {getEquipmentMovementDestinationCode,getEquipmentMovementDestinationFirstDate} from "../../services/equipmentMovementsDomain.js";

const dateISO=value=>{if(!value)return"";const direct=String(value).slice(0,10);if(/^\d{4}-\d{2}-\d{2}$/.test(direct))return direct;const parsed=new Date(value);return Number.isNaN(parsed.getTime())?"":parsed.toISOString().slice(0,10);};
const displayProject=value=>{const project=normalizeRop02Project(value);return project==="JOSE MARIA"?"José María":project==="FILO DEL SOL"?"Filo del Sol":project==="FILO SUR"?"Filo Sur":project==="EL ZORRO"?"El Zorro":project==="SAN JUAN"?"San Juan":project||"—";};
const displayDate=value=>{const iso=dateISO(value);if(!iso)return"—";const[y,m,d]=iso.split("-");return`${d}/${m}/${y}`;};
const dayDistance=(a,b)=>Math.abs((new Date(`${a}T00:00:00`)-new Date(`${b}T00:00:00`))/86400000);
const routeKey=row=>`${normalizeRop02Project(row.desdeRaw)}|${normalizeRop02Project(row.hastaRaw)}`;
const metadataField=(raw,key)=>{const match=String(raw||"").match(new RegExp(`\\[${key}:([^\\]]*)\\]`,`i`));return match?String(match[1]||"").trim():"";};
const stripTallerMetadata=raw=>String(raw||"").replace(/\[(?:DM_TALLER|TIPO|EQUIPO|MARCA|MODELO|PROPIEDAD|INTERNO|HOROMETRO|ORIGEN|DESTINO|INTERNO_DESTINO|MOTIVO|EQUIPO_ENTRA|MARCA_ENTRA|MODELO_ENTRA|PROPIEDAD_ENTRA|HOROMETRO_ENTRA|USUARIO):[^\]]*\]/gi,"").trim();
const tallerMovementPresentation=movement=>{
  const observation=String(movement?.observacion||"");
  if(!observation.includes("[DM_TALLER:1]"))return null;
  const type=metadataField(observation,"TIPO").toUpperCase();
  const destinationCode=metadataField(observation,"INTERNO_DESTINO");
  const metadataReason=metadataField(observation,"MOTIVO");
  const userObservation=stripTallerMetadata(observation);
  if(type==="CAMBIO_EQUIPO")return{destination:"SAN JUAN",reason:`Se cambia equipo por ${destinationCode||"equipo de reemplazo"}`};
  if(type==="BAJA"){
    const detail=userObservation||metadataReason||"motivo informado";
    return{destination:"SAN JUAN",reason:`Se baja a SJ por ${detail}`};
  }
  if(type==="MOVILIZACION")return{destination:metadataField(observation,"DESTINO")||movement?.proyectoDestino||"",reason:destinationCode&&canonicalEquipmentCode(destinationCode)!==canonicalEquipmentCode(movement?.internoNormalizado||movement?.interno)?`Se moviliza y cambia interno a ${destinationCode}`:"Movilización de equipo"};
  if(type==="SUBIDA")return{destination:metadataField(observation,"DESTINO")||movement?.proyectoDestino||"",reason:"Subida de equipo"};
  return null;
};

export function inferRop02ProjectMovements(rows=[]){
  const sorted=[...(Array.isArray(rows)?rows:[])].sort((a,b)=>String(a.fecha||"").localeCompare(String(b.fecha||"")));
  const out=[];let previous="";
  for(const row of sorted){const project=normalizeRop02Project(row.proyecto);if(!project||project===previous)continue;const iso=dateISO(row.fecha);out.push({fechaISO:iso,fecha:displayDate(iso),desdeRaw:previous,hastaRaw:project,desde:displayProject(previous),hasta:displayProject(project),source:"ROP02",motivo:"",usuario:""});previous=project;}
  return out;
}

export function persistedProjectMovements(movements=[],equipmentCode=""){
  const selected=canonicalEquipmentCode(equipmentCode);
  return (Array.isArray(movements)?movements:[]).filter(movement=>{
    const origin=canonicalEquipmentCode(movement.internoNormalizado||movement.interno);
    const destination=canonicalEquipmentCode(getEquipmentMovementDestinationCode(movement));
    return origin===selected||destination===selected;
  }).map(movement=>{
    const type=String(movement.tipoMovimiento||"").toUpperCase(),origin=normalizeRop02Project(movement.proyectoOrigen);
    const taller=tallerMovementPresentation(movement);
    const destination=normalizeRop02Project(taller?.destination||movement.proyectoDestino)||(type==="BAJO_SAN_JUAN"?"SAN JUAN":type==="DESMOVILIZADO"?"DESMOVILIZADO":"");
    const destinationCode=getEquipmentMovementDestinationCode(movement);
    const destinationDate=getEquipmentMovementDestinationFirstDate(movement);
    const iso=dateISO(type==="CAMBIO_PROYECTO"&&destinationDate?destinationDate:movement.fechaHora);
    return{fechaISO:iso,fecha:displayDate(iso),desdeRaw:origin,hastaRaw:destination,desde:displayProject(origin),hasta:displayProject(destination),source:"MANUAL",motivo:taller?.reason||movement.motivo||type,observacion:movement.observacion||"",usuario:movement.usuario||"",id:movement.id||"",internoOrigen:canonicalEquipmentCode(movement.internoNormalizado||movement.interno),internoDestino:destinationCode};
  }).filter(movement=>movement.fechaISO&&(movement.desdeRaw||movement.hastaRaw));
}

export function mergeEquipmentMovements(rop02Rows=[],persistedMovements=[],equipmentCode="",approximateDays=14){
  const inferred=inferRop02ProjectMovements(rop02Rows),manual=persistedProjectMovements(persistedMovements,equipmentCode);
  const retained=inferred.filter(auto=>!manual.some(saved=>routeKey(saved)===routeKey(auto)&&dayDistance(saved.fechaISO,auto.fechaISO)<=approximateDays));
  return[...retained,...manual].sort((a,b)=>b.fechaISO.localeCompare(a.fechaISO)||(a.source==="MANUAL"?-1:1)).slice(0,30);
}

export function indexPersistedMovementsByEquipment(movements=[]){
  const index=new Map();
  const add=(code,movement)=>{const key=canonicalEquipmentCode(code);if(!key)return;if(!index.has(key))index.set(key,[]);index.get(key).push(movement);};
  for(const movement of Array.isArray(movements)?movements:[]){
    add(movement.internoNormalizado||movement.interno,movement);
    const destination=getEquipmentMovementDestinationCode(movement);
    if(destination)add(destination,movement);
  }
  return index;
}
