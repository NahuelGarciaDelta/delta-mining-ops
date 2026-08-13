import {resolveEquipmentCodeAlias} from "../modules/equipment/equipmentCode.js";
import {equipmentProjectKey,normalizeRop02Project} from "../modules/home/homeAvailability.js";

export const normalizeEquipmentMovementCode=value=>{
  const raw=String(value||"").trim().toUpperCase().replace(/\s*\(.*?\)/g,"").replace(/[-_\s]+JM$/i,"");
  const match=raw.replace(/[^A-Z0-9]/g,"").match(/^([A-Z]{2,4})(\d{1,6})$/);
  const formatted=match?`${match[1]}-${match[2].padStart(4,"0")}`:raw;
  return resolveEquipmentCodeAlias(formatted);
};

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
    };
  });
  return out;
}
