import React, {useMemo, useState, useEffect} from "react";
import * as XLSX from "xlsx";
import { C as UI_C } from "../../components/ui/index.jsx";
import { getHoursExtremes } from "./hoursExtremes.js";
import { getMonthlyCutoffRange } from "./monthlyCutoffRange.js";

let C=UI_C, Icon, Spinner, Badge, StatCard, Card, Table, Sel, MultiSel, DateIn, PeriodMonthYear, TabBtn, AlertBanner, HelpTip;
let fmtNum, fmtFecha, uniq, normDate, cleanMachine, canonicalEquivalentMachineCode, isRop02ControlMachineExcluded, dmMatchTipoMaquinaSeleccion, dmTipoMaquinaOptions, matchMulti, multiIsAll, multiIncludes, normalizeMachineCode, getMachineType, isExcluded, excelFromCols, proyColor, semaforo, appAlert;
function applyDeps(deps={}){
 ({C:C=UI_C,Icon,Spinner,Badge,StatCard,Card,Table,Sel,MultiSel,DateIn,PeriodMonthYear,TabBtn,AlertBanner,HelpTip,fmtNum,fmtFecha,uniq,normDate,cleanMachine,canonicalEquivalentMachineCode,isRop02ControlMachineExcluded,dmMatchTipoMaquinaSeleccion,dmTipoMaquinaOptions,matchMulti,multiIsAll,multiIncludes,normalizeMachineCode,getMachineType,isExcluded,excelFromCols,proyColor,semaforo,appAlert}=deps);
}
function BtnExcel({onClick}){
  return(
    <button onClick={onClick} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,border:`1px solid ${C.green}44`,background:C.greenDim,color:C.green,cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"Inter"}}>
      ⬇ Excel
    </button>
  );
}
function ViewRankingOperariosInner({rop02All,rop05,extState,setExtState}){
  const rop02Prod=useMemo(()=>rop02All.filter(r=>!r._excluded&&r.estado==="TRABAJO"),[rop02All]);
  const proyecto=extState?.proyecto??"todos";
  const setProyecto=v=>setExtState(s=>({...s,proyecto:v}));
  const tipoMaquina=extState?.tipoMaquina??"todas";
  const setTipoMaquina=v=>setExtState(s=>({...s,tipoMaquina:v}));
  const modeR=extState?.modeR??"periodo";
  const setModeR=v=>setExtState(s=>({...s,modeR:v}));
  const fecha=extState?.fecha??"";
  const setFecha=v=>setExtState(s=>({...s,fecha:v}));
  const fechaD=extState?.fechaD??"";
  const setFechaD=v=>setExtState(s=>({...s,fechaD:v}));
  const fechaH=extState?.fechaH??"";
  const setFechaH=v=>setExtState(s=>({...s,fechaH:v}));
  const proyectos=useMemo(()=>uniq(rop02Prod.map(r=>r.proyecto)),[rop02Prod]);

  const filtered=useMemo(()=>rop02Prod.filter(r=>{
    if(!dmMatchTipoMaquinaSeleccion(r.maquina,tipoMaquina))return false;
    if(!matchMulti(r.proyecto,proyecto,"todos"))return false;
    if(modeR==="dia"){if(fecha&&r.fecha!==fecha)return false;}
    if(modeR==="periodo"){if(fechaD&&r.fecha<fechaD)return false;if(fechaH&&r.fecha>fechaH)return false;}
    return true;
  }),[rop02Prod,tipoMaquina,proyecto,modeR,fecha,fechaD,fechaH]);

  const hayFiltros=!multiIsAll(tipoMaquina,"todas")||!multiIsAll(proyecto,"todos")||(modeR==="dia"&&!!fecha)||(modeR==="periodo"&&(!!fechaD||!!fechaH));
  const reset=()=>{setModeR("periodo");setTipoMaquina("todas");setProyecto("todos");setFecha("");setFechaD("");setFechaH("");};

  const ranking=useMemo(()=>{
    const m={};
    filtered.forEach(r=>{
      if(!r.operario)return;
      if(!m[r.operario])m[r.operario]={operario:r.operario,horas:0,proyectos:new Set(),maquinas:new Set(),dias:new Set()};
      m[r.operario].horas+=r.horas;
      if(r.proyecto)m[r.operario].proyectos.add(r.proyecto);
      if(r.maquina)m[r.operario].maquinas.add(r.maquina);
      if(r.fecha)m[r.operario].dias.add(r.fecha);
    });
    return Object.values(m).map(op=>({
      ...op,
      proyectos:[...op.proyectos].join(" / "),
      maquinas:[...op.maquinas].sort().join(", "),
      diasTrabajados:op.dias.size,
      promHsDia:op.dias.size>0?Math.round((op.horas/op.dias.size)*10)/10:0,
    })).sort((a,b)=>b.horas-a.horas);
  },[filtered]);

  const maxHoras=ranking[0]?.horas||1;

  const cols=[
    {key:"operario",label:"Operario"},
    {key:"horas",label:"Horas",render:v=><span style={{color:C.accent,fontWeight:700}}>{fmtNum(v)}</span>},
    {key:"diasTrabajados",label:"Días",render:v=><span style={{color:C.blue,fontWeight:600}}>{v}</span>},
    {key:"promHsDia",label:"Hs/Día",render:v=><span style={{color:C.teal,fontWeight:600}}>{fmtNum(v)}</span>},
    {key:"proyectos",label:"Proyecto",render:v=><Badge color={proyColor(v)}>{v||"—"}</Badge>},
    {key:"maquinas",label:"Máquinas operadas",wrap:true},
  ];

  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:14}}>
      <Card>
        <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
          {/* Fila 1: tabs */}
          <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
            <TabBtn active={modeR==="dia"} onClick={()=>setModeR("dia")}>Por día</TabBtn>
            <TabBtn active={modeR==="periodo"} onClick={()=>setModeR("periodo")}>Por período</TabBtn>
          </div>
          {/* Fila 2: filtros */}
          <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"flex-end"}}>
            {modeR==="dia"&&<DateIn label="Fecha" value={fecha} onChange={setFecha}/>}
            {modeR==="periodo"&&<><PeriodMonthYear fechaD={fechaD} fechaH={fechaH} setFechaD={setFechaD} setFechaH={setFechaH}/><DateIn label="Desde" value={fechaD} onChange={setFechaD} max={fechaH||undefined}/><DateIn label="Hasta" value={fechaH} onChange={setFechaH} min={fechaD||undefined} warn={fechaH&&fechaD&&fechaH<fechaD?"≥ Desde":null}/></>}
            <MultiSel label="Tipo de Máquina" value={tipoMaquina} onChange={setTipoMaquina} options={dmTipoMaquinaOptions()}/>
            <MultiSel label="Proyecto" value={proyecto} onChange={setProyecto} options={[{value:"todos",label:"Todos"},...proyectos.map(p=>({value:p,label:p}))]}/>
            <button onClick={reset} style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,border:`1px solid ${C.red}44`,background:C.redDim,color:C.red,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"Inter",opacity:hayFiltros?1:0.3,pointerEvents:hayFiltros?"auto":"none"}}><Icon name="close" size={11} color={C.red}/>Limpiar filtros</button>
          </div>
        </div>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10}}>
        <StatCard icon="consist" label="Operarios" value={ranking.length} color={C.purple} small/>
        <StatCard icon="hours" label="Horas totales" value={fmtNum(ranking.reduce((s,r)=>s+r.horas,0))} color={C.accent} small/>
        <StatCard icon="equip" label="Equipos distintos" value={new Set(filtered.map(r=>r.maquina)).size} color={C.teal} small/>
      </div>
      {ranking.length>0&&(
        <Card title="Top 15 Operarios — Horas trabajadas">
          <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:8}}>
            {ranking.slice(0,15).map((op,i)=>{
              const pct=maxHoras>0?(op.horas/maxHoras)*100:0;
              const sem=semaforo(Math.min(100,op.promHsDia/12*100));
              return(
                <div key={i} style={{display:"flex",flexDirection:"column",gap:3}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:11,fontWeight:800,color:C.accent,width:20,textAlign:"right",flexShrink:0,fontFamily:"Inter"}}>{i+1}</span>
                    <span style={{fontSize:12,color:C.text,flex:1,fontWeight:600}}>{op.operario}</span>
                    <span style={{fontSize:11,color:C.textSub,flexShrink:0}}>{op.proyectos}</span>
                    <span style={{fontSize:12,fontWeight:700,color:C.accent,flexShrink:0,minWidth:50,textAlign:"right"}}>{fmtNum(op.horas)} hs</span>
                    <span style={{fontSize:10,color:sem.color,flexShrink:0,minWidth:60,textAlign:"right"}}>{fmtNum(op.promHsDia)} hs/día</span>
                  </div>
                  <div style={{marginLeft:28,background:C.border,borderRadius:3,height:5,overflow:"hidden"}}>
                    <div style={{width:`${pct}%`,height:"100%",background:C.accent,borderRadius:3,transition:"width .4s ease"}}/>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
      <Card title={`Tabla completa (${ranking.length} operarios)`} action={<BtnExcel onClick={()=>excelFromCols(cols,ranking,"Ranking_Operarios")}/>}>
        <Table cols={cols} rows={ranking} maxH={450} emptyMsg="Sin datos con los filtros seleccionados"/>
      </Card>
    </div>
  );
}


function HealthDashboardInner({health,onLoadAll,loading}){
  const rows=Object.entries(health?.sources||{}).map(([key,v])=>({
    key,
    fuente:v.label||key,
    filas:v.rows??"—",
    estado:v.ok?"OK":"Error",
    latencia:v.latency?`${v.latency} ms`:"—",
  }));
  const total=rows.reduce((sum,r)=>sum+(typeof r.filas==="number"?r.filas:0),0);
  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:16}}>
      <AlertBanner type="info">Inicio rápido activo: la app abrió solo con diagnóstico. Los datos pesados se cargan recién cuando entrás a cada pestaña.</AlertBanner>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
        <StatCard icon="check" label="Fuentes OK" value={rows.filter(r=>r.estado==="OK").length} color={C.green}/>
        <StatCard icon="parts" label="Filas detectadas" value={fmtNum(total)} color={C.blue}/>
        <StatCard icon="refresh" label="Modo" value="Lazy" sub="Carga por pestaña" color={C.accent}/>
      </div>
      <Card title="Estado de fuentes" action={<button onClick={onLoadAll} disabled={loading} style={{background:C.accent,border:"none",borderRadius:7,color:"#fff",padding:"7px 12px",fontSize:12,fontWeight:700,cursor:loading?"not-allowed":"pointer"}}>{loading?"Cargando...":"Cargar dashboard completo"}</button>}>
        <Table cols={[
          {key:"fuente",label:"Fuente"},
          {key:"filas",label:"Filas"},
          {key:"estado",label:"Estado",render:v=><Badge color={v==="OK"?C.green:C.red}>{v}</Badge>},
          {key:"latencia",label:"Lectura"},
        ]} rows={rows} maxH={360} emptyMsg="Sin diagnóstico todavía"/>
      </Card>
    </div>
  );
}

// ─── ViewCostosMant ──────────────────────────────────────────────────────────

const CAMBIOS_TURNO_BASE = "2026-06-24";
const CAMBIOS_TURNO_DIAS = 14;
const CAMBIOS_TURNO_GRUPOS = [
  {
    id: 1,
    nombre: "Grupo 1",
    color: "#22c55e",
    jm: ["Federico Perea", "Marcelo Vedia"],
    fs: ["Carlos Sisterna"],
  },
  {
    id: 2,
    nombre: "Grupo 2",
    color: "#3b82f6",
    jm: ["Marco Aguilera", "Alfredo Vedia"],
    fs: ["Gilberto Ezeiza"],
  },
];
function turnoDateFromISO(iso){
  const [y,m,d]=String(iso).slice(0,10).split("-").map(Number);
  return new Date(y,(m||1)-1,d||1,12,0,0,0);
}
function turnoISO(date){
  const d=new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function addTurnoDays(date,days){
  const d=new Date(date);
  d.setDate(d.getDate()+days);
  return d;
}
function diffTurnoDays(a,b){
  const da=new Date(a.getFullYear(),a.getMonth(),a.getDate()).getTime();
  const db=new Date(b.getFullYear(),b.getMonth(),b.getDate()).getTime();
  return Math.floor((da-db)/86400000);
}
function indiceGrupoTurno(bloque){
  return ((bloque % CAMBIOS_TURNO_GRUPOS.length) + CAMBIOS_TURNO_GRUPOS.length) % CAMBIOS_TURNO_GRUPOS.length;
}
function grupoPorFecha(date){
  const base=turnoDateFromISO(CAMBIOS_TURNO_BASE);
  const diff=diffTurnoDays(date,base);
  const bloque=Math.floor(diff/CAMBIOS_TURNO_DIAS);
  return CAMBIOS_TURNO_GRUPOS[indiceGrupoTurno(bloque)];
}
export function rangoTurnoPorFecha(date){
  const base=turnoDateFromISO(CAMBIOS_TURNO_BASE);
  const diff=diffTurnoDays(date,base);
  const bloque=Math.floor(diff/CAMBIOS_TURNO_DIAS);
  const inicio=addTurnoDays(base,bloque*CAMBIOS_TURNO_DIAS);
  const fin=addTurnoDays(inicio,CAMBIOS_TURNO_DIAS-1);
  const proximoCambio=addTurnoDays(inicio,CAMBIOS_TURNO_DIAS);
  return {inicio,fin,proximoCambio,grupo:grupoPorFecha(date),grupoSiguiente:grupoPorFecha(proximoCambio)};
}
function ViewCambiosTurnoInner({rop02All=[]}){
  const hoy=new Date();
  const MESES_TURNO=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const [mes,setMes]=useState(()=>new Date(hoy.getFullYear(),hoy.getMonth(),1,12));
  const [filtroMesHoras,setFiltroMesHoras]=useState(()=>String(hoy.getMonth()));
  const [filtroAnioHoras,setFiltroAnioHoras]=useState(()=>String(hoy.getFullYear()));
  const [filtroProyectoHoras,setFiltroProyectoHoras]=useState("todos");
  const [filtroEquipoHoras,setFiltroEquipoHoras]=useState("todas");
  const [filtroTipoHoras,setFiltroTipoHoras]=useState("todos");
  const turnoActual=useMemo(()=>rangoTurnoPorFecha(hoy),[]);
  const diasMes=useMemo(()=>{
    const first=new Date(mes.getFullYear(),mes.getMonth(),1,12);
    const startDay=(first.getDay()+6)%7; // lunes = 0
    const start=addTurnoDays(first,-startDay);
    return Array.from({length:42},(_,i)=>addTurnoDays(start,i));
  },[mes]);
  const monthLabel=mes.toLocaleDateString("es-AR",{month:"long",year:"numeric"});
  const moverMes=n=>setMes(m=>new Date(m.getFullYear(),m.getMonth()+n,1,12));
  const irHoy=()=>setMes(new Date(hoy.getFullYear(),hoy.getMonth(),1,12));

  const esCamionOCamionetaTurno=(row,maquina)=>{
    const tipo=String(row?.equipo||row?._tipo||getMachineType(maquina)||"").toUpperCase();
    const code=String(maquina||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
    return tipo.includes("CAMION")||tipo.includes("CAMIÓN")||tipo.includes("CAMIONETA")||
      /^CTA/.test(code)||/^CAR/.test(code)||/^CAV/.test(code)||/^CAT[0-9]/.test(code)||
      /^[A-Z]{2}[0-9]{3}[A-Z]{2}$/.test(code)||/^[A-Z]{3}[0-9]{3}[A-Z]{2}$/.test(code)||/^AG[0-9]/.test(code)||/^AH[0-9]/.test(code);
  };

  const periodoHorasTurno=useMemo(()=>{
    const anio=Number(filtroAnioHoras)||hoy.getFullYear();
    const mesIdx=Number(filtroMesHoras)||0;
    // Período operativo: del 26 del mes anterior al 25 del mes seleccionado.
    // Ejemplo: Junio 2026 = 26/05/2026 al 25/06/2026.
    const rango=getMonthlyCutoffRange(mesIdx,anio);
    const diasPeriodo=diffTurnoDays(rango.end,rango.start)+1;
    return {
      desde:rango.startISO,
      hasta:rango.endISO,
      diasPeriodo,
      label:`${MESES_TURNO[mesIdx]} ${anio}`,
      rangoLabel:`${fmtFecha(rango.startISO)} al ${fmtFecha(rango.endISO)}`
    };
  },[filtroMesHoras,filtroAnioHoras]);

  const filasHorasTurnoBase=useMemo(()=>{
    return (rop02All||[]).filter(r=>{
      const fecha=normDate(r.fecha)||String(r.fecha||"").slice(0,10);
      if(!fecha||fecha<periodoHorasTurno.desde||fecha>periodoHorasTurno.hasta)return false;
      const maquina=cleanMachine(r.maquina||r._internoRaw||"");
      if(!maquina)return false;
      if(isRop02ControlMachineExcluded(maquina))return false;
      if(esCamionOCamionetaTurno(r,maquina))return false;
      return true;
    });
  },[rop02All,periodoHorasTurno]);

  const opcionesProyectoHoras=useMemo(()=>uniq(filasHorasTurnoBase.map(r=>r.proyecto).filter(Boolean)).sort(),[filasHorasTurnoBase]);
  const opcionesTipoHoras=useMemo(()=>{
    const base=filasHorasTurnoBase.filter(r=>matchMulti(r.proyecto,filtroProyectoHoras,"todos"));
    return uniq(base.map(r=>r.equipo||r._tipo||getMachineType(r.maquina||r._internoRaw||"")).filter(Boolean)).sort();
  },[filasHorasTurnoBase,filtroProyectoHoras]);
  const opcionesEquipoHoras=useMemo(()=>{
    const base=filasHorasTurnoBase.filter(r=>{
      const tipo=r.equipo||r._tipo||getMachineType(r.maquina||r._internoRaw||"")||"";
      return matchMulti(r.proyecto,filtroProyectoHoras,"todos")&&matchMulti(tipo,filtroTipoHoras,"todos");
    });
    return uniq(base.map(r=>cleanMachine(r.maquina||r._internoRaw||"")).filter(Boolean)).sort();
  },[filasHorasTurnoBase,filtroProyectoHoras,filtroTipoHoras]);

  useEffect(()=>{
    if(!multiIsAll(filtroProyectoHoras,"todos")&&filtroProyectoHoras.some(p=>!opcionesProyectoHoras.includes(p)))setFiltroProyectoHoras("todos");
  },[opcionesProyectoHoras,filtroProyectoHoras]);
  useEffect(()=>{
    if(!multiIsAll(filtroTipoHoras,"todos")&&filtroTipoHoras.some(t=>!opcionesTipoHoras.includes(t)))setFiltroTipoHoras("todos");
  },[opcionesTipoHoras,filtroTipoHoras]);
  useEffect(()=>{
    if(!multiIsAll(filtroEquipoHoras,"todas")&&filtroEquipoHoras.some(e=>!opcionesEquipoHoras.includes(e)))setFiltroEquipoHoras("todas");
  },[opcionesEquipoHoras,filtroEquipoHoras]);

  const mesCorrienteInfo=useMemo(()=>{
    const map=new Map();
    filasHorasTurnoBase.forEach(r=>{
      const fecha=normDate(r.fecha)||String(r.fecha||"").slice(0,10);
      if(!matchMulti(r.proyecto,filtroProyectoHoras,"todos"))return;
      const tipo=r.equipo||r._tipo||getMachineType(r.maquina||r._internoRaw||"")||"";
      if(!matchMulti(tipo,filtroTipoHoras,"todos"))return;
      const maquina=cleanMachine(r.maquina||r._internoRaw||"");
      if(!matchMulti(maquina,filtroEquipoHoras,"todas"))return;
      const horas=Number(r.horas||0);
      const horasValidas=Number.isFinite(horas)&&horas>0?horas:0;
      const estado=String(r.estado||"").trim().toUpperCase();
      const key=canonicalEquivalentMachineCode(maquina)||cleanMachine(maquina);
      const prev=map.get(key)||{maquina,proyecto:r.proyecto||"",equipo:tipo||"",horas:0,td:0,tn:0,diasTrabajados:new Set(),diasOD:new Set(),diasFSEM:new Set(),diasPorFecha:new Map(),turnosPorFecha:new Map(),ultimaFecha:""};
      prev.horas+=horasValidas;
      const diaInfo=prev.diasPorFecha.get(fecha)||{trabajado:false,od:false,fsem:false};
      if(estado==="OD")diaInfo.od=true;
      else if(estado==="FS"||estado==="EM")diaInfo.fsem=true;
      else if(horasValidas>0)diaInfo.trabajado=true;
      prev.diasPorFecha.set(fecha,diaInfo);
      const turno=String(r.turno||r["Turno de trabajo"]||r["Turno"]||r.col_6||"")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g,"")
        .replace(/[.\s_-]+/g,"")
        .trim()
        .toUpperCase();
      const esTD=turno.includes("TD")||turno.includes("DIA")||turno.includes("DIURNO");
      const esTN=turno.includes("TN")||turno.includes("NOCHE")||turno.includes("NOCTURNO");
      if(horasValidas>0&&(esTD||esTN)){
        const turnosFecha=prev.turnosPorFecha.get(fecha)||new Set();
        if(esTD)turnosFecha.add("TD");
        if(esTN)turnosFecha.add("TN");
        prev.turnosPorFecha.set(fecha,turnosFecha);
      }
      if(horasValidas>0&&esTD)prev.td+=horasValidas;
      else if(horasValidas>0&&esTN)prev.tn+=horasValidas;
      if(fecha>prev.ultimaFecha)prev.ultimaFecha=fecha;
      if(!prev.proyecto&&r.proyecto)prev.proyecto=r.proyecto;
      if(!prev.equipo&&tipo)prev.equipo=tipo;
      map.set(key,prev);
    });
    const equipos=[...map.values()]
      .map(x=>{
        let diasTrabajados=0;
        let diasOD=0;
        let diasFSEM=0;
        [...(x.diasPorFecha||new Map()).values()].forEach(dia=>{
          // Cada fecha calendario cuenta una sola vez. Si el equipo trabajó al menos un turno,
          // el día se clasifica como trabajado; si no trabajó, se evalúa OD y luego FS/EM.
          if(dia.trabajado) diasTrabajados+=1;
          else if(dia.od) diasOD+=1;
          else if(dia.fsem) diasFSEM+=1;
        });
        const totalDiasControl=diasTrabajados+diasOD+diasFSEM;
        const diasTurnoDiaYNoche=[...x.turnosPorFecha.entries()]
          .filter(([,turnos])=>turnos.has("TD")&&turnos.has("TN"))
          .map(([fecha])=>fecha)
          .sort();
        return {
          ...x,
          diasTrabajados,
          diasOD,
          diasFSEM,
          totalDiasControl,
          diasPeriodo:periodoHorasTurno.diasPeriodo,
          excesoDias:totalDiasControl>periodoHorasTurno.diasPeriodo,
          diasTurnoDiaYNoche,
          horas:Number(x.horas.toFixed(2)),
          td:Number(x.td.toFixed(2)),
          tn:Number(x.tn.toFixed(2))
        };
      })
      .sort((a,b)=>b.horas-a.horas||String(a.maquina).localeCompare(String(b.maquina)));
    return{desde:periodoHorasTurno.desde,hasta:periodoHorasTurno.hasta,equipos,totalHoras:equipos.reduce((a,x)=>a+x.horas,0),totalEquipos:equipos.length};
  },[filasHorasTurnoBase,periodoHorasTurno,filtroProyectoHoras,filtroTipoHoras,filtroEquipoHoras]);

  const hayFiltrosHoras=filtroMesHoras!==String(hoy.getMonth())||filtroAnioHoras!==String(hoy.getFullYear())||!multiIsAll(filtroProyectoHoras,"todos")||!multiIsAll(filtroEquipoHoras,"todas")||!multiIsAll(filtroTipoHoras,"todos");
  const resetFiltrosHoras=()=>{setFiltroMesHoras(String(hoy.getMonth()));setFiltroAnioHoras(String(hoy.getFullYear()));setFiltroProyectoHoras("todos");setFiltroEquipoHoras("todas");setFiltroTipoHoras("todos");};
  const extremosHoras=useMemo(()=>getHoursExtremes(mesCorrienteInfo.equipos),[mesCorrienteInfo.equipos]);
  const resumenEquipoHoras=row=>row
    ? [`${fmtNum(row.horas)} hs`,row.proyecto,row.equipo].filter(Boolean).join(" · ")
    : "Sin datos para los filtros seleccionados";

  const escapeHtmlTurno=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
  const tooltipExcesoDiasTurno=(row)=>{
    const dias=(row?.diasTurnoDiaYNoche||[]);
    const tieneDobleTurno=dias.length>0;
    if(!row?.excesoDias&&!tieneDobleTurno)return null;

    const lista=dias.length
      ? dias.map(d=>`<div style=\"padding:2px 0;color:${C.text}\">${escapeHtmlTurno(fmtFecha(d))} · TD y TN</div>`).join("")
      : `<div style=\"color:${C.textMuted};font-style:italic;margin-top:4px\">No se detectaron días con TD y TN en los datos filtrados.</div>`;

    const titulo=row.excesoDias
      ? `${escapeHtmlTurno(row.maquina)} supera los días del período`
      : `${escapeHtmlTurno(row.maquina)} tiene días con TD y TN`;

    const detalleExceso=row.excesoDias
      ? `<div style=\"margin-top:3px;color:${C.textSub}\">Total computado: <b style=\"color:${C.text}\">${row.totalDiasControl}</b> días · Período: <b style=\"color:${C.text}\">${row.diasPeriodo}</b> días</div>`
      : "";

    return `<div>
      <div style=\"font-size:10px;color:${C.yellow};text-transform:uppercase;letter-spacing:.06em;font-weight:800\">Control de doble turno</div>
      <div style=\"margin-top:4px;color:${C.text};font-weight:800\">${titulo}</div>
      ${detalleExceso}
      <div style=\"margin-top:8px;font-size:10px;color:${C.textMuted};text-transform:uppercase;letter-spacing:.06em\">Días con turno día y noche</div>
      <div style=\"margin-top:3px\">${lista}</div>
    </div>`;
  };

  const colsEquiposFinTurno=[
    {key:"maquina",label:"Equipo",render:v=><span style={{fontWeight:800,color:C.text}}>{v}</span>},
    {key:"equipo",label:"Tipo"},
    {key:"proyecto",label:"Proyecto",render:v=><Badge color={proyColor(v)}>{v||"—"}</Badge>},
    {key:"diasTrabajados",label:"Días trabajados",render:v=>fmtNum(v)},
    {key:"diasOD",label:"Días OD",render:v=>fmtNum(v)},
    {key:"diasFSEM",label:"Días FS/EM",render:v=>fmtNum(v)},
    {key:"td",label:"Hs TD",render:v=>v?fmtNum(v):"—"},
    {key:"tn",label:"Hs TN",render:v=>v?fmtNum(v):"—"},
    {key:"horas",label:"Hs Totales",render:v=><span style={{fontWeight:900,color:C.green}}>{fmtNum(v)}</span>},
    {key:"ultimaFecha",label:"Último registro",render:v=>v?fmtFecha(v):"—"},
  ];
  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>
        <StatCard icon="person" label="Grupo trabajando hoy" value={turnoActual.grupo.nombre} sub={`${fmtFecha(turnoISO(turnoActual.inicio))} al ${fmtFecha(turnoISO(turnoActual.fin))}`} color={turnoActual.grupo.color} small/>
        <StatCard icon="consist" label="Próximo cambio" value={fmtFecha(turnoISO(turnoActual.proximoCambio))} sub={`Ingresa ${turnoActual.grupoSiguiente.nombre}`} color={C.yellow} small/>
        <StatCard icon="hours" label="Equipo con más horas" value={extremosHoras.max?.maquina||"—"} sub={resumenEquipoHoras(extremosHoras.max)} color={C.green} small/>
        <StatCard icon="hours" label="Equipo con menos horas" value={extremosHoras.min?.maquina||"—"} sub={resumenEquipoHoras(extremosHoras.min)} color={C.blue} small/>
      </div>

      <Card title="Equipos al fin de turno" action={<BtnExcel onClick={()=>excelFromCols(colsEquiposFinTurno,mesCorrienteInfo.equipos,"Equipos_al_fin_de_turno")}/>}>
        <div style={{padding:14,display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"flex-end"}}>
            <Sel label="Mes" value={filtroMesHoras} onChange={setFiltroMesHoras} options={MESES_TURNO.map((m,i)=>({value:String(i),label:m}))}/>
            <Sel label="Año" value={filtroAnioHoras} onChange={setFiltroAnioHoras} options={uniq(["2026","2027","2028",...((rop02All||[]).map(r=>(normDate(r.fecha)||String(r.fecha||"")).slice(0,4)).filter(Boolean))]).sort((a,b)=>Number(b)-Number(a)).map(y=>({value:y,label:y}))}/>
            <MultiSel label="Proyecto" value={filtroProyectoHoras} onChange={v=>{setFiltroProyectoHoras(v);setFiltroEquipoHoras("todas");}} options={[{value:"todos",label:"Todos"},...opcionesProyectoHoras.map(p=>({value:p,label:p}))]}/>
            <MultiSel label="Equipo" value={filtroEquipoHoras} onChange={setFiltroEquipoHoras} options={[{value:"todas",label:"Todos"},...opcionesEquipoHoras.map(e=>({value:e,label:e}))]}/>
            <MultiSel label="Tipo de Máquina" value={filtroTipoHoras} onChange={v=>{setFiltroTipoHoras(v);setFiltroEquipoHoras("todas");}} options={[{value:"todos",label:"Todos"},...opcionesTipoHoras.map(t=>({value:t,label:t}))]}/>
            <button onClick={resetFiltrosHoras} style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,border:`1px solid ${C.red}44`,background:C.redDim,color:C.red,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"Inter",opacity:hayFiltrosHoras?1:0.3,pointerEvents:hayFiltrosHoras?"auto":"none"}}>
              <Icon name="close" size={11} color={C.red}/>Limpiar filtros
            </button>
          </div>
          <div style={{fontSize:11,color:C.textSub}}>Análisis sin camionetas ni camiones. Período: <strong style={{color:C.text}}>{fmtFecha(mesCorrienteInfo.desde)} al {fmtFecha(mesCorrienteInfo.hasta)}</strong></div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>
            <StatCard icon="bulldozer" label="Equipos con horas" value={fmtNum(mesCorrienteInfo.totalEquipos)} sub={`${fmtFecha(mesCorrienteInfo.desde)} al ${fmtFecha(mesCorrienteInfo.hasta)}`} color={C.green} small/>
            <StatCard icon="hours" label="Horas acumuladas" value={fmtNum(Number(mesCorrienteInfo.totalHoras.toFixed(2)))} sub={`Período ${periodoHorasTurno.rangoLabel}`} color={C.accent} small/>
            <StatCard icon="consist" label="Criterio" value={periodoHorasTurno.label} sub="Corte 26 al 25 · ROP02 filtrado" color={C.purple} small/>
          </div>
          <Table cols={colsEquiposFinTurno} rows={mesCorrienteInfo.equipos.map(r=>({...r,_rowTooltipHtml:tooltipExcesoDiasTurno(r)}))} maxH={420} emptyMsg="No hay horas cargadas en ROP02 para los filtros seleccionados."/>
        </div>
      </Card>

      <Card title="Calendario de cambios de turno" action={
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={()=>moverMes(-1)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,padding:"6px 10px",cursor:"pointer"}}>←</button>
          <button onClick={irHoy} style={{background:C.accentDim,border:`1px solid ${C.accent}55`,borderRadius:7,color:C.accent,padding:"6px 10px",cursor:"pointer",fontWeight:700}}>Hoy</button>
          <button onClick={()=>moverMes(1)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,padding:"6px 10px",cursor:"pointer"}}>→</button>
        </div>
      }>
        <div style={{padding:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,gap:12,flexWrap:"wrap"}}>
            <div style={{fontSize:18,fontWeight:800,color:C.text,textTransform:"capitalize"}}>{monthLabel}</div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",fontSize:12,color:C.textSub}}>
              {CAMBIOS_TURNO_GRUPOS.map(g=><span key={g.id} style={{display:"flex",alignItems:"center",gap:6}}><span style={{width:10,height:10,borderRadius:"50%",background:g.color,display:"inline-block"}}/> {g.nombre}</span>)}
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6,marginBottom:6}}>
            {["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map(d=><div key={d} style={{fontSize:11,color:C.textMuted,fontWeight:700,textAlign:"center",textTransform:"uppercase"}}>{d}</div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6}}>
            {diasMes.map(d=>{
              const g=grupoPorFecha(d);
              const iso=turnoISO(d);
              const enMes=d.getMonth()===mes.getMonth();
              const esHoy=iso===turnoISO(hoy);
              const esCambio=iso===turnoISO(rangoTurnoPorFecha(d).inicio);
              return(
                <div key={iso} title={`${fmtFecha(iso)} · ${g.nombre}${esCambio?" · Cambio de turno":""}`} style={{minHeight:76,borderRadius:10,border:`1px solid ${esHoy?C.accent:g.color+"44"}`,background:enMes?g.color+"18":"rgba(255,255,255,.03)",padding:9,opacity:enMes?1:.38,position:"relative",boxShadow:esHoy?`0 0 0 2px ${C.accent}33`:"none"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:6}}>
                    <span style={{fontSize:13,fontWeight:800,color:esHoy?C.accent:C.text}}>{d.getDate()}</span>
                    {esCambio&&<span style={{fontSize:9,fontWeight:800,color:C.yellow,background:C.yellowDim,border:`1px solid ${C.yellow}55`,borderRadius:10,padding:"1px 5px"}}>CAMBIO</span>}
                  </div>
                  <div style={{marginTop:12,fontSize:12,fontWeight:800,color:g.color}}>{g.nombre}</div>
                  <div style={{fontSize:10,color:C.textMuted,marginTop:2}}>{g.id===1?"Perea / M. Vedia / Sisterna":"Aguilera / A. Vedia / Ezeiza"}</div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}

export function ViewRankingOperarios({deps,...props}){applyDeps(deps);return <ViewRankingOperariosInner {...props}/>;}
export function HealthDashboard({deps,...props}){applyDeps(deps);return <HealthDashboardInner {...props}/>;}
export function ViewCambiosTurno({deps,...props}){applyDeps(deps);return <ViewCambiosTurnoInner {...props}/>;}
