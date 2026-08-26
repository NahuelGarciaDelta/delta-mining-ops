import React,{useMemo,useRef,useState} from "react";
import * as XLSX from "xlsx";
import {C,Icon} from "../../components/ui/index.jsx";
import {normalizeInsumoCode,normDate} from "../../shared/domain/index.jsx";

const STORAGE_KEY="dm_desgaste_catalog_v1";
const MESES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const money=v=>"$ "+Number(v||0).toLocaleString("es-AR",{maximumFractionDigits:0});
const norm=v=>String(v??"").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const first=(row,names)=>{const keys=Object.keys(row||{});for(const n of names){const target=norm(n).replace(/[^A-Z0-9]/g,"");const k=keys.find(x=>norm(x).replace(/[^A-Z0-9]/g,"")===target);if(k)return row[k];}return"";};
const selectStyle={background:"#151515",color:"#eee",border:"1px solid #444",borderRadius:7,padding:"8px 10px",minWidth:135,fontSize:12};

export default function DesgasteView({rma15=[]}){
  const inputRef=useRef(null);
  const now=new Date();
  const [catalog,setCatalog]=useState(()=>{try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");}catch(_){return[];}});
  const [mode,setMode]=useState("periodo");
  const [year,setYear]=useState(String(now.getFullYear()));
  const [month,setMonth]=useState(now.getMonth());
  const [from,setFrom]=useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`);
  const [to,setTo]=useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(new Date(now.getFullYear(),now.getMonth()+1,0).getDate()).padStart(2,"0")}`);
  const [project,setProject]=useState("todos");
  const [type,setType]=useState("todos");
  const [machine,setMachine]=useState("todas");
  const [article,setArticle]=useState("todos");

  const codes=useMemo(()=>new Set(catalog.map(x=>normalizeInsumoCode(x.codigo)).filter(Boolean)),[catalog]);
  const rows=useMemo(()=>{
    const out=[];
    (rma15||[]).forEach(ot=>{
      const fecha=normDate(ot.fecha); if(!fecha)return;
      (ot.insumos||[]).forEach(i=>{
        const codigo=normalizeInsumoCode(i.codigo); if(!codes.has(codigo))return;
        out.push({fecha,mes:fecha.slice(0,7),proyecto:ot.proyecto||"S/D",tipo:ot.tipoEquipo||"S/D",maquina:ot.maquina||"S/D",codigo,articulo:i.nombre||catalog.find(x=>normalizeInsumoCode(x.codigo)===codigo)?.articulo||codigo,cantidad:Number(i.cantidad||0),unitario:Number(i.costoUnitario||0),total:Number(i.costoTotal||0)});
      });
    });
    return out;
  },[rma15,codes,catalog]);

  const period=useMemo(()=>{if(mode==="mes"){const m=String(Number(month)+1).padStart(2,"0");const last=new Date(Number(year),Number(month)+1,0).getDate();return[`${year}-${m}-01`,`${year}-${m}-${String(last).padStart(2,"0")}`];}return[from,to];},[mode,year,month,from,to]);
  const filtered=useMemo(()=>rows.filter(r=>{
    if(period[0]&&r.fecha<period[0])return false;if(period[1]&&r.fecha>period[1])return false;
    if(project!=="todos"&&r.proyecto!==project)return false;if(type!=="todos"&&r.tipo!==type)return false;if(machine!=="todas"&&r.maquina!==machine)return false;if(article!=="todos"&&r.codigo!==article)return false;return true;
  }),[rows,period,project,type,machine,article]);
  const options=useMemo(()=>({projects:[...new Set(rows.map(r=>r.proyecto))].sort(),types:[...new Set(rows.map(r=>r.tipo))].sort(),machines:[...new Set(rows.map(r=>r.maquina))].sort(),articles:[...new Map(rows.map(r=>[r.codigo,{codigo:r.codigo,articulo:r.articulo}])).values()].sort((a,b)=>a.codigo.localeCompare(b.codigo))}),[rows]);
  const total=filtered.reduce((s,r)=>s+r.total,0),qty=filtered.reduce((s,r)=>s+r.cantidad,0);
  const byMachine=useMemo(()=>{const m=new Map();filtered.forEach(r=>{const x=m.get(r.maquina)||{maquina:r.maquina,total:0,cantidad:0,items:0};x.total+=r.total;x.cantidad+=r.cantidad;x.items++;m.set(r.maquina,x);});return[...m.values()].sort((a,b)=>b.total-a.total);},[filtered]);
  const byMonth=useMemo(()=>{const m=new Map();filtered.forEach(r=>m.set(r.mes,(m.get(r.mes)||0)+r.total));return[...m].sort().map(([mes,total])=>({mes,total}));},[filtered]);
  const byArticle=useMemo(()=>{const m=new Map();filtered.forEach(r=>{const x=m.get(r.codigo)||{codigo:r.codigo,articulo:r.articulo,total:0,cantidad:0};x.total+=r.total;x.cantidad+=r.cantidad;m.set(r.codigo,x);});return[...m.values()].sort((a,b)=>b.total-a.total);},[filtered]);

  const upload=async e=>{const file=e.target.files?.[0];if(!file)return;try{const data=await file.arrayBuffer();const wb=XLSX.read(data,{type:"array"});const ws=wb.Sheets[wb.SheetNames[0]];const raw=XLSX.utils.sheet_to_json(ws,{defval:""});const parsed=raw.map(r=>({codigo:normalizeInsumoCode(first(r,["CODIGO","CÓDIGO","CODIGO DE ARTICULO","CÓDIGO DE ARTÍCULO","ARTICULO"])),articulo:String(first(r,["ARTICULO","ARTÍCULO","DESCRIPCION","DESCRIPCIÓN","NOMBRE"])||"").trim()})).filter(x=>x.codigo);const unique=[...new Map(parsed.map(x=>[x.codigo,x])).values()];setCatalog(unique);localStorage.setItem(STORAGE_KEY,JSON.stringify(unique));}catch(err){alert("No se pudo leer el Excel: "+err.message);}finally{e.target.value="";}};
  const clear=()=>{setProject("todos");setType("todos");setMachine("todas");setArticle("todos");};
  const card={background:"rgba(22,22,22,.82)",border:"1px solid rgba(255,255,255,.10)",borderRadius:12,padding:14};
  return <div style={{display:"flex",flexDirection:"column",gap:12}}>
    <div style={card}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}><div><div style={{fontWeight:900,fontSize:16}}>Consumo de desgaste</div><div style={{fontSize:11,color:C.textMuted,marginTop:3}}>Analiza únicamente los códigos definidos como desgaste contra los consumos registrados en RMA15.</div></div><div style={{display:"flex",gap:8,alignItems:"center"}}><input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" onChange={upload} style={{display:"none"}}/><button onClick={()=>inputRef.current?.click()} style={{...selectStyle,cursor:"pointer",borderColor:C.yellow,color:C.yellow,fontWeight:800}}>📥 Cargar Excel de desgaste</button><span style={{fontSize:11,color:C.textSub}}>{catalog.length} códigos cargados</span></div></div>
      <div style={{display:"flex",gap:8,alignItems:"end",flexWrap:"wrap",marginTop:14}}>
        <button onClick={()=>setMode("mes")} style={{...selectStyle,minWidth:80,cursor:"pointer",background:mode==="mes"?C.accent:"#151515",fontWeight:800}}>Por mes</button><button onClick={()=>setMode("periodo")} style={{...selectStyle,minWidth:90,cursor:"pointer",background:mode==="periodo"?C.accent:"#151515",fontWeight:800}}>Por período</button>
        {mode==="mes"?<><label style={{fontSize:10,color:C.textMuted}}>MES<br/><select value={month} onChange={e=>setMonth(Number(e.target.value))} style={selectStyle}>{MESES.map((x,i)=><option key={x} value={i}>{x}</option>)}</select></label><label style={{fontSize:10,color:C.textMuted}}>AÑO<br/><select value={year} onChange={e=>setYear(e.target.value)} style={selectStyle}>{[2025,2026,2027,2028].map(y=><option key={y}>{y}</option>)}</select></label></>:<><label style={{fontSize:10,color:C.textMuted}}>DESDE<br/><input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={selectStyle}/></label><label style={{fontSize:10,color:C.textMuted}}>HASTA<br/><input type="date" value={to} onChange={e=>setTo(e.target.value)} style={selectStyle}/></label></>}
        <label style={{fontSize:10,color:C.textMuted}}>PROYECTO<br/><select value={project} onChange={e=>setProject(e.target.value)} style={selectStyle}><option value="todos">Todos</option>{options.projects.map(x=><option key={x}>{x}</option>)}</select></label>
        <label style={{fontSize:10,color:C.textMuted}}>TIPO DE MÁQUINA<br/><select value={type} onChange={e=>setType(e.target.value)} style={selectStyle}><option value="todos">Todas</option>{options.types.map(x=><option key={x}>{x}</option>)}</select></label>
        <label style={{fontSize:10,color:C.textMuted}}>MÁQUINA<br/><select value={machine} onChange={e=>setMachine(e.target.value)} style={selectStyle}><option value="todas">Todas</option>{options.machines.map(x=><option key={x}>{x}</option>)}</select></label>
        <label style={{fontSize:10,color:C.textMuted}}>INSUMO<br/><select value={article} onChange={e=>setArticle(e.target.value)} style={{...selectStyle,minWidth:190}}><option value="todos">Todos</option>{options.articles.map(x=><option key={x.codigo} value={x.codigo}>{x.codigo} — {x.articulo}</option>)}</select></label>
        <button onClick={clear} style={{...selectStyle,cursor:"pointer",minWidth:100}}>Limpiar filtros</button>
      </div>
    </div>
    {!catalog.length&&<div style={{...card,borderColor:`${C.yellow}66`,color:C.textSub}}>Cargá un Excel con columnas <b>Código</b> y <b>Artículo/Descripción</b>. Esos códigos definirán qué consumos de RMA15 se consideran desgaste.</div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(160px,1fr))",gap:10}}><div style={card}><small style={{color:C.textMuted}}>GASTO DE DESGASTE</small><div style={{fontSize:27,fontWeight:900,color:C.yellow}}>{money(total)}</div></div><div style={card}><small style={{color:C.textMuted}}>UNIDADES CONSUMIDAS</small><div style={{fontSize:27,fontWeight:900}}>{qty.toLocaleString("es-AR")}</div></div><div style={card}><small style={{color:C.textMuted}}>EQUIPOS CON CONSUMO</small><div style={{fontSize:27,fontWeight:900}}>{byMachine.length}</div></div><div style={card}><small style={{color:C.textMuted}}>CÓDIGOS UTILIZADOS</small><div style={{fontSize:27,fontWeight:900}}>{byArticle.length}</div></div></div>
    <div style={{display:"grid",gridTemplateColumns:"1.2fr 1fr",gap:12}}><div style={card}><div style={{fontWeight:800,marginBottom:10}}>Gasto por equipo</div><div style={{maxHeight:420,overflow:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr><th style={{textAlign:"left",padding:8}}>Equipo</th><th style={{textAlign:"right"}}>Cantidad</th><th style={{textAlign:"right"}}>Gasto</th></tr></thead><tbody>{byMachine.map(x=><tr key={x.maquina} style={{borderTop:"1px solid #333"}}><td style={{padding:8,fontWeight:800}}>{x.maquina}</td><td style={{textAlign:"right"}}>{x.cantidad.toLocaleString("es-AR")}</td><td style={{textAlign:"right",color:C.yellow,fontWeight:800}}>{money(x.total)}</td></tr>)}</tbody></table></div></div><div style={card}><div style={{fontWeight:800,marginBottom:10}}>Gasto por mes</div>{byMonth.map(x=><div key={x.mes} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid #333"}}><span>{x.mes}</span><b style={{color:C.yellow}}>{money(x.total)}</b></div>)}</div></div>
    <div style={card}><div style={{fontWeight:800,marginBottom:10}}>Detalle por artículo de desgaste</div><div style={{overflow:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr><th style={{textAlign:"left",padding:8}}>Código</th><th style={{textAlign:"left"}}>Artículo</th><th style={{textAlign:"right"}}>Cantidad</th><th style={{textAlign:"right"}}>Gasto</th></tr></thead><tbody>{byArticle.map(x=><tr key={x.codigo} style={{borderTop:"1px solid #333"}}><td style={{padding:8,fontWeight:800,color:C.blue}}>{x.codigo}</td><td>{x.articulo}</td><td style={{textAlign:"right"}}>{x.cantidad.toLocaleString("es-AR")}</td><td style={{textAlign:"right",color:C.yellow,fontWeight:800}}>{money(x.total)}</td></tr>)}</tbody></table></div></div>
  </div>;
}
