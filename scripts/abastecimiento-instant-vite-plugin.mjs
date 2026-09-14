export function abastecimientoInstantVitePlugin(){
  return {
    name:'delta-abastecimiento-instant',
    enforce:'pre',
    transform(code,id){
      if(!id.endsWith('/src/modules/abastecimiento/AbastecimientoModule.jsx'))return null;
      let next=code;

      next=next.replace(
        'import { registerRefreshTask } from "../../services/refreshManager.js";',
        'import { registerRefreshTask } from "../../services/refreshManager.js";\nimport { fetchRaba03FromSupabase, fetchAbastecimientoSnapshot } from "../../services/raba03ReadApi.js";'
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
        'const url=`${APPS_SCRIPT_URL}?action=raba03&limit=all&_=${Date.now()}`;\n      const res=await fetch(url,{cache:"no-store"});\n      const json=await res.json();',
        'const json=await fetchRaba03FromSupabase();'
      );

      next=next.replace(
        '      const url=`${APPS_SCRIPT_URL}?action=remitos_cargados&limit=all&force=1&_=${Date.now()}`;\n      const res=await fetch(url,{method:"GET",cache:"no-store",redirect:"follow"});\n      if(!res.ok)throw new Error(`Error HTTP ${res.status}`);\n      const json=await res.json();\n      if(!json.ok)throw new Error(json?.error?.message||"No se pudieron leer los remitos cargados.");\n      const shared=buildRemitosCompartidos(json.data||[]);',
        '      const json=await fetchAbastecimientoSnapshot();\n      if(!json?.ok)throw new Error("No se pudieron leer los remitos cargados desde Supabase.");\n      const shared=buildRemitosCompartidos(json.remitos||[]);'
      );

      next=next.replace(
        'setRows(mapRaba03Rows(raw,sourceRemitos));',
        'const mappedRows=mapRaba03Rows(raw,sourceRemitos);\n      setRows(mappedRows);\n      try{window.localStorage.setItem(RABA03_VIEW_CACHE_KEY,JSON.stringify(mappedRows));}catch(_){}'
      );

      const sequential=`const run=async()=>{\n      let sharedRemitos=null;\n      try{sharedRemitos=await loadRemitosCompartidos({silent:true});}catch(_){}\n      try{await loadEstadosSolicitudesCompartidos({silent:true});}catch(_){}\n      if(cancelled)return;\n      await loadRaba03({silent:false,remitosOverride:sharedRemitos});\n    };`;
      const parallel=`const run=async()=>{\n      const [remitosResult]=await Promise.allSettled([\n        loadRemitosCompartidos({silent:true}),\n        loadEstadosSolicitudesCompartidos({silent:true})\n      ]);\n      if(cancelled)return;\n      const sharedRemitos=remitosResult.status==="fulfilled"?remitosResult.value:null;\n      await loadRaba03({silent:rows.length>0,remitosOverride:sharedRemitos});\n    };`;
      next=next.replace(sequential,parallel);

      const unmatchedStart='  const enviosSinSolicitudRows=useMemo(()=>{';
      const unmatchedEnd='\n  const exportarEnviosSinSolicitud=useCallback(()=>{';
      const start=next.indexOf(unmatchedStart);
      const end=start>=0?next.indexOf(unmatchedEnd,start):-1;
      if(start<0||end<0){
        throw new Error('No se encontró el bloque de Envíos sin solicitud en AbastecimientoModule.jsx');
      }
      const unmatched=`  const enviosSinSolicitudRows=useMemo(()=>{\n    const solicitudesValidas=(rows||[]).filter(row=>!rejectedSolicitudes?.[buildSolicitudKey(row)]);\n    const base=solicitudesValidas.map(row=>({\n      ...row,\n      cantidadEnviada:0,\n      cantidadRestante:Math.max(0,toNumber(row.cantidadSolicitada)),\n      _matchedRemitos:[]\n    }));\n    return allocateRemitosToRequests(base,remitos).unmatched.sort((a,b)=>{\n      const fa=parseChronoDateMs(a.fechaEnvio),fb=parseChronoDateMs(b.fechaEnvio);\n      if(fa!==fb)return fb-fa;\n      return String(a.codigoArticulo||\"\").localeCompare(String(b.codigoArticulo||\"\"),\"es\",{numeric:true,sensitivity:\"base\"});\n    });\n  },[rows,remitos,toNumber,allocateRemitosToRequests,rejectedSolicitudes,buildSolicitudKey]);`;
      next=next.slice(0,start)+unmatched+next.slice(end);

      if(!next.includes('solicitudesValidas=(rows||[]).filter(row=>!rejectedSolicitudes?.[buildSolicitudKey(row)])')){
        throw new Error('Envíos sin solicitud debe excluir solicitudes rechazadas antes del FIFO');
      }
      if(!next.includes('allocateRemitosToRequests(base,remitos).unmatched')){
        throw new Error('No se pudo aplicar el FIFO de Envíos sin solicitud');
      }
      if(!next.includes('fetchRaba03FromSupabase')||!next.includes('fetchAbastecimientoSnapshot')||!next.includes('RABA03_VIEW_CACHE_KEY')){
        throw new Error('No se pudo aplicar la optimización Supabase/cache de Abastecimiento');
      }
      if(next.includes('action=remitos_cargados')){
        throw new Error('Abastecimiento no debe volver a leer remitos pesados desde Apps Script');
      }

      if(next===code)return null;
      return {code:next,map:null};
    }
  };
}