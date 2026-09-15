import React, { useState } from "react";
import { AbastecimientoModule } from "./AbastecimientoModule.jsx";
import DeleteSolicitudByNumber from "./DeleteSolicitudByNumber.jsx";

export default function AbastecimientoRoute(props) {
  const [refreshKey,setRefreshKey]=useState(0);
  const showDeleteSolicitud=!props.readOnly&&props.initialTab==="solicitudes";
  return (<>
    {showDeleteSolicitud&&<DeleteSolicitudByNumber deps={props.deps} onDeleted={()=>setRefreshKey(v=>v+1)}/>}
    <AbastecimientoModule key={refreshKey} {...props}/>
  </>);
}
