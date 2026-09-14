import test from "node:test";
import assert from "node:assert/strict";
import { buildEnviosSinSolicitudRows } from "../src/modules/abastecimiento/enviosSinSolicitud.js";

const normCode = (value) =>
  String(value || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "")
    .trim();

const toNumber = (value) => Number(String(value ?? "0").replace(",", ".")) || 0;
const normalizeCentroCosto = (value) => {
  const text = String(value || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (text.includes("JOSE MARIA") || /\bJM\b/.test(text)) return "JOSE MARIA";
  if (text.includes("FILO DEL SOL") || /\bFDS\b/.test(text) || /\bFS\b/.test(text)) return "FILO DEL SOL";
  return text.trim();
};
const parseChronoDateMs = (value) => {
  const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() : 0;
};

const run = (rows, remitos) =>
  buildEnviosSinSolicitudRows({
    rows,
    remitos,
    normCode,
    toNumber,
    normalizeCentroCosto,
    parseChronoDateMs,
  });

test("no usa solicitudes históricas sin vínculo explícito para ocultar un envío", () => {
  const rows = [
    {
      _raba03ExplicitLinksLoaded: true,
      numeroRemitoFuente: "",
      codigoArticulo: "30",
      centroCosto: "FILO DEL SOL",
      fechaSolicitud: "2026-07-01",
    },
  ];
  const remitos = [
    {
      id: "r1",
      comprobante: "TIN 00001-00000604",
      fecha: "2026-09-07",
      proyecto: "FILO DEL SOL",
      items: [{ codigo: "30", descripcion: "Insumo", cantidad: 5 }],
    },
  ];

  const result = run(rows, remitos);
  assert.equal(result.length, 1);
  assert.equal(result[0].numeroRemito, "TIN 00001-00000604");
  assert.equal(result[0].cantidadEnviada, 5);
});

test("reconoce un remito explícitamente asociado en RABA03", () => {
  const rows = [
    {
      _raba03ExplicitLinksLoaded: true,
      numeroRemitoFuente: "TIN 00001-00000583 / TIN 00001-00000604",
      codigoArticulo: "30",
      centroCosto: "FILO DEL SOL",
    },
  ];
  const remitos = [
    {
      id: "r1",
      comprobante: "TIN 00001-00000604",
      fecha: "2026-09-07",
      proyecto: "FILO DEL SOL",
      items: [{ codigo: "30", descripcion: "Insumo", cantidad: 5 }],
    },
  ];

  assert.deepEqual(run(rows, remitos), []);
});

test("mismo remito no alcanza si código o proyecto no coinciden", () => {
  const rows = [
    {
      _raba03ExplicitLinksLoaded: true,
      numeroRemitoFuente: "TIN 00001-00000604",
      codigoArticulo: "999",
      centroCosto: "FILO DEL SOL",
    },
    {
      _raba03ExplicitLinksLoaded: true,
      numeroRemitoFuente: "TIN 00001-00000604",
      codigoArticulo: "30",
      centroCosto: "JOSE MARIA",
    },
  ];
  const remitos = [
    {
      id: "r1",
      comprobante: "TIN 00001-00000604",
      fecha: "2026-09-07",
      proyecto: "FILO DEL SOL",
      items: [{ codigo: "30", descripcion: "Insumo", cantidad: 2 }],
    },
  ];

  assert.equal(run(rows, remitos).length, 1);
});

test("un cache viejo sin marcador explícito no genera falsos positivos", () => {
  const rows = [{ codigoArticulo: "30", centroCosto: "FILO DEL SOL" }];
  const remitos = [
    {
      id: "r1",
      comprobante: "TIN 00001-00000604",
      fecha: "2026-09-07",
      proyecto: "FILO DEL SOL",
      items: [{ codigo: "30", cantidad: 2 }],
    },
  ];

  assert.deepEqual(run(rows, remitos), []);
});

test("ordena los envíos sin solicitud desde el más reciente", () => {
  const rows = [{ _raba03ExplicitLinksLoaded: true, numeroRemitoFuente: "" }];
  const remitos = [
    {
      id: "old",
      comprobante: "TIN 00001-00000601",
      fecha: "2026-09-01",
      proyecto: "JOSE MARIA",
      items: [{ codigo: "20", cantidad: 1 }],
    },
    {
      id: "new",
      comprobante: "TIN 00001-00000602",
      fecha: "2026-09-10",
      proyecto: "JOSE MARIA",
      items: [{ codigo: "10", cantidad: 1 }],
    },
  ];

  const result = run(rows, remitos);
  assert.equal(result[0].numeroRemito, "TIN 00001-00000602");
  assert.equal(result[1].numeroRemito, "TIN 00001-00000601");
});
