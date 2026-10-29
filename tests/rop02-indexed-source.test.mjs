import test from "node:test";
import assert from "node:assert/strict";
import {fetchSupabaseSource} from "../src/services/supabaseReadApi.js";

const cases=[
  ["rop02_jm","SRC|ROP02_JM|5"],
  ["rop02_fs","SRC|ROP02_FS|5"],
  ["rop02_filosur","SRC|ROP02_FILOSUR|5"],
  ["rop02_zorro","SRC|ROP02_ZORRO|5"],
  ["rop02_fierro","SRC|ROP02_FIERRO|5"],
];

for(const [dataset,key] of cases){
  test(`ROP02 ${dataset} conserva el prefijo y filtra por indice de dataset`,async()=>{
    const oldFetch=globalThis.fetch;
    const calls=[];
    globalThis.fetch=async(url,init={})=>{
      calls.push(new URL(url));
      return new Response(JSON.stringify([{
        source_dataset:dataset,source_key:key,fecha:"2026-10-27",interno:"PCA-0002",numero_parte:"1",
        cantidad_horas:8,estado:"OD",synced_at:"2026-10-29T16:22:09Z"
      }]),{status:200,headers:{"content-type":"application/json"}});
    };
    try{
      const result=await fetchSupabaseSource(dataset);
      assert.equal(result.data.length,1);
      assert.equal(result.data[0]._sourceDataset,dataset);
      assert.equal(result.data[0]._sourceRow,5);
      assert.equal(calls.length,1);
      assert.equal(calls[0].pathname,"/rest/v1/rop02_frontend");
      assert.equal(calls[0].searchParams.get("source_dataset"),`eq.${dataset}`);
      assert.equal(calls[0].searchParams.get("source_key"),`like.SRC|${dataset.toUpperCase()}|*`);
      assert.equal(calls[0].searchParams.get("order"),"fecha.asc,source_key.asc");
    }finally{globalThis.fetch=oldFetch;}
  });
}
