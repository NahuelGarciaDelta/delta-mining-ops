const TARGET = '/src/modules/mantenimiento/MantenimientoProgramadoView.jsx'

function replaceExactlyOnce(source, before, after, label) {
  const first = source.indexOf(before)
  if (first === -1) throw new Error(`[pm-panel-active-7-days] No se encontró el bloque esperado: ${label}`)
  if (source.indexOf(before, first + before.length) !== -1) {
    throw new Error(`[pm-panel-active-7-days] El bloque aparece más de una vez: ${label}`)
  }
  return source.slice(0, first) + after + source.slice(first + before.length)
}

export function pmPanelActive7DaysVitePlugin() {
  return {
    name: 'pm-panel-active-7-days',
    enforce: 'pre',
    transform(code, id) {
      const file = String(id || '').replace(/\\/g, '/')
      if (!file.endsWith(TARGET)) return null

      let next = code

      const anchor = `  const selected = (value, filter) => filter === ALL || (Array.isArray(filter) ? filter.includes(value) || filter.includes(ALL) : value === filter);`
      const injected = `  const panelInternosActivos7Dias = useMemo(() => {\n    const filas = (rop02All || []).map(row => ({ row, fecha: ropFecha(row) })).filter(x => x.fecha);\n    if (!filas.length) return new Set();\n    const referencia = new Date(Math.max(...filas.map(x => x.fecha.getTime())));\n    referencia.setHours(23, 59, 59, 999);\n    const corte = new Date(referencia);\n    corte.setHours(0, 0, 0, 0);\n    corte.setDate(corte.getDate() - 7);\n    const activos = new Set();\n    filas.forEach(({ row, fecha }) => {\n      if (fecha < corte || fecha > referencia) return;\n      const key = norm(ropInterno(row));\n      if (key) activos.add(key);\n    });\n    return activos;\n  }, [rop02All]);\n\n${anchor}`
      next = replaceExactlyOnce(next, anchor, injected, 'universo reciente del Panel de flota')

      const visiblesBlock = `  const visibles = useMemo(() => equipos.filter(e => {\n    if (!e.activo) return false;\n    if (!selected(e.proyecto, proyectoFiltro)) return false;\n    if (!selected(e.familia, tipoFiltro)) return false;\n    if (!selected(e.interno, equipoFiltro)) return false;\n    if (!selected(e.propiedad, propiedadFiltro)) return false;\n    if (!selected(e.estado, estadoFiltro)) return false;\n    return true;\n  }), [equipos, proyectoFiltro, tipoFiltro, equipoFiltro, propiedadFiltro, estadoFiltro]);`
      const visiblesWithPanel = `${visiblesBlock}\n\n  const panelVisibles = useMemo(() => visibles.filter(e => panelInternosActivos7Dias.has(norm(e.interno))), [visibles, panelInternosActivos7Dias]);`
      next = replaceExactlyOnce(next, visiblesBlock, visiblesWithPanel, 'filtro visible del Panel de flota')

      next = replaceExactlyOnce(
        next,
        `{visibles.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: "center", color: C?.textMuted }}>No hay equipos activos que coincidan con los filtros.</td></tr>}`,
        `{panelVisibles.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: "center", color: C?.textMuted }}>No hay equipos activos que coincidan con los filtros.</td></tr>}`,
        'estado vacío de la tabla Panel de flota'
      )

      next = replaceExactlyOnce(
        next,
        `{visibles.map(e => <tr key={e.interno}>`,
        `{panelVisibles.map(e => <tr key={e.interno}>`,
        'filas de la tabla Panel de flota'
      )

      return { code: next, map: null }
    }
  }
}
