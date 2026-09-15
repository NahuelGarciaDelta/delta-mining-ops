import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abastecimientoLineEndingsVitePlugin } from '../scripts/abastecimiento-line-endings-vite-plugin.mjs';
import { rop02TruckPickupSplitVitePlugin } from '../scripts/rop02-truck-pickup-split-vite-plugin.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const normalizer=abastecimientoLineEndingsVitePlugin();
const feature=rop02TruckPickupSplitVitePlugin();

function read(rel){return fs.readFileSync(path.join(root,rel),'utf8');}
function transform(rel,{crlf=false}={}){
  let code=read(rel);
  if(crlf)code=code.replace(/\r?\n/g,'\r\n');
  const id=path.join(root,rel);
  const normalized=normalizer.transform(code,id);
  if(normalized?.code)code=normalized.code;
  const result=feature.transform(code,id);
  return result?.code||code;
}

test('App separa sidebar y estados de Camiones/Camionetas',()=>{
  const code=transform('src/App.jsx');
  assert.match(code,/id:"camiones",icon:"truck",label:"Camiones"/);
  assert.match(code,/id:"camionetas",icon:"car",label:"Camionetas"/);
  assert.match(code,/const\[stCamiones,setStCamiones\]/);
  assert.match(code,/const\[stCamionetas,setStCamionetas\]/);
  assert.match(code,/stCamiones=\{stCamiones\}/);
  assert.match(code,/"camiones","camionetas","controlROP02"/);
});

test('Oficina Técnica separa la vista y suma camiones al universo horario',()=>{
  const code=transform('src/modules/oficina-tecnica/OficinaTecnicaModule.jsx');
  assert.match(code,/function rop02VehicleKind\(row\)/);
  assert.match(code,/function isRop02HourlyEquipment\(row\)/);
  assert.match(code,/vehicleKind="camiones"/);
  assert.match(code,/vehicleKind="camionetas"/);
  assert.match(code,/fleetTypes\.map\(tipo=>\(/);
  assert.match(code,/label=\{medidaLabel\}/);
  assert.match(code,/Flota de \$\{plural\}/);
  const eligible=(code.match(/filter\(r=>isRop02HourlyEquipment\(r\)\)/g)||[]).length;
  assert.ok(eligible>=4,`Se esperaban al menos 4 controles horarios con camiones; se encontraron ${eligible}`);
});

test('Camiones y camionetas cargan las mismas fuentes ROP02',()=>{
  const code=transform('src/config/viewSources.js');
  assert.match(code,/camiones:\["rop02_fs","rop02_jm","rop02_filosur","rop02_zorro","lista_equipos"\]/);
  assert.match(code,/camionetas:\["rop02_fs","rop02_jm","rop02_filosur","rop02_zorro","lista_equipos"\]/);
});

test('Control de horas mensuales excluye camionetas pero incluye camiones',()=>{
  const code=transform('src/modules/analytics/OperationalAnalytics.jsx');
  assert.match(code,/const esCamionetaTurno=/);
  assert.doesNotMatch(code,/esCamionOCamionetaTurno/);
  assert.match(code,/Los camiones se incluyen porque se controlan por horas/);
});

test('La transformación completa funciona con CRLF de Windows',()=>{
  const files=[
    'src/App.jsx',
    'src/modules/oficina-tecnica/OficinaTecnicaModule.jsx',
    'src/config/viewSources.js',
    'src/modules/analytics/OperationalAnalytics.jsx',
  ];
  for(const rel of files){
    const code=transform(rel,{crlf:true});
    assert.ok(code.length>0,rel);
    assert.ok(!code.includes('\r\n'),`${rel} debe normalizar CRLF antes de los plugins`);
  }
});

test('El normalizador global está primero en Vite',()=>{
  const config=read('vite.config.js');
  const plugins=config.match(/plugins:\s*\[([^\]]+)/s)?.[1]||'';
  assert.ok(plugins.trim().startsWith('abastecimientoLineEndingsVitePlugin()'));
  assert.ok(plugins.indexOf('rop02TruckPickupSplitVitePlugin()')>plugins.indexOf('abastecimientoLineEndingsVitePlugin()'));
});
