// V9 standalone API. No dependency on Delta OPS V8.1 Supabase or Apps Script.
// Auth tokens are issued by the independent V9 Supabase Auth project.
// This gateway is read-only and never writes operational records.
const REF="biztlietuvvonigcfdwy";
const ALLOWED=new Set(["rop02_jm","rop02_fs","rop05","rma15_jm","rma15_fs","lista_equipos","insumos"]);
export const config={maxDuration:30};
function respond(res,status,body){res.setHeader("Cache-Control","no-store, max-age=0");res.setHeader("X-Content-Type-Options","nosniff");return res.status(status).json(body);}
function bad(res,status,error){return respond(res,status,{ok:false,error});}
function cfg(){
 const url=String(process.env.DELTA_V9_STANDALONE_SB_URL||"").replace(/\/+$/,"");
 const key=String(process.env.DELTA_V9_STANDALONE_SB_PUBLISHABLE_KEY||"");
 return url==="https://"+REF+".supabase.co"&&/^sb_publishable_[A-Za-z0-9_-]{15,}$/.test(key)?{url,key}:null;
}
async function upstream(url,opts,timeout=13000){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);
 try{return await fetch(url,{...opts,signal:c.signal,redirect:"error",cache:"no-store"});}
 finally{clearTimeout(t);}
}
export default async function handler(req,res){
 if(req.method!=="POST"){res.setHeader("Allow","POST");return bad(res,405,"METHOD_NOT_ALLOWED");}
 const db=cfg();if(!db)return bad(res,503,"V9_BACKEND_NOT_CONFIGURED");
 const token=String(req.headers.authorization||"").replace(/^Bearer /i,"");
 if(!token||token.length<60||token.length>4096)return bad(res,401,"V9_SESSION_REQUIRED");
 const body=req.body&&typeof req.body==="object"&&!Array.isArray(req.body)?req.body:{};
 if(!["status","rows","gas-health"].includes(body.action))return bad(res,400,"INVALID_ACTION");
 try{
  const me=await upstream(db.url+"/auth/v1/user",{headers:{apikey:db.key,Authorization:"Bearer "+token,Accept:"application/json"}});
  if(!me.ok)return bad(res,401,"V9_SESSION_EXPIRED");
  const user=await me.json();
  const role=String(user?.app_metadata?.v9_role||"");
  if(!["ADMIN","OFICINA_TECNICA"].includes(role))return bad(res,403,"V9_ROLE_NOT_ALLOWED");
  if(body.action==="gas-health"){
   const raw=String(process.env.DELTA_V9_STANDALONE_GAS_URL||"");
   let url;try{url=new URL(raw);if(url.protocol!=="https:"||url.hostname!=="script.google.com"||!/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)||url.search||url.hash)throw Error("invalid");}
   catch{return bad(res,503,"V9_GAS_NOT_CONFIGURED");}
   url.searchParams.set("action","health");
   const r=await upstream(url.toString(),{method:"GET"},12000);
   if(!r.ok)return bad(res,502,"V9_GAS_HEALTH_FAILED");
   let health;try{health=await r.json();}catch{return bad(res,502,"V9_GAS_INVALID_REPLY");}
   return respond(res,200,{ok:health?.ok===true,mode:"V9_INDEPENDENT_HEALTH",backend:"V9 Apps Script"});
  }
  if(body.action==="status"){
   const r=await upstream(db.url+"/rest/v1/v9_operational_rows?select=record_id&limit=1",
    {headers:{apikey:db.key,Authorization:"Bearer "+token,Prefer:"count=exact",Accept:"application/json"}});
   if(!r.ok)return bad(res,502,"V9_DATASET_UNAVAILABLE");
   const range=r.headers.get("content-range")||"0-0/0";
   const match=range.match(/\/(\d+)$/);
   return respond(res,200,{ok:true,backend:"Supabase V9 independiente",total:match?Number(match[1]):null,mode:"READ_ONLY"});
  }
  const dataset=String(body.dataset||"");
  const limit=Number(body.limit||100);
  if(!ALLOWED.has(dataset)||!Number.isInteger(limit)||limit<1||limit>100)return bad(res,400,"INVALID_DATASET");
  const q=new URLSearchParams({select:"record_id,payload,updated_at",dataset:"eq."+dataset,order:"updated_at.desc",limit:String(limit)});
  const r=await upstream(db.url+"/rest/v1/v9_operational_rows?"+q,
   {headers:{apikey:db.key,Authorization:"Bearer "+token,Accept:"application/json"}});
  if(!r.ok)return bad(res,r.status===403?403:502,"V9_DATASET_READ_FAILED");
  const rows=await r.json();
  if(!Array.isArray(rows))return bad(res,502,"V9_BACKEND_INVALID_REPLY");
  return respond(res,200,{ok:true,dataset,rows,mode:"READ_ONLY",total:rows.length});
 }catch(e){
  return bad(res,e?.name==="AbortError"?504:502,e?.name==="AbortError"?"V9_TIMEOUT":"V9_BACKEND_UNAVAILABLE");
 }
}
