import {resolveEquipmentCodeAlias} from "../modules/equipment/equipmentCode.js";

export const normalizeEquipmentMovementCode=value=>{
  const raw=String(value||"").trim().toUpperCase().replace(/\s*\(.*?\)/g,"").replace(/[-_\s]+JM$/i,"");
  const match=raw.replace(/[^A-Z0-9]/g,"").match(/^([A-Z]{2,4})(\d{1,6})$/);
  const formatted=match?`${match[1]}-${match[2].padStart(4,"0")}`:raw;
  return resolveEquipmentCodeAlias(formatted);
};

export function getMovimientoVigentePorEquipo(movements=[],latestRop02ByCode=new Map()){
  const active=new Map();
  [...(Array.isArray(movements)?movements:[])].sort((a,b)=>String(a.fechaHora||"").localeCompare(String(b.fechaHora||""))).forEach(movement=>{
    const code=normalizeEquipmentMovementCode(movement.internoNormalizado||movement.interno);
    if(!code||movement.activo===false||["CANCELADO","SUPERADO"].includes(String(movement.estado||"").toUpperCase()))return;
    const lastRop02=latestRop02ByCode.get(code)||"";
    const movementRop02=String(movement.fechaUltimoRop02||"").slice(0,10);
    if(lastRop02&&movementRop02&&lastRop02>movementRop02)return;
    active.set(code,{...movement,internoNormalizado:code});
  });
  return active;
}

export function movementsToAtrasoMap(activeMovementByEquipment=new Map()){
  const out={};
  activeMovementByEquipment.forEach((movement,code)=>{
    const ultimaCarga=String(movement.fechaUltimoRop02||"").slice(0,10);
    if(!ultimaCarga)return;
    out[`atrasado_${code}_${ultimaCarga}`]={
      admitido:true,causa:movement.motivo,fechaAdmitido:movement.fechaHora,usuario:movement.usuario,
      maquina:movement.interno||code,proyecto:movement.proyectoOrigen,ultimaCarga,movementId:movement.id,
      proyectoDestino:movement.proyectoDestino,tipoMovimiento:movement.tipoMovimiento,observacion:movement.observacion,
    };
  });
  return out;
}
