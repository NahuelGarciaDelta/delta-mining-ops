import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../src/modules/abastecimiento/AbastecimientoModule.jsx',import.meta.url),'utf8');

test('operational allocation matches Supabase: code plus project',()=>{
  assert.match(source,/const key=`\$\{code\}__\$\{proyecto\}`/);
  assert.match(source,/const key=shipment\.proyecto\?`\$\{shipment\.code\}__\$\{shipment\.proyecto\}`:""/);
});

test('operational shipment never consumes a request created after shipment date',()=>{
  assert.match(source,/if\(req\.fechaMs&&shipment\.fechaMs&&req\.fechaMs>shipment\.fechaMs\)continue/);
});

test('rejected requests display sent zero without reallocating shipments',()=>{
  assert.doesNotMatch(source,/const stateAwareRows=useMemo/);
  assert.match(source,/rejectedSolicitudes\?\.\[buildSolicitudKey\(row\)\][\s\S]*cantidadEnviada:0[\s\S]*cantidadRestante:Math\.max\(0,toNumber\(row\.cantidadSolicitada\)\)/);
});

test('Envíos sin solicitud uses independent code project description audit key',()=>{
  assert.match(source,/const solicitudesAudit=\(rows\|\|\[\]\)/);
  assert.match(source,/insumoKey:norm\(r\.descripcion\)/);
  assert.match(source,/const key=\[req\.codigo,req\.proyecto,req\.insumoKey\]\.join\("__"\)/);
  assert.match(source,/const key=\[shipment\.codigo,shipment\.proyecto,shipment\.insumoKey\]\.join\("__"\)/);
});

test('historical unmatched never consumes future requests and has no 15-day limit',()=>{
  assert.match(source,/if\(req\.fechaMs&&shipment\.fechaMs&&req\.fechaMs>shipment\.fechaMs\)continue/);
  assert.doesNotMatch(source,/15\s*\*\s*86400000|15\s*d[ií]as|quinced[ií]as/i);
});

test('historical unmatched excludes rejected requests and respects quantities',()=>{
  assert.match(source,/solicitudesAudit=\(rows\|\|\[\]\)[\s\S]*\.filter\(r=>!rejectedSolicitudes\?\.\[buildSolicitudKey\(r\)\]\)/);
  assert.match(source,/const aplicado=Math\.min\(pendiente,restante\)/);
  assert.match(source,/if\(restante>0\)/);
});

test('Abastecimiento dashboard opts out of global table column filter decoration',()=>{
  assert.match(source,/renderAbastecimientoDashboard[\s\S]*data-dm-disable-global-column-filters="1"/);
});
