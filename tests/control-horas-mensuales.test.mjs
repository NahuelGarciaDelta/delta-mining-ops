import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { getHoursExtremes } from "../src/modules/analytics/hoursExtremes.js";

const appSource=fs.readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
const analyticsSource=fs.readFileSync(new URL("../src/modules/analytics/OperationalAnalytics.jsx",import.meta.url),"utf8");

test("la navegación usa Control de horas mensuales",()=>{
  assert.match(appSource,/label:"Control de horas mensuales"/);
  assert.match(appSource,/titles\.cambiosTurno="Control de horas mensuales"/);
});

test("la vista elimina Orden de grupos y Duración del turno",()=>{
  assert.doesNotMatch(analyticsSource,/title="Orden de grupos"/);
  assert.doesNotMatch(analyticsSource,/label="Duración del turno"/);
});

test("la vista conserva tabla, filtros, Excel y calendario",()=>{
  assert.match(analyticsSource,/title="Equipos al fin de turno"/);
  for(const label of ["Mes","Año","Proyecto","Equipo","Tipo de Máquina"])assert.match(analyticsSource,new RegExp(`label="${label}"`));
  assert.match(analyticsSource,/Equipos_al_fin_de_turno/);
  assert.match(analyticsSource,/title="Calendario de cambios de turno"/);
});

test("máximo y mínimo usan las filas visibles y el mínimo excluye cero e inválidos",()=>{
  const visibles=[
    {maquina:"EQ-1",horas:0},
    {maquina:"EQ-2",horas:""},
    {maquina:"EQ-3",horas:42},
    {maquina:"EQ-4",horas:8},
    {maquina:"EQ-5",horas:"inválido"},
  ];
  assert.deepEqual(getHoursExtremes(visibles),{max:visibles[2],min:visibles[3]});
  assert.match(analyticsSource,/getHoursExtremes\(mesCorrienteInfo\.equipos\)/);
});

test("máximo y mínimo responden al conjunto resultante de los filtros",()=>{
  const todos=[{maquina:"A",horas:120},{maquina:"B",horas:30},{maquina:"C",horas:60}];
  assert.deepEqual(getHoursExtremes(todos),{max:todos[0],min:todos[1]});
  assert.deepEqual(getHoursExtremes(todos.filter(row=>row.maquina!=="A")),{max:todos[2],min:todos[1]});
  assert.deepEqual(getHoursExtremes([]),{max:null,min:null});
});
