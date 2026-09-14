import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const plugin=fs.readFileSync(new URL("../scripts/rop02-rop05-positive-hours-vite-plugin.mjs",import.meta.url),"utf8");
const vite=fs.readFileSync(new URL("../vite.config.js",import.meta.url),"utf8");

test("ROP02 vs ROP05 ignora filas con horas 0 en ambos lados",()=>{
  assert.match(plugin,/Number\(r\.horas\)>0/);
  assert.match(plugin,/const AFTER_ROP02/);
  assert.match(plugin,/const AFTER_ROP05/);
  assert.match(vite,/rop02Rop05PositiveHoursVitePlugin\(\)/);
});
