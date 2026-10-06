const finiteNumber=value=>{
  if(value===null||value===undefined||String(value).trim()==="")return null;
  const parsed=typeof value==="number"?value:Number(String(value).trim().replace(/\s/g,"").replace(",","."));
  return Number.isFinite(parsed)?parsed:null;
};

export function buildRop02TdTnHorometerError(td,tn,machine=""){
  if(!td||!tn)return null;
  const hfTD=finiteNumber(td.horometroFinal);
  const hiTN=finiteNumber(tn.horometroInicial);
  if(hfTD===null||hiTN===null||hfTD===hiTN)return null;
  return{
    tipo:"TD_TN_HOROMETRO",
    proyecto:tn.proyecto||td.proyecto||"—",
    maquina:machine||tn.maquina||td.maquina||"—",
    fecha:tn.fecha||td.fecha||"",
    turno:"TN",
    supervisor:tn.supervisor||td.supervisor||"—",
    parte:tn.parte||"—",
    hiActual:hiTN,
    hfAnterior:hfTD,
    fechaAnterior:td.fecha||tn.fecha||"",
    turnoAnterior:"TD",
    parteAnterior:td.parte||"—",
    diff:hiTN-hfTD,
    detalle:"El horómetro inicial del turno noche debe coincidir con el horómetro final del turno día del mismo día."
  };
}
