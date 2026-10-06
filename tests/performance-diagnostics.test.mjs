import test from "node:test";
import assert from "node:assert/strict";
import {estimatePerfTextBytes,sanitizePerfUrl,summarizeCacheRecords} from "../src/services/performanceDiagnostics.js";

test("calcula bytes UTF-8 de texto",()=>{
  assert.equal(estimatePerfTextBytes("abc"),3);
  assert.equal(estimatePerfTextBytes("á"),2);
});

test("sanitiza URL y descarta parámetros no diagnósticos",()=>{
  const value=sanitizePerfUrl("https://example.com/api/data?action=query_dataset&dataset=rop05&token=SECRETO&offset=1000");
  assert.match(value,/action=query_dataset/);
  assert.match(value,/dataset=rop05/);
  assert.match(value,/offset=1000/);
  assert.doesNotMatch(value,/SECRETO/);
  assert.doesNotMatch(value,/token=/);
});

test("resume hits y misses de cache por dataset",()=>{
  const summary=summarizeCacheRecords(["rop05","rma15_jm","insumos"],{
    rop05:{updatedAt:"2026-09-29T00:00:00.000Z",value:{ok:true,data:[{a:1},{a:2}]}},
    rma15_jm:{data:{ok:true,data:[{a:1}]}},
    insumos:null,
  });
  assert.equal(summary.hits,2);
  assert.equal(summary.misses,1);
  assert.equal(summary.rows,3);
  assert.equal(summary.datasets.length,3);
  assert.equal(summary.datasets.find(item=>item.dataset==="insumos")?.hit,false);
});
