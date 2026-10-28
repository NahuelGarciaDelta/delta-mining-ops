import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const vite = fs.readFileSync(new URL("../vite.config.js", import.meta.url), "utf8");
const readApi = fs.readFileSync(new URL("../src/services/supabaseReadApi.js", import.meta.url), "utf8");

test("las lecturas públicas no atraviesan el proxy Vercel de 25 segundos", () => {
  assert.doesNotMatch(vite, /supabaseSameOriginProxyVitePlugin/);
  assert.match(readApi, /fetch\(`\$\{SUPABASE_URL\}\$\{path\}`/);
  assert.match(readApi, /headers:authHeaders/);
});
