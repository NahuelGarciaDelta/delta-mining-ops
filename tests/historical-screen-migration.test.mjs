import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=path=>fs.readFileSync(new URL(path,import.meta.url),"utf8");
const sources=read("../src/config/viewSources.js");

test("Bienvenida usa el snapshot y deja de precargar ROP02 completo",()=>{
  const view=read("../src/modules/home/ViewBienvenida.jsx");
  assert.match(view,/getRop02LatestByEquipmentProject/);
  assert.match(view,/getRma15OpenOtSummary/);
  assert.match(sources,/bienvenida:\["lista_equipos"\]/);
});

test("Dashboard usa resumen mensual y consultas por rango",()=>{
  const view=read("../src/modules/home/ExecutiveDashboard.jsx");
  assert.match(view,/getRop02MonthlySummary/);
  assert.match(view,/getRop02\(\{desde,hasta,limit:"all"/);
  assert.match(view,/getRma15\(\{desde,hasta,limit:"all"/);
  assert.match(sources,/dashboard:\["insumos"\]/);
});

test("Informe de Costos consulta el rango activo y universo compacto 2026",()=>{
  const route=read("../src/modules/informe-costos/InformeCostosRoute.jsx");
  assert.match(route,/getRma15EquipmentUniverse/);
  assert.match(route,/fechaHistoricaDesde/);
  assert.match(route,/fechaDCostoMensual/);
  assert.match(sources,/costosMant:\["insumos","lista_equipos"\]/);
});

test("ROP02 ROP05 y RMA15 usan controlador paginado y exportación por bloques",()=>{
  const office=read("../src/modules/oficina-tecnica/OficinaTecnicaModule.jsx");
  const maintenance=read("../src/modules/mantenimiento/MantenimientoRoute.jsx");
  assert.match(office,/createHistoricalPagedController/);
  assert.match(office,/fetchAllDatasetPages\(remoteDataset/);
  assert.match(maintenance,/loadFirst\("rma15",params\)/);
  assert.match(maintenance,/fetchAllDatasetPages\("rma15",params/);
  assert.match(sources,/rop02:\["lista_equipos"\]/);
  assert.match(sources,/rop05:\[\]/);
  assert.match(sources,/mant:\["insumos"\]/);
});
