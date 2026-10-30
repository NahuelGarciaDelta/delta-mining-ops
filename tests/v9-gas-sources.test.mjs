import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";

const sources = [
  "integration/apps-script/v9/DM_UNIFIED_PHASE4B_ROP05_GENERADOR_NO_DESTRUCTIVO_V1.gs",
  "integration/apps-script/v9/DM_UNIFIED_PHASE4D_ACK_VERSION_SANDBOX_V1.gs"
];

test("versioned GAS V9 modules parse as JavaScript", () => {
  for (const path of sources) {
    const text = readFileSync(new URL("../" + path, import.meta.url), "utf8");
    assert.ok(text.length > 10000);
    assert.doesNotThrow(() => new Script(text, {filename:path}));
  }
});

test("public repository cannot contain hardcoded operational spreadsheet IDs or webhook credentials", () => {
  const code = readFileSync(new URL("../" + sources[0], import.meta.url), "utf8");
  assert.doesNotMatch(code, /SpreadsheetApp\.openById\(['"][A-Za-z0-9_-]{30,}['"]\)/);
  assert.match(code, /dmV9U4eProductionIds_/);
  assert.match(code, /DM_V9_PROD_BOOK/);
  assert.doesNotMatch(code, /https:\/\/jwfocqaxlckuxoklwyxs\.supabase\.co/);
});
