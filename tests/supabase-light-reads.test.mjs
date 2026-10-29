import test from "node:test";
import assert from "node:assert/strict";
import {fetchSupabaseSource} from "../src/services/supabaseReadApi.js";

const reply=(data,headers={})=>new Response(JSON.stringify(data),{
  status:200,headers:{"content-type":"application/json",...headers},
});

test("small typed source reads one page without count=exact",async()=>{
  const original=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async(url,init={})=>{
    calls.push({url:String(url),method:init.method||"GET",prefer:init.headers?.Prefer});
    return reply([{source_dataset:"insumos",source_row:2,codigo:"A1",descripcion:"Tornillo",precio_unitario:10,raw_data:{}}]);
  };
  try{
    const out=await fetchSupabaseSource("insumos");
    assert.equal(out.data.length,1);
    assert.equal(calls.length,1);
    assert.equal(calls[0].method,"GET");
    assert.equal(calls[0].prefer,undefined);
    assert.match(new URL(calls[0].url).searchParams.get("select")||"","raw_data");
    assert.doesNotMatch(new URL(calls[0].url).searchParams.get("select")||"","^\\*$");
  }finally{globalThis.fetch=original;}
});

test("large typed source uses a header-only count then parallel remaining pages",async()=>{
  const original=globalThis.fetch;
  const calls=[];
  const all=Array.from({length:1001},(_,i)=>({
    source_dataset:"lista_equipos",source_row:i+1,codigo_nuevo:`EXC-${i}`,raw_data:{Familia:"Excavadora"},
  }));
  globalThis.fetch=async(url,init={})=>{
    const u=new URL(url),method=init.method||"GET";
    calls.push({method,offset:Number(u.searchParams.get("offset")||0),prefer:init.headers?.Prefer});
    if(method==="HEAD")return new Response(null,{status:200,headers:{"content-range":"0-0/1001"}});
    const from=Number(u.searchParams.get("offset")||0),take=Number(u.searchParams.get("limit")||1000);
    return reply(all.slice(from,from+take));
  };
  try{
    const out=await fetchSupabaseSource("lista_equipos");
    assert.equal(out.data.length,1001);
    assert.equal(out.data[1000]["Código nuevo"],"EXC-1000");
    assert.equal(calls.length,3);
    assert.equal(calls.filter(x=>x.method==="HEAD"&&x.prefer==="count=exact").length,1);
    assert.equal(calls.filter(x=>x.method==="GET").length,2);
  }finally{globalThis.fetch=original;}
});

test("failed HEAD falls back to complete sequential pagination",async()=>{
  const original=globalThis.fetch;
  const all=Array.from({length:1001},(_,i)=>({
    source_dataset:"rop05",source_row:i+1,interno:"MOT-0001",raw_data:{},
  }));
  const calls=[];
  globalThis.fetch=async(url,init={})=>{
    const u=new URL(url),method=init.method||"GET";calls.push(method);
    if(method==="HEAD")throw new Error("HEAD unavailable");
    const offset=Number(u.searchParams.get("offset")||0),limit=Number(u.searchParams.get("limit")||1000);
    return reply(all.slice(offset,offset+limit));
  };
  try{
    const out=await fetchSupabaseSource("rop05");
    assert.equal(out.data.length,1001);
    assert.deepEqual(calls,["GET","HEAD","GET"]);
  }finally{globalThis.fetch=original;}
});
