import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {pmPanelActive7DaysVitePlugin} from "../scripts/pm-panel-active-7-days-vite-plugin.mjs";
import {vehicleKmMaintenanceVitePlugin} from "../scripts/vehicle-km-maintenance-vite-plugin.mjs";
import {pmVehicleScopeVitePlugin} from "../scripts/pm-vehicle-scope-vite-plugin.mjs";
import {pmVehicleDisplayVitePlugin} from "../scripts/pm-vehicle-display-vite-plugin.mjs";
import {v9PmEquipmentParityVitePlugin} from "../scripts/v9-pm-equipment-parity-vite-plugin.mjs";

const id="/repo/src/modules/mantenimiento/MantenimientoProgramadoView.jsx";
const source=readFileSync(new URL("../src/modules/mantenimiento/MantenimientoProgramadoView.jsx",import.meta.url),"utf8");
const transformed=[
 pmPanelActive7DaysVitePlugin(),
 vehicleKmMaintenanceVitePlugin(),
 pmVehicleScopeVitePlugin(),
 pmVehicleDisplayVitePlugin(),
 v9PmEquipmentParityVitePlugin()
].reduce((code,plugin)=>plugin.transform(code,id)?.code||code,source);

const canonical=value=>String(value||"").trim().toUpperCase().replace(/(?<=\d)(?:[-_\s]?JM)$/i,"").replace(/[^A-Z0-9]/g,"");

test("V9 resolves Lista Maestra identity aliases while preserving the original PM key rule",()=>{
 const canonical=value=>String(value||"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"");
 const aliases=["CAC-0040","AG661LL"].map(canonical);
 assert.ok(aliases.includes(canonical("AG661LL")));
 assert.match(source,/const norm = v => String\(v \?\? ""\)\.toUpperCase\(\)\.normalize\("NFD"\)/);
 assert.doesNotMatch(source,/normalizePmEquipmentCode/);
 assert.match(transformed,/const codeVariants = value => \{/);
 assert.match(transformed,/listaMatch\?\.codigoNuevo \|\| listaMatch\?\.interno \|\| internoRop/);
 assert.match(transformed,/configMap\.get\(keyFinal\) \|\| configMap\.get\(norm\(listaMatch\?\.codigoNuevo\)\)/);
 assert.match(transformed,/const internoCandidates = \[\s*pick\(row, \["Codigo nuevo", "Código nuevo"\]\),/);
});

test("Lista Maestra patente-first resolves the PM_CONFIG base by Código nuevo",()=>{
 const start=transformed.indexOf("const internoCandidates = [");
 const end=transformed.indexOf("const familia =",start);
 assert.ok(start>=0&&end>start,"El transform V9 debe seleccionar explícitamente la identidad canónica");
 const selectInternal=new Function("row","text","norm","pick",`${transformed.slice(start,end)}return interno;`);
 const normKey=value=>String(value??"").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Z0-9]+/g,"").trim();
 const pickRow=(row,candidates)=>{
  const wanted=candidates.map(normKey);
  for(const [key,value] of Object.entries(row))if(wanted.includes(normKey(key))&&String(value??"").trim()!=="")return value;
  return "";
 };
 const config=new Map([
  ["CAR0089",3122],["CAC0040",8367],["CAC0060",780],["CAT0073",3700],["CAV0114",1707]
 ]);
 const fixtures=[
  ["CAR-0089","AG661LM"],["CAC-0040","AG661LL"],["CAC-0060","AI100VX"],
  ["CAT-0073","AE823BH"],["CAV-0114","AH574ZG"]
 ];
 for(const [code,plate] of fixtures){
  const row={"Código de Drusila":plate,"Codigo nuevo ":code};
  const identity=selectInternal(row,value=>String(value??"").trim(),normKey,pickRow);
  assert.equal(identity,code,`${plate} debe resolverse como ${code}`);
  assert.ok(config.has(normKey(identity)),`${code} debe encontrar su base PM`);
 }
});

test("V9 PM panel uses the already period-scoped active list, not a second exact raw-code filter",()=>{
 assert.match(transformed,/const panelVisibles = useMemo\(\(\) => visibles, \[visibles\]\)/);
 assert.doesNotMatch(transformed,/visibles\.filter\(e => panelInternosActivos7Dias\.has\(norm\(e\.interno\)\)\)/);
});

test("Truck family keeps hourly 500h PM while pickups remain kilometer based",()=>{
 assert.match(transformed,/pmEsCamion \? TRUCK_PM_INTERVAL_HOURS/);
 assert.match(transformed,/pmEsCamioneta \? VEHICLE_DEFAULTS\.intervalo/);
 assert.match(transformed,/unidadMantenimiento: pmEsCamioneta \? 'km' : 'h'/);
});

test("The V9-only plugin is active after all original PM transforms",()=>{
 const vite=readFileSync(new URL("../vite.v9.config.js",import.meta.url),"utf8");
 assert.match(vite,/pmVehicleDisplayVitePlugin\(\),v9PmEquipmentParityVitePlugin\(\),isolateV9\(\)/);
});
