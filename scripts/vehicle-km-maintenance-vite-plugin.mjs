const TARGET = '/src/modules/mantenimiento/MantenimientoProgramadoView.jsx'

function requiredReplace(source, from, to, label) {
  if (!source.includes(from)) {
    throw new Error(`[delta-vehicle-km-maintenance] No se encontró el ancla requerida: ${label}`)
  }
  return source.replace(from, to)
}

export function vehicleKmMaintenanceVitePlugin() {
  return {
    name: 'delta-vehicle-km-maintenance',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').endsWith(TARGET)) return null

      let out = code

      // IMPORTANTE: desde 2026-09 los CAMIONES se mantienen por HORÓMETRO cada 500 h.
      // Este helper sólo representa vehículos que continúan por kilometraje (camionetas).
      // Nunca usar prefijos de camión para decidir la unidad: la clasificación de camiones
      // proviene de Familia mediante esCamionPM/isCanonicalTruckFamily en el componente real.
      out = requiredReplace(
        out,
        'const DEFAULTS = Object.freeze({ intervalo: 250, alertaDesde: 200, atrasadoDesde: 350 });',
        `const DEFAULTS = Object.freeze({ intervalo: 250, alertaDesde: 200, atrasadoDesde: 350 });
const VEHICLE_DEFAULTS = Object.freeze({ intervalo: 8000, alertaDesde: 7000, atrasadoDesde: 8500 });
const isRoadVehicle = row => {
  const family = norm(row?.familia || row?.equipo || row?._tipo || '');
  const internal = norm(row?.interno || row?.maquina || row?._internoRaw || '');
  return family.includes('CAMIONETA') || internal.startsWith('CTA');
};
const unitFor = row => row?.unidadMantenimiento || row?.unidadMedida || (isRoadVehicle(row) ? 'km' : 'h');
const meterLabelFor = row => unitFor(row) === 'km' ? 'Kilometraje' : 'Horómetro';
const codeVariants = value => {
  const raw = text(value).toUpperCase().replace(/\\s*\\(.*?\\)/g, '').trim();
  if (!raw) return [];
  const compact = raw.replace(/[^A-Z0-9]/g, '');
  const match = compact.match(/^([A-Z]+)0*(\\d+)$/);
  const variants = new Set([norm(raw), compact]);
  if (match) {
    const prefix = match[1];
    const n = String(Number(match[2]));
    variants.add(prefix + n);
    variants.add(prefix + n.padStart(4, '0'));
  }
  return [...variants].filter(Boolean);
};
const activityForCode = (map, value) => {
  for (const key of codeVariants(value)) {
    const found = map.get(key);
    if (found) return found;
  }
  return null;
};`,
        'helpers de vehículo'
      )

      out = requiredReplace(
        out,
        'return { interno, equipo: [familia, marca, modelo].filter(Boolean).join(" — ") || interno, familia, marca, modelo, proyecto, propiedad };',
        `const codigos = uniq([
    interno,
    text(pick(row, ["Código nuevo", "Codigo nuevo", "CODIGO NUEVO", "Código Nuevo", "Codigo Nuevo"])),
    text(pick(row, ["Código Drusila", "Codigo Drusila", "Código de Drusila", "Codigo de Drusila", "Código viejo", "Codigo viejo", "Código anterior", "Codigo anterior"])),
    text(pick(row, ["Código interno", "Codigo interno", "Interno", "Interno Equipo", "Código Equipo", "Codigo Equipo"])),
    text(pick(row, ["Patente", "PATENTE", "Dominio", "DOMINIO"]))
  ]);
  return { interno, equipo: [familia, marca, modelo].filter(Boolean).join(" — ") || interno, familia, marca, modelo, proyecto, propiedad, codigos };`,
        'aliases de Lista Maestra'
      )

      // Los alias de un camión también deben quedar marcados como camión para que nunca
      // se tome kilometraje por error cuando ROP02 usa un código alternativo.
      out = requiredReplace(
        out,
        `      const key = norm(e.interno);
      if (key && esCamionPM(e)) set.add(key);`,
        `      if (esCamionPM(e)) {
        [e.interno, ...(e.codigos || [])].flatMap(codeVariants).forEach(key => { if (key) set.add(key); });
      }`,
        'aliases de camiones'
      )

      // Transformación atómica del bloque de actividad. Antes se reemplazaba sólo la
      // segunda mitad y quedaba "keys" sin declarar, causando el crash en producción.
      out = requiredReplace(
        out,
        `      const key = norm(ropInterno(row));
      if (!key) return;
      const horas = ropHoras(row, truckInternos.has(key));
      const proyecto = ropProyecto(row);
      const prev = map.get(key);
      if (!prev || fecha > prev.fecha || (fecha.getTime() === prev.fecha.getTime() && horas > prev.horas)) {
        map.set(key, { horas: Math.max(horas, prev?.horas || 0), fecha, proyecto: proyecto || prev?.proyecto || "" });
      } else if (horas > prev.horas) {
        map.set(key, { ...prev, horas });
      }`,
        `      const rawInterno = ropInterno(row);
      const keys = codeVariants(rawInterno);
      if (!keys.length) return;
      const esCamion = keys.some(key => truckInternos.has(key));
      const horas = ropHoras(row, esCamion);
      const proyecto = ropProyecto(row);
      const prev = keys.map(key => map.get(key)).find(Boolean);
      let next = prev;
      if (!prev || fecha > prev.fecha || (fecha.getTime() === prev.fecha.getTime() && horas > prev.horas)) {
        next = { horas: Math.max(horas, prev?.horas || 0), fecha, proyecto: proyecto || prev?.proyecto || "" };
      } else if (horas > prev.horas) {
        next = { ...prev, horas };
      }
      if (next) keys.forEach(key => map.set(key, next));`,
        'actividad ROP02 con aliases'
      )

      out = requiredReplace(
        out,
        '      const actividad = actividad7Dias.get(key);',
        '      const actividad = [e.interno, ...(e.codigos || [])].map(code => activityForCode(actividad7Dias, code)).find(Boolean);',
        'lookup de actividad por aliases'
      )

      out = requiredReplace(
        out,
        `      const cfg = configMap.get(key) || {};
      const pmEsCamion = esCamionPM(e);`,
        `      const cfg = configMap.get(key) || {};
      const pmEsCamion = esCamionPM(e);
      const pmEsCamioneta = isRoadVehicle(e);`,
        'clasificación PM camion/camioneta'
      )

      out = requiredReplace(
        out,
        `        pmEsCamion,
        intervalo: pmEsCamion ? TRUCK_PM_INTERVAL_HOURS : positiveOr(cfg.intervalo, DEFAULTS.intervalo),
        alertaDesde: pmEsCamion ? TRUCK_PM_ALERT_FROM_HOURS : positiveOr(cfg.alertaDesde, DEFAULTS.alertaDesde),
        atrasadoDesde: pmEsCamion ? TRUCK_PM_OVERDUE_FROM_HOURS : positiveOr(cfg.atrasadoDesde, DEFAULTS.atrasadoDesde),`,
        `        pmEsCamion,
        pmEsCamioneta,
        unidadMedida: pmEsCamioneta ? 'km' : 'h',
        unidadMantenimiento: pmEsCamioneta ? 'km' : 'h',
        intervalo: pmEsCamion ? TRUCK_PM_INTERVAL_HOURS : (pmEsCamioneta ? VEHICLE_DEFAULTS.intervalo : positiveOr(cfg.intervalo, DEFAULTS.intervalo)),
        alertaDesde: pmEsCamion ? TRUCK_PM_ALERT_FROM_HOURS : (pmEsCamioneta ? VEHICLE_DEFAULTS.alertaDesde : positiveOr(cfg.alertaDesde, DEFAULTS.alertaDesde)),
        atrasadoDesde: pmEsCamion ? TRUCK_PM_OVERDUE_FROM_HOURS : (pmEsCamioneta ? VEHICLE_DEFAULTS.atrasadoDesde : positiveOr(cfg.atrasadoDesde, DEFAULTS.atrasadoDesde)),`,
        'intervalos PM por familia'
      )

      // Camionetas presentes en ROP02 siguen entrando aunque el interno principal de Lista
      // Maestra sea otro alias. Los camiones NO pasan por este bloque: quedan en el flujo
      // canónico de Familia CAMIÓN y mantienen exclusivamente 500 horas.
      out = requiredReplace(
        out,
        `    });
    const rank = { "REVISAR DATOS": 0, "PM ATRASADO": 1, "PM URGENTE": 2, "PM PRÓXIMO": 3, "SIN BASE": 4, "AL DÍA": 5 };`,
        `    });

    const listaPM = (listaEquipos || []).map(equipoFromLista);
    const vehiculosRopVistos = new Set();
    (rop02All || []).forEach(row => {
      const internoRop = ropInterno(row);
      if (!internoRop || !isRoadVehicle({ interno: internoRop, maquina: internoRop, equipo: row?.equipo, familia: row?._tipo || row?.equipo })) return;
      const actividad = activityForCode(actividad7Dias, internoRop);
      if (!actividad) return;

      const aliasesRop = codeVariants(internoRop);
      const listaMatch = listaPM.find(item => {
        const aliasesLista = uniq([item.interno, ...(item.codigos || [])]).flatMap(codeVariants);
        return aliasesRop.some(alias => aliasesLista.includes(alias));
      });
      const internoFinal = listaMatch?.interno || internoRop;
      const keyFinal = norm(internoFinal);
      if (!keyFinal || seen.has(keyFinal) || vehiculosRopVistos.has(keyFinal)) return;
      vehiculosRopVistos.add(keyFinal);

      const familiaRop = text(row?._tipo || row?.equipo || 'CAMIONETA');
      const e = listaMatch || {
        interno: internoFinal,
        equipo: familiaRop || internoFinal,
        familia: familiaRop || 'CAMIONETA',
        marca: '',
        modelo: '',
        proyecto: actividad.proyecto || ropProyecto(row),
        propiedad: '',
      };
      const cfg = configMap.get(keyFinal) || {};
      base.push(statusFor({
        ...e,
        ...cfg,
        interno: internoFinal,
        equipo: e.equipo || familiaRop || internoFinal,
        familia: e.familia || familiaRop || 'CAMIONETA',
        marca: e.marca || '',
        modelo: e.modelo || '',
        proyecto: actividad.proyecto || cfg.proyecto || e.proyecto || ropProyecto(row),
        pmEsCamion: false,
        pmEsCamioneta: true,
        intervalo: VEHICLE_DEFAULTS.intervalo,
        alertaDesde: VEHICLE_DEFAULTS.alertaDesde,
        atrasadoDesde: VEHICLE_DEFAULTS.atrasadoDesde,
        unidadMedida: 'km',
        unidadMantenimiento: 'km',
        esVehiculo: true,
        horometroUltimoPM: num(cfg.horometroUltimoPM),
        horometroActual: actividad.horas,
        ultimaActividad: actividad.fecha.toISOString().slice(0, 10),
        activo: String(cfg.activo ?? 'SI').toUpperCase() !== 'NO',
      }));
    });

    const rank = { "REVISAR DATOS": 0, "PM ATRASADO": 1, "PM URGENTE": 2, "PM PRÓXIMO": 3, "SIN BASE": 4, "AL DÍA": 5 };`,
        'camionetas ROP02 fuera de alias principal'
      )

      // Ajustes visuales: unitFor devuelve km sólo para camionetas y h para camiones.
      out = out.replace('`PM programado vencido (${e.programado.fecha})`:`${e.estado}: ${fmt(e.faltan)} h faltantes`', '`PM programado vencido (${e.programado.fecha})`:`${e.estado}: ${fmt(e.faltan)} ${unitFor(e)} faltantes`')
      out = out.replace('if(d>0&&d<24) diffs.push(d);', 'if(d>0 && d < (isRoadVehicle({interno}) ? 2000 : 24)) diffs.push(d);')
      out = out.replace('Controlar el horómetro durante el turno y dejar recursos disponibles', 'Controlar la lectura durante el turno y dejar recursos disponibles')
      out = out.replace('HorometroActual:e.horometroActual,UltimoPM:e.horometroUltimoPM,HorasDesdePM:e.transcurridas,PromedioDia:e.promedioDia.toFixed(1)', 'Unidad:e.unidadMedida||unitFor(e),LecturaActual:e.horometroActual,UltimoPM:e.horometroUltimoPM,DesdePM:e.transcurridas,PromedioDia:e.promedioDia.toFixed(1)')
      out = out.replace('appAlert?.("Seleccioná un equipo e ingresá el horómetro del PM realizado.");', 'appAlert?.(`Seleccioná un equipo e ingresá el ${meterLabelFor(equipos.find(x=>x.interno===realizado.interno)).toLowerCase()} del PM realizado.`);')
      out = out.replace('`¿Registrar el PM como realizado a las ${fmt(realizado.horometro)} hs?`', '`¿Registrar el PM como realizado a ${fmt(realizado.horometro)} ${unitFor(equipos.find(x=>x.interno===realizado.interno))}?`')
      out = out.replace('"PM registrado. El próximo ciclo comienza desde ese horómetro."', '`PM registrado. El próximo ciclo comienza desde esa lectura (${unitFor(eq)}).`')
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
      out = out.replace('{e.intervalo}</td><td style={{ padding: 9 }}>{e.alertaDesde}</td><td style={{ padding: 9 }}>{e.atrasadoDesde}</td>', '{e.intervalo} {unitFor(e)}</td><td style={{ padding: 9 }}>{e.alertaDesde} {unitFor(e)}</td><td style={{ padding: 9 }}>{e.atrasadoDesde} {unitFor(e)}</td>')
      out = out.replace('<h3 style={{ marginTop: 0 }}>Configurar {edit.interno}</h3>', '<h3 style={{ marginTop: 0 }}>Configurar {edit.interno} · {unitFor(edit) === "km" ? "kilómetros" : "horas"}</h3>')

      return out === code ? null : { code: out, map: null }
    }
  }
}
