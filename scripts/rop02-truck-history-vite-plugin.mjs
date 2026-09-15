const normalizeId=id=>String(id||"").replace(/\\/g,"/").split("?")[0];

const OFFICE_FILE="/src/modules/oficina-tecnica/OficinaTecnicaModule.jsx";

function requiredReplace(source,from,to,label){
  if(!source.includes(from))throw new Error(`[delta-rop02-truck-history] No se encontró el ancla requerida: ${label}`);
  return source.replace(from,to);
}

function transformOffice(code){
  let out=code;

  out=requiredReplace(
    out,
    'function isRop02TruckRow(row){return rop02VehicleKind(row)==="camiones";}\nfunction isRop02HourlyEquipment(row){',
    `function isRop02TruckRow(row){return rop02VehicleKind(row)==="camiones";}\nfunction isRop02TruckControlEligible(row){\n  if(!row||!isRop02TruckRow(row))return true;\n  const fecha=typeof normDate==="function"?normDate(row.fecha||""):String(row.fecha||"").slice(0,10);\n  return !(fecha>="2026-05-01"&&fecha<="2026-08-31");\n}\nfunction isRop02HourlyEquipment(row){`,
    "ventana histórica de control de camiones"
  );

  out=requiredReplace(
    out,
    '  // Camiones se controlan como equipos por hora; camionetas continúan separadas por km.\n  const rop02Prod=useMemo(()=>rop02All.filter(r=>isRop02HourlyEquipment(r)),[rop02All]);',
    '  // Equipos muestra solo maquinaria vial. Los camiones quedan exclusivamente en su pestaña dedicada.\n  const rop02Prod=useMemo(()=>rop02All.filter(r=>isRop02HourlyEquipment(r)&&!isRop02TruckRow(r)),[rop02All]);',
    "exclusión de camiones de la pestaña Equipos"
  );

  out=requiredReplace(
    out,
    'const rows=(await onRemoteExport()).filter(r=>isRop02HourlyEquipment(r))',
    'const rows=(await onRemoteExport()).filter(r=>isRop02HourlyEquipment(r)&&!isRop02TruckRow(r))',
    "exportación Equipos sin camiones"
  );

  out=requiredReplace(
    out,
    '  const control=useMemo(()=>calcularErroresControlEquipo(filtered),[filtered]);',
    '  const control=useMemo(()=>calcularErroresControlEquipo(filtered.filter(isRop02TruckControlEligible)),[filtered]);',
    "errores históricos de camiones"
  );

  out=requiredReplace(
    out,
    '  const controlIntegridad=useMemo(()=>calcularErroresControlEquipo(filtered),[filtered]);',
    '  const controlIntegridad=useMemo(()=>calcularErroresControlEquipo(filtered.filter(isRop02TruckControlEligible)),[filtered]);',
    "control por equipo histórico de camiones"
  );

  out=requiredReplace(
    out,
    '  const rop02Prod=useMemo(()=>atrasoSource.filter(r=>isRop02HourlyEquipment(r)&&r.fecha),[atrasoSource]);',
    '  const rop02Prod=useMemo(()=>atrasoSource.filter(r=>isRop02HourlyEquipment(r)&&isRop02TruckControlEligible(r)&&r.fecha),[atrasoSource]);',
    "atraso histórico de camiones"
  );

  out=requiredReplace(
    out,
    '  const erroresAceptadosTabla=useMemo(()=>erroresAceptados.filter(error=>{\n    if(!matchMulti(error.proyecto,proyecto,"todos"))return false;',
    '  const erroresAceptadosTabla=useMemo(()=>erroresAceptados.filter(error=>{\n    if(!isRop02TruckControlEligible(error))return false;\n    if(!matchMulti(error.proyecto,proyecto,"todos"))return false;',
    "aceptaciones históricas de camiones"
  );

  if(!out.includes('filtered.filter(isRop02TruckControlEligible)')||!out.includes('isRop02HourlyEquipment(r)&&!isRop02TruckRow(r)')){
    throw new Error("[delta-rop02-truck-history] Integración incompleta");
  }
  return out;
}

export function rop02TruckHistoryVitePlugin(){
  return {
    name:"delta-rop02-truck-history",
    enforce:"pre",
    transform(code,id){
      const file=normalizeId(id);
      if(!file.endsWith(OFFICE_FILE))return null;
      const next=transformOffice(code);
      if(next===code)return null;
      return {code:next,map:null};
    }
  };
}
