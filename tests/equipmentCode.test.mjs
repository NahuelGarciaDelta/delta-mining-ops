import test from "node:test";
import assert from "node:assert/strict";
import { canonicalEquipmentCode, cleanEquipmentCode, sameEquipmentCode } from "../src/modules/equipment/equipmentCode.js";

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
