function stripAccents(value){
  return String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
}

export function operatorIdentityKey(value){
  return stripAccents(value).trim().replace(/\s+/g," ").toUpperCase();
}

export function operatorShiftCode(value){
  const text=stripAccents(value).trim().toUpperCase();
  if(text.includes("TN")||text.includes("NOCHE"))return "TN";
  return "TD";
}

function shiftRank(row){
  return operatorShiftCode(row?.turno)==="TN"?1:0;
}

function partNumber(value){
  const matches=String(value??"").match(/\d+/g);
  return matches?Number(matches[matches.length-1]):0;
}

export function isOperatingRecord(row){
  return Boolean(
    row &&
    !row._excluded &&
    String(row.estado||"").toUpperCase()==="TRABAJO" &&
    String(row.operario||"").trim() &&
    String(row.maquina||"").trim() &&
    String(row.fecha||"").trim()
  );
}

export function filterOperatorActivity(rows,filters={}){
  const {
    mode="periodo",fecha="",fechaD="",fechaH="",
    proyecto="todos",maquina="todas",supervisor="todos",operario="todos",turno="todos",
    matchMulti=(value,selected,allValue)=>{
      if(selected===undefined||selected===null||selected===allValue)return true;
      const values=Array.isArray(selected)?selected:[selected];
      return values.includes(allValue)||values.includes(value);
    },
    machineMatches=()=>true,
    tipoMaquina="todas",
  }=filters;
  return (rows||[]).filter(row=>{
    if(!isOperatingRecord(row))return false;
    if(mode==="dia"&&fecha&&row.fecha!==fecha)return false;
    if(mode==="periodo"){
      if(fechaD&&row.fecha<fechaD)return false;
      if(fechaH&&row.fecha>fechaH)return false;
    }
    if(!matchMulti(row.proyecto,proyecto,"todos"))return false;
    if(!matchMulti(row.maquina,maquina,"todas"))return false;
    if(!matchMulti(row.supervisor,supervisor,"todos"))return false;
    if(!matchMulti(row.operario,operario,"todos"))return false;
    if(!matchMulti(operatorShiftCode(row.turno),turno,"todos"))return false;
    if(!machineMatches(row.maquina,tipoMaquina))return false;
    return true;
  });
}

function newerRow(a,b){
  if(!a)return b;
  if(!b)return a;
  const dateCmp=String(a.fecha||"").localeCompare(String(b.fecha||""));
  if(dateCmp!==0)return dateCmp>0?a:b;
  const shiftCmp=shiftRank(a)-shiftRank(b);
  if(shiftCmp!==0)return shiftCmp>0?a:b;
  return partNumber(a.parte)>=partNumber(b.parte)?a:b;
}

export function latestOperatorEquipmentRows(rows,{useLatestDateWhenUnbounded=true}={}){
  let source=(rows||[]).filter(isOperatingRecord);
  if(useLatestDateWhenUnbounded&&source.length){
    const maxDate=source.reduce((max,row)=>String(row.fecha||"")>max?String(row.fecha||""):max,"");
    source=source.filter(row=>row.fecha===maxDate);
  }
  const grouped=new Map();
  source.forEach(row=>{
    const key=`${operatorIdentityKey(row.operario)}|||${String(row.maquina||"").trim().toUpperCase()}`;
    grouped.set(key,newerRow(grouped.get(key),row));
  });
  return [...grouped.values()].sort((a,b)=>
    String(a.operario||"").localeCompare(String(b.operario||""))||
    String(a.maquina||"").localeCompare(String(b.maquina||""))
  );
}

export function buildOperatorSummary(rows){
  const valid=(rows||[]).filter(isOperatingRecord);
  const days=new Set();
  const machines=new Set();
  const projects=new Set();
  let hours=0;
  valid.forEach(row=>{
    hours+=Number(row.horas)||0;
    if(row.fecha)days.add(row.fecha);
    if(row.maquina)machines.add(row.maquina);
    if(row.proyecto)projects.add(row.proyecto);
  });
  return{
    hours,
    days:days.size,
    machines:machines.size,
    projects:projects.size,
    records:valid.length,
  };
}

export function buildOperatorEquipmentSummary(rows){
  const map=new Map();
  (rows||[]).filter(isOperatingRecord).forEach(row=>{
    const key=String(row.maquina||"").trim();
    if(!key)return;
    const current=map.get(key)||{
      maquina:key,
      tipo:row._tipo||row.equipo||"",
      horas:0,
      dias:new Set(),
      proyectos:new Set(),
      ultimaFecha:"",
    };
    current.horas+=Number(row.horas)||0;
    if(row.fecha){
      current.dias.add(row.fecha);
      if(row.fecha>current.ultimaFecha)current.ultimaFecha=row.fecha;
    }
    if(row.proyecto)current.proyectos.add(row.proyecto);
    if(!current.tipo)current.tipo=row._tipo||row.equipo||"";
    map.set(key,current);
  });
  return [...map.values()].map(item=>({
    maquina:item.maquina,
    tipo:item.tipo,
    horas:item.horas,
    dias:item.dias.size,
    ultimaFecha:item.ultimaFecha,
    proyecto:[...item.proyectos].sort().join(" / "),
  })).sort((a,b)=>b.horas-a.horas||a.maquina.localeCompare(b.maquina));
}

export function latestActivityDate(rows){
  return (rows||[]).filter(isOperatingRecord).reduce((max,row)=>row.fecha>max?row.fecha:max,"");
}
