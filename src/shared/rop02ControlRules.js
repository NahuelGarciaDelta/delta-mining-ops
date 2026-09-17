const stripAccents=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"");

export const ROP02_PICKUP_ERROR_START_DATE="2026-09-12";

export function normalizeRop02Shift(valueOrRow){
  const raw=valueOrRow&&typeof valueOrRow==="object"
    ?(valueOrRow.turno??valueOrRow.Turno??valueOrRow["Turno de trabajo"]??"")
    :valueOrRow;
  const value=stripAccents(raw).trim().toUpperCase();
  if(/(^|\s)TN($|\s)/.test(value)||value.includes("NOCHE"))return "TN";
  if(/(^|\s)TD($|\s)/.test(value)||value.includes("DIA"))return "TD";
  return "TD";
}

export function rop02PartNumber(row){
  const raw=row?.parte??row?.numeroParte??row?.numero_parte??row?.["N° Parte"]??row?.["Nº Parte"];
  if(typeof raw==="number")return Number.isFinite(raw)?raw:null;
  const matches=String(raw??"").match(/\d+/g);
  return matches?Number(matches[matches.length-1]):null;
}

export function rop02FinalHour(row){
  const raw=row?.horometroFinal??row?.horometro_final??row?.hf??row?.HF;
  if(typeof raw==="number")return Number.isFinite(raw)?raw:null;
  const parsed=Number(String(raw??"").trim().replace(/\s/g,"").replace(",","."));
  return Number.isFinite(parsed)?parsed:null;
}

export function rop02ControlType(row,machineType=""){
  const type=stripAccents(machineType||row?.equipo||row?._tipo||row?._tipoVehiculo||row?.familia||"").toUpperCase();
  const code=String(row?.maquina||row?._internoRaw||row?.codigoNuevo||row?.codigo||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
  if(type.includes("CAMIONETA")||code.startsWith("CTA"))return "Camionetas";
  if((type.includes("CAMION")&&!type.includes("CAMIONETA"))||/^(CAC|CAR|CAV|CAT|CAA|CDC)/.test(code))return "Camiones";
  return machineType||row?.equipo||row?._tipo||"";
}

export function isRop02PickupRow(row,machineType=""){
  return rop02ControlType(row,machineType)==="Camionetas";
}

function previousIsoDate(iso){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(iso||"")))return "";
  const d=new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate()-1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function lastShiftRecord(rows,shift){
  return [...(rows||[])]
    .filter(row=>normalizeRop02Shift(row)===shift)
    .sort((a,b)=>(rop02PartNumber(a)??-Infinity)-(rop02PartNumber(b)??-Infinity))
    .at(-1)||null;
}

export function buildRop02DailyControlRows(rows,selectedDate,options={}){
  if(!selectedDate)return[];
  const previousDate=previousIsoDate(selectedDate);
  const normalizeDate=options.normalizeDate||((value)=>String(value||"").slice(0,10));
  const cleanMachine=options.cleanMachine||((value)=>String(value||"").trim().toUpperCase());
  const canonicalCode=options.canonicalCode||((value)=>value);
  const machineType=options.machineType||((row)=>row?.equipo||row?._tipo||"");
  const byEquipmentProject=new Map();

  for(const row of rows||[]){
    if(normalizeDate(row?.fecha)!==previousDate)continue;
    const machine=cleanMachine(row?.maquina||row?._internoRaw||"");
    if(!machine)continue;
    const project=String(row?.proyecto||"").trim();
    const canonical=canonicalCode(machine)||machine;
    const key=`${canonical}|${project.toUpperCase()}`;
    const entry=byEquipmentProject.get(key)||{
      key,
      maquina:machine,
      equipo:machineType(row)||"",
      tipoControl:rop02ControlType(row,machineType(row)||""),
      proyecto:project,
      anterior:[]
    };
    entry.anterior.push(row);
    byEquipmentProject.set(key,entry);
  }

  return [...byEquipmentProject.values()].map(entry=>{
    const reference=lastShiftRecord(entry.anterior,"TN")||lastShiftRecord(entry.anterior,"TD")||entry.anterior.at(-1)||null;
    const identity=reference||entry.anterior[0];
    const part=rop02PartNumber(reference);
    return {
      key:entry.key,
      maquina:cleanMachine(identity?.maquina||identity?._internoRaw||entry.maquina),
      equipo:machineType(identity)||entry.equipo,
      tipoControl:rop02ControlType(identity,machineType(identity)||entry.equipo),
      proyecto:identity?.proyecto||entry.proyecto,
      referencia:reference,
      esperado:{
        turno:"TD",
        parte:Number.isFinite(part)?part+1:null,
        hi:rop02FinalHour(reference)
      }
    };
  }).sort((a,b)=>a.maquina.localeCompare(b.maquina)||a.proyecto.localeCompare(b.proyecto));
}

export function shouldIncludeRop02ErrorControlRow(row,isHourlyEquipment=()=>true){
  const type=rop02ControlType(row,row?.equipo||row?._tipo||row?._tipoVehiculo||row?.familia||"");
  if(type==="Camionetas")return String(row?.fecha||"").slice(0,10)>=ROP02_PICKUP_ERROR_START_DATE;
  return Boolean(isHourlyEquipment(row));
}
