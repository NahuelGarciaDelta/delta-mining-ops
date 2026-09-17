const normalizeId=id=>String(id||"").replace(/\\/g,"/").split("?")[0];

const ANALYTICS_FILE="/src/modules/analytics/ViewCambiosTurnoEnhanced.jsx";
const OFFICE_FILE="/src/modules/oficina-tecnica/OficinaTecnicaModule.jsx";

function requiredReplace(source,from,to,label){
  if(!source.includes(from))throw new Error(`[delta-rop02-daily-control] No se encontró el ancla requerida: ${label}`);
  return source.replace(from,to);
}

function requiredReplaceAll(source,from,to,label,minCount=1){
  const count=source.split(from).length-1;
  if(count<minCount)throw new Error(`[delta-rop02-daily-control] Se esperaban al menos ${minCount} coincidencias para ${label} y se encontraron ${count}`);
  return source.split(from).join(to);
}

function transformAnalytics(code){
  let out=code;
  out=requiredReplace(
    out,
    'import {getMonthlyCutoffRange} from "./monthlyCutoffRange.js";',
    'import {getMonthlyCutoffRange} from "./monthlyCutoffRange.js";\nimport {buildRop02DailyControlRows} from "../../shared/rop02ControlRules.js";',
    "import de reglas del control diario"
  );

  const oldDaily=' const controlDiarioBase=useMemo(()=>{if(!fechaDiaria)return[];const anterior=dayBefore(fechaDiaria),byEquipo=new Map();(rop02All||[]).forEach(row=>{const fecha=normDate(row.fecha),maquina=clean(row.maquina||row._internoRaw);if(fecha!==anterior||!maquina||excluded(row,maquina,deps))return;const codigo=deps.canonicalEquivalentMachineCode?.(maquina)||maquina,entry=byEquipo.get(codigo)||{key:codigo,maquina,equipo:machineType(row,deps),proyecto:row.proyecto||"",anterior:[]};entry.anterior.push(row);byEquipo.set(codigo,entry);});return [...byEquipo.values()].map(entry=>{const referencia=shiftRecord(entry.anterior,"TD"),referenciaIdentidad=referencia||entry.anterior[0];return{key:entry.key,maquina:clean(referenciaIdentidad?.maquina||referenciaIdentidad?._internoRaw||entry.maquina),equipo:machineType(referenciaIdentidad,deps)||entry.equipo,proyecto:referenciaIdentidad?.proyecto||entry.proyecto,referencia,esperado:{turno:"TD",parte:Number.isFinite(partNumber(referencia))?partNumber(referencia)+1:null,hi:finalHour(referencia)}};}).sort((left,right)=>left.maquina.localeCompare(right.maquina)||left.proyecto.localeCompare(right.proyecto));},[rop02All,fechaDiaria,deps]);';
  const newDaily=' const controlDiarioBase=useMemo(()=>buildRop02DailyControlRows(rop02All,fechaDiaria,{normalizeDate:normDate,cleanMachine:clean,canonicalCode:maquina=>deps.canonicalEquivalentMachineCode?.(maquina)||maquina,machineType:row=>machineType(row,deps)}),[rop02All,fechaDiaria,deps]);';
  out=requiredReplace(out,oldDaily,newDaily,"prioridad TN y universo del control diario");

  out=requiredReplace(
    out,
    ' const dailyTipos=useMemo(()=>[...new Set(controlDiarioBase.filter(row=>matches(row.proyecto,dailyProyecto,"todos")).map(row=>row.equipo).filter(Boolean))].sort(),[controlDiarioBase,dailyProyecto]);',
    ' const dailyTipos=useMemo(()=>[...new Set(controlDiarioBase.filter(row=>matches(row.proyecto,dailyProyecto,"todos")).map(row=>row.tipoControl||row.equipo).filter(Boolean))].sort(),[controlDiarioBase,dailyProyecto]);',
    "categorías Camiones/Camionetas en filtro diario"
  );
  out=requiredReplace(
    out,
    ' const dailyEquipos=useMemo(()=>[...new Set(controlDiarioBase.filter(row=>matches(row.proyecto,dailyProyecto,"todos")&&matches(row.equipo,dailyTipo,"todos")).map(row=>row.maquina).filter(Boolean))].sort(),[controlDiarioBase,dailyProyecto,dailyTipo]);',
    ' const dailyEquipos=useMemo(()=>[...new Set(controlDiarioBase.filter(row=>matches(row.proyecto,dailyProyecto,"todos")&&matches(row.tipoControl||row.equipo,dailyTipo,"todos")).map(row=>row.maquina).filter(Boolean))].sort(),[controlDiarioBase,dailyProyecto,dailyTipo]);',
    "equipos por tipo de control diario"
  );
  out=requiredReplace(
    out,
    ' const controlDiario=useMemo(()=>controlDiarioBase.filter(row=>matches(row.proyecto,dailyProyecto,"todos")&&matches(row.equipo,dailyTipo,"todos")&&matches(row.maquina,dailyEquipo,"todas")),[controlDiarioBase,dailyProyecto,dailyTipo,dailyEquipo]);',
    ' const controlDiario=useMemo(()=>controlDiarioBase.filter(row=>matches(row.proyecto,dailyProyecto,"todos")&&matches(row.tipoControl||row.equipo,dailyTipo,"todos")&&matches(row.maquina,dailyEquipo,"todas")),[controlDiarioBase,dailyProyecto,dailyTipo,dailyEquipo]);',
    "filtro de tipo del control diario"
  );
  return out;
}

function transformOffice(code){
  let out=code;
  out=requiredReplace(
    out,
    'import {detectRop02DuplicateLoads} from "./rop02DuplicateLoads.js";',
    'import {detectRop02DuplicateLoads} from "./rop02DuplicateLoads.js";\nimport {normalizeRop02Shift,shouldIncludeRop02ErrorControlRow} from "../../shared/rop02ControlRules.js";',
    "import de reglas ROP02"
  );

  const marker='function ControlDeErrores({rop02All,extState,setExtState}){\n  const rop02Prod=useMemo(()=>rop02All.filter(r=>isRop02HourlyEquipment(r)),[rop02All]);';
  out=requiredReplace(
    out,
    marker,
    'function ControlDeErrores({rop02All,extState,setExtState}){\n  const rop02Prod=useMemo(()=>rop02All.filter(r=>shouldIncludeRop02ErrorControlRow(r,isRop02HourlyEquipment)),[rop02All]);',
    "camionetas en Control de errores desde 12/09/2026"
  );

  out=requiredReplaceAll(
    out,
    'const turnoKey=(r.turno||"").toUpperCase().includes("NOCHE")?"TN":"TD";',
    'const turnoKey=normalizeRop02Shift(r);',
    "normalización TD/TN",
    2
  );
  out=requiredReplace(
    out,
    'const turnoOrden=r=>(String(r?.turno||"").toUpperCase().includes("NOCHE")?1:0);',
    'const turnoOrden=r=>(normalizeRop02Shift(r)==="TN"?1:0);',
    "prioridad TN en continuidad"
  );

  if(out.includes('normalizeMachineCode(m)!=="CAA-0002"')||out.includes('normalizeMachineCode(machine)==="CAA-0002"')){
    throw new Error("[delta-rop02-daily-control] CAA-0002 continúa excluido específicamente en controles ROP02");
  }
  return out;
}

export function rop02DailyControlRegressionVitePlugin(){
  return {
    name:"delta-rop02-daily-control-regression",
    enforce:"pre",
    transform(code,id){
      const file=normalizeId(id);
      let next=null;
      if(file.endsWith(ANALYTICS_FILE))next=transformAnalytics(code);
      else if(file.endsWith(OFFICE_FILE))next=transformOffice(code);
      else return null;
      if(next===code)return null;
      return {code:next,map:null};
    }
  };
}
