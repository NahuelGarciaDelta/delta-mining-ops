import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {availableControlProjects,filterControlProjects,noControlProjectsSelected} from "../src/modules/oficina-tecnica/controlProjectScope.js";

const rop02=[
  {proyecto:"JOSE MARIA",fecha:"2026-10-10",maquina:"TOP-0032"},
  {proyecto:"FILO DEL SOL",fecha:"2026-10-10",maquina:"TOP-0033"},
  {proyecto:"EL ZORRO",fecha:"2026-10-11",maquina:"MOT-0011"},
  {proyecto:"EL FIERRO",fecha:"2026-10-11",maquina:"EXC-0010"}
];
const rop05=[
  {proyecto:"JM",fecha:"2026-10-10",maquina:"TOP-0032"},
  {proyecto:"FDS",fecha:"2026-10-10",maquina:"TOP-0033"},
  {proyecto:"PROYECTO NUEVO",fecha:"2026-10-10",maquina:"TOP-0034"}
];
test("listado une proyectos ROP02 y ROP05, incluidos proyectos futuros",()=>{
  assert.deepEqual(availableControlProjects(rop02,rop05),[
    "EL FIERRO","EL ZORRO","FILO DEL SOL","JOSE MARIA","PROYECTO NUEVO"
  ]);
});
test("Todos conserva ambos conjuntos sin cambios; el selector no reescribe ni muta los orígenes",()=>{
  assert.equal(filterControlProjects(rop02,"todos"),rop02);
  assert.equal(filterControlProjects(rop05,"todos"),rop05);
  assert.equal(rop02.length,4);
  assert.equal(rop05.length,3);
});
test("los proyectos desmarcados quedan fuera tanto de ROP02 como ROP05",()=>{
  const selected=["JOSE MARIA","EL FIERRO"];
  assert.deepEqual(filterControlProjects(rop02,selected).map(r=>r.proyecto),["JOSE MARIA","EL FIERRO"]);
  assert.deepEqual(filterControlProjects(rop05,selected).map(r=>r.proyecto),["JM"]);
  assert.equal(noControlProjectsSelected(selected),false);
});
test("selección vacía significa ninguno (jamás equivale a Todos)",()=>{
  assert.deepEqual(filterControlProjects(rop02,[]),[]);
  assert.deepEqual(filterControlProjects(rop05,[]),[]);
  assert.equal(noControlProjectsSelected([]),true);
  assert.equal(noControlProjectsSelected("todos"),false);
});
test("proyectos futuros se filtran sin nombres fijos; se preservan variantes FDS/JM",()=>{
  assert.deepEqual(filterControlProjects(rop05,["PROYECTO NUEVO"]).map(r=>r.maquina),["TOP-0034"]);
  assert.deepEqual(filterControlProjects(rop05,["FILO DEL SOL"]).map(r=>r.maquina),["TOP-0033"]);
});
test("la vista aplica el alcance antes del cruce y mantiene el mismo reporte acotado",()=>{
  const content=readFileSync(new URL("../src/modules/oficina-tecnica/OficinaTecnicaModule.jsx",import.meta.url),"utf8");
  const start=content.indexOf("function ViewControl({control,rop02All,rop05,extState,setExtState})");
  const end=content.indexOf("\nfunction ",start+10);
  assert.ok(start>0);
  const view=content.slice(start,end>start?end:undefined);
  assert.match(view,/label="Proyectos a considerar"/);
  assert.match(view,/filterControlProjects\(control\.productivos,proyectosConsiderados\)/);
  assert.match(view,/filterControlProjects\(control\.prod05,proyectosConsiderados\)/);
  assert.match(view,/useFacetedFilters\(productivosConsiderados/);
  assert.match(view,/byDateFilter\(prod05Considerados/);
  assert.match(view,/filteredData\.faltanEn05,\s*filteredData\.faltanEn02/);
  assert.match(view,/proyectosConsiderar:value/);
  assert.match(view,/sinProyectos&&<AlertBanner/);
});
