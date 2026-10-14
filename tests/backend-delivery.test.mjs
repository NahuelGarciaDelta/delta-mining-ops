import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { Buffer } from "node:buffer";
import { backend, makeBackend } from "./helpers/appsScriptHarness.mjs";
import { buildBackendAudit, inspectBackend, sha256 } from "../scripts/apps-script-audit.mjs";
import { prepareCopiesBackend } from "../scripts/prepare-apps-script-copies.mjs";
import { runCopyWebIntegration, validateCopyEndpoint } from "../scripts/probe-apps-script-copies.mjs";

const original = fs.readFileSync(new URL("../audit/apps-script-original-v8.txt", import.meta.url));
const final = fs.readFileSync(new URL("../AppsScript_Delta_Mining_OPS_FINAL.txt", import.meta.url));
const copyHelper = fs.readFileSync(new URL("../integration/apps-script/IntegrationCopies.gs", import.meta.url), "utf8");
const inspection = inspectBackend(final);
const copies = Object.fromEntries(
  inspection.sheetIds.map((id, index) => [id, `COPY_FILE_${String(index).padStart(20, "0")}`])
);

test("complete delivered backend preserves all 231 original functions and resolves identifiers and callbacks", () => {
  const report = buildBackendAudit(original, final);
  assert.equal(report.original.functionCount, 231);
  assert.equal(report.final.functionCount, 248);
  assert.equal(report.modified.length, 8);
  assert.equal(report.added.length, 17);
  assert.equal(report.unchanged.length, 223);
  assert.deepEqual(report.removed, []);
  assert.deepEqual(report.checks.duplicateFunctions, []);
  assert.deepEqual(report.checks.undefinedReferences, []);
  assert.deepEqual(report.checks.otherStaticErrors, []);
  assert.ok(report.checks.triggerCallbacks.every((trigger) => trigger.resolved));
  assert.equal(report.final.sha256, sha256(Buffer.from(backend)));
  assert.equal(final.toString("utf8"), backend);
});
test("static audit detects a missing authentication helper and duplicate definitions", () => {
  const node = inspection.ast.body.find(
    (node) => node.type === "FunctionDeclaration" && node.id.name === "authCredential_"
  );
  const broken = inspection.source.slice(0, node.range[0]) + inspection.source.slice(node.range[1]);
  assert.ok(
    buildBackendAudit(original, Buffer.from(broken)).checks.undefinedReferences.some((error) =>
      error.message.includes("authCredential_")
    )
  );
  const duplicate = Buffer.from(inspection.source + "\nfunction authCredential_(){}\n");
  assert.ok(buildBackendAudit(original, duplicate).checks.duplicateFunctions.includes("authCredential_"));
});
test("copy preparation rejects incomplete maps, placeholders, repeated copies and production IDs", () => {
  assert.throws(() => prepareCopiesBackend(final, {}), /CADA ID/);
  const key = inspection.sheetIds[0];
  assert.throws(() => prepareCopiesBackend(final, { ...copies, [key]: key }), /producción/);
  assert.throws(() => prepareCopiesBackend(final, { ...copies, [key]: "REEMPLAZAR_CON_ID_DE_COPIA_1" }), /inválido/);
  assert.throws(
    () => prepareCopiesBackend(final, Object.fromEntries(inspection.sheetIds.map((id) => [id, copies[key]]))),
    /separación/
  );
});
test("copy artifact alters only destinations, retains all canonical function bodies, and requires separate access controls", () => {
  const result = prepareCopiesBackend(final, copies),
    copy = inspectBackend(Buffer.from(result.source));
  assert.equal(result.manifest.parentSourceSha256, sha256(final));
  assert.equal(result.manifest.sha256, sha256(result.source));
  for (const fn of inspection.functions)
    assert.equal(copy.functions.find((next) => next.name === fn.name).sha256, fn.sha256);
  assert.ok(copy.sheetIds.every((id) => Object.values(copies).includes(id)));
  assert.deepEqual(copy.duplicates, []);
  const combined = inspectBackend(Buffer.from(result.source + "\n" + copyHelper));
  assert.deepEqual(
    combined.lint.filter((x) => x.rule === "no-undef"),
    []
  );
  assert.deepEqual(combined.duplicates, []);
  assert.match(result.source, /DELTA_TEST_ACCESS_KEY/);
  assert.match(result.source, /DELTA_TEST_SCRIPT_ID/);
  assert.match(result.source, /COPY_ACTION_BLOCKED/);
  assert.match(result.source, /COPY_USER_BLOCKED/);
});
function configureHelper(h, map) {
  vm.runInContext(copyHelper, h.context);
  h.context.ScriptApp = { getScriptId: () => "copy-script-id", getProjectTriggers: () => [] };
  h.properties.set("DELTA_TEST_ONLY", "1");
  h.properties.set("DELTA_TEST_ACK", "COPIES_ONLY_NO_PRODUCTION");
  h.properties.set("DELTA_TEST_SCRIPT_ID", "copy-script-id");
  h.properties.set("DELTA_TEST_COPY_CONFIG", JSON.stringify(map));
}
const copyConfig = {
  usuarios: { id: "COPY_USERS_00000000000000000001", sheet: "Usuarios autorizados", headerRow: 1 },
  lista_equipos: { id: "COPY_EQUIP_00000000000000000001", sheet: "lista equipos", headerRow: 5 }
};
test("editor integration blocks a production ID before opening any spreadsheet", () => {
  const h = makeBackend();
  let opened = 0;
  h.context.SpreadsheetApp.openById = () => {
    opened++;
    throw new Error("Must not open");
  };
  configureHelper(h, { ...copyConfig, usuarios: { ...copyConfig.usuarios, id: inspection.sheetIds[0] } });
  assert.throws(() => h.context.deltaCopyConfigure_(), /producción/);
  assert.equal(opened, 0);
  assert.equal(h.equipment.writes.length, 0);
});
test("editor integration rejects an existing authentication secret in an uninitialized test project", () => {
  const h = makeBackend();
  let opened = 0;
  h.context.SpreadsheetApp.openById = () => {
    opened++;
    throw new Error("Must not open");
  };
  configureHelper(h, copyConfig);
  assert.throws(() => h.context.deltaCopyConfigure_(), /proyecto nuevo/);
  assert.equal(opened, 0);
});
test("editor integration accepts named copies and isolates unrelated stores without touching data", () => {
  const h = makeBackend();
  h.properties.delete("APP_AUTH_TOKEN_SECRET");
  let opened = 0;
  h.context.SpreadsheetApp.openById = (id) => {
    opened++;
    return {
      getName: () => "DELTA_TEST_COPY",
      getSheetByName: () => (id === copyConfig.usuarios.id ? h.usuarios : h.equipment)
    };
  };
  configureHelper(h, copyConfig);
  h.context.deltaCopyConfigure_();
  assert.equal(opened, 2);
  assert.equal(h.context.SHEETS_CONFIG.usuarios.id, copyConfig.usuarios.id);
  assert.equal(h.context.MOVIMIENTOS_EQUIPOS_DB_ID_, "DISABLED_IN_COPY_EDITOR_TEST");
  assert.equal(h.equipment.writes.length, 0);
  assert.equal(h.usuarios.writes.length, 0);
});
test("HTTP integration refuses the production URL and mismatched sandbox identity before any mutation", async () => {
  const production = "https://script.google.com/macros/s/PRODUCTION/exec",
    copy = "https://script.google.com/macros/s/COPY/exec";
  assert.throws(() => validateCopyEndpoint(production, production), /producción/);
  const calls = [];
  const report = await runCopyWebIntegration({
    endpoint: copy,
    productionEndpoint: production,
    expectedScriptId: "new-copy-id",
    parentSourceHash: sha256(final),
    testKey: "non-secret-test-fixture-key-00000000000",
    request: async (_url, options) => {
      calls.push(JSON.parse(options.body.get("payload")).action);
      return new Response(JSON.stringify({ ok: true, copyOnly: true, scriptId: "WRONG", sourceSha256: sha256(final) }));
    }
  });
  assert.equal(report.executed, false);
  assert.equal(report.ok, false);
  assert.deepEqual(calls, ["copy_test_status"]);
  assert.equal(report.realServicesVerified, false);
});
test("manual HTTP probe protocol handles a lost response, partial writes and restoration using a mock, not real Sheets", async () => {
  const h = makeBackend({
    users: [["delta-v9-fixture@example.invalid", "USUARIO", "TODOS", "SI", "Prueba HTTP V9", "", "TALLER CENTRAL"]]
  });
  const baseline = structuredClone(h.equipment.values),
    metadata = structuredClone(h.equipment.metadata),
    initial = h.equipment.values[1][7];
  let dropped = false;
  const request = async (_url, options) => {
    const payload = JSON.parse(options.body.get("payload"));
    if (payload.action === "copy_test_status")
      return new Response(
        JSON.stringify({
          ok: true,
          copyOnly: true,
          scriptId: "new-copy-id",
          sourceSha256: sha256(final),
          report: {
            fixtureEmail: h.usuarios.values[1][0],
            baseline: { meterValue: initial },
            current: { meterValue: h.equipment.values[1][7] },
            integrity: {
              otherCellsUnchanged: h.equipment.values[1].every(
                (value, index) => index === 7 || value === baseline[1][index]
              ),
              meterMetadataUnchanged: JSON.stringify(h.equipment.metadata) === JSON.stringify(metadata),
              rowCountUnchanged: h.equipment.values.length === baseline.length,
              columnCountUnchanged: h.equipment.values[0].length === baseline[0].length
            }
          }
        })
      );
    const result = h.call("doPost", { parameter: { payload: JSON.stringify(payload) } });
    if (!dropped && payload.operationId?.startsWith("http_abort_")) {
      dropped = true;
      throw Object.assign(new Error("Injected client abort after committed mock write"), { name: "AbortError" });
    }
    return new Response(result.text, { headers: { "Content-Type": "application/json" } });
  };
  const report = await runCopyWebIntegration({
    endpoint: "https://script.google.com/macros/s/COPY/exec",
    productionEndpoint: "https://script.google.com/macros/s/PRODUCTION/exec",
    expectedScriptId: "new-copy-id",
    parentSourceHash: sha256(final),
    testKey: "non-secret-test-fixture-key-00000000000",
    request,
    pause: async () => {}
  });
  assert.equal(report.ok, true);
  assert.equal(report.realServicesVerified, false);
  assert.equal(report.clientAbortObserved, true);
  assert.equal(report.observedAfterAbort, "complete");
  assert.equal(report.meterRestored, true);
  assert.deepEqual(h.equipment.values, baseline);
  assert.deepEqual(h.equipment.metadata, metadata);
  assert.equal(h.equipment.writes.length, 4);
});

test("copy frontend middleware forwards only approved mutations and labels operational reads as mocks", async () => {
  const { createCopyFrontendMiddleware } = await import("../scripts/serve-copy-frontend.mjs");
  const { Readable } = await import("node:stream");
  const calls = [];
  const row = { "Código de Drusila": "AF479QX", "Codigo nuevo": "CTA-0530", HORAS: 99879 };
  const middleware = createCopyFrontendMiddleware({
    fixtureTarget: 99880,
    postCopy: async (payload) => {
      calls.push(payload);
      return payload.action === "copy_read_lista"
        ? { ok: true, data: [row], identity: { codigoDrusila: "AF479QX", codigoNuevo: "CTA-0530" }, rowNumber: 6 }
        : { ok: true, user: { email: "fixture@example.invalid" } };
    }
  });
  async function run(url, method = "GET", payload) {
    const req = Readable.from(payload ? [new URLSearchParams({ payload: JSON.stringify(payload) }).toString()] : []);
    req.url = url;
    req.method = method;
    const headers = {},
      result = {};
    const res = {
      setHeader: (key, value) => {
        headers[key] = value;
      },
      end: (text) => {
        result.body = JSON.parse(text);
      }
    };
    await middleware(req, res, () => {
      result.next = true;
    });
    return { ...result, headers };
  }
  const lista = await run("/api/supabase-read?target=" + encodeURIComponent("/rest/v1/lista_equipos?select=*"));
  assert.deepEqual(lista.body[0].raw_data, row);
  assert.match(lista.headers["Content-Security-Policy"], /connect-src 'self'/);
  const rop = await run("/api/supabase-read?target=" + encodeURIComponent("/rest/v1/rop02_frontend?select=*"));
  assert.equal(rop.body[0].horometro_final, 99880);
  assert.match(rop.headers["X-Delta-Copy-Integration"], /simulated/);
  const blocked = await run("/api/apps-script", "POST", { action: "add_lista_equipo", row: { HORAS: 0 } });
  assert.equal(blocked.body.error.code, "COPY_ACTION_BLOCKED");
  assert.equal(calls.length, 1);
  await run("/api/apps-script", "POST", {
    action: "update_lista_horometros",
    operationId: "fixture-operation",
    updates: []
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].action, "update_lista_horometros");
  assert.equal(calls[1].testKey, undefined);
});
test("copy frontend startup rejects the configured production endpoint before contacting it", async () => {
  const { startCopyFrontend } = await import("../scripts/serve-copy-frontend.mjs");
  const production = fs
    .readFileSync(new URL("../api/apps-script.js", import.meta.url), "utf8")
    .match(/https:\/\/script\.google\.com\/macros\/s\/[^"\s]+\/exec/)[0];
  let requests = 0;
  await assert.rejects(
    startCopyFrontend({
      endpoint: production,
      expectedScriptId: "copy-id",
      testKey: "non-secret-test-fixture-key-00000000000",
      request: async () => {
        requests++;
      }
    }),
    /producción/
  );
  assert.equal(requests, 0);
});
