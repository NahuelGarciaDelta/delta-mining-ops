// Manual-only HTTP integration with COPIES. No request is made when importing this file.
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { sha256 } from "./apps-script-audit.mjs";

export function validateCopyEndpoint(endpoint, productionEndpoint) {
  const url = new URL(endpoint),
    production = new URL(productionEndpoint);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "script.google.com" ||
    !/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname) ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  )
    throw new Error("Usar únicamente una URL /exec de Google Apps Script, sin parámetros ni credenciales.");
  if (url.origin === production.origin && url.pathname === production.pathname)
    throw new Error("Se bloqueó la implementación de producción configurada.");
  return url.toString();
}
export async function runCopyWebIntegration({
  endpoint,
  expectedScriptId,
  testKey,
  parentSourceHash,
  productionEndpoint,
  request = fetch,
  pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  timeoutMs = 1
}) {
  const url = validateCopyEndpoint(endpoint, productionEndpoint);
  if (!testKey || testKey.length < 32 || testKey.startsWith("GENERAR_"))
    throw new Error("Configurar DELTA_COPY_TEST_KEY de forma segura; no enviarla al chat.");
  if (!expectedScriptId) throw new Error("Se requiere el ID del NUEVO proyecto de prueba.");
  const cases = [],
    report = {
      ok: false,
      kind: request === globalThis.fetch ? "HTTP integration against copies" : "Mock of the copy-integration protocol",
      executed: false,
      realServicesVerified: false,
      cases,
      productionWrites: false,
      clientAbortObserved: false
    };
  let baseline, actor, lastKnownValue, fixture;
  const newId = (prefix) => prefix + "_" + crypto.randomUUID();
  async function post(payload, timeout = 60000) {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await request(url, {
        method: "POST",
        redirect: "follow",
        signal: controller.signal,
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: new URLSearchParams({ payload: JSON.stringify({ ...payload, testKey }) })
      });
      if (!response.ok) throw new Error("HTTP " + response.status + " en la copia");
      const result = await response.json();
      if (!result || typeof result.ok !== "boolean") throw new Error("La copia no devolvió un contrato válido.");
      return result;
    } finally {
      clearTimeout(timer);
    }
  }
  async function status() {
    const result = await post({ action: "copy_test_status" });
    if (
      !result.ok ||
      result.copyOnly !== true ||
      result.scriptId !== expectedScriptId ||
      result.sourceSha256 !== parentSourceHash
    )
      throw new Error("La implementación no demuestra la identidad del sandbox esperado. No se enviaron mutaciones.");
    return result.report;
  }
  function check(name, condition) {
    cases.push({ name, passed: !!condition });
    if (!condition) throw new Error("Falló: " + name);
  }
  function meter(value, expectedValue, id) {
    return {
      action: "update_lista_horometros",
      operationId: id,
      actor,
      updates: [{ identity: { codigoDrusila: "AF479QX", codigoNuevo: "CTA-0530" }, value, expectedValue }]
    };
  }
  try {
    const initial = await status();
    fixture = initial.fixtureEmail;
    if (!fixture?.endsWith("@example.invalid") || !initial.baseline || !initial.integrity?.otherCellsUnchanged)
      throw new Error("Preparar el usuario ficticio y una línea base antes de ejecutar.");
    baseline = initial.current;
    lastKnownValue = Number(baseline.meterValue);
    if (!Number.isFinite(lastKnownValue)) throw new Error("La lectura de la copia no es numérica.");
    report.executed = true;
    const first = await post({ action: "authenticate_user", email: fixture, password: "DELTA.MINING.APP" });
    check("Primer ingreso", first.ok && first.mustChangePassword === true);
    const newPassword = "COPY_" + crypto.randomUUID(),
      profile = {
        action: "update_user_profile",
        email: fixture,
        currentPassword: "DELTA.MINING.APP",
        newPassword,
        nombre: "Prueba HTTP V9",
        area: "TALLER CENTRAL",
        operationId: newId("http_profile")
      };
    let saved;
    try {
      saved = await post(profile);
    } catch {
      saved = await post(profile);
    }
    check("Cambio de contraseña y sesión", saved.ok && saved.mustChangePassword === false && !!saved.authToken);
    const personal = await post({ action: "authenticate_user", email: fixture, password: newPassword });
    check("Login posterior", personal.ok && personal.mustChangePassword === false);
    check(
      "Contraseña anterior rechazada",
      !(await post({ action: "authenticate_user", email: fixture, password: "DELTA.MINING.APP" })).ok
    );
    check("Reintento de perfil", (await post(profile)).deduplicated === true);
    actor = { email: fixture, token: personal.authToken };
    const operation = meter(lastKnownValue + 1, lastKnownValue, newId("http_meter"));
    const written = await post(operation);
    check("Horómetro CTA-0530 confirmado", written.status === "complete");
    lastKnownValue = operation.updates[0].value;
    check("Reintento idempotente", (await post(operation)).status === "complete");
    const partial = meter(lastKnownValue + 1, lastKnownValue, newId("http_partial"));
    partial.updates.push({ identity: { codigoNuevo: "DELTA-NO-SUCH-EQUIPMENT" }, value: 1, expectedValue: 0 });
    const partialResult = await post(partial);
    check(
      "Guardado parcial identificado",
      partialResult.status === "partial" && partialResult.updatedRows === 1 && partialResult.failedRows === 1
    );
    lastKnownValue = partial.updates[0].value;
    const lost = meter(lastKnownValue + 1, lastKnownValue, newId("http_abort"));
    try {
      const result = await post(lost, timeoutMs);
      report.timeoutOutcome = "Response arrived before client timeout";
      if (result.status === "complete") lastKnownValue = lost.updates[0].value;
    } catch (error) {
      if (error.name !== "AbortError") throw error;
      report.clientAbortObserved = true;
      report.timeoutOutcome = "Actual client abort; server persistence not assumed";
      await pause(60000);
    }
    const verification = await post({ ...lost, action: "verify_lista_horometros" });
    report.observedAfterAbort = verification.status;
    if (verification.status === "complete") lastKnownValue = lost.updates[0].value;
    else {
      check("Tras timeout: resultado pendiente sin falso fallo", verification.status === "pending");
      const retry = await post(lost);
      check("Mismo ID recupera el resultado", retry.status === "complete");
      lastKnownValue = lost.updates[0].value;
    }
    const after = await status();
    check("Sólo cambia la lectura", after.integrity?.otherCellsUnchanged && after.integrity?.meterMetadataUnchanged);
    check(
      "Sin duplicación de filas o columnas",
      after.integrity?.rowCountUnchanged && after.integrity?.columnCountUnchanged
    );
    check("La lectura realmente persistió", Number(after.current.meterValue) === lastKnownValue);
    report.integrity = after.integrity;
    report.ok = true;
    report.realServicesVerified = request === globalThis.fetch;
    report.pendingChecks = report.clientAbortObserved
      ? []
      : ["No client abort occurred; repeat the timeout check before claiming it passed."];
  } catch (error) {
    report.error = error.message;
  } finally {
    if (actor && baseline) {
      try {
        const current = await status();
        const value = Number(current.current.meterValue);
        if (value !== Number(baseline.meterValue)) {
          if (value !== lastKnownValue)
            throw new Error("No se restauró: cambió una lectura fuera de los valores confirmados de esta prueba.");
          const restored = await post(meter(Number(baseline.meterValue), value, newId("http_restore")));
          if (restored.status !== "complete") throw new Error("Restauración de celda no confirmada.");
        }
        const restoredStatus = await status();
        report.meterRestored = Number(restoredStatus.current.meterValue) === Number(baseline.meterValue);
        if (!report.meterRestored) report.ok = false;
      } catch (error) {
        report.ok = false;
        report.meterRestored = false;
        report.recovery = error.message + " Verificar únicamente la celda de lectura en la copia.";
      }
    }
  }
  return report;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const production = fs
    .readFileSync("api/apps-script.js", "utf8")
    .match(/https:\/\/script\.google\.com\/macros\/s\/[^"\s]+\/exec/)[0];
  const report = await runCopyWebIntegration({
    endpoint: process.argv[2],
    expectedScriptId: process.argv[3],
    testKey: process.env.DELTA_COPY_TEST_KEY,
    parentSourceHash: sha256(fs.readFileSync("AppsScript_Delta_Mining_OPS_FINAL.txt")),
    productionEndpoint: production,
    timeoutMs: Number(process.env.DELTA_COPY_ABORT_MS || 1)
  });
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}
