import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import handler from "../api/v9-ops.js";

const keys = ["DELTA_V9_SUPABASE_PUBLISHABLE_KEY", "DELTA_V9_SUPABASE_URL", "DELTA_V9_GAS_URL", "DELTA_V9_AUTH_BRIDGE_URL", "DELTA_V9_SUPABASE_SERVICE_KEY"];
const previous = Object.fromEntries(keys.map(k => [k, process.env[k]]));
const originalFetch = globalThis.fetch;
const token = "real-session-" + "t".repeat(32);
const publishable = "sb_publishable_" + "p".repeat(36);

function res() {
  return {
    statusCode: 200, headers: {}, body: undefined,
    setHeader(k, v) { this.headers[k] = v; return this; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; }
  };
}
function req(body = { mode: "preview" }, credential, method = "POST") {
  // Preserve an explicitly missing token; only omitted arguments use the fixture.
  if (arguments.length < 2) credential = token;
  return { method, headers: { "x-delta-auth-token": credential }, body };
}
function remote(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) };
}

beforeEach(() => {
  process.env.DELTA_V9_SUPABASE_PUBLISHABLE_KEY = publishable;
  process.env.DELTA_V9_SUPABASE_URL = "https://jwfocqaxlckuxoklwyxs.supabase.co";
  delete process.env.DELTA_V9_GAS_URL;
  delete process.env.DELTA_V9_AUTH_BRIDGE_URL;
  delete process.env.DELTA_V9_SUPABASE_SERVICE_KEY;
});
afterEach(() => {
  for (const key of keys) {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  }
  globalThis.fetch = originalFetch;
});

test("rejects GET and writes before database access", async () => {
  globalThis.fetch = () => { throw Error("unexpected fetch"); };
  const response = res();
  await handler(req({}, token, "GET"), response);
  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.Allow, "POST");
});

test("requires an existing Delta OPS session, never an extra V9 password", async () => {
  globalThis.fetch = () => { throw Error("unexpected fetch"); };
  for (const credential of ["", "short", undefined]) {
    const response = res();
    await handler(req({mode:"preview"}, credential), response);
    assert.equal(response.statusCode, 401);
    assert.equal(response.body.error, "V9_SESSION_REQUIRED");
  }
});

test("rejects unsupported actions and unbounded queries without database access", async () => {
  globalThis.fetch = () => { throw Error("unexpected fetch"); };
  for (const body of [
    { mode: "publish" }, { mode: "delete" },
    { mode: "preview", limit: 5000 }, { mode: "preview", limit: -1 },
    { mode: "preview", gate: "not-valid" }, { mode: "preview", after: "../secrets" }
  ]) {
    const response = res();
    await handler(req(body), response);
    assert.equal(response.statusCode, 400);
  }
});

test("forwards existing token only to authorization RPC, without exposing it in response", async () => {
  let called = 0;
  globalThis.fetch = async (url, options) => {
    called++;
    assert.equal(url, "https://jwfocqaxlckuxoklwyxs.supabase.co/rest/v1/rpc/dm_v9_ops_session_read_v1");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.apikey, publishable);
    assert.equal(options.headers.Authorization, `Bearer ${publishable}`);
    assert.deepEqual(JSON.parse(options.body), {
      p_auth_token: token, p_limit: 5, p_after: "", p_gate: "BLOCKED_UNLINKED"
    });
    return remote({ ok: true, mode: "V9_READ_ONLY", rows: [], total: 5295, counts: { BLOCKED_UNLINKED: 23 } });
  };
  const response = res();
  await handler(req({ mode: "preview", gate: "BLOCKED_UNLINKED", limit: 5 }), response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.total, 5295);
  assert.equal(called, 1);
  assert.equal(JSON.stringify(response.body).includes(token), false);
  assert.equal(response.headers["Cache-Control"], "no-store, max-age=0");
});

test("invalid sessions and unauthorized roles are denied by Supabase", async () => {
  globalThis.fetch = async () => remote({ message: "Sesión inválida o vencida." }, 401);
  const rejected = res();
  await handler(req(), rejected);
  assert.equal(rejected.statusCode, 401);
  assert.equal(rejected.body.error, "V9_SESSION_REJECTED");

  globalThis.fetch = async () => remote({ message: "V9_PERMISSION_DENIED" }, 400);
  const denied = res();
  await handler(req(), denied);
  assert.equal(denied.statusCode, 403);
});

test("read failures never return unvalidated operational payloads", async () => {
  globalThis.fetch = async () => remote({ ok: false, mode: "V9_READ_ONLY", rows: [] });
  const response = res();
  await handler(req(), response);
  assert.equal(response.statusCode, 502);
  assert.equal(response.body.error, "V9_BACKEND_CONTRACT_MISMATCH");
});

test("script diagnostics require authorization and cannot be used to publish", async () => {
  let requests = 0;
  globalThis.fetch = async (url) => {
    requests++;
    if (String(url).includes("/rest/v1/rpc/")) {
      return remote({ ok:true, mode:"V9_READ_ONLY", rows:[], total:5295, counts:{} });
    }
    throw Error("No GAS URL configured");
  };
  const response = res();
  await handler(req({ mode: "gas-health" }), response);
  assert.equal(response.statusCode, 503);
  assert.equal(response.body.error, "V9_GAS_NOT_CONFIGURED");
  assert.equal(requests, 1);
});

test("partial Apps Script bridge configuration fails closed", async () => {
  globalThis.fetch = () => { throw Error("must not make network calls"); };
  process.env.DELTA_V9_AUTH_BRIDGE_URL = "https://script.google.com/macros/s/test-BRIDGE_23456789/exec";
  const response = res();
  await handler(req(), response);
  assert.equal(response.statusCode, 503);
  assert.equal(response.body.error, "V9_AUTH_BRIDGE_INCOMPLETE");
});

test("verified Apps Script HMAC session can read V9 without exposing its server key", async () => {
  process.env.DELTA_V9_AUTH_BRIDGE_URL = "https://script.google.com/macros/s/test-BRIDGE_23456789/exec";
  const serverSecret = "sb_secret_" + "q".repeat(40);
  process.env.DELTA_V9_SUPABASE_SERVICE_KEY = serverSecret;
  let called = 0;
  globalThis.fetch = async (url, options) => {
    called++;
    if (called === 1) {
      assert.equal(url, process.env.DELTA_V9_AUTH_BRIDGE_URL);
      assert.equal(options.method, "POST");
      const payload = JSON.parse(new URLSearchParams(options.body).get("payload"));
      assert.deepEqual(payload, { action: "v9_validate_existing_session", authToken: token });
      return remote({ok:true,mode:"V9_SIGNED_SESSION_VALIDATED",user:{rol:"ADMIN"}});
    }
    assert.equal(url, "https://jwfocqaxlckuxoklwyxs.supabase.co/rest/v1/rpc/dm_v9_ops_read_v1");
    assert.equal(options.headers.apikey, serverSecret);
    assert.equal(JSON.stringify(JSON.parse(options.body)).includes(token), false);
    return remote({ok:true,mode:"V9_READ_ONLY",rows:[],total:5295,counts:{}});
  };
  const response=res();
  await handler(req(), response);
  assert.equal(response.statusCode,200);
  assert.equal(called,2);
  assert.equal(JSON.stringify(response.body).includes(serverSecret),false);
  assert.equal(JSON.stringify(response.body).includes(token),false);
});

test("a rejected Apps Script token never reaches privileged Supabase", async () => {
  process.env.DELTA_V9_AUTH_BRIDGE_URL = "https://script.google.com/macros/s/test-BRIDGE_23456789/exec";
  process.env.DELTA_V9_SUPABASE_SERVICE_KEY = "sb_secret_" + "q".repeat(40);
  let called = 0;
  globalThis.fetch = async () => { called++; return remote({ok:false,error:{code:"V9_AUTH_INVALID"}}); };
  const response = res();
  await handler(req(), response);
  assert.equal(response.statusCode,401);
  assert.equal(called,1);
});
