import React, { Suspense } from "react";
import {getRop02,getRop05} from "../../data/historicalDataService.js";
import {normalizeROP02,normalizeROP05} from "../../shared/domain/index.jsx";

const LazyOficinaTecnica = React.lazy(()=>import("./OficinaTecnicaModule.jsx").then(m=>({default:m.OficinaTecnicaView})));

const ROP02_VIEWS=new Set([
  "dashboard","listaEquipos","tallerCentral","rop02","horometros","vehiculos","controlROP02",
  "controlErrores","ctrlEquipo","atrasoROP02","combustible","chc","control"
]);
const ROP05_VIEWS=new Set(["dashboard","listaEquipos","rop05","rop05Discriminacion","control"]);

export function OficinaTecnicaRoute(props){
  const Fallback=props?.deps?.BlockingDataLoader;
  const view=props?.view||"";
  const needRop02=ROP02_VIEWS.has(view);
  const needRop05=ROP05_VIEWS.has(view);
  const [remote,setRemote]=React.useState({rop02:null,rop05:null,loading:false,error:""});

  React.useEffect(()=>{
    if(!needRop02&&!needRop05)return;
    let alive=true;
    setRemote(prev=>({...prev,loading:true,error:""}));
    Promise.all([
      needRop02?getRop02({limit:"all",offset:0,sortBy:"fecha",sortDirection:"asc"}):Promise.resolve(null),
      needRop05?getRop05({limit:"all",offset:0,sortBy:"fecha",sortDirection:"asc"}):Promise.resolve(null),
    ]).then(([r02,r05])=>{
      if(!alive)return;
      setRemote(prev=>({
        ...prev,
        rop02:r02?normalizeROP02(r02.data||[]):prev.rop02,
        rop05:r05?normalizeROP05(r05.data||[]):prev.rop05,
        loading:false,
        error:""
      }));
    }).catch(error=>{
      if(!alive)return;
      setRemote(prev=>({...prev,loading:false,error:error?.message||"No se pudieron cargar los datos desde Supabase"}));
    });
    return()=>{alive=false;};
  },[needRop02,needRop05]);

  const effectiveRop02=remote.rop02??props.rop02All??[];
  const effectiveRop05=remote.rop05??props.rop05??[];
  const merged={
    ...props,
    rop02All:effectiveRop02,
    rop02ControlAll:needRop02?effectiveRop02:(props.rop02ControlAll??effectiveRop02),
    rop05:effectiveRop05,
    dataHydrated:props.dataHydrated||((!needRop02||remote.rop02!==null)&&(!needRop05||remote.rop05!==null)),
  };

  if((needRop02&&remote.rop02===null&&remote.loading)||(needRop05&&remote.rop05===null&&remote.loading)){
    return Fallback?<Fallback label="Cargando datos desde Supabase..."/>:null;
  }

  return <Suspense fallback={Fallback?<Fallback label="Cargando Oficina Técnica..."/>:null}><LazyOficinaTecnica {...merged}/></Suspense>;
}
