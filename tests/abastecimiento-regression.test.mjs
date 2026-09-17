import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const moduleSource = fs.readFileSync(new URL("../src/modules/abastecimiento/AbastecimientoModule.jsx", import.meta.url), "utf8");
const appSource = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const stockService = fs.readFileSync(new URL("../src/services/stockService.js", import.meta.url), "utf8");

test("Abastecimiento importa y registra registerRefreshTask en el scope del módulo", () => {
  assert.match(moduleSource, /import\s*\{\s*registerRefreshTask\s*\}\s*from\s*["']\.\.\/\.\.\/services\/refreshManager\.js["']/);
  assert.match(moduleSource, /registerRefreshTask\(["']abastecimiento["']/);
});

test("Abastecimiento abre RABA03 sin bloquear por remitos y reconcilia en segundo plano", () => {
  // RABA03 es la fuente de verdad para cantidades/estados. La vista principal debe
  // abrir inmediatamente y los remitos compartidos sólo reconciliar trazabilidad después.
  assert.match(moduleSource, /try\{await loadRaba03\(\{silent:false\}\);\}catch\(_\)\{\}/);
  assert.match(moduleSource, /const \[sharedRemitos\]=await Promise\.all\(\[remitosTask,estadosTask\]\)/);
  assert.match(moduleSource, /await loadRaba03\(\{silent:true,remitosOverride:sharedRemitos\}\)/);
  assert.match(moduleSource, /Cant\. enviada\/restante vienen de la fuente RABA03/);
});

test("App conserva todas las rutas de Abastecimiento y su Error Boundary", () => {
  const routes = [
    "abastecimiento", "abastecimientoDashboard", "abastecimientoRABA03", "abastecimientoRemito",
    "abastecimientoPendientes", "abastecimientoParciales", "abastecimientoCerradas",
    "abastecimientoRechazadas", "abastecimientoEnviosSinSolicitud", "abastecimientoEditarCodigos",
    "abastecimientoStockDashboard", "abastecimientoStock",
  ];
  routes.forEach(route => assert.match(appSource, new RegExp(`\\b${route}\\b`), route));
  assert.match(appSource, /ModuleErrorBoundary name="Abastecimiento"/);
  assert.match(appSource, /<AbastecimientoRoute\b/);
});

test("Stock conserva el contrato activo de lectura y reemplazo sin depender de un Apps Script embebido", () => {
  // El Apps Script productivo es externo y ya no vive como un TXT dentro del repo.
  // Esta regresión valida el contrato que sí controla el frontend actual.
  assert.match(stockService, /stock_excel_status/);
  assert.match(stockService, /stock_excel_data/);
  assert.match(stockService, /stock_excel_upload/);
  assert.match(stockService, /stock_excel_replace/);
  assert.match(stockService, /stock_excel_clear/);
  assert.match(stockService, /new URLSearchParams/);
  assert.match(stockService, /rows,/);
  assert.match(stockService, /clearDatasetCache\(STOCK_CACHE_KEY\)/);
  assert.doesNotMatch(stockService, /DriveApp|STOCK_FOLDER_ID|STOCK_DRIVE_FOLDER_ID|STOCK_ACTIVE_FILE_ID|FILE_ID|FILE_URL|fileToBase64|FileReader/i);
});
