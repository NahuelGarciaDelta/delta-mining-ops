const EXCLUDED_HOUR_STATES = new Set(["OD", "FS", "EM"]);

function asFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isoDate(value) {
  const raw = String(value || "").trim();
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const local = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return local ? `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}` : "";
}

export function countCalendarMonths(from, to) {
  const start = String(from || "").slice(0, 7);
  const end = String(to || "").slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(start) || !/^\d{4}-\d{2}$/.test(end) || start > end) return 0;
  const [startYear, startMonth] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  if (startMonth < 1 || startMonth > 12 || endMonth < 1 || endMonth > 12) return 0;
  return (endYear - startYear) * 12 + endMonth - startMonth + 1;
}

export function buildMonthlyAccumulatedHours(rows, { from, to, resolveIdentity }) {
  const totals = new Map();
  const start = isoDate(from);
  const end = isoDate(to);
  if (!start || !end || start > end || typeof resolveIdentity !== "function") return totals;

  for (const row of Array.isArray(rows) ? rows : []) {
    const date = row?._dateKey || isoDate(row?.fecha);
    const status = String(row?.estado || "").trim().toUpperCase();
    const hours = asFiniteNumber(row?._effectiveHours ?? row?.horas);
    if (!date || date < start || date > end || hours === null || hours <= 0 || EXCLUDED_HOUR_STATES.has(status)) continue;
    const rawCode = row?.maquina ?? row?.equipo ?? row?.interno ?? row?.codigo ?? "";
    const identity = String(resolveIdentity(rawCode) || "").trim();
    if (!identity) continue;
    totals.set(identity, (totals.get(identity) || 0) + hours);
  }
  return totals;
}

export function monthlyAccumulatedCostRates({ totalB = 0, averageMonthlyCost = 0, labor = 0, effectiveHours = 0, months = 0 } = {}) {
  const total = Number(totalB) || 0;
  const average = Number(averageMonthlyCost) || 0;
  const manpower = Number(labor) || 0;
  const hours = Number(effectiveHours) || 0;
  const monthCount = Number(months) || 0;
  const averageMonthlyHours = monthCount > 0 ? hours / monthCount : 0;
  return {
    effectiveHours: hours,
    averageMonthlyHours,
    monthlyUsdPerHour: averageMonthlyHours > 0 ? (average + manpower) / averageMonthlyHours : 0,
    accumulatedUsdPerHour: (hours > 0 ? total / hours : 0) + (averageMonthlyHours > 0 ? manpower / averageMonthlyHours : 0),
  };
}
