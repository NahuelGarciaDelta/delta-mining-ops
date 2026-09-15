import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { abastecimientoInstantVitePlugin } from '../scripts/abastecimiento-instant-vite-plugin.mjs';

const source=fs.readFileSync(new URL('../src/modules/abastecimiento/AbastecimientoModule.jsx',import.meta.url),'utf8');
const plugin=fs.readFileSync(new URL('../scripts/abastecimiento-instant-vite-plugin.mjs',import.meta.url),'utf8');

test('estados usan Cant. Enviada persistida en RABA03 como fuente de verdad',()=>{
  assert.match(source,/const enviada=toNumber\(pick\(r,\["Cant\. Enviada"/);
  assert.match(source,/return base;\n  \},\[normalizeRow\]\);/);
});

test('rechazadas se muestran con enviada cero sin recalcular estados activos',()=>{
  assert.match(source,/if\(rejectedSolicitudes\?\.\[buildSolicitudKey\(row\)\]\)\{/);
  assert.match(source,/cantidadEnviada:0,cantidadRestante:Math\.max\(0,toNumber\(row\.cantidadSolicitada\)\)/);
  assert.match(source,/return \{\.\.\.row,_matchedRemitos:/);
});

test('envíos sin solicitud conservan clave histórica y nunca usan pedidos futuros',()=>{
  assert.match(source,/codigo:normCode\(r\.codigoArticulo\)/);
  assert.match(source,/proyecto:normalizeCentroCosto\(r\.centroCosto\)/);
  assert.match(source,/descripcion:norm\(r\.descripcion\)/);
  assert.match(source,/sol\.descripcion===descripcionNormalizada/);
  assert.match(source,/sol\.fechaMs<=fechaMs/);
  assert.doesNotMatch(source,/15\s*\*\s*24\s*\*\s*60/);
});

test('vite no reemplaza Envíos sin solicitud por FIFO retroactivo',()=>{
  assert.match(plugin,/Envíos sin solicitud perdió su clave histórica/);
  assert.match(plugin,/allocateRemitosToRequests\(base,remitos\)\.unmatched/);
  assert.match(plugin,/next\.includes\('allocateRemitosToRequests\(base,remitos\)\.unmatched'\)/);
});

test('Dashboard de Abastecimiento excluye decorador global de filtros por columna',()=>{
  assert.match(source,/renderAbastecimientoDashboard[\s\S]*data-dm-disable-global-column-filters="1"/);
});

test('Dashboard cuenta todos los ítems con salida aunque no tengan indicador calculable',()=>{
  const result=abastecimientoInstantVitePlugin().transform(
    source,
    '/repo/src/modules/abastecimiento/AbastecimientoModule.jsx'
  );
  assert.ok(result?.code);
  assert.match(result.code,/label="Ítems con salida" value=\{fmtNum\(raba03DashboardRows\.length\)\}/);
  assert.doesNotMatch(result.code,/label="Ítems con salida" value=\{fmtNum\(d\.movimientos\.length\)\}/);
});
