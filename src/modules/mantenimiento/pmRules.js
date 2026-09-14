export const TRUCK_PM_INTERVAL_HOURS = 500;
export const TRUCK_PM_ALERT_FROM_HOURS = 400;
export const TRUCK_PM_OVERDUE_FROM_HOURS = 500;

const numeric = value => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const normalizeFamily = value => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, " ")
  .trim();

export function isCanonicalTruckFamily(value) {
  // CAMIONETA no debe entrar: después de CAMION exigimos espacio o fin de cadena.
  return /^CAMION(?:\s|$)/.test(normalizeFamily(value));
}

export function positiveOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function selectMaintenanceCounter({ horometerCandidates = [], mileageCandidates = [] } = {}, { isTruck = false } = {}) {
  const maxValue = values => Math.max(0, ...(values || []).map(numeric));
  const horometer = maxValue(horometerCandidates);
  if (isTruck) return horometer;
  return Math.max(horometer, maxValue(mileageCandidates));
}

export function getNextTruckPmHour(currentHour, lastPmHour = 0) {
  const current = Math.max(0, numeric(currentHour));
  const last = Math.max(0, numeric(lastPmHour));
  const base = Math.max(current, last);
  if (!base) return 0;

  let target = Math.ceil(base / TRUCK_PM_INTERVAL_HOURS) * TRUCK_PM_INTERVAL_HOURS;
  if (target <= base) target += TRUCK_PM_INTERVAL_HOURS;
  return target;
}

export function hasInconsistentPmReadings(currentHour, lastPmHour) {
  const current = Math.max(0, numeric(currentHour));
  const last = Math.max(0, numeric(lastPmHour));
  return current > 0 && last > 0 && last > current;
}
