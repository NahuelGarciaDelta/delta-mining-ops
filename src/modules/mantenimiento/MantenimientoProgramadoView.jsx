import React, { useCallback, useEffect, useMemo, useState } from "react";
import { APPS_SCRIPT_URL as DEFAULT_APPS_SCRIPT_URL } from "../../config/app.js";
import { PM_INITIAL_SEED } from "./pmInitialSeed.js";
import { rangoTurnoPorFecha } from "../analytics/OperationalAnalytics.jsx";

const DEFAULTS = Object.freeze({ intervalo: 250, alertaDesde: 200, atrasadoDesde: 350 });
const ALL = "todos";

const norm = v => String(v ?? "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]+/g, "").trim();
const text = v => String(v ?? "").trim();
const num = v => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const raw = String(v ?? "").trim();
  if (!raw) return 0;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = days => { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString().slice(0, 10); };
const fmt = v => Number(v || 0).toLocaleString("es-AR", { maximumFractionDigits: 1 });
const uniq = values => [...new Set((values || []).filter(Boolean))];
const marcaModelo = equipo => {
  const parts = String(equipo || "").split(/\s+[—–-]\s+/).map(x => x.trim()).filter(Boolean);
  if (parts.length >= 3) return parts.slice(-2).join(" — ");
  if (parts.length === 2) return parts.join(" — ");
  return parts[0] || "—";
};

function pick(row, candidates) {
  const entries = Object.entries(row || {});
  const wanted = candidates.map(x => norm(x));
  for (const [k, v] of entries) if (wanted.includes(norm(k)) && text(v) !== "") return v;
  for (const [k, v] of entries) {
    const nk = norm(k);
    if (wanted.some(w => nk.includes(w) || w.includes(nk))) return v;
  }
  return "";
}

function parseDateValue(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const raw = text(value);
  if (!raw) return null;
  let m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})/);
  if (m) {
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    return new Date(year, Number(m[2]) - 1, Number(m[1]));
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sevenDaysAgoStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 6);
  return d;
}

function equipoFromLista(row) {
  const interno = text(pick(row, ["Codigo nuevo", "Código nuevo", "Código de Drusila", "Codigo de Drusila", "Interno", "Código interno", "Codigo interno"]));
  const familia = text(pick(row, ["Familia", "Tipo equipo", "Tipo de equipo", "Equipo"]));
  const marca = text(pick(row, ["Marca"]));
  const modelo = text(pick(row, ["Modelo"]));
  const proyecto = text(pick(row, ["Proyecto", "Ubicación", "Ubicacion", "Lugar"]));
  const propiedad = text(pick(row, ["Propiedad"]));
  return { interno, equipo: [familia, marca, modelo].filter(Boolean).join(" — ") || interno, familia, marca, modelo, proyecto, propiedad };
}

function ropInterno(row) {
  // ROP02 ya llega normalizado desde App.jsx: el interno canónico está en `maquina`.
  return text(row?.maquina || row?._internoRaw || pick(row, ["interno", "codigo int", "código interno del equipo", "codigo interno del equipo", "equipo interno"]));
}
function ropHoras(row) {
  // Compatibilidad con datos normalizados (`horometroFinal`) y datos crudos (`HF`).
  return Math.max(
    num(row?.horometroFinal),
    num(row?.horometroInicial),
    num(pick(row, ["hf", "horometro final", "horómetro final", "km final", "kilometraje final"])),
    num(pick(row, ["hi", "horometro inicial", "horómetro inicial"])),
    num(row?.horas),
    num(pick(row, ["horas", "hs"]))
  );
}
function ropFecha(row) {
  return parseDateValue(row?.fecha || pick(row, ["fecha", "fecha del parte diario", "fecha parte", "día", "dia"]));
}
function ropProyecto(row) {
  return text(pick(row, ["proyecto", "project", "obra", "lugar"]));
}

function statusFor(row) {
  const actual = num(row.horometroActual);
  const ultimo = num(row.horometroUltimoPM);
  const transcurridas = ultimo > 0 ? Math.max(0, actual - ultimo) : 0;
  const alerta = num(row.alertaDesde) || DEFAULTS.alertaDesde;
  const atrasado = num(row.atrasadoDesde) || DEFAULTS.atrasadoDesde;
  const intervalo = num(row.intervalo) || DEFAULTS.intervalo;
  let estado = "AL DÍA", color = "ok";
  const margenUrgente = Math.max(20, Math.min(50, atrasado - intervalo));
  if (!ultimo) { estado = "SIN BASE"; color = "muted"; }
  else if (transcurridas >= atrasado) { estado = "PM ATRASADO"; color = "danger"; }
  else if (transcurridas >= intervalo || transcurridas >= atrasado - margenUrgente) { estado = "PM URGENTE"; color = "danger"; }
  else if (transcurridas >= alerta) { estado = "PM PRÓXIMO"; color = "warn"; }
  return {
    ...row,
    transcurridas,
    proximoPM: ultimo ? ultimo + intervalo : 0,
    faltan: ultimo ? Math.max(0, (ultimo + intervalo) - actual) : 0,
    estado,
    color,
  };
}

async function readJsonResponse(response, context) {
  const raw = await response.text();
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    const preview = raw.slice(0, 160).replace(/\s+/g, " ");
    throw new Error(`${context}: el Apps Script devolvió HTML en lugar de JSON. Volvé a implementar la aplicación web con el AppsScript.gs actualizado. Respuesta: ${preview || "vacía"}`);
  }
  if (!response.ok) throw new Error(json?.error?.message || `${context}: error HTTP ${response.status}.`);
  return json;
}

export default function MantenimientoProgramadoView({ deps = {}, listaEquipos = [], rop02All = [], initialTab = "dashboard", onTabChange }) {
  const { C, Card, Badge, StatCard, MultiSel, LoadingMotoniveladora, APPS_SCRIPT_URL: injectedAppsScriptUrl, appAlert, appConfirm } = deps;
  const APPS_SCRIPT_URL = injectedAppsScriptUrl || DEFAULT_APPS_SCRIPT_URL;
  const [tab, setTab] = useState(initialTab || "dashboard");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configs, setConfigs] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [proyectoFiltro, setProyectoFiltro] = useState(ALL);
  const [tipoFiltro, setTipoFiltro] = useState(ALL);
  const [equipoFiltro, setEquipoFiltro] = useState(ALL);
  const [propiedadFiltro, setPropiedadFiltro] = useState(ALL);
  const [estadoFiltro, setEstadoFiltro] = useState(ALL);
  const [mesFiltro, setMesFiltro] = useState("");
  const [anioFiltro, setAnioFiltro] = useState("");
  const [fechaDesde, setFechaDesde] = useState(daysAgo(6));
  const [fechaHasta, setFechaHasta] = useState(today());
  const [edit, setEdit] = useState(null);
  const [realizado, setRealizado] = useState({ interno: "", fecha: today(), horometro: "", tipoPM: "PM 250", tecnico: "", ot: "", observaciones: "" });

  useEffect(() => { setTab(initialTab || "dashboard"); }, [initialTab]);
  const changeTab = useCallback(next => {
    setTab(next);
    onTabChange?.(next);
  }, [onTabChange]);

  const post = useCallback(async payload => {
    if (!APPS_SCRIPT_URL) throw new Error("No está configurada la URL del Apps Script.");
    const body = new URLSearchParams({ payload: JSON.stringify(payload) });
    const response = await fetch(APPS_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" }, body });
    const json = await readJsonResponse(response, "Guardado PM");
    if (!json?.ok) throw new Error(json?.error?.message || "No se pudo guardar.");
    return json;
  }, [APPS_SCRIPT_URL]);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      if (!APPS_SCRIPT_URL) throw new Error("No está configurada la URL del Apps Script.");
      const response = await fetch(`${APPS_SCRIPT_URL}?action=mantenimiento_programado&ts=${Date.now()}`, { cache: "no-store" });
      const json = await readJsonResponse(response, "Carga de Mantenimiento Programado");
      if (!json?.ok) throw new Error(json?.error?.message || "No se pudo cargar Mantenimiento Programado.");
      setConfigs(Array.isArray(json.config) ? json.config : []);
      setRegistros(Array.isArray(json.registros) ? json.registros : []);
    } catch (err) {
      appAlert?.(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [APPS_SCRIPT_URL, appAlert]);

  useEffect(() => { load(); }, [load]);

  // La app emite este evento cada 5 minutos. Se vuelve a consultar el endpoint
  // específico de PM sin bloquear la interfaz ni mostrar el spinner principal.
  useEffect(() => {
    const onAutoRefresh = () => {
      if (document.visibilityState !== "visible") return;
      load({ silent: true });
    };
    window.addEventListener("delta-mining:auto-refresh", onAutoRefresh);
    return () => window.removeEventListener("delta-mining:auto-refresh", onAutoRefresh);
  }, [load]);

  const actividad7Dias = useMemo(() => {
    const fechasValidas = (rop02All || []).map(ropFecha).filter(Boolean);
    const referenciaDatos = fechasValidas.length
      ? new Date(Math.max(...fechasValidas.map(f => f.getTime())))
      : new Date();
    const hasta = parseDateValue(fechaHasta) || referenciaDatos;
    hasta.setHours(23, 59, 59, 999);
    const desde = parseDateValue(fechaDesde) || new Date(hasta);
    desde.setHours(0, 0, 0, 0);
    if (!fechaDesde) desde.setDate(desde.getDate() - 6);
    const map = new Map();
    (rop02All || []).forEach(row => {
      const fecha = ropFecha(row);
      if (!fecha || fecha < desde || fecha > hasta) return;
      const key = norm(ropInterno(row));
      if (!key) return;
      const horas = ropHoras(row);
      const proyecto = ropProyecto(row);
      const prev = map.get(key);
      if (!prev || fecha > prev.fecha || (fecha.getTime() === prev.fecha.getTime() && horas > prev.horas)) {
        map.set(key, { horas: Math.max(horas, prev?.horas || 0), fecha, proyecto: proyecto || prev?.proyecto || "" });
      } else if (horas > prev.horas) {
        map.set(key, { ...prev, horas });
      }
    });
    return map;
  }, [rop02All, fechaDesde, fechaHasta]);

  const mergedConfigs = useMemo(() => {
    const map = new Map(PM_INITIAL_SEED.map(item => [norm(item.interno), {
      ...DEFAULTS,
      tipoUltimoPM: "PM 250",
      activo: "SI",
      observaciones: "Importado desde Ultimos_PM_Equipos.xlsx",
      ...item,
    }]));
    (configs || []).forEach(cfg => {
      const key = norm(cfg?.interno);
      if (!key) return;
      const seeded = map.get(key) || {};
      map.set(key, {
        ...seeded,
        ...cfg,
        horometroUltimoPM: num(cfg?.horometroUltimoPM) > 0
          ? num(cfg.horometroUltimoPM)
          : num(seeded.horometroUltimoPM),
        fechaUltimoPM: text(cfg?.fechaUltimoPM) || seeded.fechaUltimoPM || "",
      });
    });
    return [...map.values()];
  }, [configs]);

  const configMap = useMemo(() => new Map(mergedConfigs.map(c => [norm(c.interno), c])), [mergedConfigs]);
  const equipos = useMemo(() => {
    const base = [];
    const seen = new Set();
    (listaEquipos || []).forEach(raw => {
      const e = equipoFromLista(raw);
      const key = norm(e.interno);
      const actividad = actividad7Dias.get(key);
      if (!key || seen.has(key) || !actividad) return;
      seen.add(key);
      const cfg = configMap.get(key) || {};
      base.push(statusFor({
        ...e,
        ...cfg,
        interno: e.interno,
        // Marca y modelo siempre provienen de la Lista Maestra; PM_CONFIG no debe sobrescribirlos.
        equipo: e.equipo,
        marca: e.marca,
        modelo: e.modelo,
        proyecto: actividad.proyecto || cfg.proyecto || e.proyecto,
        intervalo: num(cfg.intervalo) || DEFAULTS.intervalo,
        alertaDesde: num(cfg.alertaDesde) || DEFAULTS.alertaDesde,
        atrasadoDesde: num(cfg.atrasadoDesde) || DEFAULTS.atrasadoDesde,
        horometroUltimoPM: num(cfg.horometroUltimoPM),
        horometroActual: actividad.horas,
        ultimaActividad: actividad.fecha.toISOString().slice(0, 10),
        activo: String(cfg.activo ?? "SI").toUpperCase() !== "NO",
      }));
    });
    const rank = { "PM ATRASADO": 0, "PM URGENTE": 1, "PM PRÓXIMO": 2, "SIN BASE": 3, "AL DÍA": 4 };
    return base.sort((a, b) => (rank[a.estado] ?? 9) - (rank[b.estado] ?? 9) || a.interno.localeCompare(b.interno, "es", { numeric: true }));
  }, [listaEquipos, actividad7Dias, configMap]);

  const proyectos = useMemo(() => uniq(equipos.map(e => e.proyecto)).sort(), [equipos]);
  const tipos = useMemo(() => uniq(equipos.map(e => e.familia)).sort(), [equipos]);
  const propiedades = useMemo(() => uniq(equipos.map(e => e.propiedad)).sort(), [equipos]);
  const internos = useMemo(() => equipos.map(e => e.interno).sort((a, b) => a.localeCompare(b, "es", { numeric: true })), [equipos]);

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

  const kpis = useMemo(() => ({
    total: visibles.filter(x => x.activo).length,
    atrasados: visibles.filter(x => x.activo && x.estado === "PM ATRASADO").length,
    urgentes: visibles.filter(x => x.activo && x.estado === "PM URGENTE").length,
    proximos: visibles.filter(x => x.activo && x.estado === "PM PRÓXIMO").length,
    alDia: visibles.filter(x => x.activo && x.estado === "AL DÍA").length,
    sinBase: visibles.filter(x => x.activo && x.estado === "SIN BASE").length,
  }), [visibles]);

  const dashboard = useMemo(() => {
    const activos = visibles.filter(x => x.activo);
    const conBase = activos.filter(x => x.horometroUltimoPM > 0);

    const eventosMap = new Map();
    const addEvento = evento => {
      const fecha = parseDateValue(evento?.fecha);
      const interno = text(evento?.interno);
      if (!fecha || !interno) return;
      const fechaKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
      const horometro = num(evento?.horometro);
      const key = `${norm(interno)}|${fechaKey}|${horometro || 0}`;
      if (!eventosMap.has(key)) eventosMap.set(key, { ...evento, interno, fecha: fechaKey, horometro });
    };
    registros.forEach(r => addEvento({ ...r, fuente: "PM_REGISTROS" }));
    mergedConfigs.forEach(c => {
      if (text(c.fechaUltimoPM) && num(c.horometroUltimoPM) > 0) {
        addEvento({ interno: c.interno, fecha: c.fechaUltimoPM, horometro: c.horometroUltimoPM, proyecto: c.proyecto, fuente: "PM_CONFIG" });
      }
    });
    const eventosPM = [...eventosMap.values()];

    // El cumplimiento y los PM realizados deben responder al mes/período filtrado,
    // no quedar atados al mes calendario actual.
    const mesReferencia = (mesFiltro && anioFiltro)
      ? `${anioFiltro}-${mesFiltro}`
      : String(fechaHasta || today()).slice(0, 7);
    const realizadosMes = eventosPM.filter(r => String(r.fecha || "").slice(0, 7) === mesReferencia).length;
    const pendientesMes = conBase.filter(x => ["PM ATRASADO", "PM URGENTE"].includes(x.estado)).length;
    const previstosMes = realizadosMes + pendientesMes;
    const cumplimiento = previstosMes ? Math.round((realizadosMes / previstosMes) * 100) : 100;
    const intervalosRealizados = registros.map(r => num(r.horasDesdeUltimoPM || r.intervaloReal || r.horasEntrePM)).filter(v => v > 0);
    const promedioHs = intervalosRealizados.length
      ? Math.round(intervalosRealizados.reduce((a, v) => a + v, 0) / intervalosRealizados.length)
      : (conBase.length ? Math.round(conBase.reduce((a, x) => a + x.transcurridas, 0) / conBase.length) : 0);
    const porProyecto = Object.entries(activos.reduce((acc, x) => {
      const k = x.proyecto || "SIN PROYECTO";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {})).sort((a, b) => b[1] - a[1]);
    const urgentes = conBase
      .filter(x => x.estado === "PM ATRASADO" || x.estado === "PM URGENTE")
      .map(x => ({ ...x, diferencia: x.transcurridas >= x.atrasadoDesde ? x.transcurridas - x.atrasadoDesde : x.atrasadoDesde - x.transcurridas }))
      .sort((a, b) => (b.transcurridas - b.atrasadoDesde) - (a.transcurridas - a.atrasadoDesde));
    const proximoTurno = conBase
      // Los equipos que ya están urgentes o atrasados pertenecen exclusivamente al bloque urgente.
      .filter(x => !["PM ATRASADO", "PM URGENTE"].includes(x.estado))
      .map(x => {
        const min = x.transcurridas + 80;
        const max = x.transcurridas + 120;
        let riesgo = "", recomendacion = "";
        if (max >= x.atrasadoDesde) {
          riesgo = "Puede quedar atrasado";
          recomendacion = "Programar el PM durante el próximo turno antes de superar el límite";
        } else if (min >= x.intervalo) {
          riesgo = "Probable PM";
          recomendacion = "Reservar recursos y repuestos para realizarlo en el próximo turno";
        } else if (max >= x.alertaDesde || max >= x.intervalo) {
          riesgo = "Puede llegar a PM";
          recomendacion = "Controlar el horómetro durante el turno y dejar recursos disponibles";
        }
        return { ...x, proyMin: min, proyMax: max, riesgo, recomendacion };
      })
      .filter(x => x.riesgo)
      .sort((a, b) => {
        const rank = { "Puede quedar atrasado": 0, "Probable PM": 1, "Puede llegar a PM": 2 };
        return (rank[a.riesgo] ?? 9) - (rank[b.riesgo] ?? 9) || a.faltan - b.faltan;
      });
    const estado = [["Al día", kpis.alDia, C?.green], ["Próximo", kpis.proximos, C?.yellow], ["Urgente", kpis.urgentes, C?.orange || "#fb923c"], ["Atrasado", kpis.atrasados, C?.red], ["Sin base", kpis.sinBase, C?.textMuted]];

    const meses = [];
    const inicio = new Date(2026, 3, 1);

    // El gráfico crece automáticamente hasta el mes más lejano que corresponda:
    // mes actual, fin del período seleccionado o último PM registrado.
    const candidatosFin = [new Date()];
    const hastaSeleccionado = parseDateValue(fechaHasta);
    if (hastaSeleccionado) candidatosFin.push(hastaSeleccionado);
    eventosPM.forEach(evento => {
      const fechaEvento = parseDateValue(evento?.fecha);
      if (fechaEvento) candidatosFin.push(fechaEvento);
    });
    const fin = new Date(Math.max(...candidatosFin.map(fecha => fecha.getTime())));
    fin.setDate(1);
    fin.setHours(0, 0, 0, 0);

    for (let d = new Date(inicio); d <= fin; d.setMonth(d.getMonth() + 1)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      meses.push({
        key,
        label: d.toLocaleDateString("es-AR", { month: "short", year: "2-digit" }),
        value: eventosPM.filter(r => String(r.fecha || "").slice(0, 7) === key).length,
      });
    }
    // Mantener como máximo 17 meses visibles. Cuando el rango crece,
    // se eliminan automáticamente los meses más antiguos.
    const mesesVisibles = meses.slice(-17);
    const turno = rangoTurnoPorFecha(new Date());
    const proximosMantenimientos = conBase
      .filter(x => x.estado !== "AL DÍA" || x.faltan <= 120)
      .sort((a, b) => a.faltan - b.faltan || b.transcurridas - a.transcurridas);
    return { realizadosMes, cumplimiento, promedioHs, porProyecto, urgentes, proximoTurno, estado, meses: mesesVisibles, turno, eventosPM, proximosMantenimientos };
  }, [visibles, registros, mergedConfigs, kpis, C, fechaHasta, mesFiltro, anioFiltro]);

  const mesesFiltro = useMemo(() => [
    { value: "01", label: "Enero" },
    { value: "02", label: "Febrero" },
    { value: "03", label: "Marzo" },
    { value: "04", label: "Abril" },
    { value: "05", label: "Mayo" },
    { value: "06", label: "Junio" },
    { value: "07", label: "Julio" },
    { value: "08", label: "Agosto" },
    { value: "09", label: "Septiembre" },
    { value: "10", label: "Octubre" },
    { value: "11", label: "Noviembre" },
    { value: "12", label: "Diciembre" },
  ], []);

  const aniosFiltro = useMemo(() => {
    const years = new Set([2026, 2027, 2028]);
    const collectYear = value => {
      const date = parseDateValue(value);
      if (date) years.add(date.getFullYear());
    };
    (rop02All || []).forEach(row => collectYear(row?.fecha || pick(row, ["fecha", "fecha del parte diario", "fecha parte"])));
    (registros || []).forEach(row => collectYear(row?.fecha || pick(row, ["fecha", "fecha pm", "fecha realizado"])));
    return [...years].filter(y => y >= 2020 && y <= 2028).sort((a, b) => a - b);
  }, [rop02All, registros]);

  const aplicarPeriodoMes = (monthValue, yearValue) => {
    if (!monthValue && !yearValue) return;
    const year = Number(yearValue || new Date().getFullYear());
    if (!yearValue) setAnioFiltro(String(year));
    if (monthValue) {
      const month = Number(monthValue);
      const first = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDate = new Date(year, month, 0);
      const last = `${year}-${String(month).padStart(2, "0")}-${String(lastDate.getDate()).padStart(2, "0")}`;
      setFechaDesde(first);
      setFechaHasta(last);
    } else {
      setFechaDesde(`${year}-01-01`);
      setFechaHasta(`${year}-12-31`);
    }
  };

  const aplicarMes = value => {
    setMesFiltro(value);
    if (!value) return;
    aplicarPeriodoMes(value, anioFiltro);
  };

  const aplicarAnio = value => {
    setAnioFiltro(value);
    if (!value) return;
    aplicarPeriodoMes(mesFiltro, value);
  };

  const clearFilters = () => {
    setProyectoFiltro(ALL);
    setTipoFiltro(ALL);
    setEquipoFiltro(ALL);
    setPropiedadFiltro(ALL);
    setEstadoFiltro(ALL);
    setMesFiltro("");
    setAnioFiltro("");
    setFechaDesde(daysAgo(6));
    setFechaHasta(today());
  };

  const saveConfig = async () => {
    if (!edit?.interno) return;
    setSaving(true);
    try {
      await post({ action: "save_pm_config", config: { ...edit, intervalo: num(edit.intervalo), alertaDesde: num(edit.alertaDesde), atrasadoDesde: num(edit.atrasadoDesde), horometroUltimoPM: num(edit.horometroUltimoPM), horometroActualManual: 0 } });
      await load();
      setEdit(null);
      appAlert?.("Configuración guardada.");
    } catch (err) { appAlert?.(err.message); } finally { setSaving(false); }
  };

  const registrarRealizado = async () => {
    if (!realizado.interno || !num(realizado.horometro)) {
      appAlert?.("Seleccioná un equipo e ingresá el horómetro del PM realizado.");
      return;
    }
    const ok = await (appConfirm ? appConfirm(`¿Registrar el PM como realizado a las ${fmt(realizado.horometro)} hs?`) : true);
    if (!ok) return;
    setSaving(true);
    try {
      const eq = equipos.find(x => x.interno === realizado.interno);
      await post({ action: "registrar_pm_realizado", registro: { ...realizado, equipo: eq?.equipo || "", proyecto: eq?.proyecto || "", horometro: num(realizado.horometro) } });
      await load();
      setRealizado({ interno: "", fecha: today(), horometro: "", tipoPM: "PM 250", tecnico: "", ot: "", observaciones: "" });
      changeTab("panel");
      appAlert?.("PM registrado. El próximo ciclo comienza desde ese horómetro.");
    } catch (err) { appAlert?.(err.message); } finally { setSaving(false); }
  };

  const inputStyle = { height: 34, border: `1px solid ${C?.border || "#333"}`, borderRadius: 8, background: C?.surface || "#181818", color: C?.text || "#fff", padding: "0 10px", fontSize: 12 };
  const btnStyle = { height: 34, border: 0, borderRadius: 8, background: C?.accent || "#e8001d", color: "#fff", padding: "0 14px", fontWeight: 700, cursor: "pointer" };
  const statusColor = { "AL DÍA": C?.green || "#10b981", "PM PRÓXIMO": C?.yellow || "#f59e0b", "PM URGENTE": C?.orange || "#fb923c", "PM ATRASADO": C?.red || "#ef4444", "SIN BASE": C?.textMuted || "#64748b" };

  if (loading) return <div style={{ margin: 16, minHeight: "55vh", display: "grid", placeItems: "center", background: "rgba(0,0,0,.68)", border: `1px solid ${C?.border || "#333"}`, borderRadius: 16, backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
    {LoadingMotoniveladora
      ? <LoadingMotoniveladora size={340} label="Cargando mantenimiento programado..." />
      : <div style={{ color: C?.textSub }}>Cargando mantenimiento programado…</div>}
  </div>;

  const tableHead = h => <th key={h} style={{ padding:"9px 10px",textAlign:"left",color:C?.textSub,borderBottom:`1px solid ${C?.border}`,whiteSpace:"nowrap" }}>{h}</th>;
  const tableCell = {padding:"9px 10px",borderBottom:`1px solid ${C?.border}33`,whiteSpace:"nowrap"};
  const fmtDate = d => d ? new Date(d).toLocaleDateString("es-AR") : "—";
  const groupNames = (g, proyecto) => {
    const key=norm(proyecto);
    const names=key.includes("JOSE")||key==="JM"?g.jm:g.fs;
    return (names||[]).join(" / ")||g.nombre;
  };
  const BarList = ({rows,max}) => <div style={{padding:"14px 16px",display:"grid",gap:10}}>{rows.map(([label,value,color])=><div key={label}><div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C?.textSub,marginBottom:5}}><span>{label}</span><b>{value}</b></div><div style={{height:9,borderRadius:99,background:C?.surface||"#222",overflow:"hidden"}}><div style={{height:"100%",width:`${max?Math.max(2,Math.round(value/max*100)):0}%`,background:color||C?.blue,borderRadius:99}}/></div></div>)}</div>;
  const MonthTimeline = ({ months }) => {
    const max = Math.max(1, ...months.map(m => m.value));
    return <div style={{ padding: "18px 20px 14px", minHeight: 190, display: "flex", alignItems: "end", gap: 10, overflowX: "auto" }}>
      {months.map(m => <div key={m.key} style={{ minWidth: 78, flex: "1 0 78px", display: "grid", gridTemplateRows: "22px 1fr 24px", alignItems: "end", textAlign: "center" }}>
        <div style={{ color: C?.textSub, fontSize: 12, fontWeight: 800 }}>{m.value}</div>
        <div style={{ height: 120, display: "flex", alignItems: "end", justifyContent: "center", borderBottom: `4px solid ${C?.surface || "#252525"}`, borderRadius: 3 }}>
          <div title={`${m.label}: ${m.value} PM`} style={{ width: "64%", minHeight: m.value ? 8 : 0, height: `${m.value ? Math.max(8, Math.round((m.value / max) * 112)) : 0}px`, borderRadius: "7px 7px 2px 2px", background: C?.green || "#22c55e", transition: "height .25s ease" }} />
        </div>
        <div style={{ color: C?.textMuted, fontSize: 11, textTransform: "capitalize" }}>{m.label}</div>
      </div>)}
    </div>;
  };

  return <div style={{ padding: 16 }}>
    {(tab === "dashboard" || tab === "panel") && <div style={{ marginBottom: 14, padding: "14px 16px", borderRadius: 12, background: "rgba(0,0,0,.55)", border: `1px solid ${C?.border || "#333"}`, backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
        <label style={{ display: "grid", gap: 5, color: C?.textMuted, fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>Mes
          <select value={mesFiltro} onChange={e => aplicarMes(e.target.value)} style={{ ...inputStyle, minWidth: 145 }}>
            <option value="">Mes</option>
            {mesesFiltro.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </label>
        <label style={{ display: "grid", gap: 5, color: C?.textMuted, fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>Año
          <select value={anioFiltro} onChange={e => aplicarAnio(e.target.value)} style={{ ...inputStyle, minWidth: 100 }}>
            <option value="">Año</option>
            {aniosFiltro.map(y => <option key={y} value={String(y)}>{y}</option>)}
          </select>
        </label>
        <label style={{ display: "grid", gap: 5, color: C?.textMuted, fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>Desde
          <input type="date" value={fechaDesde} max={fechaHasta || undefined} onChange={e => { setMesFiltro(""); setAnioFiltro(""); setFechaDesde(e.target.value); }} style={inputStyle} />
        </label>
        <label style={{ display: "grid", gap: 5, color: C?.textMuted, fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>Hasta
          <input type="date" value={fechaHasta} min={fechaDesde || undefined} onChange={e => { setMesFiltro(""); setAnioFiltro(""); setFechaHasta(e.target.value); }} style={inputStyle} />
        </label>
        <MultiSel label="Proyecto" value={proyectoFiltro} onChange={setProyectoFiltro} options={[{ value: ALL, label: "Todos" }, ...proyectos.map(v => ({ value: v, label: v }))]} />
        <MultiSel label="Tipo de máquina" value={tipoFiltro} onChange={setTipoFiltro} options={[{ value: ALL, label: "Todos" }, ...tipos.map(v => ({ value: v, label: v }))]} />
        <MultiSel label="Equipo" value={equipoFiltro} onChange={setEquipoFiltro} options={[{ value: ALL, label: "Todos" }, ...internos.map(v => ({ value: v, label: v }))]} />
        <MultiSel label="Propiedad" value={propiedadFiltro} onChange={setPropiedadFiltro} options={[{ value: ALL, label: "Todas" }, ...propiedades.map(v => ({ value: v, label: v }))]} />
        <MultiSel label="Estado" value={estadoFiltro} onChange={setEstadoFiltro} options={[{ value: ALL, label: "Todos" }, "PM ATRASADO", "PM URGENTE", "PM PRÓXIMO", "AL DÍA", "SIN BASE"].map(v => typeof v === "string" ? ({ value: v, label: v }) : v)} />
        <button onClick={clearFilters} style={{ ...btnStyle, background: C?.surface || "#333", color: C?.textSub }}>Limpiar filtros</button>
        <button onClick={() => load()} style={btnStyle}>Actualizar</button>
      </div>
      <div style={{ fontSize: 11, color: C?.textMuted, marginTop: 10 }}>Los indicadores, gráficos y tablas se calculan con los equipos que tuvieron actividad ROP02 dentro del período seleccionado.</div>
    </div>}

    {tab === "dashboard" && <div style={{display:"grid",gap:14}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(165px,1fr))",gap:10}}>
        <StatCard label="Equipos activos en el período" value={kpis.total} color={C?.blue}/>
        <StatCard label="PM atrasados" value={kpis.atrasados} color={C?.red}/>
        <StatCard label="PM urgentes" value={kpis.urgentes} color={C?.orange||"#fb923c"}/>
        <StatCard label="PM próximos" value={kpis.proximos} color={C?.yellow}/>
        <StatCard label="Equipos al día" value={kpis.alDia} color={C?.green}/>
        <StatCard label="PM realizados en el mes" value={dashboard.realizadosMes} color={C?.blue}/>
        <StatCard label="Cumplimiento PM del mes" value={`${dashboard.cumplimiento}%`} color={dashboard.cumplimiento>=80?C?.green:C?.yellow}/>
        <StatCard label="Promedio de horas entre PM" value={`${fmt(dashboard.promedioHs)} h`} color={C?.purple}/>
      </div>

      <Card title={`PM realizados — desde ${dashboard.meses?.[0]?.label || "abril"}`}><MonthTimeline months={dashboard.meses}/></Card>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:10}}>
        <Card title="Estado de PM"><BarList rows={dashboard.estado} max={Math.max(1,kpis.total)}/></Card>
        <Card title="PM por proyecto"><BarList rows={dashboard.porProyecto.map(([l,v])=>[l,v,C?.blue])} max={Math.max(1,...dashboard.porProyecto.map(x=>x[1]))}/></Card>
        <Card title="Horas desde el último PM por equipo"><BarList rows={visibles.filter(x=>x.horometroUltimoPM>0).sort((a,b)=>b.transcurridas-a.transcurridas).slice(0,15).map(x=>[x.interno,x.transcurridas,statusColor[x.estado]])} max={Math.max(1,...visibles.map(x=>x.transcurridas||0))}/></Card>
        <Card title="PM previstos para el próximo turno"><BarList rows={dashboard.proximoTurno.map(x=>[x.interno,x.proyMax,x.riesgo.includes("atrasado")?C?.red:C?.yellow])} max={Math.max(1,...dashboard.proximoTurno.map(x=>x.proyMax))}/></Card>
      </div>

      <Card title="PM que deben realizarse con urgencia"><div style={{padding:"12px 14px"}}><div style={{overflowX:"auto",border:`1px solid ${C?.border}`,borderRadius:10}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:1150}}><thead><tr>{["Interno","Marca y modelo","Proyecto","Horómetro actual","Horómetro último PM","Hs desde PM","Próximo PM","Atraso / faltante","Estado","Acción"].map(tableHead)}</tr></thead><tbody>
        {dashboard.urgentes.length===0&&<tr><td colSpan={10} style={{padding:24,textAlign:"center",color:C?.textMuted}}>No hay PM urgentes con los datos actuales.</td></tr>}
        {dashboard.urgentes.map(e=><tr key={e.interno}><td style={{...tableCell,fontWeight:900}}>{e.interno}</td><td style={tableCell}>{[e.marca, e.modelo].filter(Boolean).join(" — ") || marcaModelo(e.equipo)}</td><td style={tableCell}>{e.proyecto||"—"}</td><td style={tableCell}>{fmt(e.horometroActual)}</td><td style={tableCell}>{fmt(e.horometroUltimoPM)}</td><td style={{...tableCell,fontWeight:900}}>{fmt(e.transcurridas)}</td><td style={tableCell}>{fmt(e.proximoPM)}</td><td style={{...tableCell,color:e.transcurridas>=e.atrasadoDesde?C?.red:C?.yellow,fontWeight:900}}>{e.transcurridas>=e.atrasadoDesde?`${fmt(e.transcurridas-e.atrasadoDesde)} h atraso`:`Faltan ${fmt(e.atrasadoDesde-e.transcurridas)} h`}</td><td style={tableCell}><Badge color={statusColor[e.estado]}>{e.estado}</Badge></td><td style={tableCell}><button style={btnStyle} onClick={()=>{setRealizado(r=>({...r,interno:e.interno,horometro:String(e.horometroActual||"")}));changeTab("realizado");}}>Registrar PM</button></td></tr>)}
      </tbody></table></div></div></Card>

      <Card title="PM posibles en el próximo turno"><div style={{padding:"12px 14px"}}><div style={{overflowX:"auto",border:`1px solid ${C?.border}`,borderRadius:10}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:1200}}><thead><tr>{["Interno","Marca y modelo","Proyecto","Hs actuales desde PM","Proyección mínima (+80)","Proyección máxima (+120)","Próximo PM","Riesgo","Recomendación"].map(tableHead)}</tr></thead><tbody>
        {dashboard.proximoTurno.length===0&&<tr><td colSpan={9} style={{padding:24,textAlign:"center",color:C?.textMuted}}>No se proyectan PM para el próximo turno.</td></tr>}
        {dashboard.proximoTurno.map(e=><tr key={e.interno}><td style={{...tableCell,fontWeight:900}}>{e.interno}</td><td style={tableCell}>{[e.marca, e.modelo].filter(Boolean).join(" — ") || marcaModelo(e.equipo)}</td><td style={tableCell}>{e.proyecto||"—"}</td><td style={tableCell}>{fmt(e.transcurridas)}</td><td style={tableCell}>{fmt(e.proyMin)}</td><td style={tableCell}>{fmt(e.proyMax)}</td><td style={tableCell}>{fmt(e.proximoPM)}</td><td style={{...tableCell,fontWeight:900,color:e.riesgo.includes("atrasado")?C?.red:e.riesgo.includes("Probable")?C?.orange:C?.yellow}}>{e.riesgo}</td><td style={{...tableCell,whiteSpace:"normal",minWidth:240}}>{e.recomendacion}</td></tr>)}
      </tbody></table></div></div></Card>

      <Card title="Próximo cambio de turno"><div style={{padding:"14px 16px",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:10}}>
        {[...new Set(visibles.map(e=>e.proyecto).filter(Boolean))].map(proyecto=><div key={proyecto} style={{border:`1px solid ${C?.border}`,borderRadius:10,padding:12,background:C?.surface}}><div style={{fontWeight:900,color:C?.text,marginBottom:8}}>{proyecto}</div><div style={{fontSize:12,color:C?.textSub,lineHeight:1.7}}><div><b>Fecha:</b> {fmtDate(dashboard.turno.proximoCambio)}</div><div><b>Grupo saliente:</b> {dashboard.turno.grupo.nombre} · {groupNames(dashboard.turno.grupo,proyecto)}</div><div><b>Grupo entrante:</b> {dashboard.turno.grupoSiguiente.nombre} · {groupNames(dashboard.turno.grupoSiguiente,proyecto)}</div><div><b>PM urgentes:</b> {dashboard.urgentes.filter(x=>x.proyecto===proyecto).length}</div><div><b>PM posibles:</b> {dashboard.proximoTurno.filter(x=>x.proyecto===proyecto).length}</div></div></div>)}
      </div></Card>

    </div>}

    {tab === "panel" && <>
      <Card title="Estado de mantenimiento programado">
        <div style={{ padding: "14px 16px 16px" }}>
        <div style={{ fontSize: 11, color: C?.textMuted, marginBottom: 10 }}>Se muestran los equipos con registros ROP02 entre {fechaDesde || "el inicio"} y {fechaHasta || "la última fecha disponible"}. El horómetro actual es el último HF encontrado para cada interno dentro del período.</div>
        <div style={{ overflowX: "auto", border: `1px solid ${C?.border || "#333"}`, borderRadius: 10 }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}><thead><tr>{["Interno", "Marca y modelo", "Proyecto", "Última actividad", "Horómetro actual", "Último PM", "Hs desde PM", "Próximo PM", "Estado", "Acción"].map(h => <th key={h} style={{ padding: "9px 10px", textAlign: "left", color: C?.textSub, borderBottom: `1px solid ${C?.border}` }}>{h}</th>)}</tr></thead><tbody>
          {visibles.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: "center", color: C?.textMuted }}>No hay equipos activos que coincidan con los filtros.</td></tr>}
          {visibles.map(e => <tr key={e.interno}><td style={{ padding: 9, fontWeight: 800, borderBottom: `1px solid ${C?.border}33` }}>{e.interno}</td><td style={{ padding: 9 }}>{[e.marca, e.modelo].filter(Boolean).join(" — ") || marcaModelo(e.equipo)}</td><td style={{ padding: 9 }}>{e.proyecto || "—"}</td><td style={{ padding: 9 }}>{e.ultimaActividad || "—"}</td><td style={{ padding: 9, fontWeight: 700 }}>{fmt(e.horometroActual)}</td><td style={{ padding: 9 }}>{e.horometroUltimoPM ? fmt(e.horometroUltimoPM) : "Sin cargar"}</td><td style={{ padding: 9, fontWeight: 700 }}>{e.horometroUltimoPM ? fmt(e.transcurridas) : "—"}</td><td style={{ padding: 9 }}>{e.proximoPM ? fmt(e.proximoPM) : "—"}</td><td style={{ padding: 9 }}><Badge color={statusColor[e.estado]}>{e.estado}</Badge></td><td style={{ padding: 9 }}><button style={btnStyle} onClick={() => { setRealizado(r => ({ ...r, interno: e.interno, horometro: String(e.horometroActual || "") })); changeTab("realizado"); }}>Realizado</button></td></tr>)}
        </tbody></table></div>
        </div>
      </Card>
    </>}

    {tab === "realizado" && <Card title="Registrar mantenimiento programado realizado"><div style={{ padding: "14px 16px 16px" }}><div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(220px,1fr))", gap: 12 }}>
      <label>Equipo<select value={realizado.interno} onChange={e => { const eq = equipos.find(x => x.interno === e.target.value); setRealizado(r => ({ ...r, interno: e.target.value, horometro: eq ? String(eq.horometroActual || "") : "" })); }} style={{ ...inputStyle, width: "100%", display: "block", marginTop: 5 }}><option value="">Seleccionar…</option>{equipos.map(e => <option key={e.interno} value={e.interno}>{e.interno} — {e.equipo}</option>)}</select></label>
      <label>Fecha<input type="date" value={realizado.fecha} onChange={e => setRealizado(r => ({ ...r, fecha: e.target.value }))} style={{ ...inputStyle, width: "100%", display: "block", marginTop: 5 }} /></label>
      <label>Horómetro al realizar PM<input type="number" value={realizado.horometro} onChange={e => setRealizado(r => ({ ...r, horometro: e.target.value }))} style={{ ...inputStyle, width: "100%", display: "block", marginTop: 5 }} /></label>
      <label>Tipo PM<input value={realizado.tipoPM} onChange={e => setRealizado(r => ({ ...r, tipoPM: e.target.value }))} style={{ ...inputStyle, width: "100%", display: "block", marginTop: 5 }} /></label>
      <label>Técnico<input value={realizado.tecnico} onChange={e => setRealizado(r => ({ ...r, tecnico: e.target.value }))} style={{ ...inputStyle, width: "100%", display: "block", marginTop: 5 }} /></label>
      <label>N° OT<input value={realizado.ot} onChange={e => setRealizado(r => ({ ...r, ot: e.target.value }))} style={{ ...inputStyle, width: "100%", display: "block", marginTop: 5 }} /></label>
      <label style={{ gridColumn: "1/-1" }}>Observaciones<textarea value={realizado.observaciones} onChange={e => setRealizado(r => ({ ...r, observaciones: e.target.value }))} style={{ ...inputStyle, width: "100%", height: 80, padding: 10, display: "block", marginTop: 5 }} /></label>
      <div style={{ gridColumn: "1/-1", textAlign: "right" }}><button disabled={saving} onClick={registrarRealizado} style={btnStyle}>{saving ? "Guardando…" : "Marcar como realizado"}</button></div>
    </div></div></Card>}

    {tab === "config" && <Card title="Configuración inicial y parámetros por equipo"><div style={{ padding: "14px 16px 16px" }}><div style={{ padding: "0 0 12px", color: C?.textSub, fontSize: 12, lineHeight: 1.5 }}>La lista contiene únicamente equipos activos en ROP02 durante los últimos 7 días. Cargá el horómetro del último PM para iniciar el control; cada registro marcado como <b style={{ color: C?.text }}>Realizado</b> reinicia automáticamente el ciclo.</div><div style={{ overflowX: "auto", border: `1px solid ${C?.border || "#333"}`, borderRadius: 10 }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}><thead><tr>{["Interno", "Marca y modelo", "Horómetro ROP02", "Último PM", "Intervalo", "Alerta desde", "Atrasado desde", "Editar"].map(h => <th key={h} style={{ padding: 9, textAlign: "left", color: C?.textSub, borderBottom: `1px solid ${C?.border}` }}>{h}</th>)}</tr></thead><tbody>{equipos.map(e => <tr key={e.interno}><td style={{ padding: 9, fontWeight: 800 }}>{e.interno}</td><td style={{ padding: 9 }}>{[e.marca, e.modelo].filter(Boolean).join(" — ") || marcaModelo(e.equipo)}</td><td style={{ padding: 9 }}>{fmt(e.horometroActual)}</td><td style={{ padding: 9 }}>{e.horometroUltimoPM ? fmt(e.horometroUltimoPM) : "—"}</td><td style={{ padding: 9 }}>{e.intervalo}</td><td style={{ padding: 9 }}>{e.alertaDesde}</td><td style={{ padding: 9 }}>{e.atrasadoDesde}</td><td style={{ padding: 9 }}><button style={btnStyle} onClick={() => setEdit({ ...e })}>Configurar</button></td></tr>)}</tbody></table></div></div></Card>}

    {edit && <div style={{ position: "fixed", inset: 0, background: "#000a", display: "grid", placeItems: "center", zIndex: 9999, padding: 18 }}><div style={{ width: "min(720px,96vw)", background: C?.panel || "#111", border: `1px solid ${C?.border || "#333"}`, borderRadius: 14, padding: 18 }}><h3 style={{ marginTop: 0 }}>Configurar {edit.interno}</h3><div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>{[["horometroUltimoPM", "Horómetro del último PM"], ["intervalo", "Intervalo objetivo"], ["alertaDesde", "Alerta PM próximo desde"], ["atrasadoDesde", "PM atrasado desde"]].map(([k, l]) => <label key={k}>{l}<input type="number" value={edit[k] ?? ""} onChange={e => setEdit(x => ({ ...x, [k]: e.target.value }))} style={{ ...inputStyle, width: "100%", display: "block", marginTop: 5 }} /></label>)}<label>Fecha último PM<input type="date" value={edit.fechaUltimoPM || ""} onChange={e => setEdit(x => ({ ...x, fechaUltimoPM: e.target.value }))} style={{ ...inputStyle, width: "100%", display: "block", marginTop: 5 }} /></label></div><div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}><button onClick={() => setEdit(null)} style={{ ...btnStyle, background: C?.surface || "#333" }}>Cancelar</button><button disabled={saving} onClick={saveConfig} style={btnStyle}>{saving ? "Guardando…" : "Guardar"}</button></div></div></div>}

    {tab === "historial" && <Card title={`Historial de PM (${registros.length})`}><div style={{ padding: "14px 16px 16px" }}><div style={{ overflowX: "auto", border: `1px solid ${C?.border || "#333"}`, borderRadius: 10 }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}><thead><tr>{["Fecha", "Equipo", "Horómetro", "Tipo", "Técnico", "OT", "Observaciones"].map(h => <th key={h} style={{ padding: 9, textAlign: "left", color: C?.textSub, borderBottom: `1px solid ${C?.border}` }}>{h}</th>)}</tr></thead><tbody>{registros.map((r, i) => <tr key={r.idPM || i}><td style={{ padding: 9 }}>{r.fecha}</td><td style={{ padding: 9, fontWeight: 700 }}>{r.interno}</td><td style={{ padding: 9 }}>{fmt(r.horometro)}</td><td style={{ padding: 9 }}>{r.tipoPM}</td><td style={{ padding: 9 }}>{r.tecnico || "—"}</td><td style={{ padding: 9 }}>{r.ot || "—"}</td><td style={{ padding: 9 }}>{r.observaciones || "—"}</td></tr>)}</tbody></table></div></div></Card>}
  </div>;
}
