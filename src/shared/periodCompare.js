export function previousComparablePeriod(from, to) {
  const a = new Date(`${from}T00:00:00`); const b = new Date(`${to}T00:00:00`);
  if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime()) || b < a) return null;
  const days = Math.round((b - a) / 86400000) + 1;
  const prevTo = new Date(a); prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - days + 1);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  return { from: iso(prevFrom), to: iso(prevTo), days };
}
export function percentDelta(current, previous) {
  const c = Number(current || 0); const p = Number(previous || 0);
  if (!Number.isFinite(c) || !Number.isFinite(p)) return null;
  if (p === 0) return c === 0 ? 0 : null;
  return ((c - p) / Math.abs(p)) * 100;
}
