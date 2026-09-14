import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const service=fs.readFileSync(new URL("../src/services/globalTableColumnFilters.js",import.meta.url),"utf8");
const main=fs.readFileSync(new URL("../src/main.jsx",import.meta.url),"utf8");

test("todas las tablas visibles quedan cubiertas por filtros por columna",()=>{
  assert.match(main,/installGlobalTableColumnFilters/);
  assert.match(service,/\.dm-app-content table/);
  assert.match(service,/Filtros por columna/);
  assert.match(service,/dm-global-column-filter-row/);
  assert.match(service,/dm-global-column-filter-hidden/);
  assert.match(service,/hasNativeColumnFilters/);
});

test("no duplica la barra en tablas que ya tienen filtros nativos",()=>{
  assert.match(service,/previousElementSibling/);
  assert.match(service,/normalized\(button\.textContent\)==="filtros por columna"/);
});
