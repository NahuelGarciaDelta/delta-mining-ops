import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { abastecimientoInstantVitePlugin } from "../scripts/abastecimiento-instant-vite-plugin.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modulePath = path.resolve(__dirname, "../src/modules/abastecimiento/AbastecimientoModule.jsx");

test("OPS calcula Envíos sin solicitud con FIFO y excluye solicitudes rechazadas", () => {
  const source = fs.readFileSync(modulePath, "utf8");
  const plugin = abastecimientoInstantVitePlugin();
  const transformed = plugin.transform(source, modulePath.replace(/\\/g, "/"));
  const code = transformed?.code || source;

  assert.match(code, /solicitudesValidas=\(rows\|\|\[\]\)\.filter\(row=>!rejectedSolicitudes\?\.\[buildSolicitudKey\(row\)\]\)/);
  assert.match(code, /allocateRemitosToRequests\(base,remitos\)\.unmatched/);
  assert.doesNotMatch(code, /buildEnviosSinSolicitudRows\s*\(\s*\{/);
  assert.match(code, /fetchRaba03FromSupabase\(\)/);
  assert.match(code, /fetchAbastecimientoSnapshot\(\)/);
  assert.match(code, /RABA03_VIEW_CACHE_KEY/);
  assert.doesNotMatch(code, /action=remitos_cargados/);
});