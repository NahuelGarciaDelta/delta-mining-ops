import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as XLSX from "xlsx";
import {validateStockWorkbook} from "../src/modules/abastecimiento/stock/stockValidation.js";

const headers=["Cod. artículo","Descripción","Desc. Adicional","Descripción depósito","U.m. control stock","Saldo control stock","Stock máximo","Stock mínimo"];
const workbookBuffer=rows=>{const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([headers,...rows]),"Stock");return XLSX.write(book,{type:"array",bookType:"xlsx"});};

test("valida filas correctas y detecta duplicados",()=>{
  const result=validateStockWorkbook(XLSX,workbookBuffer([
    ["A1","Uno","","DEPOSITO CENTRAL","UN",10,20,5],
    ["A1","Duplicado","","DEPOSITO CENTRAL","UN",8,20,5],
  ]),"stock.xlsx");
  assert.equal(result.report.foundRows,2);
  assert.equal(result.report.validRows,1);
  assert.equal(result.report.rejectedRows,1);
  assert.equal(result.report.duplicateCodes,1);
});

test("rechaza números inválidos, depósitos desconocidos y mínimo mayor al máximo",()=>{
  const result=validateStockWorkbook(XLSX,workbookBuffer([
    ["B1","Inválido","","OTRO","UN","NaN",5,10],
  ]),"stock.xls");
  assert.equal(result.rows.length,0);
  assert.equal(result.report.invalidValues,1);
  assert.match(result.report.rejections[0].reasons.join(" "),/Depósito no reconocido/);
  assert.match(result.report.rejections[0].reasons.join(" "),/Stock mínimo mayor/);
});

test("el flujo activo de Stock no usa Drive, Base64 ni hojas versionadas",()=>{
  const backend=fs.readFileSync(new URL("../AppsScript_Delta_Mining_OPS_FINAL.txt",import.meta.url),"utf8");
  const service=fs.readFileSync(new URL("../src/services/stockService.js",import.meta.url),"utf8");
  assert.doesNotMatch(backend,/DriveApp|STOCK_DATA_V|STOCK_DRIVE_FOLDER_ID|STOCK_ACTIVE_FILE_ID/);
  assert.doesNotMatch(service,/FileReader|fileToBase64|base64/i);
  assert.match(backend,/STOCK_TEMP_SHEET_="STOCK_TEMP"/);
  assert.match(backend,/lock\.tryLock\(30000\)/);
  assert.ok(backend.indexOf("temp.getRange(2")<backend.indexOf("temp.setName(STOCK_MAIN_SHEET_)"));
});
