const normalizeText=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toUpperCase();

export const COST_GROUP_OPTIONS=Object.freeze([
  {value:"todos",label:"Todos los tipos"},
  {value:"CARGADOR FRONTAL L120",label:"Cargador Frontal L120"},
  {value:"CARGADOR FRONTAL",label:"Cargador Frontal"},
  {value:"EXCAVADORA PC350",label:"Excavadora PC350"},
  {value:"EXCAVADORA",label:"Excavadora"},
  {value:"MINICARGADORA",label:"Minicargadora"},
  {value:"MOTONIVELADORA",label:"Motoniveladora"},
  {value:"RETROPALA",label:"Retropala"},
  {value:"RODILLO COMPACTADOR",label:"Rodillo Compactador"},
  {value:"TOPADORA",label:"Topadora"},
  {value:"CAMIONETA",label:"Camioneta"},
  {value:"GRUPO ELECTROGENO",label:"Grupo Electrógeno"},
  {value:"CAMION DE COMBUSTIBLE",label:"Camión de Combustible"},
  {value:"CAMION REGADOR",label:"Camión Regador"},
  {value:"CAMION VOLCADOR",label:"Camión Volcador"},
  {value:"CAMION CISTERNA",label:"Camión Cisterna"},
  {value:"CAMION TRACTOR",label:"Camión Tractor"},
]);

const optionByValue=new Map(COST_GROUP_OPTIONS.map(option=>[option.value,option]));

export function normalizeCostGroup(tipo,modelo=""){
  const raw=String(tipo||"").trim();
  const type=normalizeText(tipo);
  const model=normalizeText(modelo).replace(/[\s\-_/]+/g,"");
  let value="";
  if(!raw||type==="S/D"||type==="SD")return {value:"",label:""};
  if(type.includes("EXCAVADORA 1")||model.includes("PC350"))value="EXCAVADORA PC350";
  else if(type.includes("CARGADORA 1")||model.includes("L120"))value="CARGADOR FRONTAL L120";
  else if(model.includes("L330")||type.includes("MINICARGADORA"))value="MINICARGADORA";
  else if(type.includes("MOTONIVELADORA"))value="MOTONIVELADORA";
  else if(type.includes("CARGADORA"))value="CARGADOR FRONTAL";
  else if(type.includes("COMPACT")||type.includes("RODILLO"))value="RODILLO COMPACTADOR";
  else if(type.includes("RETROPALA"))value="RETROPALA";
  else if(type.includes("EXCAVADORA"))value="EXCAVADORA";
  else if(type.includes("TOPADORA"))value="TOPADORA";
  else if(type.includes("VOLCADOR"))value="CAMION VOLCADOR";
  else if(type.includes("REGADOR"))value="CAMION REGADOR";
  else if(type.includes("TRACTOR"))value="CAMION TRACTOR";
  else if(type.includes("CISTERNA")||type.includes("SISTERNA"))value="CAMION CISTERNA";
  else if(type.includes("COMBUSTIBLE"))value="CAMION DE COMBUSTIBLE";
  else if(type.includes("GRUPO ELECTROGENO")||type.includes("GENERADOR"))value="GRUPO ELECTROGENO";
  else if(type.includes("CAMIONETA")||type.includes("HILUX")||type.includes("PICK"))value="CAMIONETA";
  else value=normalizeText(raw);
  return optionByValue.get(value)||{value,label:raw.toLowerCase().replace(/(^|\s)\S/g,char=>char.toUpperCase())};
}

export function costGroupOrder(value){
  const normalized=normalizeText(value);
  const index=COST_GROUP_OPTIONS.findIndex(option=>option.value===normalized);
  return index<0?COST_GROUP_OPTIONS.length:index;
}

export function buildCostEquipmentOptions(rows){
  const values=new Map();
  for(const row of rows||[]){
    const value=String(row?._resumenEquipoValue||row?.equipo||"").trim();
    if(value)values.set(normalizeText(value),value);
  }
  return [{value:"todos",label:"Todos los equipos"},...[...values.values()].sort((a,b)=>a.localeCompare(b,"es",{numeric:true,sensitivity:"base"})).map(value=>({value,label:value}))];
}

export function buildCostPropertyOptions(rows){
  const values=new Map();
  for(const row of rows||[]){
    const value=normalizeText(row?._resumenPropiedadValue||row?.propiedad||"S/D")||"S/D";
    values.set(value,value);
  }
  const sorted=[...values.values()].sort((a,b)=>a==="DELTA"?-1:b==="DELTA"?1:a.localeCompare(b,"es"));
  return [{value:"todos",label:"Todas las propiedades"},...sorted.map(value=>({value,label:value}))];
}
