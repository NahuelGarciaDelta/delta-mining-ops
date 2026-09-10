import React from "react";
import { buildAuthenticatedUser, saveAuthenticatedSession } from "../../services/authSession.js";
import {applyAppearance,loadCentralAppearance,readLocalAppearance,writeLocalAppearance} from "../../services/userAppearance.js";

const AUTH_TIMEOUT_MS=45000;

export default function Login({onLogin,C,APPS_SCRIPT_URL,IMG_LOGIN_FONDO,LOGO,dmNormalizeAssignedProject}){
  const[usuario,setUsuario]=React.useState("");
  const[pass,setPass]=React.useState("");
  const[error,setError]=React.useState("");
  const[shake,setShake]=React.useState(false);
  const[validando,setValidando]=React.useState(false);
  const submitInFlightRef=React.useRef(false);

  const showError=(msg)=>{
    setError(msg);
    setShake(true);
    window.setTimeout(()=>setShake(false),500);
    window.setTimeout(()=>setError(""),4500);
  };

  const normalizarMail=(v)=>String(v||"").trim().toLowerCase();

  // Antes de autenticar sólo se aplica la apariencia local. No se hace ninguna
  // lectura a Apps Script al salir del campo email: el login debe tener prioridad.
  const aplicarAparienciaLocal=(mail)=>{
    const email=normalizarMail(mail);
    if(!email)return;
    try{applyAppearance(readLocalAppearance(email),C);}catch(_){}
  };

  // La apariencia central se actualiza recién DESPUÉS de autenticar y sin bloquear.
  const actualizarAparienciaCentral=(mail)=>{
    const email=normalizarMail(mail);
    if(!email)return;
    loadCentralAppearance(APPS_SCRIPT_URL,email).then(prefs=>{
      writeLocalAppearance(email,prefs);
      applyAppearance(prefs,C);
    }).catch(()=>{});
  };

  const handleSubmit=async()=>{
    if(submitInFlightRef.current)return;

    const mail=normalizarMail(usuario);
    if(!mail){showError("Ingresá el correo electrónico registrado");return;}
    if(!mail.includes("@")||!mail.includes(".")){showError("Ingresá el correo electrónico completo registrado");return;}
    if(!pass){showError("Ingresá tu contraseña");return;}

    submitInFlightRef.current=true;
    setValidando(true);
    setError("");

    const controller=typeof AbortController!=="undefined"?new AbortController():null;
    const timeoutId=controller?window.setTimeout(()=>controller.abort(),AUTH_TIMEOUT_MS):null;

    try{
      const response=await fetch(APPS_SCRIPT_URL,{
        method:"POST",
        headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},
        body:new URLSearchParams({payload:JSON.stringify({action:"authenticate_user",email:mail,password:pass})}),
        cache:"no-store",
        redirect:"follow",
        signal:controller?.signal
      });

      if(!response.ok){
        const err=new Error(`HTTP ${response.status}`);
        err.status=response.status;
        throw err;
      }

      let json;
      try{json=await response.json();}
      catch(_){throw new Error("AUTH_RESPONSE_INVALID");}

      if(!json?.ok){
        const code=String(json?.error?.code||"").toUpperCase();
        if(code==="AUTH_INVALID")showError("No se reconoce ese correo o contraseña. Usá el correo completo registrado.");
        else if(code==="AUTH_INACTIVE")showError("Este usuario figura como inactivo. Pedí que lo habiliten.");
        else showError(json?.error?.message||"No se pudo validar el acceso.");
        return;
      }

      const authenticatedUser=buildAuthenticatedUser(json,mail);
      saveAuthenticatedSession(authenticatedUser,{
        mustChangePassword:!!json.mustChangePassword,
        normalizeProject:dmNormalizeAssignedProject
      });

      onLogin(authenticatedUser);
      // No retrasar la entrada a la app esperando preferencias visuales.
      window.setTimeout(()=>actualizarAparienciaCentral(mail),0);
    }catch(err){
      if(err?.name==="AbortError"){
        showError("El servidor de acceso está tardando demasiado. Intentá nuevamente en unos segundos.");
      }else if(Number(err?.status)===502||Number(err?.status)===503||Number(err?.status)===504){
        showError("El servidor está ocupado. Intentá nuevamente en unos segundos.");
      }else if(Number(err?.status)===404){
        showError("No se encontró el servicio de acceso. Actualizá la página e intentá nuevamente.");
      }else{
        showError("No se pudo validar el acceso. Revisá la conexión e intentá nuevamente.");
      }
    }finally{
      if(timeoutId!==null)window.clearTimeout(timeoutId);
      submitInFlightRef.current=false;
      setValidando(false);
    }
  };

  return(
    <div className="dm-login-screen" style={{
      position:"fixed",inset:0,minWidth:"100vw",minHeight:"100dvh",overflow:"hidden",backgroundColor:C.bg
    }}>
      <div style={{
        position:"absolute",inset:"calc(-1 * var(--dm-bg-blur,0px))",backgroundImage:"var(--dm-bg-image)",
        backgroundSize:"cover",backgroundPosition:"center",backgroundRepeat:"no-repeat",
        filter:"saturate(.92) blur(var(--dm-bg-blur,0px))",transform:"scale(1.02)"
      }}/>
      <div style={{position:"absolute",inset:0,background:"radial-gradient(circle at center,rgba(3,10,17,.02) 0%,rgba(3,10,17,.10) 58%,rgba(3,10,17,.28) 100%)"}}/>
      <div style={{position:"absolute",inset:0,background:"linear-gradient(0deg,rgba(3,11,18,.42) 0%,rgba(3,11,18,0) 40%,rgba(3,11,18,.08) 100%)"}}/>
      <div style={{
        position:"relative",zIndex:1,minHeight:"100dvh",display:"flex",alignItems:"center",justifyContent:"center",
        flexDirection:"column",gap:24,paddingTop:70,boxSizing:"border-box"
      }}>
        <style>{`html,body,#root{margin:0!important;padding:0!important;width:100%!important;height:100%!important;overflow:hidden!important}@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`}</style>
        <img src={LOGO} alt="Delta Mining" style={{height:80,objectFit:"contain",marginBottom:8}}/>
        <div style={{fontFamily:"Inter",fontWeight:800,fontSize:22,color:C.accent,letterSpacing:".1em"}}>DELTA MINING APP</div>
        <div style={{
          background:"rgba(20,20,20,.86)",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",
          border:`1px solid ${error?C.red:"rgba(255,255,255,.12)"}`,borderRadius:14,padding:"32px 36px",
          display:"flex",flexDirection:"column",gap:16,width:320,boxShadow:"0 8px 32px rgba(0,0,0,.34)",
          animation:shake?"shake .4s ease":"none"
        }}>
          <div style={{fontSize:13,color:C.textSub,textAlign:"center",fontWeight:500}}>Ingresá el correo electrónico registrado y tu contraseña para continuar</div>
          <input
            type="email" value={usuario} disabled={validando}
            onChange={e=>{
              const value=e.target.value;
              setUsuario(value);setError("");
              const mail=normalizarMail(value);
              if(mail.includes("@")&&mail.includes("."))aplicarAparienciaLocal(mail);
            }}
            onBlur={()=>aplicarAparienciaLocal(usuario)}
            onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
            placeholder="Correo electrónico"
            style={{background:C.surface,border:`1px solid ${error?C.red:C.border}`,borderRadius:8,color:C.text,padding:"10px 14px",fontSize:14,outline:"none",fontFamily:"Inter",width:"100%",boxSizing:"border-box",opacity:validando?.7:1}}
            autoFocus
          />
          <input
            type="password" value={pass} disabled={validando}
            onChange={e=>{setPass(e.target.value);setError("");}}
            onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
            placeholder="Contraseña"
            style={{background:C.surface,border:`1px solid ${error?C.red:C.border}`,borderRadius:8,color:C.text,padding:"10px 14px",fontSize:14,outline:"none",fontFamily:"Inter",width:"100%",boxSizing:"border-box",opacity:validando?.7:1}}
          />
          {error&&<div style={{fontSize:12,color:C.red,textAlign:"center"}}>{error}</div>}
          <button
            onClick={handleSubmit} disabled={validando}
            style={{background:C.accent,border:"none",borderRadius:8,color:"#fff",padding:"10px",fontSize:14,fontWeight:700,fontFamily:"Inter",cursor:validando?"wait":"pointer",letterSpacing:".06em",opacity:validando?.75:1}}
          >
            {validando?"VALIDANDO...":"INGRESAR"}
          </button>
        </div>
        <div style={{fontSize:10,color:C.textMuted,textAlign:"center"}}>Usá el correo registrado en “Usuarios autorizados”.<br/>Delta Mining OPS — Acceso restringido</div>
      </div>
    </div>
  );
}
