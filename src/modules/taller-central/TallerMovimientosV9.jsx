import React,{useEffect,useMemo,useState} from "react";
import {currentSession,refreshV9} from "../../standalone/session.js";

const TYPES={SUBIDA:"Subida",BAJA:"Bajada",MOVILIZACION:"Movilización",CAMBIO_EQUIPO:"Cambio de equipo"};
const FORM_FIELDS={
 SUBIDA:[["EQUIPO","Equipo"],["MARCA","Marca"],["MODELO","Modelo"],["PROPIEDAD","Propiedad"],["INTERNO_ORIGEN","Interno"],["HOROMETRO","Horómetro"],["PROYECTO_DESTINO","Proyecto destino"]],
 BAJA:[["INTERNO_ORIGEN","Interno"],["EQUIPO","Equipo"],["PROYECTO_ORIGEN","Proyecto origen"],["HOROMETRO","Horómetro"],["MOTIVO","Motivo de baja"]],
 MOVILIZACION:[["INTERNO_ORIGEN","Interno"],["EQUIPO","Equipo"],["PROYECTO_ORIGEN","Proyecto origen"],["PROYECTO_DESTINO","Proyecto destino"],["INTERNO_DESTINO","Interno destino"],["HOROMETRO","Horómetro"]],
 CAMBIO_EQUIPO:[["INTERNO_ORIGEN","Interno que sale"],["EQUIPO","Equipo"],["INTERNO_ENTRA","Interno que entra"],["EQUIPO_ENTRA","Equipo entrante"],["PROYECTO_ORIGEN","Proyecto origen"],["MOTIVO","Motivo"]]
};
const SUBIDA_PROPIEDADES=["ALEQUIP","ARRENDADORA","CGM","DELTA","DIESEL LANGE","FARO","FIMA","FINNING","GINER DANIEL","MAXIKLAK","MTZ","NATALIO","NOAR","SULLAIR","OTRO"];
const SUBIDA_PROYECTOS=["EL FIERRO","EL ZORRO","FILO DEL SOL","FILO SUR","JOSE MARIA"];
const TABLE_FIELDS=[["FECHA_HORA","Fecha"],["INTERNO_ORIGEN","Interno"],["EQUIPO","Equipo"],["PROYECTO_ORIGEN","Origen"],["PROYECTO_DESTINO","Destino"],["INTERNO_DESTINO","Interno destino"],["MOTIVO","Motivo"],["USUARIO","Usuario"]];
const norm=s=>String(s??"").trim();
const date=s=>{const v=norm(s);return /^\\d{4}-\\d{2}-\\d{2}/.test(v)?v.slice(0,10):v||"—";};
const box={background:"rgba(22,22,22,.94)",border:"1px solid #363638",borderRadius:13,padding:15};
const field={width:"100%",height:34,boxSizing:"border-box",background:"#141414",border:"1px solid #303035",borderRadius:8,color:"#e5e5e5",padding:"0 11px",fontSize:12};
const th={padding:"9px 8px",textAlign:"left",whiteSpace:"nowrap",fontSize:10,color:"#a6a6aa",background:"#141414"};
const td={padding:"7px 8px",fontSize:10,color:"#e7e7e9",borderBottom:"1px solid #303035",whiteSpace:"nowrap"};
export default function TallerMovimientosV9({tipo}){
 const[rows,setRows]=useState([]),[busy,setBusy]=useState(true),[error,setError]=useState("");
 const[reload,setReload]=useState(0),[form,setForm]=useState({}),[filter,setFilter]=useState(""),[filterVisible,setFilterVisible]=useState(false);
 useEffect(()=>{setForm({});setFilter("");},[tipo]);
 useEffect(()=>{
  let cancelled=false;
  (async()=>{
   setBusy(true);setError("");setRows([]);
   try{
    let session=currentSession();
    if(!session?.access_token)throw Error("V9_SESSION_REQUIRED");
    if(session.expires_at*1000<Date.now()+60000&&session.refresh_token)session=await refreshV9(session);
    const all=[];let offset=0,total=null,finished=false;
    for(let page=0;page<30;page++){
     const res=await fetch("/api/v9-sheets-read",{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({dataset:"movimientos_taller",limit:200,offset})});
     const data=await res.json().catch(()=>null);
     if(!res.ok||data?.ok!==true)throw Error(data?.error||"V9_TALLER_READ_FAILED");
     if(!Array.isArray(data.rows))throw Error("V9_TALLER_INVALID_ROWS");
     all.push(...data.rows);total=Number(data.total);
     if(!data.hasMore){finished=true;break;}
     const next=Number(data.nextOffset);
     if(!Number.isInteger(next)||next<=offset)throw Error("V9_TALLER_INVALID_PAGINATION");
     offset=next;
    }
    if(!finished||total!==null&&all.length!==total)throw Error("V9_TALLER_PAGE_COUNT_MISMATCH");
    if(!cancelled)setRows(all.filter(r=>norm(r.TIPO).toUpperCase()===tipo));
   }catch(e){if(!cancelled)setError(String(e.message||e));}
   finally{if(!cancelled)setBusy(false);}
  })();
  return()=>{cancelled=true;};
 },[tipo,reload]);
 const filtered=useMemo(()=>rows.filter(r=>!filter||Object.values(r).some(v=>norm(v).toLowerCase().includes(filter.toLowerCase()))),[rows,filter]);
 const projects=useMemo(()=>[...new Set(rows.flatMap(r=>[norm(r.PROYECTO_ORIGEN),norm(r.PROYECTO_DESTINO)]).filter(Boolean))].sort(),[rows]);
 const set=(k,v)=>setForm(prev=>({...prev,[k]:v}));
 const title=TYPES[tipo]||tipo;
 return <div style={{display:"flex",flexDirection:"column",gap:10,padding:"0 0 18px",color:"#f0f0f0",fontFamily:"inherit",fontSize:12}}>
  <div style={box}>
   <div style={{fontWeight:800,fontSize:14,marginBottom:3}}>Registrar {title.toLowerCase()}</div>
   <div style={{fontSize:11,color:"#a2a2a5",marginBottom:14}}>Los movimientos de bajada, movilización y cambio de equipo se vinculan automáticamente con Atraso .</div>
   <div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",gap:10}}>
    {(FORM_FIELDS[tipo]||[]).map(([key,label])=><label key={key} style={{display:"flex",flexDirection:"column",gap:5,fontSize:11,color:"#a7a7aa",fontWeight:650}}>{label}
     {key==="PROPIEDAD"?<select style={field} value={form[key]??"DELTA"} onChange={e=>set(key,e.target.value)}>{(tipo==="SUBIDA"?SUBIDA_PROPIEDADES:["DELTA","ALQUILADO","OTRO"]).map(p=><option key={p} value={p}>{p}</option>)}</select>:
      key==="PROYECTO_DESTINO"?<select style={field} value={form[key]||""} onChange={e=>set(key,e.target.value)}><option value="">Seleccionar...</option>{(tipo==="SUBIDA"?SUBIDA_PROYECTOS:projects).map(p=><option key={p} value={p}>{p}</option>)}</select>:
      <input style={field} value={form[key]||""} onChange={e=>set(key,e.target.value)} type={key==="HOROMETRO"?"number":"text"}/>}
    </label>)}
   </div>
   <label style={{display:"flex",flexDirection:"column",gap:5,fontSize:11,color:"#a7a7aa",fontWeight:650,marginTop:12}}>Observación
    <input style={field} placeholder="Opcional" value={form.OBSERVACION||""} onChange={e=>set("OBSERVACION",e.target.value)}/>
   </label>
   <div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:12,marginTop:12,flexWrap:"wrap"}}>
    <span style={{color:"#a7a7aa",fontSize:11}}>Guardado deshabilitado hasta verificar permisos y escrituras en V9.</span>
    <button type="button" disabled title="Escrituras V9 pendientes de validación" style={{border:"1px solid #267e46",color:"#45b875",background:"transparent",borderRadius:8,padding:"9px 13px",opacity:.55,cursor:"not-allowed",fontWeight:750}}>Guardar movimiento</button>
   </div>
  </div>
  <div style={{...box,padding:0,overflow:"hidden"}}>
   <div style={{padding:"12px 12px 10px",fontWeight:850,fontSize:14}}>Últimos 100 movimientos</div>
   <div style={{padding:"0 10px 12px",display:"flex",gap:10,alignItems:"center"}}><button type="button" onClick={()=>setFilterVisible(v=>!v)} title="Mostrar u ocultar filtros individuales para cada columna">Filtro por columna</button>{filterVisible&&<input style={{...field,maxWidth:300}} value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Buscar movimientos"/>}</div>
   {error&&<div role="alert" style={{color:"#f47b83",padding:14}}>{error}</div>}
   {!busy&&!error&&<div style={{overflowX:"auto",maxHeight:325,overflowY:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
    <thead><tr>{TABLE_FIELDS.map(([k,l])=><th key={k} style={th}>{l}</th>)}<th style={th}>Acciones</th></tr></thead>
    <tbody>{filtered.slice(0,100).map((r,i)=><tr key={r.ID||i}>{TABLE_FIELDS.map(([k])=><td key={k} style={td}>{k==="FECHA_HORA"?date(r[k]):k==="INTERNO_ORIGEN"?<span style={{color:"#b178f2",fontWeight:750}}>{norm(r[k])||"—"}</span>:norm(r[k])||"—"}</td>)}<td style={td}><button disabled title="Edición pendiente de validar" style={{border:"1px solid #438be7",color:"#438be7",background:"transparent",borderRadius:7,padding:"6px 9px",marginRight:5,opacity:.55}}>Editar</button><button disabled title="Eliminación pendiente de validar" style={{border:"1px solid #e33653",color:"#e33653",background:"transparent",borderRadius:7,padding:"7px 9px",opacity:.55}}>Eliminar</button></td></tr>)}
     {!filtered.length&&<tr><td colSpan={TABLE_FIELDS.length+1} style={{...td,textAlign:"center"}}>No hay movimientos para mostrar.</td></tr>}
    </tbody>
   </table></div>}
  </div>
 </div>;
}
