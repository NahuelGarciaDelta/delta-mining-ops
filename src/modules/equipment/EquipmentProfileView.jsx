import React, { useEffect, useMemo, useState } from "react";
import { C, Card, StatCard, Table, Icon } from "../../components/ui/index.jsx";
import { APPS_SCRIPT_URL } from "../../config/app.js";
import { fetchAction } from "../../services/appsScriptApi.js";
import { registerRefreshTask } from "../../services/refreshManager.js";
import { cleanEquipmentCode, canonicalEquipmentCode } from "./equipmentCode.js";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";

function norm(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]/g,"");}
function pick(row,names){const keys=Object.keys(row||{});for(const n of names){const nn=norm(n);const exact=keys.find(k=>norm(k)===nn);if(exact)return row[exact];}for(const n of names){const nn=norm(n);const partial=keys.find(k=>norm(k).includes(nn)||nn.includes(norm(k)));if(partial)return row[partial];}return"";}
const MASTER_CODE_HEADERS=["Codigo nuevo","Código nuevo","Código de Drusila","Codigo de Drusila","Código Drusila","Codigo Drusila","Interno","Código interno","Codigo Int","Código viejo","Codigo viejo"];
function codesOfMaster(row){const out=[];for(const h of MASTER_CODE_HEADERS){const v=String(pick(row,[h])||"").trim();const key=canonicalEquipmentCode(v);if(v&&key&&!out.some(x=>canonicalEquipmentCode(x)===key))out.push(v);}return out;}
function sourceCode(row){return String(row?.maquina||row?.interno||row?.codigo||row?.["Codigo Int"]||row?.["Código Interno del Equipo"]||"").trim();}
function fmt(v,digits=1){const n=Number(v);return Number.isFinite(n)?n.toLocaleString("es-AR",{maximumFractionDigits:digits}):"—";}
function monthKey(v){const d=new Date(`${String(v||"").slice(0,10)}T12:00:00`);return Number.isNaN(d.getTime())?"":`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;}
function shortDate(v){if(!v)return"";const d=new Date(`${String(v).slice(0,10)}T12:00:00`);return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit"});}
function looksLikeEquipmentCode(v){const s=cleanEquipmentCode(v);return s.length>=4&&s.length<=24&&/[A-Z]/.test(s)&&/\d/.test(s);}
function buildCodeIndex(rows,codeGetter,sorter){const map=new Map();for(const row of rows||[]){const key=canonicalEquipmentCode(codeGetter(row));if(!key)continue;let bucket=map.get(key);if(!bucket){bucket=[];map.set(key,bucket);}bucket.push(row);}if(sorter){for(const bucket of map.values())bucket.sort(sorter);}return map;}

function EquipmentPicker({options,value,onChange}){
  return <select value={value||""} onChange={e=>onChange(e.target.value)} style={{width:"100%",height:40,boxSizing:"border-box",borderRadius:8,border:`1px solid ${C.border}`,background:"#151515",color:C.text,padding:"0 12px",fontSize:12,fontWeight:700,outline:"none",cursor:"pointer"}}>
    <option value="">Seleccionar equipo...</option>
    {options.map(o=><option key={o.key} value={o.value}>{o.label}</option>)}
  </select>;
}

function formatUSDFromARS(valueARS,usdRate){const ars=Number(valueARS),rate=Number(usdRate);if(!Number.isFinite(ars)||ars<=0||!Number.isFinite(rate)||rate<=0)return"—";return formatUSDNumber(ars/rate);}
function formatUSDNumber(valueUSD){const usd=Number(valueUSD);if(!Number.isFinite(usd))return"USD 0,00";return`USD ${usd.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;}

function maintenanceCostARS(row,insumosCatalog){
  const items=Array.isArray(row?.insumos)?row.insumos:[];
  let total=0;
  for(const item of items){
    const code=String(item?.codigo||"").trim().toUpperCase().replace(/\s+/g,"").replace(/[–—]/g,"-");
    const qty=Number(item?.cantidad)||0;
    const catalog=insumosCatalog?.[code]||{};
    const unit=Number(catalog?.costoUnitario);
    if(qty>0&&Number.isFinite(unit)&&unit>0)total+=qty*unit;
    else total+=Number(item?.costoTotal)||0;
  }
  if(total>0)return total;
  return Number(row?.costoTotal)||0;
}
function Rma15UsdTooltip({active,payload,label}){if(!active||!payload?.length)return null;const value=Number(payload[0]?.value)||0;return <div style={{background:"rgba(23,23,23,.98)",border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",boxShadow:"0 8px 24px rgba(0,0,0,.45)"}}><div style={{fontSize:11,color:C.textSub,marginBottom:4}}>{label}</div><div style={{fontSize:12,fontWeight:800,color:C.purple}}>{formatUSDNumber(value)}</div></div>;}

function EquipmentProfileView({listaEquipos=[],rop02All=[],rop05=[],rma15=[],insumos={},initialCode="",onSelectCode,usdRate}){
  const [selected,setSelected]=useState(()=>cleanEquipmentCode(initialCode));
  const [detailKey,setDetailKey]=useState(()=>canonicalEquipmentCode(initialCode));
  const [pm,setPm]=useState({config:[],registros:[]});

  // El selector debe responder de inmediato. La ficha pesada se actualiza en el
  // frame siguiente para que el navegador pueda pintar primero la opción elegida.
  // No propagamos cada selección al estado raíz de App: eso antes provocaba un
  // rerender de toda la aplicación y podía dejar el <select> bloqueado.
  useEffect(()=>{
    if(!initialCode)return;
    const clean=cleanEquipmentCode(initialCode);
    setSelected(clean);
    setDetailKey(canonicalEquipmentCode(clean));
  },[initialCode]);
  useEffect(()=>{
    try{
      if(selected)sessionStorage.setItem("dm_selected_equipment",cleanEquipmentCode(selected));
    }catch(_){}
    let alive=true;
    let raf=window.requestAnimationFrame(()=>{
      if(alive)setDetailKey(canonicalEquipmentCode(selected));
    });
    return()=>{alive=false;window.cancelAnimationFrame(raf);};
  },[selected]);
  const loadPm=React.useCallback(async()=>{const r=await fetchAction(APPS_SCRIPT_URL,"mantenimiento_programado");if(r?.ok)setPm({config:r.config||[],registros:r.registros||[]});return r;},[]);
  useEffect(()=>{loadPm().catch(()=>{});},[loadPm]);
  useEffect(()=>registerRefreshTask("equipment-profile",loadPm,{views:["equipmentProfile"],priority:20}),[loadPm]);

  // Índices construidos una sola vez por actualización de dataset. Cambiar de equipo
  // ya no recorre miles de filas de ROP02/RMA15/ROP05 en el hilo principal.
  const masterIndex=useMemo(()=>{const map=new Map();for(const row of listaEquipos){for(const c of codesOfMaster(row)){const key=canonicalEquipmentCode(c);if(key&&!map.has(key))map.set(key,row);}}return map;},[listaEquipos]);
  const rop02Index=useMemo(()=>buildCodeIndex(rop02All,sourceCode,(a,b)=>String(a.fecha||"").localeCompare(String(b.fecha||""))),[rop02All]);
  const rop05Index=useMemo(()=>buildCodeIndex(rop05,sourceCode),[rop05]);
  const rma15Index=useMemo(()=>buildCodeIndex(rma15,sourceCode,(a,b)=>String(b.fecha||"").localeCompare(String(a.fecha||""))),[rma15]);
  const pmRegIndex=useMemo(()=>buildCodeIndex(pm.registros||[],r=>pick(r,["Interno","Codigo","Equipo"]),(a,b)=>String(pick(b,["Fecha","Fecha PM"])||"").localeCompare(String(pick(a,["Fecha","Fecha PM"])||""))),[pm.registros]);

  const allCodes=useMemo(()=>{
    const catalog=new Map();
    const add=(raw,explicitMaster=null,fromMaster=false)=>{
      const rawCode=String(raw||"").trim();
      const key=canonicalEquipmentCode(rawCode);
      if(!key||(!fromMaster&&!looksLikeEquipmentCode(rawCode)))return;
      const master=explicitMaster||masterIndex.get(key)||null;
      const masterCodes=master?codesOfMaster(master):[];
      const preferred=cleanEquipmentCode(masterCodes[0]||rawCode);
      const existing=catalog.get(key);
      if(existing&&(!master||existing.master))return;
      const marca=pick(master||{},["Marca"]),modelo=pick(master||{},["Modelo"]),familia=pick(master||{},["Familia","Tipo"]);
      catalog.set(key,{key,value:preferred,label:`${preferred}${marca||modelo?` · ${[marca,modelo].filter(Boolean).join(" ")}`:familia?` · ${familia}`:""}`,master});
    };
    listaEquipos.forEach(row=>{const codes=codesOfMaster(row);if(codes.length)add(codes[0],row,true);});
    // Los índices ya recorrieron las fuentes completas: reutilizarlos evita una segunda
    // pasada por miles de registros sólo para construir el desplegable.
    for(const bucket of rop02Index.values())if(bucket[0])add(sourceCode(bucket[0]));
    for(const bucket of rop05Index.values())if(bucket[0])add(sourceCode(bucket[0]));
    for(const bucket of rma15Index.values())if(bucket[0])add(sourceCode(bucket[0]));
    (pm.config||[]).forEach(r=>add(pick(r,["Interno","Codigo","Equipo"])));
    for(const bucket of pmRegIndex.values())if(bucket[0])add(pick(bucket[0],["Interno","Codigo","Equipo"]));
    return [...catalog.values()].sort((a,b)=>a.label.localeCompare(b.label,"es",{numeric:true,sensitivity:"base"}));
  },[listaEquipos,rop02Index,rop05Index,rma15Index,pm.config,pmRegIndex,masterIndex]);

  // Si llega RPC-0016-JM, el selector utiliza RPC-0016; ambos comparten la misma clave.
  const selectedKey=detailKey;
  const selectedOption=useMemo(()=>allCodes.find(o=>o.key===selectedKey)||null,[allCodes,selectedKey]);

  const master=masterIndex.get(selectedKey)||selectedOption?.master||null;
  const op=rop02Index.get(selectedKey)||[];
  const prod=rop05Index.get(selectedKey)||[];
  const mant=rma15Index.get(selectedKey)||[];
  const pmReg=pmRegIndex.get(selectedKey)||[];

  const effectiveUsdRate=useMemo(()=>{try{const saved=JSON.parse(window.localStorage.getItem("delta_costos_mant_state_v1")||"{}");const configured=Number(saved?.usdRate2);if(Number.isFinite(configured)&&configured>0)return configured;}catch(_){}const fallback=Number(usdRate);return Number.isFinite(fallback)&&fallback>0?fallback:1400;},[usdRate]);

  const summary=useMemo(()=>{
    const lastOp=op[op.length-1]||{};
    const currentH=Number(lastOp.horometroFinal??lastOp.hf??lastOp.horometro??0)||0;
    let totalHours=0,totalFuel=0,prodHours=0,maintCostARS=0,operativos=0;
    for(const r of op){totalHours+=Number(r.horas??r.hs??0)||0;totalFuel+=Number(r.combustible??0)||0;}
    for(const r of prod)prodHours+=Number(r.cantHs??r.horasProductivas??r.hs??r.horas??0)||0;
    for(const r of mant){maintCostARS+=maintenanceCostARS(r,insumos);if(r.operativo!==false)operativos++;}
    return {lastOp,currentH,totalHours,totalFuel,prodHours,maintCostARS,fuelRate:totalHours>0?totalFuel/totalHours:0,availability:mant.length?Math.round(100*operativos/mant.length):null};
  },[op,prod,mant,insumos]);

  const project=summary.lastOp.proyecto||pick(master||{},["Proyecto","Lugar","Sitio"])||"—";
  const marca=pick(master||{},["Marca"]),modelo=pick(master||{},["Modelo"]),familia=pick(master||{},["Familia","Tipo"]),propiedad=pick(master||{},["Propiedad"]);
  const acquisition=pick(master||{},["Costo local en dólares sin IVA","Costo adquisición","Costo adquisicion"]);
  const rent=pick(master||{},["Tarifa mensual de alquiler","Tarifa mensual alquiler","Tarifa mensual de alquiler en dólares"]);

  const horometerSeries=useMemo(()=>op.slice(-90).map(r=>({fecha:shortDate(r.fecha),horometro:Number(r.horometroFinal??r.hf??0)||0})).filter(x=>x.horometro>0),[op]);
  const monthlyMaint=useMemo(()=>{const rate=Number(effectiveUsdRate);if(!Number.isFinite(rate)||rate<=0)return[];const map=new Map();for(const r of mant){const key=monthKey(r.fecha);if(key)map.set(key,(map.get(key)||0)+maintenanceCostARS(r,insumos)/rate);}return[...map.entries()].sort(([a],[b])=>a.localeCompare(b)).slice(-12).map(([key,value])=>({mes:key.slice(5)+"/"+key.slice(2,4),costo:Math.round(value*100)/100}));},[mant,effectiveUsdRate,insumos]);
  const rows=useMemo(()=>mant.slice(0,80).map((r,i)=>{const costoARS=maintenanceCostARS(r,insumos);return{id:`${selectedKey}-${i}`,fecha:r.fecha,tipo:r.tipoMant,intervencion:r.intervencion,kmHs:r.kmHs,costoUSD:Number(effectiveUsdRate)>0?costoARS/Number(effectiveUsdRate):0,operativo:r.operativo?"Sí":"No",observaciones:r.observaciones};}),[mant,effectiveUsdRate,selectedKey,insumos]);
  const cols=useMemo(()=>[{key:"fecha",label:"Fecha",width:100},{key:"tipo",label:"Tipo",width:120},{key:"intervencion",label:"Intervención",wrap:true,minWidth:240},{key:"kmHs",label:"Km / hs",width:90,render:value=>fmt(value)},{key:"costoUSD",label:"Insumos USD",width:120,render:value=>formatUSDNumber(value)},{key:"operativo",label:"Operativo",width:90},{key:"observaciones",label:"Observaciones",wrap:true,minWidth:220}],[]);

  const detailCode=selectedOption?.value||cleanEquipmentCode(selected);
  return <div style={{display:"flex",flexDirection:"column",gap:12,padding:"0 14px 18px",boxSizing:"border-box"}}>
    <Card title="Ficha única del equipo" tooltip="Integra Lista Maestra, ROP02, ROP05, RMA15 y PM del interno seleccionado.">
      <div style={{padding:"14px 16px 16px",display:"grid",gridTemplateColumns:"minmax(320px,560px) 1fr",gap:16,alignItems:"end"}}>
        <div><div style={{fontSize:10,color:C.textMuted,fontWeight:800,marginBottom:5}}>EQUIPO</div><EquipmentPicker options={allCodes} value={selected} onChange={v=>{
          const clean=cleanEquipmentCode(v);
          setSelected(clean);
        }}/><div style={{marginTop:5,fontSize:10,color:C.textMuted}}>{allCodes.length} internos únicos disponibles · sufijo -JM unificado automáticamente{canonicalEquipmentCode(selected)!==detailKey?" · actualizando ficha…":""}</div></div>
        {detailCode&&<div style={{display:"flex",gap:10,alignItems:"center",color:C.textSub,fontSize:12,flexWrap:"wrap",paddingBottom:4}}><Icon name="truck" size={18} color={C.accent}/><strong style={{color:C.text}}>{detailCode}</strong><span>{[marca,modelo].filter(Boolean).join(" ")||"Sin datos de marca/modelo"}</span><span>· {familia||"Sin familia"}</span><span>· {project}</span></div>}
      </div>
    </Card>
    {selectedKey?<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>
        <StatCard label="Horómetro actual" value={summary.currentH?`${fmt(summary.currentH)} h`:"—"} color={C.blue} tooltip="Último horómetro final registrado en ROP02."/>
        <StatCard label="Horas ROP02" value={`${fmt(summary.totalHours)} h`} color={C.teal} tooltip="Horas acumuladas del equipo en ROP02."/>
        <StatCard label="Horas productivas" value={`${fmt(summary.prodHours)} h`} color={C.green} tooltip="Horas productivas registradas en ROP05."/>
        <StatCard label="Consumo observado" value={summary.fuelRate>0?`${fmt(summary.fuelRate,2)} L/h`:"—"} color={C.blue} tooltip="Combustible ROP02 dividido por horas ROP02."/>
        <StatCard label="OT RMA15" value={mant.length} color={C.yellow} tooltip="Órdenes RMA15 asociadas al interno, incluyendo su variante con sufijo -JM."/>
        <StatCard label="Costo insumos RMA15" value={formatUSDFromARS(summary.maintCostARS,effectiveUsdRate)} color={C.purple} small valueStyle={{whiteSpace:"nowrap",fontSize:24}} tooltip="Suma valorizada de insumos RMA15 convertida a USD con el mismo tipo de cambio usado por Informe de Costos."/>
        <StatCard label="Disponibilidad registrada" value={summary.availability===null?"—":`${summary.availability}%`} color={summary.availability!==null&&summary.availability<80?C.red:C.green} tooltip="Porcentaje de OT RMA15 donde el equipo quedó operativo."/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.1fr) minmax(0,.9fr)",gap:12}}>
        <Card title="Datos de Lista Maestra"><div style={{padding:"14px 16px",display:"grid",gridTemplateColumns:"repeat(2,minmax(120px,1fr))",gap:"9px 18px",fontSize:12}}>{[["Marca",marca],["Modelo",modelo],["Familia",familia],["Propiedad",propiedad],["Proyecto actual",project],["Costo adquisición USD",acquisition],["Tarifa alquiler mensual",rent],["N° serie",pick(master||{},["N de serie","N° de serie","Numero de serie"])],["Año",pick(master||{},["Año de fabricacion","Año fabricacion"])],["Potencia",pick(master||{},["Potencia"])]].map(([k,v])=><div key={k}><span style={{color:C.textMuted}}>{k}: </span><strong>{v||"—"}</strong></div>)}</div></Card>
        <Card title="Mantenimiento programado"><div style={{padding:"14px 16px",fontSize:12,color:C.textSub,lineHeight:1.9}}><div>PM registrados: <strong style={{color:C.text}}>{pmReg.length}</strong></div><div>Último PM: <strong style={{color:C.text}}>{pmReg[0]?pick(pmReg[0],["Fecha","Fecha PM"]):"—"}</strong></div><div>Último horómetro PM: <strong style={{color:C.text}}>{pmReg[0]?fmt(pick(pmReg[0],["Horometro","Horómetro","Km / hs"])):"—"}</strong></div><div>Proyecto actual: <strong style={{color:C.text}}>{project}</strong></div></div></Card>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12}}>
        <Card title="Evolución de horómetro" tooltip="Últimos registros ROP02 con horómetro final válido."><div style={{height:240,padding:"10px 14px 14px"}}><ResponsiveContainer width="100%" height="100%"><LineChart data={horometerSeries}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)"/><XAxis dataKey="fecha" tick={{fill:C.textMuted,fontSize:10}}/><YAxis tick={{fill:C.textMuted,fontSize:10}} width={58}/><Tooltip/><Line type="monotone" dataKey="horometro" stroke={C.blue} dot={false} strokeWidth={2}/></LineChart></ResponsiveContainer></div></Card>
        <Card title="Costo mensual de insumos RMA15 (USD)" tooltip="Suma mensual de insumos RMA15 convertida a USD con el tipo de cambio vigente de Informe de Costos."><div style={{height:240,padding:"10px 14px 14px"}}><ResponsiveContainer width="100%" height="100%"><BarChart data={monthlyMaint}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)"/><XAxis dataKey="mes" tick={{fill:C.textMuted,fontSize:10}}/><YAxis tick={{fill:C.textMuted,fontSize:10}} width={86} tickFormatter={v=>`USD ${Number(v||0).toLocaleString("es-AR",{maximumFractionDigits:0})}`}/><Tooltip content={<Rma15UsdTooltip/>}/><Bar dataKey="costo" name="Costo" fill={C.purple}/></BarChart></ResponsiveContainer></div></Card>
      </div>
      <Card title="Historial RMA15 del equipo"><div style={{padding:"0 12px 12px"}}><Table tableId="equipment-profile-rma15" cols={cols} rows={rows} maxH={420} emptyMsg="Sin mantenimientos RMA15 para este equipo"/></div></Card>
    </>:null}
  </div>;
}

export default React.memo(EquipmentProfileView);
