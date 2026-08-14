import React, { Suspense } from "react";
const LazyOficinaTecnica = React.lazy(()=>import("./OficinaTecnicaModule.jsx").then(m=>({default:m.OficinaTecnicaView})));
export function OficinaTecnicaRoute(props){
  const Fallback=props?.deps?.BlockingDataLoader;
  return <Suspense fallback={Fallback?<Fallback label="Cargando Oficina Técnica..."/>:null}><LazyOficinaTecnica {...props}/></Suspense>;
}
