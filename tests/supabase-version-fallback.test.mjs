import test from "node:test";
import assert from "node:assert/strict";
import {fetchSupabaseVersions,fetchSupabaseVersionsLightweight} from "../src/services/supabaseReadApi.js";
import {historicalVersionsForDataset,historicalSnapshotMatchesManifest} from "../src/data/historicalVersionPolicy.js";
import {planVersionedRefresh} from "../src/data/refreshPlanner.js";

const sourceKeys=["rop02_fs","rop02_jm","rop02_filosur","rop02_zorro",
                  "rop05","rma15_fs","rma15_jm","lista_equipos","insumos"];

function fakeResponse(rows,status=200){
  return {
    ok:status>=200&&status<300,
    status,
    text:async()=>JSON.stringify(rows),
    headers:{get:name=>String(name).toLowerCase()==="content-range"?"0-0/12":null}
  };
}

test("fallback de manifiesto: 500 de RPC no causa descargar tablas completas",async t=>{
  const previous=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async(url,options)=>{
    calls.push(String(url));
    if(String(url).includes("/rpc/delta_source_versions"))
      return fakeResponse({message:"statement timeout"},500);
    const parsed=new URL(String(url));
    assert.equal(parsed.searchParams.get("select"),"synced_at");
    assert.equal(parsed.searchParams.get("limit"),"1");
    assert.equal(options.headers.Prefer,"count=exact");
    return fakeResponse([{synced_at:"2026-10-13T12:34:56.123456+00:00"}]);
  };
  t.after(()=>{globalThis.fetch=previous;});
  const manifest=await fetchSupabaseVersions();
  assert.equal(manifest.ok,true);
  assert.equal(manifest.source,"supabase-lightweight");
  assert.equal(calls.length,10,"1 RPC + 9 probes ligeros");
  assert.equal(Object.keys(manifest.versions).length,9);
  for(const key of sourceKeys){
    assert.equal(manifest.rowCounts[key],12);
    assert.equal(manifest.versions[key],Date.parse("2026-10-13T12:34:56.123Z"));
  }
  assert.deepEqual(planVersionedRefresh(["rop02_jm","rop05"],
    {rop02_jm:{ok:true,data:Array(12),meta:{serverVersion:manifest.versions.rop02_jm}},
     rop05:{ok:true,data:Array(12),meta:{serverVersion:manifest.versions.rop05}}},
    manifest.versions,manifest.rowCounts),[]);
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
