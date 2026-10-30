import React,{useCallback,useEffect,useRef,useState} from "react";
import{createRoot}from"react-dom/client";
import{currentSession,forgetSession,isV9Configured,loginV9,requestV9,saveSession}from"./session.js";
import OperationalTable from"./OperationalTable.jsx";
import"./style.css";

const MODULES=[
 ["inicio","Inicio","General"],
 ["rop02_jm","ROP02 · José María","Operaciones"],
 ["rop02_fs","ROP02 · Filo del Sol","Operaciones"],
 ["rop02_filosur","ROP02 · Filo Sur","Operaciones"],
 ["rop02_zorro","ROP02 · El Zorro","Operaciones"],
 ["rop02_fierro","ROP02 · El Fierro","Operaciones"],
 ["rop05","Productividad · ROP05","Operaciones"],
 ["combustible","Combustible","Operaciones"],
 ["rma15_jm","RMA15 · José María","Mantenimiento"],
 ["rma15_fs","RMA15 · Filo del Sol","Mantenimiento"],
 ["mantenimiento_programado","Mantenimiento programado","Mantenimiento"],
 ["lista_equipos","Lista maestra de equipos","Equipos"],
 ["insumos","Insumos","Abastecimiento"],
 ["raba03","RABA03","Abastecimiento"],
 ["control","Control cruzado","Análisis"],
 ["licitaciones","Licitaciones","Oficina Técnica"],
 ["gestion","Gestión Humana","Administración"]
];
const DATASETS=new Set(MODULES.filter(m=>!["inicio","control","licitaciones","gestion"].includes(m[0])).map(m=>m[0]));
const groups=[...new Set(MODULES.map(x=>x[2]))];

function App(){
 const[session,setSession]=useState(currentSession);
 const[email,setEmail]=useState("");const[password,setPassword]=useState("");
 const[error,setError]=useState("");const[busy,setBusy]=useState(false);
 const[view,setView]=useState("inicio");const[records,setRecords]=useState([]);
 const[status,setStatus]=useState(null);const[gas,setGas]=useState(null);
 const[loading,setLoading]=useState(false);const[offset,setOffset]=useState(0);
 const[total,setTotal]=useState(0);const generation=useRef(0);
 const logout=useCallback(()=>{generation.current++;forgetSession();setSession(null);setStatus(null);setRecords([]);setTotal(0);setGas(null)},[]);
 const login=async(e)=>{
  e.preventDefault();if(busy)return;setBusy(true);setError("");
  try{const s=await loginV9(email,password);await requestV9({action:"status"},s);saveSession(s);setSession(s);setPassword("");}
  catch(err){setError(err.message==="V9_INVALID_CREDENTIALS"?"Correo o contraseña incorrectos, o usuario no habilitado en V9.":err.message==="V9_ROLE_NOT_ALLOWED"?"Tu cuenta todavía no tiene permiso en V9.":err.message);}
  finally{setBusy(false);}
 };
 const load=useCallback(async()=>{
  if(!session)return;
  const id=++generation.current;setLoading(true);setError("");setRecords([]);
  try{
   const active=currentSession()||session;
   const s=await requestV9({action:"status"},active);
   if(id!==generation.current)return;setStatus(s);
   if(DATASETS.has(view)){
    const d=await requestV9({action:"rows",dataset:view,limit:100,offset},currentSession()||active);
    if(id!==generation.current)return;setRecords(d.rows||[]);setTotal(d.total??0);
   }else setTotal(0);
  }catch(err){
   if(id!==generation.current)return;
   if(/V9_SESSION_EXPIRED|V9_SESSION_REQUIRED/.test(err.message)){logout();setError("Tu sesión V9 venció. Iniciá sesión nuevamente.");return;}
   setError(err.message);
  }finally{if(id===generation.current)setLoading(false);}
 },[session,view,offset,logout]);
 useEffect(()=>{if(session)load()},[load,session]);
 const navTo=(key)=>{setView(key);setOffset(0);setRecords([]);setError("");};
 const checkGas=async()=>{if(!session)return;setGas(null);try{setGas(await requestV9({action:"gas-health"},currentSession()||session));}
  catch(err){setGas({ok:false,error:err.message});}};
 const current=MODULES.find(m=>m[0]===view);
 const currentSource=status?.sources?.find(s=>s.dataset===view);
 if(!session)return <div className="login">
  <h1>DELTA OPS <span className="tag">V9</span></h1>
  <p className="muted">Operaciones · Plataforma independiente</p>
  <div className="panel"><strong>Nuevo entorno Delta OPS</strong>
   <p className="muted">V9 utiliza una base Supabase y un Apps Script distintos. Es necesario habilitar tu usuario en V9; no se aprovecha el token de la aplicación anterior.</p></div>
  <form className="form" onSubmit={login}>
   <label>Correo electrónico<input autoComplete="username" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <label>Contraseña<input autoComplete="current-password" type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
   <button className="btn" disabled={busy||!isV9Configured}>{busy?"Comprobando acceso…":"Iniciar sesión"}</button>
   {error&&<p role="alert" className="error">{error}</p>}
   {!isV9Configured&&<p className="notice">No se configuró el backend independiente V9.</p>}
  </form></div>;
 return <div className="layout">
  <aside className="side">
   <div className="brand">DELTA OPS <span className="tag">V9</span></div>
   <div className="sub">Sistema independiente · Pruebas</div>
   <nav className="nav" aria-label="Áreas de Delta OPS">
    {groups.map(group=><div key={group}>
     <div className="sub" style={{marginTop:12,marginBottom:6}}>{group}</div>
     {MODULES.filter(m=>m[2]===group).map(([key,label])=>
      <button key={key} type="button" className={view===key?"active":""}
       aria-current={view===key?"page":undefined} onClick={()=>navTo(key)}>{label}</button>)}
    </div>)}
   </nav>
   <div className="sub" style={{marginTop:20}}>Origen: Supabase V9 exclusivo</div>
  </aside>
  <main className="content">
   <div className="top">
    <div><h1>{current?.[1]||"Delta OPS"}</h1>
     <span className="muted">Sistema aislado · No consulta fuentes de V8.1</span></div>
    <div className="row"><span className="pill">{session.email}</span>
     <button type="button" className="btn ghost" onClick={logout}>Cerrar sesión</button></div>
   </div>
   {error&&<div role="alert" className="panel error">{error}</div>}
   {view==="inicio"?<>
    <div className="cards">
     <div className="card"><span className="muted">Datos V9</span><strong>{status?.total?.toLocaleString("es-AR")??"—"}</strong></div>
     <div className="card"><span className="muted">Fuentes registradas</span><strong>{status?.sources?.length??"—"}</strong></div>
     <div className="card"><span className="muted">Entorno</span><strong style={{fontSize:19}}>Independiente</strong></div>
     <div className="card"><span className="muted">Operación</span><strong style={{fontSize:19}}>Solo lectura</strong></div>
    </div>
    <div className="panel">
     <div className="row" style={{justifyContent:"space-between"}}>
      <h2>Estado de los orígenes de datos</h2>
      <div className="row"><button className="btn" disabled={loading} onClick={load}>{loading?"Actualizando…":"Actualizar"}</button>
       <button className="btn ghost" onClick={checkGas}>Comprobar Apps Script V9</button></div>
     </div>
     <p className="muted">Los registros llegan a la base V9 cuando se active su sincronizador propio. Nunca se muestran datos de la base original como reemplazo.</p>
     <div className="tablewrap"><table className="table">
      <thead><tr><th>Fuente</th><th>Área</th><th>Registros</th><th>Sincronización</th><th>Último dato</th></tr></thead>
      <tbody>{(status?.sources||[]).map(s=><tr key={s.dataset}>
       <td>{s.label}</td><td>{s.category}</td><td>{Number(s.records||0).toLocaleString("es-AR")}</td>
       <td>{s.is_migrated?"Migrada":"Pendiente"}</td><td>{s.latest_row_at||"—"}</td>
      </tr>)}</tbody>
     </table></div>
     {status?.total===0&&<p className="notice">Actualmente no hay partes operativos sincronizados en la base V9. Su carga está pendiente.</p>}
     {gas&&<p role="status" className={gas.ok?"tag":"notice"}>{gas.ok?"Apps Script V9 responde al chequeo de salud.":gas.error||"Apps Script V9 aún no disponible."}</p>}
    </div>
   </>:<div className="panel">
    <h2>{current?.[1]}</h2>
    {!DATASETS.has(view)?
     <p className="notice">Este módulo requiere trasladar sus cálculos y servicios al backend V9. Está deshabilitado para no usar los datos ni las escrituras del sistema original.</p>
     :<>
      {!currentSource?.is_migrated&&<p className="notice">La fuente está registrada en V9 pero todavía no se confirmó su sincronización desde Apps Script V9.</p>}
      <OperationalTable dataset={view} rows={records} offset={offset} total={total} busy={loading}
       onRefresh={load} onPage={setOffset}/>
     </>}
   </div>}
  </main>
 </div>;
}
createRoot(document.getElementById("root")).render(<App/>);
