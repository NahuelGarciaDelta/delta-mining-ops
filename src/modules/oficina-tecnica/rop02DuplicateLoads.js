const text=value=>String(value??"").trim();
const upper=value=>text(value).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");

function normalizeMachine(value){
  return upper(value).replace(/[^A-Z0-9]+/g,"");
}

export function normalizeRop02Shift(value){
  const raw=upper(value);
  if(!raw)return "SIN TURNO";
  if(raw==="TN"||raw.includes("NOCHE"))return "TN";
  if(raw==="TD"||raw.includes("DIA"))return "TD";
  return raw;
}

export function detectRop02DuplicateLoads(rows=[]){
  const groups=new Map();

  (rows||[]).forEach(row=>{
    const maquina=text(row?.maquina);
    const fecha=text(row?.fecha).slice(0,10);
    const machineKey=normalizeMachine(maquina);
    if(!machineKey||!fecha)return;
    const key=`${machineKey}|${fecha}`;
    if(!groups.has(key))groups.set(key,{maquina,fecha,rows:[]});
    groups.get(key).rows.push(row);
  });

  const errors=[];
  groups.forEach(group=>{
    const registros=group.rows;
    if(registros.length<2)return;

    const turnos=registros.map(row=>normalizeRop02Shift(row?.turno));
    const turnosSet=new Set(turnos);
    const validPair=registros.length===2&&turnosSet.size===2&&turnosSet.has("TD")&&turnosSet.has("TN");
    if(registros.length===2&&validPair)return;

    const proyectos=[...new Set(registros.map(row=>text(row?.proyecto)).filter(Boolean))];
    const supervisores=[...new Set(registros.map(row=>text(row?.supervisor)).filter(Boolean))];
    const partes=registros.map(row=>text(row?.parte)).filter(Boolean);
    const turnosUnicos=[...new Set(turnos)];
    const mismoTurno=registros.length===2&&turnosUnicos.length===1;
    const detalle=registros.length>2
      ?`Se encontraron ${registros.length} cargas para el mismo equipo y fecha. El máximo permitido es 2: una de turno día y una de turno noche.`
      :mismoTurno
        ?`Se encontraron 2 cargas del mismo turno (${turnosUnicos[0]}). Cuando hay 2 cargas en el día deben ser una TD y una TN.`
        :"Las 2 cargas del día no forman la combinación válida TD + TN.";

    errors.push({
      tipo:"CARGA_DUPLICADA",
      proyecto:proyectos[0]||"—",
      proyectos:proyectos.join(" / "),
      maquina:group.maquina,
      fecha:group.fecha,
      turno:turnosUnicos.join(" / ")||"—",
      supervisor:supervisores.join(" / ")||"—",
      parte:partes.join(" / ")||"—",
      numeroIncorrecto:registros.length,
      numeroCorrecto:"TD + TN",
      diff:registros.length>2?registros.length-2:0,
      fechaAnterior:group.fecha,
      turnoAnterior:"—",
      parteAnterior:partes.join(" / ")||"—",
      cargasDetectadas:registros.length,
      turnosDetectados:turnos.join(" / "),
      partesDetectados:partes.join(" / "),
      detalle,
    });
  });

  return errors.sort((a,b)=>(a.fecha||"").localeCompare(b.fecha||"")||String(a.maquina||"").localeCompare(String(b.maquina||"")));
}
