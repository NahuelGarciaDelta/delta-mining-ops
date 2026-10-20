import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("ROP02 incluye El Fierro en todas las vistas principales", () => {
  const viewSources = read("src/config/viewSources.js");
  const catalog=read("src/config/rop02Sources.js");
  assert.match(viewSources,/\.\.\.ROP02_SOURCE_KEYS/);
  assert.match(catalog,/key:"rop02_fierro",project:"EL FIERRO"/);
  for (const source of ["rop02_fs", "rop02_jm", "rop02_filosur", "rop02_zorro", "rop02_fierro"]) {
    assert.match(catalog, new RegExp(`key:"${source}"`));
    assert.match(viewSources,/controlErrores:\[\.\.\.ROP02_SOURCE_KEYS\]/);
    assert.match(viewSources,/ctrlEquipo:\[\.\.\.ROP02_SOURCE_KEYS\]/);
    assert.match(viewSources,/atrasoROP02:\[\.\.\.ROP02_SOURCE_KEYS\]/);
  }
});

test("la normalización monolítica segura vuelve a ser la fuente de verdad", () => {
  const vite = read("vite.config.js");
  const app = read("src/App.jsx");
  assert.doesNotMatch(vite, /localFirstNormalizationVitePlugin/);
  assert.match(app,/const allRop02=rop02Batches\.flat\(\)/);
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
  assert.match(api,/ROP02_PREFIX/);
  assert.match(api,/ROP02_SOURCE_KEYS/);
});
