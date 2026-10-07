import React,{useEffect,useMemo,useState} from "react";
import {
  C,Card,StatCard,Table,Badge,MultiSel,Sel,DateIn,PeriodMonthYear,TabBtn,Icon,matchMulti,multiIsAll
} from "../../components/ui/index.jsx";
import {
  fmtFecha,fmtNum,uniq,proyColor,
  dmTipoMaquinaOptions,dmMatchTipoMaquinaSeleccion,
  buildListaEquipoInfoIndex,getListaEquipoInfoMatch,excelFromCols
} from "../../shared/domain/index.jsx";
import {ViewRankingOperarios} from "../analytics/index.js";
import {
  buildOperatorProfile,filterOperatorActivity,
  isOperatingRecord,latestActivityDate,latestOperatorEquipmentRows,operatorShiftCode
} from "./gestionHumanaData.js";

const ALL="todos";
const ALL_MACHINES="todas";

function ExportButton({onClick,label="Excel"}){
  return <button onClick={onClick} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,border:`1px solid ${C.green}44`,background:C.greenDim,color:C.green,cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"Inter"}}>⬇ {label}</button>;
}

function stableTone(value){
  const palette=[C.accent,C.blue,C.teal,C.purple,C.yellow,C.green,C.red].filter(Boolean);
  const text=String(value||"").trim().toUpperCase();
  let hash=0;
  for(let i=0;i<text.length;i++)hash=((hash<<5)-hash+text.charCodeAt(i))|0;
  return palette[Math.abs(hash)%palette.length]||"#94a3b8";
}

function equipmentTypeColor(value){
  const text=String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();
  if(text.includes("CARGADOR"))return C.blue;
  if(text.includes("TOPADORA"))return C.yellow;
  if(text.includes("MOTONIVELADORA"))return C.purple;
  if(text.includes("EXCAVADORA"))return C.red;
  if(text.includes("MINICARGADORA"))return C.teal;
  if(text.includes("RETROPALA"))return C.green;
  if(text.includes("RODILLO"))return C.accent;
  return stableTone(text);
}

function ColorTag({value,color}){
  const tone=color||stableTone(value);
  return <span style={{display:"inline-flex",alignItems:"center",maxWidth:"100%",padding:"3px 8px",borderRadius:999,border:`1px solid ${tone}66`,background:`${tone}18`,color:tone,fontSize:10,fontWeight:900,lineHeight:1.2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{value||"—"}</span>;
}

function ProfileFact({label,children}){
  return <div style={{minWidth:0,padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}66`,background:C.surface+"88"}}>
    <div style={{fontSize:9,fontWeight:900,letterSpacing:".08em",textTransform:"uppercase",color:C.textMuted,marginBottom:5}}>{label}</div>
    <div style={{fontSize:12,fontWeight:800,color:C.text,minWidth:0,overflow:"hidden",textOverflow:"ellipsis"}}>{children||"—"}</div>
  </div>;
}

function TagList({values=[]}){
  if(!values.length)return <span style={{color:C.textMuted}}>—</span>;
  return <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{values.map(value=><ColorTag key={value} value={value}/>)}</div>;
}

function FilterShell({mode,setMode,fecha,setFecha,fechaD,setFechaD,fechaH,setFechaH,tipoMaquina,setTipoMaquina,proyecto,setProyecto,maquina,setMaquina,supervisor,setSupervisor,operario,setOperario,turno,setTurno,options,onReset,singleOperator=false}){
  const operatorHasFilter=singleOperator?Boolean(String(operario||"").trim()):!multiIsAll(operario,ALL);
  const hasFilters=!multiIsAll(tipoMaquina,ALL_MACHINES)||!multiIsAll(proyecto,ALL)||!multiIsAll(maquina,ALL_MACHINES)||!multiIsAll(supervisor,ALL)||operatorHasFilter||!multiIsAll(turno,ALL)||(mode==="dia"&&Boolean(fecha))||(mode==="periodo"&&(Boolean(fechaD)||Boolean(fechaH)));
  const operatorControl=singleOperator
    ?<Sel label="Operario" value={String(operario||"")} onChange={setOperario} options={[{value:"",label:"Seleccionar operador..."},...options.operarios.map(value=>({value,label:value}))]}/>
    :<MultiSel label="Operario" value={operario} onChange={setOperario} options={[{value:ALL,label:"Todos"},...options.operarios.map(value=>({value,label:value}))]}/>;
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
          {singleOperator&&operatorControl}
          <MultiSel label="Tipo de Máquina" value={tipoMaquina} onChange={value=>{setTipoMaquina(value);setMaquina(ALL_MACHINES);}} options={dmTipoMaquinaOptions()}/>
          <MultiSel label="Proyecto" value={proyecto} onChange={setProyecto} options={[{value:ALL,label:"Todos"},...options.proyectos.map(value=>({value,label:value}))]}/>
          <MultiSel label="Equipo" value={maquina} onChange={setMaquina} options={[{value:ALL_MACHINES,label:"Todos"},...options.maquinas.filter(value=>multiIsAll(tipoMaquina,ALL_MACHINES)||dmMatchTipoMaquinaSeleccion(value,tipoMaquina)).map(value=>({value,label:value}))]}/>
          <MultiSel label="Supervisor" value={supervisor} onChange={setSupervisor} options={[{value:ALL,label:"Todos"},...options.supervisores.map(value=>({value,label:value}))]}/>
          {!singleOperator&&operatorControl}
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
    {key:"tipoEquipo",label:"Tipo de equipo",render:value=><ColorTag value={value} color={equipmentTypeColor(value)}/>},
    {key:"proyecto",label:"Proyecto",render:value=><Badge color={proyColor(value)}>{value||"—"}</Badge>},
    {key:"sitio",label:"Sitio / ubicación",render:value=><ColorTag value={value} color={stableTone(value)}/>},
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
  const[operario,setOperario]=useState("");
  const[turno,setTurno]=useState(ALL);

  const operatorSelected=Boolean(String(operario||"").trim());
  const filtered=useMemo(()=>filterOperatorActivity(rop02All,{
    mode,fecha,fechaD,fechaH,proyecto,maquina,supervisor,
    // FilterShell usa Sel para un único operador. matchMulti interpreta los
    // strings no-array como "Todos", por eso el valor debe viajar como array.
    operario:operatorSelected?[operario]:ALL,
    turno,tipoMaquina,
    matchMulti,
    machineMatches:(machine,type)=>multiIsAll(type,ALL_MACHINES)||dmMatchTipoMaquinaSeleccion(machine,type),
  }),[rop02All,mode,fecha,fechaD,fechaH,proyecto,maquina,supervisor,operario,operatorSelected,turno,tipoMaquina]);

  const sortedRows=useMemo(()=>[...filtered].sort((a,b)=>
    String(b.fecha||"").localeCompare(String(a.fecha||""))||
    operatorShiftCode(b.turno).localeCompare(operatorShiftCode(a.turno))||
    String(a.maquina||"").localeCompare(String(b.maquina||""))
  ).map(row=>enrichOperatorRow(row,locationIndex)),[filtered,locationIndex]);
  const profile=useMemo(()=>buildOperatorProfile(sortedRows),[sortedRows]);
  const equipmentSummary=profile?.equipment||[];

  const historyCols=useMemo(()=>[
    {key:"fecha",label:"Fecha",render:value=>fmtFecha(value)},
    {key:"turnoCodigo",label:"Turno",render:value=><Badge color={value==="TN"?C.purple:C.blue}>{value}</Badge>},
    {key:"proyecto",label:"Proyecto",render:value=><Badge color={proyColor(value)}>{value||"—"}</Badge>},
    {key:"maquina",label:"Equipo",render:value=><Badge color={C.purple}>{value}</Badge>},
    {key:"tipoEquipo",label:"Tipo de equipo",render:value=><ColorTag value={value} color={equipmentTypeColor(value)}/>},
    {key:"sitio",label:"Sitio / ubicación",render:value=><ColorTag value={value} color={stableTone(value)}/>},
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
    {key:"tipo",label:"Tipo",render:value=><ColorTag value={value} color={equipmentTypeColor(value)}/>},
    {key:"horas",label:"Horas",render:value=><span style={{color:C.accent,fontWeight:700}}>{fmtNum(value)}</span>},
    {key:"dias",label:"Días"},
    {key:"ultimaFecha",label:"Última fecha",render:value=>fmtFecha(value)},
    {key:"proyecto",label:"Proyecto",render:value=><Badge color={proyColor(value)}>{value||"—"}</Badge>},
    {key:"sitio",label:"Última ubicación",render:value=><ColorTag value={value} color={stableTone(value)}/>},
  ],[]);

  const reset=()=>{
    setMode("periodo");setFecha("");setFechaD("");setFechaH("");
    setTipoMaquina(ALL_MACHINES);setProyecto(ALL);setMaquina(ALL_MACHINES);setSupervisor(ALL);setOperario("");setTurno(ALL);
  };

  const exportName=operatorSelected?`Historial_operador_${String(operario).replace(/[^A-Za-z0-9_-]+/g,"_")}`:"Historial_operadores";

  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:14}}>
      <FilterShell singleOperator {...{mode,setMode,fecha,setFecha,fechaD,setFechaD,fechaH,setFechaH,tipoMaquina,setTipoMaquina,proyecto,setProyecto,maquina,setMaquina,supervisor,setSupervisor,operario,setOperario,turno,setTurno,options,onReset:reset}}/>

      {!operatorSelected&&(
        <Card>
          <div style={{minHeight:260,padding:28,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",gap:12}}>
            <div style={{width:56,height:56,borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",background:C.accent+"18",border:`1px solid ${C.accent}55`}}><Icon name="usersRound" size={28} color={C.accent}/></div>
            <div style={{fontSize:18,fontWeight:900,color:C.text}}>Seleccioná un operador</div>
            <div style={{maxWidth:560,fontSize:12,lineHeight:1.6,color:C.textSub}}>Elegí un operador en el filtro superior para abrir su ficha de actividad: horas trabajadas, equipos utilizados, ubicación más reciente, proyectos, turnos y detalle cronológico del período.</div>
          </div>
        </Card>
      )}

      {operatorSelected&&!profile&&(
        <Card><div style={{padding:24,textAlign:"center",color:C.textSub}}>No hay actividad del operador para los filtros seleccionados.</div></Card>
      )}

      {profile&&<>
        <Card>
          <div style={{padding:18,display:"flex",flexDirection:"column",gap:16,background:`linear-gradient(135deg,${C.accent}10,transparent 55%)`}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:14,flexWrap:"wrap"}}>
              <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
                <div style={{width:48,height:48,borderRadius:14,background:C.accent+"1f",border:`1px solid ${C.accent}55`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Icon name="usersRound" size={23} color={C.accent}/></div>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:10,fontWeight:900,letterSpacing:".1em",textTransform:"uppercase",color:C.textMuted}}>Ficha del operador</div>
                  <div style={{fontSize:21,fontWeight:900,color:C.text,marginTop:2,whiteSpace:"normal"}}>{profile.operario}</div>
                  <div style={{fontSize:11,color:C.textSub,marginTop:4}}>Última actividad registrada: <strong style={{color:C.text}}>{fmtFecha(profile.latestDate)}</strong> · {profile.currentShift}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:7,flexWrap:"wrap",justifyContent:"flex-end"}}>
                <Badge color={proyColor(profile.currentProject)}>{profile.currentProject||"Sin proyecto"}</Badge>
                <ColorTag value={profile.currentType} color={equipmentTypeColor(profile.currentType)}/>
                <ColorTag value={profile.currentSite} color={stableTone(profile.currentSite)}/>
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:9}}>
              <ProfileFact label="Último equipo"><Badge color={C.purple}>{profile.currentMachine||"—"}</Badge></ProfileFact>
              <ProfileFact label="Ubicación actual"><ColorTag value={profile.currentSite} color={stableTone(profile.currentSite)}/></ProfileFact>
              <ProfileFact label="Supervisor actual">{profile.currentSupervisor||"—"}</ProfileFact>
              <ProfileFact label="Último parte">{profile.currentPart||"—"}</ProfileFact>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:9}}>
              <ProfileFact label="Proyectos del período"><TagList values={profile.projects}/></ProfileFact>
              <ProfileFact label="Turnos trabajados"><TagList values={profile.shifts}/></ProfileFact>
              <ProfileFact label="Supervisores del período"><TagList values={profile.supervisors}/></ProfileFact>
            </div>
          </div>
        </Card>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(135px,1fr))",gap:10}}>
          <StatCard icon="hours" label="Horas operadas" value={fmtNum(profile.hours)} color={C.accent} small/>
          <StatCard icon="calendar" label="Días con actividad" value={profile.days} color={C.blue} small/>
          <StatCard icon="truck" label="Equipos operados" value={profile.machines} color={C.purple} small/>
          <StatCard icon="dashboard" label="Proyectos" value={profile.projects.length} color={C.teal} small/>
          <StatCard icon="clipboardList" label="Registros" value={profile.records} color={C.yellow} small/>
        </div>

        <Card title={`Equipos operados en el período (${equipmentSummary.length})`}>
          <Table cols={equipmentCols} rows={equipmentSummary} maxH={360} emptyMsg="No hay equipos operados para los filtros seleccionados."/>
        </Card>

        <Card title={`Historial operativo detallado (${sortedRows.length})`} action={<ExportButton onClick={()=>excelFromCols(historyCols,sortedRows,exportName)}/>}>
          <Table cols={historyCols} rows={sortedRows} maxH={520} emptyMsg="No hay actividad para los filtros seleccionados."/>
        </Card>
      </>}
    </div>
  );
}

export default function GestionHumanaRoute({view,rop02All=[],rop05=[],listaEquipos=[],rankingDeps,rankingState,setRankingState}){
  const active=["gestionHumanaSitio","gestionHumanaHistorial","gestionHumanaRanking"].includes(view)?view:"gestionHumanaSitio";
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {active==="gestionHumanaSitio"&&<OperadoresEnSitio rop02All={rop02All} listaEquipos={listaEquipos}/>}
      {active==="gestionHumanaHistorial"&&<HistorialOperadores rop02All={rop02All} listaEquipos={listaEquipos}/>}
      {active==="gestionHumanaRanking"&&<ViewRankingOperarios deps={rankingDeps} rop02All={rop02All} rop05={rop05} extState={rankingState} setExtState={setRankingState}/>}
    </div>
  );
}
