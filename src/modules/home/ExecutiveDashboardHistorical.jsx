import React,{useEffect,useMemo,useState} from "react";
import ExecutiveDashboard from "./ExecutiveDashboard.jsx";
import {APPS_SCRIPT_URL} from "../../config/app.js";
import {fetchDatasetQuery} from "../../services/appsScriptApi.js";
import {getRop02MonthlySummary} from "../../data/historicalDataService.js";
import {dmNormalizeAssignedProject,dmProjectMatches} from "../../components/ui/index.jsx";
import {
  getInsumoExtra,
  getValue,
  isExcluded,
  normalizeInsumoCode,
  normalizeRMA15,
  normalizeROP02,
  toMoneyNumber,
} from "../../shared/domain/index.jsx";
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
const rowDate=r=>dateKey(r?.fecha??r?.date??r?.fechaOT??r?.Fecha??r?.["Fecha del Parte Diario"]??r?.["Fecha de OT"]);
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
const projectMatches=(row,project)=>dmProjectMatches(row?.proyecto??row?.Proyecto??row?.PROYECTO??row?.lugar??row?.Lugar??"",project);

const ROP02_SOURCES=[
  {dataset:"rop02_jm",project:"JOSE MARIA"},
  {dataset:"rop02_fs",project:"FILO DEL SOL"},
];
const RMA15_SOURCES=[
  {dataset:"rma15_jm",project:"JOSE MARIA"},
  {dataset:"rma15_fs",project:"FILO DEL SOL"},
];

function buildInsumosMap(rawSources){
  const map={};
  safe(rawSources?.insumos?.data).forEach(r=>{
    const codigo=normalizeInsumoCode(getValue(r,["CODIGO","Codigo","Código","codigo","código","Cod","cod"])||"");
    if(!codigo)return;
    const descripcion=String(getValue(r,["DESCRIPCIÓN","DESCRIPCION","Descripción","Descripcion","descripcion","Artículo","Articulo","ARTICULO","Insumo","Nombre"])||"").trim();
    map[codigo]={
      descripcion,
      descripcionAdicional:getInsumoExtra(r,descripcion),
      costoUnitario:toMoneyNumber(getValue(r,["COSTO UNITARIO","Costo Unitario","Costo unitario","Precio unitario con IVA","PRECIO UNITARIO CON IVA","precio unitario con IVA","Precio unitario","PRECIO UNITARIO","Precio","PRECIO","Costo","COSTO"])),
    };
  });
  return map;
}

async function queryDatasetSource(dataset,range,timeoutMs=45000){
  return fetchDatasetQuery(APPS_SCRIPT_URL,{
    dataset,
    desde:range.start,
    hasta:range.end,
    limit:"all",
    offset:0,
    sortBy:"fecha",
    sortDirection:"asc",
  },{timeoutMs});
}

function normalizeRop02Source(response,project){
  return scopeRows(
    normalizeROP02(safe(response?.data),project)
      .map(r=>({...r,maquina:resolveEquipmentCodeAlias(r.maquina)}))
  );
}

function normalizeRma15Source(response,project,insumosMap){
  return scopeRows(
    safe(response?.data)
      .map(r=>normalizeRMA15({...r,_proyectoForzado:project},insumosMap))
      .map(r=>({...r,maquina:resolveEquipmentCodeAlias(r.maquina)}))
  );
}

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
  const insumosMap=useMemo(()=>buildInsumosMap(props?.rawSources||{}),[props?.rawSources?.insumos]);
  const [ropHistory,setRopHistory]=useState({byProject:{},summary:null,error:""});
  const [rmaHistory,setRmaHistory]=useState({byProject:{},error:""});

  useEffect(()=>{
    if(!yearRange)return;
    let alive=true;

    // La consulta anual combinada de ROP02 abría las cuatro planillas en una sola
    // ejecución de Apps Script. En varias PCs esa ejecución agotaba el tiempo del
    // proxy y el dashboard terminaba usando solamente la carga reciente de App.jsx,
    // por eso julio/agosto aparecían en cero. Se consulta cada proyecto por separado:
    // una falla ya no invalida a los demás y cada lectura es mucho más liviana.
    (async()=>{
      const next={};
      const errors=[];
      const results=await Promise.allSettled(ROP02_SOURCES.map(async source=>{
        const response=await queryDatasetSource(source.dataset,yearRange,45000);
        const rows=normalizeRop02Source(response,source.project);
        if(!rows.length)throw new Error(`${source.project}: historial ROP02 vacío`);
        return{...source,rows};
      }));
      results.forEach((result,index)=>{
        const source=ROP02_SOURCES[index];
        if(result.status==="fulfilled")next[source.project]=result.value.rows;
        else errors.push(String(result.reason?.message||result.reason||`${source.project}: no se pudo cargar ROP02`));
      });
      if(alive)setRopHistory(prev=>({...prev,byProject:next,error:errors.join(" · ")}));
    })();

    getRop02MonthlySummary({limit:"all",offset:0}).then(response=>{
      if(!alive)return;
      if(response?.ok&&Array.isArray(response.data))setRopHistory(prev=>({...prev,summary:response.data}));
    }).catch(()=>{});

    return()=>{alive=false;};
  },[yearRange?.start,yearRange?.end]);

  useEffect(()=>{
    if(!yearRange||Object.keys(insumosMap).length===0)return;
    let alive=true;
    (async()=>{
      const next={};
      const errors=[];
      const results=await Promise.allSettled(RMA15_SOURCES.map(async source=>{
        const response=await queryDatasetSource(source.dataset,yearRange,45000);
        const rows=normalizeRma15Source(response,source.project,insumosMap);
        if(!rows.length)throw new Error(`${source.project}: historial RMA15 vacío`);
        return{...source,rows};
      }));
      results.forEach((result,index)=>{
        const source=RMA15_SOURCES[index];
        if(result.status==="fulfilled")next[source.project]=result.value.rows;
        else errors.push(String(result.reason?.message||result.reason||`${source.project}: no se pudo cargar RMA15`));
      });
      if(alive)setRmaHistory({byProject:next,error:errors.join(" · ")});
    })();
    return()=>{alive=false;};
  },[yearRange?.start,yearRange?.end,insumosMap]);

  const effectiveRop02=useMemo(()=>{
    let rows=scopeRows(props?.rop02All);

    // Reemplazar solamente el proyecto cuya consulta histórica real terminó bien.
    // Si José María falla pero Filo del Sol responde (o al revés), el proyecto sano
    // conserva todo su año y el fallido mantiene los datos ya cargados por App.jsx.
    Object.entries(ropHistory.byProject||{}).forEach(([project,historyRows])=>{
      if(!historyRows?.length||!yearRange)return;
      rows=rows.filter(r=>!(inRange(r,yearRange)&&projectMatches(r,project)));
      rows.push(...historyRows);
    });

    // El resumen mensual es únicamente fallback. Solo completa un mes/proyecto cuando
    // no existe ningún registro real para ese mismo mes/proyecto; nunca pisa datos reales.
    safe(ropHistory.summary).forEach(item=>{
      const month=String(item?.PERIODO??item?.periodo??"").trim();
      const project=String(item?.PROYECTO??item?.proyecto??"").trim();
      if(!month||!month.startsWith(`${reportingYear}-`)||!project)return;
      const hasReal=rows.some(r=>periodKeyForRow(r)===month&&projectMatches(r,project));
      if(!hasReal)rows.push(...summaryRowsToSynthetic(item));
    });

    return rows;
  },[props?.rop02All,ropHistory.byProject,ropHistory.summary,yearRange,reportingYear]);

  const effectiveRma15=useMemo(()=>{
    let rows=scopeRows(props?.rma15);
    Object.entries(rmaHistory.byProject||{}).forEach(([project,historyRows])=>{
      if(!historyRows?.length||!yearRange)return;
      rows=rows.filter(r=>!(inRange(r,yearRange)&&projectMatches(r,project)));
      rows.push(...historyRows);
    });
    return rows;
  },[props?.rma15,rmaHistory.byProject,yearRange]);

  return <ExecutiveDashboard {...props} rop02All={effectiveRop02} rma15={effectiveRma15}/>;
}
