import React,{useEffect,useMemo,useState} from "react";
import {
  C,Card,StatCard,Table,Badge,MultiSel,DateIn,PeriodMonthYear,TabBtn,Icon,matchMulti,multiIsAll
} from "../../components/ui/index.jsx";
import {
  fmtFecha,fmtNum,uniq,proyColor,
  dmTipoMaquinaOptions,dmMatchTipoMaquinaSeleccion,
  buildListaEquipoInfoIndex,getListaEquipoInfoMatch,excelFromCols
} from "../../shared/domain/index.jsx";
import {ViewRankingOperarios} from "../analytics/index.js";
import {
  buildOperatorEquipmentSummary,buildOperatorSummary,filterOperatorActivity,
  isOperatingRecord,latestActivityDate,latestOperatorEquipmentRows,operatorShiftCode
} from "./gestionHumanaData.js";

const ALL="todos";
const ALL_MACHINES="todas";

function ExportButton({onClick,label="Excel"}){
  return <button onClick={onClick} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,border:`1px solid ${C.green}44`,background:C.greenDim,color:C.green,cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"Inter"}}>⬇ {label}</button>;
}

function FilterShell({mode,setMode,fecha,setFecha,fechaD,setFechaD,fechaH,setFechaH,tipoMaquina,setTipoMaquina,proyecto,setProyecto,maquina,setMaquina,supervisor,setSupervisor,operario,setOperario,turno,setTurno,options,onReset}){
  const hasFilters=!multiIsAll(tipoMaquina,ALL_MACHINES)||!multiIsAll(proyecto,ALL)||!multiIsAll(maquina,ALL_MACHINES)||!multiIsAll(supervisor,ALL)||!multiIsAll(operario,ALL)||!multiIsAll(turno,ALL)||(mode==="dia"&&Boolean(fecha))||(mode==="periodo"&&(Boolean(fechaD)||Boolean(fechaH)));
  return(
    <Card>
      <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
          <TabBtn active={mode==="dia"} onClick={()=>setMode("dia")}>Por día</TabBtn>
          <TabBtn active={mode==="periodo"} onClick={()=>setMode("periodo")}>Por período</TabBtn>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"flex-end"}}>
          {mode==="dia"
            ?<DateIn label="Fecha" value={fecha} onChange={setFecha}/>
            :<><PeriodMonthYear fechaD={fechaD} fechaH={fechaH} setFechaD={setFechaD} setFechaH={setFechaH}/><DateIn label="Desde" value={fechaD} onChange={setFechaD} max={fechaH||undefined}/><DateIn label="Hasta" value={fechaH} onChange={setFechaH} min={fechaD||undefined} warn={fechaH&&fechaD&&fechaH<fechaD?"≥ Desde":null}/></>}
          <MultiSel label="Tipo de Máquina" value={tipoMaquina} onChange={value=>{setTipoMaquina(value);setMaquina(ALL_MACHINES);}} options={dmTipoMaquinaOptions()}/>
          <MultiSel label="Proyecto" value={proyecto} onChange={setProyecto} options={[{value:ALL,label:"Todos"},...options.proyectos.map(value=>({value,label:value}))]}/>
          <MultiSel label="Equipo" value={maquina} onChange={setMaquina} options={[{value:ALL_MACHINES,label:"Todos"},...options.maquinas.filter(value=>multiIsAll(tipoMaquina,ALL_MACHINES)||dmMatchTipoMaquinaSeleccion(value,tipoMaquina)).map(value=>({value,label:value}))]}/>
          <MultiSel label="Supervisor" value={supervisor} onChange={setSupervisor} options={[{value:ALL,label:"Todos"},...options.supervisores.map(value=>({value,label:value}))]}/>
          <MultiSel label="Operario" value={operario} onChange={setOperario} options={[{value:ALL,label:"Todos"},...options.operarios.map(value=>({value,label:value}))]}/>
          <MultiSel label="Turno" value={turno} onChange={setTurno} options={[{value:ALL,label:"Todos"},{value:"TD",label:"TD"},{value:"TN",label:"TN"}]}/>
          <button onClick={onReset} style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,border:`1px solid ${C.red}44`,background:C.redDim,color:C.red,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"Inter",opacity:hasFilters?1:.3,pointerEvents:hasFilters?"auto":"none"}}><Icon name="close" size={11} color={C.red}/>Limpiar filtros</button>
        </div>
      </div>
    </Card>
  );
}

function useOperatorFilterOptions(rop02All){
  return useMemo(()=>{
    const rows=(rop02All||[]).filter(isOperatingRecord);
    return{
      proyectos:uniq(rows.map(row=>row.proyecto).filter(Boolean)).sort(),
      maquinas:uniq(rows.map(row=>row.maquina).filter(Boolean)).sort(),
      supervisores:uniq(rows.map(row=>row.supervisor).filter(Boolean)).sort(),
      operarios:uniq(rows.map(row=>row.operario).filter(Boolean)).sort(),
    };
  },[rop02All]);
}

function useEquipmentLocationIndex(listaEquipos){
  return useMemo(()=>buildListaEquipoInfoIndex(listaEquipos||[]),[listaEquipos]);
}

function enrichOperatorRow(row,index){
  const info=getListaEquipoInfoMatch(index,row.maquina);
  const sitio=String(info?.sitioAlquiler||info?.ubicacion||row.proyecto||"S/D").trim()||"S/D";
  const tipo=String(info?.familia||row._tipo||row.equipo||"").trim()||"—";
  return{
    ...row,
    tipoEquipo:tipo,
    sitio,
    turnoCodigo:operatorShiftCode(row.turno),
  };
}

function OperadoresEnSitio({rop02All,listaEquipos}){
  const options=useOperatorFilterOptions(rop02All);
  const locationIndex=useEquipmentLocationIndex(listaEquipos);
  const maxDate=useMemo(()=>latestActivityDate(rop02All),[rop02All]);
  const[mode,setMode]=useState("dia");
  const[fecha,setFecha]=useState("");
  const[fechaD,setFechaD]=useState("");
  const[fechaH,setFechaH]=useState("");
  const[tipoMaquina,setTipoMaquina]=useState(ALL_MACHINES);
  const[proyecto,setProyecto]=useState(ALL);
  const[maquina,setMaquina]=useState(ALL_MACHINES);
  const[supervisor,setSupervisor]=useState(ALL);
  const[operario,setOperario]=useState(ALL);
  const[turno,setTurno]=useState(ALL);

  useEffect(()=>{if(!fecha&&maxDate)setFecha(maxDate);},[fecha,maxDate]);

  const filtered=useMemo(()=>filterOperatorActivity(rop02All,{
    mode,fecha,fechaD,fechaH,proyecto,maquina,supervisor,operario,turno,tipoMaquina,
    matchMulti,
    machineMatches:(machine,type)=>multiIsAll(type,ALL_MACHINES)||dmMatchTipoMaquinaSeleccion(machine,type),
  }),[rop02All,mode,fecha,fechaD,fechaH,proyecto,maquina,supervisor,operario,turno,tipoMaquina]);

  const currentRows=useMemo(()=>{
    const useLatestDateWhenUnbounded=mode==="periodo"&&!fechaD&&!fechaH;
    return latestOperatorEquipmentRows(filtered,{useLatestDateWhenUnbounded})
      .map(row=>enrichOperatorRow(row,locationIndex));
  },[filtered,locationIndex,mode,fechaD,fechaH]);

  const stats=useMemo(()=>({
    operadores:uniq(currentRows.map(row=>row.operario)).length,
    equipos:uniq(currentRows.map(row=>row.maquina)).length,
    proyectos:uniq(currentRows.map(row=>row.proyecto)).length,
    horas:currentRows.reduce((sum,row)=>sum+(Number(row.horas)||0),0),
  }),[currentRows]);

  const cols=useMemo(()=>[
    {key:"operario",label:"Operador",wrap:true},
    {key:"maquina",label:"Equipo",render:value=><Badge color={C.purple}>{value}</Badge>},
    {key:"tipoEquipo",label:"Tipo de equipo",wrap:true},
    {key:"proyecto",label:"Proyecto",render:value=><Badge color={proyColor(value)}>{value||"—"}</Badge>},
    {key:"sitio",label:"Sitio / ubicación",wrap:true},
    {key:"fecha",label:"Fecha",render:value=>fmtFecha(value)},
    {key:"turnoCodigo",label:"Turno",render:value=><Badge color={value==="TN"?C.purple:C.blue}>{value}</Badge>},
    {key:"supervisor",label:"Supervisor",wrap:true},
    {key:"parte",label:"Parte"},
    {key:"horas",label:"Horas",render:value=><span style={{color:C.accent,fontWeight:700}}>{fmtNum(value)}</span>},
  ],[]);

  const reset=()=>{
    setMode("dia");setFecha(maxDate||"");setFechaD("");setFechaH("");
    setTipoMaquina(ALL_MACHINES);setProyecto(ALL);setMaquina(ALL_MACHINES);setSupervisor(ALL);setOperario(ALL);setTurno(ALL);
  };

  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:14}}>
      <FilterShell {...{mode,setMode,fecha,setFecha,fechaD,setFechaD,fechaH,setFechaH,tipoMaquina,setTipoMaquina,proyecto,setProyecto,maquina,setMaquina,supervisor,setSupervisor,operario,setOperario,turno,setTurno,options,onReset:reset}}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>
        <StatCard icon="usersRound" label="Operadores" value={stats.operadores} sub="con actividad" color={C.accent} small/>
        <StatCard icon="truck" label="Equipos operados" value={stats.equipos} color={C.purple} small/>
        <StatCard icon="dashboard" label="Proyectos" value={stats.proyectos} color={C.teal} small/>
        <StatCard icon="hours" label="Horas registradas" value={fmtNum(stats.horas)} color={C.yellow} small/>
      </div>
      <Card title={`Operadores en sitio (${currentRows.length})`} action={<ExportButton onClick={()=>excelFromCols(cols,currentRows,"Operadores_en_sitio")}/>}>
        <Table cols={cols} rows={currentRows} maxH={560} emptyMsg="No hay registros de operadores para los filtros seleccionados."/>
      </Card>
      <div style={{fontSize:11,color:C.textMuted,padding:"0 4px"}}>
        Sitio/ubicación: se toma de la ubicación o lugar de alquiler de la Lista Maestra del equipo. Si no existe ese dato, se usa el proyecto informado en ROP02.
      </div>
    </div>
  );
}

function HistorialOperadores({rop02All,listaEquipos}){
  const options=useOperatorFilterOptions(rop02All);
  const locationIndex=useEquipmentLocationIndex(listaEquipos);
  const[mode,setMode]=useState("periodo");
  const[fecha,setFecha]=useState("");
  const[fechaD,setFechaD]=useState("");
  const[fechaH,setFechaH]=useState("");
  const[tipoMaquina,setTipoMaquina]=useState(ALL_MACHINES);
  const[proyecto,setProyecto]=useState(ALL);
  const[maquina,setMaquina]=useState(ALL_MACHINES);
  const[supervisor,setSupervisor]=useState(ALL);
  const[operario,setOperario]=useState(ALL);
  const[turno,setTurno]=useState(ALL);

  const filtered=useMemo(()=>filterOperatorActivity(rop02All,{
    mode,fecha,fechaD,fechaH,proyecto,maquina,supervisor,operario,turno,tipoMaquina,
    matchMulti,
    machineMatches:(machine,type)=>multiIsAll(type,ALL_MACHINES)||dmMatchTipoMaquinaSeleccion(machine,type),
  }),[rop02All,mode,fecha,fechaD,fechaH,proyecto,maquina,supervisor,operario,turno,tipoMaquina]);

  const sortedRows=useMemo(()=>[...filtered].sort((a,b)=>
    String(b.fecha||"").localeCompare(String(a.fecha||""))||
    operatorShiftCode(b.turno).localeCompare(operatorShiftCode(a.turno))||
    String(a.operario||"").localeCompare(String(b.operario||""))
  ).map(row=>enrichOperatorRow(row,locationIndex)),[filtered,locationIndex]);
  const summary=useMemo(()=>buildOperatorSummary(filtered),[filtered]);
  const equipmentSummary=useMemo(()=>buildOperatorEquipmentSummary(filtered),[filtered]);

  const historyCols=useMemo(()=>[
    {key:"fecha",label:"Fecha",render:value=>fmtFecha(value)},
    {key:"turnoCodigo",label:"Turno",render:value=><Badge color={value==="TN"?C.purple:C.blue}>{value}</Badge>},
    {key:"operario",label:"Operador",wrap:true},
    {key:"proyecto",label:"Proyecto",render:value=><Badge color={proyColor(value)}>{value||"—"}</Badge>},
    {key:"maquina",label:"Equipo",render:value=><Badge color={C.purple}>{value}</Badge>},
    {key:"tipoEquipo",label:"Tipo de equipo",wrap:true},
    {key:"sitio",label:"Sitio / ubicación",wrap:true},
    {key:"supervisor",label:"Supervisor",wrap:true},
    {key:"parte",label:"Parte"},
    {key:"horometroInicial",label:"HI",render:value=>fmtNum(value)},
    {key:"horometroFinal",label:"HF",render:value=>fmtNum(value)},
    {key:"horas",label:"Horas",render:value=><span style={{color:C.accent,fontWeight:700}}>{fmtNum(value)}</span>},
    {key:"tipo_trabajo",label:"Tarea realizada",wrap:true},
    {key:"observaciones",label:"Observaciones",wrap:true},
  ],[]);

  const equipmentCols=useMemo(()=>[
    {key:"maquina",label:"Equipo",render:value=><Badge color={C.purple}>{value}</Badge>},
    {key:"tipo",label:"Tipo",wrap:true},
    {key:"horas",label:"Horas",render:value=><span style={{color:C.accent,fontWeight:700}}>{fmtNum(value)}</span>},
    {key:"dias",label:"Días"},
    {key:"ultimaFecha",label:"Última fecha",render:value=>fmtFecha(value)},
    {key:"proyecto",label:"Proyecto",wrap:true},
  ],[]);

  const reset=()=>{
    setMode("periodo");setFecha("");setFechaD("");setFechaH("");
    setTipoMaquina(ALL_MACHINES);setProyecto(ALL);setMaquina(ALL_MACHINES);setSupervisor(ALL);setOperario(ALL);setTurno(ALL);
  };

  const exportName=multiIsAll(operario,ALL)?"Historial_operadores":`Historial_operador_${String(Array.isArray(operario)?operario.join("_"):operario).replace(/[^A-Za-z0-9_-]+/g,"_")}`;

  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:14}}>
      <FilterShell {...{mode,setMode,fecha,setFecha,fechaD,setFechaD,fechaH,setFechaH,tipoMaquina,setTipoMaquina,proyecto,setProyecto,maquina,setMaquina,supervisor,setSupervisor,operario,setOperario,turno,setTurno,options,onReset:reset}}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(135px,1fr))",gap:10}}>
        <StatCard icon="hours" label="Horas operadas" value={fmtNum(summary.hours)} color={C.accent} small/>
        <StatCard icon="calendar" label="Días con actividad" value={summary.days} color={C.blue} small/>
        <StatCard icon="truck" label="Equipos operados" value={summary.machines} color={C.purple} small/>
        <StatCard icon="dashboard" label="Proyectos" value={summary.projects} color={C.teal} small/>
        <StatCard icon="clipboardList" label="Registros" value={summary.records} color={C.yellow} small/>
      </div>
      <Card title={`Historial operativo (${sortedRows.length})`} action={<ExportButton onClick={()=>excelFromCols(historyCols,sortedRows,exportName)}/>}>
        <Table cols={historyCols} rows={sortedRows} maxH={520} emptyMsg="No hay actividad para los filtros seleccionados."/>
      </Card>
      <Card title={`Equipos operados (${equipmentSummary.length})`}>
        <Table cols={equipmentCols} rows={equipmentSummary} maxH={360} emptyMsg="No hay equipos operados para los filtros seleccionados."/>
      </Card>
    </div>
  );
}

export default function GestionHumanaRoute({view,rop02All=[],rop05=[],listaEquipos=[],rankingDeps,rankingState,setRankingState,onNavigate}){
  const tabs=[
    {id:"gestionHumanaSitio",label:"Operadores en sitio",icon:"usersRound"},
    {id:"gestionHumanaHistorial",label:"Historial de operadores",icon:"clipboardList"},
    {id:"gestionHumanaRanking",label:"Ranking de operarios",icon:"medal"},
  ];
  const active=tabs.some(tab=>tab.id===view)?view:"gestionHumanaSitio";
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <Card>
        <div style={{padding:"10px 14px",display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginRight:6}}>
            <Icon name="usersRound" size={17} color={C.accent}/>
            <span style={{fontSize:12,fontWeight:900,color:C.text,textTransform:"uppercase",letterSpacing:".06em"}}>Gestión Humana</span>
          </div>
          {tabs.map(tab=><TabBtn key={tab.id} active={active===tab.id} onClick={()=>onNavigate?.(tab.id)}>{tab.label}</TabBtn>)}
        </div>
      </Card>
      {active==="gestionHumanaSitio"&&<OperadoresEnSitio rop02All={rop02All} listaEquipos={listaEquipos}/>}
      {active==="gestionHumanaHistorial"&&<HistorialOperadores rop02All={rop02All} listaEquipos={listaEquipos}/>}
      {active==="gestionHumanaRanking"&&<ViewRankingOperarios deps={rankingDeps} rop02All={rop02All} rop05={rop05} extState={rankingState} setExtState={setRankingState}/>}
    </div>
  );
}
