const TARGET = '/src/modules/equipment/EquipmentProfileView.jsx'

export function equipmentProfileCodeHistoryVitePlugin() {
  return {
    name: 'delta-equipment-profile-code-history',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').endsWith(TARGET)) return null
      let out = code

      // La columna Código anterior pertenece exclusivamente a la identidad histórica
      // de la Ficha Única. No altera ROP02, ROP05, RMA15 ni el resto de la app.
      out = out.replace(
        'const MASTER_CODE_HEADERS=["Codigo nuevo","Código nuevo","Código de Drusila","Codigo de Drusila","Código Drusila","Codigo Drusila","Interno","Código interno","Codigo Int","Código viejo","Codigo viejo"];',
        'const MASTER_CODE_HEADERS=["Codigo nuevo","Código nuevo","Código de Drusila","Codigo de Drusila","Código Drusila","Codigo Drusila","Interno","Código interno","Codigo Int","Código viejo","Codigo viejo","Código anterior","Codigo anterior","CODIGO ANTERIOR"];'
      )

      out = out.replace(
        '  const master=masterIndex.get(selectedKey)||selectedOption?.master||null;\n  const op=rop02Index.get(selectedKey)||[];\n  const prod=rop05Index.get(selectedKey)||[];\n  const mant=rma15Index.get(selectedKey)||[];\n  const pmReg=pmRegIndex.get(selectedKey)||[];',
        `  const master=masterIndex.get(selectedKey)||selectedOption?.master||null;\n  // Todos los códigos declarados en la misma fila de Lista Maestra representan\n  // el mismo equipo físico SOLO dentro de esta ficha. Ej.: TOP-0039 -> TOP-0067.\n  const profileAliasKeys=useMemo(()=>{\n    const keys=[];\n    const add=value=>{const k=canonicalEquipmentCode(value);if(k&&!keys.includes(k))keys.push(k);};\n    add(selectedKey);\n    if(master)codesOfMaster(master).forEach(add);\n    return keys;\n  },[master,selectedKey]);\n  const collectAliasRows=(index,sorter)=>{\n    const rows=profileAliasKeys.flatMap(key=>index.get(key)||[]);\n    return sorter?[...rows].sort(sorter):rows;\n  };\n  const op=useMemo(()=>collectAliasRows(rop02Index,(a,b)=>String(a.fecha||\"\").localeCompare(String(b.fecha||\"\"))),[rop02Index,profileAliasKeys]);\n  const prod=useMemo(()=>collectAliasRows(rop05Index),[rop05Index,profileAliasKeys]);\n  const mant=useMemo(()=>collectAliasRows(rma15Index,(a,b)=>String(b.fecha||\"\").localeCompare(String(a.fecha||\"\"))),[rma15Index,profileAliasKeys]);\n  const pmReg=useMemo(()=>collectAliasRows(pmRegIndex,(a,b)=>String(pick(b,[\"Fecha\",\"Fecha PM\"])||\"\").localeCompare(String(pick(a,[\"Fecha\",\"Fecha PM\"])||\"\"))),[pmRegIndex,profileAliasKeys]);`
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
        `  const projectMovements=useMemo(()=>{\n    const persisted=profileAliasKeys.flatMap(key=>movementIndex.get(key)||[]);\n    return mergeEquipmentMovements(op,persisted,selectedKey);\n  },[op,movementIndex,selectedKey,profileAliasKeys]);`
      )

      // En las tablas de origen se conserva SIEMPRE el código con el que fue cargado
      // cada registro. La asociación histórica sólo ocurre al armar la ficha.
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
