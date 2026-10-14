import test from "node:test";
import assert from "node:assert/strict";
import { backend, cta0530, makeBackend, meterPayload } from "./helpers/appsScriptHarness.mjs";

const update = (h, payload) => h.call("handleListaHorometros_", payload, false);
const verify = (h, payload) => h.call("handleListaHorometros_", payload, true);

test("CTA-0530: only HORAS changes; all other values, formulas, formats, notes and validations survive", () => {
  const h = makeBackend({ formulas: { "2:10": "=SUM(A1:A2)" } }),
    before = structuredClone({ values: h.equipment.values, metadata: h.equipment.metadata });
  const result = update(h, meterPayload());
  assert.equal(result.status, "complete");
  assert.equal(result.updatedRows, 1);
  before.values[1][7] = 99900;
  assert.deepEqual(h.equipment.values, before.values);
  assert.deepEqual(h.equipment.metadata, before.metadata);
  assert.deepEqual(h.equipment.writes, [{ r: 2, c: 8, nr: 1, nc: 1, value: 99900 }]);
  assert.equal(h.equipment.values.length, 2);
  assert.ok(h.equipment.reads.every((read) => read.r === 1 || read.nc === 1));
});
test("identical values cause no writes or cache invalidation", () => {
  const h = makeBackend(),
    result = update(h, meterPayload(99879));
  assert.equal(result.skippedRows, 1);
  assert.equal(h.equipment.writes.length, 0);
  assert.equal(h.properties.has("DM_VERSION_lista_equipos"), false);
});
test("bulk writes only changed cells and bumps only Lista Maestra once", () => {
  const second = [...cta0530];
  second[0] = "BBBB";
  second[1] = "CTA-0531";
  second[7] = 20;
  const h = makeBackend({ equipmentRows: [cta0530, second] });
  const payload = meterPayload();
  payload.updates.push({ identity: { codigoNuevo: "CTA-0531" }, value: 21, expectedValue: 20 });
  const result = update(h, payload);
  assert.equal(result.updatedRows, 2);
  assert.deepEqual(
    h.equipment.writes.map((w) => [w.r, w.c, w.nc]),
    [
      [2, 8, 1],
      [3, 8, 1]
    ]
  );
  assert.equal(h.properties.get("DM_VERSION_lista_equipos"), "2");
  assert.ok(
    [...h.properties.keys()].filter((k) => k.startsWith("DM_VERSION_")).every((k) => k === "DM_VERSION_lista_equipos")
  );
});
test("lost response after setValue is pending, then reconciled without another write", () => {
  const h = makeBackend(),
    payload = meterPayload();
  h.equipment.failAfterWrite = true;
  assert.equal(update(h, payload).status, "pending");
  assert.equal(verify(h, payload).status, "complete");
  assert.equal(update(h, payload).status, "complete");
  assert.equal(h.equipment.writes.length, 1);
});
test("confirmed retries replay durable results even after another user's later update", () => {
  const h = makeBackend(),
    payload = meterPayload();
  const first = update(h, payload);
  h.equipment.values[1][7] = 100000;
  const replay = update(h, payload);
  assert.equal(replay.results[0].value, first.results[0].value);
  assert.equal(replay.results[0].currentValue, 100000);
  assert.equal(h.equipment.writes.length, 1);
  assert.equal(h.equipment.values[1][7], 100000);
});
test("partial success reports each failure and retry does not repeat successful cells", () => {
  const h = makeBackend(),
    payload = meterPayload();
  payload.updates.push({ identity: { codigoNuevo: "MISSING" }, value: 10, expectedValue: 0 });
  let result = update(h, payload);
  assert.equal(result.status, "partial");
  assert.equal(result.updatedRows, 1);
  assert.equal(result.failedRows, 1);
  assert.equal(result.results[1].code, "EQUIPO_NOT_FOUND");
  result = update(h, payload);
  assert.equal(result.status, "partial");
  assert.equal(h.equipment.writes.length, 1);
});
test("stale value conflicts instead of overwriting a newer reading", () => {
  const h = makeBackend();
  h.equipment.values[1][7] = 100000;
  const result = update(h, meterPayload());
  assert.equal(result.results[0].code, "CONFLICT");
  assert.equal(h.equipment.writes.length, 0);
});
test("script lock prevents simultaneous operations", () => {
  const h = makeBackend();
  h.lock.tryLock();
  const result = update(h, meterPayload());
  assert.equal(result.status, "pending");
  assert.equal(result.error.code, "BUSY");
  assert.equal(h.equipment.writes.length, 0);
  h.lock.releaseLock();
});
test("duplicate codes and conflicting identities fail safely", () => {
  const h = makeBackend({ equipmentRows: [cta0530, [...cta0530]] });
  assert.equal(update(h, meterPayload()).results[0].code, "AMBIGUOUS_EQUIPMENT");
  assert.equal(h.equipment.writes.length, 0);
  const other = [...cta0530];
  other[0] = "OTHER";
  other[1] = "CTA-0531";
  const h2 = makeBackend({ equipmentRows: [cta0530, other] });
  assert.equal(
    update(
      h2,
      meterPayload(99900, 99879, "meter-test-operation-0002", { codigoDrusila: "AF479QX", codigoNuevo: "CTA-0531" })
    ).results[0].code,
    "IDENTITY_CONFLICT"
  );
});
test("matching a model or another unrelated column never selects a row", () => {
  const h = makeBackend();
  assert.equal(
    update(h, meterPayload(99900, 99879, "meter-test-operation-0001", { codigoNuevo: "HILUX" })).results[0].code,
    "EQUIPO_NOT_FOUND"
  );
  assert.equal(h.equipment.writes.length, 0);
});
test("forbidden fields, missing CAS value, row numbers and malformed numeric values are rejected", () => {
  for (const extra of [{ Familia: "WRONG" }, { rowNumber: 2 }, { row: { HORAS: 12 } }]) {
    const h = makeBackend(),
      payload = meterPayload();
    Object.assign(payload.updates[0], extra);
    assert.equal(update(h, payload).results[0].code, "INVALID_FIELDS");
    assert.equal(h.equipment.writes.length, 0);
  }
  const h = makeBackend(),
    payload = meterPayload();
  delete payload.updates[0].expectedValue;
  assert.equal(update(h, payload).results[0].code, "INVALID_FIELDS");
  for (const value of [-1, "garbage", null, true, [], {}, "   "])
    assert.equal(update(makeBackend(), meterPayload(value)).results[0].code, "INVALID_VALUE");
});
test("meter formulas and duplicate headers are protected", () => {
  const h = makeBackend({ formulas: { "2:8": "=ROP02!A2" } });
  assert.equal(update(h, meterPayload()).results[0].code, "FORMULA_PROTECTED");
  assert.equal(h.equipment.writes.length, 0);
  const h2 = makeBackend();
  h2.equipment.values[0][10] = "HORAS";
  assert.equal(update(h2, meterPayload()).error.code, "AMBIGUOUS_HEADER");
});
test("moved/ordered rows are resolved by current identifiers, not a saved row index", () => {
  const other = [...cta0530];
  other[0] = "OTHER";
  other[1] = "CTA-0531";
  const h = makeBackend({ equipmentRows: [other, cta0530] });
  assert.equal(update(h, meterPayload()).results[0].rowNumber, 3);
  assert.equal(h.equipment.writes[0].r, 3);
});
test("receipt persistence failure before write stops the mutation; after commit preserves success", () => {
  const h = makeBackend();
  h.failures.property = (key) => key.startsWith("DM_METER_OP_");
  assert.equal(update(h, meterPayload()).status, "failed");
  assert.equal(h.equipment.writes.length, 0);
  const h2 = makeBackend();
  h2.failures.property = (key, value) => key.startsWith("DM_METER_OP_") && JSON.parse(value).status === "confirmed";
  assert.equal(update(h2, meterPayload()).status, "complete");
  assert.equal(verify(h2, meterPayload()).status, "complete");
  assert.equal(h2.equipment.writes.length, 1);
});
test("idempotency key cannot be reused with a different value", () => {
  const h = makeBackend();
  update(h, meterPayload());
  assert.equal(update(h, meterPayload(100000)).results[0].code, "OPERATION_REUSED");
  assert.equal(h.equipment.writes.length, 1);
});
test("verification is read-only and cannot invent success without a receipt", () => {
  const h = makeBackend();
  assert.equal(verify(h, meterPayload(99879)).status, "pending");
  assert.equal(h.equipment.writes.length, 0);
});
test("legacy bulk route rejects broad row updates; explicit equipment editing preserves unrelated formulas", () => {
  const h = makeBackend();
  assert.equal(
    h.call("handleBulkUpdateListaEquiposFromApp_", [{ originalKeys: { codigoNuevo: "CTA-0530" }, row: { HORAS: 12 } }])
      .ok,
    false
  );
  const result = h.call(
    "handleUpdateListaEquipo_",
    { codigoDrusila: "AF479QX", codigoNuevo: "CTA-0530" },
    { Marca: "TOYOTA NEW" }
  );
  assert.equal(result.ok, true);
  assert.equal(h.equipment.writes.length, 1);
  assert.equal(h.equipment.writes[0].c, 4);
});
test("backend meter route exposes no generic row write, append or full-table synchronization", () => {
  const section = backend.slice(
    backend.indexOf("function handleListaHorometros_"),
    backend.indexOf("function handleBulkUpdateListaEquiposFromApp_", backend.indexOf("function handleListaHorometros_"))
  );
  assert.doesNotMatch(section, /setValues|appendRow|insertRow|handleUpdateListaEquipo_|clearAllCache_|Supabase/);
});

test("meter operations require an active authorized session", () => {
  const h = makeBackend();
  const payload = { ...meterPayload(), actor: { email: "user@delta.test", token: "invalid" } };
  assert.equal(update(h, payload).error.code, "AUTH_REQUIRED");
  assert.equal(h.equipment.writes.length, 0);
  const h2 = makeBackend();
  h2.usuarios.values[1][6] = "GERENTE";
  assert.equal(update(h2, meterPayload()).error.code, "FORBIDDEN");
  assert.equal(h2.equipment.writes.length, 0);
});

test("a row reordered after the batch index is read is rejected before any meter write", () => {
  const other = [...cta0530];
  other[0] = "OTHER";
  other[1] = "CTA-0531";
  const h = makeBackend({ equipmentRows: [cta0530, other] });
  h.equipment.onReadValue = ({ r, c }) => {
    if (r === 2 && c === 8) {
      h.equipment.onReadValue = null;
      [h.equipment.values[1], h.equipment.values[2]] = [h.equipment.values[2], h.equipment.values[1]];
    }
  };
  const result = update(h, meterPayload());
  assert.equal(result.results[0].code, "ROW_MOVED");
  assert.equal(h.equipment.writes.length, 0);
  assert.equal(update(h, meterPayload()).status, "complete");
  assert.equal(h.equipment.writes[0].r, 3);
});

test("cache-version failure cannot turn a persisted meter into failure and verification repairs only its metadata", () => {
  const h = makeBackend(),
    payload = meterPayload();
  h.failures.property = (key) => key === "DM_VERSION_lista_equipos";
  const result = update(h, payload);
  assert.equal(result.status, "complete");
  assert.ok(result.cacheWarning);
  assert.equal(h.properties.get("DM_LISTA_METER_DIRTY"), "1");
  h.failures.property = null;
  assert.equal(verify(h, payload).status, "complete");
  assert.equal(h.properties.has("DM_LISTA_METER_DIRTY"), false);
  assert.equal(h.equipment.writes.length, 1);
});
