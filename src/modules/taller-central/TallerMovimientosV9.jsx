import React,{useEffect,useState} from "react";
import {currentSession,refreshV9} from "../../standalone/session.js";

const LABELS={SUBIDA:"Subida",BAJA:"Bajada",MOVILIZACION:"Movilización",CAMBIO_EQUIPO:"Cambio de equipo"};
const FIELDS=[["FECHA_HORA","Fecha"],["INTERNO","Equipo"],["INTERNO_ENTRA","Equipo entrante"],["PROYECTO_ORIGEN","Origen"],["PROYECTO_DESTINO","Destino"],["MOTIVO","Motivo"],["OBSERVACION","Observación"]];
const value=(row,key)=>String(row?.[key]??row?.[key.toLowerCase()]??"");
export default function TallerMovimientosV9({tipo}){
 const [rows,setRows]=useState([]),[busy,setBusy]=useState(true),[error,setError]=useState("");
 const [reload,setReload]=useState(0);
 useEffect(()=>{
  let cancelled=false;
  (async()=>{
   setBusy(true);setError("");setRows([]);
   try{
    let session=currentSession();
    if(!session?.access_token)throw Error("V9_SESSION_REQUIRED");
    if(session.expires_at*1000<Date.now()+60000&&session.refresh_token)session=await refreshV9(session);
    const all=[];let offset=0,total=null;
    for(let page=0;page<30;page++){
     const res=await fetch("/api/v9-sheets-read",{method:"POST",cache:"no-store",
      headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},
      body:JSON.stringify({dataset:"movimientos_taller",limit:200,offset})});
     const data=await res.json().catch(()=>null);
     if(!res.ok||data?.ok!==true)throw Error(data?.error||"V9_TALLER_READ_FAILED");
     if(!Array.isArray(data.rows))throw Error("V9_TALLER_INVALID_ROWS");
     all.push(...data.rows);
     total=Number(data.total);
     if(!data.hasMore)break;
     const next=Number(data.nextOffset);
     if(!Number.isInteger(next)||next<=offset)throw Error("V9_TALLER_INVALID_PAGINATION");
     offset=next;
    }
    if(total!==null&&all.length!==total)throw Error("V9_TALLER_PAGE_COUNT_MISMATCH");
    if(!cancelled)setRows(all.filter(r=>String(r.TIPO||r.tipo||"").toUpperCase()===tipo));
   }catch(e){if(!cancelled)setError(String(e.message||e));}
   finally{if(!cancelled)setBusy(false);}
  })();
  return()=>{cancelled=true;};
 },[tipo,reload]);
 return <section style={{padding:20}}>
  <h2>Movimiento de equipos · {LABELS[tipo]||tipo}</h2>
  <p>Historial original de Taller Central. Consulta de solo lectura en V9 hasta validar escrituras.</p>
  <button type="button" onClick={()=>setReload(n=>n+1)} disabled={busy}>{busy?"Cargando…":"Actualizar"}</button>
  {error&&<p role="alert" style={{color:"#e75a65"}}>{error}</p>}
  {!busy&&!error&&<p>{rows.length} movimientos</p>}
  {!busy&&!error&&<div style={{overflowX:"auto",marginTop:16}}><table style={{width:"100%",borderCollapse:"collapse"}}>
   <thead><tr>{FIELDS.map(([key,label])=><th key={key} style={{textAlign:"left",padding:8}}>{label}</th>)}</tr></thead>
   <tbody>{rows.map((r,i)=><tr key={r.ID||r.id||i}>{FIELDS.map(([key])=><td key={key} style={{padding:8,borderBottom:"1px solid #555"}}>{value(r,key)}</td>)}</tr>)}</tbody>
  </table></div>}
 </section>;
}
