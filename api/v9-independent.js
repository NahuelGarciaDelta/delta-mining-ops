// V9 standalone API. No dependency on Delta OPS V8.1 Supabase or Apps Script.
// Auth tokens are issued by the independent V9 Supabase Auth project.
// This gateway is read-only and never writes operational records.
const REF="biztlietuvvonigcfdwy";
const ALLOWED=new Set(["rop02_jm","rop02_fs","rop02_filosur","rop02_zorro","rop02_fierro","rop05","rma15_jm","rma15_fs","lista_equipos","insumos","mantenimiento_programado","raba03","combustible"]);
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
 if(!["status","catalog","rows"].includes(body.action))return bad(res,400,"INVALID_ACTION");
 try{
  const me=await upstream(db.url+"/auth/v1/user",{headers:{apikey:db.key,Authorization:"Bearer "+token,Accept:"application/json"}});
  if(!me.ok)return bad(res,401,"V9_SESSION_EXPIRED");
  const user=await me.json();
  const meta=user?.app_metadata||{};
  const role=String(meta.v9_role||"").toUpperCase();
  if(!["ADMIN","OFICINA_TECNICA","ADMINISTRATIVO","MECANICO"].includes(role)||meta.v9_active!==true)
   return bad(res,403,"V9_ROLE_NOT_ALLOWED");
  if(body.action==="status" || body.action==="catalog"){
   const r=await upstream(db.url+"/rest/v1/v9_dataset_status?select=dataset,label,category,is_migrated,read_enabled,notes,records,latest_row_at&order=category.asc,label.asc",
    {headers:{apikey:db.key,Authorization:"Bearer "+token,Accept:"application/json"}});
   if(!r.ok)return bad(res,502,"V9_CATALOG_UNAVAILABLE");
   const allSources=await r.json().catch(()=>null);
   if(!Array.isArray(allSources))return bad(res,502,"V9_CATALOG_INVALID_REPLY");
   const mirrors=allSources.filter(s=>String(s.dataset||"").startsWith("mirror_"));
   const promoted=new Map(mirrors.filter(s=>s.is_migrated===true && s.read_enabled===true)
     .map(s=>[String(s.dataset).slice(7),s]));
   // Status/version cache must follow the promoted mirror, not the stale legacy snapshot.
   const sources=allSources.filter(s=>!String(s.dataset||"").startsWith("mirror_"))
     .map(s=>promoted.has(s.dataset)
       ?{...s,records:promoted.get(s.dataset).records,
           latest_row_at:promoted.get(s.dataset).latest_row_at,
           is_migrated:true,notes:"V9_MIRROR_VERIFIED",active_storage:"mirror_"+s.dataset}
       :{...s,active_storage:s.dataset});
   return respond(res,200,{ok:true,backend:"Supabase V9 independiente",total:sources.reduce((sum,s)=>sum+Number(s.records||0),0),sources,mirrors:mirrors.map(s=>({dataset:s.dataset,records:s.records,is_migrated:s.is_migrated,latest_row_at:s.latest_row_at})),mode:"READ_ONLY",isolation:"SANDBOX_V9_ONLY",profile:{email:String(user.email||"").toLowerCase(),rol:role==="OFICINA_TECNICA"?"ADMIN":role,area:String(meta.v9_area||"").slice(0,90),proyecto:String(meta.v9_project||"TODOS").slice(0,90),nombre:String(user.user_metadata?.nombre||user.user_metadata?.name||user.email?.split("@")[0]||"Usuario").slice(0,90)}});
  }
  const dataset=String(body.dataset||"");
  const limit=Number(body.limit||100);
  const offset=Number(body.offset||0);
  if(!ALLOWED.has(dataset)||!Number.isInteger(limit)||limit<1||limit>500||!Number.isInteger(offset)||offset<0||offset>100000)return bad(res,400,"INVALID_DATASET_OR_PAGE");
  // Mirror sources are PREPARED separately; never mix partial historical snapshots.
  // Only an audited, explicit is_migrated=true switch in the sandbox catalog
  // allows the app to read mirror_* datasets. No application-side toggle.
  let effectiveDataset=dataset;
  const mirrored="mirror_"+dataset;
  const catalog=await upstream(db.url+"/rest/v1/v9_dataset_catalog?select=dataset,is_migrated,read_enabled&dataset=eq."+encodeURIComponent(mirrored)+"&limit=1",
   {headers:{apikey:db.key,Authorization:"Bearer "+token,Accept:"application/json"}});
  if(!catalog.ok)return bad(res,502,"V9_MIRROR_CATALOG_UNAVAILABLE");
  const list=await catalog.json().catch(()=>null);
  if(!Array.isArray(list))return bad(res,502,"V9_MIRROR_CATALOG_INVALID_REPLY");
  if(list[0]?.is_migrated===true && list[0]?.read_enabled===true)effectiveDataset=mirrored;
  const q=new URLSearchParams({select:"record_id,payload,updated_at",dataset:"eq."+effectiveDataset,order:"record_id.asc",limit:String(limit),offset:String(offset)});
  const r=await upstream(db.url+"/rest/v1/v9_operational_rows?"+q,
   {headers:{apikey:db.key,Authorization:"Bearer "+token,Accept:"application/json",Prefer:"count=exact"}});
  if(!r.ok)return bad(res,r.status===403?403:502,"V9_DATASET_READ_FAILED");
  const rows=await r.json();
  if(!Array.isArray(rows))return bad(res,502,"V9_BACKEND_INVALID_REPLY");
  const count=(r.headers.get("content-range")||"").match(/\/(\d+)$/);
  return respond(res,200,{ok:true,dataset,rows,mode:"READ_ONLY",offset,limit,total:count?Number(count[1]):rows.length,hasMore:count?offset+rows.length<Number(count[1]):rows.length===limit});
 }catch(e){
  return bad(res,e?.name==="AbortError"?504:502,e?.name==="AbortError"?"V9_TIMEOUT":"V9_BACKEND_UNAVAILABLE");
 }
}
