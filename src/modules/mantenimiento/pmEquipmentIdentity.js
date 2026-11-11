// Canonical identifier for PM comparisons only. Preserve the original codes
// in Sheets and write payloads: this is never a persistence transformation.
export function normalizePmEquipmentCode(value) {
  const compact = String(value ?? "").toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "").trim();
  // The JM suffix is an alias only on actual machine internals, not on
  // arbitrary words, headers, project names or equipment descriptions.
  return /^([A-Z]{2,4}\d{4,6})JM$/.test(compact)
    ? compact.slice(0, -2)
    : compact;
}

// Keep the exact history identity for configuration and event records. The
// comparison normalizer above remains available for cross-source aliases.
export function normalizePmHistoryCode(value) {
  return String(value ?? "").toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "").trim();
}

const lastPmDate = config => {
  const value = String(config?.fechaUltimoPM ?? "").trim();
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return Number(iso[1]) * 10000 + Number(iso[2]) * 100 + Number(iso[3]);
  const local = value.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/);
  return local ? Number(local[3]) * 10000 + Number(local[2]) * 100 + Number(local[1]) : 0;
};

export function preferredPmConfig(left, right) {
  if (!left) return right;
  if (!right) return left;
  // A dated PM with a valid hour supersedes an older one regardless of
  // whether its internal carries the historical '-JM' suffix.
  const a = lastPmDate(left), b = lastPmDate(right);
  const ah = Number(left.horometroUltimoPM) || 0;
  const bh = Number(right.horometroUltimoPM) || 0;
  if (a > 0 && ah > 0 && b > 0 && bh > 0 && a !== b) return a > b ? left : right;
  if ((a > 0 && ah > 0) !== (b > 0 && bh > 0)) return a > 0 && ah > 0 ? left : right;
  if (a !== b) return a > b ? left : right;
  if (ah !== bh) return ah > bh ? left : right;
  // Prefer the un-suffixed modern code only on a genuine tie.
  const aLegacy = /[-_\s]JM$/i.test(String(left.interno || ""));
  const bLegacy = /[-_\s]JM$/i.test(String(right.interno || ""));
  if (aLegacy !== bLegacy) return aLegacy ? right : left;
  return left;
}
