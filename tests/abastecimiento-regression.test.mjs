import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const moduleSource = fs.readFileSync(new URL("../src/modules/abastecimiento/AbastecimientoModule.jsx", import.meta.url), "utf8");
const appSource = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const backend = fs.readFileSync(new URL("../AppsScript_Delta_Mining_OPS_FINAL.txt", import.meta.url), "utf8");

test("Abastecimiento importa y registra registerRefreshTask en el scope del módulo", () => {
  assert.match(moduleSource, /import\s*\{\s*registerRefreshTask\s*\}\s*from\s*["']\.\.\/\.\.\/services\/refreshManager\.js["']/);
  assert.match(moduleSource, /registerRefreshTask\(["']abastecimiento["']/);
});

test("Abastecimiento espera remitos reales antes de calcular RABA03 al abrir", () => {
  assert.match(moduleSource, /sharedRemitos=await loadRemitosCompartidos\(\{silent:true\}\)/);
  assert.match(moduleSource, /loadRaba03\(\{silent:false,remitosOverride:sharedRemitos\}\)/);
  assert.match(moduleSource, /const sentMap=Array\.isArray\(remitosOverride\)\?buildSentByCode\(remitosOverride\):sentByCodeRef\.current/);
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

test("Apps Script consolidado tiene rutas únicas y reemplazo transaccional de Stock", () => {
  assert.equal((backend.match(/function doGet\s*\(/g) || []).length, 1);
  assert.equal((backend.match(/function doPost\s*\(/g) || []).length, 1);
  ["stock_excel_status", "stock_excel_data", "get_stock_active", "stock_active",
    "stock_excel_upload", "stock_excel_replace", "stock_excel_clear", "upload_stock"]
    .forEach(action => assert.match(backend, new RegExp(`['\"]${action}['\"]`), action));
  ["STOCK CRITICO", "STOCK_META", "STOCK_TEMP", "STOCK_HISTORIAL"]
    .forEach(sheet => assert.match(backend, new RegExp(sheet), sheet));
  assert.match(backend, /LockService\.getScriptLock\(\)/);
  assert.match(backend, /if\(!lock\.tryLock\(30000\)\)/);
  assert.match(backend, /if\(temp\.getLastRow\(\)-1!==checked\.matrix\.length\)throw/);
  assert.match(backend, /currentMain\.setName\(STOCK_TEMP_SHEET_\);backup\.setName\(STOCK_MAIN_SHEET_\)/);
  assert.ok(backend.indexOf("temp.setName(STOCK_MAIN_SHEET_)") < backend.indexOf("ss.deleteSheet(backup)"));
  assert.doesNotMatch(backend, /DriveApp|STOCK_FOLDER_ID|STOCK_DRIVE_FOLDER_ID|STOCK_ACTIVE_FILE_ID|FILE_ID|FILE_URL/);
});
