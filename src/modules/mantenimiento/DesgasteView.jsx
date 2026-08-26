import React,{useEffect,useMemo,useRef,useState} from "react";
import * as XLSX from "xlsx";
import {C,Icon,StatCard} from "../../components/ui/index.jsx";
import {APPS_SCRIPT_URL} from "../../config/app.js";
import {fmtNum,fmtUSD,normalizeInsumoCode,normDate} from "../../shared/domain/index.jsx";

const STORAGE_KEY="dm_desgaste_catalog_v2";
const LEGACY_STORAGE_KEY="dm_desgaste_catalog_v1";
const MESES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const norm=v=>String(v??"").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const first=(row,names)=>{const keys=Object.keys(row||{});for(const n of names){const target=norm(n).replace(/[^A-Z0-9]/g,"");const k=keys.find(x=>norm(x).replace(/[^A-Z0-9]/g,"")===target);if(k)return row[k];}return"";};
const moneyARS=v=>Number(v||0)>0?"$ "+Number(v||0).toLocaleString("es-AR",{maximumFractionDigits:0}):"—";
const pct=v=>Number.isFinite(v)?`${v.toLocaleString("es-AR",{minimumFractionDigits:1,maximumFractionDigits:1})}%`:"—";
const selectStyle={background:C.surface,color:C.text,border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 10px",minWidth:135,fontSize:12,fontFamily:"Inter",outline:"none"};
const labelStyle={fontSize:10,color:C.textMuted,fontWeight:700,letterSpacing:".04em"};
const cardStyle={background:"rgba(22,22,22,.74)",backdropFilter:"blur(9px)",WebkitBackdropFilter:"blur(9px)",border:`1px solid ${C.border}66`,borderRadius:12,overflow:"hidden"};
const cellStyle={padding:"8px 10px",borderBottom:`1px solid ${C.border}28`,fontSize:12};

function parseCatalogRows(raw){
  const parsed=(raw||[]).map(r=>({
    codigo:normalizeInsumoCode(first(r,["CODIGO","CÓDIGO","CODIGO DE ARTICULO","CÓDIGO DE ARTÍCULO"])),
    articulo:String(first(r,["ARTICULO","ARTÍCULO","DESCRIPCION","DESCRIPCIÓN","NOMBRE"])||"").trim(),
    descripcionAdicional:String(first(r,["DESCRIPCION ADICIONAL","DESCRIPCIÓN ADICIONAL"])||"").trim(),
    clasificacion:String(first(r,["CLASIFICACION","CLASIFICACIÓN"])||"").trim(),
  })).filter(x=>x.codigo);
  return [...new Map(parsed.map(x=>[x.codigo,x])).values()];
}

async function postCentralCatalog(rows){
  const payload={action:"save_articulos_desgaste",rows};
  const response=await fetch(APPS_SCRIPT_URL,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},body:new URLSearchParams({payload:JSON.stringify(payload)}),redirect:"follow",cache:"no-store"});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  const text=await response.text();let json;try{json=JSON.parse(text);}catch(_){throw new Error("El Apps Script no devolvió JSON válido");}
  if(!json?.ok)throw new Error(json?.error?.message||"No se pudo guardar el catálogo central");
  return json;
}

async function getCentralCatalog(){
  const url=new URL(APPS_SCRIPT_URL);url.searchParams.set("action","articulos_desgaste");url.searchParams.set("force","1");url.searchParams.set("limit","all");url.searchParams.set("_t",String(Date.now()));
  const response=await fetch(url.toString(),{cache:"no-store",redirect:"follow"});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  const text=await response.text();let json;try{json=JSON.parse(text);}catch(_){throw new Error("El Apps Script no devolvió JSON válido");}
  if(!json?.ok)throw new Error(json?.error?.message||"Catálogo central no disponible");
  return parseCatalogRows(json.data||[]);
}

export default function DesgasteView({rma15=[],usdRate}){
  const inputRef=useRef(null);
  const now=new Date();
  const [catalog,setCatalog]=useState(()=>{try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||localStorage.getItem(LEGACY_STORAGE_KEY)||"[]");}catch(_){return[];}});
  const [catalogSource,setCatalogSource]=useState("local");
  const [catalogBusy,setCatalogBusy]=useState(false);
  const [catalogMessage,setCatalogMessage]=useState("");
  const [mode,setMode]=useState("periodo");
  const [year,setYear]=useState(String(now.getFullYear()));
  const [month,setMonth]=useState(now.getMonth());
  const [from,setFrom]=useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`);
  const [to,setTo]=useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(new Date(now.getFullYear(),now.getMonth()+1,0).getDate()).padStart(2,"0")}`);
  const [project,setProject]=useState("todos");
  const [type,setType]=useState("todos");
  const [machine,setMachine]=useState("todas");
  const [article,setArticle]=useState("todos");

  useEffect(()=>{
    let active=true;setCatalogBusy(true);
    getCentralCatalog().then(rows=>{if(!active)return;if(rows.length||catalog.length===0){setCatalog(rows);localStorage.setItem(STORAGE_KEY,JSON.stringify(rows));}setCatalogSource("central");setCatalogMessage("");}).catch(()=>{if(active){setCatalogSource("local");setCatalogMessage("Fuente central pendiente de publicar; se usa respaldo local.");}}).finally(()=>{if(active)setCatalogBusy(false);});
    return()=>{active=false;};
  },[]);

  const codes=useMemo(()=>new Set(catalog.map(x=>normalizeInsumoCode(x.codigo)).filter(Boolean)),[catalog]);
  const catalogByCode=useMemo(()=>new Map(catalog.map(x=>[normalizeInsumoCode(x.codigo),x])),[catalog]);
  const wearRows=useMemo(()=>{
    const out=[];
    (rma15||[]).forEach(ot=>{
      const fecha=normDate(ot.fecha);if(!fecha)return;
      (ot.insumos||[]).forEach(i=>{
        const codigo=normalizeInsumoCode(i.codigo);if(!codes.has(codigo))return;
        out.push({fecha,mes:fecha.slice(0,7),proyecto:ot.proyecto||"S/D",tipo:ot.tipoEquipo||"S/D",maquina:ot.maquina||"S/D",codigo,articulo:i.nombre||catalogByCode.get(codigo)?.articulo||codigo,cantidad:Number(i.cantidad||0),unitario:Number(i.costoUnitario||0),total:Number(i.costoTotal||0)});
      });
    });
    return out;
  },[rma15,codes,catalogByCode]);

  const period=useMemo(()=>{if(mode==="mes"){const m=String(Number(month)+1).padStart(2,"0");const last=new Date(Number(year),Number(month)+1,0).getDate();return[`${year}-${m}-01`,`${year}-${m}-${String(last).padStart(2,"0")}`];}return[from,to];},[mode,year,month,from,to]);
  const maintenanceBase=useMemo(()=>(rma15||[]).filter(ot=>{
    const fecha=normDate(ot.fecha);if(!fecha)return false;
    if(period[0]&&fecha<period[0])return false;if(period[1]&&fecha>period[1])return false;
    if(project!=="todos"&&(ot.proyecto||"S/D")!==project)return false;if(type!=="todos"&&(ot.tipoEquipo||"S/D")!==type)return false;if(machine!=="todas"&&(ot.maquina||"S/D")!==machine)return false;
    return true;
  }),[rma15,period,project,type,machine]);
  const filtered=useMemo(()=>wearRows.filter(r=>{
    if(period[0]&&r.fecha<period[0])return false;if(period[1]&&r.fecha>period[1])return false;
    if(project!=="todos"&&r.proyecto!==project)return false;if(type!=="todos"&&r.tipo!==type)return false;if(machine!=="todas"&&r.maquina!==machine)return false;if(article!=="todos"&&r.codigo!==article)return false;return true;
  }),[wearRows,period,project,type,machine,article]);
  const options=useMemo(()=>({projects:[...new Set(wearRows.map(r=>r.proyecto))].sort(),types:[...new Set(wearRows.map(r=>r.tipo))].sort(),machines:[...new Set(wearRows.map(r=>r.maquina))].sort(),articles:[...new Map(wearRows.map(r=>[r.codigo,{codigo:r.codigo,articulo:r.articulo}])).values()].sort((a,b)=>a.codigo.localeCompare(b.codigo))}),[wearRows]);
  const totalWear=filtered.reduce((s,r)=>s+r.total,0),qty=filtered.reduce((s,r)=>s+r.cantidad,0);
  const totalMaintenance=maintenanceBase.reduce((s,r)=>s+Number(r.costoTotal||0),0);
  const wearShare=totalMaintenance>0?(totalWear/totalMaintenance)*100:0;
  const maintByMachine=useMemo(()=>{const m=new Map();maintenanceBase.forEach(r=>{const eq=r.maquina||"S/D";m.set(eq,(m.get(eq)||0)+Number(r.costoTotal||0));});return m;},[maintenanceBase]);
  const byMachine=useMemo(()=>{const m=new Map();filtered.forEach(r=>{const x=m.get(r.maquina)||{maquina:r.maquina,total:0,cantidad:0,items:0};x.total+=r.total;x.cantidad+=r.cantidad;x.items++;m.set(r.maquina,x);});return[...m.values()].map(x=>{const mantenimiento=maintByMachine.get(x.maquina)||0;return{...x,mantenimiento,porcentaje:mantenimiento>0?(x.total/mantenimiento)*100:0};}).sort((a,b)=>b.total-a.total);},[filtered,maintByMachine]);
  const byMonth=useMemo(()=>{const m=new Map();filtered.forEach(r=>m.set(r.mes,(m.get(r.mes)||0)+r.total));return[...m].sort().map(([mes,total])=>({mes,total}));},[filtered]);
  const byArticle=useMemo(()=>{const m=new Map();filtered.forEach(r=>{const x=m.get(r.codigo)||{codigo:r.codigo,articulo:r.articulo,total:0,cantidad:0};x.total+=r.total;x.cantidad+=r.cantidad;m.set(r.codigo,x);});return[...m.values()].sort((a,b)=>b.total-a.total);},[filtered]);

  const upload=async e=>{const file=e.target.files?.[0];if(!file)return;try{setCatalogBusy(true);setCatalogMessage("");const data=await file.arrayBuffer();const wb=XLSX.read(data,{type:"array"});const ws=wb.Sheets[wb.SheetNames[0]];const raw=XLSX.utils.sheet_to_json(ws,{defval:""});const unique=parseCatalogRows(raw);if(!unique.length)throw new Error("No se encontraron códigos en el archivo");setCatalog(unique);localStorage.setItem(STORAGE_KEY,JSON.stringify(unique));try{await postCentralCatalog(unique);setCatalogSource("central");setCatalogMessage(`Catálogo central actualizado: ${unique.length} artículos.`);}catch(err){setCatalogSource("local");setCatalogMessage(`Excel cargado localmente. Falta publicar el backend central (${err.message}).`);}}catch(err){setCatalogMessage("No se pudo leer el Excel: "+err.message);}finally{setCatalogBusy(false);e.target.value="";}};
  const clear=()=>{setProject("todos");setType("todos");setMachine("todas");setArticle("todos");};

  return <div style={{display:"flex",flexDirection:"column",gap:12}}>
    <div style={{...cardStyle,padding:14}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}>
        <div><div style={{fontWeight:900,fontSize:15,color:C.text}}>Análisis de consumo de desgaste</div><div style={{fontSize:11,color:C.textMuted,marginTop:3}}>Cruza los artículos definidos como desgaste con los consumos de RMA15 y compara su incidencia sobre el costo total de mantenimiento.</div></div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}><input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" onChange={upload} style={{display:"none"}}/><button disabled={catalogBusy} onClick={()=>inputRef.current?.click()} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",borderRadius:7,border:`1px solid ${C.yellow}88`,background:C.yellowDim,color:C.yellow,fontSize:11,fontWeight:800,cursor:catalogBusy?"wait":"pointer"}}><Icon name="fileSpreadsheet" size={14} color={C.yellow}/>{catalogBusy?"Sincronizando...":"Cargar Excel de desgaste"}</button><span style={{fontSize:10,color:catalogSource==="central"?C.green:C.yellow,fontWeight:700}}>{catalogSource==="central"?"● Fuente central":"● Respaldo local"} · {catalog.length} códigos</span></div>
      </div>
      {catalogMessage&&<div style={{marginTop:9,fontSize:10,color:catalogSource==="central"?C.green:C.yellow}}>{catalogMessage}</div>}
      <div style={{display:"flex",gap:8,alignItems:"end",flexWrap:"wrap",marginTop:14}}>
        <button onClick={()=>setMode("mes")} style={{...selectStyle,minWidth:80,cursor:"pointer",background:mode==="mes"?C.accentDim:C.surface,borderColor:mode==="mes"?C.accent:C.border,color:mode==="mes"?C.accent:C.textSub,fontWeight:800}}>Por mes</button><button onClick={()=>setMode("periodo")} style={{...selectStyle,minWidth:90,cursor:"pointer",background:mode==="periodo"?C.accentDim:C.surface,borderColor:mode==="periodo"?C.accent:C.border,color:mode==="periodo"?C.accent:C.textSub,fontWeight:800}}>Por período</button>
        {mode==="mes"?<><label style={labelStyle}>MES<br/><select value={month} onChange={e=>setMonth(Number(e.target.value))} style={selectStyle}>{MESES.map((x,i)=><option key={x} value={i}>{x}</option>)}</select></label><label style={labelStyle}>AÑO<br/><select value={year} onChange={e=>setYear(e.target.value)} style={selectStyle}>{[2025,2026,2027,2028].map(y=><option key={y}>{y}</option>)}</select></label></>:<><label style={labelStyle}>DESDE<br/><input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={selectStyle}/></label><label style={labelStyle}>HASTA<br/><input type="date" value={to} onChange={e=>setTo(e.target.value)} style={selectStyle}/></label></>}
        <label style={labelStyle}>PROYECTO<br/><select value={project} onChange={e=>setProject(e.target.value)} style={selectStyle}><option value="todos">Todos</option>{options.projects.map(x=><option key={x}>{x}</option>)}</select></label>
        <label style={labelStyle}>TIPO DE MÁQUINA<br/><select value={type} onChange={e=>setType(e.target.value)} style={selectStyle}><option value="todos">Todas</option>{options.types.map(x=><option key={x}>{x}</option>)}</select></label>
        <label style={labelStyle}>MÁQUINA<br/><select value={machine} onChange={e=>setMachine(e.target.value)} style={selectStyle}><option value="todas">Todas</option>{options.machines.map(x=><option key={x}>{x}</option>)}</select></label>
        <label style={labelStyle}>INSUMO<br/><select value={article} onChange={e=>setArticle(e.target.value)} style={{...selectStyle,minWidth:210}}><option value="todos">Todos</option>{options.articles.map(x=><option key={x.codigo} value={x.codigo}>{x.codigo} — {x.articulo}</option>)}</select></label>
        <button onClick={clear} style={{...selectStyle,cursor:"pointer",minWidth:105,color:C.textSub}}>Limpiar filtros</button>
      </div>
    </div>

    {!catalog.length&&<div style={{...cardStyle,padding:13,borderColor:`${C.yellow}66`,color:C.textSub,fontSize:12}}>Cargá el Excel maestro de artículos de desgaste. Una vez publicado el backend central, la lista quedará compartida automáticamente por todas las PCs.</div>}

    <div style={{display:"grid",gridTemplateColumns:"repeat(6,minmax(140px,1fr))",gap:10}}>
      <StatCard icon="prod" label="Desgaste ARS" value={moneyARS(totalWear)} color={C.yellow} small/>
      <StatCard icon="prod" label="Desgaste USD" value={fmtUSD(totalWear,usdRate)} color={C.green} small/>
      <StatCard icon="wrench" label="Mant. total ARS" value={moneyARS(totalMaintenance)} color={C.blue} small/>
      <StatCard icon="dashboard" label="% desgaste" value={pct(wearShare)} color={wearShare>=30?C.red:wearShare>=15?C.yellow:C.green} small/>
      <StatCard icon="equip" label="Equipos" value={byMachine.length} color={C.purple} small/>
      <StatCard icon="fileSpreadsheet" label="Códigos usados" value={byArticle.length} color={C.accent} small/>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.55fr) minmax(280px,.75fr)",gap:12}}>
      <div style={cardStyle}><div style={{padding:"12px 14px",fontWeight:800,fontSize:13,borderBottom:`1px solid ${C.border}44`}}>Gasto por equipo</div><div style={{maxHeight:460,overflow:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead style={{position:"sticky",top:0,background:"rgba(20,20,20,.97)",zIndex:2}}><tr><th style={{...cellStyle,textAlign:"left"}}>Equipo</th><th style={{...cellStyle,textAlign:"right"}}>Cantidad</th><th style={{...cellStyle,textAlign:"right"}}>Desgaste ARS</th><th style={{...cellStyle,textAlign:"right"}}>Desgaste USD</th><th style={{...cellStyle,textAlign:"right"}}>Costo total de mant.</th><th style={{...cellStyle,textAlign:"right"}}>% de desgaste</th></tr></thead><tbody>{byMachine.map((x,i)=><tr key={x.maquina} style={{background:i%2?`${C.surface}55`:"transparent"}}><td style={{...cellStyle,fontWeight:800,color:C.blue}}>{x.maquina}</td><td style={{...cellStyle,textAlign:"right"}}>{fmtNum(x.cantidad)}</td><td style={{...cellStyle,textAlign:"right",color:C.yellow,fontWeight:800}}>{moneyARS(x.total)}</td><td style={{...cellStyle,textAlign:"right",color:C.green,fontWeight:700}}>{fmtUSD(x.total,usdRate)}</td><td style={{...cellStyle,textAlign:"right",color:C.text,fontWeight:700}}><div>{moneyARS(x.mantenimiento)}</div><div style={{fontSize:10,color:C.green,marginTop:2}}>{fmtUSD(x.mantenimiento,usdRate)}</div></td><td style={{...cellStyle,textAlign:"right",fontWeight:900,color:x.porcentaje>=30?C.red:x.porcentaje>=15?C.yellow:C.green}}>{pct(x.porcentaje)}</td></tr>)}</tbody></table>{!byMachine.length&&<div style={{padding:24,textAlign:"center",color:C.textMuted,fontSize:12}}>No hay consumos de desgaste para los filtros seleccionados.</div>}</div></div>
      <div style={cardStyle}><div style={{padding:"12px 14px",fontWeight:800,fontSize:13,borderBottom:`1px solid ${C.border}44`}}>Gasto por mes</div><div style={{padding:"4px 14px 12px"}}>{byMonth.map(x=><div key={x.mes} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"10px 0",borderBottom:`1px solid ${C.border}28`}}><span style={{color:C.textSub}}>{x.mes}</span><span style={{textAlign:"right"}}><b style={{color:C.yellow}}>{moneyARS(x.total)}</b><div style={{fontSize:10,color:C.green,marginTop:2}}>{fmtUSD(x.total,usdRate)}</div></span></div>)}{!byMonth.length&&<div style={{padding:"18px 0",color:C.textMuted,fontSize:12}}>Sin datos.</div>}</div></div>
    </div>

    <div style={cardStyle}><div style={{padding:"12px 14px",fontWeight:800,fontSize:13,borderBottom:`1px solid ${C.border}44`}}>Detalle por artículo de desgaste</div><div style={{overflow:"auto",maxHeight:430}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead style={{position:"sticky",top:0,background:"rgba(20,20,20,.97)",zIndex:2}}><tr><th style={{...cellStyle,textAlign:"left"}}>Código</th><th style={{...cellStyle,textAlign:"left"}}>Artículo</th><th style={{...cellStyle,textAlign:"right"}}>Cantidad</th><th style={{...cellStyle,textAlign:"right"}}>Gasto ARS</th><th style={{...cellStyle,textAlign:"right"}}>Gasto USD</th></tr></thead><tbody>{byArticle.map((x,i)=><tr key={x.codigo} style={{background:i%2?`${C.surface}55`:"transparent"}}><td style={{...cellStyle,fontWeight:800,color:C.blue}}>{x.codigo}</td><td style={cellStyle}>{x.articulo}</td><td style={{...cellStyle,textAlign:"right"}}>{fmtNum(x.cantidad)}</td><td style={{...cellStyle,textAlign:"right",color:C.yellow,fontWeight:800}}>{moneyARS(x.total)}</td><td style={{...cellStyle,textAlign:"right",color:C.green,fontWeight:700}}>{fmtUSD(x.total,usdRate)}</td></tr>)}</tbody></table></div></div>
  </div>;
}
