import React,{useEffect,useMemo,useState} from "react";
import ExecutiveDashboard from "./ExecutiveDashboard.jsx";
import {APPS_SCRIPT_URL} from "../../config/app.js";
import {fetchDatasetQuery} from "../../services/appsScriptApi.js";
import {getRop02MonthlySummary} from "../../data/historicalDataService.js";
import {dmNormalizeAssignedProject,dmProjectMatches} from "../../components/ui/index.jsx";
import {isExcluded,normalizeROP02} from "../../shared/domain/index.jsx";
import {resolveEquipmentCodeAlias} from "../equipment/equipmentCode.js";

const safe=v=>Array.isArray(v)?v:[];
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0;};
const pad=n=>String(n).padStart(2,"0");
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const dateKey=v=>{
  if(v instanceof Date&&!Number.isNaN(v.getTime()))return ymd(v);
  const raw=String(v??"").trim();
  if(!raw)return"";
  let m=raw.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if(m)return`${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m=raw.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2}|\d{4})/);
  if(m){let yy=Number(m[3]);if(yy<100)yy+=2000;return`${yy}-${pad(m[2])}-${pad(m[1])}`;}
  const d=new Date(raw);return Number.isNaN(d.getTime())?"":ymd(d);
};
const rowDate=r=>dateKey(r?.fecha??r?.date??r?.fechaOT??r?.Fecha??r?.["Fecha del Parte Diario"]);
const norm=v=>String(v??"").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
const projectCode=v=>{const n=norm(v);if(n.includes("JOSE")&&n.includes("MARIA"))return"JM";if(n.includes("FILO")&&n.includes("SOL"))return"FS";if(n.includes("FILO")&&n.includes("SUR"))return"FILO SUR";if(n.includes("ZORRO"))return"EL ZORRO";return n;};
const machineKey=v=>String(v??"").toUpperCase().replace(/[^A-Z0-9]/g,"").replace(/JM$/i,"");
const formatMachine=v=>{
  const raw=machineKey(v);
  const m=raw.match(/^([A-Z]{2,4})(\d{1,6})$/);
  return m?`${m[1]}-${m[2].padStart(4,"0")}`:String(v??"").trim();
};
const reportingMonthForDate=d=>{
  const x=new Date(d);
  if(Number.isNaN(x.getTime()))return"";
  if(x.getDate()>=26)x.setMonth(x.getMonth()+1);
  return`${x.getFullYear()}-${pad(x.getMonth()+1)}`;
};
const periodForMonth=month=>{
  const [yy,mm]=String(month||"").split("-").map(Number);
  if(!yy||!mm)return null;
  const start=new Date(yy,mm-2,26,12);
  const end=new Date(yy,mm-1,25,12);
  return{month,start:ymd(start),end:ymd(end),startDate:start,endDate:end};
};
const previousMonth=month=>{
  const [yy,mm]=String(month||"").split("-").map(Number);
  if(!yy||!mm)return"";
  const d=new Date(yy,mm-2,1,12);
  return`${d.getFullYear()}-${pad(d.getMonth()+1)}`;
};
const inPeriod=(row,period)=>{const d=rowDate(row);return !!d&&!!period&&d>=period.start&&d<=period.end;};
const periodKeyForRow=row=>{
  const d=rowDate(row);if(!d)return"";
  return reportingMonthForDate(new Date(`${d}T12:00:00`));
};
const assignedProject=()=>{
  if(typeof window==="undefined")return"TODO";
  return dmNormalizeAssignedProject(window.sessionStorage?.getItem("dm_project")||"TODO");
};
const scopeRows=rows=>{
  const assigned=assignedProject();
  return safe(rows).filter(r=>dmProjectMatches(r?.proyecto??r?.Proyecto??r?.PROYECTO??r?.lugar??r?.Lugar??"",assigned));
};
const normalizeQueryRows=raw=>scopeRows(normalizeROP02(safe(raw)).map(r=>({...r,maquina:resolveEquipmentCodeAlias(r.maquina)})));
const groupKey=r=>`${periodKeyForRow(r)}|${projectCode(r?.proyecto)}|${machineKey(r?.maquina)}`;

function summaryRowsToSynthetic(summaryRow){
  const period=periodForMonth(summaryRow?.PERIODO??summaryRow?.periodo);
  if(!period)return[];
  const project=String(summaryRow?.PROYECTO??summaryRow?.proyecto??"").trim();
  const assigned=assignedProject();
  if(!dmProjectMatches(project,assigned))return[];
  const maquina=formatMachine(summaryRow?.INTERNO??summaryRow?.interno??"");
  if(!maquina||isExcluded(maquina))return[];
  const work=Math.max(0,Math.round(num(summaryRow?.DIAS_TRABAJO??summaryRow?.diasTrabajo)));
  const od=Math.max(0,Math.round(num(summaryRow?.DIAS_OD??summaryRow?.diasOD)));
  const fs=Math.max(0,Math.round(num(summaryRow?.DIAS_FS??summaryRow?.diasFS)));
  const em=Math.max(0,Math.round(num(summaryRow?.DIAS_EM??summaryRow?.diasEM)));
  const hours=Math.max(0,num(summaryRow?.HORAS_TRABAJADAS??summaryRow?.horasTrabajadas));
  const totalDays=Math.max(1,Math.round((period.endDate-period.startDate)/86400000)+1);
  const rows=[];
  let cursor=0;
  const add=(count,state,hoursPerDay=0)=>{
    for(let i=0;i<count;i+=1){
      const d=new Date(period.startDate);
      d.setDate(d.getDate()+(cursor%totalDays));
      cursor+=1;
      rows.push({
        fecha:ymd(d),
        maquina,
        proyecto:project,
        horas:hoursPerDay,
        horasRaw:hoursPerDay,
        estado:state,
        _excluded:false,
        _dashboardHistorical:true,
      });
    }
  };
  if(work>0)add(work,"TRABAJO",hours/work);
  else if(hours>0)add(1,"TRABAJO",hours);
  add(od,"OD",0);
  add(fs,"FS",0);
  add(em,"EM",0);
  return rows;
}

export default function ExecutiveDashboardHistorical(props){
  const currentMonth=useMemo(()=>reportingMonthForDate(new Date()),[]);
  const priorMonth=useMemo(()=>previousMonth(currentMonth),[currentMonth]);
  const currentPeriod=useMemo(()=>periodForMonth(currentMonth),[currentMonth]);
  const priorPeriod=useMemo(()=>periodForMonth(priorMonth),[priorMonth]);
  const [history,setHistory]=useState({current:null,previous:null,summary:null});

  useEffect(()=>{
    let alive=true;
    const query=async period=>{
      const response=await fetchDatasetQuery(APPS_SCRIPT_URL,{
        dataset:"rop02",
        desde:period.start,
        hasta:period.end,
        limit:"all",
        offset:0,
        sortBy:"fecha",
        sortDirection:"asc",
      },{timeoutMs:50000});
      return normalizeQueryRows(response?.data);
    };
    Promise.allSettled([
      query(currentPeriod),
      query(priorPeriod),
      getRop02MonthlySummary({limit:"all",offset:0}),
    ]).then(([cur,prev,summary])=>{
      if(!alive)return;
      setHistory({
        current:cur.status==="fulfilled"&&cur.value.length?cur.value:null,
        previous:prev.status==="fulfilled"&&prev.value.length?prev.value:null,
        summary:summary.status==="fulfilled"&&summary.value?.ok&&Array.isArray(summary.value.data)?summary.value.data:null,
      });
    });
    return()=>{alive=false;};
  },[currentPeriod?.start,currentPeriod?.end,priorPeriod?.start,priorPeriod?.end]);

  const effectiveRop02=useMemo(()=>{
    let rows=scopeRows(props?.rop02All);

    // Las dos ventanas más importantes se reemplazan por consultas históricas exactas.
    // Así el dashboard no depende de que la precarga global haya conseguido leer todas
    // las planillas ROP02 en esa PC.
    if(history.current?.length){
      rows=rows.filter(r=>!inPeriod(r,currentPeriod));
      rows.push(...history.current);
    }
    if(history.previous?.length){
      rows=rows.filter(r=>!inPeriod(r,priorPeriod));
      rows.push(...history.previous);
    }

    // Los meses anteriores se completan con el resumen histórico central ROP02.
    // Solo se sintetiza un equipo/proyecto/período cuando esa combinación no está
    // ya presente en la base real, evitando duplicar horas.
    if(history.summary?.length){
      const existing=new Set(rows.map(groupKey).filter(Boolean));
      const synthetic=[];
      history.summary.forEach(item=>{
        const month=String(item?.PERIODO??item?.periodo??"");
        if(!month||month===currentMonth||month===priorMonth)return;
        const key=`${month}|${projectCode(item?.PROYECTO??item?.proyecto)}|${machineKey(item?.INTERNO??item?.interno)}`;
        if(existing.has(key))return;
        const generated=summaryRowsToSynthetic(item);
        if(generated.length){synthetic.push(...generated);existing.add(key);}
      });
      rows.push(...synthetic);
    }
    return rows;
  },[props?.rop02All,history,currentMonth,priorMonth,currentPeriod,priorPeriod]);

  return <ExecutiveDashboard {...props} rop02All={effectiveRop02}/>;
}
