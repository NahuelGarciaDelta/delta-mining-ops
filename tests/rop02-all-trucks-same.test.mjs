import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abastecimientoLineEndingsVitePlugin } from '../scripts/abastecimiento-line-endings-vite-plugin.mjs';
import { rop02TruckPickupSplitVitePlugin } from '../scripts/rop02-truck-pickup-split-vite-plugin.mjs';
import { rop02UnifyTrucksVitePlugin } from '../scripts/rop02-unify-trucks-vite-plugin.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const plugins=[abastecimientoLineEndingsVitePlugin(),rop02TruckPickupSplitVitePlugin(),rop02UnifyTrucksVitePlugin()];

function transform(rel){
  let code=fs.readFileSync(path.join(root,rel),'utf8');
  const id=path.join(root,rel);
  for(const plugin of plugins){
    const result=plugin.transform(code,id);
    if(result?.code)code=result.code;
  }
  return code;
}

test('CAA-0002 deja de ser una excepción global de control ROP02',()=>{
  const code=transform('src/shared/domain/index.jsx');
  assert.match(code,/function isRop02ControlMachineExcluded\(_maquina\)\{return false;\}/);
  assert.doesNotMatch(code,/return norm==="CAA-0002"/);
});

test('Control de errores y Control por Equipo usan el mismo universo para todos los camiones',()=>{
  const code=transform('src/modules/oficina-tecnica/OficinaTecnicaModule.jsx');
  const direct=(code.match(/const rop02ControlRows=useMemo\(\(\)=>rop02Prod,\[rop02Prod\]\);/g)||[]).length;
  assert.equal(direct,2);
  assert.doesNotMatch(code,/normalizeMachineCode\(m\)!=="CAA-0002"/);
  assert.doesNotMatch(code,/normalizeMachineCode\(machine\)==="CAA-0002"/);
  assert.match(code,/function isRop02HourlyEquipment\(row\)[\s\S]*if\(kind==="camiones"\)return true;/);
});

test('el plugin uniforme corre después del split de camiones y camionetas',()=>{
  const config=fs.readFileSync(path.join(root,'vite.config.js'),'utf8');
  const pluginsText=config.match(/plugins:\s*\[([^\]]+)/s)?.[1]||'';
  const split=pluginsText.indexOf('rop02TruckPickupSplitVitePlugin()');
  const unify=pluginsText.indexOf('rop02UnifyTrucksVitePlugin()');
  assert.ok(split>=0);
  assert.ok(unify>split);
});
