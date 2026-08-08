export function cleanEquipmentCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*JM\s*$/i, "")
    .replace(/\s+JM\s*$/i, "")
    .trim();
}

export function canonicalEquipmentCode(value) {
  return cleanEquipmentCode(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

export function normalizeEquipmentMatchKey(value) {
  return canonicalEquipmentCode(value);
}

export function sameEquipmentCode(a, b) {
  const aa = canonicalEquipmentCode(a);
  const bb = canonicalEquipmentCode(b);
  return Boolean(aa && bb && aa === bb);
}

const MAINTENANCE_COST_EXCLUDED_CODES = new Set(["CFN01010"]);

export function isExcludedFromMaintenanceCostReport(value) {
  return MAINTENANCE_COST_EXCLUDED_CODES.has(canonicalEquipmentCode(value));
}

export function isCompactorEquipmentCode(value) {
  const code = canonicalEquipmentCode(value);
  return code.startsWith("RPC") || code.startsWith("ROD");
}

const normalizeEquipmentType = value => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim()
  .replace(/\s+/g, " ")
  .toUpperCase();

export function isCompactorEquipment({ code = "", type = "", category = "", description = "" } = {}) {
  if (isCompactorEquipmentCode(code)) return true;
  return [type, category, description].some(value => {
    const normalized = normalizeEquipmentType(value);
    return normalized.includes("RODILLO") || normalized.includes("COMPACTADOR") || normalized.includes("COMPACTACION");
  });
}

export function isMaintenanceCostMachine({ code = "", type = "", category = "", description = "" } = {}) {
  if (isCompactorEquipment({ code, type, category, description })) return true;
  const normalized = normalizeEquipmentType(type || category || description);
  return ["EXCAVADORA", "TOPADORA", "MOTONIVELADORA", "CARGADORA", "CARGADOR FRONTAL", "RETROPALA", "MINICARGADORA"]
    .some(machineType => normalized.includes(machineType));
}
