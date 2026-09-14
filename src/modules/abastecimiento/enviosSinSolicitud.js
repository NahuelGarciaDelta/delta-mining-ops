const normalizeHeader = (value) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function pickRaw(row, names = []) {
  const source = row?.row_data && typeof row.row_data === "object" ? row.row_data : row;
  const keys = Object.keys(source || {});
  for (const name of names) {
    const wanted = normalizeHeader(name);
    const found = keys.find((key) => normalizeHeader(key) === wanted);
    if (found !== undefined) return source[found];
  }
  return "";
}

export function buildEnviosSinSolicitudRows({
  raba03Rows = [],
  remitos = [],
  normCode,
  toNumber,
  normalizeCentroCosto,
  parseChronoDateMs,
} = {}) {
  if (
    typeof normCode !== "function" ||
    typeof toNumber !== "function" ||
    typeof normalizeCentroCosto !== "function" ||
    typeof parseChronoDateMs !== "function"
  ) {
    return [];
  }

  // No inferir resultados hasta que la fuente RABA03 real esté cargada.
  if (!Array.isArray(raba03Rows) || raba03Rows.length === 0) return [];

  const links = raba03Rows
    .map((row) => ({
      codigo: normCode(
        pickRaw(row, [
          "Código de articulo",
          "Código de artículo",
          "Codigo de articulo",
          "Codigo de artículo",
          "Código artículo",
          "Codigo articulo",
          "Código",
          "Codigo",
        ]),
      ),
      proyecto: normalizeCentroCosto(
        pickRaw(row, ["Centro de Costo", "Centro de costo", "Proyecto", "CC"]),
      ),
      remito: String(
        pickRaw(row, [
          "Nº Remito",
          "N° Remito",
          "N Remito",
          "Numero Remito",
          "Número Remito",
        ]) || "",
      ).trim(),
      fechaSolicitud: pickRaw(row, [
        "Fecha de solicitud",
        "Fecha solicitud",
        "F. Sol.",
      ]),
    }))
    .filter((link) => link.codigo && link.proyecto && link.remito);

  const remitoCellContains = (cellValue, remitoNumber) => {
    const cellKey = normCode(cellValue);
    const remitoKey = normCode(remitoNumber);
    if (!cellKey || !remitoKey) return false;
    return remitoKey.length < 6 ? cellKey === remitoKey : cellKey.includes(remitoKey);
  };

  const unmatched = [];

  (remitos || []).forEach((remito, remitoIndex) => {
    const proyecto = normalizeCentroCosto(
      remito?.proyecto ||
        remito?.observaciones ||
        remito?.destino ||
        remito?.centroCosto ||
        remito?.origen ||
        "",
    );
    const numeroRemito = String(remito?.comprobante || "").trim();
    const fechaEnvio = remito?.fecha || "";
    const fechaEnvioMs = parseChronoDateMs(fechaEnvio);

    (remito?.items || []).forEach((item, itemIndex) => {
      const code = normCode(item?.codigo);
      const cantidad = toNumber(item?.cantidad);
      if (!code || cantidad <= 0 || !numeroRemito) return;

      const linked = links.some((link) => {
        if (
          link.codigo !== code ||
          link.proyecto !== proyecto ||
          !remitoCellContains(link.remito, numeroRemito)
        ) {
          return false;
        }
        const fechaSolicitudMs = parseChronoDateMs(link.fechaSolicitud);
        return !(fechaSolicitudMs && fechaEnvioMs && fechaSolicitudMs > fechaEnvioMs);
      });

      if (linked) return;

      unmatched.push({
        id: `${remito?.id || numeroRemito || "remito"}-${itemIndex}-${code}`,
        codigoArticulo: String(item?.codigo || "").trim() || code,
        descripcion: String(item?.descripcion || "").trim(),
        proyecto: proyecto || "SIN PROYECTO",
        cantidadEnviada: cantidad,
        fechaEnvio,
        numeroRemito,
        _remitoIndex: remitoIndex,
        _itemIndex: itemIndex,
      });
    });
  });

  return unmatched.sort((a, b) => {
    const fa = parseChronoDateMs(a.fechaEnvio);
    const fb = parseChronoDateMs(b.fechaEnvio);
    if (fa !== fb) return fb - fa;
    const codeCmp = String(a.codigoArticulo || "").localeCompare(
      String(b.codigoArticulo || ""),
      "es",
      { numeric: true, sensitivity: "base" },
    );
    if (codeCmp) return codeCmp;
    if (a._remitoIndex !== b._remitoIndex) return a._remitoIndex - b._remitoIndex;
    return a._itemIndex - b._itemIndex;
  });
}
