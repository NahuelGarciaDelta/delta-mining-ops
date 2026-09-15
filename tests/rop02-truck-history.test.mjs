import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abastecimientoLineEndingsVitePlugin } from '../scripts/abastecimiento-line-endings-vite-plugin.mjs';
import { rop02TruckPickupSplitVitePlugin } from '../scripts/rop02-truck-pickup-split-vite-plugin.mjs';
import { rop02UnifyTrucksVitePlugin } from '../scripts/rop02-unify-trucks-vite-plugin.mjs';
import { rop02TruckHistoryVitePlugin } from '../scripts/rop02-truck-history-vite-plugin.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const plugins=[
  abastecimientoLineEndingsVitePlugin(),
  rop02TruckPickupSplitVitePlugin(),
  rop02UnifyTrucksVitePlugin(),
  rop02TruckHistoryVitePlugin(),
];

function transform(rel,{crlf=false}={}){
  let code=fs.readFileSync(path.join(root,rel),'utf8');
  if(crlf)code=code.replace(/\r?\n/g,'\r\n');
  const id=path.join(root,rel);
  for(const plugin of plugins){
    const result=plugin.transform(code,id);
    if(result?.code)code=result.code;
  }
  return code;
}

test('Equipos excluye camiones pero los controles horarios los conservan',()=>{
  const code=transform('src/modules/oficina-tecnica/OficinaTecnicaModule.jsx');
  assert.match(code,/rop02All\.filter\(r=>isRop02HourlyEquipment\(r\)&&!isRop02TruckRow\(r\)\)/);
  assert.match(code,/onRemoteExport\(\)\)\.filter\(r=>isRop02HourlyEquipment\(r\)&&!isRop02TruckRow\(r\)\)/);
  assert.match(code,/if\(kind==="camiones"\)return true;/);
  assert.match(code,/vehicleKind="camiones"/);
});

test('camiones no generan controles históricos entre mayo y agosto de 2026',()=>{
  const code=transform('src/modules/oficina-tecnica/OficinaTecnicaModule.jsx');
  assert.match(code,/fecha>="2026-05-01"&&fecha<="2026-08-31"/);
  const filteredControls=(code.match(/calcularErroresControlEquipo\(filtered\.filter\(isRop02TruckControlEligible\)\)/g)||[]).length;
  assert.equal(filteredControls,2);
  assert.match(code,/atrasoSource\.filter\(r=>isRop02HourlyEquipment\(r\)&&isRop02TruckControlEligible\(r\)&&r\.fecha\)/);
  assert.match(code,/erroresAceptados\.filter\(error=>\{\s*if\(!isRop02TruckControlEligible\(error\)\)return false;/s);
});

test('la corrección funciona también con archivos CRLF de Windows',()=>{
  const code=transform('src/modules/oficina-tecnica/OficinaTecnicaModule.jsx',{crlf:true});
  assert.ok(!code.includes('\r\n'));
  assert.match(code,/!isRop02TruckRow\(r\)/);
  assert.match(code,/2026-08-31/);
});

test('el plugin histórico corre después de split y unificación',()=>{
  const config=fs.readFileSync(path.join(root,'vite.config.js'),'utf8');
  const pluginsText=config.match(/plugins:\s*\[([^\]]+)/s)?.[1]||'';
  const split=pluginsText.indexOf('rop02TruckPickupSplitVitePlugin()');
  const unify=pluginsText.indexOf('rop02UnifyTrucksVitePlugin()');
  const history=pluginsText.indexOf('rop02TruckHistoryVitePlugin()');
  assert.ok(split>=0);
  assert.ok(unify>split);
  assert.ok(history>unify);
});
