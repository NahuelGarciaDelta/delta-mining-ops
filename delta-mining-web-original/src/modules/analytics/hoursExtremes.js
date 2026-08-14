export function getHoursExtremes(rows=[]){
  const validRows=rows.filter(row=>Number.isFinite(Number(row?.horas))&&Number(row.horas)>0);
  if(!validRows.length)return{max:null,min:null};
  return validRows.reduce((result,row)=>{
    const hours=Number(row.horas);
    if(!result.max||hours>Number(result.max.horas))result.max=row;
    if(!result.min||hours<Number(result.min.horas))result.min=row;
    return result;
  },{max:null,min:null});
}
