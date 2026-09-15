import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const moduleSource=fs.readFileSync(new URL("../src/modules/abastecimiento/AbastecimientoModule.jsx",import.meta.url),"utf8");
const service=fs.readFileSync(new URL("../src/services/abastecimientoSupabase.js",import.meta.url),"utf8");
const client=fs.readFileSync(new URL("../src/services/supabaseClient.js",import.meta.url),"utf8");
const pkg=JSON.parse(fs.readFileSync(new URL("../package.json",import.meta.url),"utf8"));

test("Abastecimiento usa el cliente oficial de Supabase",()=>{
  assert.ok(pkg.dependencies?.["@supabase/supabase-js"]);
  assert.match(client,/createClient/);
  assert.match(service,/requireSupabase\(\)\.rpc\("abastecimiento_snapshot"/);
  assert.doesNotMatch(service,/fetchRaba03FromSupabase|rest\/v1\/abastecimiento_raba03/);
});

test("RABA03 vuelve a usar el snapshot compartido igual que la app Supabase",()=>{
  const load=moduleSource.split("const loadRaba03=useCallback")[1]?.split("// Carga inicial stale-while-revalidate")[0]||"";
  assert.match(load,/getAbastecimientoSnapshot\(\)/);
  assert.match(load,/json\.raba03/);
  assert.doesNotMatch(load,/getAbastecimientoRaba03/);
});

test("snapshot se deduplica entre RABA03 remitos y estados",()=>{
  assert.match(service,/if\(snapshotPromise&&!force\)return snapshotPromise/);
  assert.match(service,/SNAPSHOT_TTL_MS=5000/);
});
