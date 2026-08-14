import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalEquipmentCode,
  cleanEquipmentCode,
  isMaintenanceCostMachine,
  maintenanceCostTypeFromFamily,
  sameEquipmentCode,
} from "../src/modules/equipment/equipmentCode.js";

test("-JM al final representa el mismo equipo", () => {
  assert.equal(canonicalEquipmentCode("RPC-0016-JM"), canonicalEquipmentCode("RPC-0016"));
  assert.equal(sameEquipmentCode("RPC-0016-JM", "RPC-0016"), true);
});

test("no mezcla internos parcialmente parecidos", () => {
  assert.equal(sameEquipmentCode("PCA-0070", "PCA-007"), false);
  assert.equal(sameEquipmentCode("PCA-0070-JM", "PCA-0070"), true);
});

test("cleanEquipmentCode conserva el formato legible sin sufijo JM", () => {
  assert.equal(cleanEquipmentCode(" rpc-0016-jm "), "RPC-0016");
});

test("RCP-0039 es únicamente un alias de escritura de RPC-0039", () => {
  assert.equal(canonicalEquipmentCode("RCP-0039"), "RPC0039");
  assert.equal(canonicalEquipmentCode("RCP0039-JM"), "RPC0039");
  assert.equal(sameEquipmentCode("RCP-0039", "RPC-0039"), true);
});

test("Informe de Costos reconoce máquinas aunque el interno venga sin guion", () => {
  for (const code of ["EXC0048", "PCA0081", "CFN0041", "MOT0047", "TOP0032", "RTP0016", "MCA0001", "MNC0001", "RPC0016", "ROD0010"]) {
    assert.equal(isMaintenanceCostMachine({ code, type: "OTROS", family: "" }), true, code);
  }

  assert.equal(maintenanceCostTypeFromFamily({ code: "EXC0048" }), "EXCAVADORA");
  assert.equal(maintenanceCostTypeFromFamily({ code: "PCA0081" }), "CARGADORA FRONTAL");
  assert.equal(maintenanceCostTypeFromFamily({ code: "MOT0047" }), "MOTONIVELADORA");
  assert.equal(maintenanceCostTypeFromFamily({ code: "TOP0032" }), "TOPADORA");
  assert.equal(maintenanceCostTypeFromFamily({ code: "RTP0016" }), "RETROPALA");
  assert.equal(maintenanceCostTypeFromFamily({ code: "RPC0016" }), "COMPACTACION");
});

test("Familia sigue mandando sobre el prefijo cuando el equipo no es una máquina vial", () => {
  assert.equal(maintenanceCostTypeFromFamily({ code: "CAT0073", family: "GENERADOR" }), "OTROS");
  assert.equal(isMaintenanceCostMachine({ code: "CAC0048", family: "CAMION DE COMBUSTIBLE" }), false);
});
