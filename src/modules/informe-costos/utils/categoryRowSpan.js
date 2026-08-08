const normalizeCategory = value => String(value || "S/D")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim()
  .replace(/\s+/g, " ")
  .toUpperCase();

export function buildVisibleCategoryRowSpans(rows) {
  const source = Array.isArray(rows) ? rows : [];
  const out = [];
  for (let start = 0; start < source.length;) {
    const key = normalizeCategory(source[start]?.tipo);
    let end = start + 1;
    while (end < source.length && normalizeCategory(source[end]?.tipo) === key) end++;
    for (let index = start; index < end; index++) {
      out.push({
        ...source[index],
        _firstTipoDisplay: index === start,
        _grupoSizeDisplay: index === start ? end - start : 0,
      });
    }
    start = end;
  }
  return out;
}
