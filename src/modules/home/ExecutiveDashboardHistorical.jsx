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
const reportingYearRange=year=>{
  const yy=Number(year);
  if(!yy)return null;
  const first=periodForMonth(`${yy}-01`);
  const last=periodForMonth(`${yy}-12`);
  return first&&last?{year:yy,start:first.start,end:last.end}:null;
};
const inRange=(row,range)=>{
  const d=rowDate(row);
  return !!d&&!!range&&d>=range.start&&d<=range.end;
};
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
  const reportingYear=useMemo(()=>Number(String(currentMonth).slice(0,4))||new Date().getFullYear(),[currentMonth]);
  const yearRange=useMemo(()=>reportingYearRange(reportingYear),[reportingYear]);
  const [history,setHistory]=useState({year:null,summary:null,summaryReady:false,error:""});

  useEffect(()=>{
    if(!yearRange)return;
    let alive=true;

    // El dashboard necesita contexto anual. Antes hacía dos consultas mensuales y
    // dependía de ROP02_RESUMEN_MENSUAL para el resto del año. Si ese acelerador no
    // estaba reconstruido, enero-agosto quedaban en cero aunque ROP02 tuviera datos.
    // query_dataset ya recorre las mismas planillas completas para cualquier rango,
    // por lo que una sola consulta del año operativo es más rápida y completa que
    // consultar mes por mes o repetir dos lecturas grandes.
    const queryYear=async()=>{
      const response=await fetchDatasetQuery(APPS_SCRIPT_URL,{
        dataset:"rop02",
        desde:yearRange.start,
        hasta:yearRange.end,
        limit:"all",
        offset:0,
        sortBy:"fecha",
        sortDirection:"asc",
      },{timeoutMs:52000});
      const rows=normalizeQueryRows(response?.data);
      if(!rows.length)throw new Error("La consulta histórica anual de ROP02 volvió vacía");
      return rows;
    };

    Promise.allSettled([
      queryYear(),
      getRop02MonthlySummary({limit:"all",offset:0}),
    ]).then(([yearResult,summaryResult])=>{
      if(!alive)return;
      const year=yearResult.status==="fulfilled"&&yearResult.value.length?yearResult.value:null;
      const summaryResponse=summaryResult.status==="fulfilled"?summaryResult.value:null;
      const summary=summaryResponse?.ok&&Array.isArray(summaryResponse.data)?summaryResponse.data:null;
      const errors=[];
      if(yearResult.status==="rejected")errors.push(String(yearResult.reason?.message||yearResult.reason||"No se pudo cargar ROP02 histórico"));
      if(summaryResult.status==="rejected")errors.push(String(summaryResult.reason?.message||summaryResult.reason||"No se pudo cargar el resumen mensual"));
      setHistory({year,summary,summaryReady:summaryResponse?.ready===true,error:errors.join(" · ")});
    });

    return()=>{alive=false;};
  },[yearRange?.start,yearRange?.end]);

  const effectiveRop02=useMemo(()=>{
    let rows=scopeRows(props?.rop02All);

    // La consulta anual real tiene prioridad absoluta para todos los períodos del año.
    // Esto hace que comparaciones, evolución mensual, disponibilidad y utilización
    // trabajen con el historial verdadero y no con la carga parcial que tenga App.jsx.
    if(history.year?.length&&yearRange){
      rows=rows.filter(r=>!inRange(r,yearRange));
      rows.push(...history.year);
      return rows;
    }

    // Fallback: si la consulta anual no respondió, aprovechamos todos los meses que
    // existan en el acelerador mensual. No exige ready=true porque una reconstrucción
    // parcial todavía es mejor que convertir meses existentes en cero.
    if(history.summary?.length){
      const byMonth=new Map();
      history.summary.forEach(item=>{
        const month=String(item?.PERIODO??item?.periodo??"").trim();
        if(!month||!month.startsWith(`${reportingYear}-`))return;
        const list=byMonth.get(month)||[];
        list.push(item);
        byMonth.set(month,list);
      });
      byMonth.forEach((items,month)=>{
        rows=rows.filter(r=>periodKeyForRow(r)!==month);
        items.forEach(item=>rows.push(...summaryRowsToSynthetic(item)));
      });
    }

    return rows;
  },[props?.rop02All,history.year,history.summary,yearRange,reportingYear]);

  return <ExecutiveDashboard {...props} rop02All={effectiveRop02}/>;
}
