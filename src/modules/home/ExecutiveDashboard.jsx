import React, { useEffect, useMemo, useState } from "react";
import { C, Card, StatCard, Icon } from "../../components/ui/index.jsx";
import { APPS_SCRIPT_URL } from "../../config/app.js";
import { fetchAction } from "../../services/appsScriptApi.js";
import { fetchStockData } from "../../services/stockService.js";

const d7=()=>{const d=new Date();d.setDate(d.getDate()-7);return d.toISOString().slice(0,10)};
const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]/g,"");
function code(r){return norm(r?.maquina||r?.interno||r?.codigo||r?.["Codigo Int"]||r?.["Código Interno del Equipo"]);}
function safeArr(v){return Array.isArray(v)?v:[];}
function pick(row,names){const keys=Object.keys(row||{});for(const name of names){const n=norm(name);const k=keys.find(x=>norm(x)===n);if(k)return row[k];}return"";}
function countStockCritical(rows){if(!rows)return null;return safeArr(rows).filter(r=>Number(r.stockMinimo||0)>0&&Number(r.saldoControlStock||0)<Number(r.stockMinimo||0)).length;}
function tenderDeadline(t){const candidates=[...(safeArr(t?.fechas).map(x=>x?.fecha)),t?.fechaOferta,t?.fechaVencimiento,t?.fechaEntrega,t?.deadline].filter(Boolean).sort();return candidates[0]||"";}

export default function ExecutiveDashboard({rop02All=[],rop05=[],rma15=[],rawSources={},onNavigate}){
 const[remote,setRemote]=useState({pm:null,states:null,tenders:null,stock:null});
 useEffect(()=>{let alive=true;Promise.allSettled([
   fetchAction(APPS_SCRIPT_URL,"mantenimiento_programado"),
   fetchAction(APPS_SCRIPT_URL,"estados_solicitudes"),
   fetchAction(APPS_SCRIPT_URL,"licitaciones_compartidas"),
   fetchStockData(APPS_SCRIPT_URL)
 ]).then(([pm,states,tenders,stock])=>{if(!alive)return;setRemote({pm:pm.status==="fulfilled"&&pm.value?.ok?pm.value:null,states:states.status==="fulfilled"&&states.value?.ok?states.value:null,tenders:tenders.status==="fulfilled"&&tenders.value?.ok?tenders.value:null,stock:stock.status==="fulfilled"&&stock.value?.ok?stock.value:null});});return()=>{alive=false};},[]);
 const k=useMemo(()=>{
   const from=d7(); const recent=rop02All.filter(r=>String(r.fecha||"")>=from); const active=new Set(recent.map(code).filter(Boolean)).size;
   const availabilityRows=rma15.filter(r=>String(r.fecha||"")>=from); const availability=availabilityRows.length?Math.round(100*availabilityRows.filter(r=>r.operativo!==false).length/availabilityRows.length):null;
   const thisMonth=new Date().toISOString().slice(0,7); const maintCost=rma15.filter(r=>String(r.fecha||"").slice(0,7)===thisMonth).reduce((s,r)=>s+(Number(r.costoTotal)||0),0);
   const productive=rop05.filter(r=>String(r.fecha||"").slice(0,7)===thisMonth).reduce((s,r)=>s+(Number(r.horas||r.cantHs)||0),0);
   const stateRows=safeArr(remote.states?.data); const pending=stateRows.length?stateRows.filter(r=>{const s=norm(pick(r,["ESTADO","Estado"]));return !["CERRADA","CERRADO","RECHAZADA","RECHAZADO"].includes(s)}).length:safeArr(rawSources?.raba03?.data).length;
   let criticalPm=null; if(remote.pm){const cfg=safeArr(remote.pm.config);criticalPm=cfg.filter(x=>{const estado=norm(pick(x,["Estado","estado"]));if(estado.includes("ATRAS")||estado.includes("URGENT"))return true;const h=Number(x.horasDesdePM??x.horas_desde_pm??x.horasDesdeUltimoPM);const lim=Number(x.atrasadoDesde??x.atrasado_desde??350);return Number.isFinite(h)&&h>=lim}).length;}
   const now=Date.now(),end=now+30*86400000;const tenders=safeArr(remote.tenders?.data);const upcoming=tenders.length?tenders.filter(t=>{const raw=tenderDeadline(t);const time=raw?new Date(`${String(raw).slice(0,10)}T12:00:00`).getTime():NaN;return Number.isFinite(time)&&time>=now&&time<=end&&norm(t.estado)!=="CERRADA"}).length:null;
   return {active,availability,maintCost,productive,pending,stock:countStockCritical(remote.stock?.rows),tenders:upcoming,criticalPm};
 },[rop02All,rop05,rma15,rawSources,remote]);
 const cards=[
  ["Equipos activos (7 días)",k.active,C.blue,"rop02","Internos con actividad ROP02 durante los últimos 7 días."],
  ["Disponibilidad registrada",k.availability==null?"—":`${k.availability}%`,C.green,"mant","Porcentaje de OT recientes en las que el equipo quedó operativo. Indicador rápido, no reemplaza disponibilidad por horas."],
  ["PM críticos",k.criticalPm==null?"—":k.criticalPm,C.red,"pmGestion","PM urgentes o atrasados detectados por Mantenimiento Programado."],
  ["Costo mantenimiento mes",`USD ${Number(k.maintCost||0).toLocaleString("es-AR",{maximumFractionDigits:0})}`,C.purple,"costosMant","Costo valorizado de insumos RMA15 del mes actual."],
  ["Solicitudes abiertas",k.pending,C.yellow,"abastecimientoPendientes","Estados compartidos de solicitudes que todavía no están cerrados ni rechazados."],
  ["Stock crítico",k.stock==null?"—":k.stock,C.red,"abastecimientoStock","Artículos del último control de stock cuyo saldo está por debajo del mínimo."],
  ["Productividad mes",`${Number(k.productive||0).toLocaleString("es-AR",{maximumFractionDigits:0})} h`,C.teal,"rop05","Horas productivas efectivas ROP05 del mes actual."],
  ["Licitaciones ≤30 días",k.tenders==null?"—":k.tenders,C.blue,"licitacionesControl","Licitaciones compartidas con un hito próximo dentro de 30 días."]
 ];
 return <Card title="Dashboard ejecutivo" tooltip="Resumen transversal de la operación. Cada tarjeta abre directamente el módulo de origen.">
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(185px,1fr))",gap:10}}>{cards.map(([label,value,color,target,tip])=><div key={label} onClick={()=>onNavigate?.(target)} style={{cursor:"pointer"}}><StatCard label={label} value={value} color={color} small tooltip={tip}/></div>)}</div>
   <div style={{marginTop:10,display:"flex",alignItems:"center",gap:8,fontSize:10,color:C.textMuted}}><Icon name="refresh" size={11}/> Los datos cacheados se muestran inmediatamente y el botón global Actualizar sincroniza el módulo activo.</div>
 </Card>;
}
