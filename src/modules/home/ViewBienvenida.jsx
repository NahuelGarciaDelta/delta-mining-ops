import React from "react";

export default function ViewBienvenida({onOpenModule,listaEquipos=[],rop02All=[],onReloadLista,nombreUsuario="Usuario",onCambiarUsuario,esAdministrativo=false,C}){
  const tallerRows=Array.isArray(listaEquipos)?listaEquipos:[];
  const tallerGet=(row,cands)=>{
    const keys=Object.keys(row||{});
    for(const cand of cands){
      const wanted=String(cand||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
      for(const k of keys){
        const kk=String(k||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
        if(kk===wanted||kk.includes(wanted)||wanted.includes(kk))return row[k];
      }
    }
    return "";
  };
  const tallerCount=(cands)=>{
    const m=new Map();
    tallerRows.forEach(r=>{
      const raw=String(tallerGet(r,cands)||"Sin dato").trim()||"Sin dato";
      m.set(raw,(m.get(raw)||0)+1);
    });
    return [...m.entries()].sort((a,b)=>b[1]-a[1]||String(a[0]).localeCompare(String(b[0])));
  };
  const tallerTipos=tallerCount(["Familia","Tipo","Equipo"]);
  const tallerPropiedad=tallerCount(["Propiedad"]);
  const tallerMarcas=tallerCount(["Marca"]);
  return(
    <div style={{
      position:"relative",
      width:"100%",
      minHeight:"100vh",
      display:"flex",
      alignItems:"center",
      justifyContent:"center",
      overflowY:"auto",
      overflowX:"hidden",
      borderRadius:16,
      padding:"46px 16px 28px",
    }}>
      {/* Full background image */}
      <img
        src="/img/embedded/home-welcome-b80067ac.jpg"
        alt="Delta Mining"
        style={{
          position:"absolute",
          inset:0,
          width:"100%",
          height:"100%",
          objectFit:"cover",
          objectPosition:"center",
          borderRadius:16,
          filter:"brightness(0.72)",
        }}
      />
      {/* Overlay gradient */}
      <div style={{
        position:"absolute",
        inset:0,
        background:"linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.15) 60%, rgba(0,0,0,0.05) 100%)",
        borderRadius:16,
      }}/>
      {/* Content */}
      <div style={{
        position:"relative",
        zIndex:2,
        display:"flex",
        flexDirection:"column",
        alignItems:"center",
        justifyContent:"flex-end",
        width:"min(1480px, 100%)",
        minHeight:"calc(100vh - 140px)",
        gap:12,
      }}>
        <div style={{
          marginBottom:10,
          padding:0,
          background:"transparent",
          border:"none",
          boxShadow:"none",
          fontFamily:"Inter",
          fontSize:"clamp(32px, 5vw, 72px)",
          fontWeight:900,
          letterSpacing:".08em",
          textTransform:"uppercase",
          textAlign:"center",
          color:"#fff",
          textShadow:"0 0 6px rgba(255,255,255,.95), 0 0 14px rgba(255,255,255,.7), 0 0 24px rgba(255,0,35,.38), 0 3px 10px rgba(0,0,0,.9)",
        }}>
          BIENVENIDO <span style={{color:"#fff", textShadow:"inherit"}}>{String(nombreUsuario||"Usuario").trim()}</span>
        </div>
        {/* Logo Delta Mining vectorial: no se pixela y no tiene fondo blanco */}
        <div style={{
          display:"flex",
          flexDirection:"column",
          alignItems:"center",
          justifyContent:"center",
          marginBottom:24,
          transform:"translateY(-8px)",
          filter:"drop-shadow(0 18px 36px rgba(0,0,0,0.95))",
          overflow:"hidden",
          background:"transparent",
          border:"none",
          outline:"none",
        }}>
          <img
            src="/img/embedded/home-inline-0c79147d.png"
            alt="Delta Mining"
            style={{
              width:"clamp(200px, 20vw, 320px)",
              height:"auto",
              display:"block",
              imageRendering:"auto",
              background:"transparent",
              border:"none",
              outline:"none",
              boxShadow:"none",
              clipPath:"inset(4px)",
              transform:"scale(1.015)",
              transformOrigin:"center",
            }}
          />
        </div>

        <div style={{
          fontSize:"clamp(32px, 5vw, 72px)",
          fontWeight:900,
          color:"#e8001d",
          fontFamily:"Inter",
          letterSpacing:"0.04em",
          textTransform:"uppercase",
          textAlign:"center",
          textShadow:"0 2px 24px rgba(0,0,0,0.8), 0 0 60px rgba(232,0,29,0.4)",
          lineHeight:1.1,
        }}>
          DELTA MINING
        </div>
        <div style={{
          fontSize:"clamp(16px, 2.5vw, 36px)",
          fontWeight:700,
          color:"#e8001d",
          fontFamily:"Inter",
          letterSpacing:"0.18em",
          textTransform:"uppercase",
          textAlign:"center",
          textShadow:"0 2px 20px rgba(0,0,0,0.9), 0 0 40px rgba(232,0,29,0.3)",
        }}>
          ABRIENDO CAMINOS
        </div>
        <div style={{
          width:120,
          height:3,
          background:"linear-gradient(to right, transparent, #e8001d, transparent)",
          marginTop:8,
          borderRadius:2,
        }}/>

        <div style={{
          display:"flex",
          justifyContent:"center",
          alignItems:"center",
          flexWrap:"nowrap",
          gap:14,
          width:"100%",
          maxWidth:1100,
          marginTop:28,
        }}>
          {(esAdministrativo?[
            {label:"Control de errores",module:"administrativoErrores",view:"controlErrores",color:C.accent},
            {label:"Control de solicitudes",module:"administrativoSolicitudes",view:"abastecimiento",color:C.yellow},
          ]:[
            {label:"Oficina técnica",module:"oficina",view:"rop02",color:C.accent},
            {label:"Mantenimiento",module:"mantenimiento",view:"mant",color:C.yellow},
            {label:"Calidad",module:"calidad",view:"chc",color:C.green},
            {label:"Abastecimiento",module:"abastecimiento",view:"abastecimiento",color:C.yellow},
            {label:"Taller Central",module:"tallerCentral",view:"tallerCentral",color:C.teal},
            {label:"Licitaciones",module:"licitaciones",view:"licitaciones",color:C.blue},
          ]).map(item=>(
            <button
              key={item.label}
              type="button"
              onClick={()=>onOpenModule&&onOpenModule(item.module,item.view)}
              style={{
                width:170,
                minWidth:170,
                minHeight:86,
                borderRadius:18,
                border:`1px solid ${item.color}66`,
                background:"rgba(10,10,10,.58)",
                backdropFilter:"blur(10px)",
                WebkitBackdropFilter:"blur(10px)",
                boxShadow:"0 18px 40px rgba(0,0,0,.35)",
                color:C.text,
                cursor:"pointer",
                fontFamily:"Inter",
                fontSize:18,
                fontWeight:900,
                letterSpacing:".03em",
                textTransform:"uppercase",
                transition:"transform .18s ease, border-color .18s ease, box-shadow .18s ease",
              }}
              onMouseEnter={e=>{
                e.currentTarget.style.transform="translateY(-3px)";
                e.currentTarget.style.borderColor=item.color;
                e.currentTarget.style.boxShadow=`0 22px 46px rgba(0,0,0,.45), 0 0 0 1px ${item.color}55`;
              }}
              onMouseLeave={e=>{
                e.currentTarget.style.transform="translateY(0)";
                e.currentTarget.style.borderColor=item.color+"66";
                e.currentTarget.style.boxShadow="0 18px 40px rgba(0,0,0,.35)";
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

      </div>

      <button
        type="button"
        onClick={onCambiarUsuario}
        style={{
          position:"fixed",
          right:22,
          bottom:20,
          zIndex:40,
          padding:"11px 18px",
          borderRadius:10,
          border:"1px solid rgba(255,255,255,.35)",
          background:"rgba(18,18,18,.58)",
          color:"#fff",
          fontFamily:"Inter",
          fontSize:13,
          fontWeight:800,
          letterSpacing:".04em",
          cursor:"pointer",
          backdropFilter:"blur(10px)",
          WebkitBackdropFilter:"blur(10px)",
          boxShadow:"0 8px 24px rgba(0,0,0,.38)",
          transition:"transform .15s ease, background .15s ease, border-color .15s ease"
        }}
        onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.background="rgba(232,0,29,.22)";e.currentTarget.style.borderColor="rgba(232,0,29,.75)";}}
        onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.background="rgba(18,18,18,.58)";e.currentTarget.style.borderColor="rgba(255,255,255,.35)";}}
      >
        Cambiar usuario
      </button>
    </div>
  );
}
