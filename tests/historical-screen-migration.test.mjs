import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=path=>fs.readFileSync(new URL(path,import.meta.url),"utf8");
const sources=read("../src/config/viewSources.js");
const app=read("../src/App.jsx");

test("Bienvenida recibe ROP02 y RMA15 hidratados sin snapshot bloqueante",()=>{
  const view=read("../src/modules/home/ViewBienvenida.jsx");
  assert.match(sources,/bienvenida:\["rop02_fs","rop02_jm","rma15_fs","rma15_jm"/);
  assert.match(sources,/bienvenida:\[[^\]]*"rop05"/);
  assert.match(view,/rop02All/);
  assert.doesNotMatch(app,/await getDashboardSnapshot\(/);
});

test("Dashboard reutiliza fuentes normalizadas del estado global",()=>{
  const view=read("../src/modules/home/ExecutiveDashboard.jsx");
  assert.match(sources,/dashboard:\[[^\]]*"rop02_fs"[^\]]*"rop02_jm"[^\]]*"rma15_fs"[^\]]*"rma15_jm"/);
  assert.match(view,/rop02/);
  assert.match(app,/rawSourcesRef/);
  assert.match(app,/planVersionedRefresh/);
});

test("Informe de Costos está aislado y recibe el snapshot hidratado",()=>{
  const route=read("../src/modules/informe-costos/InformeCostosRoute.jsx");
  assert.match(route,/React\.lazy/);
  assert.match(route,/InformeCostosBoundary/);
  assert.match(route,/MemoViewCostosMant/);
  assert.match(sources,/costosMant:\["insumos","rma15_fs","rma15_jm","lista_equipos"\]/);
});

test("ROP02, ROP05 y RMA15 conservan sus fuentes en el planificador",()=>{
  assert.match(sources,/rop02:\["rop02_fs","rop02_jm","rop02_filosur","rop02_zorro"\]/);
  assert.match(sources,/rop05:\["rop05"\]/);
  assert.match(sources,/mant:\["insumos","rma15_fs","rma15_jm"\]/);
  assert.match(app,/loadSources/);
  assert.match(app,/fetchOneSource/);
});
