import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app=fs.readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
const home=fs.readFileSync(new URL("../src/modules/home/ViewBienvenida.jsx",import.meta.url),"utf8");
const sources=fs.readFileSync(new URL("../src/config/viewSources.js",import.meta.url),"utf8");
const access=fs.readFileSync(new URL("../src/app/viewAccess.js",import.meta.url),"utf8");

test("Gestión Humana está integrada en home y navegación",()=>{
  assert.match(home,/label:"Gestión Humana"/);
  assert.match(home,/module:"gestionHumana",view:"gestionHumanaSitio"/);
  assert.match(app,/activeModule==="gestionHumana"/);
  assert.match(app,/gestionHumanaSitio/);
  assert.match(app,/gestionHumanaHistorial/);
  assert.match(app,/gestionHumanaRanking/);
});

test("Ranking de operarios ya no está dentro del grupo ROP05",()=>{
  const group=app.match(/id:"grp_rop05"[\s\S]*?\]\},/);
  assert.ok(group);
  assert.doesNotMatch(group[0],/id:"ranking"/);
  assert.doesNotMatch(app,/view==="ranking"/);
});

test("las vistas de Gestión Humana reutilizan fuentes existentes",()=>{
  assert.match(sources,/gestionHumanaSitio:\["lista_equipos","rop02_fs","rop02_jm","rop02_filosur","rop02_zorro"\]/);
  assert.match(sources,/gestionHumanaHistorial:\["lista_equipos","rop02_fs","rop02_jm","rop02_filosur","rop02_zorro"\]/);
  assert.match(sources,/gestionHumanaRanking:\["rop02_fs","rop02_jm","rop02_filosur","rop02_zorro","rop05"\]/);
});

test("Gestión Humana usa el sistema de áreas existente",()=>{
  assert.match(access,/gestionHumanaSitio: "GESTIÓN HUMANA"/);
  assert.match(access,/gestionHumanaHistorial: "GESTIÓN HUMANA"/);
  assert.match(access,/gestionHumanaRanking: "GESTIÓN HUMANA"/);
});
