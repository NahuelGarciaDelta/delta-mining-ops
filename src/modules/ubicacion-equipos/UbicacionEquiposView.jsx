import React from "react";

// DELTA GEO conserva su propio ciclo de despliegue, datos y autenticación.
// El iframe se monta solamente cuando el usuario abre esta sección.
const GEO_URL = "https://delta-geo.vercel.app/";

export default function UbicacionEquiposView() {
  return (
    <section aria-label="Ubicación equipos" style={{display:"flex", flexDirection:"column", gap:12, width:"100%", minWidth:0}}>
      <header style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap:14, flexWrap:"wrap",
        padding:"14px 18px", borderRadius:12, background:"rgba(18,30,41,.9)", border:"1px solid rgba(255,255,255,.12)"}}>
        <div style={{display:"flex", flexDirection:"column", gap:5, minWidth:0}}>
          <h2 style={{margin:0, fontSize:20, fontWeight:800, color:"#f0f7fa"}}>Ubicación equipos</h2>
          <p style={{margin:0, fontSize:12, color:"#a8c2cb"}}>
            DELTA GEO · Flota, ubicaciones declaradas, lugares y caminos
          </p>
        </div>
        <a href={GEO_URL} target="_blank" rel="noopener noreferrer"
          style={{display:"inline-flex", alignItems:"center", justifyContent:"center", padding:"10px 14px", borderRadius:9,
            border:"1px solid rgba(76,215,179,.5)", background:"rgba(28,114,94,.2)", color:"#a8f4df",
            fontSize:12, fontWeight:800, textDecoration:"none", whiteSpace:"nowrap"}}>
          Abrir mapa en pantalla completa ↗
        </a>
      </header>
      <div style={{width:"100%", height:"calc(100dvh - 220px)", minHeight:480, borderRadius:12, overflow:"hidden",
        background:"#0e1a26", border:"1px solid rgba(255,255,255,.12)"}}>
        <iframe src={GEO_URL} title="DELTA GEO — Mapa de ubicación de equipos"
          loading="lazy" referrerPolicy="strict-origin-when-cross-origin"
          style={{display:"block", width:"100%", height:"100%", border:0, background:"#e5edec"}}>
          <p>El navegador no puede mostrar el mapa embebido. Abrí DELTA GEO en una pestaña nueva.</p>
        </iframe>
      </div>
      <p style={{fontSize:11, color:"#9fb7c4", margin:0, lineHeight:1.45}}>
        Por seguridad, DELTA GEO mantiene su acceso independiente. Si el navegador impide iniciar sesión dentro del mapa,
        usá «Abrir mapa en pantalla completa». La pantalla no realiza consultas adicionales desde DELTA Mining OPS.
      </p>
    </section>
  );
}
