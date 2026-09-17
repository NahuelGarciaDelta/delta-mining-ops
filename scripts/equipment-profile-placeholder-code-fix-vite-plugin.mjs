const TARGET='/src/modules/equipment/EquipmentProfileView.jsx';

function requiredReplace(source,from,to,label){
  if(!source.includes(from))throw new Error(`[delta-equipment-profile-placeholder-code-fix] No se encontró el ancla requerida: ${label}`);
  return source.replace(from,to);
}

export function equipmentProfilePlaceholderCodeFixVitePlugin(){
  return{
    name:'delta-equipment-profile-placeholder-code-fix',
    enforce:'pre',
    transform(code,id){
      if(!String(id||'').replace(/\\/g,'/').endsWith(TARGET))return null;
      let out=code;

      // Nunca tratar guiones/placeholder como un interno real. Esto también limpia
      // sesiones viejas que hayan guardado "-" como dm_selected_equipment.
      out=requiredReplace(
        out,
        '  const [selected,setSelected]=useState(()=>cleanEquipmentCode(initialCode));',
        '  const [selected,setSelected]=useState(()=>canonicalEquipmentCode(initialCode)?cleanEquipmentCode(initialCode):"");',
        'estado inicial seleccionado'
      );
      out=requiredReplace(
        out,
        '  const [detailKey,setDetailKey]=useState(()=>canonicalEquipmentCode(initialCode));',
        '  const [detailKey,setDetailKey]=useState(()=>canonicalEquipmentCode(initialCode)||"");',
        'clave inicial de detalle'
      );
      out=requiredReplace(
        out,
        '  useEffect(()=>{\n    if(!initialCode)return;\n    const clean=cleanEquipmentCode(initialCode);\n    setSelected(clean);\n    setDetailKey(canonicalEquipmentCode(clean));\n  },[initialCode]);',
        '  useEffect(()=>{\n    const key=canonicalEquipmentCode(initialCode);\n    if(!key){\n      if(initialCode){try{sessionStorage.removeItem("dm_selected_equipment");}catch(_){}}\n      return;\n    }\n    const clean=cleanEquipmentCode(initialCode);\n    setSelected(clean);\n    setDetailKey(key);\n  },[initialCode]);',
        'sincronización de initialCode'
      );
      out=requiredReplace(
        out,
        '      if(selected)sessionStorage.setItem("dm_selected_equipment",cleanEquipmentCode(selected));',
        '      const stored=cleanEquipmentCode(selected);\n      if(stored&&canonicalEquipmentCode(stored))sessionStorage.setItem("dm_selected_equipment",stored);\n      else sessionStorage.removeItem("dm_selected_equipment");',
        'persistencia de selección válida'
      );

      const preferredPattern=/const preferredOf=row=>cleanEquipmentCode\(pick\(row\|\|\{\},\["Código nuevo","Codigo nuevo","CODIGO NUEVO"\]\)\|\|pick\(row\|\|\{\},\["Código de Drusila","Codigo de Drusila","Código Drusila","Codigo Drusila","CODIGO DRUSILA"\]\)\|\|codesOfMaster\(row\|\|\{\}\)\[0\]\|\|""\);/;
      if(!preferredPattern.test(out))throw new Error('[delta-equipment-profile-placeholder-code-fix] No se encontró preferredOf de identidad física');
      out=out.replace(preferredPattern,`const preferredOf=row=>{\n      const candidates=[\n        pick(row||{},["Código nuevo","Codigo nuevo","CODIGO NUEVO"]),\n        pick(row||{},["Código de Drusila","Codigo de Drusila","Código Drusila","Codigo Drusila","CODIGO DRUSILA"]),\n        ...codesOfMaster(row||{})\n      ];\n      const usable=candidates.find(value=>{\n        const cleaned=cleanEquipmentCode(value),key=canonicalEquipmentCode(cleaned);\n        return Boolean(cleaned&&key&&!['NA','SD','SINCODIGO','SININTERNO','NODISPONIBLE'].includes(key));\n      });\n      return cleanEquipmentCode(usable||'');\n    };`);

      if(!out.includes("const usable=candidates.find")||!out.includes('sessionStorage.removeItem("dm_selected_equipment")')){
        throw new Error('[delta-equipment-profile-placeholder-code-fix] Transformación incompleta');
      }
      return {code:out,map:null};
    }
  };
}
