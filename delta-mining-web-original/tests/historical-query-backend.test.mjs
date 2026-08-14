import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const backend=fs.readFileSync(new URL("../AppsScript_Delta_Mining_OPS_FINAL.txt",import.meta.url),"utf8");

test("Apps Script expone consultas filtradas y ficha por equipo",()=>{
  assert.match(backend,/action === "query_dataset"/);
  assert.match(backend,/action === "get_equipment_history"/);
  assert.match(backend,/action === "get_rop02_latest_by_equipment_project"/);
});

test("la consulta filtra antes de paginar y devuelve total y hasMore",()=>{
  const start=backend.indexOf("function handleQueryDataset_");
  const end=backend.indexOf("function handleEquipmentHistory_",start);
  const source=backend.slice(start,end);
  assert.ok(source.indexOf("readFilteredQuerySource_")<source.indexOf("rows.slice"));
  assert.match(source,/total:total/);
  assert.match(source,/hasMore:/);
  assert.match(source,/nextOffset:/);
});

test("el router anual contempla cruces de rango sin acoplar React a hojas",()=>{
  assert.match(backend,/function getRop02SourcesForRange_/);
  assert.match(backend,/for\(var year=startYear;year<=endYear;year\+\+\)/);
  assert.match(backend,/ROP02_PARTITIONS_BY_YEAR_/);
});

test("cada fuente se lee masivamente una vez para filtrar en Apps Script",()=>{
  const start=backend.indexOf("function readFilteredQuerySource_");
  const end=backend.indexOf("function handleQueryDataset_",start);
  const source=backend.slice(start,end);
  assert.match(source,/getRange\(headerRow\+1,1,lastRow-headerRow,lastCol\)\.getValues\(\)/);
  assert.doesNotMatch(source,/getValue\(\)/);
});

test("backend ordena antes de paginar y expone metricas",()=>{
  const start=backend.indexOf("function handleQueryDataset_");
  const end=backend.indexOf("function handleEquipmentHistory_",start);
  const source=backend.slice(start,end);
  assert.ok(source.indexOf("rows.sort")<source.indexOf("rows.slice"));
  assert.match(source,/sortDirection/);
  assert.match(source,/rowsRead:/);
  assert.match(source,/rowsFiltered:/);
  assert.match(source,/backendMs:/);
});

test("aceleradores tienen backfill manual e incremento selectivo",()=>{
  assert.match(backend,/function rebuildRop02MonthlySummary\(/);
  assert.match(backend,/function refreshRop02MonthlyPeriod_\(/);
  assert.match(backend,/function rebuildRop02LatestSnapshot\(/);
  assert.match(backend,/function refreshRop02LatestEquipmentProject_\(/);
  assert.match(backend,/ROP02_RESUMEN_MENSUAL/);
  assert.match(backend,/ROP02_ULTIMO_ESTADO/);
});
