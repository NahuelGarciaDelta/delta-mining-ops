import {resolveEquipmentCodeAlias} from "../modules/equipment/equipmentCode.js";
import {equipmentProjectKey,normalizeRop02Project} from "../modules/home/homeAvailability.js";

export const normalizeEquipmentMovementCode=value=>{
  const raw=String(value||"").trim().toUpperCase().replace(/\s*\(.*?\)/g,"").replace(/[-_\s]+JM$/i,"");
  const match=raw.replace(/[^A-Z0-9]/g,"").match(/^([A-Z]{2,4})(\d{1,6})$/);
  const formatted=match?`${match[1]}-${match[2].padStart(4,"0")}`:raw;
  return resolveEquipmentCodeAlias(formatted);
};

const DEST_CODE_RE=/\[DM_INTERNO_DESTINO:([^\]]+)\]/i;
const DEST_DATE_RE=/\[DM_FECHA_DESTINO:(\d{4}-\d{2}-\d{2})\]/i;

export function getEquipmentMovementDestinationCode(movement={}){
  const direct=String(movement?.internoDestino||movement?.internoDestinoNormalizado||"").trim();
  if(direct)return normalizeEquipmentMovementCode(direct);
  const match=String(movement?.observacion||"").match(DEST_CODE_RE);
  return match?normalizeEquipmentMovementCode(match[1]):"";
}

export function getEquipmentMovementDestinationFirstDate(movement={}){
  const direct=String(movement?.fechaPrimerRop02Destino||"").slice(0,10);
  if(/^\d{4}-\d{2}-\d{2}$/.test(direct))return direct;
  const match=String(movement?.observacion||"").match(DEST_DATE_RE);
  return match?match[1]:"";
}

export function appendEquipmentMovementLinkMetadata(observation="",destinationCode="",destinationDate=""){
  const clean=String(observation||"").replace(DEST_CODE_RE,"").replace(DEST_DATE_RE,"").trim();
  const code=normalizeEquipmentMovementCode(destinationCode);
  const date=String(destinationDate||"").slice(0,10);
  const metadata=[code?`[DM_INTERNO_DESTINO:${code}]`:"",/^\d{4}-\d{2}-\d{2}$/.test(date)?`[DM_FECHA_DESTINO:${date}]`:""].filter(Boolean).join(" ");
  return [clean,metadata].filter(Boolean).join(" ").trim();
}

export function buildEquipmentMovementAliasMap(movements=[]){
  const out=new Map();
  for(const movement of Array.isArray(movements)?movements:[]){
    if(String(movement?.tipoMovimiento||"").toUpperCase()!=="CAMBIO_PROYECTO")continue;
    if(String(movement?.estado||"").toUpperCase()==="CANCELADO")continue;
    const origin=normalizeEquipmentMovementCode(movement?.internoNormalizado||movement?.interno);
    const destination=getEquipmentMovementDestinationCode(movement);
    if(origin&&destination&&origin!==destination)out.set(origin,destination);
  }
  return out;
}

export function getMovimientoVigentePorEquipo(movements=[],latestRop02ByEquipmentProject=new Map()){
  const active=new Map();
  [...(Array.isArray(movements)?movements:[])].sort((a,b)=>String(a.fechaHora||"").localeCompare(String(b.fechaHora||""))).forEach(movement=>{
    const code=normalizeEquipmentMovementCode(movement.internoNormalizado||movement.interno);
    if(!code||movement.activo===false||["CANCELADO","SUPERADO"].includes(String(movement.estado||"").toUpperCase()))return;
    const project=normalizeRop02Project(movement.proyectoOrigen);
    const key=project?equipmentProjectKey(code,project):code;
    const lastRop02=latestRop02ByEquipmentProject.get(key)||latestRop02ByEquipmentProject.get(code)||"";
    const movementRop02=String(movement.fechaUltimoRop02||"").slice(0,10);
    if(lastRop02&&movementRop02&&lastRop02>movementRop02)return;
    active.set(key,{...movement,internoNormalizado:code,proyectoOrigen:project});
  });
  return active;
}

export function movementsToAtrasoMap(activeMovementByEquipment=new Map()){
  const out={};
  activeMovementByEquipment.forEach((movement,key)=>{
    const code=normalizeEquipmentMovementCode(movement.internoNormalizado||movement.interno);
    const project=normalizeRop02Project(movement.proyectoOrigen||String(key).split("|").slice(1).join("|"));
    const ultimaCarga=String(movement.fechaUltimoRop02||"").slice(0,10);
    if(!ultimaCarga)return;
    const atrasoKey=project?`atrasado_${code}_${project}_${ultimaCarga}`:`atrasado_${code}_${ultimaCarga}`;
    out[atrasoKey]={
      admitido:true,causa:movement.motivo,fechaAdmitido:movement.fechaHora,usuario:movement.usuario,
      codigo:code,maquina:movement.interno||code,proyecto:project,ultimaCarga,movementId:movement.id,
      proyectoDestino:movement.proyectoDestino,tipoMovimiento:movement.tipoMovimiento,observacion:movement.observacion,
      internoDestino:getEquipmentMovementDestinationCode(movement),fechaPrimerRop02Destino:getEquipmentMovementDestinationFirstDate(movement),
    };
  });
  return out;
}
