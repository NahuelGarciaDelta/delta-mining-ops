const TARGET = '/src/modules/mantenimiento/MantenimientoProgramadoView.jsx'

export function vehicleKmMaintenanceVitePlugin() {
  return {
    name: 'delta-vehicle-km-maintenance',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').endsWith(TARGET)) return null

      let out = code

      out = out.replace(
        'const DEFAULTS = Object.freeze({ intervalo: 250, alertaDesde: 200, atrasadoDesde: 350 });',
        `const DEFAULTS = Object.freeze({ intervalo: 250, alertaDesde: 200, atrasadoDesde: 350 });\nconst VEHICLE_DEFAULTS = Object.freeze({ intervalo: 8000, alertaDesde: 7000, atrasadoDesde: 8500 });\nconst isRoadVehicle = row => {\n  const family = norm(row?.familia || row?.equipo || '');\n  const internal = norm(row?.interno || '');\n  return family.includes('CAMIONETA') || family.includes('CAMION') || internal.startsWith('CAV') || internal.startsWith('CAC') || internal.startsWith('CAR') || internal.startsWith('CAA');\n};\nconst unitFor = row => isRoadVehicle(row) ? 'km' : 'h';\nconst meterLabelFor = row => isRoadVehicle(row) ? 'Kilometraje' : 'Horómetro';\nconst codeVariants = value => {\n  const raw = text(value).toUpperCase().replace(/\\s*\\(.*?\\)/g, '').trim();\n  if (!raw) return [];\n  const compact = raw.replace(/[^A-Z0-9]/g, '');\n  const match = compact.match(/^([A-Z]+)0*(\\d+)$/);\n  const variants = new Set([norm(raw), compact]);\n  if (match) {\n    const prefix = match[1];\n    const n = String(Number(match[2]));\n    variants.add(prefix + n);\n    variants.add(prefix + n.padStart(4, '0'));\n  }\n  return [...variants].filter(Boolean);\n};\nconst activityForCode = (map, value) => {\n  for (const key of codeVariants(value)) {\n    const found = map.get(key);\n    if (found) return found;\n  }\n  return null;\n};`
      )

      // ROP02 y Lista Maestra no siempre escriben igual el interno (CAV-81 / CAV-0081 / CAV0081).
      // Indexamos todas las variantes para que camiones/camionetas con actividad entren al PM.
      out = out.replace(
        'const key = norm(ropInterno(row));\n      if (!key) return;\n      const horas = ropHoras(row);',
        `const rawInterno = ropInterno(row);\n      const keys = codeVariants(rawInterno);\n      if (!keys.length) return;\n      const horas = ropHoras(row);`
      )
      out = out.replace(
        'const prev = map.get(key);\n      if (!prev || fecha > prev.fecha || (fecha.getTime() === prev.fecha.getTime() && horas > prev.horas)) {\n        map.set(key, { horas: Math.max(horas, prev?.horas || 0), fecha, proyecto: proyecto || prev?.proyecto || "" });\n      } else if (horas > prev.horas) {\n        map.set(key, { ...prev, horas });\n      }',
        `const prev = keys.map(k => map.get(k)).find(Boolean);\n      let next = prev;\n      if (!prev || fecha > prev.fecha || (fecha.getTime() === prev.fecha.getTime() && horas > prev.horas)) {\n        next = { horas: Math.max(horas, prev?.horas || 0), fecha, proyecto: proyecto || prev?.proyecto || "" };\n      } else if (horas > prev.horas) {\n        next = { ...prev, horas };\n      }\n      if (next) keys.forEach(k => map.set(k, next));`
      )
      out = out.replace('const actividad = actividad7Dias.get(key);', 'const actividad = activityForCode(actividad7Dias, e.interno);')

      out = out.replace(
        'const cfg = configMap.get(key) || {};\n      base.push(statusFor({',
        `const cfg = configMap.get(key) || {};\n      const vehicle = isRoadVehicle(e);\n      const defaults = vehicle ? VEHICLE_DEFAULTS : DEFAULTS;\n      base.push(statusFor({`
      )
      out = out.replace(
        'intervalo: num(cfg.intervalo) || DEFAULTS.intervalo,\n        alertaDesde: num(cfg.alertaDesde) || DEFAULTS.alertaDesde,\n        atrasadoDesde: num(cfg.atrasadoDesde) || DEFAULTS.atrasadoDesde,',
        `intervalo: vehicle ? VEHICLE_DEFAULTS.intervalo : (num(cfg.intervalo) || defaults.intervalo),\n        alertaDesde: vehicle ? VEHICLE_DEFAULTS.alertaDesde : (num(cfg.alertaDesde) || defaults.alertaDesde),\n        atrasadoDesde: vehicle ? VEHICLE_DEFAULTS.atrasadoDesde : (num(cfg.atrasadoDesde) || defaults.atrasadoDesde),\n        unidadMedida: vehicle ? 'km' : 'h',\n        esVehiculo: vehicle,`
      )

      out = out.replace('`PM programado vencido (${e.programado.fecha})`:`${e.estado}: ${fmt(e.faltan)} h faltantes`', '`PM programado vencido (${e.programado.fecha})`:`${e.estado}: ${fmt(e.faltan)} ${unitFor(e)} faltantes`')
      out = out.replace('if(d>0&&d<24) diffs.push(d);', 'if(d>0 && d < (isRoadVehicle({interno}) ? 2000 : 24)) diffs.push(d);')
      out = out.replace(
        'const min = x.transcurridas + 80;\n        const max = x.transcurridas + 120;',
        `const projectedUse = isRoadVehicle(x) ? { min: 1200, max: 2000 } : { min: 80, max: 120 };\n        const min = x.transcurridas + projectedUse.min;\n        const max = x.transcurridas + projectedUse.max;`
      )
      out = out.replace('Controlar el horómetro durante el turno y dejar recursos disponibles', 'Controlar el kilometraje/horómetro durante el turno y dejar recursos disponibles')
      out = out.replace(
        'HorometroActual:e.horometroActual,UltimoPM:e.horometroUltimoPM,HorasDesdePM:e.transcurridas,PromedioDia:e.promedioDia.toFixed(1)',
        'Unidad:e.unidadMedida||unitFor(e),LecturaActual:e.horometroActual,UltimoPM:e.horometroUltimoPM,DesdePM:e.transcurridas,PromedioDia:e.promedioDia.toFixed(1)'
      )
      out = out.replace('appAlert?.("Seleccioná un equipo e ingresá el horómetro del PM realizado.");', 'appAlert?.(`Seleccioná un equipo e ingresá el ${isRoadVehicle(equipos.find(x=>x.interno===realizado.interno)) ? "kilometraje" : "horómetro"} del PM realizado.`);')
      out = out.replace('`¿Registrar el PM como realizado a las ${fmt(realizado.horometro)} hs?`', '`¿Registrar el PM como realizado a ${fmt(realizado.horometro)} ${unitFor(equipos.find(x=>x.interno===realizado.interno))}?`')
      out = out.replace('"PM registrado. El próximo ciclo comienza desde ese horómetro."', '`PM registrado. El próximo ciclo comienza desde ese ${isRoadVehicle(eq) ? "kilometraje" : "horómetro"}.`')
      out = out.replace('setRealizado(r => ({ ...r, interno: e.target.value, horometro: eq ? String(eq.horometroActual || "") : "" }))', 'setRealizado(r => ({ ...r, interno: e.target.value, horometro: eq ? String(eq.horometroActual || "") : "", tipoPM: eq && isRoadVehicle(eq) ? "PM 8000" : "PM 250" }))')

      const labels = [
        ['"Horómetro actual"', '"Lectura actual"'], ['"Horómetro último PM"', '"Lectura último PM"'], ['"Hs desde PM"', '"Desde PM"'],
        ['"Hs actuales desde PM"', '"Lectura desde PM"'], ['"Promedio h/día"', '"Promedio/día"'], ['"Horas faltantes"', '"Faltante"'],
        ['"Horómetro ROP02"', '"Lectura ROP02"'], ['"Horómetro"', '"Lectura"'], ['"Horómetro al realizar PM"', '"Lectura al realizar PM"'],
        ['"Horómetro del último PM"', '"Lectura del último PM"'], ['"Promedio de horas entre PM"', '"Promedio entre PM"'], ['"Horas desde el último PM por equipo"', '"Uso desde el último PM por equipo"']
      ]
      for (const [from, to] of labels) out = out.split(from).join(to)

      out = out.replace('{fmt(e.horometroActual)}</td><td style={tableCell}>{fmt(e.horometroUltimoPM)}</td><td style={{...tableCell,fontWeight:900}}>{fmt(e.transcurridas)}</td><td style={tableCell}>{fmt(e.proximoPM)}</td>', '{fmt(e.horometroActual)} {unitFor(e)}</td><td style={tableCell}>{fmt(e.horometroUltimoPM)} {unitFor(e)}</td><td style={{...tableCell,fontWeight:900}}>{fmt(e.transcurridas)} {unitFor(e)}</td><td style={tableCell}>{fmt(e.proximoPM)} {unitFor(e)}</td>')
      out = out.replace('`${fmt(e.transcurridas-e.atrasadoDesde)} h atraso`:`Faltan ${fmt(e.atrasadoDesde-e.transcurridas)} h`', '`${fmt(e.transcurridas-e.atrasadoDesde)} ${unitFor(e)} atraso`:`Faltan ${fmt(e.atrasadoDesde-e.transcurridas)} ${unitFor(e)}`')
      out = out.replace('e.promedioDia?`${fmt(e.promedioDia)} h/día`:"Sin datos"', 'e.promedioDia?`${fmt(e.promedioDia)} ${unitFor(e)}/día`:"Sin datos"')
      out = out.replace('{fmt(e.horometroActual)}</td><td style={{ padding: 9 }}>{e.horometroUltimoPM ? fmt(e.horometroUltimoPM) : "Sin cargar"}</td><td style={{ padding: 9, fontWeight: 700 }}>{e.horometroUltimoPM ? fmt(e.transcurridas) : "—"}</td><td style={{ padding: 9 }}>{e.proximoPM ? fmt(e.proximoPM) : "—"}</td>', '{fmt(e.horometroActual)} {unitFor(e)}</td><td style={{ padding: 9 }}>{e.horometroUltimoPM ? `${fmt(e.horometroUltimoPM)} ${unitFor(e)}` : "Sin cargar"}</td><td style={{ padding: 9, fontWeight: 700 }}>{e.horometroUltimoPM ? `${fmt(e.transcurridas)} ${unitFor(e)}` : "—"}</td><td style={{ padding: 9 }}>{e.proximoPM ? `${fmt(e.proximoPM)} ${unitFor(e)}` : "—"}</td>')
      out = out.replace('{e.intervalo}</td><td style={{ padding: 9 }}>{e.alertaDesde}</td><td style={{ padding: 9 }}>{e.atrasadoDesde}</td>', '{e.intervalo} {unitFor(e)}</td><td style={{ padding: 9 }}>{e.alertaDesde} {unitFor(e)}</td><td style={{ padding: 9 }}>{e.atrasadoDesde} {unitFor(e)}</td>')
      out = out.replace('<h3 style={{ marginTop: 0 }}>Configurar {edit.interno}</h3>', '<h3 style={{ marginTop: 0 }}>Configurar {edit.interno} · {isRoadVehicle(edit) ? "kilómetros" : "horas"}</h3>')

      return out === code ? null : { code: out, map: null }
    }
  }
}
