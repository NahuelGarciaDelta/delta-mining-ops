import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("ROP02 conserva las cuatro fuentes operativas en las vistas principales", () => {
  const viewSources = read("src/config/viewSources.js");
  for (const source of ["rop02_fs", "rop02_jm", "rop02_filosur", "rop02_zorro"]) {
    assert.match(viewSources, new RegExp(`rop02:[^\\n]*${source}`));
    assert.match(viewSources, new RegExp(`controlErrores:[^\\n]*${source}`));
    assert.match(viewSources, new RegExp(`ctrlEquipo:[^\\n]*${source}`));
    assert.match(viewSources, new RegExp(`atrasoROP02:[^\\n]*${source}`));
  }
});

test("la normalización monolítica segura vuelve a ser la fuente de verdad", () => {
  const vite = read("vite.config.js");
  const app = read("src/App.jsx");
  assert.doesNotMatch(vite, /localFirstNormalizationVitePlugin/);
  assert.match(app, /const allRop02=\[\.\.\.rFS,\.\.\.rJM,\.\.\.rFSur,\.\.\.rZorro\]/);
  assert.match(app, /setRop02ControlAll\(normalizedRop02\)/);
});

test("el arranque no publica una precarga ROP02 potencialmente parcial", () => {
  const main = read("src/main.jsx");
  assert.doesNotMatch(main, /prewarmSavedDataSources/);
  assert.doesNotMatch(main, /Promise\.race\(\[\s*prewarmSavedDataSources/);
});

test("las lecturas Supabase grandes tienen margen suficiente para José María", () => {
  const api = read("src/services/supabaseReadApi.js");
  assert.match(api, /const REQUEST_TIMEOUT_MS=45000;/);
  assert.match(api, /rop02_jm:"SRC\|ROP02_JM\|"/);
  assert.match(api, /rop02_fs:"SRC\|ROP02_FS\|"/);
});
