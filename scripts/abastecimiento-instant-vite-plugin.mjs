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

      const dashboardRowsBefore=`          cantidadRemito:m.cantidad||0,\n          indicador:calcularIndicadorRABA03(row.fechaSolicitud,m.fecha)\n        }));\n      }\n    });\n    return out;\n  },[assignedRows,calcularIndicadorRABA03]);`;
      const dashboardRowsAfter=`          cantidadRemito:m.cantidad||0,\n          indicador:calcularIndicadorRABA03(row.fechaSolicitud,m.fecha),\n          cerrada:!rejectedSolicitudes?.[buildSolicitudKey(row)]&&toNumber(row.cantidadSolicitada)>0&&(toNumber(row.cantidadRestante)<=0||closedSolicitudes?.[buildSolicitudKey(row)])\n        }));\n      }\n    });\n    return out;\n  },[assignedRows,calcularIndicadorRABA03,toNumber,buildSolicitudKey,rejectedSolicitudes,closedSolicitudes]);`;
      if(!next.includes(dashboardRowsBefore)){
        throw new Error('No se encontró el bloque de filas del dashboard de Abastecimiento');
      }
      next=next.replace(dashboardRowsBefore,dashboardRowsAfter);

      const dashboardAvgBefore=`    const movimientos=(raba03DashboardRows||[]).map(r=>({...r,indicadorNum:Number(r.indicador)})).filter(r=>Number.isFinite(r.indicadorNum));\n    const avg=movimientos.length?movimientos.reduce((a,r)=>a+r.indicadorNum,0)/movimientos.length:0;`;
      const dashboardAvgAfter=`    const movimientos=(raba03DashboardRows||[]).map(r=>({...r,indicadorNum:Number(r.indicador)})).filter(r=>Number.isFinite(r.indicadorNum));\n    const movimientosCerrados=movimientos.filter(r=>r.cerrada);\n    const avg=movimientosCerrados.length?movimientosCerrados.reduce((a,r)=>a+r.indicadorNum,0)/movimientosCerrados.length:0;`;
      if(!next.includes(dashboardAvgBefore)){
        throw new Error('No se encontró el cálculo del promedio indicador de Abastecimiento');
      }
      next=next.replace(dashboardAvgBefore,dashboardAvgAfter);

      const itemsConSalidaBefore='<StatCard icon="check" label="Ítems con salida" value={fmtNum(d.movimientos.length)} sub="con remito asignado" color={C.green} small/>';
      const itemsConSalidaAfter='<StatCard icon="check" label="Ítems con salida" value={fmtNum(d.cerradas+d.parciales)} sub="cerradas + parciales" color={C.green} small/>';
      if(!next.includes(itemsConSalidaBefore)){
        throw new Error('No se encontró la tarjeta Ítems con salida del dashboard de Abastecimiento');
      }
      next=next.replace(itemsConSalidaBefore,itemsConSalidaAfter);

      const unmatchedStart='  const enviosSinSolicitudRows=useMemo(()=>{';
      const unmatchedEnd='\n  const exportarEnviosSinSolicitud=useCallback(()=>{';
      const start=next.indexOf(unmatchedStart);
      const end=start>=0?next.indexOf(unmatchedEnd,start):-1;
      if(start<0||end<0){
        throw new Error('No se encontró el bloque de Envíos sin solicitud en AbastecimientoModule.jsx');
      }
      // No reemplazar la auditoría histórica por un FIFO de cantidades. El source
      // ya contiene la regla código+proyecto+descripción+fecha sin retroactividad.
      if(!next.includes('sol.descripcion===descripcionNormalizada')||!next.includes('sol.fechaMs<=fechaMs')){
        throw new Error('Envíos sin solicitud perdió su clave histórica o la barrera temporal');
      }
      if(next.includes('allocateRemitosToRequests(base,remitos).unmatched')){
        throw new Error('Envíos sin solicitud no debe volver al FIFO retroactivo');
      }

      if(!next.includes('fetchRaba03FromSupabase')||!next.includes('fetchAbastecimientoSnapshot')||!next.includes('RABA03_VIEW_CACHE_KEY')){
        throw new Error('No se pudo aplicar la optimización Supabase/cache de Abastecimiento');
      }
      if(next.includes('action=remitos_cargados')){
        throw new Error('Abastecimiento no debe volver a leer remitos pesados desde Apps Script');
      }
      if(next.includes('label="Ítems con salida" value={fmtNum(d.movimientos.length)}')){
        throw new Error('Ítems con salida no debe depender de movimientos/indicadores calculables');
      }
      if(next.includes('label="Ítems con salida" value={fmtNum(raba03DashboardRows.length)}')){
        throw new Error('Ítems con salida no debe contar líneas de remito; debe contar solicitudes cerradas + parciales');
      }
      if(!next.includes('label="Ítems con salida" value={fmtNum(d.cerradas+d.parciales)}')){
        throw new Error('Ítems con salida debe ser cerradas + parciales');
      }
      if(!next.includes('const movimientosCerrados=movimientos.filter(r=>r.cerrada);')||!next.includes('const avg=movimientosCerrados.length?')){
        throw new Error('Promedio indicador debe calcularse sólo con solicitudes cerradas');
      }

      if(next===code)return null;
      return {code:next,map:null};
    }
  };
}
