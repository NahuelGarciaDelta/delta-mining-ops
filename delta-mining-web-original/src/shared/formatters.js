/** Formatea números con el mismo criterio visual histórico de la app. */
export function fmtNum(value) {
  const number = Number(value) || 0;
  return number.toLocaleString("es-AR", { maximumFractionDigits: 1 });
}

/** Convierte números escritos en formato argentino o internacional. */
export function toNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  let text = String(value).trim().replace(/[^\d,.-]/g, "");
  if (!text) return 0;

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    text = lastComma > lastDot
      ? text.replace(/\./g, "").replace(",", ".")
      : text.replace(/,/g, "");
  } else if (lastComma !== -1) {
    const decimals = text.length - lastComma - 1;
    text = decimals > 0 && decimals <= 2
      ? text.replace(/\./g, "").replace(",", ".")
      : text.replace(/,/g, "");
  } else if (lastDot !== -1) {
    const decimals = text.length - lastDot - 1;
    text = decimals > 0 && decimals <= 2
      ? text.replace(/,/g, "")
      : text.replace(/\./g, "");
  }
  return Number.parseFloat(text) || 0;
}

/** Normaliza fechas a YYYY-MM-DD y descarta fechas inválidas. */
export function normDate(value) {
  if (!value) return "";
  const text = String(value).trim();
  let iso = "";
  const latin = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (latin) {
    iso = `${latin[3]}-${latin[2].padStart(2, "0")}-${latin[1].padStart(2, "0")}`;
  } else {
    const standard = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (standard) iso = text.slice(0, 10);
    else {
      const parsed = new Date(text);
      if (!Number.isNaN(parsed.getTime())) iso = parsed.toISOString().slice(0, 10);
    }
  }
  if (!iso) return "";

  let [year, month, day] = iso.split("-").map(Number);
  if (month > 12 && day >= 1 && day <= 12) [month, day] = [day, month];
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
