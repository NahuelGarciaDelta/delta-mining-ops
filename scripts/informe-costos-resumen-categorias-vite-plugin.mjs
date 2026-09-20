const TARGET = '/src/modules/informe-costos/InformeCostosView.jsx'

function replaceExactlyOnce(source, before, after, label) {
  const first = source.indexOf(before)
  if (first === -1) {
    throw new Error(`[informe-costos-resumen-categorias] No se encontró el bloque esperado: ${label}`)
  }
  if (source.indexOf(before, first + before.length) !== -1) {
    throw new Error(`[informe-costos-resumen-categorias] El bloque aparece más de una vez: ${label}`)
  }
  return source.slice(0, first) + after + source.slice(first + before.length)
}

export function informeCostosResumenCategoriasVitePlugin() {
  return {
    name: 'informe-costos-resumen-categorias',
    enforce: 'pre',
    transform(code, id) {
      const file = String(id || '').replace(/\\/g, '/')
      if (!file.endsWith(TARGET)) return null

      let next = code

      // La categoría efectiva que ya muestra Amortización es la fuente de verdad.
      // No descartar una fila válida sólo porque esa categoría provenga de un
      // fallback de Familia/Tipo y todavía no esté en la lista persistida.
      next = replaceExactlyOnce(
        next,
        '      if(!tipoLabel||!categoriasAmortizacionSet.has(tipoLabel))return null;',
        '      if(!tipoLabel)return null;',
        'filtro de categorías del resumen mensual'
      )

      // Mismo criterio para el resumen histórico: si la fila histórica ya resolvió
      // una categoría efectiva, debe conservarla. Se mantiene intacto el universo
      // histórico existente (DELTA + equipos con mantenimiento en el período).
      next = replaceExactlyOnce(
        next,
        '      if(!maquinaResumen||!categoriasAmortizacionSet.has(maquinaResumen))continue;',
        '      if(!maquinaResumen)continue;',
        'filtro de categorías del resumen histórico'
      )

      // El selector debe mostrar tanto las categorías configuradas como las que
      // realmente existen en la tabla de Amortización para el universo vigente.
      const oldOptions = `  const resumenTipoOptions=React.useMemo(()=>[\n    {value:"todos",label:"Todos los tipos"},\n    ...(categoriasAmortizacionDisponibles||[]).map(categoria=>({value:categoria,label:categoria}))\n  ],[categoriasAmortizacionDisponibles]);`

      const newOptions = `  const resumenTipoOptions=React.useMemo(()=>{\n    const categorias=[];\n    const seen=new Set();\n    [...(categoriasAmortizacionDisponibles||[]),...(resumenFiltroRows||[]).map(x=>x._resumenTipoValue)]\n      .map(normalizarCategoriaTexto)\n      .filter(Boolean)\n      .forEach(categoria=>{\n        if(seen.has(categoria))return;\n        seen.add(categoria);\n        categorias.push(categoria);\n      });\n    return [\n      {value:"todos",label:"Todos los tipos"},\n      ...categorias.map(categoria=>({value:categoria,label:categoria}))\n    ];\n  },[categoriasAmortizacionDisponibles,resumenFiltroRows,normalizarCategoriaTexto]);`

      next = replaceExactlyOnce(
        next,
        oldOptions,
        newOptions,
        'opciones de categorías de los resúmenes'
      )

      return { code: next, map: null }
    }
  }
}
