import React from "react";
import { C, Icon } from "./ui/index.jsx";

export default function ErrorScreen({errors=[],onRetry}){
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"60vh",gap:20,textAlign:"center",padding:24}}>
      <div style={{width:56,height:56,borderRadius:"50%",background:C.redDim,border:`2px solid ${C.red}44`,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <Icon name="warn" size={26} color={C.red}/>
      </div>
      <div>
        <div style={{fontFamily:"Inter",fontSize:16,fontWeight:700,color:C.red,marginBottom:8}}>Error al cargar datos</div>
        <div style={{display:"flex",flexDirection:"column",gap:6,maxWidth:480}}>
          {errors.map((e,i)=>(
            <div key={i} style={{background:C.redDim,border:`1px solid ${C.red}33`,borderRadius:8,padding:"10px 14px",textAlign:"left"}}>
              <div style={{fontSize:11,color:C.red,fontWeight:600}}>{e.source}</div>
              <div style={{fontSize:12,color:C.textSub,marginTop:2}}>{e.message}</div>
            </div>
          ))}
        </div>
      </div>
      <button onClick={onRetry} style={{padding:"9px 18px",borderRadius:8,border:`1px solid ${C.accent}44`,background:C.accentDim,color:C.accent,fontFamily:"Inter",fontWeight:600,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
        <Icon name="refresh" size={14} color={C.accent}/> Reintentar
      </button>
    </div>
  );
}
