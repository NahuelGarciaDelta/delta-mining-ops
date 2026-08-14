import test from "node:test";
import assert from "node:assert/strict";
import { getPermissionsForArea } from "../src/services/permissionService.js";
import { registerRefreshTask, runRefreshTasks } from "../src/services/refreshManager.js";
import { previousComparablePeriod, percentDelta } from "../src/shared/periodCompare.js";
import fs from "node:fs";

const welcomeSource=fs.readFileSync(new URL("../src/modules/home/ViewBienvenida.jsx",import.meta.url),"utf8");

test("Oficina Técnica tiene permisos completos en otros módulos",()=>{
  const p=getPermissionsForArea("ABASTECIMIENTO",{role:"USUARIO",area:"OFICINA TÉCNICA"});
  for(const action of ["view","edit","approve","delete","export"])assert.equal(p.has(action),true);
});

test("Mantenimiento no puede editar parámetros de Oficina Técnica",()=>{
  const p=getPermissionsForArea("OFICINA TÉCNICA",{role:"USUARIO",area:"MANTENIMIENTO"});
  assert.equal(p.has("view"),true);
  assert.equal(p.has("export"),true);
  assert.equal(p.has("edit"),false);
  assert.equal(p.has("delete"),false);
});

test("motor de actualización ejecuta sólo las tareas registradas para la vista",async()=>{
  const calls=[];
  const offA=registerRefreshTask("test-a",async()=>calls.push("a"),{views:["vista-a"],priority:10});
  const offB=registerRefreshTask("test-b",async()=>calls.push("b"),{views:["vista-b"],priority:10});
  await runRefreshTasks("vista-a",{reason:"test"});
  offA();offB();
  assert.deepEqual(calls,["a"]);
});

test("comparación usa un período anterior de igual duración",()=>{
  const p=previousComparablePeriod("2026-07-01","2026-07-31");
  assert.deepEqual(p,{from:"2026-05-31",to:"2026-06-30",days:31});
  assert.equal(percentDelta(120,100),20);
});

test("la bienvenida del administrativo limita la sidebar a Inicio, Clima y Mi Perfil",()=>{
  assert.match(welcomeSource,/esAdministrativo\s*\?\s*sidebarSectionsBase\.filter\(item=>\["home","weather","profile"\]\.includes\(item\.key\)\)/);
});
