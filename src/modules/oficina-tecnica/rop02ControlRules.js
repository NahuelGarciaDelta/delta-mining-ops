const compactText=value=>String(value??"")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"")
  .toUpperCase()
  .replace(/[^A-Z0-9]/g,"");

export function rop02ControlTurnoKey(value){
  const key=compactText(value);
  if(key==="TN"||key.includes("NOCHE")||key.includes("NOCTURN"))return "TN";
  return "TD";
}

export function rop02ControlTurnoOrder(value){
  return rop02ControlTurnoKey(value)==="TN"?1:0;
}

export function rop02ControlVehicleKind(value){
  const code=compactText(value).replace(/JM$/,"");
  if(!code||code==="CAA0002")return "";

  // Camionetas identificadas por interno CTA o dominio argentino.
  if(/^CTA/.test(code)||/^(AG|AH|AI)[0-9A-Z]{4,}$/.test(code))return "CAMIONETA";

  // Camiones regadores, combustible, volcadores y demás internos de camión.
  if(/^(CAC|CAR|CAV|CAA)/.test(code)||code==="CAT0073")return "CAMION";

  return "";
}

export function isRop02ControlVehicle(value){
  return Boolean(rop02ControlVehicleKind(value));
}

export function rop02ControlRowEligible(row){
  if(!row)return false;
  if(!row._excluded)return true;
  return isRop02ControlVehicle(row.maquina||row._internoRaw||row.interno);
}

export function rop02ControlTipoOptions(baseOptions=[]){
  const options=Array.isArray(baseOptions)?[...baseOptions]:[];
  const has=value=>options.some(option=>String(option?.value||"").toUpperCase()===value);
  if(!has("CAMIONETA"))options.push({value:"CAMIONETA",label:"Camionetas"});
  if(!has("CAMION"))options.push({value:"CAMION",label:"Camiones"});
  return options;
}

export function rop02ControlTipoMatches(maquina,seleccion,baseMatcher){
  const selected=Array.isArray(seleccion)?seleccion:[seleccion];
  if(selected.length===0||selected.some(value=>["", "TODAS", "TODOS"].includes(String(value??"").trim().toUpperCase())))return true;

  const kind=rop02ControlVehicleKind(maquina);
  return selected.some(value=>{
    const key=String(value??"").trim().toUpperCase();
    if(key==="CAMIONETA")return kind==="CAMIONETA";
    if(key==="CAMION")return kind==="CAMION";
    return typeof baseMatcher==="function"?Boolean(baseMatcher(maquina,value)):false;
  });
}
