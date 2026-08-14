function cutoffDateToISO(date){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

export function getMonthlyCutoffRange(monthIndex, year){
  const selectedMonth=Number(monthIndex);
  const selectedYear=Number(year);
  const safeMonth=Number.isInteger(selectedMonth)&&selectedMonth>=0&&selectedMonth<=11?selectedMonth:0;
  const safeYear=Number.isInteger(selectedYear)?selectedYear:new Date().getFullYear();
  const startDate=new Date(safeYear,safeMonth-1,26,12,0,0,0);
  const endDate=new Date(safeYear,safeMonth,25,12,0,0,0);
  return {
    start:startDate,
    end:endDate,
    startISO:cutoffDateToISO(startDate),
    endISO:cutoffDateToISO(endDate),
  };
}
