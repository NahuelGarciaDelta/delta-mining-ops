import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { backend, makeBackend, profilePayload } from "./helpers/appsScriptHarness.mjs";

const auth = (h, password) => h.call("handleAuthenticateUser_", "user@delta.test", password);
const save = (h, payload = profilePayload()) => h.call("handleUpdateUserProfile_", payload);

test("first login forces change; new password logs in, old password is rejected", () => {
  const h = makeBackend();
  assert.equal(auth(h, "DELTA.MINING.APP").mustChangePassword, true);
  const result = save(h);
  assert.equal(result.ok, true);
  assert.equal(result.mustChangePassword, false);
  assert.ok(result.authToken);
  assert.match(h.usuarios.values[1][5], /^dm-hmac-v1:/);
  assert.notEqual(h.usuarios.values[1][5], "new-safe-password");
  assert.equal(auth(h, "new-safe-password").ok, true);
  assert.equal(auth(h, "DELTA.MINING.APP").error.code, "AUTH_INVALID");
  assert.equal(h.context.stockExcelVerifyAuthToken_(result.authToken), "user@delta.test");
});
test("default password stored explicitly also requires first-login change", () => {
  const h = makeBackend();
  h.usuarios.values[1][5] = "DELTA.MINING.APP";
  assert.equal(auth(h, "DELTA.MINING.APP").mustChangePassword, true);
});
test("new-password changes transition legacy plaintext into a hash without changing other user fields", () => {
  const h = makeBackend();
  h.usuarios.values[1][5] = "old-legacy";
  const before = structuredClone(h.usuarios.values);
  assert.equal(save(h, profilePayload({ currentPassword: "old-legacy" })).ok, true);
  before[1][5] = h.usuarios.values[1][5];
  assert.deepEqual(h.usuarios.values, before);
  assert.equal(auth(h, "old-legacy").ok, false);
  assert.equal(auth(h, "new-safe-password").ok, true);
});
test("mirror rebuild interprets hashed credentials instead of hashing the stored hash again", () => {
  const h = makeBackend();
  save(h);
  assert.equal(h.call("refreshAuthMirror_").ok, true);
  assert.equal(auth(h, "new-safe-password").ok, true);
  assert.equal(auth(h, "DELTA.MINING.APP").ok, false);
});
test("mirror failure after commit is reported explicitly and cannot authorize the old password", () => {
  const h = makeBackend();
  auth(h, "DELTA.MINING.APP");
  const key = h.context.authUserPropertyKey_("user@delta.test");
  h.failures.property = (k) => k === key;
  const result = save(h);
  assert.equal(result.ok, true);
  assert.equal(result.authSync, "pending");
  assert.equal(h.properties.get(`${key}_DIRTY`), "1");
  assert.equal(auth(h, "new-safe-password").ok, true);
  assert.equal(auth(h, "DELTA.MINING.APP").ok, false);
  h.failures.property = null;
  assert.equal(auth(h, "new-safe-password").ok, true);
  assert.equal(h.properties.has(`${key}_DIRTY`), false);
});
test("cannot invalidate mirror: no password write occurs", () => {
  const h = makeBackend();
  h.failures.property = (k) => k.endsWith("_DIRTY");
  const result = save(h);
  assert.equal(result.ok, false);
  assert.equal(result.status, "pending");
  assert.equal(h.usuarios.writes.length, 0);
});
test("timeout after password write is reconciled with the same operation without rewriting password", () => {
  const h = makeBackend(),
    payload = profilePayload();
  h.usuarios.failAfterWrite = true;
  assert.equal(save(h, payload).status, "pending");
  assert.equal(auth(h, "DELTA.MINING.APP").ok, false);
  assert.equal(auth(h, "new-safe-password").ok, true);
  assert.equal(save(h, payload).ok, true);
  assert.equal(h.usuarios.writes.filter((w) => w.c === 6).length, 1);
});
test("idempotent profile retry returns the complete session, not a synthetic success", () => {
  const h = makeBackend();
  const first = save(h),
    replay = save(h);
  assert.equal(replay.ok, true);
  assert.equal(replay.deduplicated, true);
  assert.ok(replay.user);
  assert.ok(replay.authToken);
  assert.equal(replay.mustChangePassword, false);
  assert.equal(replay.user.email, first.user.email);
  assert.equal(h.usuarios.writes.length, 1);
});
test("operation reuse with changed data and concurrent stale password changes are rejected", () => {
  const h = makeBackend();
  save(h);
  assert.equal(save(h, profilePayload({ newPassword: "another-password" })).error.code, "OPERATION_REUSED");
  assert.equal(
    save(h, profilePayload({ operationId: "another-profile-operation-0002", newPassword: "another-password" })).error
      .code,
    "CURRENT_PASSWORD_INVALID"
  );
  assert.equal(h.usuarios.writes.length, 1);
});
test("forced change rejects no password, short password and reuse of default password", () => {
  for (const newPassword of ["", "abc", "DELTA.MINING.APP"]) {
    const h = makeBackend();
    assert.equal(save(h, profilePayload({ newPassword })).ok, false);
    assert.equal(h.usuarios.writes.length, 0);
  }
});
test("inactive users, duplicate emails and script-lock contention cannot mutate credentials", () => {
  const h = makeBackend();
  h.usuarios.values[1][3] = "NO";
  assert.equal(save(h).error.code, "USER_INACTIVE");
  assert.equal(h.usuarios.writes.length, 0);
  const h2 = makeBackend();
  h2.usuarios.values.push([...h2.usuarios.values[1]]);
  assert.equal(save(h2).ok, false);
  assert.equal(h2.usuarios.writes.length, 0);
  const h3 = makeBackend();
  h3.lock.tryLock();
  assert.equal(save(h3).error.code, "PROFILE_BUSY");
  h3.lock.releaseLock();
});
test("profile-only updates require a verified session and non-admin users cannot change area", () => {
  const h = makeBackend();
  save(h);
  const token = auth(h, "new-safe-password").authToken;
  const payload = profilePayload({
    operationId: "profile-only-operation-0002",
    currentPassword: "",
    newPassword: "",
    nombre: "New name",
    area: "GERENTE"
  });
  assert.equal(save(h, payload).error.code, "CURRENT_PASSWORD_INVALID");
  const result = save(h, { ...payload, actor: { token } });
  assert.equal(result.ok, true);
  assert.equal(result.user.area, "TALLER CENTRAL");
  assert.equal(result.user.rol, "USUARIO");
  assert.equal(result.user.nombre, "New name");
});
test("admin can set GERENTE area without promoting the user's role", () => {
  const h = makeBackend();
  h.usuarios.values[1][1] = "ADMIN";
  const result = save(h, profilePayload({ area: "GERENTE" }));
  assert.equal(result.user.area, "GERENTE");
  assert.equal(result.user.rol, "ADMIN");
});
test("backend preserves every original function and all unaffected function bodies", () => {
  const inventory = JSON.parse(
    fs.readFileSync(new URL("./fixtures/backend-function-inventory.json", import.meta.url), "utf8")
  );
  const names = [...backend.matchAll(/^function (\w+)\(/gm)].map((m) => m[1]);
  assert.equal(new Set(names).size, names.length);
  for (const name of inventory) assert.ok(names.includes(name), `Missing backend function: ${name}`);
  const unchanged = JSON.parse(
    fs.readFileSync(new URL("./fixtures/backend-unchanged-functions.json", import.meta.url), "utf8")
  );
  const matches = [...backend.matchAll(/^function (\w+)\(/gm)];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    if (!unchanged[match[1]]) continue;
    const chunk = backend.slice(match.index, matches[i + 1]?.index ?? backend.length);
    const body = chunk.slice(0, chunk.lastIndexOf("\n}") + 2).trim();
    assert.equal(
      crypto.createHash("sha256").update(body).digest("hex"),
      unchanged[match[1]],
      `Unrelated function changed: ${match[1]}`
    );
  }
});

test("lazy auth mirror entries are registered so removing a user invalidates its previous login", () => {
  const h = makeBackend();
  assert.equal(auth(h, "DELTA.MINING.APP").ok, true);
  const key = h.context.authUserPropertyKey_("user@delta.test");
  assert.ok(JSON.parse(h.properties.get("DM_AUTH_MIRROR_KEYS")).includes(key));
  h.usuarios.values.pop();
  h.call("refreshAuthMirror_");
  assert.equal(h.properties.has(key), false);
  assert.equal(auth(h, "DELTA.MINING.APP").ok, false);
});

test("legacy mirror snapshots are upgraded before trusting the forced-password-change flag", () => {
  const h = makeBackend();
  h.usuarios.values[1][5] = "DELTA.MINING.APP";
  const key = h.context.authUserPropertyKey_("user@delta.test");
  h.properties.set(
    key,
    JSON.stringify({
      email: "user@delta.test",
      activo: true,
      mustChangePassword: false,
      passwordHash: h.context.authPasswordHash_("user@delta.test", "DELTA.MINING.APP")
    })
  );
  assert.equal(auth(h, "DELTA.MINING.APP").mustChangePassword, true);
  assert.equal(JSON.parse(h.properties.get(key)).schemaVersion, 2);
});
