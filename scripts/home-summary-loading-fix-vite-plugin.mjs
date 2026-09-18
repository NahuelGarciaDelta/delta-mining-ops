const TARGET_RE=/[\\/]src[\\/]modules[\\/]home[\\/]ViewBienvenida\.jsx$/;

function replaceOnce(source,from,to,label){
  if(!source.includes(from))throw new Error(`[home-summary-loading-fix] No se encontró ${label}`);
  return source.replace(from,to);
}

export function patchHomeSummaryLoading(source){
  // Vite recibe CRLF en checkouts de Windows y LF en Linux/CI. Normalizamos antes
  // de aplicar el parche para que la transformación sea idéntica en ambos entornos.
  let code=String(source??"").replace(/\r\n?/g,"\n");

  // HMR puede volver a transformar el mismo módulo. Si ya está parcheado, no
  // intentamos aplicar por segunda vez los reemplazos exactos.
  if(
    code.includes('const [openOtReady,setOpenOtReady]=useState(false);')&&
    code.includes('disponibilidad:rop.length===0,')&&
    code.includes('ot:!openOtReady,')
  )return code;

  code=replaceOnce(
    code,
    `  const [openOtSummary,setOpenOtSummary]=useState(null);\n  const [fallbackRma15,setFallbackRma15]=useState(null);`,
    `  const [openOtSummary,setOpenOtSummary]=useState(null);\n  const [fallbackRma15,setFallbackRma15]=useState(null);\n  const [openOtReady,setOpenOtReady]=useState(false);`,
    "estado de OT"
  );

  code=replaceOnce(
    code,
    `  useEffect(()=>{let alive=true;getRma15OpenOtSummary({}).then(response=>{if(alive&&Array.isArray(response?.data))setOpenOtSummary(response.data);}).catch(()=>getRma15({limit:"all",sortBy:"fecha",sortDirection:"asc"}).then(response=>{if(alive)setFallbackRma15(response.data||[]);}).catch(()=>{}));return()=>{alive=false;};},[]);`,
    `  useEffect(()=>{\n    let alive=true;\n    getRma15OpenOtSummary({})\n      .then(response=>{\n        if(!alive)return;\n        setOpenOtSummary(Array.isArray(response?.data)?response.data:[]);\n      })\n      .catch(()=>getRma15({limit:"all",sortBy:"fecha",sortDirection:"asc"})\n        .then(response=>{\n          if(!alive)return;\n          setFallbackRma15(Array.isArray(response?.data)?response.data:[]);\n        })\n        .catch(()=>{\n          if(alive)setFallbackRma15([]);\n        }))\n      .finally(()=>{\n        if(alive)setOpenOtReady(true);\n      });\n    return()=>{alive=false;};\n  },[]);`,
    "carga de OT abiertas"
  );

  code=replaceOnce(
    code,
    `  const {admitidos:admitidosAtraso,loaded:movimientosLoaded,error:movimientosError}=useEquipmentMovements(effectiveRop02,["bienvenida"]);`,
    `  const {admitidos:admitidosAtraso}=useEquipmentMovements(effectiveRop02,["bienvenida"]);`,
    "estado de movimientos"
  );

  code=replaceOnce(
    code,
    `      disponibilidad:rop.length===0||!movimientosLoaded||Boolean(movimientosError),\n      ot:rma.length===0||!movimientosLoaded||Boolean(movimientosError),`,
    `      disponibilidad:rop.length===0,\n      ot:!openOtReady,`,
    "flags de resumen"
  );

  code=replaceOnce(
    code,
    `  },[listaEquipos,effectiveRop02,rma15,fallbackRma15,openOtSummary,sharedStockRows,admitidosAtraso,movimientosLoaded,movimientosError]);`,
    `  },[listaEquipos,effectiveRop02,rma15,fallbackRma15,openOtSummary,openOtReady,sharedStockRows,admitidosAtraso]);`,
    "dependencias del resumen"
  );

  return code;
}

export function homeSummaryLoadingFixVitePlugin(){
  return{
    name:"delta-home-summary-loading-fix",
    enforce:"pre",
    transform(code,id){
      const cleanId=String(id||"").split("?")[0];
      if(!TARGET_RE.test(cleanId))return null;
      return{code:patchHomeSummaryLoading(code),map:null};
    },
  };
}
