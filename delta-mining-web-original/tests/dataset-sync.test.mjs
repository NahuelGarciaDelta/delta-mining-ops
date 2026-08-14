import test from "node:test";
import assert from "node:assert/strict";
import {createRequestDeduper,resolveDataset,shouldDownloadDataset} from "../src/data/datasetSync.js";

const source=(version,data=[])=>({ok:true,data,meta:{serverVersion:version}});

test("cache miss descarga el dataset",()=>{
  assert.equal(shouldDownloadDataset({source:null,serverVersion:1}),true);
});

test("version igual produce cache hit",()=>{
  assert.equal(shouldDownloadDataset({source:source(7),serverVersion:7}),false);
});

test("version diferente invalida solamente ese dataset",()=>{
  assert.equal(shouldDownloadDataset({source:source(7),serverVersion:8}),true);
});

test("force refresh omite la comparacion de versiones",()=>{
  assert.equal(shouldDownloadDataset({source:source(7),serverVersion:7,force:true}),true);
});

test("dos pedidos simultaneos reutilizan la misma Promise",async()=>{
  const deduper=createRequestDeduper();
  let calls=0;
  const operation=async()=>{calls+=1;await Promise.resolve();return source(2,[{id:1}]);};
  const first=deduper.run("rop02",operation);
  const second=deduper.run("rop02",operation);
  assert.equal(first,second);
  await Promise.all([first,second]);
  assert.equal(calls,1);
  assert.equal(deduper.has("rop02"),false);
});

test("un error de red conserva una copia cacheada",async()=>{
  const cached=source(2,[{id:1}]);
  const result=await resolveDataset({cached,serverVersion:3,fetchDataset:async()=>{throw new Error("offline");}});
  assert.equal(result.data,cached);
  assert.equal(result.stale,true);
  assert.match(result.error.message,/offline/);
});

test("sin cache el error de red se propaga",async()=>{
  await assert.rejects(()=>resolveDataset({cached:null,serverVersion:3,fetchDataset:async()=>{throw new Error("offline");}}),/offline/);
});
