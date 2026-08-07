import React from "react";
import { PageLoadingMotoniveladora } from "../../components/ui/index.jsx";
const LazyMantenimientoModule = React.lazy(() => import("./MantenimientoModule.jsx"));
export default function MantenimientoRoute(props){
  return <React.Suspense fallback={<PageLoadingMotoniveladora label="Cargando Mantenimiento..."/>}><LazyMantenimientoModule {...props}/></React.Suspense>;
}
