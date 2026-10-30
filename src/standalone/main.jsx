import React,{useState,useEffect,useCallback} from "react";
import{createRoot}from"react-dom/client";
import "./style.css";

const SERVER="biztlietuvvonigcfdwy";
const API=String(import.meta.env.VITE_V9_SUPABASE_URL||"");
const KEY=String(import.meta.env.VITE_V9_SUPABASE_PUBLISHABLE_KEY||"");
const BACKEND_OK=API==="https://"+SERVER+".supabase.co"&&/^sb_publishable_[A-Za-z0-9_-]{15,}$/.test(KEY);
const SESSION_KEY="delta_ops_v9_independent_session";
const MODULES=[
 ["inicio","Inicio"],["rop02_jm","ROP02 · José María"],["rop02_fs","ROP02 · Filo del Sol"],
 ["rop05","Productividad · ROP05"],["rma15_jm","Mantenimiento · JM"],["rma15_fs","Mantenimiento · FS"],
 ["lista_equipos","Lista maestra"],["insumos","Abastecimiento"],["control","Control cruzado"],
 ["licitaciones","Licitaciones"],["gestion","Gestión Humana"]
];
const ENABLED=new Set(["rop02_jm","rop02_fs","rop05","rma15_jm","rma15_fs","lista_equipos","insumos"]);
function restore(){try{const x=JSON.parse(sessionStorage.getItem(SESSION_KEY)||"null");return x&&x.access_token&&x.expires_at*1000>Date.now()?x:null;}catch{return null}}
async function apiCall(session,payload){
 const r=await fetch("/api/v9-independent",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+session.access_token},body:JSON.stringify(payload),cache:"no-store"});
 const d=await r.json().catch(()=>({ok:false,error:"INVALID_RESPONSE"}));
 if(!r.ok||!d.ok)throw Error(d.error||"No se pudo consultar el backend V9");return d;
}
async function signIn(email,password){
 if(!BACKEND_OK)throw Error("El Supabase V9 independiente todavía no está configurado.");
 const r=await fetch(API+"/auth/v1/token?grant_type=password",{method:"POST",headers:{"apikey":KEY,"Content-Type":"application/json"},body:JSON.stringify({email,password})});
 const d=await r.json().catch(()=>({}));
 if(!r.ok||!d.access_token)throw Error("Credenciales inválidas o cuenta todavía no habilitada en Supabase V9");
 const expires_at=Math.floor(Date.now()/1000)+Number(d.expires_in||3600);
 return {access_token:d.access_token,expires_at,email:d.user?.email||email};
}
function App(){
 const[session,setSession]=useState(restore);
 const[email,setEmail]=useState("");const[password,setPassword]=useState("");
 const[error,setError]=useState("");const[busy,setBusy]=useState(false);
 const[view,setView]=useState("inicio");const[records,setRecords]=useState([]);
 const[status,setStatus]=useState(null);const[gas,setGas]=useState(null);
 const[loading,setLoading]=useState(false);
 const logout=()=>{sessionStorage.removeItem(SESSION_KEY);setSession(null);setStatus(null);setRecords([])};
 const login=async(e)=>{e.preventDefault();setBusy(true);setError("");try{const s=await signIn(email,password);await apiCall(s,{action:"status"});sessionStorage.setItem(SESSION_KEY,JSON.stringify(s));setSession(s);setPassword("");}catch(err){setError(err.message);}finally{setBusy(false)}};
 const load=useCallback(async()=>{if(!session)return;setLoading(true);setError("");try{
   const s=await apiCall(session,{action:"status"});setStatus(s);
   if(ENABLED.has(view)){const d=await apiCall(session,{action:"rows",dataset:view,limit:100});setRecords(d.rows||[]);}
   else setRecords([]);
 }catch(e){setError(e.message);if(/SESSION_EXPIRED|UNAUTHORIZED/.test(e.message))logout();}finally{setLoading(false)}},[session,view]);
 useEffect(()=>{if(session)load()},[load,session]);
 const checkGas=async()=>{if(!session)return;try{setGas(await apiCall(session,{action:"gas-health"}));}catch(e){setGas({ok:false,error:e.message});}};
 if(!session)return <div className="login"><h1>DELTA OPS <span className="tag">V9</span></h1><p className="muted">Aplicación independiente · Supabase y Apps Script V9</p>
 <div className="panel"><strong>Acceso independiente</strong><p className="muted">Las sesiones de Delta OPS original no se reutilizan. Los usuarios deben estar habilitados en la base V9.</p></div>
 <form className="form" onSubmit={login}><label>Correo electrónico<input autoComplete="username" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
 <label>Contraseña<input autoComplete="current-password" type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
 <button disabled={busy||!BACKEND_OK} className="btn">{busy?"Verificando…":"Ingresar"}</button>
 {error&&<p className="error" role="alert">{error}</p>}{!BACKEND_OK&&<p className="notice">Falta configurar las variables de Supabase V9 en el despliegue.</p>}</form></div>;
 return <div className="layout"><aside className="side"><div className="brand">DELTA OPS <span className="tag">V9</span></div>
 <p className="sub">Plataforma independiente</p><nav className="nav">{MODULES.map(([key,label])=><button className={view===key?"active":""} key={key} onClick={()=>setView(key)}>{label}</button>)}</nav>
 <p className="sub" style={{marginTop:22}}>Conectado a Supabase V9</p></aside>
 <main className="content"><div className="top"><div><h1>{MODULES.find(x=>x[0]===view)?.[1]}</h1><span className="muted">Entorno V9 separado · lectura de pruebas</span></div>
 <div className="row"><span className="pill">{session.email}</span><button className="btn ghost" onClick={logout}>Salir</button></div></div>
 {error&&<div role="alert" className="panel error">{error}</div>}
 {view==="inicio"?<><div className="cards">
 <div className="card"><span className="muted">Backend</span><strong>{status?.backend||"No verificado"}</strong></div>
 <div className="card"><span className="muted">Registros V9</span><strong>{status?.total??"—"}</strong></div>
 <div className="card"><span className="muted">Modo</span><strong>Solo lectura</strong></div>
 </div><div className="panel"><h2>Estado de las fuentes</h2><p className="muted">El proyecto V9 tiene su propia base y autenticación. No usa el Supabase ni el Apps Script originales.</p>
 <div className="row"><button className="btn" disabled={loading} onClick={load}>Actualizar</button><button className="btn ghost" onClick={checkGas}>Verificar Apps Script V9</button></div>
 {gas&&<p className={gas.ok?"tag":"notice"}>{gas.ok?"Apps Script V9 respondió correctamente.":gas.error||"Apps Script V9 sin configurar."}</p>}
 {status?.total===0&&<p className="notice">La base V9 todavía está sin datos operativos. No se mostrarán datos de V8.1 como reemplazo.</p>}</div></>:
 <div className="panel"><h2>{MODULES.find(x=>x[0]===view)?.[1]}</h2>
 {!ENABLED.has(view)?<p className="notice">Módulo pendiente de migración al backend independiente. No se mostrarán registros de producción original.</p>:
 <><div className="row"><button className="btn" disabled={loading} onClick={load}>{loading?"Cargando…":"Actualizar"}</button><span className="muted">{records.length} filas en esta página</span></div>
 <div className="tablewrap" style={{marginTop:16}}><table className="table"><thead><tr><th>ID</th><th>Fecha de actualización</th><th>Datos de V9</th></tr></thead>
 <tbody>{records.map(r=><tr key={r.record_id}><td className="mono">{r.record_id}</td><td>{r.updated_at||"—"}</td><td className="mono">{JSON.stringify(r.payload)}</td></tr>)}</tbody></table></div>
 {!records.length&&!loading&&<p className="notice">Sin registros en la base independiente para este módulo.</p>}</>}</div>}
 </main></div>
}
createRoot(document.getElementById("root")).render(<App/>);
