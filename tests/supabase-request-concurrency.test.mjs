import test from "node:test";
import assert from "node:assert/strict";
import {createRequestLimiter} from "../src/services/requestConcurrency.js";

test("el limitador comparte un maximo estricto incluso entre fuentes",async()=>{
  const limit=createRequestLimiter(3);
  let active=0,peak=0;
  const releases=[];
  const tasks=Array.from({length:12},(_,i)=>limit(()=>new Promise(resolve=>{
    active++;peak=Math.max(peak,active);
    releases.push(()=>{active--;resolve(i);});
  })));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(peak,3);
  assert.equal(releases.length,3);
  for(let i=0;i<12;i++){
    releases[i]();
    await new Promise(resolve=>setImmediate(resolve));
  }
  assert.deepEqual(await Promise.all(tasks),Array.from({length:12},(_,i)=>i));
  assert.equal(peak,3);
  assert.equal(active,0);
});

test("un error de lectura no bloquea solicitudes en cola",async()=>{
  const limit=createRequestLimiter(1);
  let fail;
  const first=limit(()=>new Promise((_,reject)=>{fail=reject;}));
  const second=limit(()=>42);
  await new Promise(resolve=>setImmediate(resolve));
  fail(new Error("timeout"));
  await assert.rejects(first,/timeout/);
  assert.equal(await second,42);
});

test("un callback sincrono que arroja error libera el cupo",async()=>{
  const limit=createRequestLimiter(1);
  await assert.rejects(limit(()=>{throw Error("fallo");}),/fallo/);
  assert.equal(await limit(()=>7),7);
});
