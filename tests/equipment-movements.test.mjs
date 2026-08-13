import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {getMovimientoVigentePorEquipo,movementsToAtrasoMap} from "../src/services/equipmentMovementsDomain.js";

test("el último movimiento activo por interno normalizado es compartido",()=>{
  const movements=[
    {id:"1",fechaHora:"2026-08-01T10:00:00Z",interno:"TOP-0036-JM",internoNormalizado:"TOP-0036",tipoMovimiento:"BAJO_SAN_JUAN",motivo:"Bajó a San Juan",fechaUltimoRop02:"2026-07-31",estado:"ACEPTADO",activo:true},
    {id:"2",fechaHora:"2026-08-02T10:00:00Z",interno:"TOP-0036",internoNormalizado:"TOP-0036",tipoMovimiento:"CAMBIO_PROYECTO",motivo:"Cambio de proyecto",fechaUltimoRop02:"2026-07-31",estado:"ACEPTADO",activo:true},
  ];
  const active=getMovimientoVigentePorEquipo(movements,new Map([["TOP-0036","2026-07-31"]]));
  assert.equal(active.size,1);
  assert.equal(active.get("TOP-0036").id,"2");
});

test("una carga ROP02 posterior supera el movimiento sin borrar historial",()=>{
  const movements=[{id:"1",fechaHora:"2026-08-01T10:00:00Z",internoNormalizado:"TOP-0036",tipoMovimiento:"BAJO_SAN_JUAN",motivo:"Bajó a San Juan",fechaUltimoRop02:"2026-07-31",estado:"ACEPTADO",activo:true}];
  const active=getMovimientoVigentePorEquipo(movements,new Map([["TOP-0036","2026-08-03"]]));
  assert.equal(active.has("TOP-0036"),false);
  assert.equal(movements.length,1);
});

test("movimiento vigente alimenta Equipos aceptados con el id persistente",()=>{
  const active=new Map([["PCA-0021",{id:"uuid",interno:"PCA-0021-JM",motivo:"Bajó a San Juan",fechaHora:"2026-08-01T10:00:00Z",usuario:"a@delta.com",fechaUltimoRop02:"2026-07-30",proyectoOrigen:"JOSE MARIA",proyectoDestino:"SAN JUAN",tipoMovimiento:"BAJO_SAN_JUAN"}]]);
  const admitidos=movementsToAtrasoMap(active);
  assert.equal(admitidos["atrasado_PCA-0021_JOSE MARIA_2026-07-30"].movementId,"uuid");
});

test("movimientos del mismo equipo permanecen independientes por proyecto origen",()=>{
  const movements=[
    {id:"zorro",fechaHora:"2026-08-01T10:00:00Z",internoNormalizado:"TOP-0072",proyectoOrigen:"EL ZORRO",motivo:"Cambio de proyecto",fechaUltimoRop02:"2026-07-18",estado:"ACEPTADO",activo:true},
    {id:"fds",fechaHora:"2026-08-02T10:00:00Z",internoNormalizado:"TOP-0072",proyectoOrigen:"FDS",motivo:"Otro",fechaUltimoRop02:"2026-08-01",estado:"ACEPTADO",activo:true},
  ];
  const active=getMovimientoVigentePorEquipo(movements,new Map([
    ["TOP-0072|EL ZORRO","2026-07-18"],
    ["TOP-0072|FILO DEL SOL","2026-08-01"],
  ]));
  assert.equal(active.get("TOP-0072|EL ZORRO")?.id,"zorro");
  assert.equal(active.get("TOP-0072|FILO DEL SOL")?.id,"fds");
});

test("Apps Script conserva router, lock, UUID, hoja y headers obligatorios",()=>{
  const source=fs.readFileSync(new URL("../AppsScript_Delta_Mining_OPS_FINAL.txt",import.meta.url),"utf8");
  for(const action of ["get_equipment_movements","get_active_equipment_movements","save_equipment_movement","cancel_equipment_movement"])assert.match(source,new RegExp(action));
  assert.match(source,/SpreadsheetApp\.openById\(MOVIMIENTOS_EQUIPOS_DB_ID_\)/);
  assert.match(source,/1eEgggHdcH0YhGnmlogN63nQgStNl2xoV0bkfF_DTPYU/);
  assert.match(source,/MOVIMIENTOS_EQUIPOS/);
  assert.match(source,/Utilities\.getUuid\(\)/);
  assert.match(source,/LockService\.getScriptLock\(\)/);
  for(const header of ["ID","FECHA_HORA","INTERNO","INTERNO_NORMALIZADO","PROYECTO_ORIGEN","PROYECTO_DESTINO","TIPO_MOVIMIENTO","MOTIVO","OBSERVACION","USUARIO","FECHA_ULTIMO_ROP02","ESTADO","ACTIVO"])assert.match(source,new RegExp(`"${header}"`));
});
