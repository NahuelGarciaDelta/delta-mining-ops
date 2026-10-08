import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const backendPath=new URL("../AppsScript_Delta_Mining_OPS_FINAL.txt",import.meta.url);
const backend=fs.existsSync(backendPath)?fs.readFileSync(backendPath,"utf8"):null;
// The live GAS backend is intentionally not checked in to this public frontend repo.
// Run these contract assertions when the authoritative script is provided locally.

test("Apps Script expone consultas filtradas y ficha por equipo",{skip:backend===null?"Apps Script externo no disponible en checkout público":false},()=>{
  assert.match(backend,/action === "query_dataset"/);
  assert.match(backend,/action === "get_equipment_history"/);
  assert.match(backend,/action === "get_rop02_latest_by_equipment_project"/);
});

test("la consulta filtra antes de paginar y devuelve total y hasMore",{skip:backend===null?"Apps Script externo no disponible en checkout público":false},()=>{
  const start=backend.indexOf("function handleQueryDataset_");
  const end=backend.indexOf("function handleEquipmentHistory_",start);
  const source=backend.slice(start,end);
  assert.ok(source.indexOf("readFilteredQuerySource_")<source.indexOf("rows.slice"));
  assert.match(source,/total:total/);
  assert.match(source,/hasMore:/);
  assert.match(source,/nextOffset:/);
});

test("el router anual contempla cruces de rango sin acoplar React a hojas",{skip:backend===null?"Apps Script externo no disponible en checkout público":false},()=>{
  assert.match(backend,/function getRop02SourcesForRange_/);
  assert.match(backend,/for\(var year=startYear;year<=endYear;year\+\+\)/);
  assert.match(backend,/ROP02_PARTITIONS_BY_YEAR_/);
});

test("cada fuente se lee masivamente una vez para filtrar en Apps Script",{skip:backend===null?"Apps Script externo no disponible en checkout público":false},()=>{
  const start=backend.indexOf("function readFilteredQuerySource_");
  const end=backend.indexOf("function handleQueryDataset_",start);
  const source=backend.slice(start,end);
  assert.match(source,/getRange\(headerRow\+1,1,lastRow-headerRow,lastCol\)\.getValues\(\)/);
  assert.doesNotMatch(source,/getValue\(\)/);
});

test("backend ordena antes de paginar y expone metricas",{skip:backend===null?"Apps Script externo no disponible en checkout público":false},()=>{
  const start=backend.indexOf("function handleQueryDataset_");
  const end=backend.indexOf("function handleEquipmentHistory_",start);
  const source=backend.slice(start,end);
  assert.ok(source.indexOf("rows.sort")<source.indexOf("rows.slice"));
  assert.match(source,/sortDirection/);
  assert.match(source,/rowsRead:/);
  assert.match(source,/rowsFiltered:/);
  assert.match(source,/backendMs:/);
});

test("aceleradores tienen backfill manual e incremento selectivo",{skip:backend===null?"Apps Script externo no disponible en checkout público":false},()=>{
  assert.match(backend,/function rebuildRop02MonthlySummary\(/);
  assert.match(backend,/function refreshRop02MonthlyPeriod_\(/);
  assert.match(backend,/function rebuildRop02LatestSnapshot\(/);
  assert.match(backend,/function refreshRop02LatestEquipmentProject_\(/);
  assert.match(backend,/ROP02_RESUMEN_MENSUAL/);
  assert.match(backend,/ROP02_ULTIMO_ESTADO/);
});
