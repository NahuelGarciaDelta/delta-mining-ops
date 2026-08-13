const iso=value=>String(value||"").slice(0,10);

export function operationalMonthRange(year,month){
  const y=Number(year),m=Number(month);
  if(!y||m<1||m>12)throw new Error("Año/mes operativo inválido");
  const start=new Date(y,m-2,26,12),end=new Date(y,m-1,25,12);
  const fmt=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  return{desde:fmt(start),hasta:fmt(end)};
}

export function yearsForRange(desde,hasta){
  const first=Number(iso(desde).slice(0,4)),last=Number(iso(hasta||desde).slice(0,4));
  if(!first||!last||last<first)return[];
  return Array.from({length:last-first+1},(_,index)=>first+index);
}

export function buildDatasetQueryKey(dataset,params={}){
  const normalized={desde:iso(params.desde),hasta:iso(params.hasta),proyecto:String(params.proyecto||"").trim().toUpperCase(),equipo:String(params.equipo||"").trim().toUpperCase(),supervisor:String(params.supervisor||"").trim().toUpperCase(),operario:String(params.operario||"").trim().toUpperCase(),estado:String(params.estado||"").trim().toUpperCase(),tipo:String(params.tipo||"").trim().toUpperCase(),tarea:String(params.tarea||"").trim().toUpperCase(),unidad:String(params.unidad||"").trim().toUpperCase(),sortBy:String(params.sortBy||"fecha").trim(),sortDirection:String(params.sortDirection||"asc").toLowerCase(),limit:String(params.limit||250).toLowerCase()==="all"?"all":Number(params.limit||250),offset:Number(params.offset||0)};
  return [String(dataset||"").toLowerCase(),normalized.desde,normalized.hasta,normalized.proyecto||"ALL",normalized.equipo||"ALL",normalized.supervisor||"ALL",normalized.operario||"ALL",normalized.estado||"ALL",normalized.tipo||"ALL",normalized.tarea||"ALL",normalized.unidad||"ALL",normalized.sortBy,normalized.sortDirection,normalized.limit,normalized.offset].join("|");
}
