import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";

export default function UserSettingsModal({open,forced=false,onClose,onSaved,APPS_SCRIPT_URL,C,Spinner,Icon,permissionSnapshot={}}){
  const [nombre,setNombre]=useState(()=>String(sessionStorage.getItem("dm_name")||""));
  const [area,setArea]=useState(()=>String(sessionStorage.getItem("dm_area")||""));
  const [actual,setActual]=useState("");
  const [nueva,setNueva]=useState("");
  const [repetir,setRepetir]=useState("");
  const [saving,setSaving]=useState(false);
  const userRole=String(sessionStorage.getItem("dm_role")||"USUARIO").trim().toUpperCase();
  const canChangeArea=userRole==="ADMIN"||userRole==="ADMINISTRADOR";
  const [error,setError]=useState("");
  useEffect(()=>{
    if(open){
      setNombre(String(sessionStorage.getItem("dm_name")||""));
      setArea(String(sessionStorage.getItem("dm_area")||""));
      setActual("");setNueva("");setRepetir("");setError("");
    }
  },[open]);
  if(!open)return null;
  const areas=[
    "",
    "OFICINA TÉCNICA",
    "MANTENIMIENTO",
    "CALIDAD",
    "ABASTECIMIENTO",
    "TALLER CENTRAL",
    "LICITACIONES",
    "FINANZAS",
    "RECURSOS HUMANOS",
    "HIGIENE Y SEGURIDAD",
    "ADMINISTRATIVO",
    "SUPERVISOR"
  ];
  const guardar=async()=>{
    setError("");
    if(!nombre.trim()){setError("Ingresá un nombre.");return;}
    if(forced&&!actual){setError("Ingresá la contraseña actual DELTA.MINING.APP.");return;}
    if(forced&&!nueva){setError("Elegí una nueva contraseña.");return;}
    if(nueva&&nueva.length<4){setError("La nueva contraseña debe tener al menos 4 caracteres.");return;}
    if(nueva!==repetir){setError("Las nuevas contraseñas no coinciden.");return;}
    if(nueva&&!actual){setError("Ingresá la contraseña actual.");return;}
    setSaving(true);
    try{
      const payload={action:"update_user_profile",email:sessionStorage.getItem("dm_user")||"",currentPassword:actual,newPassword:nueva,nombre:nombre.trim(),area};
      const res=await fetch(APPS_SCRIPT_URL,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},body:new URLSearchParams({payload:JSON.stringify(payload)})});
      const json=await res.json();
      if(!json?.ok)throw new Error(json?.error?.message||"No se pudo guardar la configuración.");
      sessionStorage.setItem("dm_name",json.user?.nombre||nombre.trim());
      sessionStorage.setItem("dm_area",json.user?.area||area);
      sessionStorage.setItem("dm_must_change_password","0");
      onSaved?.(json.user||{});
    }catch(err){setError(err.message||"No se pudo guardar la configuración.");}
    finally{setSaving(false);}
  };
  return ReactDOM.createPortal(
    <div style={{position:"fixed",inset:0,zIndex:2147483646,background:"rgba(0,0,0,.74)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:"min(520px,calc(100vw - 32px))",background:"rgba(22,22,22,.98)",border:`1px solid ${forced?C.accent:C.border}`,borderRadius:16,boxShadow:"0 24px 80px rgba(0,0,0,.65)",overflow:"hidden"}}>
        <div style={{padding:"17px 20px",borderBottom:`1px solid ${C.border}66`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div><div style={{fontSize:16,fontWeight:900,color:C.text}}>{forced?"Crear contraseña personal":"Configuración de usuario"}</div><div style={{fontSize:11,color:C.textMuted,marginTop:3}}>{forced?"Por seguridad, debe cambiar la contraseña inicial para continuar.":sessionStorage.getItem("dm_user")}</div></div>
          {!forced&&<button onClick={onClose} style={{background:"none",border:"none",color:C.textMuted,fontSize:22,cursor:"pointer"}}>×</button>}
        </div>
        <div style={{padding:20,display:"grid",gap:14}}>
          <label style={{display:"grid",gap:6,fontSize:11,color:C.textSub,fontWeight:700}}>NOMBRE
            <input value={nombre} onChange={e=>setNombre(e.target.value)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,padding:"11px 12px",color:C.text,outline:"none"}}/>
          </label>
          <label style={{display:"grid",gap:6,fontSize:11,color:C.textSub,fontWeight:700}}>ÁREA
            <select value={area} disabled={!canChangeArea} onChange={e=>setArea(e.target.value)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,padding:"11px 12px",color:C.text,outline:"none",opacity:canChangeArea?1:.65,cursor:canChangeArea?"pointer":"not-allowed"}}>
              {areas.map(x=><option key={x} value={x}>{x||"SIN DEFINIR"}</option>)}
            </select>
            {!canChangeArea&&<span style={{fontSize:10,color:C.textMuted,fontWeight:500}}>El área la administra un usuario ADMIN; no puede autoasignarse desde el perfil.</span>}
          </label>
          <div style={{height:1,background:`${C.border}66`,margin:"2px 0"}}/>
          {!forced&&<div style={{display:"grid",gap:7}}><div style={{fontSize:11,color:C.textSub,fontWeight:800}}>PERMISOS EFECTIVOS</div><div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:6}}>{Object.entries(permissionSnapshot||{}).map(([areaName,actions])=><div key={areaName} style={{padding:"7px 8px",borderRadius:7,border:`1px solid ${C.border}66`,background:"rgba(255,255,255,.025)"}}><div style={{fontSize:9,fontWeight:800,color:C.text}}>{areaName}</div><div style={{fontSize:9,color:C.textMuted,marginTop:3}}>{(actions||[]).join(" · ")||"solo lectura"}</div></div>)}</div></div>}
          <div style={{height:1,background:`${C.border}66`,margin:"2px 0"}}/>
          <label style={{display:"grid",gap:6,fontSize:11,color:C.textSub,fontWeight:700}}>CONTRASEÑA ACTUAL
            <input type="password" value={actual} onChange={e=>setActual(e.target.value)} placeholder={forced?"DELTA.MINING.APP":"Solo es necesaria para cambiar la contraseña"} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,padding:"11px 12px",color:C.text,outline:"none"}}/>
          </label>
          <label style={{display:"grid",gap:6,fontSize:11,color:C.textSub,fontWeight:700}}>NUEVA CONTRASEÑA
            <input type="password" value={nueva} onChange={e=>setNueva(e.target.value)} placeholder={forced?"Elegí tu nueva contraseña":"Dejar vacío para mantener la actual"} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,padding:"11px 12px",color:C.text,outline:"none"}}/>
          </label>
          <label style={{display:"grid",gap:6,fontSize:11,color:C.textSub,fontWeight:700}}>REPETIR NUEVA CONTRASEÑA
            <input type="password" value={repetir} onChange={e=>setRepetir(e.target.value)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,padding:"11px 12px",color:C.text,outline:"none"}}/>
          </label>
          {error&&<div style={{padding:"10px 12px",borderRadius:9,background:`${C.red}18`,border:`1px solid ${C.red}55`,color:C.red,fontSize:12,fontWeight:700}}>{error}</div>}
        </div>
        <div style={{padding:"0 20px 20px",display:"flex",justifyContent:"flex-end",gap:10}}>
          {!forced&&<button onClick={onClose} disabled={saving} style={{padding:"10px 16px",borderRadius:9,border:`1px solid ${C.border}`,background:C.surface,color:C.textSub,fontWeight:800,cursor:"pointer"}}>Cancelar</button>}
          <button onClick={guardar} disabled={saving} style={{padding:"10px 18px",borderRadius:9,border:`1px solid ${C.accent}88`,background:C.accentDim,color:C.accent,fontWeight:900,cursor:saving?"wait":"pointer",display:"flex",alignItems:"center",gap:7}}>{saving?<Spinner size={13}/>:<Icon name="check" size={14} color={C.accent}/>} {saving?"Guardando...":"Guardar cambios"}</button>
        </div>
      </div>
    </div>,document.body
  );
}


// Ordenamiento universal para las tablas HTML que no usan SmartTable.
// Ciclo por encabezado: ascendente -> descendente -> orden original.
