import {canonicalEquipmentCode} from "./equipmentCode.js";
import {normalizeRop02Project} from "../home/homeAvailability.js";
import {getEquipmentMovementDestinationCode,getEquipmentMovementDestinationFirstDate} from "../../services/equipmentMovementsDomain.js";

const dateISO=value=>{if(!value)return"";const direct=String(value).slice(0,10);if(/^\d{4}-\d{2}-\d{2}$/.test(direct))return direct;const parsed=new Date(value);return Number.isNaN(parsed.getTime())?"":parsed.toISOString().slice(0,10);};
const displayProject=value=>{const project=normalizeRop02Project(value);return project==="JOSE MARIA"?"José María":project==="FILO DEL SOL"?"Filo del Sol":project==="FILO SUR"?"Filo Sur":project==="EL ZORRO"?"El Zorro":project==="SAN JUAN"?"San Juan":project||"—";};
const displayDate=value=>{const iso=dateISO(value);if(!iso)return"—";const[y,m,d]=iso.split("-");return`${d}/${m}/${y}`;};
const metadataField=(raw,key)=>{const match=String(raw||"").match(new RegExp(`\\[${key}:([^\\]]*)\\]`,`i`));return match?String(match[1]||"").trim():"";};
const stripTallerMetadata=raw=>String(raw||"").replace(/\[(?:DM_TALLER|TIPO|EQUIPO|MARCA|MODELO|PROPIEDAD|INTERNO|HOROMETRO|ORIGEN|DESTINO|INTERNO_DESTINO|INTERNO_ENTRA|MOTIVO|EQUIPO_ENTRA|MARCA_ENTRA|MODELO_ENTRA|PROPIEDAD_ENTRA|HOROMETRO_ENTRA|USUARIO):[^\]]*\]/gi,"").trim();
const tallerMovementPresentation=movement=>{
  const observation=String(movement?.observacion||"");
  if(!observation.includes("[DM_TALLER:1]"))return null;
  const type=metadataField(observation,"TIPO").toUpperCase();
  const destinationCode=metadataField(observation,"INTERNO_DESTINO");
  const incomingCode=metadataField(observation,"INTERNO_ENTRA")||destinationCode;
  const metadataReason=metadataField(observation,"MOTIVO");
  const userObservation=stripTallerMetadata(observation);
  if(type==="CAMBIO_EQUIPO")return{destination:"SAN JUAN",reason:`Se cambia equipo por ${incomingCode||"equipo de reemplazo"}`};
  if(type==="BAJA"){
    const detail=userObservation||metadataReason||"motivo informado";
    return{destination:"SAN JUAN",reason:`Se baja a SJ por ${detail}`};
  }
  if(type==="MOVILIZACION"){
    const destination=metadataField(observation,"DESTINO")||movement?.proyectoDestino||"";
    const shownDestination=displayProject(destination).toUpperCase();
    return{destination,reason:destinationCode?`Se moviliza a ${shownDestination} con interno ${destinationCode}`:`Se moviliza a ${shownDestination}`};
  }
  if(type==="SUBIDA")return{destination:metadataField(observation,"DESTINO")||movement?.proyectoDestino||"",reason:"Subida de equipo"};
  return null;
};

// ROP02 se usa exclusivamente para establecer el PRIMER lugar conocido del equipo.
// Los cambios posteriores de proyecto deben provenir de Movimiento de equipos.
export function inferRop02ProjectMovements(rows=[]){
  const sorted=[...(Array.isArray(rows)?rows:[])].filter(r=>normalizeRop02Project(r.proyecto)).sort((a,b)=>String(a.fecha||"").localeCompare(String(b.fecha||"")));
  const first=sorted[0];
  if(!first)return[];
  const project=normalizeRop02Project(first.proyecto),iso=dateISO(first.fecha);
  return[{fechaISO:iso,fecha:displayDate(iso),desdeRaw:"",hastaRaw:project,desde:"—",hasta:displayProject(project),source:"ROP02",motivo:"Detectado por ROP02",usuario:""}];
}

export function persistedProjectMovements(movements=[],equipmentCode=""){
  const selected=canonicalEquipmentCode(equipmentCode);
  const rows=(Array.isArray(movements)?movements:[]).filter(movement=>{
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

  // Un movimiento puede quedar accesible por código anterior y nuevo. Se muestra una sola vez.
  const unique=new Map();
  for(const row of rows){
    const key=row.id||`${row.fechaISO}|${normalizeRop02Project(row.desdeRaw)}|${normalizeRop02Project(row.hastaRaw)}|${canonicalEquipmentCode(row.internoDestino)}|${row.motivo}`;
    if(!unique.has(key))unique.set(key,row);
  }
  return[...unique.values()];
}

export function mergeEquipmentMovements(rop02Rows=[],persistedMovements=[],equipmentCode=""){
  const initial=inferRop02ProjectMovements(rop02Rows);
  const manual=persistedProjectMovements(persistedMovements,equipmentCode);
  return[...initial,...manual].sort((a,b)=>b.fechaISO.localeCompare(a.fechaISO)||(a.source==="MANUAL"?-1:1)).slice(0,30);
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
