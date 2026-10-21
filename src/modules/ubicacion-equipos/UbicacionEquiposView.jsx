import React, {useEffect, useRef, useState} from "react";
import {getAuthenticatedUser} from "../../services/authSession.js";

// Carga solamente cuando se abre la sección, sin duplicar consultas de flota.
// GEO conserva sus propias tablas RLS. Este acceso nunca confía en el email del navegador.
const GEO_URL="/api/geo-embedded";
const SSO_URL="https://jwfocqaxlckuxoklwyxs.supabase.co/functions/v1/ops-geo-sso";

export default function UbicacionEquiposView() {
  const frameRef=useRef(null);
  const attempted=useRef(false);
  const [attempt,setAttempt]=useState(0);
  const [status,setStatus]=useState("Conectando automáticamente con tu sesión de OPS…");
  const [blocked,setBlocked]=useState(false);

  useEffect(()=>{
    attempted.current=false;
    let cancelled=false;
    const receive=async (event)=>{
      if(event.source!==frameRef.current?.contentWindow)return;
      if(event.data?.type==="DM_GEO_SSO_SUCCESS"){
        if(!cancelled){setStatus("Sesión verificada · Mapa habilitado");setBlocked(false);}
        return;
      }
      if(event.data?.type==="DM_GEO_SSO_FAILED"){
        if(!cancelled){setStatus("No se pudo completar el acceso seguro a DELTA GEO.");setBlocked(true);}
        return;
      }
      if(event.data?.type!=="DM_GEO_SSO_READY"||attempted.current)return;
      attempted.current=true;
      const authToken=String(getAuthenticatedUser()?.authToken||getAuthenticatedUser()?.token||"");
      if(!authToken){
        setStatus("La sesión de DELTA Mining OPS expiró. Volvé a ingresar a OPS.");
        setBlocked(true);
        frameRef.current?.contentWindow?.postMessage({type:"DM_GEO_SSO_FAILED"},"*");
        return;
      }
      try{
        const response=await fetch(SSO_URL,{
          method:"POST",cache:"no-store",headers:{"content-type":"application/json"},
          body:JSON.stringify({authToken})
        });
        const payload=await response.json().catch(()=>({}));
        if(!response.ok || !payload?.tokenHash){
          const reason=String(payload?.code||"");
          let message="No se pudo validar la sesión entre OPS y GEO.";
          if(reason==="SSO_NOT_CONFIGURED")message="El acceso único requiere configurar la clave de validación del backend OPS.";
          if(reason==="GEO_USER_NOT_REGISTERED"||reason==="GEO_MEMBER_NOT_AUTHORIZED")message="Tu cuenta no está habilitada para GEO. Solicitá autorización.";
          if(reason==="OPS_SESSION_INVALID")message="Tu sesión de OPS expiró; volvé a ingresar.";
          throw new Error(message);
        }
        if(cancelled)return;
        setStatus("Validando permisos de DELTA GEO…");
        frameRef.current?.contentWindow?.postMessage({type:"DM_GEO_SSO_TOKEN",tokenHash:payload.tokenHash},"*");
      }catch(error){
        if(cancelled)return;
        setStatus(error?.message||"No se pudo habilitar el acceso automático.");
        setBlocked(true);
        frameRef.current?.contentWindow?.postMessage({type:"DM_GEO_SSO_FAILED"},"*");
      }
    };
    window.addEventListener("message",receive);
    return()=>{cancelled=true;window.removeEventListener("message",receive);};
  },[attempt]);

  return (
    <section aria-label="Ubicación equipos" style={{display:"flex",flexDirection:"column",gap:10,width:"100%",minWidth:0}}>
      <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:14,flexWrap:"wrap",
        padding:"12px 16px",borderRadius:12,background:"rgba(18,30,41,.92)",border:"1px solid rgba(255,255,255,.12)"}}>
        <div style={{minWidth:0}}>
          <h2 style={{margin:0,fontSize:20,color:"#f0f7fa"}}>Ubicación equipos</h2>
          <div role="status" style={{marginTop:5,fontSize:12,color:blocked?"#ffcd8f":"#a8dcd1"}}>{status}</div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {blocked&&<button type="button" onClick={()=>{setBlocked(false);setStatus("Conectando…");setAttempt(v=>v+1);}}
            style={{padding:"9px 12px",borderRadius:8,border:"1px solid #4dd5ae",background:"transparent",color:"#b3ffe6",cursor:"pointer"}}>Reintentar</button>}
          <a href="https://delta-geo.vercel.app/" target="_blank" rel="noopener noreferrer"
            style={{padding:"9px 12px",borderRadius:8,border:"1px solid rgba(76,215,179,.5)",color:"#a8f4df",textDecoration:"none"}}>
            Pantalla completa ↗
          </a>
        </div>
      </header>
      <div style={{width:"100%",height:"calc(100dvh - 208px)",minHeight:460,background:"#0e1a26",borderRadius:12,overflow:"hidden",border:"1px solid rgba(255,255,255,.12)"}}>
        <iframe key={attempt} ref={frameRef} src={GEO_URL}
          title="DELTA GEO — Ubicación de equipos" loading="lazy"
          sandbox="allow-scripts allow-forms allow-modals allow-popups allow-downloads"
          style={{display:"block",width:"100%",height:"100%",border:0,background:"#e5edec"}}/>
      </div>
      {blocked&&<p style={{margin:0,fontSize:12,color:"#cfdbe0"}}>El mapa mantiene sus controles de seguridad. No es necesario introducir otra contraseña, pero el servidor debe poder verificar tu sesión de OPS para habilitarlo.</p>}
    </section>
  );
}
