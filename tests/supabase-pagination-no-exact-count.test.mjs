import assert from "node:assert/strict";
import test from "node:test";
import {fetchSupabaseDatasetQuery} from "../src/services/supabaseReadApi.js";

test("la paginación histórica detecta la próxima página sin COUNT exacto", async t => {
  const originalFetch=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async (url,options={})=>{
    calls.push({url:String(url),options});
    return new Response(JSON.stringify([{source_key:"SRC|ROP02_JM|1"},{source_key:"SRC|ROP02_JM|2"},{source_key:"SRC|ROP02_JM|3"}]),{status:200,headers:{"content-type":"application/json"}});
  };
  t.after(()=>{globalThis.fetch=originalFetch;});
  const result=await fetchSupabaseDatasetQuery({dataset:"rop02",limit:2,offset:0});
  assert.equal(result.rows,2);
  assert.equal(result.total,null);
  assert.equal(result.hasMore,true);
  assert.equal(result.nextOffset,2);
  assert.match(calls[0].url,/limit=3/);
  assert.equal(calls[0].options.headers.Prefer,undefined);
});
