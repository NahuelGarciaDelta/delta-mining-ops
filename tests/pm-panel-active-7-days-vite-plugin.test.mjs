import test from 'node:test'
import assert from 'node:assert/strict'
import { pmPanelActive7DaysVitePlugin } from '../scripts/pm-panel-active-7-days-vite-plugin.mjs'

const source = `
function Demo(){
  const selected = (value, filter) => filter === ALL || (Array.isArray(filter) ? filter.includes(value) || filter.includes(ALL) : value === filter);
  const visibles = useMemo(() => equipos.filter(e => {
    if (!e.activo) return false;
    if (!selected(e.proyecto, proyectoFiltro)) return false;
    if (!selected(e.familia, tipoFiltro)) return false;
    if (!selected(e.interno, equipoFiltro)) return false;
    if (!selected(e.propiedad, propiedadFiltro)) return false;
    if (!selected(e.estado, estadoFiltro)) return false;
    return true;
  }), [equipos, proyectoFiltro, tipoFiltro, equipoFiltro, propiedadFiltro, estadoFiltro]);
  return <table><tbody>
    {visibles.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: "center", color: C?.textMuted }}>No hay equipos activos que coincidan con los filtros.</td></tr>}
    {visibles.map(e => <tr key={e.interno}><td>{e.interno}</td></tr>)}
  </tbody></table>
}
`

test('filtra sólo las filas del Panel de flota por actividad ROP02 de los últimos 7 días', () => {
  const plugin = pmPanelActive7DaysVitePlugin()
  const result = plugin.transform(source, 'C:/repo/src/modules/mantenimiento/MantenimientoProgramadoView.jsx')
  assert.ok(result?.code)
  assert.match(result.code, /const panelInternosActivos7Dias = useMemo/)
  assert.match(result.code, /corte\.setDate\(corte\.getDate\(\) - 7\)/)
  assert.match(result.code, /const panelVisibles = useMemo\(\(\) => visibles\.filter/)
  assert.match(result.code, /\{panelVisibles\.length === 0/)
  assert.match(result.code, /\{panelVisibles\.map\(e => <tr key=\{e\.interno\}>/)
})

test('no altera la lógica base de visibles usada por las demás pantallas', () => {
  const plugin = pmPanelActive7DaysVitePlugin()
  const result = plugin.transform(source, '/repo/src/modules/mantenimiento/MantenimientoProgramadoView.jsx')
  assert.match(result.code, /const visibles = useMemo\(\(\) => equipos\.filter/)
  assert.match(result.code, /\[equipos, proyectoFiltro, tipoFiltro, equipoFiltro, propiedadFiltro, estadoFiltro\]/)
})

test('no modifica archivos ajenos', () => {
  const plugin = pmPanelActive7DaysVitePlugin()
  assert.equal(plugin.transform(source, '/repo/src/App.jsx'), null)
})

test('falla explícitamente si cambia la estructura esperada', () => {
  const plugin = pmPanelActive7DaysVitePlugin()
  assert.throws(
    () => plugin.transform('const x=1', '/repo/src/modules/mantenimiento/MantenimientoProgramadoView.jsx'),
    /No se encontró el bloque esperado/
  )
})
