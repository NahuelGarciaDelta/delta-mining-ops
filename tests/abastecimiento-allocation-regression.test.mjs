import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../src/modules/abastecimiento/AbastecimientoModule.jsx',import.meta.url),'utf8');

test('operational allocation matches Supabase: code plus project',()=>{
  assert.match(source,/const key=`\$\{code\}__\$\{proyecto\}`/);
  assert.match(source,/const key=shipment\.proyecto\?`\$\{shipment\.code\}__\$\{shipment\.proyecto\}`:""/);
  assert.doesNotMatch(source,/const insumoKey=norm\(row\.descripcion\)/);
  assert.doesNotMatch(source,/shipment\.insumoKey/);
});

test('shipment never consumes a request created after shipment date',()=>{
  assert.match(source,/if\(req\.fechaMs&&shipment\.fechaMs&&req\.fechaMs>shipment\.fechaMs\)continue/);
});

test('rejected requests display sent zero without reallocating shipments',()=>{
  assert.doesNotMatch(source,/const stateAwareRows=useMemo/);
  assert.match(source,/rejectedSolicitudes\?\.\[buildSolicitudKey\(row\)\][\s\S]*cantidadEnviada:0[\s\S]*cantidadRestante:Math\.max\(0,toNumber\(row\.cantidadSolicitada\)\)/);
});

test('historical unmatched shipment is never absorbed by a future request',()=>{
  assert.match(source,/const solicitudesHistoricas=\(rows\|\|\[\]\)/);
  assert.match(source,/const teniaSolicitudAlEnviar=solicitudesHistoricas\.some/);
  assert.match(source,/sol\.fechaMs<=fechaMs/);
  assert.doesNotMatch(source,/allocateRemitosToRequests\(base,remitos\)\.unmatched/);
});

test('historical unmatched ignores rejected requests as valid requests',()=>{
  assert.match(source,/solicitudesHistoricas=\(rows\|\|\[\]\)[\s\S]*\.filter\(r=>!rejectedSolicitudes\?\.\[buildSolicitudKey\(r\)\]\)/);
});

test('Abastecimiento dashboard opts out of global table column filter decoration',()=>{
  assert.match(source,/renderAbastecimientoDashboard[\s\S]*data-dm-disable-global-column-filters="1"/);
});
