import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../src/modules/abastecimiento/AbastecimientoModule.jsx',import.meta.url),'utf8');
test('Abastecimiento usa snapshot Supabase y allocator compartido',()=>{assert.match(source,/getAbastecimientoSnapshot/);assert.match(source,/allocateAbastecimientoRemitos/);assert.match(source,/appendAbastecimientoRaba03/);assert.match(source,/updateAbastecimientoRaba03/);});
test('Ítems con salida conserva cerradas + parciales',()=>{assert.match(source,/label="Ítems con salida" value=\{fmtNum\(d\.cerradas\+d\.parciales\)\}/);assert.doesNotMatch(source,/label="Ítems con salida" value=\{fmtNum\(d\.movimientos\.length\)\}/);});
test('indicadores usan un ítem cerrado único y Salidas por mes conserva remitos',()=>{assert.match(source,/const indicadoresCerrados=filasActivas/);assert.match(source,/const avg=indicadoresCerrados\.length/);assert.match(source,/value:indicadoresCerrados\.filter\(r=>r\.indicadorNum>15\)\.length/);assert.match(source,/const porProyecto=Object\.values\(indicadoresCerrados\.reduce/);assert.match(source,/const porMes=Object\.values\(movimientos\.reduce/);assert.match(source,/fechaSalidaFuente:formatDateLocal/);});
test('dashboard no recibe filtro global por columnas',()=>assert.match(source,/renderAbastecimientoDashboard[\s\S]*data-dm-disable-global-column-filters="1"/));
