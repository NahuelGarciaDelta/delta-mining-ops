// HMAC-authenticated ingress for the ISOLATED V9 sandbox only.
// No browser session or V8.1 data source is accepted. Disabled until secret configured.
const SUPABASE_REF="biztlietuvvonigcfdwy";
const TARGET="https://"+SUPABASE_REF+".supabase.co";
const ACCEPT=new Set(["rop02_jm","rop02_fs","rop02_filosur","rop02_zorro","rop02_fierro","rop05","rma15_jm","rma15_fs","lista_equipos","insumos","mantenimiento_programado","raba03","combustible"]);
const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{
 status,headers:{"Content-Type":"application/json;charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}
});
function fromHex(h:string):Uint8Array|null{
 if(!/^[a-f0-9]{64}$/i.test(h))return null;
 const bytes=new Uint8Array(32);
 for(let i=0;i<32;i++)bytes[i]=parseInt(h.slice(i*2,i*2+2),16);
 return bytes;
}
function fixedEqual(a:Uint8Array,b:Uint8Array){
 if(a.length!==b.length)return false;
 let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
 return diff===0;
}
async function verify(message:string,hex:string,secret:string){
 const sig=fromHex(hex);if(!sig)return false;
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),
  {name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const ours=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(message)));
 return fixedEqual(ours,sig);
}
Deno.serve(async req=>{
 if(req.method!=="POST")return json(405,{ok:false,error:"METHOD_NOT_ALLOWED"});
 const secret=String(Deno.env.get("DELTA_V9_INGEST_HMAC_SECRET")||"");
 const serviceKey=String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"");
 const db=String(Deno.env.get("SUPABASE_URL")||"").replace(/\/+$/,"");
 if(secret.length<32||!serviceKey||db!==TARGET)
   return json(503,{ok:false,error:"V9_INGEST_NOT_CONFIGURED"});
 if(!String(req.headers.get("content-type")||"").includes("application/json"))
   return json(415,{ok:false,error:"CONTENT_TYPE_REQUIRED"});
 const ts=String(req.headers.get("x-v9-timestamp")||"");
 const signature=String(req.headers.get("x-v9-signature")||"");
 if(!/^\d{10}$/.test(ts)||Math.abs(Date.now()/1000-Number(ts))>300)
   return json(401,{ok:false,error:"INVALID_TIMESTAMP"});
 const raw=await req.text();
 if(raw.length>650000)return json(413,{ok:false,error:"V9_BATCH_TOO_LARGE"});
 if(!await verify(ts+"."+raw,signature,secret))
   return json(401,{ok:false,error:"INVALID_SIGNATURE"});
 let data:Record<string,unknown>;
 try{data=JSON.parse(raw);}catch{return json(400,{ok:false,error:"INVALID_JSON"});}
 if(!data||!ACCEPT.has(String(data.dataset||""))||!Array.isArray(data.records)
  ||data.records.length<1||data.records.length>100
  ||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(data.request_id||"")))
  return json(400,{ok:false,error:"INVALID_V9_PAYLOAD"});
 try{
  const response=await fetch(TARGET+"/rest/v1/rpc/v9_ingest_accept_batch_v1",{
   method:"POST",headers:{"apikey":serviceKey,"Authorization":"Bearer "+serviceKey,
      "Content-Type":"application/json","Accept":"application/json"},
   body:JSON.stringify({p_request_id:data.request_id,p_dataset:data.dataset,p_records:data.records}),
   signal:AbortSignal.timeout(25000)
  });
  if(!response.ok)return json(response.status>=500?502:409,{ok:false,error:"V9_INGEST_REJECTED"});
  const proof=await response.json();
  if(!proof?.ok||proof.dataset!==data.dataset)return json(502,{ok:false,error:"V9_RECEIPT_INVALID"});
  return json(200,proof);
 }catch{return json(502,{ok:false,error:"V9_INGEST_UNAVAILABLE"});}
});
