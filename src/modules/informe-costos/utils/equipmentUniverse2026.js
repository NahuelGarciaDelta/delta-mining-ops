import { canonicalEquipmentCode, resolveEquipmentCodeAlias } from "../../equipment/equipmentCode.js";

export const INFORME_COSTOS_YEAR = 2026;
export const INFORME_COSTOS_MIN_DATE = "2026-01-01";

export function maintenanceEquipmentCode(row) {
  return canonicalEquipmentCode(resolveEquipmentCodeAlias(
    row?.maquina ?? row?.equipo ?? row?.interno ?? row?.codigo ?? "",
  ));
}

export function isMaintenanceRecordIn2026(row) {
  return String(row?.fecha || row?.mes || "").slice(0, 4) === String(INFORME_COSTOS_YEAR);
}

export function buildEquipmentWithMaintenance2026(rows) {
  const result = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!isMaintenanceRecordIn2026(row)) continue;
    const code = maintenanceEquipmentCode(row);
    if (code) result.add(code);
  }
  return result;
}

export function prepareMaintenanceCostRows(rows) {
  return (Array.isArray(rows) ? rows : []).map(row => {
    const dateKey = String(row?.fecha || "").slice(0, 10);
    let totalARS = 0;
    for (const item of Array.isArray(row?.insumos) ? row.insumos : []) {
      totalARS += Number(item?.costoTotal) || 0;
    }
    return {
      ...row,
      _dateKey: dateKey,
      _monthKey: dateKey.slice(0, 7),
      _canonicalEquipment: maintenanceEquipmentCode(row),
      _costoTotalARS: totalARS,
      _esPreventivo: String(row?.tipoMant || "").toUpperCase().includes("PREV"),
    };
  });
}

export function indexMaintenanceCostRows(rows) {
  const byEquipment = new Map();
  const displayByEquipment = new Map();
  const byMonth = new Map();
  const byProject = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const code = row?._canonicalEquipment || maintenanceEquipmentCode(row);
    const month = row?._monthKey || String(row?.fecha || "").slice(0, 7);
    const project = String(row?.proyecto || "S/D");
    if (code) {
      if (!byEquipment.has(code)) byEquipment.set(code, []);
      byEquipment.get(code).push(row);
      if (!displayByEquipment.has(code)) displayByEquipment.set(code, row?.maquina || row?.equipo || code);
    }
    if (month) {
      if (!byMonth.has(month)) byMonth.set(month, []);
      byMonth.get(month).push(row);
    }
    if (!byProject.has(project)) byProject.set(project, []);
    byProject.get(project).push(row);
  }
  return { byEquipment, displayByEquipment, byMonth, byProject };
}

export function belongsToMaintenanceUniverse2026(row, universe) {
  const code = maintenanceEquipmentCode(row);
  return Boolean(code && universe?.has(code));
}

export function clampInformeCostosDate(value, fallback = INFORME_COSTOS_MIN_DATE) {
  const date = String(value || fallback).slice(0, 10);
  return date < INFORME_COSTOS_MIN_DATE ? INFORME_COSTOS_MIN_DATE : date;
}

export function sumEffectiveRop02Hours2026(rows, universe, from = INFORME_COSTOS_MIN_DATE, to = "2026-12-31") {
  const start = clampInformeCostosDate(from);
  const end = clampInformeCostosDate(to, "2026-12-31");
  const totals = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const date = String(row?.fecha || "").slice(0, 10);
    const hours = Number(row?.horas) || 0;
    const status = String(row?.estado || "").trim().toUpperCase();
    if (date < start || date > end || hours <= 0 || ["OD", "FS", "EM"].includes(status)) continue;
    const code = maintenanceEquipmentCode(row);
    if (!code || !universe?.has(code)) continue;
    totals.set(code, (totals.get(code) || 0) + hours);
  }
  return totals;
}

function upperBound(entries, date) {
  let low = 0;
  let high = entries.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (entries[mid].date <= date) low = mid + 1;
    else high = mid;
  }
  return low;
}

export function buildEquipmentRangeIndex(rows, universe, valueSelector) {
  const daily = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const date = row?._dateKey || String(row?.fecha || "").slice(0, 10);
    const code = row?._canonicalEquipment || maintenanceEquipmentCode(row);
    if (!date.startsWith("2026-") || !code || !universe?.has(code)) continue;
    const value = Number(valueSelector(row)) || 0;
    if (value <= 0) continue;
    if (!daily.has(code)) daily.set(code, new Map());
    const equipmentDays = daily.get(code);
    equipmentDays.set(date, (equipmentDays.get(date) || 0) + value);
  }
  const index = new Map();
  for (const [code, days] of daily) {
    let cumulative = 0;
    const entries = [...days.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, value]) => {
      cumulative += value;
      return { date, cumulative };
    });
    index.set(code, entries);
  }
  return index;
}

export function queryEquipmentRangeIndex(index, from = INFORME_COSTOS_MIN_DATE, to = "2026-12-31") {
  const start = clampInformeCostosDate(from);
  const end = clampInformeCostosDate(to, "2026-12-31");
  const beforeStart = `${start.slice(0, 8)}${String(Math.max(0, Number(start.slice(8, 10)) - 1)).padStart(2, "0")}`;
  const totals = new Map();
  for (const [code, entries] of index || []) {
    const endIndex = upperBound(entries, end) - 1;
    if (endIndex < 0) continue;
    const startIndex = upperBound(entries, beforeStart) - 1;
    const value = entries[endIndex].cumulative - (startIndex >= 0 ? entries[startIndex].cumulative : 0);
    if (value > 0) totals.set(code, value);
  }
  return totals;
}

export function prepareRop02CostRows(rows) {
  return (Array.isArray(rows) ? rows : []).map(row => ({
    ...row,
    _dateKey: String(row?.fecha || "").slice(0, 10),
    _canonicalEquipment: maintenanceEquipmentCode(row),
    _effectiveHours: ["OD", "FS", "EM"].includes(String(row?.estado || "").trim().toUpperCase())
      ? 0
      : Math.max(0, Number(row?.horas) || 0),
  }));
}
