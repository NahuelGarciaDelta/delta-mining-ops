import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const proxy=fs.readFileSync(new URL("../api/apps-script.js",import.meta.url),"utf8");
const deleteUi=fs.readFileSync(new URL("../src/modules/abastecimiento/DeleteSolicitudByNumber.jsx",import.meta.url),"utf8");

test("RABA03 GET trae la tabla completa sin forzar una lectura física en cada navegación",()=>{
  assert.match(proxy,/String\(query\.action \|\| \"\"\).*=== \"raba03\"/s);
  assert.doesNotMatch(proxy,/query\.force = \"1\"/);
  assert.match(proxy,/query\.limit = \"all\"/);
});

test("delete control remains explicitly scoped to N° de solicitud",()=>{
  assert.match(deleteUi,/N° de solicitud \(columna A\)/);
  assert.match(deleteUi,/No ingreses el N° de pedido/);
  assert.match(deleteUi,/delete_raba03_solicitud_numero/);
});
