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

test("V9 PM treats -JM as temporary code alias, without changing source identifiers",()=>{
 for(const [rop,master] of [
  ["CAR-0089-JM","CAR-0089"],
  ["CAV-0114-JM","CAV-0114"],
  ["CTA-0879-JM","CTA-0879"],
  ["CTA-0888-JM","CTA-0888"],
  ["CTA-1067-JM","CTA-1067"],
  ["CTA-1410-JM","CTA-1410"],
  ["CTA-1411-JM","CTA-1411"],
  ["CTA-1800-JM","CTA-1800"],
  ["CTA-1834-JM","CTA-1834"]
 ])assert.equal(canonical(rop),canonical(master));
 assert.match(transformed,/const codeVariants = value => \{/);
 assert.match(transformed,/const norm = v => [^\n]*replace\(\/\(\\d\)\(\?:\[-_\\s\]\?JM\)\$\/i, "\$1"\)/);
 assert.match(transformed,/\.replace\(\/\(\?<=\\d\)\(\?:\[-_\\s\]\?JM\)\$\/i, ''\)/);
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
