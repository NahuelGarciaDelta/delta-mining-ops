import { gestionHumanaVehicleType, isOperatingRecord } from "./gestionHumanaData.js";

// Ranking horario: no comparte esta regla con las vistas "Operadores en sitio"
// e "Historial", donde las camionetas deben continuar visibles.
// Las máquinas viales se reconocen por la familia y por prefijos inequívocos.
const ROAD_EQUIPMENT_TYPES=[
  "EXCAVAD", "TOPADOR", "MOTONIVELADOR", "CARGADOR FRONTAL",
  "CARGADORA FRONTAL", "PALA CARGADORA", "RETROPALA",
  "RETROEXCAVAD", "MINICARGADOR", "VIBROCOMPACT",
  "COMPACTADOR", "RODILLO", "BULLDOZER", "TRACTOR ORUGA",
];
const ROAD_CODE=/^(?:EXC|PCA|CFN|TOP|MOT|RTP|RPC|ROD|MNC|MCA)[0-9]/;
const PICKUP_CODE=/^CTA[0-9]/;
const NON_HOURLY_UNIT=/^(?:KM|KMS|KILOMETROS?|M2|M3|METROS?|LITROS?)$/;

function plain(value){
  return String(value??"").normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"").trim().toUpperCase();
}

/**
 * Sólo camiones y equipos viales con medidas en horas.
 * Vehículos _excluded=true pueden ser camiones; isOperatingRecord ya maneja
 * esa distinción. CAA-0002 continúa excluido como en Gestión Humana.
 * Familia/tipo validado tiene prioridad sobre prefijos para evitar generadores,
 * camionetas o unidades facturadas por km.
 */
export function isHourlyRankingRecord(row){
  if(!isOperatingRecord(row))return false;
  const number=Number(row.horas);
  if(!Number.isFinite(number)||number<0)return false;

  const unit=plain(row.unidad??row.unidadMedida??row.unidad_medida??row._unidad??row.medida??"")
    .replace(/[^A-Z0-9]/g,"");
  if(NON_HOURLY_UNIT.test(unit))return false;

  const code=plain(row.maquina??row._internoRaw??"").replace(/[^A-Z0-9]/g,"");
  if(code==="CAA0002"||code==="CAA0002JM"||PICKUP_CODE.test(code))return false;
  const tipo=[row.tipoEquipo,row._tipo,row.equipo,row.familia]
    .map(plain).filter(Boolean).join(" ");
  if(/CAMIONETA|PICK.?UP|UTILITARIO|VEHICULO LIVIANO/.test(tipo))return false;
  const vehicleType=gestionHumanaVehicleType(row);
  if(vehicleType==="CAMIONETAS")return false;
  if(vehicleType==="CAMIONES")return true;
  // Si conocemos la familia, priorizamos tipología vial inequívoca.
  if(ROAD_EQUIPMENT_TYPES.some(token=>tipo.includes(token)))return true;
  // No clasificar generadores, oficinas ni equipos auxiliares como viales.
  if(/GENERADOR|ELECTROGENO|PREDIO|OFICINA|TALLER|OXICORTE|PERTIGA/.test(tipo))return false;
  // Fallback de código para partes históricos sin familia/catálogo.
  return ROAD_CODE.test(code);
}

/** Resultados únicos del mismo universo filtrado para KPI, Top 15 y Excel. */
export function buildHourlyOperatorRanking(rows=[]){
  const byOperator=new Map();
  for(const row of rows||[]){
    if(!isHourlyRankingRecord(row))continue;
    const key=String(row.operario||"").trim();
    if(!key)continue;
    let item=byOperator.get(key);
    if(!item){
      item={operario:key,horas:0,proyectos:new Set(),maquinas:new Set(),dias:new Set()};
      byOperator.set(key,item);
    }
    item.horas+=Number(row.horas);
    if(row.proyecto)item.proyectos.add(row.proyecto);
    if(row.maquina)item.maquinas.add(row.maquina);
    if(row.fecha)item.dias.add(row.fecha);
  }
  return [...byOperator.values()].map(item=>({
    operario:item.operario,
    horas:item.horas,
    proyectos:[...item.proyectos].join(" / "),
    maquinas:[...item.maquinas].sort().join(", "),
    diasTrabajados:item.dias.size,
    promHsDia:item.dias.size>0?Math.round(item.horas/item.dias.size*10)/10:0,
  })).sort((a,b)=>b.horas-a.horas||a.operario.localeCompare(b.operario));
}
