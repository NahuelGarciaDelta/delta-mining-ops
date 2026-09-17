import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=path=>fs.readFileSync(new URL(path,import.meta.url),"utf8");
const sources=read("../src/config/viewSources.js");

test("Bienvenida usa snapshot cuando corresponde y mantiene fuentes hidratadas para el filtro externo",()=>{
  const view=read("../src/modules/home/ViewBienvenida.jsx");
  assert.match(view,/getRop02LatestByEquipmentProject/);
  assert.match(view,/getRma15OpenOtSummary/);
  assert.match(view,/summaryDayFiltered/);
  assert.match(view,/Array\.isArray\(rop02All\)/);
  assert.match(sources,/bienvenida:\["rop02_fs","rop02_jm","rma15_fs","rma15_jm"/);
  assert.match(sources,/bienvenida:\[[^\]]*"rop05"/);
});

test("Dashboard calcula sobre las fuentes ya hidratadas por App",()=>{
  const view=read("../src/modules/home/ExecutiveDashboard.jsx");
  assert.doesNotMatch(view,/getRop02MonthlySummary/);
  assert.doesNotMatch(view,/createHistoricalPagedController/);
  assert.match(view,/rop02/);
  assert.match(view,/rma15/);
  assert.match(sources,/dashboard:\["rop02_fs","rop02_jm","rma15_fs","rma15_jm","rop05"/);
});

test("Informe de Costos congela un snapshot completo de las fuentes hidratadas",()=>{
  const route=read("../src/modules/informe-costos/InformeCostosRoute.jsx");
  assert.match(route,/buildReportSnapshot/);
  assert.match(route,/snapshotRef = React\.useRef\(null\)/);
  assert.match(route,/rma15: cloneRows\(props\.rma15\)/);
  assert.match(route,/rop02: cloneRows\(props\.rop02\)/);
  assert.match(route,/listaEquipos: cloneRows\(props\.listaEquipos\)/);
  assert.doesNotMatch(route,/getRma15EquipmentUniverse/);
  assert.match(sources,/costosMant:\["insumos","rma15_fs","rma15_jm","lista_equipos"\]/);
});

test("Oficina Técnica reutiliza históricos completos y Mantenimiento filtra RMA15 localmente",()=>{
  const office=read("../src/modules/oficina-tecnica/OficinaTecnicaModule.jsx");
  const maintenance=read("../src/modules/mantenimiento/MantenimientoRoute.jsx");
  assert.match(office,/fullDatasetCacheRef=useRef\(\{rop02:null,rop05:null\}\)/);
  assert.match(office,/fullDatasetPendingRef=useRef\(\{rop02:null,rop05:null\}\)/);
  assert.match(office,/const getter=dataset==="rop02"\?getRop02:getRop05/);
  assert.match(office,/limit:"all"/);
  assert.match(office,/const loadMoreRemote=useCallback\(\(\)=>Promise\.resolve\(\),\[\]\)/);
  assert.match(maintenance,/const baseRma15=React\.useMemo\(\(\)=>cloneRma15Rows\(props\.rma15\)/);
  assert.doesNotMatch(maintenance,/fetchAllDatasetPages/);
  assert.match(sources,/rop02:\["rop02_fs","rop02_jm","rop02_filosur","rop02_zorro"\]/);
  assert.match(sources,/rop05:\["rop05"\]/);
  assert.match(sources,/mant:\["insumos","rma15_fs","rma15_jm"\]/);
});
