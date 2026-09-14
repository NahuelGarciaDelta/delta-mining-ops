export function abastecimientoInstantVitePlugin(){
  return {
    name:'delta-abastecimiento-instant',
    enforce:'pre',
    transform(code,id){
      if(!id.endsWith('/src/modules/abastecimiento/AbastecimientoModule.jsx'))return null;
      let next=code;

      next=next.replace(
        'import { registerRefreshTask } from "../../services/refreshManager.js";',
        'import { registerRefreshTask } from "../../services/refreshManager.js";\nimport { fetchRaba03FromSupabase } from "../../services/raba03ReadApi.js";\nimport { buildEnviosSinSolicitudRows } from "./enviosSinSolicitud.js";'
      );

      next=next.replace(
        'const RABA03_CLOSED_STORAGE_KEY = "dm_raba03_solicitudes_cerradas_manual_v1";',
        'const RABA03_CLOSED_STORAGE_KEY = "dm_raba03_solicitudes_cerradas_manual_v1";\nconst RABA03_VIEW_CACHE_KEY = "dm_raba03_view_rows_v2";'
      );

      next=next.replace(
        'const [rows,setRows]=useState([]);',
        'const [rows,setRows]=useState(()=>{try{const cached=JSON.parse(window.localStorage.getItem(RABA03_VIEW_CACHE_KEY)||"[]");return Array.isArray(cached)?cached:[];}catch(_){return [];}});'
      );

      next=next.replace(
        'const [loading,setLoading]=useState(()=>!["remito","stock","stockDashboard"].includes(initialTab));',
        'const [loading,setLoading]=useState(()=>!["remito","stock","stockDashboard"].includes(initialTab)&&rows.length===0);'
      );

      next=next.replace(
        `      cantidadSolicitada:solicitada,
      cantidadEnviada:enviada,
      cantidadRestante:restante
    };`,
        `      cantidadSolicitada:solicitada,
      cantidadEnviada:enviada,
      cantidadRestante:restante,
      numeroRemitoFuente:String(pick(r,["Nº Remito","N° Remito","Numero Remito","Número Remito"])||"").trim(),
      fechaSalidaFuente:formatDateLocal(pick(r,["Fecha de salida","Fecha salida"])),
      cantidadEnviadaFuente:toNumber(pick(r,["Cant. Enviada","Cantidad enviada","Cant Enviada"])),
      _raba03ExplicitLinksLoaded:true
    };`
      );

      next=next.replace(
        `  const enviosSinSolicitudRows=useMemo(()=>{
    const base=(rows||[]).map(r=>({...r,cantidadEnviada:0,cantidadRestante:Math.max(0,toNumber(r.cantidadSolicitada)),_matchedRemitos:[]}));
    return allocateRemitosToRequests(base,remitos).unmatched.sort((a,b)=>{
      const fa=parseChronoDateMs(a.fechaEnvio),fb=parseChronoDateMs(b.fechaEnvio);
      if(fa!==fb)return fb-fa;
      return String(a.codigoArticulo||"").localeCompare(String(b.codigoArticulo||""),"es",{numeric:true,sensitivity:"base"});
    });
  },[rows,remitos,toNumber,allocateRemitosToRequests]);`,
        `  const enviosSinSolicitudRows=useMemo(()=>buildEnviosSinSolicitudRows({
    rows,
    remitos,
    normCode,
    toNumber,
    normalizeCentroCosto,
    parseChronoDateMs
  }),[rows,remitos,normCode,toNumber,normalizeCentroCosto]);`
      );

      next=next.replace(
        'const url=`${APPS_SCRIPT_URL}?action=raba03&limit=all&_=${Date.now()}`;\n      const res=await fetch(url,{cache:"no-store"});\n      const json=await res.json();',
        'const json=await fetchRaba03FromSupabase();'
      );

      next=next.replace(
        'setRows(mapRaba03Rows(raw,sourceRemitos));',
        'const mappedRows=mapRaba03Rows(raw,sourceRemitos);\n      setRows(mappedRows);\n      try{window.localStorage.setItem(RABA03_VIEW_CACHE_KEY,JSON.stringify(mappedRows));}catch(_){}'
      );

      const sequential=`const run=async()=>{\n      let sharedRemitos=null;\n      try{sharedRemitos=await loadRemitosCompartidos({silent:true});}catch(_){}\n      try{await loadEstadosSolicitudesCompartidos({silent:true});}catch(_){}\n      if(cancelled)return;\n      await loadRaba03({silent:false,remitosOverride:sharedRemitos});\n    };`;
      const parallel=`const run=async()=>{\n      const [remitosResult]=await Promise.allSettled([\n        loadRemitosCompartidos({silent:true}),\n        loadEstadosSolicitudesCompartidos({silent:true})\n      ]);\n      if(cancelled)return;\n      const sharedRemitos=remitosResult.status==="fulfilled"?remitosResult.value:null;\n      await loadRaba03({silent:rows.length>0,remitosOverride:sharedRemitos});\n    };`;
      next=next.replace(sequential,parallel);

      if(!next.includes('numeroRemitoFuente:')||!next.includes('buildEnviosSinSolicitudRows({')){
        throw new Error('No se pudo aplicar la corrección de Envíos sin solicitud sobre AbastecimientoModule.jsx');
      }

      if(next===code)return null;
      return {code:next,map:null};
    }
  };
}
