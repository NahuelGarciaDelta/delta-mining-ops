import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const moduleSource=fs.readFileSync(new URL("../src/modules/abastecimiento/AbastecimientoModule.jsx",import.meta.url),"utf8");
const service=fs.readFileSync(new URL("../src/services/abastecimientoSupabase.js",import.meta.url),"utf8");
const readApi=fs.readFileSync(new URL("../src/services/raba03ReadApi.js",import.meta.url),"utf8");

test("RABA03 usa lectura directa y no el snapshot grande",()=>{
  assert.match(service,/fetchRaba03FromSupabase/);
  assert.match(service,/export async function getAbastecimientoRaba03/);
  const load=moduleSource.split("const loadRaba03=useCallback")[1]?.split("// Carga inicial stale-while-revalidate")[0]||"";
  assert.match(load,/getAbastecimientoRaba03\(\)/);
  assert.doesNotMatch(load,/getAbastecimientoSnapshot\(\)/);
});

test("carga inicial dispara RABA03, remitos y estados en paralelo",()=>{
  const init=moduleSource.split("// Carga inicial stale-while-revalidate")[1]?.split("// Registro en el motor único")[0]||"";
  assert.match(init,/Promise\.allSettled\(\[/);
  assert.match(init,/loadRaba03\(\{silent:hasCachedRows\}\)/);
  assert.match(init,/loadRemitosCompartidos\(\{silent:true\}\)/);
  assert.match(init,/loadEstadosSolicitudesCompartidos\(\{silent:true\}\)/);
});

test("timeout de red deja margen de 30 segundos",()=>{
  assert.match(readApi,/const TIMEOUT_MS=30000/);
  assert.doesNotMatch(readApi,/dentro de 12 segundos/);
});
