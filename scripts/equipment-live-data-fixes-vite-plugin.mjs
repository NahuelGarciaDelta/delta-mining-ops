const normalizeId=id=>String(id||"").replace(/\\/g,"/").split("?")[0];

const APP_TARGET="/src/App.jsx";
const PM_TARGET="/src/modules/mantenimiento/MantenimientoProgramadoView.jsx";
const PROFILE_TARGET="/src/modules/equipment/EquipmentProfileView.jsx";

function requiredReplace(source,from,to,label){
  if(!source.includes(from))throw new Error(`[delta-equipment-live-data-fixes] No se encontró el ancla requerida: ${label}`);
  return source.replace(from,to);
}

function transformApp(code){
  let out=code;
  out=requiredReplace(
    out,
    '    const run=()=>{if(!cancelled)loadSources(VIEW_SOURCES[view]||[],{background:true});};',
    '    const criticalLiveView=view==="equipmentProfile"||String(view||"").startsWith("pm");\n    const run=()=>{if(!cancelled)loadSources(VIEW_SOURCES[view]||[],{background:true,force:criticalLiveView});};',
    "recarga fresca al entrar a Ficha Única/Mantenimiento Programado"
  );
  return out;
}

function transformPm(code){
  let out=code;
  out=requiredReplace(
    out,
    '  const interno = text(pick(row, ["Codigo nuevo", "Código nuevo", "Código de Drusila", "Codigo de Drusila", "Interno", "Código interno", "Codigo interno"]));',
    `  const internoCandidates = [\n    pick(row, ["Codigo nuevo", "Código nuevo"]),\n    pick(row, ["Código de Drusila", "Codigo de Drusila"]),\n    pick(row, ["Interno", "Código interno", "Codigo interno"]),\n  ];\n  const interno = internoCandidates.map(text).find(value => {\n    const key = norm(value);\n    return key && !["NA", "SD", "SINCODIGO", "SININTERNO", "NODISPONIBLE"].includes(key);\n  }) || "";`,
    "fallback Código nuevo -> Código Drusila en PM"
  );
  return out;
}

function transformProfile(code){
  let out=code;

  out=requiredReplace(
    out,
    'import { fetchAction } from "../../services/appsScriptApi.js";',
    'import { fetchAction, fetchDatasetQuery } from "../../services/appsScriptApi.js";',
    'import de consulta ROP02 puntual'
  );
  out=requiredReplace(
    out,
    'import { byDateFilter } from "../../shared/domain/index.jsx";',
    'import { byDateFilter, normalizeROP02 } from "../../shared/domain/index.jsx";',
    'import de normalización ROP02'
  );

  out=requiredReplace(
    out,
    'function sourceCode(row){return String(row?.maquina||row?.interno||row?.codigo||row?.["Codigo Int"]||row?.["Código Interno del Equipo"]||"").trim();}',
    `function sourceCode(row){return String(row?.maquina||row?.interno||row?.codigo||row?.["Codigo Int"]||row?.["Código Interno del Equipo"]||"").trim();}\nfunction profileEquipmentVariants(...values){\n  const out=new Set();\n  const add=value=>{\n    const raw=cleanEquipmentCode(value);\n    if(!raw)return;\n    out.add(raw);\n    const canonical=canonicalEquipmentCode(raw);\n    if(canonical)out.add(canonical);\n    const m=canonical.match(/^([A-Z]+)(\\d+)$/);\n    if(m){\n      const prefix=m[1],digits=m[2],padded=digits.padStart(4,"0");\n      out.add(prefix+padded);\n      out.add(prefix+"-"+padded);\n    }\n  };\n  values.flat(Infinity).forEach(add);\n  return [...out].filter(Boolean);\n}`,
    'variantes de interno para Ficha Única'
  );

  out=requiredReplace(
    out,
    '  const [pm,setPm]=useState({config:[],registros:[]});',
    '  const [pm,setPm]=useState({config:[],registros:[]});\n  const [liveRop02,setLiveRop02]=useState([]);',
    'estado ROP02 puntual'
  );

  out=requiredReplace(
    out,
    `  const master=masterIndex.get(selectedKey)||selectedOption?.master||null;\n  const op=rop02Index.get(selectedKey)||[];`,
    `  const master=masterIndex.get(selectedKey)||selectedOption?.master||null;\n  const liveQueryCodes=useMemo(()=>profileEquipmentVariants(selected,selectedOption?.value,master?codesOfMaster(master):[],selectedKey),[selected,selectedOption?.value,master,selectedKey]);\n  const liveQueryKey=liveQueryCodes.join("|");\n  useEffect(()=>{\n    let cancelled=false;\n    if(!selectedKey||!liveQueryCodes.length){setLiveRop02([]);return()=>{cancelled=true;};}\n    fetchDatasetQuery(APPS_SCRIPT_URL,{dataset:"rop02",equipo:liveQueryCodes,limit:"all",sortBy:"fecha",sortDirection:"asc"})\n      .then(result=>{\n        if(cancelled)return;\n        const allowed=new Set(liveQueryCodes.map(canonicalEquipmentCode).filter(Boolean));\n        const normalized=normalizeROP02(Array.isArray(result?.data)?result.data:[],"")\n          .filter(row=>allowed.has(canonicalEquipmentCode(sourceCode(row))));\n        setLiveRop02(normalized);\n      })\n      .catch(error=>{if(!cancelled){console.warn("No se pudo cargar el ROP02 puntual de la Ficha Única",error);setLiveRop02([]);}});\n    return()=>{cancelled=true;};\n  },[selectedKey,liveQueryKey]);\n  const opIndexed=rop02Index.get(selectedKey)||[];\n  const op=useMemo(()=>{\n    const allowed=new Set(profileEquipmentVariants(selectedKey,selectedOption?.value,master?codesOfMaster(master):[]).map(canonicalEquipmentCode).filter(Boolean));\n    const merged=new Map();\n    const add=(row,index)=>{\n      if(!allowed.has(canonicalEquipmentCode(sourceCode(row))))return;\n      const identity=String(row?._sourceKey||row?._sourceRow||[row?.fecha,row?.turno,row?.parte,sourceCode(row),index].join("|"));\n      merged.set(identity,row);\n    };\n    opIndexed.forEach(add);\n    liveRop02.forEach(add);\n    return [...merged.values()].sort((a,b)=>String(a?.fecha||"").localeCompare(String(b?.fecha||""))||String(a?.turno||"").localeCompare(String(b?.turno||"")));\n  },[opIndexed,liveRop02,selectedKey,selectedOption?.value,master]);`,
    'consulta puntual y merge de ROP02 en Ficha Única'
  );

  if(!out.includes('fetchDatasetQuery(APPS_SCRIPT_URL,{dataset:"rop02"')||!out.includes('const [liveRop02,setLiveRop02]')){
    throw new Error('[delta-equipment-live-data-fixes] La Ficha Única quedó sin consulta ROP02 puntual');
  }
  return out;
}

export function equipmentLiveDataFixesVitePlugin(){
  return {
    name:"delta-equipment-live-data-fixes",
    enforce:"pre",
    transform(code,id){
      const file=normalizeId(id);
      let next=null;
      if(file.endsWith(APP_TARGET))next=transformApp(code);
      else if(file.endsWith(PM_TARGET))next=transformPm(code);
      else if(file.endsWith(PROFILE_TARGET))next=transformProfile(code);
      else return null;
      if(next===code)return null;
      return {code:next,map:null};
    }
  };
}
