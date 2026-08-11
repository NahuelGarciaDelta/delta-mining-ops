import React,{useMemo,useState} from "react";
import {C,Icon} from "../../components/ui/index.jsx";
import {buildFleetUtilization} from "./fleetAnalytics.js";

const f=n=>Number(n||0).toLocaleString("es-AR",{maximumFractionDigits:1});
const p=n=>`${f(n)}%`;
function Help({text}){return <span className="dm-help" tabIndex={0} data-tip={text}>?</span>}

export default function FleetUtilizationPanel({rows=[],from,to}){
  const [query,setQuery]=useState("");
  const [onlyExceptions,setOnlyExceptions]=useState(false);
  const data=useMemo(()=>buildFleetUtilization(rows,from,to),[rows,from,to]);
  const visible=useMemo(()=>{
    const q=query.trim().toUpperCase();
    return data.filter(x=>(!q||`${x.code} ${x.project}`.toUpperCase().includes(q))&&(!onlyExceptions||x.fsDays>0||x.emDays>0||x.noRecordDays>0||x.utilization<50));
  },[data,query,onlyExceptions]);
  const summary=useMemo(()=>({
    fleet:data.length,
    hours:data.reduce((s,x)=>s+x.hours,0),
    utilization:data.length?data.reduce((s,x)=>s+x.utilization,0)/data.length:0,
    availability:data.length?data.reduce((s,x)=>s+x.availability,0)/data.length:0,
    exceptions:data.filter(x=>x.fsDays>0||x.emDays>0||x.noRecordDays>0).length,
  }),[data]);
  return <section className="dm-panel" style={{background:"linear-gradient(180deg,rgba(45,52,59,.88),rgba(31,38,45,.84))",border:"1px solid rgba(255,255,255,.14)",borderRadius:12,overflow:"visible",boxShadow:"0 8px 22px rgba(0,0,0,.16)"}}>
    <div style={{padding:"11px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,borderBottom:"1px solid rgba(255,255,255,.12)",flexWrap:"wrap"}}>
      <div style={{display:"flex",alignItems:"center",gap:7}}><strong style={{fontSize:12,color:C.text}}>Utilización de Flota por Equipo</strong><Help text="Cada fila usa exclusivamente el rango Desde/Hasta. Trabajo = día con horas > 0; OD/EM/FS = día con 0 h y ese estado; Sin registro = no existe ROP02 para el equipo ese día. Utilización = días trabajados / días del período. Disponibilidad = (Trabajo + OD) / días del período."/></div>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{position:"relative"}}><Icon name="search" size={13} color={C.textMuted} style={{position:"absolute",left:9,top:8}}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar equipo..." style={{height:30,width:180,borderRadius:7,border:`1px solid ${C.borderLight}`,background:"rgba(8,14,20,.76)",color:C.text,padding:"0 9px 0 29px",fontSize:10,outline:"none"}}/></div>
        <label style={{display:"flex",alignItems:"center",gap:6,fontSize:9.5,color:C.textSub,cursor:"pointer"}}><input type="checkbox" checked={onlyExceptions} onChange={e=>setOnlyExceptions(e.target.checked)}/> Solo excepciones</label>
      </div>
    </div>
    <div style={{padding:"10px 12px 12px"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(110px,1fr))",gap:8,marginBottom:10}}>{[
        ["Equipos",summary.fleet,C.blue,"Equipos con al menos un ROP02 dentro del período."],
        ["Horas operativas",f(summary.hours),C.green,"Suma de horas trabajadas ROP02 del período."],
        ["Utilización media",p(summary.utilization),C.teal,"Promedio de utilización diaria de los equipos."],
        ["Disponibilidad media",p(summary.availability),C.blue,"Promedio de días Trabajo + OD sobre días del período."],
        ["Con excepciones",summary.exceptions,C.yellow,"Equipos con al menos un día FS, EM o sin registro."],
      ].map(([l,v,c,t])=><div key={l} style={{padding:"9px 10px",borderRadius:8,background:"rgba(255,255,255,.035)",border:`1px solid ${c}35`}}><div style={{fontSize:8.5,color:C.textMuted,display:"flex",alignItems:"center",gap:5}}>{l}<Help text={t}/></div><div style={{fontSize:18,fontWeight:900,color:c,marginTop:4}}>{v}</div></div>)}</div>
      <div style={{overflow:"auto",maxHeight:430,border:"1px solid rgba(255,255,255,.10)",borderRadius:9}}><table className="dm-exec-table" style={{minWidth:980}}><thead><tr>{["Equipo","Proyecto","Horas","Días trabajo","OD","EM","FS","Sin registro","Utilización","Disponibilidad"].map(h=><th key={h} style={{textAlign:h==="Equipo"||h==="Proyecto"?"left":"right",position:"sticky",top:0,zIndex:2}}>{h}</th>)}</tr></thead><tbody>{visible.map(x=><tr key={x.code}><td style={{fontWeight:900,textAlign:"left"}}><button type="button" onClick={()=>window.dispatchEvent(new CustomEvent("dm-open-equipment-profile",{detail:{code:x.code}}))} style={{border:0,background:"none",padding:0,color:C.blue,fontWeight:900,cursor:"pointer",textDecoration:"underline",textDecorationColor:`${C.blue}66`}}>{x.code}</button></td><td>{x.project}</td><td style={{textAlign:"right",fontWeight:800}}>{f(x.hours)}</td><td style={{textAlign:"right"}}>{x.workDays}</td><td style={{textAlign:"right"}}>{x.odDays}</td><td style={{textAlign:"right",color:x.emDays?C.purple:C.textSub}}>{x.emDays}</td><td style={{textAlign:"right",color:x.fsDays?C.red:C.textSub,fontWeight:x.fsDays?900:400}}>{x.fsDays}</td><td style={{textAlign:"right",color:x.noRecordDays?C.yellow:C.textSub}}>{x.noRecordDays}</td><td style={{textAlign:"right",fontWeight:900,color:x.utilization>=70?C.green:x.utilization>=45?C.yellow:C.red}}>{p(x.utilization)}</td><td style={{textAlign:"right",fontWeight:900,color:x.availability>=85?C.green:x.availability>=65?C.yellow:C.red}}>{p(x.availability)}</td></tr>)}</tbody></table>{!visible.length&&<div style={{padding:22,textAlign:"center",color:C.textMuted,fontSize:11}}>Sin equipos para los filtros seleccionados.</div>}</div>
      <div style={{fontSize:8.5,color:C.textMuted,marginTop:7}}>Período: {from} → {to} · Los días sin ROP02 se muestran explícitamente como “Sin registro”; no se convierten automáticamente en FS u OD.</div>
    </div>
  </section>;
}
