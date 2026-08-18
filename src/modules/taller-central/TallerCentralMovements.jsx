import React,{useCallback,useEffect,useMemo,useState} from "react";
import {C} from "../../components/ui/index.jsx";
import {APPS_SCRIPT_URL} from "../../config/app.js";
import {fetchAction} from "../../services/appsScriptApi.js";
import {postToAppsScript} from "../../services/writeActions.js";
import {registerRefreshTask} from "../../services/refreshManager.js";

const norm=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]/g,"");
const pick=(row,names)=>{const keys=Object.keys(row||{});for(const n of names){const nn=norm(n);const k=keys.find(x=>norm(x)===nn);if(k)return row[k];}for(const n of names){const nn=norm(n);const k=keys.find(x=>norm(x).includes(nn)||nn.includes(norm(x)));if(k)return row[k];}return"";};
const code=v=>{const raw=String(v||"").trim().toUpperCase().replace(/\s*\(.*?\)/g,"").replace(/[^A-Z0-9]/g,"");const m=raw.match(/^([A-Z]{2,4})(\d{1,6})$/);return m?`${m[1]}-${m[2].padStart(4,"0")}`:String(v||"").trim().toUpperCase();};
const project=v=>String(v||"").trim().toUpperCase();
const isoDate=v=>String(v||"").slice(0,10);
const fmtDate=v=>{const s=isoDate(v);return /^\d{4}-\d{2}-\d{2}$/.test(s)?`${s.slice(8,10)}/${s.slice(5,7)}/${s.slice(0,4)}`:"—";};
const inputStyle={height:38,borderRadius:8,border:`1px solid ${C.border}`,background:"#151515",color:C.text,padding:"0 11px",outline:"none",fontSize:12,boxSizing:"border-box",width:"100%"};
const labelStyle={display:"flex",flexDirection:"column",gap:6,fontSize:11,fontWeight:800,color:C.textSub};
const btn=(active=false)=>({border:`1px solid ${active?C.accent:C.border}`,background:active?C.redDim:"#191919",color:active?C.accent:C.textSub,borderRadius:8,padding:"9px 15px",fontWeight:800,cursor:"pointer"});

function equipmentCatalog(listaEquipos=[],rop02All=[]){
  const latest=new Map();
  for(const row of rop02All||[]){
    const c=code(row?.maquina||row?._internoRaw);const fecha=isoDate(row?.fecha);if(!c||!fecha)continue;
    const cur=latest.get(c);if(!cur||fecha>cur.fecha)latest.set(c,{fecha,proyecto:project(row?.proyecto||row?.lugar),horometro:Number(row?.horometroFinal??row?.hf??row?.horometro??0)||0});
  }
  const map=new Map();
  for(const row of listaEquipos||[]){
    const interno=code(pick(row,["Codigo nuevo","Código nuevo","Código interno","Interno","Codigo Drusila","Código Drusila"]));if(!interno)continue;
    const current=latest.get(interno)||{};
    map.set(interno,{interno,equipo:String(pick(row,["Familia","Tipo de equipo","Equipo","Descripción","Descripcion"])||"").trim(),marca:String(pick(row,["Marca"])||"").trim(),modelo:String(pick(row,["Modelo"])||"").trim(),propiedad:String(pick(row,["Propiedad"])||"").trim(),proyecto:current.proyecto||project(pick(row,["Lugar de alquiler","Proyecto","Lugar"])),horometro:current.horometro||Number(pick(row,["Horas","Horometro","Horómetro"]))||0,ultimaCarga:current.fecha||""});
  }
  for(const [interno,current] of latest){if(!map.has(interno))map.set(interno,{interno,equipo:"",marca:"",modelo:"",propiedad:"",proyecto:current.proyecto,horometro:current.horometro,ultimaCarga:current.fecha});}
  return [...map.values()].sort((a,b)=>a.interno.localeCompare(b.interno,"es",{numeric:true}));
}

function Field({label,children}){return <label style={labelStyle}>{label}{children}</label>;}
function Select({value,onChange,children,disabled=false}){return <select value={value} onChange={e=>onChange(e.target.value)} disabled={disabled} style={{...inputStyle,opacity:disabled?.55:1}}>{children}</select>;}
function Input({value,onChange,...rest}){return <input value={value} onChange={e=>onChange(e.target.value)} style={inputStyle} {...rest}/>;}

export default function TallerCentralMovements({listaEquipos=[],rop02All=[]}){
  const[tab,setTab]=useState("SUBIDA");
  const[rows,setRows]=useState([]);const[loading,setLoading]=useState(false);const[saving,setSaving]=useState(false);const[msg,setMsg]=useState("");
  const[form,setForm]=useState({equipo:"",marca:"",modelo:"",propiedad:"DELTA",interno:"",horometro:"",proyectoOrigen:"",proyectoDestino:"",motivoBaja:"MANTENIMIENTO",motivoOtro:"",internoModo:"MISMO",internoNuevo:"",observacion:""});
  const catalog=useMemo(()=>equipmentCatalog(listaEquipos,rop02All),[listaEquipos,rop02All]);
  const projects=useMemo(()=>[...new Set((rop02All||[]).map(r=>project(r?.proyecto||r?.lugar)).filter(Boolean))].sort(),[rop02All]);
  const selected=useMemo(()=>catalog.find(x=>x.interno===form.interno)||null,[catalog,form.interno]);
  useEffect(()=>{if(!selected)return;setForm(f=>({...f,equipo:selected.equipo,marca:selected.marca,modelo:selected.modelo,propiedad:selected.propiedad||f.propiedad,horometro:selected.horometro||f.horometro,proyectoOrigen:selected.proyecto||""}));},[selected]);
  const load=useCallback(async()=>{setLoading(true);try{const r=await fetchAction(APPS_SCRIPT_URL,"get_taller_equipment_movements",{limit:"all",force:true});setRows(Array.isArray(r?.data)?r.data:[]);}catch(e){setMsg(e?.message||"No se pudo leer movimientos de Taller Central.");}finally{setLoading(false);}},[]);
  useEffect(()=>{load();},[load]);
  useEffect(()=>registerRefreshTask("taller-central-movimientos",load,{views:["tallerCentral"],priority:12}),[load]);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const reset=()=>setForm({equipo:"",marca:"",modelo:"",propiedad:"DELTA",interno:"",horometro:"",proyectoOrigen:"",proyectoDestino:"",motivoBaja:"MANTENIMIENTO",motivoOtro:"",internoModo:"MISMO",internoNuevo:"",observacion:""});
  const save=async()=>{
    const interno=code(form.interno);if(!interno){setMsg("Ingresá o seleccioná un interno.");return;}
    if(tab==="SUBIDA"&&!form.proyectoDestino){setMsg("Seleccioná el proyecto al que sube el equipo.");return;}
    if(tab==="BAJA"&&!form.motivoBaja){setMsg("Indicá la razón de la baja.");return;}
    if(tab==="MOVILIZACION"&&(!form.proyectoOrigen||!form.proyectoDestino)){setMsg("La movilización necesita proyecto origen y destino.");return;}
    if(tab==="MOVILIZACION"&&project(form.proyectoOrigen)===project(form.proyectoDestino)){setMsg("El proyecto destino debe ser distinto del actual.");return;}
    const internoDestino=tab==="MOVILIZACION"&&form.internoModo==="NUEVO"?code(form.internoNuevo):interno;
    if(tab==="MOVILIZACION"&&!internoDestino){setMsg("Ingresá el nuevo interno.");return;}
    const payload={tipo:tab,fechaHora:new Date().toISOString(),equipo:form.equipo,marca:form.marca,modelo:form.modelo,propiedad:form.propiedad,interno,horometro:Number(form.horometro)||0,proyectoOrigen:project(form.proyectoOrigen),proyectoDestino:project(form.proyectoDestino),motivo:tab==="BAJA"?(form.motivoBaja==="OTRO"?form.motivoOtro:form.motivoBaja):tab,internoDestino,observacion:form.observacion,usuario:sessionStorage.getItem("dm_user")||"Usuario"};
    setSaving(true);setMsg("");try{const r=await postToAppsScript({action:"save_taller_equipment_movement",movement:payload});if(!r?.ok)throw new Error(r?.error?.message||r?.message||"No se pudo guardar.");setMsg("Movimiento guardado correctamente.");reset();await load();}catch(e){setMsg(e?.message||"No se pudo guardar el movimiento.");}finally{setSaving(false);}
  };
  const filtered=useMemo(()=>rows.filter(r=>String(r?.tipo||r?.TIPO||"").toUpperCase()===tab).slice().sort((a,b)=>String(b.fechaHora||b.FECHA_HORA||"").localeCompare(String(a.fechaHora||a.FECHA_HORA||""))).slice(0,100),[rows,tab]);
  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{[["SUBIDA","Subida"],["BAJA","Baja"],["MOVILIZACION","Movilización"]].map(([k,l])=><button key={k} style={btn(tab===k)} onClick={()=>{setTab(k);setMsg("");reset();}}>{l}</button>)}</div>
    <div style={{background:"rgba(24,24,24,.94)",border:`1px solid ${C.border}`,borderRadius:12,padding:16,display:"flex",flexDirection:"column",gap:14}}>
      <div><div style={{fontSize:15,fontWeight:900,color:C.text}}>{tab==="SUBIDA"?"Registrar subida de equipo":tab==="BAJA"?"Registrar baja de equipo":"Registrar movilización entre proyectos"}</div><div style={{fontSize:11,color:C.textMuted,marginTop:3}}>Los movimientos quedan compartidos para todos los usuarios en la planilla de movimientos.</div></div>
      {tab==="SUBIDA"?<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
        <Field label="Equipo"><Input value={form.equipo} onChange={v=>set("equipo",v)} placeholder="Ej.: Topadora"/></Field><Field label="Marca"><Input value={form.marca} onChange={v=>set("marca",v)}/></Field><Field label="Modelo"><Input value={form.modelo} onChange={v=>set("modelo",v)}/></Field><Field label="Propiedad"><Select value={form.propiedad} onChange={v=>set("propiedad",v)}><option>DELTA</option><option>ALQUILADO</option><option>OTRO</option></Select></Field><Field label="Interno"><Input value={form.interno} onChange={v=>set("interno",v.toUpperCase())} placeholder="Ej.: TOP-0067"/></Field><Field label="Horómetro"><Input type="number" value={form.horometro} onChange={v=>set("horometro",v)}/></Field><Field label="Proyecto destino"><Select value={form.proyectoDestino} onChange={v=>set("proyectoDestino",v)}><option value="">Seleccionar...</option>{projects.map(p=><option key={p}>{p}</option>)}</Select></Field>
      </div>:<div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:12}}><Field label="Equipo"><Select value={form.interno} onChange={v=>set("interno",v)}><option value="">Seleccionar equipo...</option>{catalog.map(x=><option key={x.interno} value={x.interno}>{x.interno}{x.equipo?` · ${x.equipo}`:""}</option>)}</Select></Field><Field label="Proyecto actual"><Input value={form.proyectoOrigen} onChange={()=>{}} disabled placeholder="Se detecta desde ROP02"/></Field><Field label="Horómetro actual"><Input value={String(form.horometro||"")} onChange={()=>{}} disabled/></Field></div>
        {tab==="BAJA"?<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:12}}><Field label="Razón por la que baja"><Select value={form.motivoBaja} onChange={v=>set("motivoBaja",v)}><option value="MANTENIMIENTO">Mantenimiento</option><option value="REPARACION">Reparación</option><option value="DESMOVILIZACION">Desmovilización</option><option value="FIN_ALQUILER">Fin de alquiler</option><option value="BAJA_DEFINITIVA">Baja definitiva</option><option value="OTRO">Otra</option></Select></Field>{form.motivoBaja==="OTRO"&&<Field label="Detalle"><Input value={form.motivoOtro} onChange={v=>set("motivoOtro",v)}/></Field>}</div>:<><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:12}}><Field label="Proyecto destino"><Select value={form.proyectoDestino} onChange={v=>set("proyectoDestino",v)}><option value="">Seleccionar...</option>{projects.filter(p=>p!==form.proyectoOrigen).map(p=><option key={p}>{p}</option>)}</Select></Field><Field label="Interno en destino"><Select value={form.internoModo} onChange={v=>set("internoModo",v)}><option value="MISMO">Mantiene el mismo interno</option><option value="NUEVO">Nuevo interno</option></Select></Field>{form.internoModo==="NUEVO"&&<Field label="Nuevo interno"><Input value={form.internoNuevo} onChange={v=>set("internoNuevo",v.toUpperCase())} placeholder="Ej.: TOP-0067"/></Field>}</div></>}
      </div>}
      <Field label="Observación"><Input value={form.observacion} onChange={v=>set("observacion",v)} placeholder="Opcional"/></Field>
      {msg&&<div style={{fontSize:12,fontWeight:800,color:msg.includes("correctamente")?C.green:C.red}}>{msg}</div>}
      <div style={{display:"flex",justifyContent:"flex-end"}}><button onClick={save} disabled={saving} style={{...btn(true),background:C.greenDim,borderColor:C.green,color:C.green,opacity:saving?.6:1}}>{saving?"Guardando...":"Guardar movimiento"}</button></div>
    </div>
    <div style={{background:"rgba(24,24,24,.94)",border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}><div style={{padding:"12px 14px",fontWeight:900,color:C.text}}>Últimos movimientos — {tab==="MOVILIZACION"?"Movilización":tab[0]+tab.slice(1).toLowerCase()}</div><div style={{overflowX:"auto",maxHeight:420}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr>{["Fecha","Interno","Equipo","Origen","Destino","Motivo","Horómetro","Usuario"].map(h=><th key={h} style={{textAlign:"left",padding:"9px 10px",borderTop:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`,color:C.textMuted,background:"#151515"}}>{h}</th>)}</tr></thead><tbody>{filtered.map((r,i)=><tr key={r.id||r.ID||i}><td style={{padding:9,borderBottom:`1px solid ${C.border}55`}}>{fmtDate(r.fechaHora||r.FECHA_HORA)}</td><td style={{padding:9,borderBottom:`1px solid ${C.border}55`,fontWeight:800,color:C.purple}}>{r.interno||r.INTERNO}</td><td style={{padding:9,borderBottom:`1px solid ${C.border}55`}}>{r.equipo||r.EQUIPO||"—"}</td><td style={{padding:9,borderBottom:`1px solid ${C.border}55`}}>{r.proyectoOrigen||r.PROYECTO_ORIGEN||"—"}</td><td style={{padding:9,borderBottom:`1px solid ${C.border}55`}}>{r.proyectoDestino||r.PROYECTO_DESTINO||"—"}</td><td style={{padding:9,borderBottom:`1px solid ${C.border}55`}}>{r.motivo||r.MOTIVO||"—"}</td><td style={{padding:9,borderBottom:`1px solid ${C.border}55`}}>{r.horometro??r.HOROMETRO??"—"}</td><td style={{padding:9,borderBottom:`1px solid ${C.border}55`}}>{r.usuario||r.USUARIO||"—"}</td></tr>)}{!filtered.length&&<tr><td colSpan={8} style={{padding:20,textAlign:"center",color:C.textMuted}}>{loading?"Cargando...":"Sin movimientos registrados"}</td></tr>}</tbody></table></div></div>
  </div>;
}
