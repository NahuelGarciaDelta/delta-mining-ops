const VIEW_TARGET = '/src/modules/mantenimiento/MantenimientoProgramadoView.jsx'
const APP_TARGET = '/src/App.jsx'

export function pmVehicleScopeVitePlugin() {
  return {
    name: 'delta-pm-vehicle-scope',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.replace(/\\/g, '/')
      let out = code

      // Repuestos deja de ser una subpestaña de Mantenimiento Programado.
      if (cleanId.endsWith(APP_TARGET)) {
        out = out.replace(/\s*\{id:\"pmRepuestos\",icon:\"package\",label:\"Repuestos\"\},?/, '')
        return out === code ? null : { code: out, map: null }
      }

      if (!cleanId.endsWith(VIEW_TARGET)) return null

      // ROP02 es la única fuente para decidir qué unidades participan del PM en el período.
      // Se amplían las variantes de kilometraje para que camionetas/camiones no queden afuera
      // por usar nombres de columna distintos a los horómetros de maquinaria.
      out = out.replace(
        'num(pick(row, ["hf", "horometro final", "horómetro final", "km final", "kilometraje final"])),',
        'num(pick(row, ["hf", "horometro final", "horómetro final", "km final", "kilometraje final", "kilometraje", "km", "odometro", "odómetro", "kilometros", "kilómetros", "lectura final"])),')
      out = out.replace(
        'num(pick(row, ["hi", "horometro inicial", "horómetro inicial"])),',
        'num(pick(row, ["hi", "horometro inicial", "horómetro inicial", "km inicial", "kilometraje inicial", "odometro inicial", "odómetro inicial", "lectura inicial"])),')

      // El selector de Registrar realizado usa exactamente el mismo universo `equipos` que
      // Dashboard, Planificador, Programación, Panel, Gestión, Configuración e Historial.
      // Por lo tanto sólo aparecen máquinas/vehículos con actividad ROP02 en el período.
      out = out.replace(
        'setRealizado(r => ({ ...r, interno: e.target.value, horometro: eq ? String(eq.horometroActual || "") : "" }))',
        'setRealizado(r => ({ ...r, interno: e.target.value, horometro: eq ? String(eq.horometroActual || "") : "", tipoPM: eq && isRoadVehicle(eq) ? "PM 8000" : "PM 250" }))')

      // Si se llega con el botón Realizado desde Panel, también asignar el tipo correcto.
      out = out.replace(
        'setRealizado(r => ({ ...r, interno: e.interno, horometro: String(e.horometroActual || "") }))',
        'setRealizado(r => ({ ...r, interno: e.interno, horometro: String(e.horometroActual || ""), tipoPM: isRoadVehicle(e) ? "PM 8000" : "PM 250" }))')

      // Quitar la vista de Repuestos y su participación en el refresco. Se conserva la
      // compatibilidad de datos del backend para no romper instalaciones existentes.
      out = out.replace(',"pmRepuestos"', '')
      out = out.replace(/\n\s*\{tab === \"repuestos\" && <div[\s\S]*?\n\s*<\/div>\}\n\n\s*\{tab === \"gestion\"/, '\n\n    {tab === "gestion"')

      // Gestión ya no muestra un KPI dependiente de la pestaña eliminada.
      out = out.replace(/<StatCard label=\"Disponibilidad repuestos\"[\s\S]*?\/>/, '')

      // Textos de criterio: no limitar conceptualmente a maquinaria. El criterio es actividad ROP02.
      out = out.replace('La lista contiene únicamente equipos activos en ROP02 durante los últimos 7 días.', 'La lista contiene únicamente equipos y vehículos con actividad ROP02 dentro del período seleccionado.')

      return out === code ? null : { code: out, map: null }
    }
  }
}
