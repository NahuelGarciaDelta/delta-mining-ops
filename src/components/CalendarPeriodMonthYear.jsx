import React from "react";
import { MONTH_OPTIONS, YEAR_OPTIONS, Sel } from "./ui/index.jsx";

const RANGE_VALUE="__range__";
const RANGE_OPTION={value:RANGE_VALUE,label:"Desde / Hasta"};

export default function CalendarPeriodMonthYear({fechaD,fechaH,setFechaD,setFechaH}){
  const desde=String(fechaD||"");
  const hasta=String(fechaH||"");
  const desdeMonth=desde.slice(5,7);
  const hastaMonth=hasta.slice(5,7);
  const sameMonth=desde.slice(0,7)&&desde.slice(0,7)===hasta.slice(0,7);
  const selectedMonth=sameMonth&&desde.slice(8,10)==="01"?desdeMonth:"";
  const selectedYear=desde?desde.slice(0,4):(hasta?hasta.slice(0,4):"");
  const persistedRange=Boolean(desde&&hasta&&!sameMonth);
  const [rangeMode,setRangeMode]=React.useState(persistedRange);
  const rootRef=React.useRef(null);

  React.useEffect(()=>{
    if(persistedRange)setRangeMode(true);
  },[persistedRange]);

  // Los encabezados sticky de las tablas usan z-index. Elevamos la barra de filtros
  // completa para que los controles y sus desplegables queden siempre por encima.
  React.useEffect(()=>{
    const parent=rootRef.current?.parentElement;
    if(!parent)return undefined;
    const previous={
      position:parent.style.position,
      zIndex:parent.style.zIndex,
      overflow:parent.style.overflow,
    };
    if(!parent.style.position||parent.style.position==="static")parent.style.position="relative";
    parent.style.zIndex="1000";
    parent.style.overflow="visible";
    return()=>{
      parent.style.position=previous.position;
      parent.style.zIndex=previous.zIndex;
      parent.style.overflow=previous.overflow;
    };
  },[]);

  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

  const applySingle=(year,month)=>{
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
    setFechaD(iso(start));
    setFechaH(iso(end));
  };

  const applyRange=(year,fromMonth,toMonth)=>{
    const now=new Date();
    const y=year||selectedYear||String(now.getFullYear());
    let from=fromMonth||toMonth||"01";
    let to=toMonth||fromMonth||"12";
    if(Number(from)>Number(to)){
      const aux=from;
      from=to;
      to=aux;
    }
    const targetYear=Number(y);
    const start=new Date(targetYear,Number(from)-1,1,12);
    const end=new Date(targetYear,Number(to),0,12);
    setFechaD(iso(start));
    setFechaH(iso(end));
  };

  const clearPeriodo=()=>{setFechaD("");setFechaH("");};
  const monthOptionsWithRange=[MONTH_OPTIONS[0],RANGE_OPTION,...MONTH_OPTIONS.slice(1)];
  const mainMonthValue=rangeMode?RANGE_VALUE:selectedMonth;

  const handleMainMonth=(value)=>{
    if(value===RANGE_VALUE){
      setRangeMode(true);
      if(!desde||!hasta){
        const now=new Date();
        const y=selectedYear||String(now.getFullYear());
        const current=String(now.getMonth()+1).padStart(2,"0");
        applyRange(y,desdeMonth||current,hastaMonth||current);
      }
      return;
    }
    setRangeMode(false);
    if(value)applySingle(selectedYear,value);
    else clearPeriodo();
  };

  const handleYear=(year)=>{
    if(!year){
      clearPeriodo();
      return;
    }
    if(rangeMode)applyRange(year,desdeMonth,hastaMonth);
    else applySingle(year,selectedMonth);
  };

  return(
    <div ref={rootRef} style={{display:"contents"}}>
      <Sel label="Mes" value={mainMonthValue} onChange={handleMainMonth} options={monthOptionsWithRange}/>
      {rangeMode&&<>
        <Sel
          label="Desde"
          value={desdeMonth}
          onChange={m=>m?applyRange(selectedYear,m,hastaMonth):clearPeriodo()}
          options={MONTH_OPTIONS}
        />
        <Sel
          label="Hasta"
          value={hastaMonth}
          onChange={m=>m?applyRange(selectedYear,desdeMonth,m):clearPeriodo()}
          options={MONTH_OPTIONS}
        />
      </>}
      <Sel label="Año" value={selectedYear} onChange={handleYear} options={YEAR_OPTIONS}/>
    </div>
  );
}
