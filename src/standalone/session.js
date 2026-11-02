// Dedicated V9 Supabase Auth project. Never falls back to Delta OPS V8.1.
const REF="biztlietuvvonigcfdwy";
const URL=String(import.meta.env.VITE_V9_SUPABASE_URL||"");
const KEY=String(import.meta.env.VITE_V9_SUPABASE_PUBLISHABLE_KEY||"");
const STORAGE="delta_ops_v9_independent_session";
export const isV9Configured=URL===`https://${REF}.supabase.co`&&/^sb_publishable_[A-Za-z0-9_-]{15,}$/.test(KEY);

// V9 kept a separate Supabase session when the original Delta OPS UI was restored.
// Recover a previously authenticated V9 token if that dedicated key was lost during
// deployment. NEVER accept legacy V8.1 tokens: only this project's exact issuer.
function readV9Claims(token){
 if(typeof token!=="string"||token.length>4096)return null;
 try{
  const part=token.split(".")[1];
  if(!part)return null;
  const b64=part.replace(/-/g,"+").replace(/_/g,"/");
  const payload=JSON.parse(atob(b64.padEnd(Math.ceil(b64.length/4)*4,"=")));
  const exp=Number(payload?.exp);
  const rawIssuer=String(payload?.iss||"");
  const issuer=rawIssuer.endsWith("/")?rawIssuer.slice(0,-1):rawIssuer;
  if(issuer!==`${URL}/auth/v1`||!Number.isFinite(exp)||exp<=Date.now()/1000+30)return null;
  return {exp,email:String(payload?.email||"").toLowerCase()};
 }catch{return null;}
}
export function currentSession(){
 try{
  if(!isV9Configured)return null;
  const s=JSON.parse(sessionStorage.getItem(STORAGE)||"null");
  if(s&&typeof s==="object"&&typeof s.access_token==="string"&&
     (s.expires_at>Date.now()/1000||s.refresh_token)&&readV9Claims(s.access_token))
    return s;
  // The old frontend session may still hold this SAME V9 JWT after a redeploy.
  // This is a UI recovery only; /auth/v1/user and the API still validate it.
  const user=JSON.parse(sessionStorage.getItem("dm_authenticated_user")||"null");
  const token=String(user?.authToken||user?.token||"");
  const claim=readV9Claims(token);
  if(!claim)return null;
  const restored={access_token:token,refresh_token:"",expires_at:claim.exp,email:claim.email};
  sessionStorage.setItem(STORAGE,JSON.stringify(restored));
  return restored;
 }catch{return null;}
}
export function saveSession(s){sessionStorage.setItem(STORAGE,JSON.stringify(s));return s}
export function forgetSession(){sessionStorage.removeItem(STORAGE)}
function normalizeAuthReply(d,email){
 if(!d?.access_token||!d?.refresh_token)throw Error("V9_INVALID_AUTH_REPLY");
 return {access_token:d.access_token,refresh_token:d.refresh_token,
   expires_at:Math.floor(Date.now()/1000)+Number(d.expires_in||3600),
   email:String(d.user?.email||email||"").toLowerCase()};
}
async function authExchange(grant,payload){
 if(!isV9Configured)throw Error("V9_BACKEND_NOT_CONFIGURED");
 const response=await fetch(URL+"/auth/v1/token?grant_type="+grant,{
  method:"POST",cache:"no-store",headers:{"apikey":KEY,"Content-Type":"application/json"},body:JSON.stringify(payload)});
 const d=await response.json().catch(()=>null);
 if(!response.ok)throw Error(grant==="password"?"V9_INVALID_CREDENTIALS":"V9_SESSION_EXPIRED");
 return normalizeAuthReply(d,payload.email);
}
export async function loginV9(email,password){
 return authExchange("password",{email:String(email||"").trim().toLowerCase(),password});
}
export async function refreshV9(s){
 if(!s?.refresh_token)throw Error("V9_SESSION_EXPIRED");
 const n=await authExchange("refresh_token",{refresh_token:s.refresh_token,email:s.email});
 return saveSession(n);
}
export async function requestV9(payload,session){
 const active=session||currentSession();
 if(!active?.access_token)throw Error("V9_SESSION_REQUIRED");
 let s=active;
 if(s.expires_at*1000<Date.now()+60000 && s.refresh_token)s=await refreshV9(s);
 const run=async token=>{
  const r=await fetch("/api/v9-independent",{
   method:"POST",cache:"no-store",
   headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},
   body:JSON.stringify(payload)
  });
  const d=await r.json().catch(()=>({ok:false,error:"V9_INVALID_RESPONSE"}));
  return {r,d};
 };
 let x=await run(s.access_token);
 if(x.r.status===401 && s.refresh_token){
  s=await refreshV9(s);
  x=await run(s.access_token);
 }
 if(!x.r.ok||!x.d?.ok)throw Error(x.d?.error||"V9_UNAVAILABLE");
 return x.d;
}
