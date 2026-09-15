import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { abastecimientoInstantVitePlugin } from "../scripts/abastecimiento-instant-vite-plugin.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modulePath = path.resolve(__dirname, "../src/modules/abastecimiento/AbastecimientoModule.jsx");

test("OPS mantiene Envíos sin solicitud por código + proyecto + fecha sobre Apps Script", () => {
  const source = fs.readFileSync(modulePath, "utf8");
  const plugin = abastecimientoInstantVitePlugin();
  const transformed = plugin.transform(source, modulePath.replace(/\\/g, "/"));
  const code = transformed?.code || source;

  assert.match(code, /action=raba03/);
  assert.match(code, /action=remitos_cargados/);
  assert.match(code, /sol\.fechaMs<=fechaMs/);
  assert.match(code, /\(!proyecto\|\|!sol\.proyecto\|\|sol\.proyecto===proyecto\)/);
  assert.doesNotMatch(code, /sol\.descripcion===descripcionNormalizada/);
  assert.doesNotMatch(code, /fetchRaba03FromSupabase/);
  assert.doesNotMatch(code, /fetchAbastecimientoSnapshot/);
  assert.match(code, /RABA03_VIEW_CACHE_KEY/);
});
