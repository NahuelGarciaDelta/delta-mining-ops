import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { vehicleKmMaintenanceVitePlugin } from "../scripts/vehicle-km-maintenance-vite-plugin.mjs";
import { pmVehicleScopeVitePlugin } from "../scripts/pm-vehicle-scope-vite-plugin.mjs";
import { pmVehicleDisplayVitePlugin } from "../scripts/pm-vehicle-display-vite-plugin.mjs";

const source = fs.readFileSync(new URL("../src/modules/mantenimiento/MantenimientoProgramadoView.jsx", import.meta.url), "utf8");
const id = "/workspace/src/modules/mantenimiento/MantenimientoProgramadoView.jsx";

function transformedPmSource(){
  let code = source;
  for(const plugin of [vehicleKmMaintenanceVitePlugin(), pmVehicleScopeVitePlugin(), pmVehicleDisplayVitePlugin()]){
    const result = plugin.transform(code, id);
    if(result?.code) code = result.code;
  }
  return code;
}

test("pipeline PM declara keys antes de usarla", () => {
  const code = transformedPmSource();
  const declaration = code.indexOf("const keys = codeVariants(rawInterno);");
  const usage = code.indexOf("const prev = keys.map");
  assert.ok(declaration >= 0, "Debe existir la declaración local de keys");
  assert.ok(usage > declaration, "keys debe declararse antes de usarse en actividad ROP02");
});

test("camiones quedan fuera de la lógica por kilometraje", () => {
  const code = transformedPmSource();
  assert.match(code, /return family\.includes\('CAMIONETA'\) \|\| internal\.startsWith\('CTA'\);/);
  assert.doesNotMatch(code, /family\.includes\('CAMION'\) \|\|/);
  assert.match(code, /intervalo: pmEsCamion \? TRUCK_PM_INTERVAL_HOURS : \(pmEsCamioneta \? VEHICLE_DEFAULTS\.intervalo/);
  assert.match(code, /unidadMantenimiento: pmEsCamioneta \? 'km' : 'h'/);
});

test("actividad ROP02 decide camión con aliases canónicos y mantiene horómetro", () => {
  const code = transformedPmSource();
  assert.match(code, /const esCamion = keys\.some\(key => truckInternos\.has\(key\)\);/);
  assert.match(code, /const horas = ropHoras\(row, esCamion\);/);
  assert.match(code, /if \(next\) keys\.forEach\(key => map\.set\(key, next\)\);/);
});
