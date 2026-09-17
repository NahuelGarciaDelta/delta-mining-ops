import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRop02DailyControlRows,
  normalizeRop02Shift,
  rop02ControlType,
  shouldIncludeRop02ErrorControlRow,
} from "../src/shared/rop02ControlRules.js";

const row=(overrides={})=>({
  fecha:"2026-09-14",
  maquina:"PCA-0117",
  proyecto:"JOSE MARIA",
  equipo:"Pala cargadora",
  turno:"TD",
  parte:21,
  horometroFinal:1533,
  ...overrides,
});

const daily=(rows,date="2026-09-15")=>buildRop02DailyControlRows(rows,date,{
  normalizeDate:value=>String(value||"").slice(0,10),
  cleanMachine:value=>String(value||"").trim().toUpperCase(),
  canonicalCode:value=>String(value||"").trim().toUpperCase(),
  machineType:value=>value?.equipo||value?._tipo||"",
});

test("ROP02 turno normalization supports TD/TN and day/night labels",()=>{
  assert.equal(normalizeRop02Shift("TD"),"TD");
  assert.equal(normalizeRop02Shift("TN"),"TN");
  assert.equal(normalizeRop02Shift("Turno Día"),"TD");
  assert.equal(normalizeRop02Shift("Turno Noche"),"TN");
  assert.equal(normalizeRop02Shift("Día"),"TD");
  assert.equal(normalizeRop02Shift("Noche"),"TN");
});

test("CASO A - TN has priority over TD for previous-day daily control reference",()=>{
  const rows=daily([
    row({turno:"TD",parte:21,horometroFinal:1533}),
    row({turno:"TN",parte:22,horometroFinal:1538}),
  ]);
  assert.equal(rows.length,1);
  assert.equal(normalizeRop02Shift(rows[0].referencia),"TN");
  assert.equal(rows[0].referencia.parte,22);
  assert.equal(rows[0].esperado.parte,23);
  assert.equal(rows[0].esperado.hi,1538);
});

test("CASO B - TD is used when previous day has no TN",()=>{
  const rows=daily([row({turno:"Turno Día",parte:21,horometroFinal:1533})]);
  assert.equal(rows.length,1);
  assert.equal(normalizeRop02Shift(rows[0].referencia),"TD");
  assert.equal(rows[0].esperado.parte,22);
  assert.equal(rows[0].esperado.hi,1533);
});

test("daily control groups independently by equipment and project",()=>{
  const rows=daily([
    row({proyecto:"JOSE MARIA",turno:"TN",parte:22,horometroFinal:1538}),
    row({proyecto:"FILO DEL SOL",turno:"TN",parte:40,horometroFinal:2010}),
  ]);
  assert.equal(rows.length,2);
  assert.deepEqual(rows.map(r=>r.proyecto).sort(),["FILO DEL SOL","JOSE MARIA"]);
  assert.deepEqual(rows.map(r=>r.esperado.parte).sort((a,b)=>a-b),[23,41]);
});

test("CASO C - truck with valid ROP02 appears in daily control",()=>{
  const rows=daily([row({maquina:"CAR-0008",equipo:"Camión Regador",turno:"TN",parte:8,horometroFinal:932})]);
  assert.equal(rows.length,1);
  assert.equal(rows[0].maquina,"CAR-0008");
  assert.equal(rows[0].tipoControl,"Camiones");
});

test("CASO D - pickup with valid ROP02 appears in daily control",()=>{
  const rows=daily([row({maquina:"CTA-0001",equipo:"Camioneta",turno:"Noche",parte:14,horometroFinal:12000})]);
  assert.equal(rows.length,1);
  assert.equal(rows[0].maquina,"CTA-0001");
  assert.equal(rows[0].tipoControl,"Camionetas");
});

test("CASO E - pickup errors start on 12/09/2026 inclusive",()=>{
  const pickup=date=>row({fecha:date,maquina:"CTA-0001",equipo:"Camioneta"});
  const hourlyReject=()=>false;
  assert.equal(shouldIncludeRop02ErrorControlRow(pickup("2026-09-11"),hourlyReject),false);
  assert.equal(shouldIncludeRop02ErrorControlRow(pickup("2026-09-12"),hourlyReject),true);
  assert.equal(shouldIncludeRop02ErrorControlRow(pickup("2026-09-13"),hourlyReject),true);
});

test("CASO F - CAA-0002 is treated like any other truck and is not specially discarded",()=>{
  const caa=row({maquina:"CAA-0002",equipo:"Camión Regador",turno:"TN",parte:7,horometroFinal:800});
  assert.equal(rop02ControlType(caa,caa.equipo),"Camiones");
  const rows=daily([caa]);
  assert.equal(rows.length,1);
  assert.equal(rows[0].maquina,"CAA-0002");
  assert.equal(shouldIncludeRop02ErrorControlRow(caa,()=>true),true);
});
