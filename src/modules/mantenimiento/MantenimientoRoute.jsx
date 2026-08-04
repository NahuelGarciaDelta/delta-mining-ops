import React from "react";
const LazyMantenimientoModule = React.lazy(() => import("./MantenimientoModule.jsx"));
export default function MantenimientoRoute(props){
 return <React.Suspense fallback={<div style={{minHeight:240,display:"grid",placeItems:"center",color:"#cbd5e1"}}>Cargando Mantenimiento…</div>}><LazyMantenimientoModule {...props}/></React.Suspense>;
}
