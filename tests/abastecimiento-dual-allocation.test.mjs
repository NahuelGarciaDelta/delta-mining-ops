import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../src/modules/abastecimiento/AbastecimientoModule.jsx',import.meta.url),'utf8');

test('estado operativo descuenta remitos anteriores de solicitudes pendientes',()=>{
  assert.match(source,/allocateRemitosToRequests\(activas,remitos,\{allowPreSolicitud:true\}\)\.rows/);
});

test('Envíos sin solicitud conserva la regla histórica y no usa allowPreSolicitud',()=>{
  assert.match(source,/return allocateRemitosToRequests\(base,remitos\)\.unmatched\.sort/);
  assert.doesNotMatch(source,/return allocateRemitosToRequests\(base,remitos,\{allowPreSolicitud:true\}\)\.unmatched/);
});

test('la condición temporal sólo se omite para el estado operativo',()=>{
  assert.match(source,/if\(!allowPreSolicitud&&req\.fechaMs&&shipment\.fechaMs&&req\.fechaMs>shipment\.fechaMs\)continue/);
});

test('rechazadas siguen excluidas antes de calcular cantidades enviadas',()=>{
  assert.match(source,/const activas=base\.filter\(row=>!rejectedSolicitudes\?\.\[buildSolicitudKey\(row\)\]\)/);
});
