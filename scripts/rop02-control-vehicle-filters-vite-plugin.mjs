const normalizeId=id=>String(id||"").replace(/\\/g,"/").split("?")[0];

const ANALYTICS_FILE="/src/modules/analytics/ViewCambiosTurnoEnhanced.jsx";
const OFFICE_FILE="/src/modules/oficina-tecnica/OficinaTecnicaModule.jsx";

function requiredReplace(source,from,to,label){
  if(!source.includes(from))throw new Error(`[delta-rop02-control-vehicle-filters] No se encontró el ancla requerida: ${label}`);
  return source.replace(from,to);
}

function requiredReplaceAll(source,from,to,label,minCount=1){
  const count=source.split(from).length-1;
  if(count<minCount)throw new Error(`[delta-rop02-control-vehicle-filters] Se esperaban al menos ${minCount} coincidencias para ${label} y se encontraron ${count}`);
  return source.split(from).join(to);
}

function transformAnalytics(code){
  let out=code;
  const machineTypeAnchor='const machineType=(r,deps)=>r.equipo||r._tipo||deps?.getMachineType?.(r.maquina||r._internoRaw||"")||"";';
  const helpers=`${machineTypeAnchor}\nconst monthlyControlVehicleKind=(row,deps)=>{\n  const type=String(machineType(row,deps)||"").normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toUpperCase();\n  const raw=String(row?.maquina||row?._internoRaw||"").trim().toUpperCase();\n  const compact=raw.replace(/[^A-Z0-9]/g,"");\n  if(type.includes("CAMIONETA")||compact.startsWith("CTA"))return "camionetas";\n  if((type.includes("CAMION")&&!type.includes("CAMIONETA"))||/^(CAA|CAC|CAR|CAV|CAT|CDC)/.test(compact))return "camiones";\n  return "";\n};\nconst monthlyControlType=(row,deps)=>{const kind=monthlyControlVehicleKind(row,deps);return kind==="camiones"?"Camiones":kind==="camionetas"?"Camionetas":machineType(row,deps);};`;
  out=requiredReplace(out,machineTypeAnchor,helpers,"helpers de vehículos en Control de horas mensuales");

  out=requiredReplace(
    out,
    ' const base=useMemo(()=>(rop02All||[]).filter(r=>{const f=normDate(r.fecha),m=clean(r.maquina||r._internoRaw);return f&&f>=rango.desde&&f<=rango.hasta&&m&&!excluded(r,m,deps);}),[rop02All,rango.desde,rango.hasta,deps]);',
    ' const base=useMemo(()=>(rop02All||[]).filter(r=>{const f=normDate(r.fecha),m=clean(r.maquina||r._internoRaw);return f&&f>=rango.desde&&f<=rango.hasta&&m&&(!excluded(r,m,deps)||Boolean(monthlyControlVehicleKind(r,deps)));}),[rop02All,rango.desde,rango.hasta,deps]);',
    "universo con camiones y camionetas en Control de horas mensuales"
  );
  out=requiredReplace(
    out,
    ' const tipos=useMemo(()=>[...new Set(base.filter(r=>matches(r.proyecto,proyecto,"todos")).map(r=>machineType(r,deps)).filter(Boolean))].sort(),[base,proyecto,deps]);',
    ' const tipos=useMemo(()=>[...new Set(base.filter(r=>matches(r.proyecto,proyecto,"todos")).map(r=>monthlyControlType(r,deps)).filter(Boolean))].sort(),[base,proyecto,deps]);',
    "tipos agregados Camiones/Camionetas en Control de horas mensuales"
  );
  out=requiredReplace(
    out,
    ' const equipos=useMemo(()=>[...new Set(base.filter(r=>matches(r.proyecto,proyecto,"todos")&&matches(machineType(r,deps),tipo,"todos")).map(r=>clean(r.maquina||r._internoRaw)).filter(Boolean))].sort(),[base,proyecto,tipo,deps]);',
    ' const equipos=useMemo(()=>[...new Set(base.filter(r=>matches(r.proyecto,proyecto,"todos")&&matches(monthlyControlType(r,deps),tipo,"todos")).map(r=>clean(r.maquina||r._internoRaw)).filter(Boolean))].sort(),[base,proyecto,tipo,deps]);',
    "equipos de vehículos en filtro mensual"
  );
  out=requiredReplace(
    out,
    ' const filtered=useMemo(()=>base.filter(r=>matches(r.proyecto,proyecto,"todos")&&matches(machineType(r,deps),tipo,"todos")&&matches(clean(r.maquina||r._internoRaw),equipo,"todas")),[base,proyecto,tipo,equipo,deps]);',
    ' const filtered=useMemo(()=>base.filter(r=>matches(r.proyecto,proyecto,"todos")&&matches(monthlyControlType(r,deps),tipo,"todos")&&matches(clean(r.maquina||r._internoRaw),equipo,"todas")),[base,proyecto,tipo,equipo,deps]);',
    "aplicación del filtro mensual de vehículos"
  );
  out=requiredReplace(
    out,
    'Análisis sin camionetas ni camiones. Período:',
    'Análisis de equipos, camiones y camionetas. Período:',
    "texto del universo mensual"
  );

  if(!out.includes('monthlyControlType(r,deps)')||!out.includes('"Camiones"')||!out.includes('"Camionetas"')){
    throw new Error("[delta-rop02-control-vehicle-filters] Control de horas mensuales quedó sin filtros de vehículos");
  }
  return out;
}

function officeHelpers(){
  return `
function rop02VehicleFilterKind(value){
  const row=value&&typeof value==="object"?value:{maquina:value};
  if(typeof rop02VehicleKind==="function"){
    const direct=rop02VehicleKind(row);
    if(direct)return direct;
  }
  const rawType=String(row?._tipoVehiculo||row?.familia||row?._tipo||row?.equipo||row?.tipoEquipo||row?.["Tipo de Máquina"]||"")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();
  const rawCode=String(row?.maquina||row?._internoRaw||row?.codigoNuevo||row?.codigo||value||"").trim().toUpperCase();
  const compact=rawCode.replace(/[^A-Z0-9]/g,"");
  if(rawType.includes("CAMIONETA")||compact.startsWith("CTA"))return "camionetas";
  if((rawType.includes("CAMION")&&!rawType.includes("CAMIONETA"))||/^(CAA|CAC|CAR|CAV|CAT|CDC)/.test(compact))return "camiones";
  return "";
}
function rop02TipoValues(selected){return Array.isArray(selected)?selected:[selected];}
function rop02TipoIsAll(selected){return multiIsAll(selected,"todas")||multiIsAll(selected,"todos");}
function rop02IsVehicleTipoValue(value){const v=String(value||"").trim().toLowerCase();return v==="camiones"||v==="camionetas";}
function rop02MatchesDmTipoConVehiculos(value,selected){
  if(rop02TipoIsAll(selected))return true;
  const values=rop02TipoValues(selected).filter(Boolean);
  const kind=rop02VehicleFilterKind(value);
  if(values.some(v=>String(v).trim().toLowerCase()===kind))return true;
  const machine=typeof value==="object"?(value?.maquina||value?._internoRaw||""):value;
  return values.filter(v=>!rop02IsVehicleTipoValue(v)).some(v=>dmMatchTipoMaquinaSeleccion(machine,v));
}
function rop02MatchesRop05TipoConVehiculos(value,selected){
  if(rop02TipoIsAll(selected))return true;
  const values=rop02TipoValues(selected).filter(Boolean);
  const kind=rop02VehicleFilterKind(value);
  if(values.some(v=>String(v).trim().toLowerCase()===kind))return true;
  const machine=typeof value==="object"?(value?.maquina||value?._internoRaw||""):value;
  return values.filter(v=>!rop02IsVehicleTipoValue(v)).some(v=>tipoMatchMachineROP05(v,machine));
}
function rop02TipoMaquinaOptionsConVehiculos(){
  const base=typeof dmTipoMaquinaOptions==="function"?[...dmTipoMaquinaOptions()]:[{value:"todas",label:"Todas"}];
  const seen=new Set(base.map(option=>String(option?.value||"").trim().toLowerCase()));
  if(!seen.has("camiones"))base.push({value:"camiones",label:"Camiones"});
  if(!seen.has("camionetas"))base.push({value:"camionetas",label:"Camionetas"});
  return base;
}
`;
}

function transformControlErrores(out){
  const startMarker='function ControlDeErrores({rop02All,extState,setExtState}){';
  const endMarker='// ─── ControlPorEquipo';
  const start=out.indexOf(startMarker);
  const end=start>=0?out.indexOf(endMarker,start):-1;
  if(start<0||end<0)throw new Error("[delta-rop02-control-vehicle-filters] No se pudo aislar ControlDeErrores");
  let segment=out.slice(start,end);
  segment=requiredReplace(
    segment,
    'const rop02ControlTipo=useMemo(()=>rop02ControlRows.filter(row=>dmMatchTipoMaquinaSeleccion(row.maquina,tipoMaquina)),[rop02ControlRows,tipoMaquina]);',
    'const rop02ControlTipo=useMemo(()=>rop02ControlRows.filter(row=>rop02MatchesDmTipoConVehiculos(row,tipoMaquina)),[rop02ControlRows,tipoMaquina]);',
    "matcher de tipo en Control de errores"
  );
  segment=requiredReplace(
    segment,
    'if(!dmMatchTipoMaquinaSeleccion(error.maquina,tipoMaquina))return false;',
    'if(!rop02MatchesDmTipoConVehiculos(error,tipoMaquina))return false;',
    "matcher de aceptados en Control de errores"
  );
  segment=requiredReplace(
    segment,
    'options={dmTipoMaquinaOptions()}',
    'options={rop02TipoMaquinaOptionsConVehiculos()}',
    "opciones Camiones/Camionetas en Control de errores"
  );
  return out.slice(0,start)+segment+out.slice(end);
}

function transformAtraso(out){
  out=requiredReplace(
    out,
    'if(!multiIsAll(tipoMaquinaFiltro,"todas")&&!tipoMatchMachineROP05(tipoMaquinaFiltro,row.maquina))return false;',
    'if(!rop02MatchesRop05TipoConVehiculos(row,tipoMaquinaFiltro))return false;',
    "matcher principal de tipo en Atraso"
  );
  out=requiredReplace(
    out,
    '.filter(r=>multiIsAll(tipoMaquinaFiltro,"todas")||tipoMatchMachineROP05(tipoMaquinaFiltro,r.maquina))',
    '.filter(r=>rop02MatchesRop05TipoConVehiculos(r,tipoMaquinaFiltro))',
    "proyectos por tipo en Atraso"
  );
  out=requiredReplace(
    out,
    '.filter(r=>(multiIsAll(tipoMaquinaFiltro,"todas")||tipoMatchMachineROP05(tipoMaquinaFiltro,r.maquina))&&matchMulti(r.proyecto,proyectoFiltro,"todos"))',
    '.filter(r=>rop02MatchesRop05TipoConVehiculos(r,tipoMaquinaFiltro)&&matchMulti(r.proyecto,proyectoFiltro,"todos"))',
    "máquinas por tipo en Atraso"
  );
  const oldUi='<MultiSel label="Tipo de Máquina" value={tipoMaquinaFiltro} onChange={v=>{setTipoMaquinaFiltro(v);setProyectoFiltro("todos");setMaquinaFiltro("todas");}} options={ROP05_TIPOS_MAQUINA.map(t=>({value:t.value,label:t.label}))}/>';
  const newUi='<MultiSel label="Tipo de Máquina" value={tipoMaquinaFiltro} onChange={v=>{setTipoMaquinaFiltro(v);setProyectoFiltro("todos");setMaquinaFiltro("todas");}} options={rop02TipoMaquinaOptionsConVehiculos()}/>';
  out=requiredReplace(out,oldUi,newUi,"opciones Camiones/Camionetas en Atraso");
  return out;
}

function transformOffice(code){
  let out=code;
  const importAnchor='import {normalizeRop02Shift,shouldIncludeRop02ErrorControlRow} from "../../shared/rop02ControlRules.js";';
  out=requiredReplace(out,importAnchor,importAnchor+officeHelpers(),"helpers de filtros de vehículos en Oficina Técnica");
  out=transformControlErrores(out);
  out=transformAtraso(out);

  if(!out.includes('rop02TipoMaquinaOptionsConVehiculos()')||!out.includes('rop02MatchesRop05TipoConVehiculos(row,tipoMaquinaFiltro)')||!out.includes('rop02MatchesDmTipoConVehiculos(row,tipoMaquina)')){
    throw new Error("[delta-rop02-control-vehicle-filters] Filtros de vehículos incompletos en Oficina Técnica");
  }
  return out;
}

export function rop02ControlVehicleFiltersVitePlugin(){
  return {
    name:"delta-rop02-control-vehicle-filters",
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
