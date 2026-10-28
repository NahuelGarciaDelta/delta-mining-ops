import test from "node:test";
import assert from "node:assert/strict";
import {fetchSupabaseVersions,fetchSupabaseVersionsLightweight} from "../src/services/supabaseReadApi.js";
import {historicalVersionsForDataset,historicalSnapshotMatchesManifest} from "../src/data/historicalVersionPolicy.js";
import {planVersionedRefresh} from "../src/data/refreshPlanner.js";

const sourceKeys=["rop02_fs","rop02_jm","rop02_filosur","rop02_zorro","rop02_fierro",
                  "rop05","rma15_fs","rma15_jm","lista_equipos","insumos"];

function fakeResponse(rows,status=200){
  return {
    ok:status>=200&&status<300,
    status,
    text:async()=>JSON.stringify(rows),
    headers:{get:name=>String(name).toLowerCase()==="content-range"?"0-0/12":null}
  };
}

test("No se invoca delta_source_versions: evitar COUNT y 42501 en anon",async t=>{
  const previous=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async url=>{calls.push(String(url));throw new Error("Acceso inesperado a red");};
  t.after(()=>{globalThis.fetch=previous;});
  const manifest=await fetchSupabaseVersions();
  assert.equal(manifest,null);
  assert.equal(calls.length,0,"la revisión de versiones no consulta PostgreSQL");
});

test("probe parcial obliga a revalidar origen incierto, sin marcarlo como fresco",async t=>{
  const previous=globalThis.fetch;
  globalThis.fetch=async url=>{
    if(String(url).includes("source_dataset=eq.rop02_jm"))
      return fakeResponse({message:"failed"},503);
    return fakeResponse([{synced_at:"2026-10-13T12:34:56.123Z"}]);
  };
  t.after(()=>{globalThis.fetch=previous;});
  const manifest=await fetchSupabaseVersionsLightweight();
  assert.equal(manifest.ok,true);
  assert.equal(manifest.versions.rop02_jm,undefined);
  assert.equal(historicalVersionsForDataset("rop02",manifest),null);
  assert.equal(historicalSnapshotMatchesManifest("rop02",{
    ok:true,data:[{id:1}],versions:{rop02_jm:123}
  },manifest),false);
});
