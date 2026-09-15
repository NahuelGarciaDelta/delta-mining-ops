import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const service=fs.readFileSync(new URL("../src/services/globalTableColumnFilters.js",import.meta.url),"utf8");
const main=fs.readFileSync(new URL("../src/main.jsx",import.meta.url),"utf8");

test("todas las tablas visibles quedan cubiertas por filtro por columna",()=>{
  assert.match(main,/installGlobalTableColumnFilters/);
  assert.match(service,/\.dm-app-content table/);
  assert.match(service,/button\.textContent="Filtro por columna"/);
  assert.match(service,/dm-global-column-filter-row/);
  assert.match(service,/dm-global-column-filter-hidden/);
  assert.match(service,/hasNativeColumnFilters/);
});

test("no duplica la barra en tablas que ya tienen filtros nativos",()=>{
  assert.match(service,/previousElementSibling/);
  assert.match(service,/label==="filtro por columna"\|\|label==="filtros por columna"/);
  assert.match(service,/scrollHost\.querySelectorAll/);
});

test("el dashboard puede desactivar y limpiar por completo el filtro global",()=>{
  assert.match(service,/DISABLE_SELECTOR="\[data-dm-disable-global-column-filters='1'\]"/);
  assert.match(service,/function cleanupDisabledRegions\(\)/);
  assert.match(service,/root\.querySelectorAll\(`\.\$\{TOOLBAR_CLASS\}`\)\.forEach\(toolbar=>toolbar\.remove\(\)\)/);
  assert.match(service,/cleanupTableUi\(table,\{clearFilters:true\}\)/);
  assert.match(service,/cleanupDisabledRegions\(\);/);
});

test("una tabla reemplazada por React no deja botones duplicados",()=>{
  assert.match(service,/const toolbarOwner=new WeakMap\(\)/);
  assert.match(service,/function cleanupOrphanToolbars\(\)/);
  assert.match(service,/seenOwners\.has\(owner\)/);
  assert.match(service,/:scope > \.\$\{TOOLBAR_CLASS\}/);
  assert.match(service,/if\(!owner\|\|owner===table\|\|!owner\.isConnected\)toolbar\.remove\(\)/);
  assert.match(service,/cleanupOrphanToolbars\(\);/);
});
