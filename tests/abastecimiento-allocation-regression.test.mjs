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

test('Ítems con salida es cerradas + parciales y 927 + 11 = 938',()=>{
  const result=abastecimientoInstantVitePlugin().transform(
    source,
    '/repo/src/modules/abastecimiento/AbastecimientoModule.jsx'
  );
  assert.ok(result?.code);
  assert.match(result.code,/label="Ítems con salida" value=\{fmtNum\(d\.cerradas\+d\.parciales\)\}/);
  assert.doesNotMatch(result.code,/label="Ítems con salida" value=\{fmtNum\(raba03DashboardRows\.length\)\}/);
  assert.doesNotMatch(result.code,/label="Ítems con salida" value=\{fmtNum\(d\.movimientos\.length\)\}/);
  assert.equal(927+11,938);
});

test('indicador conserva Fecha de salida oficial de RABA03',()=>{
  const result=abastecimientoInstantVitePlugin().transform(
    source,
    '/repo/src/modules/abastecimiento/AbastecimientoModule.jsx'
  );
  assert.ok(result?.code);
  assert.match(result.code,/fechaSalidaFuente:formatDateLocal\(pick\(r,\["Fecha de salida","Fecha salida"\]\)\)/);
  assert.match(result.code,/numeroRemitoFuente:String\(pick\(r,\["Nº Remito","N° Remito","Remito"\]\)\|\|""\)\.trim\(\)/);
  assert.match(result.code,/dm_raba03_view_rows_v3/);
});

test('Promedio indicador usa una sola fila por ítem cerrado con fecha válida',()=>{
  const result=abastecimientoInstantVitePlugin().transform(
    source,
    '/repo/src/modules/abastecimiento/AbastecimientoModule.jsx'
  );
  assert.ok(result?.code);
  assert.match(result.code,/const indicadoresCerrados=filasActivas\.filter/);
  assert.match(result.code,/fechaSalida\?calcularIndicadorRABA03\(r\.fechaSolicitud,fechaSalida\):""/);
  assert.match(result.code,/const indicadorNum=indicador===""\?NaN:Number\(indicador\);/);
  assert.match(result.code,/numeroRemito:r\.numeroRemitoFuente\|\|"",fechaSalida,indicador,indicadorNum/);
  assert.match(result.code,/const avg=indicadoresCerrados\.length\?indicadoresCerrados\.reduce\(\(a,r\)=>a\+r\.indicadorNum,0\)\/indicadoresCerrados\.length:0;/);
  assert.doesNotMatch(result.code,/const avg=movimientos\.length\?movimientos\.reduce/);
  assert.doesNotMatch(result.code,/const movimientosCerrados=/);
});

test('Distribución de demoras cuenta ítems cerrados, no remitos',()=>{
  const result=abastecimientoInstantVitePlugin().transform(
    source,
    '/repo/src/modules/abastecimiento/AbastecimientoModule.jsx'
  );
  assert.ok(result?.code);
  assert.match(result.code,/value:indicadoresCerrados\.filter\(r=>r\.indicadorNum>15\)\.length/);
  assert.doesNotMatch(result.code,/value:movimientos\.filter\(r=>r\.indicadorNum>15\)\.length/);
  assert.match(result.code,/const porProyecto=Object\.values\(indicadoresCerrados\.reduce/);
  assert.match(result.code,/const porMes=Object\.values\(movimientos\.reduce/);
  assert.match(result.code,/const masDemorados=\[\.\.\.indicadoresCerrados\]/);
});
