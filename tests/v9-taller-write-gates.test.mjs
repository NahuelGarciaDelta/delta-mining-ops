import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/v9-write.js";

const ENV=[
 "DELTA_V9_STANDALONE_SB_URL","DELTA_V9_STANDALONE_SB_PUBLISHABLE_KEY",
 "DELTA_V9_GAS_WRITE_URL","DELTA_V9_TALLER_WRITE_MODE",
 "DELTA_V9_TALLER_SANDBOX_GAS_URL","DELTA_V9_TALLER_SANDBOX_VERIFIED",
 "DELTA_V9_TALLER_IDEMPOTENCY_VERIFIED","DELTA_V9_TALLER_PRODUCTION_APPROVED"
];
const original=Object.fromEntries(ENV.map(k=>[k,process.env[k]]));
const savedFetch=globalThis.fetch;
const gas="https://script.google.com/macros/s/PRODUCTION123/exec";
const sandbox="https://script.google.com/macros/s/SANDBOX123/exec";

function setup(mode="disabled"){
 process.env.DELTA_V9_STANDALONE_SB_URL="https://biztlietuvvonigcfdwy.supabase.co";
 process.env.DELTA_V9_STANDALONE_SB_PUBLISHABLE_KEY="sb_publishable_"+("a".repeat(30));
 process.env.DELTA_V9_GAS_WRITE_URL=gas;
 process.env.DELTA_V9_TALLER_WRITE_MODE=mode;
 delete process.env.DELTA_V9_TALLER_SANDBOX_GAS_URL;
 delete process.env.DELTA_V9_TALLER_SANDBOX_VERIFIED;
 delete process.env.DELTA_V9_TALLER_IDEMPOTENCY_VERIFIED;
 delete process.env.DELTA_V9_TALLER_PRODUCTION_APPROVED;
 const calls=[];
 globalThis.fetch=async(url)=>{
  calls.push(String(url));
  if(String(url).endsWith("/auth/v1/user"))
   return new Response(JSON.stringify({email:"operator@example.test",app_metadata:{v9_active:true,v9_role:"ADMIN",v9_area:"OFICINA TECNICA"}}),{status:200});
  throw Error("Unexpected downstream call: "+String(url));
 };
 return calls;
}
function request(payload){
 const req={method:"POST",headers:{authorization:"Bearer "+("x".repeat(80))},body:{payload:JSON.stringify(payload)}};
 const res={setHeader(){return this},status(n){this.code=n;return this},json(x){this.body=x;return this}};
 return handler(req,res).then(()=>res);
}
const move={tipo:"SUBIDA",interno:"TOP-9999",proyectoDestino:"FILO SUR"};

test("Taller writes fail closed without a verified destination",async()=>{
 const calls=setup();
 const response=await request({action:"save_taller_movement",operationId:"123e4567-e89b-42d3-a456-426614174000",movement:move});
 assert.equal(response.code,423);
 assert.equal(response.body.error,"V9_TALLER_WRITES_NOT_VERIFIED");
 assert.equal(calls.length,1);
});

test("Taller capabilities reveal disabled state without exposing secrets",async()=>{
 const calls=setup();
 const response=await request({action:"v9_taller_write_status"});
 assert.equal(response.code,200);
 assert.equal(response.body.mode,"disabled");
 assert.equal(response.body.canWrite,false);
 assert.equal(calls.length,1);
});

test("Sandbox mode requires a distinct configured, verified bridge",async()=>{
 const calls=setup("sandbox");
 process.env.DELTA_V9_TALLER_SANDBOX_GAS_URL=gas;
 process.env.DELTA_V9_TALLER_SANDBOX_VERIFIED="true";
 let response=await request({action:"save_taller_movement",operationId:"123e4567-e89b-42d3-a456-426614174000",movement:move});
 assert.equal(response.code,423);
 process.env.DELTA_V9_TALLER_SANDBOX_GAS_URL=sandbox;
 response=await request({action:"save_taller_movement",movement:move});
 assert.equal(response.code,400);
 assert.equal(response.body.error,"V9_OPERATION_ID_REQUIRED");
 assert.equal(calls.length,2);
});

test("Production mode requires both explicit approval flags",async()=>{
 const calls=setup("production");
 process.env.DELTA_V9_TALLER_IDEMPOTENCY_VERIFIED="true";
 const response=await request({action:"save_taller_movement",operationId:"123e4567-e89b-42d3-a456-426614174000",movement:move});
 assert.equal(response.code,423);
 assert.equal(calls.length,1);
});

test.after(()=>{
 globalThis.fetch=savedFetch;
 for(const [key,value] of Object.entries(original)){
  if(value===undefined)delete process.env[key];
  else process.env[key]=value;
 }
});
