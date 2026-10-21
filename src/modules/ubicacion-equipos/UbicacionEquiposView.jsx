import React, {useEffect, useRef, useState} from "react";
import {getAuthenticatedUser} from "../../services/authSession.js";

// El iframe usa únicamente GEO. OPS nunca le entrega su token: lo presenta
// directamente al servidor SSO; el iframe solo recibe un comprobante de un uso.
const GEO_URL="https://delta-geo.vercel.app/";
const GEO_ORIGIN=new URL(GEO_URL).origin;
const EXCHANGE_URL="https://jwfocqaxlckuxoklwyxs.supabase.co/functions/v1/ops-geo-sso";

const ERROR_LABELS={
  SSO_NOT_CONFIGURED:"El servidor de acceso único todavía no está configurado.",
  OPS_SESSION_INVALID:"La sesión de OPS venció. Cerrá sesión y volvé a ingresar.",
  GEO_USER_NOT_REGISTERED:"Tu usuario todavía no está registrado en Ubicación equipos.",
  GEO_MEMBER_NOT_AUTHORIZED:"Tu cuenta no tiene permisos para Ubicación equipos.",
  ORIGIN_DENIED:"El servidor todavía no habilitó este entorno de prueba.",
  SSO_UNAVAILABLE:"No se pudo contactar el servidor de acceso único.",
};

export default function UbicacionEquiposView(){
  const frame=useRef(null);
  const pending=useRef(false);
  const [status,setStatus]=useState("Conectando sesión de OPS…");
  useEffect(()=>{
    let cancelled=false;
    const aborter=new AbortController();
    const onMessage=async event=>{
      if(event.origin!==GEO_ORIGIN || event.source!==frame.current?.contentWindow) return;
      if(event.data?.type!=="DELTA_GEO_SSO_READY" || pending.current)return;
      pending.current=true;
      const sendError=(code)=>{
        if(cancelled)return;
        const safe=String(code||"SSO_UNAVAILABLE").slice(0,80);
        frame.current?.contentWindow?.postMessage({type:"DELTA_GEO_SSO_ERROR",code:safe},GEO_ORIGIN);
        setStatus(ERROR_LABELS[safe]||"No se pudo autorizar Ubicación equipos.");
      };
      const authToken=String(getAuthenticatedUser()?.authToken||"");
      if(!authToken){sendError("OPS_SESSION_INVALID");pending.current=false;return;}
      const watchdog=setTimeout(()=>aborter.abort(),12000);
      try{
        setStatus("Validando tu sesión de DELTA Mining OPS…");
        const response=await fetch(EXCHANGE_URL,{
          method:"POST",
          credentials:"omit",
          cache:"no-store",
          headers:{"content-type":"application/json"},
          body:JSON.stringify({authToken}),
          signal:aborter.signal,
        });
        const result=await response.json();
        if(!response.ok||!result?.ok){
          sendError(result?.code||"SSO_UNAVAILABLE");
          return;
        }
        if(typeof result.tokenHash!=="string"||result.tokenHash.length<20){
          sendError("SSO_UNAVAILABLE");return;
        }
        if(!cancelled){
          frame.current?.contentWindow?.postMessage(
            {type:"DELTA_GEO_SSO_TOKEN",tokenHash:result.tokenHash},GEO_ORIGIN
          );
          setStatus("Sesión validada. Abriendo el mapa…");
        }
      }catch(error){
        if(!cancelled)sendError("SSO_UNAVAILABLE");
      }finally{
        clearTimeout(watchdog);
        pending.current=false;
      }
    };
    window.addEventListener("message",onMessage);
    return()=>{cancelled=true;aborter.abort();window.removeEventListener("message",onMessage);};
  },[]);

  return (
    <section aria-label="Ubicación equipos" style={{display:"flex",flexDirection:"column",gap:10,width:"100%",minWidth:0}}>
      <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:14,flexWrap:"wrap",
        padding:"13px 18px",borderRadius:12,background:"rgba(18,30,41,.9)",border:"1px solid rgba(255,255,255,.12)"}}>
        <div style={{display:"flex",flexDirection:"column",gap:4,minWidth:0}}>
          <h2 style={{margin:0,fontSize:20,fontWeight:800,color:"#f0f7fa"}}>Ubicación equipos</h2>
          <p style={{margin:0,fontSize:12,color:"#a8c2cb"}}>
            DELTA GEO · Flota, ubicaciones, campamentos, plataformas y caminos
          </p>
          <p role="status" aria-live="polite" style={{margin:0,fontSize:11,color:"#a8c2cb"}}>{status}</p>
        </div>
        <a href={GEO_URL} target="_blank" rel="noopener noreferrer"
          style={{display:"inline-flex",alignItems:"center",justifyContent:"center",padding:"10px 14px",borderRadius:9,
            border:"1px solid rgba(76,215,179,.5)",background:"rgba(28,114,94,.2)",color:"#a8f4df",
            fontSize:12,fontWeight:800,textDecoration:"none",whiteSpace:"nowrap"}}>
          Abrir mapa en pantalla completa ↗
        </a>
      </header>
      <div style={{width:"100%",height:"calc(100dvh - 220px)",minHeight:480,borderRadius:12,overflow:"hidden",
        background:"#0e1a26",border:"1px solid rgba(255,255,255,.12)"}}>
        <iframe ref={frame} src={GEO_URL} title="DELTA GEO — Ubicación de equipos"
          loading="eager" referrerPolicy="strict-origin-when-cross-origin"
          style={{display:"block",width:"100%",height:"100%",border:0,background:"#e5edec"}}/>
      </div>
      <p style={{fontSize:11,color:"#9fb7c4",margin:0,lineHeight:1.45}}>
        La sesión se verifica en el servidor sin volver a enviar tu contraseña. Solo usuarios autorizados
        pueden acceder a las ubicaciones. OPS no duplica la flota ni agrega sincronizaciones.
      </p>
    </section>
  );
}
