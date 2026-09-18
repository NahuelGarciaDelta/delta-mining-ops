import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {intelligentRefreshVitePlugin} from "../scripts/intelligent-refresh-vite-plugin.mjs";

test("el parche de App usa TTL por fuente, refresco manual real y no congela fallos",async()=>{
  const source=await readFile(new URL("../src/App.jsx",import.meta.url),"utf8");
  const plugin=intelligentRefreshVitePlugin();
  const transformed=plugin.transform(source,"/workspace/src/App.jsx")?.code||source;

  assert.match(transformed,/startsWith\("rop02_"\)\)return 45\*1000/);
  assert.match(transformed,/key==="rop05"\|\|String\(key\|\|""\)\.startsWith\("rma15_"\)\)return 2\*60\*1000/);
  assert.match(transformed,/key==="lista_equipos"\|\|key==="insumos"\)return 10\*60\*1000/);
  assert.match(transformed,/force:reason==="manual"/);
  assert.match(transformed,/runWithConcurrency_\(toCheck,3,key=>fetchOneSource/);
  assert.match(transformed,/AUTO_REFRESH_MS=AUTO_REFRESH_TICK_MS/);

  const softFailureBlock=transformed.match(/if\(hasSavedData\)\{[\s\S]*?\}else\{/i)?.[0]||"";
  assert.ok(softFailureBlock,"debe existir el bloque de fallback con cache visible");
  assert.doesNotMatch(softFailureBlock,/lastCheckedBySourceRef\.current\[key\]=Date\.now\(\)/);
  assert.match(softFailureBlock,/se mantiene la copia local/);
});

test("las fuentes tipadas usan Supabase rápido y Sheets sólo como respaldo de frescura",async()=>{
  const source=await readFile(new URL("../src/services/appsScriptApi.js",import.meta.url),"utf8");

  assert.match(source,/if\(key\.startsWith\("rop02_"\)\)return 90\*1000/);
  assert.match(source,/if\(key==="rop05"\|\|key\.startsWith\("rma15_"\)\)return 5\*60\*1000/);
  assert.match(source,/const replica=await fetchTypedSupabaseSource_\(sourceKey\)/);
  assert.match(source,/const staleReplica=replicaAge>sourceReplicaMaxAgeMs_\(sourceKey\)/);
  assert.match(source,/const canRefreshLive=Boolean\(_options\?\.force\|\|_options\?\.since\)/);
  assert.match(source,/fetchAppsScriptActionDirect_\(_url,sourceKey/);
  assert.match(source,/se conserva la réplica/);
});
