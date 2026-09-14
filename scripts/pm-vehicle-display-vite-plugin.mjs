const TARGET = '/src/modules/mantenimiento/MantenimientoProgramadoView.jsx'

function requiredReplace(source, from, to, label) {
  if (!source.includes(from)) {
    throw new Error(`[delta-pm-vehicle-display] No se encontró el ancla requerida: ${label}`)
  }
  return source.replace(from, to)
}

export function pmVehicleDisplayVitePlugin() {
  return {
    name: 'delta-pm-vehicle-display',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').endsWith(TARGET)) return null

      let out = code

      // Este plugin corre DESPUÉS de vehicle-km-maintenance. Todo reemplazo que
      // agregue variables usadas luego debe ser obligatorio: nunca publicar un
      // bundle parcialmente transformado con identificadores sin declarar.
      out = requiredReplace(
        out,
        'return { interno, equipo: [familia, marca, modelo].filter(Boolean).join(" — ") || interno, familia, marca, modelo, proyecto, propiedad, codigos };',
        `return {\n    interno,\n    equipo: [familia, marca, modelo].filter(Boolean).join(" — ") || interno,\n    familia, marca, modelo, proyecto, propiedad, codigos,\n    codigoNuevo: text(pick(row, ["Código nuevo", "Codigo nuevo", "CODIGO NUEVO", "Código Nuevo", "Codigo Nuevo"])),\n    codigoDrusila: text(pick(row, ["Código Drusila", "Codigo Drusila", "Código de Drusila", "Codigo de Drusila", "Código viejo", "Codigo viejo", "Código anterior", "Codigo anterior", "Patente", "PATENTE", "Dominio", "DOMINIO"]))\n  };`,
        'metadatos de códigos de Lista Maestra'
      )

      // Las camionetas no se agregan desde Lista Maestra: ROP02 define el interno
      // operativo. Los camiones no pasan por este bloque y siguen por horómetro/500 h.
      out = requiredReplace(
        out,
        'if (!key || seen.has(key) || !actividad) return;',
        'if (!key || seen.has(key) || !actividad || isRoadVehicle(e)) return;',
        'exclusión de camionetas del flujo base'
      )

      out = requiredReplace(
        out,
        'const internoFinal = listaMatch?.interno || internoRop;',
        'const internoFinal = internoRop;',
        'interno canónico de camioneta desde ROP02'
      )

      out = requiredReplace(
        out,
        'const cfg = configMap.get(keyFinal) || {};',
        'const cfg = configMap.get(keyFinal) || configMap.get(norm(listaMatch?.codigoNuevo)) || configMap.get(norm(listaMatch?.interno)) || configMap.get(norm(listaMatch?.codigoDrusila)) || {};',
        'configuración por aliases'
      )

      // vehicle-km-maintenance actualmente inyecta CAMIONETA como fallback.
      // Antes este plugin esperaba VEHÍCULO; esa divergencia hizo que no se declarara
      // internoDisplay aunque sí se inyectara su uso, generando el crash de runtime.
      out = requiredReplace(
        out,
        "const familiaRop = text(row?._tipo || row?.equipo || 'CAMIONETA');",
        `const familiaRop = text(row?._tipo || row?.equipo || 'CAMIONETA');\n      const patente = text(listaMatch?.codigoDrusila || '');\n      const internoDisplay = patente && norm(patente) !== norm(internoRop) ? \`${'${internoRop} (${patente})'}\` : internoRop;`,
        'declaración de internoDisplay y patente'
      )

      out = requiredReplace(
        out,
        "        interno: internoFinal,\n        equipo: e.equipo || familiaRop || internoFinal,",
        "        interno: internoFinal,\n        internoDisplay,\n        patente,\n        equipo: e.equipo || familiaRop || internoFinal,",
        'uso de internoDisplay en fila de camioneta'
      )

      // Helper visual: el valor lógico continúa siendo el interno de ROP02.
      out = requiredReplace(
        out,
        'const proyectos = useMemo(() => uniq(equipos.map(e => e.proyecto)).sort(), [equipos]);',
        `const displayInterno = row => row?.internoDisplay || row?.interno || '';\n  const proyectos = useMemo(() => uniq(equipos.map(e => e.proyecto)).sort(), [equipos]);`,
        'helper displayInterno'
      )

      // Estos reemplazos son decorativos; si cambia una vista no deben romper el build.
      out = out.replace(
        '...internos.map(v => ({ value: v, label: v }))',
        '...internos.map(v => ({ value: v, label: displayInterno(equipos.find(e => e.interno === v)) || v }))'
      )
      out = out.split('>{e.interno}</td>').join('>{displayInterno(e)}</td>')
      out = out.split('>{e.interno}</option>').join('>{displayInterno(e)}</option>')
      out = out.split('[x.interno,x.transcurridas').join('[displayInterno(x),x.transcurridas')
      out = out.split('[x.interno,x.proyMax').join('[displayInterno(x),x.proyMax')

      // Guardia final contra el mismo tipo de falla de runtime.
      const declaration = out.indexOf('const internoDisplay =')
      const objectUse = out.indexOf('\n        internoDisplay,')
      const displayHelper = out.indexOf('const displayInterno = row =>')
      if (declaration < 0 || objectUse < declaration || displayHelper < 0) {
        throw new Error('[delta-pm-vehicle-display] Transformación incompleta: internoDisplay/displayInterno no quedó correctamente declarado antes de usarse')
      }

      return out === code ? null : { code: out, map: null }
    }
  }
}
