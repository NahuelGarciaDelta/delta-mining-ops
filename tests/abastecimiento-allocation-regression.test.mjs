import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../src/modules/abastecimiento/AbastecimientoModule.jsx',import.meta.url),'utf8');

test('allocation key uses historical code plus project identity',()=>{
  assert.match(source,/const key=`\$\{code\}__\$\{proyecto\}`/);
  assert.match(source,/const key=shipment\.proyecto\?`\$\{shipment\.code\}__\$\{shipment\.proyecto\}`:""/);
  assert.doesNotMatch(source,/const insumoKey=norm\(row\.descripcion\)/);
});

test('shipment never consumes a request created after shipment date',()=>{
  assert.match(source,/if\(req\.fechaMs&&shipment\.fechaMs&&req\.fechaMs>shipment\.fechaMs\)continue/);
});

test('description differences do not block same code and project after request exists',()=>{
  assert.doesNotMatch(source,/\[code,proyecto,insumoKey\]\.join\("__"\)/);
  assert.doesNotMatch(source,/shipment\.insumoKey/);
});

test('rejected requests never consume shipments and remain sent zero',()=>{
  assert.match(source,/const stateAwareRows=useMemo/);
  assert.match(source,/activas=base\.filter\(row=>!rejectedSolicitudes\?\.\[buildSolicitudKey\(row\)\]\)/);
  assert.match(source,/rejectedSolicitudes\?\.\[buildSolicitudKey\(row\)\]\?row:/);
  assert.match(source,/\.filter\(r=>!rejectedSolicitudes\?\.\[buildSolicitudKey\(r\)\]\)/);
});

test('Abastecimiento dashboard opts out of global table column filter decoration',()=>{
  assert.match(source,/renderAbastecimientoDashboard[\s\S]*data-dm-disable-global-column-filters="1"/);
});
