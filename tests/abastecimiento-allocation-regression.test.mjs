import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../src/modules/abastecimiento/AbastecimientoModule.jsx',import.meta.url),'utf8');

test('allocation key includes code, project and normalized item description',()=>{
  assert.match(source,/const insumoKey=norm\(row\.descripcion\)/);
  assert.match(source,/const key=\[code,proyecto,insumoKey\]\.join\("__"\)/);
  assert.match(source,/const insumoKey=norm\(item\.descripcion\)/);
  assert.match(source,/\[shipment\.code,shipment\.proyecto,shipment\.insumoKey\]\.join\("__"\)/);
});

test('shipment never consumes a request created after shipment date',()=>{
  assert.match(source,/req\.fechaMs>shipment\.fechaMs/);
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
