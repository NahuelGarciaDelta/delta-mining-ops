import React,{useEffect,useMemo,useRef,useState} from "react";
import {createPortal} from "react-dom";
import * as XLSX from "xlsx";
import {C,Icon,StatCard,MultiSel,Sel,DateIn,TabBtn,matchMulti} from "../../components/ui/index.jsx";
import {APPS_SCRIPT_URL} from "../../config/app.js";
import {fmtNum,fmtUSD,normalizeInsumoCode,normDate} from "../../shared/domain/index.jsx";

const STORAGE_KEY="dm_desgaste_catalog_v2";
const LEGACY_STORAGE_KEY="dm_desgaste_catalog_v1";
const MESES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const norm=v=>String(v??"").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const first=(row,names)=>{const keys=Object.keys(row||{});for(const n of names){const target=norm(n).replace(/[^A-Z0-9]/g,"");const k=keys.find(x=>norm(x).replace(/[^A-Z0-9]/g,"")===target);if(k)return row[k];}return"";};
const moneyARS=v=>Number(v||0)>0?"$ "+Number(v||0).toLocaleString("es-AR",{maximumFractionDigits:0}):"—";
const pct=v=>Number.isFinite(v)?`${v.toLocaleString("es-AR",{minimumFractionDigits:1,maximumFractionDigits:1})}%`:"—";
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
  const url=new URL(APPS_SCRIPT_URL);
  url.searchParams.set("action","articulos_desgaste");
  url.searchParams.set("force","1");
  url.searchParams.set("limit","all");
  url.searchParams.set("_t",String(Date.now()));
  const response=await fetch(url.toString(),{cache:"no-store",redirect:"follow"});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  const text=await response.text();let json;try{json=JSON.parse(text);}catch(_){throw new Error("El Apps Script no devolvió JSON válido");}
  if(!json?.ok)throw new Error(json?.error?.message||"Catálogo central no disponible");
  return parseCatalogRows(json.data||[]);
}

function ArticleUsageTooltip({article,open,anchorRect}){
  const [pos,setPos]=useState({top:0,left:0});

  useEffect(()=>{
    if(!open||!anchorRect||typeof window==="undefined")return;
    const width=Math.min(390,Math.max(320,window.innerWidth-24));
    const left=Math.max(12,Math.min(anchorRect.left+Math.min(440,anchorRect.width*.28),window.innerWidth-width-12));
    const estimatedHeight=Math.min(390,150+Math.max(1,article.usos?.length||0)*76);
    const below=window.innerHeight-anchorRect.bottom;
    const top=below>estimatedHeight+18?anchorRect.bottom+8:Math.max(12,anchorRect.top-estimatedHeight-8);
    setPos({top,left});
  },[open,anchorRect,article]);

  const projectColor=p=>norm(p).includes("FILO")?C.red:C.cyan;
  if(!open||typeof document==="undefined")return null;

  return createPortal(
    <div style={{position:"fixed",top:pos.top,left:pos.left,width:"min(390px,calc(100vw - 24px))",maxHeight:"min(390px,calc(100vh - 24px))",overflow:"auto",zIndex:2147483646,background:"rgba(24,24,24,.99)",border:`1px solid ${C.accent}`,borderRadius:10,boxShadow:"0 18px 50px rgba(0,0,0,.72)",fontFamily:"Inter",color:C.text,pointerEvents:"none"}}>
      <div style={{padding:"10px 12px 8px",borderBottom:`1px solid ${C.border}66`,background:`${C.accent}12`}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
          <div style={{fontSize:13,fontWeight:900,lineHeight:1.25}}><span style={{color:C.text}}>{article.codigo}</span> — {article.articulo}</div>
          <div style={{flex:"0 0 auto",width:24,height:24,borderRadius:7,border:`1px solid ${C.border}`,background:"rgba(35,35,35,.9)",color:C.textMuted,fontSize:15,lineHeight:"20px",textAlign:"center"}}>×</div>
        </div>
        <div style={{fontSize:10,color:C.textMuted,marginTop:4}}>Detalle de consumo · se oculta al retirar el cursor de la fila</div>
      </div>
      <div style={{padding:"10px 12px"}}>
        {(article.usos||[]).map((uso,index)=><div key={`${uso.maquina}-${uso.proyecto}`} style={{padding:index?"10px 0 0":"0",marginTop:index?10:0,borderTop:index?`1px solid ${C.border}55`:"none"}}>
          <div style={{display:"grid",gridTemplateColumns:"92px 1fr",gap:"7px 10px",alignItems:"center",fontSize:11}}>
            <span style={{color:C.textMuted,fontWeight:700}}>Equipo</span><span style={{fontWeight:900,color:C.purple}}>{uso.maquina}</span>
            <span style={{color:C.textMuted,fontWeight:700}}>Proyecto</span><span><span style={{display:"inline-flex",alignItems:"center",padding:"3px 8px",borderRadius:999,border:`1px solid ${projectColor(uso.proyecto)}66`,background:`${projectColor(uso.proyecto)}18`,color:projectColor(uso.proyecto),fontWeight:900,fontSize:10}}>{uso.proyecto}</span></span>
            <span style={{color:C.textMuted,fontWeight:700}}>Cantidad</span><span style={{fontWeight:900,color:C.text}}>{fmtNum(uso.cantidad)}</span>
          </div>
        </div>)}
        {!article.usos?.length&&<div style={{fontSize:11,color:C.textMuted}}>No se encontraron equipos para este artículo con los filtros aplicados.</div>}
      </div>
    </div>,document.body
  );
}

export default function DesgasteView({rma15=[],usdRate}){
  const inputRef=useRef(null);
  const now=new Date();
  const [catalog,setCatalog]=useState(()=>{try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||localStorage.getItem(LEGACY_STORAGE_KEY)||"[]");}catch(_){return[];}});
  const [catalogSource,setCatalogSource]=useState("local");
  const [catalogBusy,setCatalogBusy]=useState(false);
  const [catalogMessage,setCatalogMessage]=useState("");
  const [mode,setMode]=useState("dia");
  const [day,setDay]=useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`);
  const [year,setYear]=useState(String(now.getFullYear()));
  const [month,setMonth]=useState(String(now.getMonth()));
  const [projects,setProjects]=useState("todos");
  const [types,setTypes]=useState("todos");
  const [machines,setMachines]=useState("todas");
  const [articles,setArticles]=useState("todos");
  const [hoveredArticle,setHoveredArticle]=useState(null);
  const [hoverAnchor,setHoverAnchor]=useState(null);

  useEffect(()=>{
    let active=true;setCatalogBusy(true);
    getCentralCatalog().then(rows=>{if(!active)return;if(rows.length||catalog.length===0){setCatalog(rows);localStorage.setItem(STORAGE_KEY,JSON.stringify(rows));}setCatalogSource("central");setCatalogMessage("");}).catch(()=>{if(active){setCatalogSource("local");setCatalogMessage("Fuente central no disponible; se usa respaldo local.");}}).finally(()=>{if(active)setCatalogBusy(false);});
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

  const period=useMemo(()=>{
    if(mode==="dia")return[day,day];
    const m=String(Number(month)+1).padStart(2,"0");
    const last=new Date(Number(year),Number(month)+1,0).getDate();
    return[`${year}-${m}-01`,`${year}-${m}-${String(last).padStart(2,"0")}`];
  },[mode,day,year,month]);

  const projectValues=useMemo(()=>[...new Set(wearRows.map(r=>r.proyecto).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),"es-AR",{numeric:true,sensitivity:"base"})),[wearRows]);
  const projectOptions=useMemo(()=>[{value:"todos",label:"Todos"},...projectValues.map(x=>({value:x,label:x}))],[projectValues]);
  const rowsByProject=useMemo(()=>wearRows.filter(r=>matchMulti(r.proyecto,projects,"todos")),[wearRows,projects]);
  const typeValues=useMemo(()=>[...new Set(rowsByProject.map(r=>r.tipo).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),"es-AR",{numeric:true,sensitivity:"base"})),[rowsByProject]);
  const typeOptions=useMemo(()=>[{value:"todos",label:"Todas"},...typeValues.map(x=>({value:x,label:x}))],[typeValues]);
  const rowsByType=useMemo(()=>rowsByProject.filter(r=>matchMulti(r.tipo,types,"todos")),[rowsByProject,types]);
  const machineValues=useMemo(()=>[...new Set(rowsByType.map(r=>r.maquina).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),"es-AR",{numeric:true,sensitivity:"base"})),[rowsByType]);
  const machineOptions=useMemo(()=>[{value:"todas",label:"Todas"},...machineValues.map(x=>({value:x,label:x}))],[machineValues]);
  const rowsByMachine=useMemo(()=>rowsByType.filter(r=>matchMulti(r.maquina,machines,"todas")),[rowsByType,machines]);
  const articleValues=useMemo(()=>[...new Map(rowsByMachine.map(r=>[r.codigo,{codigo:r.codigo,articulo:r.articulo}])).values()].sort((a,b)=>String(a.codigo).localeCompare(String(b.codigo),"es-AR",{numeric:true,sensitivity:"base"})),[rowsByMachine]);
  const articleOptions=useMemo(()=>[{value:"todos",label:"Todos"},...articleValues.map(x=>({value:x.codigo,label:`${x.codigo} — ${x.articulo}`}))],[articleValues]);
  const monthOptions=useMemo(()=>MESES.map((label,i)=>({value:String(i),label})),[]);
  const yearOptions=useMemo(()=>{
    const ys=new Set([String(now.getFullYear()),"2025","2026","2027","2028"]);
    wearRows.forEach(r=>{if(r.fecha)ys.add(String(r.fecha).slice(0,4));});
    return [...ys].sort().map(y=>({value:y,label:y}));
  },[wearRows]);

  const maintenanceBase=useMemo(()=>(rma15||[]).filter(ot=>{
    const fecha=normDate(ot.fecha);if(!fecha)return false;
    if(period[0]&&fecha<period[0])return false;if(period[1]&&fecha>period[1])return false;
    if(!matchMulti(ot.proyecto||"S/D",projects,"todos"))return false;
    if(!matchMulti(ot.tipoEquipo||"S/D",types,"todos"))return false;
    if(!matchMulti(ot.maquina||"S/D",machines,"todas"))return false;
    return true;
  }),[rma15,period,projects,types,machines]);

  const filtered=useMemo(()=>wearRows.filter(r=>{
    if(period[0]&&r.fecha<period[0])return false;if(period[1]&&r.fecha>period[1])return false;
    if(!matchMulti(r.proyecto,projects,"todos"))return false;
    if(!matchMulti(r.tipo,types,"todos"))return false;
    if(!matchMulti(r.maquina,machines,"todas"))return false;
    if(!matchMulti(r.codigo,articles,"todos"))return false;
    return true;
  }),[wearRows,period,projects,types,machines,articles]);

  useEffect(()=>{if(hoveredArticle&&!filtered.some(r=>r.codigo===hoveredArticle)){setHoveredArticle(null);setHoverAnchor(null);}},[filtered,hoveredArticle]);

  const totalWear=filtered.reduce((s,r)=>s+r.total,0);
  const totalMaintenance=maintenanceBase.reduce((s,r)=>s+Number(r.costoTotal||0),0);
  const wearShare=totalMaintenance>0?(totalWear/totalMaintenance)*100:0;
  const maintByMachine=useMemo(()=>{const m=new Map();maintenanceBase.forEach(r=>{const eq=r.maquina||"S/D";m.set(eq,(m.get(eq)||0)+Number(r.costoTotal||0));});return m;},[maintenanceBase]);
  const byMachine=useMemo(()=>{const m=new Map();filtered.forEach(r=>{const x=m.get(r.maquina)||{maquina:r.maquina,total:0,cantidad:0};x.total+=r.total;x.cantidad+=r.cantidad;m.set(r.maquina,x);});return[...m.values()].map(x=>{const mantenimiento=maintByMachine.get(x.maquina)||0;return{...x,mantenimiento,porcentaje:mantenimiento>0?(x.total/mantenimiento)*100:0};}).sort((a,b)=>b.total-a.total);},[filtered,maintByMachine]);
  const maintByMonth=useMemo(()=>{const m=new Map();maintenanceBase.forEach(r=>{const fecha=normDate(r.fecha);if(!fecha)return;const mes=fecha.slice(0,7);m.set(mes,(m.get(mes)||0)+Number(r.costoTotal||0));});return m;},[maintenanceBase]);
  const byMonth=useMemo(()=>{const m=new Map();filtered.forEach(r=>m.set(r.mes,(m.get(r.mes)||0)+r.total));return[...m].sort().map(([mes,total])=>{const mantenimiento=maintByMonth.get(mes)||0;return{mes,total,mantenimiento,porcentaje:mantenimiento>0?(total/mantenimiento)*100:0};});},[filtered,maintByMonth]);
  const byArticle=useMemo(()=>{
    const m=new Map();
    filtered.forEach(r=>{
      const x=m.get(r.codigo)||{codigo:r.codigo,articulo:r.articulo,total:0,cantidad:0,usos:new Map()};
      x.total+=r.total;x.cantidad+=r.cantidad;
      const usoKey=`${r.maquina}|||${r.proyecto}`;
      const uso=x.usos.get(usoKey)||{maquina:r.maquina,proyecto:r.proyecto,cantidad:0,total:0};
      uso.cantidad+=r.cantidad;uso.total+=r.total;x.usos.set(usoKey,uso);m.set(r.codigo,x);
    });
    return [...m.values()].map(x=>({...x,usos:[...x.usos.values()].sort((a,b)=>String(a.proyecto).localeCompare(String(b.proyecto),"es-AR",{numeric:true,sensitivity:"base"})||String(a.maquina).localeCompare(String(b.maquina),"es-AR",{numeric:true,sensitivity:"base"}))})).sort((a,b)=>b.total-a.total);
  },[filtered]);

  const upload=async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try{
      setCatalogBusy(true);setCatalogMessage("");
      const data=await file.arrayBuffer();const wb=XLSX.read(data,{type:"array"});const ws=wb.Sheets[wb.SheetNames[0]];const raw=XLSX.utils.sheet_to_json(ws,{defval:""});const unique=parseCatalogRows(raw);
      if(!unique.length)throw new Error("No se encontraron códigos en el archivo");
      setCatalog(unique);localStorage.setItem(STORAGE_KEY,JSON.stringify(unique));
      try{await postCentralCatalog(unique);setCatalogSource("central");setCatalogMessage(`Catálogo central actualizado: ${unique.length} artículos.`);}catch(err){setCatalogSource("local");setCatalogMessage(`Excel cargado localmente (${err.message}).`);}
    }catch(err){setCatalogMessage("No se pudo leer el Excel: "+err.message);}finally{setCatalogBusy(false);e.target.value="";}
  };

  const clear=()=>{setProjects("todos");setTypes("todos");setMachines("todas");setArticles("todos");setHoveredArticle(null);setHoverAnchor(null);};

  return <div style={{display:"flex",flexDirection:"column",gap:12}}>
    <div style={{...cardStyle,padding:14,overflow:"visible",position:"relative",zIndex:5}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}>
        <div><div style={{fontWeight:900,fontSize:15,color:C.text}}>Análisis de consumo de desgaste</div><div style={{fontSize:11,color:C.textMuted,marginTop:3}}>Cruza los artículos definidos como desgaste con los consumos de RMA15 y compara su incidencia sobre el costo total de mantenimiento.</div></div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}><input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" onChange={upload} style={{display:"none"}}/><button disabled={catalogBusy} onClick={()=>inputRef.current?.click()} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",borderRadius:7,border:`1px solid ${C.yellow}88`,background:C.yellowDim,color:C.yellow,fontSize:11,fontWeight:800,cursor:catalogBusy?"wait":"pointer"}}><Icon name="fileSpreadsheet" size={14} color={C.yellow}/>{catalogBusy?"Sincronizando...":"Cargar Excel de desgaste"}</button><span style={{fontSize:10,color:catalogSource==="central"?C.green:C.yellow,fontWeight:700}}>{catalogSource==="central"?"● Fuente central":"● Respaldo local"} · {catalog.length} códigos</span></div>
      </div>
      {catalogMessage&&<div style={{marginTop:9,fontSize:10,color:catalogSource==="central"?C.green:C.yellow}}>{catalogMessage}</div>}

      <div style={{display:"flex",gap:8,alignItems:"end",flexWrap:"wrap",marginTop:14}}>
        <TabBtn active={mode==="dia"} onClick={()=>setMode("dia")}>Por día</TabBtn>
        <TabBtn active={mode==="mes"} onClick={()=>setMode("mes")}>Por mes</TabBtn>
        {mode==="dia"?<DateIn label="Fecha" value={day} onChange={setDay}/>:<><Sel label="Mes" value={month} onChange={setMonth} options={monthOptions}/><Sel label="Año" value={year} onChange={setYear} options={yearOptions}/></>}
        <MultiSel label="Proyecto" value={projects} onChange={setProjects} options={projectOptions}/>
        <MultiSel label="Tipo de máquina" value={types} onChange={setTypes} options={typeOptions}/>
        <MultiSel label="Máquina" value={machines} onChange={setMachines} options={machineOptions}/>
        <MultiSel label="Insumo" value={articles} onChange={setArticles} options={articleOptions}/>
        <button onClick={clear} style={{alignSelf:"end",background:"transparent",border:`1px solid ${C.border}`,borderRadius:7,color:C.textSub,padding:"7px 12px",fontSize:11,cursor:"pointer",height:32}}>× Limpiar filtros</button>
      </div>
    </div>

    {!catalog.length&&<div style={{...cardStyle,padding:13,borderColor:`${C.yellow}66`,color:C.textSub,fontSize:12}}>Cargá el Excel maestro de artículos de desgaste.</div>}

    <div style={{display:"grid",gridTemplateColumns:"repeat(6,minmax(140px,1fr))",gap:10}}>
      <StatCard icon="prod" label="Desgaste ARS" value={moneyARS(totalWear)} color={C.yellow} small/>
      <StatCard icon="prod" label="Desgaste USD" value={fmtUSD(totalWear,usdRate)} color={C.green} small/>
      <StatCard icon="wrench" label="Mant. total ARS" value={moneyARS(totalMaintenance)} color={C.blue} small/>
      <StatCard icon="dashboard" label="% desgaste" value={pct(wearShare)} color={wearShare>=30?C.red:wearShare>=15?C.yellow:C.green} small/>
      <StatCard icon="equip" label="Equipos" value={byMachine.length} color={C.purple} small/>
      <StatCard icon="fileSpreadsheet" label="Códigos usados" value={byArticle.length} color={C.accent} small/>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.55fr) minmax(280px,.75fr)",gap:12}}>
      <div style={cardStyle}>
        <div style={{padding:"12px 14px",fontWeight:800,fontSize:13,borderBottom:`1px solid ${C.border}44`}}>Gasto por equipo</div>
        <div style={{maxHeight:460,overflow:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead style={{position:"sticky",top:0,background:"rgba(20,20,20,.97)",zIndex:2}}><tr><th style={{...cellStyle,textAlign:"left"}}>Equipo</th><th style={{...cellStyle,textAlign:"right"}}>Cantidad</th><th style={{...cellStyle,textAlign:"right"}}>Desgaste ARS</th><th style={{...cellStyle,textAlign:"right"}}>Desgaste USD</th><th style={{...cellStyle,textAlign:"right"}}>Costo total de mant.</th><th style={{...cellStyle,textAlign:"right"}}>% de desgaste</th></tr></thead><tbody>{byMachine.map((x,i)=><tr key={x.maquina} style={{background:i%2?`${C.surface}55`:"transparent"}}><td style={{...cellStyle,fontWeight:800,color:C.blue}}>{x.maquina}</td><td style={{...cellStyle,textAlign:"right"}}>{fmtNum(x.cantidad)}</td><td style={{...cellStyle,textAlign:"right",color:C.yellow,fontWeight:800}}>{moneyARS(x.total)}</td><td style={{...cellStyle,textAlign:"right",color:C.green,fontWeight:700}}>{fmtUSD(x.total,usdRate)}</td><td style={{...cellStyle,textAlign:"right",color:C.text,fontWeight:700}}><div>{moneyARS(x.mantenimiento)}</div><div style={{fontSize:10,color:C.green,marginTop:2}}>{fmtUSD(x.mantenimiento,usdRate)}</div></td><td style={{...cellStyle,textAlign:"right",fontWeight:900,color:x.porcentaje>=30?C.red:x.porcentaje>=15?C.yellow:C.green}}>{pct(x.porcentaje)}</td></tr>)}</tbody></table>{!byMachine.length&&<div style={{padding:24,textAlign:"center",color:C.textMuted,fontSize:12}}>No hay consumos de desgaste para los filtros seleccionados.</div>}</div>
      </div>
      <div style={cardStyle}><div style={{padding:"12px 14px",fontWeight:800,fontSize:13,borderBottom:`1px solid ${C.border}44`}}>Gasto por mes</div><div style={{padding:"4px 14px 12px"}}>{byMonth.map(x=><div key={x.mes} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"10px 0",borderBottom:`1px solid ${C.border}28`}}><span style={{color:C.textSub}}>{x.mes}</span><span style={{textAlign:"right"}}><b style={{color:C.yellow}}>{moneyARS(x.total)}</b><div style={{fontSize:10,color:C.green,marginTop:2}}>{fmtUSD(x.total,usdRate)}</div><div style={{fontSize:11,fontWeight:900,marginTop:4,color:x.porcentaje>=30?C.red:x.porcentaje>=15?C.yellow:C.green}}>% de desgaste: {pct(x.porcentaje)}</div></span></div>)}{!byMonth.length&&<div style={{padding:"18px 0",color:C.textMuted,fontSize:12}}>Sin datos.</div>}</div></div>
    </div>

    <div style={cardStyle}>
      <div style={{padding:"12px 14px",fontWeight:800,fontSize:13,borderBottom:`1px solid ${C.border}44`}}>Detalle por artículo de desgaste</div>
      <div style={{overflow:"auto",maxHeight:430}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead style={{position:"sticky",top:0,background:"rgba(20,20,20,.97)",zIndex:2}}><tr><th style={{...cellStyle,textAlign:"left"}}>Código</th><th style={{...cellStyle,textAlign:"left"}}>Artículo</th><th style={{...cellStyle,textAlign:"right"}}>Cantidad</th><th style={{...cellStyle,textAlign:"right"}}>Gasto ARS</th><th style={{...cellStyle,textAlign:"right"}}>Gasto USD</th></tr></thead><tbody>{byArticle.map((x,i)=>{const active=hoveredArticle===x.codigo;return <React.Fragment key={x.codigo}><tr onMouseEnter={e=>{setHoveredArticle(x.codigo);setHoverAnchor(e.currentTarget.getBoundingClientRect());}} onMouseLeave={()=>{setHoveredArticle(null);setHoverAnchor(null);}} style={{background:active?"rgba(239,35,60,.26)":i%2?`${C.surface}55`:"transparent",boxShadow:active?`inset 3px 0 0 ${C.accent}`:"none",transition:"background .12s ease"}}><td style={{...cellStyle,fontWeight:800,color:C.blue}}>{x.codigo}</td><td style={cellStyle}>{x.articulo}</td><td style={{...cellStyle,textAlign:"right",color:active?C.accent:C.text}}>{fmtNum(x.cantidad)}</td><td style={{...cellStyle,textAlign:"right",color:C.yellow,fontWeight:800}}>{moneyARS(x.total)}</td><td style={{...cellStyle,textAlign:"right",color:C.green,fontWeight:700}}>{fmtUSD(x.total,usdRate)}</td></tr><ArticleUsageTooltip article={x} open={active} anchorRect={hoverAnchor}/></React.Fragment>;})}</tbody></table></div>
    </div>
  </div>;
}
