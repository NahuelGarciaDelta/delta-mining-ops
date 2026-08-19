const TARGET = '/src/modules/equipment/EquipmentProfileView.jsx'

export function equipmentProfileCodeHistoryVitePlugin() {
  return {
    name: 'delta-equipment-profile-code-history',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').endsWith(TARGET)) return null
      let out = code

      // SOLO Ficha Única: todos los identificadores declarados en la misma fila de
      // Lista Maestra forman un único grupo de identidad histórica. Esto incluye
      // Código nuevo, Código anterior/viejo, Código de Drusila, interno y variantes.
      // No se reescriben ni agrupan los registros fuente en ROP02/ROP05/RMA15.
      out = out.replace(
        'const MASTER_CODE_HEADERS=["Codigo nuevo","Código nuevo","Código de Drusila","Codigo de Drusila","Código Drusila","Codigo Drusila","Interno","Código interno","Codigo Int","Código viejo","Codigo viejo"];',
        'const MASTER_CODE_HEADERS=["Codigo nuevo","Código nuevo","CODIGO NUEVO","Código de Drusila","Codigo de Drusila","Código Drusila","Codigo Drusila","CODIGO DRUSILA","Interno","Código interno","Codigo interno","Codigo Int","Código Equipo","Codigo Equipo","Código viejo","Codigo viejo","CODIGO VIEJO","Código anterior","Codigo anterior","CODIGO ANTERIOR"];'
      )

      // El índice maestro original ya indexa todos los MASTER_CODE_HEADERS contra la
      // misma fila. A partir de cualquiera de esos códigos obtenemos la fila y luego
      // todo el conjunto de aliases de ese equipo físico.
      out = out.replace(
        '  const master=masterIndex.get(selectedKey)||selectedOption?.master||null;\n  const op=rop02Index.get(selectedKey)||[];\n  const prod=rop05Index.get(selectedKey)||[];\n  const mant=rma15Index.get(selectedKey)||[];\n  const pmReg=pmRegIndex.get(selectedKey)||[];',
        `  const master=masterIndex.get(selectedKey)||selectedOption?.master||null;\n  const profileAliasKeys=useMemo(()=>{\n    const keys=[];\n    const add=value=>{const k=canonicalEquipmentCode(value);if(k&&!keys.includes(k))keys.push(k);};\n    add(selectedKey);\n    if(master)codesOfMaster(master).forEach(add);\n    return keys;\n  },[master,selectedKey]);\n  const collectAliasRows=(index,sorter)=>{\n    const seen=new Set();\n    const rows=[];\n    for(const key of profileAliasKeys){\n      for(const row of index.get(key)||[]){\n        if(seen.has(row))continue;\n        seen.add(row);\n        rows.push(row);\n      }\n    }\n    return sorter?[...rows].sort(sorter):rows;\n  };\n  const op=useMemo(()=>collectAliasRows(rop02Index,(a,b)=>String(a.fecha||\"\").localeCompare(String(b.fecha||\"\"))),[rop02Index,profileAliasKeys]);\n  const prod=useMemo(()=>collectAliasRows(rop05Index),[rop05Index,profileAliasKeys]);\n  const mant=useMemo(()=>collectAliasRows(rma15Index,(a,b)=>String(b.fecha||\"\").localeCompare(String(a.fecha||\"\"))),[rma15Index,profileAliasKeys]);\n  const pmReg=useMemo(()=>collectAliasRows(pmRegIndex,(a,b)=>String(pick(b,[\"Fecha\",\"Fecha PM\"])||\"\").localeCompare(String(pick(a,[\"Fecha\",\"Fecha PM\"])||\"\"))),[pmRegIndex,profileAliasKeys]);`
      )

      out = out.replace(
        '    const cfg=pmCfgIndex.get(selectedKey)||{};',
        '    const cfg=profileAliasKeys.map(key=>pmCfgIndex.get(key)).find(Boolean)||{};'
      )
      out = out.replace(
        '  },[pmCfgIndex,selectedKey,pmReg,summary.currentH]);',
        '  },[pmCfgIndex,profileAliasKeys,pmReg,summary.currentH]);'
      )

      out = out.replace(
        '  const projectMovements=useMemo(()=>{\n    return mergeEquipmentMovements(op,movementIndex.get(selectedKey)||[],selectedKey);\n  },[op,movementIndex,selectedKey]);',
        `  const projectMovements=useMemo(()=>{\n    const persisted=[];\n    const seen=new Set();\n    for(const key of profileAliasKeys){\n      for(const movement of movementIndex.get(key)||[]){\n        const movementKey=movement?.id||[movement?.fecha,movement?.interno,movement?.desde,movement?.hasta,movement?.motivo].join('|');\n        if(seen.has(movementKey))continue;\n        seen.add(movementKey);\n        persisted.push(movement);\n      }\n    }\n    return mergeEquipmentMovements(op,persisted,selectedKey);\n  },[op,movementIndex,selectedKey,profileAliasKeys]);`
      )

      // Conservamos el código REAL de cada registro fuente. Ejemplo: una carga vieja
      // de TOP-0039 sigue viéndose TOP-0039 aunque la ficha esté consolidada con TOP-0067.
      out = out.replace(
        'interno:detailCode||sourceCode(r),proyecto:r.proyecto',
        'interno:sourceCode(r)||detailCode,proyecto:r.proyecto'
      )
      out = out.replace(
        'interno:detailCode||sourceCode(r),proyecto:r.proyecto,tarea:',
        'interno:sourceCode(r)||detailCode,proyecto:r.proyecto,tarea:'
      )

      return out === code ? null : { code: out, map: null }
    }
  }
}
