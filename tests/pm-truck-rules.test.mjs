import test from "node:test";
import assert from "node:assert/strict";
import {
  TRUCK_PM_INTERVAL_HOURS,
  getNextTruckPmHour,
  hasInconsistentPmReadings,
  isCanonicalTruckFamily,
  positiveOr,
  selectMaintenanceCounter,
} from "../src/modules/mantenimiento/pmRules.js";

test("familia CAMION entra y CAMIONETA queda excluida", () => {
  for (const value of ["CAMION", "CAMIÓN REGADOR", "Camion Volcador", "CAMION COMBUSTIBLE", "CAMION TRACTOR"]) {
    assert.equal(isCanonicalTruckFamily(value), true, value);
  }
  for (const value of ["CAMIONETA", "CAMIONETA CON MOCHILA", "CTA"]){
    assert.equal(isCanonicalTruckFamily(value), false, value);
  }
});

test("camion usa exclusivamente horometro aunque exista kilometraje", () => {
  const value = selectMaintenanceCounter({ horometerCandidates: [1380, 1375], mileageCandidates: [125000, 126500] }, { isTruck: true });
  assert.equal(value, 1380);
});

test("intervalo de camion es exactamente 500 h y usa el siguiente hito", () => {
  assert.equal(TRUCK_PM_INTERVAL_HOURS, 500);
  assert.equal(getNextTruckPmHour(1380, 1000), 1500);
  assert.equal(getNextTruckPmHour(1500, 1500), 2000);
  assert.equal(getNextTruckPmHour(680, 1380), 1500);
});

test("configuracion negativa no puede generar proximo PM hacia atras", () => {
  assert.equal(positiveOr(-200, 250), 250);
  assert.equal(positiveOr(0, 250), 250);
  assert.equal(positiveOr(300, 250), 300);
});

test("ultimo PM mayor al horometro actual se marca inconsistente", () => {
  assert.equal(hasInconsistentPmReadings(680, 1380), true);
  assert.equal(hasInconsistentPmReadings(1380, 1000), false);
});
