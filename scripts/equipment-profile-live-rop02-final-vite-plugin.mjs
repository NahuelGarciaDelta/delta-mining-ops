const TARGET='/src/modules/equipment/EquipmentProfileView.jsx';

export function equipmentProfileLiveRop02FinalVitePlugin(){
  return{
    name:'delta-equipment-profile-live-rop02-final',
    enforce:'pre',
    transform(code,id){
      if(!String(id||'').replace(/\\/g,'/').endsWith(TARGET))return null;
      let out=code;

      if(!out.includes('fetchDatasetQuery')||!out.includes('normalizeROP02')||!out.includes('const [liveRop02,setLiveRop02]=useState([]);')){
        throw new Error('[delta-equipment-profile-live-rop02-final] Falta infraestructura de consulta puntual ROP02');
      }

      const opPattern=/  const op=useMemo\(\(\)=>collectAliasRows\(rop02Index,\(a,b\)=>String\(a\.fecha\|\|""\)\.localeCompare\(String\(b\.fecha\|\|""\)\)\),\[rop02Index,profileAliasKeys\]\);/;
      if(!opPattern.test(out)){
        throw new Error('[delta-equipment-profile-live-rop02-final] No se encontró el armado final de op en Ficha Única');
      }

      out=out.replace(opPattern,`  const profileQueryCodes=useMemo(()=>{\n    const values=[];\n    const add=value=>{\n      const raw=String(value||\"\").trim();\n      const key=canonicalEquipmentCode(raw);\n      if(!raw||!key)return;\n      const push=v=>{const text=String(v||\"\").trim();if(text&&!values.includes(text))values.push(text);};\n      push(raw);\n      push(cleanEquipmentCode(raw));\n      push(key);\n      const match=key.match(/^([A-Z]+)(\\d+)$/);\n      if(match){const digits=match[2].padStart(4,\"0\");push(match[1]+digits);push(match[1]+\"-\"+digits);}\n    };\n    add(selectedPreferred);\n    add(selectedOption?.value);\n    add(selectedKey);\n    (selectedOption?.aliases||[]).forEach(add);\n    if(master)codesOfMaster(master).forEach(add);\n    return values;\n  },[selectedPreferred,selectedOption,selectedKey,master]);\n  const profileQueryKey=profileQueryCodes.join(\"|\");\n  useEffect(()=>{\n    let cancelled=false;\n    if(!selectedKey||!profileQueryCodes.length){setLiveRop02([]);return()=>{cancelled=true;};}\n    fetchDatasetQuery(APPS_SCRIPT_URL,{dataset:\"rop02\",equipo:profileQueryCodes,limit:\"all\",sortBy:\"fecha\",sortDirection:\"asc\"})\n      .then(result=>{\n        if(cancelled)return;\n        const allowed=new Set(profileAliasKeys);\n        const normalized=normalizeROP02(Array.isArray(result?.data)?result.data:[],\"\")\n          .filter(row=>allowed.has(canonicalEquipmentCode(sourceCode(row))));\n        setLiveRop02(normalized);\n      })\n      .catch(error=>{\n        if(cancelled)return;\n        console.warn(\"No se pudo cargar ROP02 puntual de Ficha Única\",error);\n        setLiveRop02([]);\n      });\n    return()=>{cancelled=true;};\n  },[selectedKey,profileQueryKey]);\n  const op=useMemo(()=>{\n    const rows=collectAliasRows(rop02Index,(a,b)=>String(a.fecha||\"\").localeCompare(String(b.fecha||\"\")));\n    const allowed=new Set(profileAliasKeys);\n    const merged=new Map();\n    const add=(row,index)=>{\n      if(!allowed.has(canonicalEquipmentCode(sourceCode(row))))return;\n      const identity=String(row?._sourceKey||row?._sourceRow||[row?.fecha,row?.turno,row?.parte,sourceCode(row),index].join(\"|\"));\n      merged.set(identity,row);\n    };\n    rows.forEach(add);\n    liveRop02.forEach(add);\n    return [...merged.values()].sort((a,b)=>String(a?.fecha||\"\").localeCompare(String(b?.fecha||\"\"))||String(a?.turno||\"\").localeCompare(String(b?.turno||\"\")));\n  },[rop02Index,profileAliasKeys,liveRop02]);`);

      if(!out.includes('const profileQueryCodes=useMemo')||!out.includes('liveRop02.forEach(add)')){
        throw new Error('[delta-equipment-profile-live-rop02-final] Transformación incompleta');
      }
      return {code:out,map:null};
    }
  };
}
