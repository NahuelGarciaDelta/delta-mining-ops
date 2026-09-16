const normalizeId=id=>String(id||"").replace(/\\/g,"/").split("?")[0];

const IMPORT_ANCHOR='import {detectRop02DuplicateLoads} from "./rop02DuplicateLoads.js";';
const IMPORT_LINE='import { rop02ControlTurnoKey, rop02ControlTurnoOrder, rop02ControlRowEligible, rop02ControlTipoOptions, rop02ControlTipoMatches } from "./rop02ControlRules.js";';
const LEGACY_CAA_EXCLUSION=String.raw`  const rop02ControlRows=useMemo(()=>rop02Prod.filter(r=>{
    const m=String(r.maquina||"").trim();
    return !/^CAA[-_\s]*0002(?:[-_\s]*JM)?$/i.test(m) && normalizeMachineCode(m)!=="CAA-0002";
  }),[rop02Prod]);`;

function replaceRequired(code,from,to,label){
  if(!code.includes(from))throw new Error(`[rop02-control-reference] No se encontró ${label}`);
  return code.replace(from,to);
}

function replaceAnyRequired(code,variants,to,label){
  for(const from of variants){
    if(code.includes(from))return code.replace(from,to);
  }
  throw new Error(`[rop02-control-reference] No se encontró ${label}`);
}

function replaceAllRequired(code,from,to,label,min=1){
  const count=code.split(from).length-1;
  if(count<min)throw new Error(`[rop02-control-reference] Se esperaban al menos ${min} coincidencias de ${label} y se encontraron ${count}`);
  return code.split(from).join(to);
}

export function patchRop02ControlReferenceAndVehicles(code){
  // Los tests locales pueden leer el archivo con CRLF en Windows. El pipeline de
  // Vite ya normaliza saltos de línea, pero este parche también debe ser estable
  // cuando se invoca de forma aislada.
  let next=String(code||"").replace(/\r\n/g,"\n");

  if(!next.includes(IMPORT_LINE)){
    next=replaceRequired(next,IMPORT_ANCHOR,`${IMPORT_ANCHOR}\n${IMPORT_LINE}`,"el ancla de importación del Control ROP02");
  }

  // Turno Noche puede venir como "TN", "Turno Noche" o "Noche". El código
  // anterior sólo reconocía la palabra NOCHE y por eso podía tomar TD como
  // referencia aun cuando existía TN.
  next=replaceAllRequired(
    next,
    'const turnoKey=(r.turno||"").toUpperCase().includes("NOCHE")?"TN":"TD";',
    'const turnoKey=rop02ControlTurnoKey(r.turno);',
    "la clasificación TD/TN por registro",
    2,
  );
  next=replaceRequired(
    next,
    'const turnoOrden=r=>(String(r?.turno||"").toUpperCase().includes("NOCHE")?1:0);',
    'const turnoOrden=r=>rop02ControlTurnoOrder(r?.turno);',
    "el orden TD/TN para continuidad de horómetro",
  );
  next=replaceRequired(
    next,
    'const turnoKey=r=>String(r?.turno||"").toUpperCase().includes("NOCHE")?"TN":"TD";',
    'const turnoKey=r=>rop02ControlTurnoKey(r?.turno);',
    "la clasificación TD/TN del detalle por equipo",
  );

  // El plugin de separación Camiones/Camionetas corre antes y convierte varios
  // universos a isRop02HourlyEquipment(). Aceptamos ambos estados del source para
  // que este parche sea componible y amplíe sólo Control ROP02 con vehículos.
  next=replaceAnyRequired(
    next,
    [
      'function ControlDeErrores({rop02All,extState,setExtState}){\n  const rop02Prod=useMemo(()=>rop02All.filter(r=>!r._excluded),[rop02All]);',
      'function ControlDeErrores({rop02All,extState,setExtState}){\n  const rop02Prod=useMemo(()=>rop02All.filter(r=>isRop02HourlyEquipment(r)),[rop02All]);',
    ],
    'function ControlDeErrores({rop02All,extState,setExtState}){\n  const rop02Prod=useMemo(()=>rop02All.filter(r=>(typeof isRop02HourlyEquipment==="function"&&isRop02HourlyEquipment(r))||rop02ControlRowEligible(r)),[rop02All]);',
    "el universo del Control de errores",
  );
  next=replaceAnyRequired(
    next,
    [
      'function ControlPorEquipo({rop02All,extState,setExtState}){\n  const rop02Prod=useMemo(()=>rop02All.filter(r=>!r._excluded),[rop02All]);',
      'function ControlPorEquipo({rop02All,extState,setExtState}){\n  const rop02Prod=useMemo(()=>rop02All.filter(r=>isRop02HourlyEquipment(r)),[rop02All]);',
    ],
    'function ControlPorEquipo({rop02All,extState,setExtState}){\n  const rop02Prod=useMemo(()=>rop02All.filter(r=>(typeof isRop02HourlyEquipment==="function"&&isRop02HourlyEquipment(r))||rop02ControlRowEligible(r)),[rop02All]);',
    "el universo del Control por Equipo",
  );

  // CAA-0002 estaba excluido explícitamente por código en el source base. Si el
  // plugin de separación de camiones ya corrió, ese bloque puede haber desaparecido;
  // en ese caso no hay nada que reemplazar aquí.
  const legacyCaaCount=next.split(LEGACY_CAA_EXCLUSION).length-1;
  if(legacyCaaCount){
    if(legacyCaaCount<2)throw new Error(`[rop02-control-reference] Se esperaban 2 exclusiones legacy de CAA-0002 y se encontró ${legacyCaaCount}`);
    next=next.split(LEGACY_CAA_EXCLUSION).join('  const rop02ControlRows=rop02Prod;');
  }

  next=replaceRequired(
    next,
    'const rop02ControlTipo=useMemo(()=>rop02ControlRows.filter(row=>dmMatchTipoMaquinaSeleccion(row.maquina,tipoMaquina)),[rop02ControlRows,tipoMaquina]);',
    'const rop02ControlTipo=useMemo(()=>rop02ControlRows.filter(row=>rop02ControlTipoMatches(row.maquina,tipoMaquina,dmMatchTipoMaquinaSeleccion)),[rop02ControlRows,tipoMaquina]);',
    "el filtro de tipo del Control de errores",
  );
  next=replaceRequired(
    next,
    'const rop02ControlTipo=useMemo(()=>rop02ControlRows.filter(r=>dmMatchTipoMaquinaSeleccion(r.maquina,tipoMaquina)),[rop02ControlRows,tipoMaquina]);',
    'const rop02ControlTipo=useMemo(()=>rop02ControlRows.filter(r=>rop02ControlTipoMatches(r.maquina,tipoMaquina,dmMatchTipoMaquinaSeleccion)),[rop02ControlRows,tipoMaquina]);',
    "el filtro de tipo del Control por Equipo",
  );
  next=next.split('dmMatchTipoMaquinaSeleccion(error.maquina,tipoMaquina)').join('rop02ControlTipoMatches(error.maquina,tipoMaquina,dmMatchTipoMaquinaSeleccion)');

  next=replaceRequired(
    next,
    '<MultiSel label="Tipo de Máquina" value={tipoMaquina} onChange={value=>{set("tipoMaquina",value);set("maquina","todas");}} options={dmTipoMaquinaOptions()}/>',
    '<MultiSel label="Tipo de Máquina" value={tipoMaquina} onChange={value=>{set("tipoMaquina",value);set("maquina","todas");}} options={rop02ControlTipoOptions(dmTipoMaquinaOptions())}/>',
    "las opciones de tipo del Control de errores",
  );
  next=replaceRequired(
    next,
    '<MultiSel label="Tipo de Máquina" value={tipoMaquina} onChange={v=>{set("tipoMaquina",v);setMaquina("todas");setFechaSel("");}} options={dmTipoMaquinaOptions()}/>',
    '<MultiSel label="Tipo de Máquina" value={tipoMaquina} onChange={v=>{set("tipoMaquina",v);setMaquina("todas");setFechaSel("");}} options={rop02ControlTipoOptions(dmTipoMaquinaOptions())}/>',
    "las opciones de tipo del Control por Equipo",
  );

  return next;
}

export function rop02ControlLastShiftVehiclesVitePlugin(){
  return{
    name:"delta-rop02-control-last-shift-vehicles",
    enforce:"pre",
    transform(code,id){
      const file=normalizeId(id);
      if(!file.endsWith("/src/modules/oficina-tecnica/OficinaTecnicaModule.jsx"))return null;
      return{code:patchRop02ControlReferenceAndVehicles(code),map:null};
    },
  };
}
