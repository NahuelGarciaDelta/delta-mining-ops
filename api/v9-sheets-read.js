// Authenticated read relay for the original Google Sheets managed by Apps Script V9.
// Supabase V9 remains isolated for sandbox-only tests; no production row is read here.
const REF="biztlietuvvonigcfdwy";
const ALLOWED=new Set(["rop02_jm","rop02_fs","rop02_filosur","rop02_zorro","rop02_fierro","rop05","rma15_jm","rma15_fs","lista_equipos","insumos","raba03","mantenimiento_programado","movimientos_equipos","combustible"]);
export const config={maxDuration:30};
function reply(res,status,body){res.setHeader("Cache-Control","no-store, max-age=0");res.setHeader("X-Content-Type-Options","nosniff");return res.status(status).json(body);}
function validDb(){const url=String(process.env.DELTA_V9_STANDALONE_SB_URL||"").replace(/\/+$/,"");const key=String(process.env.DELTA_V9_STANDALONE_SB_PUBLISHABLE_KEY||"");return url==="https://"+REF+".supabase.co"&&/^sb_publishable_[A-Za-z0-9_-]{15,}$/.test(key)?{url,key}:null;}
async function userFor(db,token){const r=await fetch(db.url+"/auth/v1/user",{headers:{apikey:db.key,Authorization:"Bearer "+token,Accept:"application/json"},redirect:"error",cache:"no-store"});if(!r.ok)return null;const u=await r.json();const m=u?.app_metadata||{};return m.v9_active===true&&["ADMIN","OFICINA_TECNICA","ADMINISTRATIVO","MECANICO"].includes(String(m.v9_role||"").toUpperCase())?u:null;}
export default async function handler(req,res){
 if(req.method!=="POST"){res.setHeader("Allow","POST");return reply(res,405,{ok:false,error:"METHOD_NOT_ALLOWED"});}
 const db=validDb(),token=String(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
 if(!db)return reply(res,503,{ok:false,error:"V9_BACKEND_NOT_CONFIGURED"});
 if(token.length<60||token.length>4096)return reply(res,401,{ok:false,error:"V9_SESSION_REQUIRED"});
 const body=req.body&&typeof req.body==="object"&&!Array.isArray(req.body)?req.body:{};const dataset=String(body.dataset||""),entity=String(body.entity||"").toUpperCase();const limit=Number(body.limit||1000),offset=Number(body.offset||0);
 if(!ALLOWED.has(dataset)||!Number.isInteger(limit)||limit<1||limit>1000||!Number.isInteger(offset)||offset<0)return reply(res,400,{ok:false,error:"V9_INVALID_SHEETS_QUERY"});
 const gas=String(process.env.DELTA_V9_GAS_WRITE_URL||"").trim();if(!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(gas))return reply(res,503,{ok:false,error:"V9_SHEETS_BRIDGE_NOT_CONFIGURED"});
 try {if(!await userFor(db,token))return reply(res,401,{ok:false,error:"V9_SESSION_EXPIRED_OR_INACTIVE"});
  const upstream=await fetch(gas,{method:"POST",redirect:"follow",cache:"no-store",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8",Accept:"application/json"},body:new URLSearchParams({payload:JSON.stringify({action:"v9_read_dataset",dataset,entity,limit,offset,authToken:token})})});
  const text=await upstream.text();if(!upstream.ok||text.length>5000000)return reply(res,502,{ok:false,error:"V9_SHEETS_READ_FAILED"});let data;try{data=JSON.parse(text);}catch{return reply(res,502,{ok:false,error:"V9_SHEETS_INVALID_REPLY"});}
  if(data?.ok!==true||!Array.isArray(data.data)||!Number.isInteger(Number(data.totalRows)))return reply(res,502,{ok:false,error:"V9_SHEETS_CONTRACT_INVALID"});
  return reply(res,200,{ok:true,dataset,rows:data.data,total:Number(data.totalRows),offset,limit,hasMore:data.hasMore===true,nextOffset:data.nextOffset??null,meta:data.meta??null,source:"GOOGLE_SHEETS_ORIGINAL"});
 }catch{return reply(res,502,{ok:false,error:"V9_SHEETS_BRIDGE_UNAVAILABLE"});}
}
