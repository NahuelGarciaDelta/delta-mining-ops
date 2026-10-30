import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";

const versions = [
  ["integration/apps-script/v9/DM_UNIFIED_PHASE4B_ROP05_GENERADOR_NO_DESTRUCTIVO_V1.gs", 10000],
  ["integration/apps-script/v9/DM_UNIFIED_PHASE4D_ACK_VERSION_SANDBOX_V1.gs", 10000],
  ["integration/apps-script/v9/DM_V9_AUTH_BRIDGE_READONLY.gs", 500]
];

test("V9 GAS modules parse as JavaScript", () => {
  for (const [path, minSize] of versions) {
    const content = readFileSync(new URL("../" + path, import.meta.url), "utf8");
    assert.ok(content.length > minSize, path);
    assert.doesNotThrow(() => new Script(content, {filename:path}), path);
  }
});

test("V9 generator remains source-controlled without hardcoded operational book IDs", () => {
  const code = readFileSync(new URL("../" + versions[0][0], import.meta.url), "utf8");
  assert.doesNotMatch(code, /SpreadsheetApp\.openById\(['"][A-Za-z0-9_-]{30,}['"]\)/);
  assert.match(code, /dmV9U4eProductionIds_/);
  assert.match(code, /DM_V9_ROP05_BOOK_ID/);
  assert.doesNotMatch(code, /https:\/\/jwfocqaxlckuxoklwyxs\.supabase\.co/);
});

test("V9 signed session bridge is read-only and never replaces doPost", () => {
  const code = readFileSync(new URL("../" + versions[2][0], import.meta.url), "utf8");
  assert.match(code, /stockExcelVerifyAuthToken_/);
  assert.match(code, /getAuthMirrorUser_/);
  assert.doesNotMatch(code, /^function doPost\s*\(/m);
  assert.doesNotMatch(code, /\.setValue\(|\.deleteRow\(|setProperty\(|UrlFetchApp\.fetch\(/);
  assert.doesNotMatch(code, /APP_AUTH_TOKEN_SECRET['"]\s*,/);
});
