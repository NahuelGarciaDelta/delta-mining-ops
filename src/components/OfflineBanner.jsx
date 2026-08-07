import React from "react";
import { C, Icon } from "./ui/index.jsx";
export default function OfflineBanner({ lastUpdate }) {
  return <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"rgba(245,158,11,.13)",border:`1px solid ${C.yellow}55`,borderRadius:8,color:C.yellow,fontSize:11,fontWeight:800,marginBottom:10}}>
    <Icon name="warn" size={13} color={C.yellow}/>
    Datos guardados — sin conexión{lastUpdate ? ` · última sincronización ${lastUpdate.toLocaleString("es-AR")}` : ""}
  </div>;
}
