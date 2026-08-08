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
