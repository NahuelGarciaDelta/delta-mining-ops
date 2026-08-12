const normalizeText=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toUpperCase();

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
