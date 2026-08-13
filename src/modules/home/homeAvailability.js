const BAJO_SAN_JUAN_NORM="bajo a san juan";

const normText=value=>String(value??"")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g," ")
  .trim();

const toNum=value=>{
  const n=Number(String(value??"").replace(/\./g,"").replace(",",".").replace(/[^0-9.-]/g,""));
  return Number.isFinite(n)?n:0;
};

const dateISO=value=>{
  if(!value)return "";
  const text=String(value).trim();
  if(/^\d{4}-\d{2}-\d{2}/.test(text))return text.slice(0,10);
  const latin=text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(latin)return `${latin[3]}-${latin[2].padStart(2,"0")}-${latin[1].padStart(2,"0")}`;
  const parsed=new Date(text);
  return Number.isNaN(parsed.getTime())?"":parsed.toISOString().slice(0,10);
};

const addDaysISO=(iso,days)=>{
  const d=new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate()+days);
  return d.toISOString().slice(0,10);
};

const normalizeEquipmentCode=value=>String(value||"")
  .trim()
  .toUpperCase()
  .replace(/\s*\(.*?\)/g,"")
  .replace(/\s+/g,"-")
  .replace(/([A-Z]{2,4})-?(\d{1,3})$/,(_,a,n)=>`${a}-${String(n).padStart(4,"0")}`)
  .replace(/([A-Z]{2,4})-?(\d{4,})/,(_,a,n)=>`${a}-${n}`)
  .replace(/[-_]JM$/i,"");

const canonicalEquipmentCode=value=>{
  const code=normalizeEquipmentCode(value);
  const equivalences={
    "CFN-0101":"PCA-0101",
    "CFN-0041":"PCA-0081",
    "CFN-0043":"PCA-0093",
    "CFN-0044":"PCA-0095",
    "CFN-0045":"PCA-0095",
    "EXC-0014":"EXC-0034",
    "EXC-0019":"EXC-0048",
    "MOT-0024":"MOT-0047",
    "RTP-0010":"RTP-0016",
    "RTP-0012":"RTP-0024",
    "TOP-0014":"TOP-0032",
    "TOP-0059":"TOP-0058",
  };
  return equivalences[code]||code;
};

export function isBajoSanJuanJustification(value){
  return normText(value)===BAJO_SAN_JUAN_NORM;
}

export function getMaxRop02Date(rop02Rows=[],options={}){
  const normalizeCode=options.normalizeEquipmentCode||canonicalEquipmentCode;
  let max="";
  for(const row of rop02Rows||[]){
    if(row?._excluded)continue;
    const date=dateISO(row.fecha);
    const code=normalizeCode(row.maquina||row._internoRaw);
    if(date&&code&&date>max)max=date;
  }
  return max;
}

export function buildLatestRop02ByCode(rop02Rows=[],options={}){
  const normalizeCode=options.normalizeEquipmentCode||canonicalEquipmentCode;
  const latest=new Map();
  for(const row of rop02Rows||[]){
    if(row?._excluded)continue;
    const code=normalizeCode(row.maquina||row._internoRaw);
    const fecha=dateISO(row.fecha);
    if(code&&fecha&&(!latest.has(code)||fecha>latest.get(code)))latest.set(code,fecha);
  }
  return latest;
}

export function calculateAtrasoRop02(rop02Rows=[],admitidos={},options={}){
  const normalizeCode=options.normalizeEquipmentCode||canonicalEquipmentCode;
  const minDays=Number.isFinite(options.minDays)?options.minDays:2;
  const eligible=options.isEligible||((row)=>!row?._excluded);
  const validRows=(rop02Rows||[]).filter(row=>eligible(row)&&dateISO(row?.fecha));
  const fechaMaximaROP02=getMaxRop02Date(validRows,{normalizeEquipmentCode:normalizeCode});
  if(!fechaMaximaROP02)return {fechaMaximaROP02:"",atrasados:[],latestRop02ByCode:new Map()};
  const ventanaDesde=addDaysISO(fechaMaximaROP02,-6);
  const porEquipo=new Map();
  for(const row of validRows){
    const code=normalizeCode(row.maquina||row._internoRaw);
    const fecha=dateISO(row.fecha);
    if(!code||!fecha)continue;
    const current=porEquipo.get(code)||{codigo:code,maquina:row.maquina||code,proyecto:"",supervisor:"",fechas:new Set(),registros:0};
    current.fechas.add(fecha);
    current.registros+=1;
    if(fecha>=String(current.ultimaCarga||"")){
      current.ultimaCarga=fecha;
      current.maquina=row.maquina||current.maquina;
      if(row.proyecto)current.proyecto=row.proyecto;
      if(row.supervisor)current.supervisor=row.supervisor;
    }
    porEquipo.set(code,current);
  }
  const latestRop02ByCode=new Map();
  const atrasados=[];
  for(const current of porEquipo.values()){
    const ultimaCarga=current.ultimaCarga||"";
    latestRop02ByCode.set(current.codigo,ultimaCarga);
    const diasSinCarga=Math.floor((new Date(`${fechaMaximaROP02}T00:00:00`)-new Date(`${ultimaCarga}T00:00:00`))/86400000);
    if(!ultimaCarga||ultimaCarga>=fechaMaximaROP02||diasSinCarga<minDays)continue;
    const id=`atrasado_${current.codigo}_${ultimaCarga}`;
    const saved=admitidos?.[id]||{};
    atrasados.push({
      id,tipo:"Atrasado",codigo:current.codigo,maquina:current.maquina,proyecto:current.proyecto,
      supervisor:current.supervisor,ultimaCarga,diasSinCarga,
      diasConCarga:[...current.fechas].filter(fecha=>fecha>=ventanaDesde&&fecha<=fechaMaximaROP02).length,
      registros:current.registros,causa:String(saved.causa||"").trim(),
      admitido:Boolean(saved.admitido||saved.causa),fechaAdmitido:saved.fechaAdmitido||"",usuario:saved.usuario||"",
      proyectoDestino:saved.proyectoDestino||"",tipoMovimiento:saved.tipoMovimiento||"",observacion:saved.observacion||""
    });
  }
  atrasados.sort((a,b)=>b.diasSinCarga-a.diasSinCarga||a.maquina.localeCompare(b.maquina));
  return {fechaMaximaROP02,ventanaDesde,ventanaHasta:fechaMaximaROP02,atrasados,latestRop02ByCode};
}

export function currentAtrasoJustificationForEquipment(admitidos={},code,latestDate){
  const key=`atrasado_${code}_${latestDate}`;
  const saved=admitidos?.[key]||{};
  return String(saved.causa||"").trim();
}

export function getBajoSanJuanExclusionMap(admitidos={},latestRop02ByCode=new Map()){
  const out=new Map();
  Object.entries(admitidos||{}).forEach(([key,saved])=>{
    const match=String(key).match(/^atrasado_(.+)_(\d{4}-\d{2}-\d{2})$/);
    if(!match||!isBajoSanJuanJustification(saved?.causa))return;
    const code=match[1];
    const ultimaCarga=match[2];
    const fechaJustificacion=dateISO(saved?.fechaAdmitido);
    if(fechaJustificacion&&fechaJustificacion<ultimaCarga)return;
    const latest=latestRop02ByCode instanceof Map?latestRop02ByCode.get(code):latestRop02ByCode?.[code];
    if(latest&&latest>ultimaCarga)return;
    const prev=out.get(code);
    if(!prev||ultimaCarga>prev.ultimaCarga)out.set(code,{code,ultimaCarga,causa:String(saved.causa||"").trim(),saved});
  });
  return out;
}

export function isEquipoExcluidoPorBajaSanJuan(admitidos={},code,latestRop02Date=""){
  return getBajoSanJuanExclusionMap(admitidos,new Map([[code,latestRop02Date]])).has(code);
}

export function calculateOpenOtItems(records=[],exclusionMap=new Map()){
  const byEquipment=new Map();
  (records||[]).forEach(record=>{
    if(!record?.interno)return;
    if(!byEquipment.has(record.interno))byEquipment.set(record.interno,[]);
    byEquipment.get(record.interno).push(record);
  });
  const items=[];
  byEquipment.forEach(equipmentRecords=>{
    const sorted=[...equipmentRecords].sort((a,b)=>a.time-b.time||a.index-b.index);
    const current=sorted[sorted.length-1];
    if(!current?.noOperativo||exclusionMap.has(current.interno))return;
    let start=current;
    for(let i=sorted.length-2;i>=0;i--){
      if(!sorted[i].noOperativo)break;
      start=sorted[i];
    }
    items.push({interno:current.interno,lugar:current.lugar,fechaNoOperativo:start?.fechaISO||"",ot:current.ot,estado:current.estado});
  });
  items.sort((a,b)=>{
    if(a.fechaNoOperativo&&b.fechaNoOperativo&&a.fechaNoOperativo!==b.fechaNoOperativo)return a.fechaNoOperativo.localeCompare(b.fechaNoOperativo);
    if(a.fechaNoOperativo&&!b.fechaNoOperativo)return -1;
    if(!a.fechaNoOperativo&&b.fechaNoOperativo)return 1;
    return String(a.interno).localeCompare(String(b.interno));
  });
  return items;
}

function rowState(row){
  return normText(row?.estado||row?.Estado||row?.tipo_trabajo||"").toUpperCase();
}

export function calculateHomeAvailabilityFromRop02(rop02Rows=[],admitidos={},options={}){
  const normalizeCode=options.normalizeEquipmentCode||canonicalEquipmentCode;
  const fechaMaximaROP02=getMaxRop02Date(rop02Rows,{normalizeEquipmentCode:normalizeCode});
  if(!fechaMaximaROP02)return {
    disponibilidad:null,
    fechaMaximaROP02:"",
    ventanaDesde:"",
    ventanaHasta:"",
    elegiblesAntesExclusiones:0,
    elegiblesDespuesExclusiones:0,
    disponibles:0,
    noDisponibles:0,
    excluidosBajoSanJuan:0,
    items:[],
    fsItems:[],
  };

  const ventanaDesde=addDaysISO(fechaMaximaROP02,-6);
  const exclusionMap=options.exclusionMap||getBajoSanJuanExclusionMap(admitidos,buildLatestRop02ByCode(rop02Rows,{normalizeEquipmentCode:normalizeCode}));
  const porEquipo=new Map();
  for(const row of rop02Rows||[]){
    if(row?._excluded)continue;
    const fecha=dateISO(row.fecha);
    if(!fecha||fecha<ventanaDesde||fecha>fechaMaximaROP02)continue;
    const code=normalizeCode(row.maquina||row._internoRaw);
    if(!code)continue;
    const horas=toNum(row.horas);
    const estado=rowState(row);
    const current=porEquipo.get(code);
    const project=String(row.proyecto||row.lugar||row.Lugar||"").trim();
    if(!current||fecha>current.fecha){
      porEquipo.set(code,{code,maquina:code,lugar:project,fecha,horas,estados:new Set([estado].filter(Boolean)),rows:1});
    }else if(fecha===current.fecha){
      current.rows+=1;
      current.horas+=horas;
      if(estado)current.estados.add(estado);
      if(project)current.lugar=project;
    }
  }

  let disponibles=0;
  let noDisponibles=0;
  let excluidosBajoSanJuan=0;
  const items=[];
  const fsItems=[];
  for(const item of porEquipo.values()){
    if(exclusionMap.has(item.code)){
      excluidosBajoSanJuan+=1;
      continue;
    }
    const isFs=!(item.horas>0)&&item.estados?.size===1&&item.estados.has("FS");
    const estado=item.horas>0?"Trabajo":(isFs?"FS":(item.estados?.has("OD")?"OD":"Trabajo"));
    const detail={interno:item.code,lugar:item.lugar||"",estado,ultimoROP02:item.fecha,horas:Number(item.horas)||0};
    items.push(detail);
    if(isFs){
      noDisponibles+=1;
      fsItems.push(detail);
    }else disponibles+=1;
  }
  const elegiblesAntesExclusiones=porEquipo.size;
  const elegiblesDespuesExclusiones=disponibles+noDisponibles;
  items.sort((a,b)=>String(a.interno).localeCompare(String(b.interno)));
  fsItems.sort((a,b)=>String(a.interno).localeCompare(String(b.interno)));
  return {
    disponibilidad:elegiblesDespuesExclusiones?Math.round((disponibles/elegiblesDespuesExclusiones)*100):null,
    fechaMaximaROP02,
    ventanaDesde,
    ventanaHasta:fechaMaximaROP02,
    elegiblesAntesExclusiones,
    elegiblesDespuesExclusiones,
    disponibles,
    noDisponibles,
    excluidosBajoSanJuan,
    items,
    fsItems,
  };
}
