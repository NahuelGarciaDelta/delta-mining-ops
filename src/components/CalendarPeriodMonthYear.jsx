import React from "react";
import { MONTH_OPTIONS, YEAR_OPTIONS, Sel } from "./ui/index.jsx";

export default function CalendarPeriodMonthYear({fechaD,fechaH,setFechaD,setFechaH}){
  const desde=String(fechaD||"");
  const hasta=String(fechaH||"");
  const sameMonth=desde.slice(0,7)&&desde.slice(0,7)===hasta.slice(0,7);
  const selectedMonth=sameMonth&&desde.slice(8,10)==="01"?desde.slice(5,7):"";
  const selectedYear=selectedMonth?desde.slice(0,4):(desde?desde.slice(0,4):"");

  const apply=(year,month)=>{
    const now=new Date();
    const y=year||String(now.getFullYear());
    if(!month){
      setFechaD(`${y}-01-01`);
      setFechaH(`${y}-12-31`);
      return;
    }
    const targetYear=Number(y);
    const targetMonth=Number(month);
    const start=new Date(targetYear,targetMonth-1,1,12);
    const end=new Date(targetYear,targetMonth,0,12);
    const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    setFechaD(iso(start));
    setFechaH(iso(end));
  };

  const clearPeriodo=()=>{setFechaD("");setFechaH("");};

  return(
    <>
      <Sel label="Mes" value={selectedMonth} onChange={m=>m?apply(selectedYear,m):clearPeriodo()} options={MONTH_OPTIONS}/>
      <Sel label="Año" value={selectedYear} onChange={y=>y?apply(y,selectedMonth):clearPeriodo()} options={YEAR_OPTIONS}/>
    </>
  );
}
