import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync(new URL("../src/modules/abastecimiento/AbastecimientoModule.jsx",import.meta.url),"utf8");

test("Abastecimiento no puede quedar cargando por esperar remitos/estados",()=>{
  assert.match(source,/const remitosTask=loadRemitosCompartidos\(\{silent:true\}\)/);
  assert.match(source,/try\{await loadRaba03\(\{silent:false\}\);\}catch\(_\)\{\}/);
  assert.match(source,/const \[sharedRemitos\]=await Promise\.all\(\[remitosTask,estadosTask\]\)/);
});

test("lecturas críticas tienen timeout y loadRaba03 no cambia por setRemitos",()=>{
  assert.match(source,/fetchWithTimeout\(url,\{method:"GET",cache:"no-store",redirect:"follow"\},15000,"Remitos"\)/);
  assert.match(source,/fetchWithTimeout\(`\$\{APPS_SCRIPT_URL\}\?action=estados_solicitudes/);
  assert.match(source,/fetchWithTimeout\(url,\{cache:"no-store"\},20000,"RABA03"\)/);
  assert.match(source,/remitosOverride\)\?remitosOverride:remitosRef\.current/);
  assert.match(source,/\},\[mapRaba03Rows\]\);/);
  assert.doesNotMatch(source,/\},\[mapRaba03Rows,remitos\]\);/);
});
