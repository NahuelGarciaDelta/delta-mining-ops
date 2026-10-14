import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { makeBackend, memoryStorage, profilePayload, cta0530, equipmentHeaders } from "./helpers/appsScriptHarness.mjs";
import { requestAppsScript } from "../src/services/confirmedWrites.js";
import { createProfileOperation, saveProfileOperation } from "../src/services/profileUpdates.js";
import {
  buildAuthenticatedUser,
  saveAuthenticatedSession,
  getAuthenticatedUser,
  clearAuthenticatedSession
} from "../src/services/authSession.js";
import {
  createHorometerOperation,
  submitHorometerOperation,
  patchConfirmedMeters,
  listaIdentityFromRow,
  meterNumber
} from "../src/services/horometerUpdates.js";
import { isProtectedMutationAction } from "../src/services/mutationGuard.js";

function prepareSession(h) {
  globalThis.sessionStorage = memoryStorage();
  const result = h.call("handleAuthenticateUser_", "user@delta.test", "DELTA.MINING.APP");
  saveAuthenticatedSession(buildAuthenticatedUser(result), { mustChangePassword: true });
}
function routeBackend(h, calls, { loseFirst = false } = {}) {
  let lost = loseFirst;
  return async (url, options) => {
    calls.push({ url, payload: JSON.parse(options.body.get("payload")) });
    assert.equal(url, "/api/apps-script");
    const response = h.call("doPost", { parameter: { payload: options.body.get("payload") } });
    if (lost) {
      lost = false;
      throw new Error("HTTP response lost after the backend committed");
    }
    return new Response(response.text, { status: 200, headers: { "Content-Type": "application/json" } });
  };
}
test("frontend password change retries lost response idempotently, persists full session and rotates token fields", async () => {
  const h = makeBackend(),
    calls = [];
  prepareSession(h);
  globalThis.fetch = routeBackend(h, calls, { loseFirst: true });
  const operation = createProfileOperation(profilePayload());
  const result = await saveProfileOperation("/api/apps-script", operation);
  assert.equal(result.mustChangePassword, false);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].payload.operationId, calls[1].payload.operationId);
  assert.equal(h.usuarios.writes.filter((w) => w.c === 6).length, 1);
  const user = getAuthenticatedUser();
  assert.ok(user.authToken);
  assert.equal(user.authToken, user.token);
  assert.equal(sessionStorage.getItem("dm_auth_token"), user.authToken);
  assert.equal(sessionStorage.getItem("dm_must_change_password"), "0");
  assert.equal(h.call("handleAuthenticateUser_", "user@delta.test", "new-safe-password").ok, true);
  assert.equal(h.call("handleAuthenticateUser_", "user@delta.test", "DELTA.MINING.APP").ok, false);
});
test("simultaneous frontend profile submissions share a single request", async () => {
  const h = makeBackend(),
    calls = [];
  prepareSession(h);
  globalThis.fetch = routeBackend(h, calls);
  const operation = createProfileOperation(profilePayload());
  const [a, b] = await Promise.all([
    saveProfileOperation("/api/apps-script", operation),
    saveProfileOperation("/api/apps-script", operation)
  ]);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(calls.length, 1);
});
test("failed profile confirmation retains forced-change state and reports uncertainty", async () => {
  const h = makeBackend();
  prepareSession(h);
  globalThis.fetch = async () => {
    throw new Error("network offline");
  };
  await assert.rejects(
    saveProfileOperation("/api/apps-script", createProfileOperation(profilePayload())),
    (error) => error.code === "PROFILE_CONFIRMATION_PENDING"
  );
  assert.equal(sessionStorage.getItem("dm_must_change_password"), "1");
});
test("meter transport reconciles lost response using only operation results, without Supabase or global reload", async () => {
  const h = makeBackend(),
    calls = [];
  prepareSession(h);
  h.call("handleUpdateUserProfile_", profilePayload());
  globalThis.fetch = routeBackend(h, calls, { loseFirst: true });
  const operation = createHorometerOperation([
    { identity: { codigoDrusila: "AF479QX", codigoNuevo: "CTA-0530" }, value: 99900, expectedValue: 99879 }
  ]);
  const result = await submitHorometerOperation("/api/apps-script", operation);
  assert.equal(result.status, "complete");
  assert.deepEqual(
    calls.map((c) => c.payload.action),
    ["update_lista_horometros", "verify_lista_horometros"]
  );
  assert.equal(h.equipment.writes.length, 1);
  assert.equal(calls[0].payload.operationId, calls[1].payload.operationId);
  const original = Object.fromEntries(equipmentHeaders.map((key, i) => [key, cta0530[i]]));
  assert.deepEqual(patchConfirmedMeters([original], result.results), [{ ...original, HORAS: 99900 }]);
});
test("partial results preserve success and identify failed equipment instead of throwing a false total failure", async () => {
  const h = makeBackend(),
    calls = [];
  prepareSession(h);
  h.call("handleUpdateUserProfile_", profilePayload());
  globalThis.fetch = routeBackend(h, calls);
  const operation = createHorometerOperation([
    { identity: { codigoNuevo: "CTA-0530" }, value: 99900, expectedValue: 99879 },
    { identity: { codigoNuevo: "NO-SUCH-EQUIPMENT" }, value: 10, expectedValue: 0 }
  ]);
  const result = await submitHorometerOperation("/api/apps-script", operation);
  assert.equal(result.status, "partial");
  assert.equal(result.updatedRows, 1);
  assert.equal(result.failedRows, 1);
  assert.equal(result.results[1].identity.codigoNuevo, "NO-SUCH-EQUIPMENT");
});
test("unknown or malformed server responses never create synthetic success", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: true }), { status: 200 });
  const result = await submitHorometerOperation(
    "/api/apps-script",
    createHorometerOperation([{ identity: { codigoNuevo: "CTA-0530" }, value: 99900, expectedValue: 99879 }])
  );
  assert.equal(result.status, "pending");
  assert.equal(result.updatedRows, 0);
});
test("targeted local patch preserves real identifiers even when displayed codes are aliases", () => {
  const original = Object.fromEntries(equipmentHeaders.map((key, i) => [key, cta0530[i]]));
  const display = { ...original, "Codigo nuevo": "DISPLAY-ALIAS", _listaIdentity: listaIdentityFromRow(original) };
  const result = {
    status: "confirmed",
    identity: { codigoNuevo: "CTA-0530" },
    column: "HORAS",
    value: 99900,
    currentValue: 100000
  };
  assert.deepEqual(patchConfirmedMeters([display], [result]), [{ ...display, HORAS: 100000 }]);
});
test("decimal numeric readings are never multiplied by ten by dropping their decimal point", () => {
  assert.equal(meterNumber(1234.56), 1234.56);
  assert.equal(meterNumber("1234.56"), 1234.56);
  assert.equal(meterNumber("1.234,56"), 1234.56);
  assert.equal(meterNumber(""), null);
});
test("backend-confirmed operations bypass synthetic mutation-guard responses", () => {
  for (const action of ["update_user_profile", "update_lista_horometros", "verify_lista_horometros"])
    assert.equal(isProtectedMutationAction(action), false);
  assert.equal(isProtectedMutationAction("save_remito_cargado"), true);
});
test("transport timeout aborts and preserves an unknown mutation outcome for its caller", async () => {
  globalThis.fetch = (_url, { signal }) =>
    new Promise((_resolve, reject) =>
      signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), {
        once: true
      })
    );
  await assert.rejects(
    requestAppsScript("/api/apps-script", { action: "test" }, { timeoutMs: 5 }),
    (error) => error.name === "AbortError"
  );
});
test("login and meter UI do not call Supabase authentication or reload complete sources after mutation", () => {
  const login = fs.readFileSync(new URL("../src/modules/auth/Login.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(login, /authenticateSupabaseUser/);
  const office = fs.readFileSync(
    new URL("../src/modules/oficina-tecnica/OficinaTecnicaModule.jsx", import.meta.url),
    "utf8"
  );
  const action = office.slice(
    office.indexOf("  const actualizarListaEnExcel="),
    office.indexOf("  },[buildListaExcelUpdates,horasKey,onMetersConfirmed]);")
  );
  assert.doesNotMatch(action, /onReloadLista|fetchSupabase|loadSources/);
  assert.match(action, /onMetersConfirmed/);
});
test("logout clears updated session tokens", () => {
  clearAuthenticatedSession();
  assert.equal(getAuthenticatedUser(), null);
  assert.equal(sessionStorage.getItem("dm_auth_token"), null);
});

test("late password response after logout cannot recreate a session", async () => {
  const h = makeBackend(),
    calls = [];
  prepareSession(h);
  let release;
  const ready = new Promise((resolve) => {
    release = resolve;
  });
  const route = routeBackend(h, calls);
  globalThis.fetch = async (...args) => {
    const response = await route(...args);
    await ready;
    return response;
  };
  const task = saveProfileOperation("/api/apps-script", createProfileOperation(profilePayload()));
  clearAuthenticatedSession();
  release();
  await assert.rejects(task, (error) => error.code === "SESSION_CHANGED");
  assert.equal(getAuthenticatedUser(), null);
  assert.equal(sessionStorage.getItem("dm_auth"), null);
  assert.equal(h.call("handleAuthenticateUser_", "user@delta.test", "new-safe-password").ok, true);
});

test("old backend sessions cannot submit a new plaintext password change", () => {
  globalThis.sessionStorage = memoryStorage();
  saveAuthenticatedSession({ email: "user@delta.test", authToken: "legacy-token" });
  assert.throws(() => createProfileOperation(profilePayload()), /backend debe actualizarse/);
});

test("manual legacy auth retirement targets only that RPC and never changes data or operational read functions", () => {
  const sql = fs.readFileSync(
    new URL("../supabase/migrations/20261014_retire_legacy_auth_rpc.sql", import.meta.url),
    "utf8"
  );
  assert.match(sql, /p\.proname = 'app_authenticate_user'/);
  assert.match(sql, /REVOKE EXECUTE ON FUNCTION/);
  assert.doesNotMatch(sql, /\b(DROP|TRUNCATE|DELETE FROM|UPDATE|INSERT INTO)\b/);
  assert.doesNotMatch(sql, /app_pm_snapshot|delta_source_versions|rop02_frontend/);
});

test("Supabase code aliases with identical values retain the real equipment identity", () => {
  const row = {
    "Código de Drusila": "AF479QX",
    "Codigo de Drusila": "AF479QX",
    "Codigo nuevo": "CTA-0530",
    "Código nuevo": "CTA-0530",
    HORAS: 99879
  };
  assert.deepEqual(listaIdentityFromRow(row), { codigoDrusila: "AF479QX", codigoNuevo: "CTA-0530" });
  assert.equal(
    patchConfirmedMeters(
      [row],
      [
        {
          status: "confirmed",
          identity: { codigoDrusila: "AF479QX", codigoNuevo: "CTA-0530" },
          column: "HORAS",
          value: 99900
        }
      ]
    )[0].HORAS,
    99900
  );
});
test("conflicting code aliases cannot manufacture an unambiguous identifier", () => {
  assert.equal(listaIdentityFromRow({ "Codigo nuevo": "CTA-0530", "Código nuevo": "CTA-OTHER" }).codigoNuevo, "");
});
