import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { abastecimientoInstantVitePlugin } from '../scripts/abastecimiento-instant-vite-plugin.mjs';

const source=fs.readFileSync(new URL('../src/modules/abastecimiento/AbastecimientoModule.jsx',import.meta.url),'utf8');
const proxy=fs.readFileSync(new URL('../api/apps-script.js',import.meta.url),'utf8');

test('1527ALT puede vincular por código + proyecto aunque cambie la descripción',()=>{
  assert.match(source,/const key=\[code,proyecto\]\.join\("__"\)/);
  assert.match(source,/const key=shipment\.proyecto\?\[shipment\.code,shipment\.proyecto\]\.join\("__"\):""/);
  assert.doesNotMatch(source,/\[code,proyecto,insumoKey\]\.join\("__"\)/);
  assert.doesNotMatch(source,/sol\.descripcion===descripcionNormalizada/);

  const request={codigo:'1527ALT',proyecto:'JOSE MARIA',descripcion:'FILTRO DE COMBUSTIBLE',fecha:'14/9/2026',solicitada:3};
  const remito={codigo:'1527ALT',proyecto:'JOSE MARIA',descripcion:'FILTRO COMBUS FF5488 600-319-3750',fecha:'14/9/2026',cantidad:3};
  const normCode=v=>String(v).toUpperCase().replace(/[^A-Z0-9]/g,'');
  assert.equal(`${normCode(request.codigo)}__${request.proyecto}`,`${normCode(remito.codigo)}__${remito.proyecto}`);
  assert.notEqual(request.descripcion,remito.descripcion);
});

test('eliminar remito espera confirmación de Google Sheets antes de quitarlo de UI',()=>{
  const start=source.indexOf('const deleteRemito=async(id)=>{');
  const end=source.indexOf('\n  const badgeStyle=',start);
  assert.ok(start>=0&&end>start);
  const block=source.slice(start,end);
  assert.match(block,/setActionLoading\("Eliminando remito y actualizando Google Sheets\.\.\."\)/);
  assert.match(block,/const json=await res\.json\(\)/);
  assert.match(block,/if\(!json\.ok\)throw/);
  assert.match(block,/deletedConfirmed=true/);
  assert.match(block,/const nextRemitos=\(remitosRef\.current\|\|\[\]\)\.filter\(r=>r\.id!==id\)/);
  assert.match(block,/setRemitos\(nextRemitos\)/);
  assert.ok(block.indexOf('deletedConfirmed=true') < block.indexOf('setRemitos(nextRemitos)'));
  assert.match(block,/await persistRaba03AllocationForPairs\(nextRemitos,affectedPairs\)/);
  assert.match(block,/loadRemitosCompartidos\(\{silent:true\}\)/);
  assert.match(block,/finally\{\s*setActionLoading\(""\)/);
});

test('guardar remito confirma Google Sheets y sincroniza RABA03 antes de quitar Cargando',()=>{
  const start=source.indexOf('const registerRemito=async()=>{');
  const end=source.indexOf('\n  const deleteRemito=',start);
  assert.ok(start>=0&&end>start);
  const block=source.slice(start,end);
  assert.match(block,/setActionLoading\("Guardando remito y actualizando Google Sheets\.\.\."\)/);
  assert.match(block,/await saveRemitoCompartido\(nuevo\)/);
  assert.match(block,/guardados\.push\(\{\.\.\.nuevo,shared:true\}\)/);
  assert.match(block,/setRemitos\(nextRemitos\)/);
  assert.match(block,/await persistRaba03AllocationForPairs\(nextRemitos,affectedPairs\)/);
  assert.match(block,/finally\{\s*setActionLoading\(""\)/);
});

test('RABA03 normal usa CacheService; proxy no fuerza lectura física',()=>{
  const rabaBlock=proxy.match(/if \(req\.method === "GET" && String\(query\.action[\s\S]*?\n  \}/)?.[0]||'';
  assert.match(rabaBlock,/query\.limit = "all"/);
  assert.doesNotMatch(rabaBlock,/query\.force = "1"/);
});

test('dashboard usa fecha final del remito vinculado y no depende de Fecha de salida persistida',()=>{
  const result=abastecimientoInstantVitePlugin().transform(source,'/repo/src/modules/abastecimiento/AbastecimientoModule.jsx');
  assert.ok(result?.code);
  assert.match(result.code,/const matched=Array\.isArray\(r\._matchedRemitos\)\?r\._matchedRemitos:\[\]/);
  assert.match(result.code,/const last=ordered\.length\?ordered\[ordered\.length-1\]:null/);
  assert.match(result.code,/const fechaSalida=String\(last\?\.fecha\|\|""\)\.trim\(\)/);
  assert.match(result.code,/dm_raba03_view_rows_v4/);
});
