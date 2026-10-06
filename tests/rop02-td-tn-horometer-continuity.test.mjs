import test from "node:test";
import assert from "node:assert/strict";
import {buildRop02TdTnHorometerError} from "../src/shared/rop02HorometerContinuity.js";

test("detecta corte TD→TN del mismo día",()=>{
  const error=buildRop02TdTnHorometerError(
    {fecha:"2026-09-24",proyecto:"FILO DEL SOL",maquina:"PCA-0114",turno:"TD",parte:39,horometroInicial:1685,horometroFinal:1695,supervisor:"A"},
    {fecha:"2026-09-24",proyecto:"FILO DEL SOL",maquina:"PCA-0114",turno:"TN",parte:40,horometroInicial:1696,horometroFinal:1704,supervisor:"B"},
    "PCA-0114"
  );
  assert.ok(error);
  assert.equal(error.tipo,"TD_TN_HOROMETRO");
  assert.equal(error.turno,"TN");
  assert.equal(error.turnoAnterior,"TD");
  assert.equal(error.hfAnterior,1695);
  assert.equal(error.hiActual,1696);
  assert.equal(error.diff,1);
  assert.equal(error.fecha,"2026-09-24");
  assert.equal(error.fechaAnterior,"2026-09-24");
});

test("no acusa error si HF TD = HI TN",()=>{
  const error=buildRop02TdTnHorometerError(
    {fecha:"2026-09-24",horometroFinal:1695},
    {fecha:"2026-09-24",horometroInicial:1695},
    "PCA-0114"
  );
  assert.equal(error,null);
});

test("no inventa error si falta uno de los horómetros",()=>{
  assert.equal(buildRop02TdTnHorometerError(
    {fecha:"2026-09-24",horometroFinal:null},
    {fecha:"2026-09-24",horometroInicial:1696},
    "PCA-0114"
  ),null);
});
