import React from "react";
import { buildAuthenticatedUser, saveAuthenticatedSession } from "../../services/authSession.js";

export default function Login({onLogin,C,APPS_SCRIPT_URL,IMG_LOGIN_FONDO,LOGO,dmNormalizeAssignedProject}){
  const USUARIOS_FALLBACK=[
    "nahuel.garcia@deltamining.com.ar",
    "melina.torrejon@deltamining.com.ar",
    "jesica@deltamining.com.ar",
    "franco.a@deltamining.com.ar",
    "fernando.c@deltamining.com.ar",
    "lucas.torres@deltamining.com.ar"
  ];
  const AUTH_TIMEOUT_MS=20000;

  const[usuario,setUsuario]=React.useState("");
  const[pass,setPass]=React.useState("");
  const[error,setError]=React.useState("");
  const[shake,setShake]=React.useState(false);
  const[validando,setValidando]=React.useState(false);
  const submitInFlightRef=React.useRef(false);

  const showError=(msg)=>{
    setError(msg);
    setShake(true);
    setTimeout(()=>setShake(false),500);
    setTimeout(()=>setError(""),3000);
  };

  const normalizarMail=(v)=>String(v||"").trim().toLowerCase();
  const usuarioActivo=(u)=>{
    const activo=String(u?.activo??u?.Activo??u?.ACTIVO??"SI").trim().toUpperCase();
    return !(activo==="NO"||activo==="FALSE"||activo==="0"||activo==="INACTIVO");
  };

  const cargarUsuariosAutorizados=async()=>{
    try{
      const res=await fetch(`${APPS_SCRIPT_URL}?action=usuarios&_=${Date.now()}`);
      const json=await res.json();
      if(!json||!json.ok||!Array.isArray(json.data))throw new Error(json?.error?.message||"No se pudo leer la hoja de usuarios");
      const usuarios=json.data
        .map(u=>({
          email:normalizarMail(u.email||u.Email||u.mail||u.Mail||u.correo||u.Correo),
          rol:String(u.rol||u.Rol||u.role||u.Role||"USUARIO").trim().toUpperCase(),
          proyecto:String(u.proyecto||u.Proyecto||"TODOS").trim().toUpperCase(),
          nombre:String(u.nombre||u.Nombre||u.name||u.Name||"").trim(),
          activo:u.activo??u.Activo??"SI"
        }))
        .filter(u=>u.email&&usuarioActivo(u));
      return usuarios;
    }catch(err){
      console.warn("No se pudo leer la hoja de usuarios. Se usa fallback local.",err);
      return USUARIOS_FALLBACK.map(email=>({email,rol:email.includes("nahuel")||email.includes("mahuel")?"ADMIN":"USUARIO",proyecto:"TODOS",nombre:(email.split("@")[0].split(/[._-]+/)[0]||"Usuario").replace(/^./,c=>c.toUpperCase()),activo:"SI"}));
    }
  };

  const handleSubmit=async()=>{
    if(submitInFlightRef.current)return;

    const mail=normalizarMail(usuario);
    if(!mail){
      showError("Ingresá tu usuario");
      return;
    }
    if(!pass){
      showError("Ingresá tu contraseña");
      return;
    }

    submitInFlightRef.current=true;
    setValidando(true);
    const controller=typeof AbortController!=="undefined"?new AbortController():null;
    const timeoutId=controller?window.setTimeout(()=>controller.abort(),AUTH_TIMEOUT_MS):null;

    try{
      const response=await fetch(APPS_SCRIPT_URL,{
        method:"POST",
        headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},
        body:new URLSearchParams({payload:JSON.stringify({action:"authenticate_user",email:mail,password:pass})}),
        signal:controller?.signal
      });
      if(!response.ok)throw new Error(`HTTP ${response.status}`);

      const json=await response.json();
      if(!json?.ok){
        showError(json?.error?.message||"Usuario o contraseña incorrectos");
        return;
      }
      const authenticatedUser=buildAuthenticatedUser(json,mail);
      saveAuthenticatedSession(authenticatedUser,{mustChangePassword:!!json.mustChangePassword,normalizeProject:dmNormalizeAssignedProject});
      onLogin(authenticatedUser);
    }catch(err){
      if(err?.name==="AbortError")showError("La validación tardó demasiado. Intentá nuevamente.");
      else showError("No se pudo validar el acceso. Revisá la conexión.");
    }finally{
      if(timeoutId!==null)window.clearTimeout(timeoutId);
      submitInFlightRef.current=false;
      setValidando(false);
    }
  };

  const backgroundImageUrl = IMG_LOGIN_FONDO || "/img/embedded/home-welcome-b80067ac.jpg";

  return(
    <div style={{
      position:"relative",
      minHeight:"100vh",
      overflow:"hidden",
      backgroundColor:C.bg
    }}>
      <div style={{
        position:"absolute",
        inset:0,
        backgroundImage:`url(${backgroundImageUrl})`,
        backgroundSize:"cover",
        backgroundPosition:"center",
        backgroundRepeat:"no-repeat",
        filter:"brightness(.78) saturate(.86)"
      }}/>
      <div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,rgba(3,12,20,.28) 0 12%,rgba(3,10,17,.22) 27%,rgba(3,10,17,.12) 64%,rgba(3,10,17,.42) 100%)"}}/>
      <div style={{position:"absolute",inset:0,background:"linear-gradient(0deg,rgba(3,11,18,.94) 0%,rgba(3,11,18,.05) 42%,rgba(3,11,18,.18) 100%)"}}/>
      <div style={{
        position:"relative",
        zIndex:1,
        minHeight:"100vh",
        display:"flex",
        alignItems:"center",
        justifyContent:"center",
        flexDirection:"column",
        gap:24,
        paddingTop:70
      }}>
        <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`}</style>
        <img src={LOGO} alt="Delta Mining" style={{height:80,objectFit:"contain",marginBottom:8}}/>
        <div style={{fontFamily:"Inter",fontWeight:800,fontSize:22,color:C.accent,letterSpacing:".1em"}}>DELTA MINING APP</div>
        <div style={{
          background:C.card,border:`1px solid ${error?C.red:C.border}`,borderRadius:14,
          padding:"32px 36px",display:"flex",flexDirection:"column",gap:16,
          width:320,boxShadow:`0 8px 32px rgba(0,0,0,.4)`,
          animation:shake?"shake .4s ease":"none"
        }}>
          <div style={{fontSize:13,color:C.textSub,textAlign:"center",fontWeight:500}}>Ingresá tu usuario y contraseña para continuar</div>
          <input
            type="email"
            value={usuario}
            disabled={validando}
            onChange={e=>{setUsuario(e.target.value);setError("");}}
            onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
            placeholder="Usuario"
            style={{background:C.surface,border:`1px solid ${error?C.red:C.border}`,borderRadius:8,color:C.text,padding:"10px 14px",fontSize:14,outline:"none",fontFamily:"Inter",width:"100%",boxSizing:"border-box",opacity:validando?.7:1}}
            autoFocus
          />
          <input
            type="password"
            value={pass}
            disabled={validando}
            onChange={e=>{setPass(e.target.value);setError("");}}
            onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
            placeholder="Contraseña"
            style={{background:C.surface,border:`1px solid ${error?C.red:C.border}`,borderRadius:8,color:C.text,padding:"10px 14px",fontSize:14,outline:"none",fontFamily:"Inter",width:"100%",boxSizing:"border-box",opacity:validando?.7:1}}
          />
          {error&&<div style={{fontSize:12,color:C.red,textAlign:"center"}}>{error}</div>}
          <button
            onClick={handleSubmit}
            disabled={validando}
            style={{background:C.accent,border:"none",borderRadius:8,color:"#fff",padding:"10px",fontSize:14,fontWeight:700,fontFamily:"Inter",cursor:validando?"wait":"pointer",letterSpacing:".06em",opacity:validando?.75:1}}
          >
            {validando?"VALIDANDO...":"INGRESAR"}
          </button>
        </div>
        <div style={{fontSize:10,color:C.textMuted}}>Delta Mining OPS — Acceso restringido</div>
      </div>
    </div>
  );
}
