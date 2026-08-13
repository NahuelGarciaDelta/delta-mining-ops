import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/modules/oficina-tecnica/OficinaTecnicaModule.jsx", import.meta.url), "utf8");

test("Atraso ROP02 incluye los filtros completos de fecha y equipo", () => {
  const start = source.indexOf("function ViewAtrasoROP02");
  const end = source.indexOf("function ViewControlROP02", start);
  const view = source.slice(start, end);

  assert.match(view, />Por día<\/TabBtn>/);
  assert.match(view, />Por período<\/TabBtn>/);
  assert.match(view, /<PeriodMonthYear fechaD=\{fechaDesde\} fechaH=\{fechaHasta\}/);
  ["Fecha", "Desde", "Hasta", "Tipo de Máquina", "Proyecto", "Máquina"].forEach(label => {
    assert.match(view, new RegExp(`label="${label}"`), label);
  });
});

test("Atraso ROP02 aplica los filtros también a tarjetas, tablas y exportaciones", () => {
  assert.match(source, /const atrasosFiltrados=useMemo/);
  assert.match(source, /const saltosFiltrados=useMemo/);
  assert.match(source, /const resumenFiltrado=useMemo/);
  assert.match(source, /excelFromCols\(cols\.filter\(c=>c\.key!=="accion"\),atrasadosPendientes/);
  assert.match(source, /excelFromCols\(colsSaltos\.filter\(c=>c\.key!=="accion"\),saltosFiltrados/);
});

test("Atraso consulta snapshot y ventana reciente sin precargar el historial global", () => {
  const viewSources = fs.readFileSync(new URL("../src/config/viewSources.js", import.meta.url), "utf8");
  assert.match(source,/getRop02LatestByEquipmentProject\(\{\}\)/);
  assert.match(source,/getRop02\(\{desde,hasta:reference,limit:"all"/);
  assert.match(source,/ViewAtrasoROP02 rop02All=\{rop02ControlAll\} onLegacyFallback=\{onLoadAll\}/);
  assert.match(viewSources,/atrasoROP02:\[\]/);
});
