const normalizeId=id=>String(id||"").replace(/\\/g,"/").split("?")[0];

const APP_FILE="/src/App.jsx";
const OFFICE_FILE="/src/modules/oficina-tecnica/OficinaTecnicaModule.jsx";
const SOURCES_FILE="/src/config/viewSources.js";
const ANALYTICS_FILE="/src/modules/analytics/OperationalAnalytics.jsx";

function requiredReplace(source,from,to,label){
  if(!source.includes(from))throw new Error(`[delta-rop02-truck-pickup-split] No se encontró el ancla requerida: ${label}`);
  return source.replace(from,to);
}

function requiredReplaceAll(source,from,to,label,minCount=1){
  const count=source.split(from).length-1;
  if(count<minCount)throw new Error(`[delta-rop02-truck-pickup-split] Se esperaban al menos ${minCount} coincidencias para ${label} y se encontraron ${count}`);
  return source.split(from).join(to);
}

function transformApp(code){
  let out=code;
  out=requiredReplace(
    out,
    '      {id:"vehiculos",icon:"car",label:"Vehículos"},',
    '      {id:"camiones",icon:"truck",label:"Camiones"},\n      {id:"camionetas",icon:"car",label:"Camionetas"},',
    "sidebar Camiones/Camionetas"
  );

  out=requiredReplace(
    out,
    'rop02:"Equipos",horometros:"Horómetros",vehiculos:"Vehículos y Camionetas",controlErrores:',
    'rop02:"Equipos",horometros:"Horómetros",vehiculos:"Vehículos y Camionetas",camiones:"Camiones",camionetas:"Camionetas",controlErrores:',
    "títulos Camiones/Camionetas"
  );

  out=requiredReplace(
    out,
    '    vehiculos:"Mismo reporte que ROP02 (TD/TN, horómetros, km), pero para camiones y camionetas en lugar de máquinas.",',
    '    vehiculos:"Vista histórica combinada de camiones y camionetas.",\n    camiones:"ROP02 exclusivo de camiones. Mantiene la misma interfaz de filtros y registros, usando horas y horómetros como los equipos viales.",\n    camionetas:"ROP02 exclusivo de camionetas. Mantiene la misma interfaz de filtros y registros, usando kilómetros como unidad de operación.",',
    "ayuda Camiones/Camionetas"
  );

  const legacyState='  const[stVeh,setStVeh]=useState(()=>savedOr("stVeh",{mode:"dia",fecha:"",fechaD:"",fechaH:"",vals:{proyecto:"todos",maquina:"todas",supervisor:"todos",operario:"todos"}}));';
  out=requiredReplace(
    out,
    legacyState,
    `${legacyState}\n  const[stCamiones,setStCamiones]=useState(()=>savedOr("stCamiones",savedOr("stVeh",{mode:"dia",fecha:"",fechaD:"",fechaH:"",vals:{proyecto:"todos",maquina:"todas",supervisor:"todos",operario:"todos"}})));\n  const[stCamionetas,setStCamionetas]=useState(()=>savedOr("stCamionetas",savedOr("stVeh",{mode:"dia",fecha:"",fechaD:"",fechaH:"",vals:{proyecto:"todos",maquina:"todas",supervisor:"todos",operario:"todos"}})));`,
    "estados persistentes Camiones/Camionetas"
  );

  out=requiredReplace(
    out,
    '    resetVals(setStVeh);\n    resetVals(setStComb);',
    '    resetVals(setStVeh);\n    resetVals(setStCamiones);\n    resetVals(setStCamionetas);\n    resetVals(setStComb);',
    "reset de proyecto Camiones/Camionetas"
  );

  out=requiredReplace(
    out,
    'sidebarOpen,dashSt,stMant,stCHC,stRanking,navOpen,st02,stHorometros,stVeh,stComb,stControlErrores,stCtrlEquipo,stControlROP02,st05,stCtrl',
    'sidebarOpen,dashSt,stMant,stCHC,stRanking,navOpen,st02,stHorometros,stVeh,stCamiones,stCamionetas,stComb,stControlErrores,stCtrlEquipo,stControlROP02,st05,stCtrl',
    "persistencia de filtros Camiones/Camionetas"
  );
  out=requiredReplace(
    out,
    '[sidebarOpen,dashSt,stMant,stCHC,stRanking,navOpen,st02,stHorometros,stVeh,stComb,stControlErrores,stCtrlEquipo,stControlROP02,st05,stCtrl]',
    '[sidebarOpen,dashSt,stMant,stCHC,stRanking,navOpen,st02,stHorometros,stVeh,stCamiones,stCamionetas,stComb,stControlErrores,stCtrlEquipo,stControlROP02,st05,stCtrl]',
    "dependencias persistencia Camiones/Camionetas"
  );

  out=requiredReplace(
    out,
    'stVeh={stVeh} setStVeh={setStVeh} stControlROP02={stControlROP02}',
    'stVeh={stVeh} setStVeh={setStVeh} stCamiones={stCamiones} setStCamiones={setStCamiones} stCamionetas={stCamionetas} setStCamionetas={setStCamionetas} stControlROP02={stControlROP02}',
    "props Camiones/Camionetas"
  );

  if(!out.includes('"camiones"')||!out.includes('"camionetas"')){
    throw new Error("[delta-rop02-truck-pickup-split] No se pudieron insertar las vistas Camiones/Camionetas en App.jsx");
  }
  out=out.replace(
    '"listaEquipos","tallerCentral","rop02","horometros","vehiculos","controlROP02"',
    '"listaEquipos","tallerCentral","rop02","horometros","vehiculos","camiones","camionetas","controlROP02"'
  );
  if(!out.includes('"camiones","camionetas","controlROP02"')){
    throw new Error("[delta-rop02-truck-pickup-split] No se pudo habilitar el routeo de Camiones/Camionetas");
  }
  return out;
}

function transformViewSources(code){
  return requiredReplace(
    code,
    '  vehiculos:["rop02_fs","rop02_jm","rop02_filosur","rop02_zorro","lista_equipos"],',
    '  vehiculos:["rop02_fs","rop02_jm","rop02_filosur","rop02_zorro","lista_equipos"],\n  camiones:["rop02_fs","rop02_jm","rop02_filosur","rop02_zorro","lista_equipos"],\n  camionetas:["rop02_fs","rop02_jm","rop02_filosur","rop02_zorro","lista_equipos"],',
    "fuentes Camiones/Camionetas"
  );
}

function officeHelpers(){
  return `
function rop02VehicleKind(row){
  if(!row)return "";
  const rawFamily=row._tipoVehiculo||row.familia||row._tipo||row.equipo||row._equipoRaw||"";
  const family=typeof normalizeVehicleFamily==="function"?normalizeVehicleFamily(rawFamily):String(rawFamily||"").toUpperCase();
  const rawCode=row.maquina||row.codigoNuevo||row.codigo||row.codigoViejo||row._internoRaw||"";
  const normalized=typeof normalizeMachineCode==="function"?normalizeMachineCode(rawCode):String(rawCode||"").toUpperCase();
  const compact=String(normalized||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
  if(family.includes("CAMIONETA")||compact.startsWith("CTA"))return "camionetas";
  if((family.includes("CAMION")&&!family.includes("CAMIONETA"))||/^(CAC|CAR|CAV|CAT|CAA)/.test(compact))return "camiones";
  return "";
}
function isRop02TruckRow(row){return rop02VehicleKind(row)==="camiones";}
function isRop02HourlyEquipment(row){
  if(!row)return false;
  const machine=row.maquina||row._internoRaw||"";
  if((typeof isRop02ControlMachineExcluded==="function"&&isRop02ControlMachineExcluded(machine))||(typeof normalizeMachineCode==="function"&&normalizeMachineCode(machine)==="CAA-0002"))return false;
  const kind=rop02VehicleKind(row);
  if(kind==="camionetas")return false;
  if(kind==="camiones")return true;
  return !row._excluded;
}
`;
}

function transformVehicleView(segment){
  let out=segment;
  out=requiredReplace(
    out,
    'function ViewVehiculos({rop02All,listaEquipos,extState,setExtState}){',
    'function ViewVehiculos({rop02All,listaEquipos,extState,setExtState,vehicleKind="todos"}){',
    "parámetro vehicleKind"
  );

  out=requiredReplace(
    out,
    '  const listaInfoIndex=useMemo(()=>buildListaEquipoInfoIndex(listaEquipos),[listaEquipos]);\n  // Solo camionetas y camiones, unificados contra Lista Maestra por Código Nuevo.',
    '  const listaInfoIndex=useMemo(()=>buildListaEquipoInfoIndex(listaEquipos),[listaEquipos]);\n  const esCamiones=vehicleKind==="camiones";\n  const esCamionetas=vehicleKind==="camionetas";\n  const vistaCombinada=vehicleKind==="todos";\n  const singular=esCamiones?"Camión":esCamionetas?"Camioneta":"Vehículo";\n  const plural=esCamiones?"Camiones":esCamionetas?"Camionetas":"Vehículos";\n  const medidaLabel=esCamiones?"Horas":esCamionetas?"Kilómetros":"Km / Hs";\n  const medidaCorta=esCamiones?"hs":esCamionetas?"km":"km/hs";\n  // Solo camionetas o camiones según la pestaña, unificados contra Lista Maestra por Código Nuevo.',
    "configuración de vista por tipo"
  );

  const oldRop=`  const rop02Veh=useMemo(()=>rop02All.filter(r=>r._excluded).map(r=>{
    const hit=getListaVehicleMatch(vehListaIndex,r.maquina);
    if(!hit)return r;
    // Si tiene Código Nuevo se muestra/unifica por Código Nuevo; si no existe, queda identificado por Código Drusila.
    return{...r,maquina:hit.codigoNuevo||hit.codigoViejo||hit.codigo||r.maquina,proyecto:hit.proyecto||r.proyecto,ubicacion:hit.ubicacion||hit.sitioAlquiler||hit.proyecto||r.proyecto,_tipoVehiculo:hit.familia||r._tipo,propiedad:hit.propiedad||String(getValue(hit,["Propiedad","PROPIEDAD","Propietario","Dueño","Dueno","Empresa"])||"")};
  }),[rop02All,vehListaIndex]);`;
  const newRop=`  const rop02Veh=useMemo(()=>rop02All.filter(r=>r._excluded).map(r=>{
    const hit=getListaVehicleMatch(vehListaIndex,r.maquina);
    if(!hit)return r;
    // Si tiene Código Nuevo se muestra/unifica por Código Nuevo; si no existe, queda identificado por Código Drusila.
    return{...r,maquina:hit.codigoNuevo||hit.codigoViejo||hit.codigo||r.maquina,proyecto:hit.proyecto||r.proyecto,ubicacion:hit.ubicacion||hit.sitioAlquiler||hit.proyecto||r.proyecto,_tipoVehiculo:hit.familia||r._tipo,propiedad:hit.propiedad||String(getValue(hit,["Propiedad","PROPIEDAD","Propietario","Dueño","Dueno","Empresa"])||"")};
  }).filter(r=>vistaCombinada||rop02VehicleKind(r)===vehicleKind),[rop02All,vehListaIndex,vehicleKind,vistaCombinada]);

  const fleetTypes=useMemo(()=>{
    const camioneta={img:VEH_CAMIONETA,nombre:"Camioneta",prefijos:["CTA"],matchTipo:(c,f)=>String(f||"").includes("CAMIONETA")||String(c||"").startsWith("CTA")};
    const camiones=[
      {img:VEH_COMBUSTIBLE,nombre:"Camión de Combustible",prefijos:["CAC","CDC"],matchTipo:(c,f)=>String(f||"").includes("COMBUSTIBLE")||String(f||"").includes("CISTERNA")||String(c||"").startsWith("CAC")},
      {img:VEH_VOLCADOR,nombre:"Camión Volcador",prefijos:["CAV"],matchTipo:(c,f)=>String(f||"").includes("VOLCADOR")||String(f||"").includes("VOLQUETE")||String(c||"").startsWith("CAV")},
      {img:VEH_REGADOR,nombre:"Camión Regador",prefijos:["CAR","CAA"],matchTipo:(c,f)=>String(f||"").includes("REGADOR")||String(f||"").includes("RIEGO")||String(c||"").startsWith("CAR")||String(c||"").startsWith("CAA")},
      {img:VEH_TRACTOR,nombre:"Camión Tractor",prefijos:["CAT"],matchTipo:(c,f)=>String(f||"").includes("TRACTOR")||String(c||"").startsWith("CAT")},
    ];
    return vistaCombinada?[camioneta,...camiones]:(esCamiones?camiones:[camioneta]);
  },[esCamiones,vistaCombinada]);`;
  out=requiredReplace(out,oldRop,newRop,"separación de registros de vehículos");

  out=requiredReplace(
    out,
    '    {key:"maquina",label:"Vehículo",render:v=><Badge color={C.teal}>{v}</Badge>},',
    '    {key:"maquina",label:singular,render:v=><Badge color={C.teal}>{v}</Badge>},',
    "columna vehículo"
  );
  out=requiredReplace(
    out,
    '    {key:"horas",label:"Km",render:v=><span style={{color:C.accent,fontWeight:600}}>{fmtNum(v)}</span>},',
    '    {key:"horas",label:esCamiones?"Hs":"Km",render:v=><span style={{color:C.accent,fontWeight:600}}>{fmtNum(v)}</span>},',
    "unidad en tabla de vehículos"
  );
  out=requiredReplace(
    out,
    '<MultiSel label="Vehículo" value={vals.maquina}',
    '<MultiSel label={singular} value={vals.maquina}',
    "filtro vehículo"
  );
  out=requiredReplace(
    out,
    '<StatCard icon="hours" label="Kilómetros" value={fmtNum(stats.horas)} color={C.yellow} small/>',
    '<StatCard icon="hours" label={medidaLabel} value={fmtNum(stats.horas)} color={C.yellow} small/>',
    "KPI unidad vehículos"
  );
  out=requiredReplace(
    out,
    '<StatCard icon="equip" label="Vehículos" value={stats.equipos} color={C.purple} small/>',
    '<StatCard icon="equip" label={plural} value={stats.equipos} color={C.purple} small/>',
    "KPI cantidad vehículos"
  );
  out=requiredReplace(
    out,
    '<Card title="Kilómetros por Fecha">',
    '<Card title={`${medidaLabel} por Fecha`}>',
    "título gráfico vehículos"
  );
  out=requiredReplace(
    out,
    '[fmtNum(rows.reduce((s,r)=>s+r.horas,0)),"km",col],',
    '[fmtNum(rows.reduce((s,r)=>s+r.horas,0)),medidaCorta,col],',
    "unidad resumen por proyecto"
  );
  out=requiredReplace(
    out,
    '[uniq(rows.map(r=>r.maquina)).length,"vehículos",C.purple],',
    '[uniq(rows.map(r=>r.maquina)).length,plural.toLowerCase(),C.purple],',
    "cantidad resumen por proyecto"
  );
  out=requiredReplace(
    out,
    '<Card title={`Registros (${filtered.length})`} action={<BtnExcel onClick={()=>excelFromCols(cols,filteredSorted,"Vehiculos_ROP02")}/>}>',
    '<Card title={`Registros (${filtered.length})`} action={<BtnExcel onClick={()=>excelFromCols(cols,filteredSorted,esCamiones?"Camiones_ROP02":esCamionetas?"Camionetas_ROP02":"Vehiculos_ROP02")}/>}>',
    "nombre exportación vehículos"
  );
  out=requiredReplace(
    out,
    '<Card title="Flota de Vehículos" style={{overflow:"visible"}}>',
    '<Card title={vistaCombinada?"Flota de Vehículos":`Flota de ${plural}`} style={{overflow:"visible"}}>',
    "título flota vehículos"
  );

  const oldFleet=`          {[
            {img:VEH_CAMIONETA, nombre:"Camioneta", prefijos:["CTA"], matchTipo:(c,f)=>String(f||"").includes("CAMIONETA")||String(c||"").startsWith("CTA")},
            {img:VEH_COMBUSTIBLE, nombre:"Camión de Combustible", prefijos:["CDC"], matchTipo:(c,f)=>String(f||"").includes("COMBUSTIBLE")},
            {img:VEH_VOLCADOR, nombre:"Camión Volcador", prefijos:["CAV"], matchTipo:(c,f)=>String(f||"").includes("VOLCADOR")||String(c||"").startsWith("CAV")},
            {img:VEH_REGADOR, nombre:"Camión Regador", prefijos:["CAR","CAA"], matchTipo:(c,f)=>String(f||"").includes("REGADOR")||String(c||"").startsWith("CAR")||String(c||"").startsWith("CAA")},
            {img:VEH_TRACTOR, nombre:"Camión Tractor", prefijos:["CAT"], matchTipo:(c,f)=>String(f||"").includes("TRACTOR")||String(c||"").startsWith("CAT")},
          ].map(tipo=>(`;
  out=requiredReplace(out,oldFleet,'          {fleetTypes.map(tipo=>(',"fotos de flota separadas");

  out=requiredReplace(
    out,
    '    return (vehListaIndex.vehicles||[]).filter(v=>{\n      if(!matchMulti(v.proyecto||v.ubicacion,vals.proyecto,"todos"))return false;',
    '    return (vehListaIndex.vehicles||[]).filter(v=>{\n      if(!vistaCombinada&&rop02VehicleKind(v)!==vehicleKind)return false;\n      if(!matchMulti(v.proyecto||v.ubicacion,vals.proyecto,"todos"))return false;',
    "lista maestra por tipo de vehículo"
  );

  if(!out.includes('fleetTypes.map(tipo=>(')||!out.includes('label={medidaLabel}')){
    throw new Error("[delta-rop02-truck-pickup-split] La vista de vehículos no quedó separada correctamente");
  }
  return out;
}

function transformOffice(code){
  let out=code;
  const marker='  C={...DEFAULT_COLORS,...(previousC||{}),...(deps.C||{})};\n}\n\nfunction ViewListaMaestraEquipos';
  out=requiredReplace(out,marker,`  C={...DEFAULT_COLORS,...(previousC||{}),...(deps.C||{})};\n}\n${officeHelpers()}\nfunction ViewListaMaestraEquipos`,"helpers de clasificación ROP02");

  out=requiredReplace(
    out,
    '  // Excluir camionetas y camiones de toda la vista ROP02\n  const rop02Prod=useMemo(()=>rop02All.filter(r=>!r._excluded && normalizeMachineCode(r.maquina)!=="CAA-0002"),[rop02All]);',
    '  // Camiones se controlan como equipos por hora; camionetas continúan separadas por km.\n  const rop02Prod=useMemo(()=>rop02All.filter(r=>isRop02HourlyEquipment(r)),[rop02All]);',
    "universo Equipos ROP02"
  );

  out=requiredReplaceAll(
    out,
    'const rop02Prod=useMemo(()=>rop02All.filter(r=>!r._excluded),[rop02All]);',
    'const rop02Prod=useMemo(()=>rop02All.filter(r=>isRop02HourlyEquipment(r)),[rop02All]);',
    "universos horarios ROP02",
    3
  );

  out=requiredReplace(
    out,
    '  const rop02Prod=useMemo(()=>atrasoSource.filter(r=>!r._excluded && normalizeMachineCode(r.maquina)!=="CAA-0002" && r.fecha),[atrasoSource]);',
    '  const rop02Prod=useMemo(()=>atrasoSource.filter(r=>isRop02HourlyEquipment(r)&&r.fecha),[atrasoSource]);',
    "universo Atraso ROP02"
  );

  out=requiredReplace(
    out,
    'const rows=(await onRemoteExport()).filter(r=>!r._excluded&&normalizeMachineCode(r.maquina)!=="CAA-0002")',
    'const rows=(await onRemoteExport()).filter(r=>isRop02HourlyEquipment(r))',
    "exportación Equipos ROP02"
  );

  const viewStart=out.indexOf('// ─── ViewVehiculos');
  const viewEnd=viewStart>=0?out.indexOf('// ─── ViewCombustible',viewStart):-1;
  if(viewStart<0||viewEnd<0)throw new Error("[delta-rop02-truck-pickup-split] No se encontró el bloque ViewVehiculos");
  const vehicleSegment=transformVehicleView(out.slice(viewStart,viewEnd));
  out=out.slice(0,viewStart)+vehicleSegment+out.slice(viewEnd);

  out=requiredReplace(
    out,
    '  "dashboard","listaEquipos","tallerCentral","rop02","horometros","vehiculos","controlROP02",',
    '  "dashboard","listaEquipos","tallerCentral","rop02","horometros","vehiculos","camiones","camionetas","controlROP02",',
    "OFFICE_VIEW_NAMES"
  );
  out=requiredReplace(
    out,
    '  st02,setSt02,stHorometros,setStHorometros,stVeh,setStVeh,',
    '  st02,setSt02,stHorometros,setStHorometros,stVeh,setStVeh,stCamiones,setStCamiones,stCamionetas,setStCamionetas,',
    "props módulo oficina"
  );
  out=requiredReplace(
    out,
    '  if(view==="vehiculos")return dataHydrated&&rop02All.length>0?<ViewVehiculos rop02All={rop02All} listaEquipos={listaEquipos} extState={stVeh} setExtState={setStVeh}/>:<Loader label="Cargando Vehículos..."/>;',
    '  if(view==="vehiculos")return dataHydrated&&rop02All.length>0?<ViewVehiculos rop02All={rop02All} listaEquipos={listaEquipos} extState={stVeh} setExtState={setStVeh} vehicleKind="todos"/>:<Loader label="Cargando Vehículos..."/>;\n  if(view==="camiones")return dataHydrated&&rop02All.length>0?<ViewVehiculos rop02All={rop02All} listaEquipos={listaEquipos} extState={stCamiones} setExtState={setStCamiones} vehicleKind="camiones"/>:<Loader label="Cargando Camiones..."/>;\n  if(view==="camionetas")return dataHydrated&&rop02All.length>0?<ViewVehiculos rop02All={rop02All} listaEquipos={listaEquipos} extState={stCamionetas} setExtState={setStCamionetas} vehicleKind="camionetas"/>:<Loader label="Cargando Camionetas..."/>;',
    "rutas Camiones/Camionetas"
  );

  if(!out.includes('isRop02HourlyEquipment(r)')||!out.includes('vehicleKind="camiones"')||!out.includes('vehicleKind="camionetas"')){
    throw new Error("[delta-rop02-truck-pickup-split] Integración horaria de camiones incompleta");
  }
  return out;
}

function transformAnalytics(code){
  let out=code;
  const oldClassifier=`  const esCamionOCamionetaTurno=(row,maquina)=>{
    const tipo=String(row?.equipo||row?._tipo||getMachineType(maquina)||"").toUpperCase();
    const code=String(maquina||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
    return tipo.includes("CAMION")||tipo.includes("CAMIÓN")||tipo.includes("CAMIONETA")||
      /^CTA/.test(code)||/^CAR/.test(code)||/^CAV/.test(code)||/^CAT[0-9]/.test(code)||
      /^[A-Z]{2}[0-9]{3}[A-Z]{2}$/.test(code)||/^[A-Z]{3}[0-9]{3}[A-Z]{2}$/.test(code)||/^AG[0-9]/.test(code)||/^AH[0-9]/.test(code);
  };`;
  const newClassifier=`  const esCamionetaTurno=(row,maquina)=>{
    const tipo=String(row?.equipo||row?._tipo||getMachineType(maquina)||"").toUpperCase();
    const code=String(maquina||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
    return tipo.includes("CAMIONETA")||/^CTA/.test(code);
  };`;
  out=requiredReplace(out,oldClassifier,newClassifier,"clasificación control mensual");
  out=requiredReplace(out,'      if(esCamionOCamionetaTurno(r,maquina))return false;','      if(esCamionetaTurno(r,maquina))return false;',"inclusión de camiones en control mensual");
  out=requiredReplace(
    out,
    '          <div style={{fontSize:11,color:C.textSub}}>Análisis sin camionetas ni camiones. Período: <strong style={{color:C.text}}>{fmtFecha(mesCorrienteInfo.desde)} al {fmtFecha(mesCorrienteInfo.hasta)}</strong></div>',
    '          <div style={{fontSize:11,color:C.textSub}}>Análisis sin camionetas. Los camiones se incluyen porque se controlan por horas. Período: <strong style={{color:C.text}}>{fmtFecha(mesCorrienteInfo.desde)} al {fmtFecha(mesCorrienteInfo.hasta)}</strong></div>',
    "texto control mensual"
  );
  return out;
}

export function rop02TruckPickupSplitVitePlugin(){
  return {
    name:"delta-rop02-truck-pickup-split",
    enforce:"pre",
    transform(code,id){
      const file=normalizeId(id);
      let next=null;
      if(file.endsWith(APP_FILE))next=transformApp(code);
      else if(file.endsWith(OFFICE_FILE))next=transformOffice(code);
      else if(file.endsWith(SOURCES_FILE))next=transformViewSources(code);
      else if(file.endsWith(ANALYTICS_FILE))next=transformAnalytics(code);
      else return null;
      if(next===code)return null;
      return {code:next,map:null};
    }
  };
}
