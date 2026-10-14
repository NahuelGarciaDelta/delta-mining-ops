import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createServer } from "vite";
import { makeBackend } from "../tests/helpers/appsScriptHarness.mjs";
if (typeof globalThis.WebSocket !== "function") throw new Error("Browser audit requires Node.js 22 or newer.");
const root = fileURLToPath(new URL("..", import.meta.url));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "delta-audit-browser-"));
const vite = await createServer({
  root,
  logLevel: "silent",
  server: { host: "127.0.0.1", port: 5175, strictPort: true }
});
await vite.listen();
const chromium = spawn(
  process.env.CHROME_BIN || "/usr/bin/chromium",
  [
    "--headless",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-background-networking",
    "--remote-debugging-port=9223",
    `--user-data-dir=${profile}`,
    "about:blank"
  ],
  { stdio: "ignore" }
);
let launchError = null;
chromium.on("error", (error) => {
  launchError = error;
});
const h = makeBackend(),
  calls = [],
  errors = [],
  pending = new Map();
let id = 0,
  ws = null;
async function connectBrowser() {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (launchError) throw launchError;
    try {
      const targets = await (await fetch("http://127.0.0.1:9223/json")).json();
      const target = targets.find((x) => x.type === "page");
      if (target) {
        ws = new globalThis.WebSocket(target.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
          ws.addEventListener("open", resolve, { once: true });
          ws.addEventListener("error", reject, { once: true });
        });
        return;
      }
    } catch (error) {
      if (attempt === 59) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Chromium did not become ready");
}
try {
  await connectBrowser();
} catch (error) {
  chromium.kill();
  await vite.close();
  fs.rmSync(profile, { recursive: true, force: true });
  throw error;
}
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
}
ws.addEventListener("message", async (e) => {
  const x = JSON.parse(e.data);
  if (x.id && pending.has(x.id)) {
    const task = pending.get(x.id);
    pending.delete(x.id);
    x.error ? task.reject(new Error(x.error.message)) : task.resolve(x.result);
  }
  if (x.method === "Runtime.exceptionThrown")
    errors.push(x.params.exceptionDetails.text + ": " + (x.params.exceptionDetails.exception?.description || ""));
  if (x.method === "Fetch.requestPaused") {
    const { requestId, request } = x.params,
      u = new URL(request.url);
    if (u.hostname === "127.0.0.1" && u.port === "5175" && !u.pathname.startsWith("/api/")) {
      await send("Fetch.continueRequest", { requestId });
      return;
    }
    let result = { ok: true, data: [], versions: {}, rowCounts: {} };
    if (u.pathname === "/api/apps-script") {
      const payload = request.postData
        ? JSON.parse(new URLSearchParams(request.postData).get("payload") || "{}")
        : null;
      const action = payload?.action || u.searchParams.get("action");
      calls.push({ action, method: request.method });
      if (["authenticate_user", "update_user_profile"].includes(action))
        result = JSON.parse(h.call("doPost", { parameter: { payload: JSON.stringify(payload) } }).text);
      else if (action === "get_user_appearance") result = { ok: true, appearance: {} };
      else if (action === "read")
        result = {
          ok: true,
          sources: {
            lista_equipos: { ok: true, data: [] },
            rop02_jm: { ok: true, data: [] },
            rop02_fs: { ok: true, data: [] }
          }
        };
    }
    await send("Fetch.fulfillRequest", {
      requestId,
      responseCode: 200,
      responseHeaders: [
        { name: "Content-Type", value: "application/json" },
        { name: "Access-Control-Allow-Origin", value: "*" }
      ],
      body: Buffer.from(JSON.stringify(result)).toString("base64")
    });
  }
});
async function evaluate(expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
async function waitFor(expression) {
  for (let i = 0; i < 60; i++) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("Browser condition timed out: " + expression);
}
async function type(selector, value) {
  await evaluate(
    `(()=>{const input=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`
  );
}
try {
  await send("Runtime.enable");
  await send("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
  await send("Page.navigate", { url: "http://127.0.0.1:5175/" });
  await waitFor('document.querySelector("input[type=email]")');
  await evaluate("sessionStorage.clear();localStorage.clear()");
  await send("Page.reload", { ignoreCache: true });
  await new Promise((r) => setTimeout(r, 1000));
  await waitFor('document.querySelector("input[type=email]")');
  await type("input[type=email]", "user@delta.test");
  await type("input[type=password]", "DELTA.MINING.APP");
  await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="INGRESAR").click()');
  await waitFor('document.body.innerText.includes("Crear contraseña personal")');
  assert.equal(await evaluate('sessionStorage.getItem("dm_must_change_password")'), "1");
  const values = ["DELTA.MINING.APP", "new-safe-password", "new-safe-password"];
  // The password fields live in distinct label elements, so address each by its label text.
  for (const [label, value] of [
    ["CONTRASEÑA ACTUAL", values[0]],
    ["NUEVA CONTRASEÑA", values[1]],
    ["REPETIR NUEVA CONTRASEÑA", values[2]]
  ])
    await evaluate(
      `(()=>{const input=[...document.querySelectorAll('label')].find(l=>l.textContent.trim()===${JSON.stringify(label)}).querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`
    );
  await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent.includes("Guardar cambios")).click()');
  await waitFor(
    'sessionStorage.getItem("dm_must_change_password")==="0" && !document.body.innerText.includes("Crear contraseña personal")'
  );
  const stored = await evaluate('JSON.parse(sessionStorage.getItem("dm_authenticated_user"))');
  assert.ok(stored.authToken);
  assert.equal(stored.area, "TALLER CENTRAL");
  assert.equal(h.call("handleAuthenticateUser_", "user@delta.test", "DELTA.MINING.APP").ok, false);
  assert.equal(h.call("handleAuthenticateUser_", "user@delta.test", "new-safe-password").ok, true);
  await send("Page.reload", { ignoreCache: true });
  await new Promise((r) => setTimeout(r, 1000));
  await waitFor(
    'document.body.innerText.includes("DELTA") && !document.body.innerText.includes("Crear contraseña personal") && !document.querySelector("input[type=email]")'
  );
  assert.equal(calls.filter((c) => c.action === "update_user_profile").length, 1);
  assert.equal(h.usuarios.writes.filter((w) => w.c === 6).length, 1);
  const report = {
    firstLogin: "passed",
    forcedPasswordChange: "passed",
    sessionReload: "passed",
    newPasswordAccepted: true,
    oldPasswordRejected: true,
    passwordWrites: 1,
    unhandledExceptions: errors,
    externalRequests: "all intercepted; no production access"
  };
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) process.exitCode = 1;
} finally {
  // Close the browser before removing interception. No test request may reach production.
  ws.close();
  chromium.kill();
  await new Promise((resolve) => {
    if (chromium.exitCode !== null) resolve();
    else chromium.once("exit", resolve);
  });
  await vite.close();
  fs.rmSync(profile, { recursive: true, force: true });
}
