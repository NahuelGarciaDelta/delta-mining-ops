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

test("Atraso recibe el historial ROP02 global antes del recorte por proyecto", () => {
  const appSource = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const viewSources = fs.readFileSync(new URL("../src/config/viewSources.js", import.meta.url), "utf8");
  assert.match(appSource,/setRop02ControlAll\(normalizedRop02\)/);
  assert.match(appSource,/rop02ControlAll=\{rop02ControlAll\}/);
  assert.match(source,/ViewAtrasoROP02 rop02All=\{rop02ControlAll\}/);
  assert.match(viewSources,/atrasoROP02:\["rop02_fs","rop02_jm","rop02_filosur","rop02_zorro"\]/);
});
