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
  const canonical=cleanEquipmentCode(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "");
  return canonical==="RCP0039"?"RPC0039":canonical;
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

const MAINTENANCE_COST_CODE_ALIASES = new Map([
  ["RPC0039", "RPC-0039"],
  ["CFN0101", "PCA-0101"],
  ["CFN0041", "PCA-0081"],
  ["CFN0043", "PCA-0093"],
  ["CFN0044", "PCA-0095"],
  ["CFN0045", "PCA-0095"],
  ["EXC0014", "EXC-0034"],
  ["EXC0019", "EXC-0048"],
  ["MOT0024", "MOT-0047"],
  ["RTP0010", "RTP-0016"],
  ["RTP0012", "RTP-0024"],
  ["TOP0014", "TOP-0032"],
  ["TOP0059", "TOP-0058"],
]);

export function resolveEquipmentCodeAlias(value) {
  const alias = MAINTENANCE_COST_CODE_ALIASES.get(canonicalEquipmentCode(value));
  if (alias) return alias;
  return String(value ?? "").trim();
}

export function isExcludedFromMaintenanceCostReport(value) {
  const code = canonicalEquipmentCode(value);
  return MAINTENANCE_COST_EXCLUDED_CODES.has(code);
}

export function isCompactorEquipmentCode(value) {
  const code = canonicalEquipmentCode(value);
  return code.startsWith("RPC") || code.startsWith("ROD");
}

export function isTruckEquipmentCode(value) {
  const code = canonicalEquipmentCode(value);
  // CAT no es un prefijo inequívoco: CAT es el generador y CAT-0073 es un
  // camión tractor. La Familia/Tipo resuelve esos casos; el código queda como
  // respaldo únicamente para prefijos que sí representan camiones siempre.
  return ["CAC", "CAR", "CAV", "CAA"].some(prefix => code.startsWith(prefix));
}

const normalizeEquipmentType = value => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim()
  .replace(/\s+/g, " ")
  .toUpperCase();

const firstEquipmentFamilyWord = value => normalizeEquipmentType(value).split(" ")[0] || "";

export function maintenanceCostTypeFromFamily({ code = "", family = "", type = "", category = "", description = "" } = {}) {
  const normalizedFamily = normalizeEquipmentType(family);
  const semanticType = normalizedFamily || normalizeEquipmentType(type || category || description);
  const firstWord = firstEquipmentFamilyWord(semanticType);

  // Familia es la fuente principal. CAMIONETA debe evaluarse antes que CAMION
  // y la palabra debe ser la primera, tal como está definida en Lista Maestra.
  if (firstWord === "CAMIONETA") return "CAMIONETAS";
  if (firstWord === "CAMION") return "CAMIONES";
  if (isCompactorEquipment({ code, type: semanticType })) return "COMPACTACION";
  if (semanticType.includes("MINICARGADORA")) return "MINICARGADORA";
  if (semanticType.includes("EXCAVADORA")) return "EXCAVADORA";
  if (semanticType.includes("CARGADORA FRONTAL") || semanticType === "CARGADORA") return "CARGADORA FRONTAL";
  if (semanticType.includes("MOTONIVELADORA")) return "MOTONIVELADORA";
  if (semanticType.includes("TOPADORA")) return "TOPADORA";
  if (semanticType.includes("RETROPALA")) return "RETROPALA";

  // Si hay Familia y no es vehicular, se respeta aunque el prefijo del interno
  // se parezca al de un camión (por ejemplo CAT con Familia GENERADOR).
  if (normalizedFamily) return "OTROS";

  const normalizedCode = cleanEquipmentCode(code);
  if (isTruckEquipmentCode(code) || firstEquipmentFamilyWord(type || category || description) === "CAMION") return "CAMIONES";
  if (/^CTA/.test(normalizedCode) || /^AG[0-9]/.test(normalizedCode) || /^AH[0-9]/.test(normalizedCode)) return "CAMIONETAS";
  if (/^MCA-/.test(normalizedCode) || /^MNC-/.test(normalizedCode)) return "MINICARGADORA";
  if (/^EXC-/.test(normalizedCode)) return "EXCAVADORA";
  if (/^PCA-/.test(normalizedCode) || /^CFN-/.test(normalizedCode)) return "CARGADORA FRONTAL";
  if (/^MOT-/.test(normalizedCode)) return "MOTONIVELADORA";
  if (/^TOP-/.test(normalizedCode)) return "TOPADORA";
  if (/^RTP-/.test(normalizedCode)) return "RETROPALA";
  return "OTROS";
}

export function isCompactorEquipment({ code = "", family = "", type = "", category = "", description = "" } = {}) {
  if (isCompactorEquipmentCode(code)) return true;
  return [family, type, category, description].some(value => {
    const normalized = normalizeEquipmentType(value);
    return normalized.includes("RODILLO") || normalized.includes("COMPACTADOR") || normalized.includes("COMPACTACION");
  });
}

export function isMaintenanceCostMachine({ code = "", family = "", type = "", category = "", description = "" } = {}) {
  const normalizedFamily = normalizeEquipmentType(family);
  if (normalizedFamily) {
    const firstWord = firstEquipmentFamilyWord(normalizedFamily);
    return firstWord !== "CAMION" && firstWord !== "CAMIONETA";
  }
  if (isCompactorEquipment({ code, type, category, description })) return true;
  const normalized = normalizeEquipmentType(type || category || description);
  return ["EXCAVADORA", "TOPADORA", "MOTONIVELADORA", "CARGADORA", "CARGADOR FRONTAL", "RETROPALA", "MINICARGADORA"]
    .some(machineType => normalized.includes(machineType));
}

export function isMaintenanceCostTruck({ code = "", family = "", type = "", category = "", description = "" } = {}) {
  const normalizedFamily = normalizeEquipmentType(family);
  if (normalizedFamily) return firstEquipmentFamilyWord(normalizedFamily) === "CAMION";
  if ([type, category, description].some(value => firstEquipmentFamilyWord(value) === "CAMION")) return true;
  return isTruckEquipmentCode(code);
}
