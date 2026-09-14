export function buildEnviosSinSolicitudRows({
  rows = [],
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

  // Un cache anterior a esta corrección no contiene los campos explícitos de
  // RABA03. En ese caso no inferimos resultados hasta que llegue la lectura
  // fresca, evitando clasificar todos los remitos como "sin solicitud".
  const explicitSourceReady = (rows || []).some(
    (row) => row && row._raba03ExplicitLinksLoaded === true,
  );
  if (!explicitSourceReady) return [];

  const explicitLinks = (rows || []).filter((row) =>
    String(row?.numeroRemitoFuente || "").trim(),
  );

  const remitoCellContains = (cellValue, remitoNumber) => {
    const cellKey = normCode(cellValue);
    const remitoKey = normCode(remitoNumber);
    if (!cellKey || !remitoKey) return false;
    // Los remitos normales tienen el formato TIN 00001-00000xxx. Para valores
    // excepcionalmente cortos exigimos igualdad exacta para evitar falsos positivos.
    return remitoKey.length < 6
      ? cellKey === remitoKey
      : cellKey.includes(remitoKey);
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
      if (!code || cantidad <= 0) return;

      const linked = explicitLinks.some((row) => {
        if (
          normCode(row?.codigoArticulo) !== code ||
          normalizeCentroCosto(row?.centroCosto) !== proyecto ||
          !remitoCellContains(row?.numeroRemitoFuente, numeroRemito)
        ) {
          return false;
        }
        const fechaSolicitudMs = parseChronoDateMs(row?.fechaSolicitud);
        // Si la solicitud fue creada después del envío, el artículo sí fue
        // enviado sin solicitud previa y debe permanecer en esta vista.
        return !(
          fechaSolicitudMs &&
          fechaEnvioMs &&
          fechaSolicitudMs > fechaEnvioMs
        );
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
