import test from "node:test";
import assert from "node:assert/strict";
import {detectRop02DuplicateLoads} from "../src/modules/oficina-tecnica/rop02DuplicateLoads.js";

const row=(turno,extra={})=>({
  fecha:"2026-09-15",
  maquina:"MOT-0001",
  turno,
  proyecto:"JOSE MARIA",
  supervisor:"Supervisor",
  parte:extra.parte||"100",
  ...extra,
});

test("una sola carga diaria no genera error",()=>{
  assert.equal(detectRop02DuplicateLoads([row("TURNO DIA")]).length,0);
});

test("TD + TN es la única combinación válida de dos cargas",()=>{
  assert.equal(detectRop02DuplicateLoads([row("TURNO DIA"),row("TURNO NOCHE",{parte:"101"})]).length,0);
});

test("dos cargas TD generan CARGA_DUPLICADA",()=>{
  const errors=detectRop02DuplicateLoads([row("TURNO DIA"),row("TD",{parte:"101"})]);
  assert.equal(errors.length,1);
  assert.equal(errors[0].tipo,"CARGA_DUPLICADA");
  assert.equal(errors[0].cargasDetectadas,2);
  assert.match(errors[0].detalle,/mismo turno/i);
});

test("dos cargas TN generan CARGA_DUPLICADA",()=>{
  const errors=detectRop02DuplicateLoads([row("TURNO NOCHE"),row("TN",{parte:"101"})]);
  assert.equal(errors.length,1);
  assert.equal(errors[0].tipo,"CARGA_DUPLICADA");
});

test("más de dos cargas del mismo equipo y fecha generan un solo hallazgo",()=>{
  const errors=detectRop02DuplicateLoads([
    row("TURNO DIA",{parte:"100"}),
    row("TURNO NOCHE",{parte:"101"}),
    row("TURNO DIA",{parte:"102"}),
  ]);
  assert.equal(errors.length,1);
  assert.equal(errors[0].cargasDetectadas,3);
  assert.equal(errors[0].diff,1);
  assert.match(errors[0].detalle,/máximo permitido es 2/i);
});

test("la detección se agrupa por Fecha + Interno aunque cambie el proyecto",()=>{
  const errors=detectRop02DuplicateLoads([
    row("TD",{proyecto:"JOSE MARIA",parte:"100"}),
    row("TN",{proyecto:"FILO DEL SOL",parte:"101"}),
    row("TD",{proyecto:"JOSE MARIA",parte:"102"}),
  ]);
  assert.equal(errors.length,1);
  assert.equal(errors[0].maquina,"MOT-0001");
  assert.equal(errors[0].fecha,"2026-09-15");
});
