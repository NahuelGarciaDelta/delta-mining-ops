import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const app=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
const welcome=readFileSync(new URL("../src/modules/home/ViewBienvenida.jsx",import.meta.url),"utf8");
const api=readFileSync(new URL("../src/services/appsScriptApi.js",import.meta.url),"utf8");

test("una única franja global en la rama de seguridad",()=>{
  assert.equal((app.match(/MODO DE SEGURIDAD/g)||[]).length,1);
  assert.match(app,/EMERGENCY_READ_MODE&&<div role="status"/);
  assert.doesNotMatch(app,/<OfflineBanner lastUpdate/);
  assert.doesNotMatch(app,/<strong>MODO RESPALDO · GOOGLE SHEETS<\/strong>/);
  assert.doesNotMatch(app,/<strong style=\{\{color:C.yellow\}\}>Estado de datos sin confirmar/);
  assert.doesNotMatch(app,/errors\.map\(\(e,i\)=>\(/);
});
test("sin carteles adicionales en el inicio y agenda",()=>{
  assert.doesNotMatch(welcome,/El resumen operativo no pudo verificarse con Supabase/);
  assert.doesNotMatch(welcome,/No se pudo cargar una fuente de Agenda:/);
  assert.doesNotMatch(welcome,/Si Supabase no responde, no se mostrarán indicadores vacíos/);
});
test("la contingencia sigue leyendo Apps Script, con permisos y errores intactos",()=>{
  assert.match(api,/export const EMERGENCY_READ_MODE=true/);
  assert.match(api,/return readSheetSource_\(url,key,options\)/);
  assert.match(app,/const hasSavedData=previous\?\.ok/);
  assert.match(app,/if\(!fetched\?\.ok\|\|!Array\.isArray\(fetched\.data\)\)throw/);
  assert.match(app,/\{fatalError&&<ErrorScreen/);
  assert.match(app,/puedeEditarVista/);
});
