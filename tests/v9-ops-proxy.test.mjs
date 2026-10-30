import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import handler from "../api/v9-ops.js";

const keys = ["DELTA_V9_ADMIN_TOKEN", "DELTA_V9_SUPABASE_SERVICE_KEY", "DELTA_V9_SUPABASE_URL", "DELTA_V9_GAS_URL"];
const originals = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
const token = "token-" + "t".repeat(40);
const service = "sb_secret_" + "s".repeat(40);
function res() {
  return { statusCode: 200, headers: {}, body: null,
    setHeader(k,v){this.headers[k]=v;return this;},
    status(code){this.statusCode=code;return this;},
    json(value){this.body=value;return this;}
  };
}
function req(body={mode:"preview"},credential=token,method="POST"){
  return {method,headers:{"x-delta-v9-admin-token":credential},body};
}
beforeEach(()=>{
  process.env.DELTA_V9_ADMIN_TOKEN=token;
  process.env.DELTA_V9_SUPABASE_SERVICE_KEY=service;
  process.env.DELTA_V9_SUPABASE_URL="https://jwfocqaxlckuxoklwyxs.supabase.co";
  delete process.env.DELTA_V9_GAS_URL;
});
afterEach(()=>{
  for(const key of keys){if(originals[key]===undefined)delete process.env[key];else process.env[key]=originals[key];}
  globalThis.fetch=originalFetch;
});
test("no GET or writes",async()=>{const out=res();await handler(req({},token,"GET"),out);assert.equal(out.statusCode,405);});
test("no unconfigured authorization",async()=>{delete process.env.DELTA_V9_ADMIN_TOKEN;const out=res();await handler(req(),out);assert.equal(out.statusCode,503);});
test("wrong token never reaches Supabase",async()=>{globalThis.fetch=()=>{throw Error("unexpected network")};const out=res();await handler(req({mode:"preview"},"x".repeat(token.length)),out);assert.equal(out.statusCode,401);});
test("unknown commands and unbounded reads rejected",async()=>{for(const body of [{mode:"publish"},{mode:"preview",limit:50000},{mode:"preview",gate:"anything"}]){const out=res();await handler(req(body),out);assert.equal(out.statusCode,400);}});
test("secret never returned to browser",async()=>{
 let called=0;
 globalThis.fetch=async(url,opt)=>{
   called++;
   assert.equal(url,"https://jwfocqaxlckuxoklwyxs.supabase.co/rest/v1/rpc/dm_v9_ops_read_v1");
   assert.equal(opt.method,"POST");
   assert.equal(opt.headers.apikey,service);
   assert.deepEqual(JSON.parse(opt.body),{p_limit:5,p_after:"",p_gate:"BLOCKED_UNLINKED"});
   return {ok:true,text:async()=>JSON.stringify({ok:true,mode:"V9_READ_ONLY",rows:[],total:5295,counts:{BLOCKED_UNLINKED:23}})};
 };
 const out=res();await handler(req({mode:"preview",limit:5,gate:"BLOCKED_UNLINKED"}),out);
 assert.equal(out.statusCode,200);assert.equal(out.body.total,5295);assert.equal(called,1);
 assert.equal(JSON.stringify(out.body).includes(service),false);
});
test("gas clone must be configured",async()=>{const out=res();await handler(req({mode:"gas-health"}),out);assert.equal(out.statusCode,503);});
