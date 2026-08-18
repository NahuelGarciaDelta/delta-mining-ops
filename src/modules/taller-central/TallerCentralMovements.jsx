import React,{useEffect,useMemo,useState} from "react";
import {C} from "../../components/ui/index.jsx";
import {cancelEquipmentMovement,saveEquipmentMovement,useEquipmentMovements} from "../../services/equipmentMovements.js";

const MARKER="DM_TALLER:";
const norm=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]/g,"");
const pick=(row,names)=>{const keys=Object.keys(row||{});for(const n of names){const nn=norm(n);const k=keys.find(x=>norm(x)===nn);if(k)return row[k];}for(const n of names){const nn=norm(n);const k=keys.find(x=>norm(x).includes(nn)||nn.includes(norm(x)));if(k)return row[k];}return"";};
const code=v=>{const raw=String(v||"").trim().toUpperCase().replace(/\s*\(.*?\)/g,"").replace(/[^A-Z0-9]/g,"");const m=raw.match(/^([A-Z]{2,4})(\d{1,6})$/);return m?`${m[1]}-${m[2].padStart(4,"0")}`:String(v||"").trim().toUpperCase();};
const project=v=>String(v||"").trim().toUpperCase();
const iso=v=>String(v||"").slice(0,10);
const fmtDate=v=>{const s=iso(v);return /^\d{4}-\d{2}-\d{2}$/.test(s)?`${s.slice(8,10)}/${s.slice(5,7)}/${s.slice(0,4)}`:"—";};
const encodeMeta=data=>`${MARKER}${encodeURIComponent(JSON.stringify(data))}`;
const parseMeta=movement=>{const raw=String(movement?.observacion||"");const i=raw.indexOf(MARKER);if(i<0)return null;try{return JSON.parse(decodeURIComponent(raw.slice(i+MARKER.length).trim()));}catch{return null;}};
const inputStyle={height:38,borderRadius:8,border:`1px solid ${C.border}`,background:"#151515",color:C.text,padding:"0 11px",outline:"none",fontSize:12,boxSizing:"border-box",width:"100%"};
const labelStyle={display:"flex",flexDirection:"column",gap:6,fontSize:11,fontWeight:800,color:C.textSub};
const tabStyle=active=>({border:`1px solid ${active?C.accent:C.border}`,background:active?C.redDim:"#191919",color:active?C.accent:C.textSub,borderRadius:8,padding:"9px 15px",fontWeight:800,cursor:"pointer"});
function Field({label,children}){return <label style={labelStyle}>{label}{children}</label>;}
function Select({value,onChange,children,disabled=false}){return <select value={value} onChange={e=>onChange(e.target.value)} disabled={disabled} style={{...inputStyle,opacity:disabled?.55:1}}>{children}</select>;}
function Input({value,onChange,...rest}){return <input value={value} onChange={e=>onChange(e.target.value)} style={inputStyle} {...rest}/>;}

function buildCatalog(listaEquipos=[],rop02All=[]){
  const latest=new Map();
  for(const r of rop02All||[]){const interno=code(r?.maquina||r?._internoRaw),fecha=iso(r?.fecha);if(!interno||!fecha)continue;const cur=latest.get(interno);if(!cur||fecha>cur.fecha)latest.set(interno,{fecha,proyecto:project(r?.proyecto||r?.lugar),horometro:Number(r?.horometroFinal??r?.hf??r?.horometro??0)||0});}
  const out=new Map();
  for(const r of listaEquipos||[]){const interno=code(pick(r,["Codigo nuevo","Código nuevo","Código interno","Interno","Codigo Drusila","Código Drusila"]));if(!interno)continue;const last=latest.get(interno)||{};out.set(interno,{interno,equipo:String(pick(r,["Familia","Tipo de equipo","Equipo","Descripción","Descripcion"])||"").trim(),marca:String(pick(r,["Marca"])||"").trim(),modelo:String(pick(r,["Modelo"])||"").trim(),propiedad:String(pick(r,["Propiedad"])||"").trim(),proyecto:last.proyecto||project(pick(r,["Lugar de alquiler","Proyecto","Lugar"])),horometro:last.horometro||Number(pick(r,["Horas","Horometro","Horómetro"]))||0,ultimaCarga:last.fecha||""});}
  for(const [interno,last] of latest)if(!out.has(interno))out.set(interno,{interno,equipo:"",marca:"",modelo:"",propiedad:"",proyecto:last.proyecto,horometro:last.horometro,ultimaCarga:last.fecha});
  return [...out.values()].sort((a,b)=>a.interno.localeCompare(b.interno,"es",{numeric:true}));
}

export default function TallerCentralMovements({listaEquipos=[],rop02All=[]}){
  const[tab,setTab]=useState("SUBIDA"),[saving,setSaving]=useState(false),[msg,setMsg]=useState("");
  const empty={equipo:"",marca:"",modelo:"",propiedad:"DELTA",interno:"",horometro:"",proyectoOrigen:"",proyectoDestino:"",motivoBaja:"MANTENIMIENTO",motivoOtro:"",internoModo:"MISMO",internoNuevo:"",observacion:""};
  const[form,setForm]=useState(empty);
  const{movements,reload}=useEquipmentMovements(rop02All,["tallerCentral"]);
  const catalog=useMemo(()=>buildCatalog(listaEquipos,rop02All),[listaEquipos,rop02All]);
  const projects=useMemo(()=>[...new Set((rop02All||[]).map(r=>project(r?.proyecto||r?.lugar)).filter(Boolean))].sort(),[rop02All]);
  const selected=useMemo(()=>catalog.find(x=>x.interno===form.interno)||null,[catalog,form.interno]);
  useEffect(()=>{if(selected)setForm(f=>({...f,equipo:selected.equipo,marca:selected.marca,modelo:selected.modelo,propiedad:selected.propiedad||f.propiedad,horometro:selected.horometro||f.horometro,proyectoOrigen:selected.proyecto||""}));},[selected]);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const reset=()=>setForm(empty);
  const rows=useMemo(()=>movements.map(m=>({movement:m,meta:parseMeta(m)})).filter(x=>x.meta).map(x=>({...x.meta,id:x.movement.id||"",fechaHora:x.meta.fechaHora||x.movement.fechaHora||"",usuario:x.meta.usuario||x.movement.usuario||""})),[movements]);
  const filtered=useMemo(()=>rows.filter(r=>String(r.tipo||"").toUpperCase()===tab).sort((a,b)=>String(b.fechaHora).localeCompare(String(a.fechaHora))).slice(0,100),[rows,tab]);

  const save=async()=>{
    const interno=code(form.interno);if(!interno){setMsg("Ingresá o seleccioná un interno.");return;}
    if(tab==="SUBIDA"&&!form.proyectoDestino){setMsg("Seleccioná el proyecto al que sube el equipo.");return;}
    if(tab==="BAJA"&&!form.motivoBaja){setMsg("Indicá la razón de la baja.");return;}
    if(tab==="MOVILIZACION"&&(!form.proyectoOrigen||!form.proyectoDestino)){setMsg("La movilización necesita proyecto origen y destino.");return;}
    if(tab==="MOVILIZACION"&&project(form.proyectoOrigen)===project(form.proyectoDestino)){setMsg("El proyecto destino debe ser distinto del actual.");return;}
    const internoDestino=tab==="MOVILIZACION"&&form.internoModo==="NUEVO"?code(form.internoNuevo):interno;if(tab==="MOVILIZACION"&&!internoDestino){setMsg("Ingresá el nuevo interno.");return;}
    const meta={tipo:tab,fechaHora:new Date().toISOString(),equipo:form.equipo,marca:form.marca,modelo:form.modelo,propiedad:form.propiedad,interno,horometro:Number(form.horometro)||0,proyectoOrigen:project(form.proyectoOrigen),proyectoDestino:project(form.proyectoDestino),motivo:tab==="BAJA"?(form.motivoBaja==="OTRO"?form.motivoOtro:form.motivoBaja):tab,internoDestino,observacion:form.observacion,usuario:sessionStorage.getItem("dm_user")||"Usuario"};
    setSaving(true);setMsg("");
    try{
      const res=await saveEquipmentMovement({interno,internoNormalizado:interno,proyectoOrigen:meta.proyectoOrigen||"TALLER CENTRAL",proyectoDestino:meta.proyectoDestino,tipoMovimiento:"OTRO",motivo:`TALLER_${tab}`,observacion:encodeMeta(meta),usuario:meta.usuario,fechaUltimoRop02:selected?.ultimaCarga||new Date().toISOString().slice(0,10)});
      const id=res?.movement?.id;if(id)await cancelEquipmentMovement(id,meta.usuario);
      await reload();setMsg("Movimiento guardado correctamente.");reset();
    }catch(e){setMsg(e?.message||"No se pudo guardar el movimiento.");}finally{setSaving(false);}
  };

  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{[["SUBIDA","Subida"],["BAJA","Baja"],["MOVILIZACION","Movilización"]].map(([k,l])=><button key={k} style={tabStyle(tab===k)} onClick={()=>{setTab(k);setMsg("");reset();}}>{l}</button>)}</div>
    <div style={{background:"rgba(24,24,24,.94)",border:`1px solid ${C.border}`,borderRadius:12,padding:16,display:"flex",flexDirection:"column",gap:14}}>
      <div><div style={{fontSize:15,fontWeight:900,color:C.text}}>{tab==="SUBIDA"?"Registrar subida de equipo":tab==="BAJA"?"Registrar baja de equipo":"Registrar movilización entre proyectos"}</div><div style={{fontSize:11,color:C.textMuted,marginTop:3}}>Registro compartido. No modifica el control de Atraso.</div></div>
      {tab==="SUBIDA"?<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}><Field label="Equipo"><Input value={form.equipo} onChange={v=>set("equipo",v)} placeholder="Ej.: Topadora"/></Field><Field label="Marca"><Input value={form.marca} onChange={v=>set("marca",v)}/></Field><Field label="Modelo"><Input value={form.modelo} onChange={v=>set("modelo",v)}/></Field><Field label="Propiedad"><Select value={form.propiedad} onChange={v=>set("propiedad",v)}><option>DELTA</option><option>ALQUILADO</option><option>OTRO</option></Select></Field><Field label="Interno"><Input value={form.interno} onChange={v=>set("interno",v.toUpperCase())} placeholder="Ej.: TOP-0067"/></Field><Field label="Horómetro"><Input type="number" value={form.horometro} onChange={v=>set("horometro",v)}/></Field><Field label="Proyecto destino"><Select value={form.proyectoDestino} onChange={v=>set("proyectoDestino",v)}><option value="">Seleccionar...</option>{projects.map(p=><option key={p}>{p}</option>)}</Select></Field></div>:<div style={{display:"flex",flexDirection:"column",gap:12}}><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:12}}><Field label="Equipo"><Select value={form.interno} onChange={v=>set("interno",v)}><option value="">Seleccionar equipo...</option>{catalog.map(x=><option key={x.interno} value={x.interno}>{x.interno}{x.equipo?` · ${x.equipo}`:""}</option>)}</Select></Field><Field label="Proyecto actual"><Input value={form.proyectoOrigen} onChange={()=>{}} disabled placeholder="Se detecta desde ROP02"/></Field><Field label="Horómetro actual"><Input value={String(form.horometro||"")} onChange={()=>{}} disabled/></Field></div>{tab==="BAJA"?<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:12}}><Field label="Razón por la que baja"><Select value={form.motivoBaja} onChange={v=>set("motivoBaja",v)}><option value="MANTENIMIENTO">Mantenimiento</option><option value="REPARACION">Reparación</option><option value="DESMOVILIZACION">Desmovilización</option><option value="FIN_ALQUILER">Fin de alquiler</option><option value="BAJA_DEFINITIVA">Baja definitiva</option><option value="OTRO">Otra</option></Select></Field>{form.motivoBaja==="OTRO"&&<Field label="Detalle"><Input value={form.motivoOtro} onChange={v=>set("motivoOtro",v)}/></Field>}</div>:<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:12}}><Field label="Proyecto destino"><Select value={form.proyectoDestino} onChange={v=>set("proyectoDestino",v)}><option value="">Seleccionar...</option>{projects.filter(p=>p!==form.proyectoOrigen).map(p=><option key={p}>{p}</option>)}</Select></Field><Field label="Interno en destino"><Select value={form.internoModo} onChange={v=>set("internoModo",v)}><option value="MISMO">Mantiene el mismo interno</option><option value="NUEVO">Nuevo interno</option></Select></Field>{form.internoModo==="NUEVO"&&<Field label="Nuevo interno"><Input value={form.internoNuevo} onChange={v=>set("internoNuevo",v.toUpperCase())} placeholder="Ej.: TOP-0067"/></Field>}</div>}</div>}
      <Field label="Observación"><Input value={form.observacion} onChange={v=>set("observacion",v)} placeholder="Opcional"/></Field>{msg&&<div style={{fontSize:12,fontWeight:800,color:msg.includes("correctamente")?C.green:C.red}}>{msg}</div>}<div style={{display:"flex",justifyContent:"flex-end"}}><button onClick={save} disabled={saving} style={{...tabStyle(true),background:C.greenDim,borderColor:C.green,color:C.green,opacity:saving?.6:1}}>{saving?"Guardando...":"Guardar movimiento"}</button></div>
    </div>
    <div style={{background:"rgba(24,24,24,.94)",border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}><div style={{padding:"12px 14px",fontWeight:900,color:C.text}}>Últimos movimientos — {tab==="MOVILIZACION"?"Movilización":tab[0]+tab.slice(1).toLowerCase()}</div><div style={{overflowX:"auto",maxHeight:420}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr>{["Fecha","Interno","Equipo","Origen","Destino","Motivo","Horómetro","Usuario"].map(h=><th key={h} style={{textAlign:"left",padding:"9px 10px",borderTop:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`,color:C.textMuted,background:"#151515"}}>{h}</th>)}</tr></thead><tbody>{filtered.map((r,i)=><tr key={r.id||i}><td style={{padding:9,borderBottom:`1px solid ${C.border}55`}}>{fmtDate(r.fechaHora)}</td><td style={{padding:9,borderBottom:`1px solid ${C.border}55`,fontWeight:800,color:C.purple}}>{r.interno}</td><td style={{padding:9,borderBottom:`1px solid ${C.border}55`}}>{r.equipo||"—"}</td><td style={{padding:9,borderBottom:`1px solid ${C.border}55`}}>{r.proyectoOrigen||"—"}</td><td style={{padding:9,borderBottom:`1px solid ${C.border}55`}}>{r.proyectoDestino||"—"}</td><td style={{padding:9,borderBottom:`1px solid ${C.border}55`}}>{r.motivo||"—"}</td><td style={{padding:9,borderBottom:`1px solid ${C.border}55`}}>{r.horometro??"—"}</td><td style={{padding:9,borderBottom:`1px solid ${C.border}55`}}>{r.usuario||"—"}</td></tr>)}{!filtered.length&&<tr><td colSpan={8} style={{padding:20,textAlign:"center",color:C.textMuted}}>Sin movimientos registrados</td></tr>}</tbody></table></div></div>
  </div>;
}
