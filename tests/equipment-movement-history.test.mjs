import test from "node:test";
import assert from "node:assert/strict";
import {mergeEquipmentMovements} from "../src/modules/equipment/equipmentMovementHistory.js";

test("conserva los movimientos inferidos de TOP-0072",()=>{
  const result=mergeEquipmentMovements([
    {maquina:"TOP-0072",fecha:"2026-06-20",proyecto:"EL ZORRO"},
    {maquina:"TOP-0072",fecha:"2026-07-21",proyecto:"FDS"},
  ],[],"TOP0072");
  assert.deepEqual(result.map(x=>[x.fecha,x.desde,x.hasta]),[
    ["21/07/2026","El Zorro","Filo del Sol"],
    ["20/06/2026","—","El Zorro"],
  ]);
});

test("prioriza el movimiento persistido equivalente y conserva movimientos inactivos",()=>{
  const result=mergeEquipmentMovements([
    {maquina:"TOP-0072",fecha:"2026-06-20",proyecto:"EL ZORRO"},
    {maquina:"TOP-0072",fecha:"2026-07-21",proyecto:"FILO DEL SOL"},
  ],[
    {id:"manual",interno:"TOP-0072-JM",fechaHora:"2026-07-25T15:00:00Z",proyectoOrigen:"EL ZORRO",proyectoDestino:"FDS",tipoMovimiento:"CAMBIO_PROYECTO",motivo:"Cambio de proyecto",usuario:"usuario@delta.com",estado:"SUPERADO",activo:false},
  ],"TOP0072");
  assert.equal(result.filter(x=>x.desdeRaw==="EL ZORRO"&&x.hastaRaw==="FILO DEL SOL").length,1);
  assert.equal(result[0].source,"MANUAL");
  assert.equal(result[0].usuario,"usuario@delta.com");
});

test("Bajó a San Juan usa destino normalizado",()=>{
  const result=mergeEquipmentMovements([], [{internoNormalizado:"PCA-0021",fechaHora:"2026-08-12T10:00:00Z",proyectoOrigen:"JM",tipoMovimiento:"BAJO_SAN_JUAN",motivo:"Bajó a San Juan",activo:false}],"PCA0021");
  assert.equal(result[0].desde,"José María");
  assert.equal(result[0].hasta,"San Juan");
});
