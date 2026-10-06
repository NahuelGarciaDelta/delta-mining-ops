import { promises as fs } from "node:fs";
import path from "node:path";

const EMAIL=String(process.env.DM_PERF_EMAIL||"").trim().toLowerCase();
const PASSWORD=String(process.env.DM_PERF_PASSWORD||"");
const SUPABASE_URL="https://jwfocqaxlckuxoklwyxs.supabase.co";
const SUPABASE_KEY="sb_publishable_XZAcQcWEDdgtZY_NWADy1g_HxoV0UZ2";
const OUT_DIR=path.join(process.cwd(),"artifacts","phase0");
await fs.mkdir(OUT_DIR,{recursive:true});

const result={
  generatedAt:new Date().toISOString(),
  secretsPresent:Boolean(EMAIL&&PASSWORD),
  emailShapeValid:EMAIL.includes("@")&&EMAIL.includes("."),
  requestCompleted:false,
  httpStatus:null,
  responseOk:false,
  outcomeOk:null,
  errorCode:null,
  hasAuthToken:false,
  hasUser:false,
  elapsedMs:null,
  networkError:null,
};

const started=Date.now();
if(EMAIL&&PASSWORD){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/app_authenticate_user`,{
      method:"POST",
      headers:{
        apikey:SUPABASE_KEY,
        Authorization:`Bearer ${SUPABASE_KEY}`,
        Accept:"application/json",
        "Content-Type":"application/json",
      },
      body:JSON.stringify({p_email:EMAIL,p_password:PASSWORD}),
      signal:controller.signal,
    });
    result.requestCompleted=true;
    result.httpStatus=response.status;
    result.responseOk=response.ok;
    const text=await response.text();
    if(response.ok){
      try{
        const json=text?JSON.parse(text):null;
        result.outcomeOk=typeof json?.ok==="boolean"?json.ok:null;
        result.errorCode=String(json?.error?.code||"").slice(0,80)||null;
        result.hasAuthToken=Boolean(json?.authToken||json?.token||json?.user?.authToken||json?.user?.token);
        result.hasUser=Boolean(json?.user&&typeof json.user==="object");
      }catch{
        result.errorCode="RESPONSE_NOT_JSON";
      }
    }else{
      result.errorCode=`HTTP_${response.status}`;
    }
  }catch(error){
    result.networkError=error?.name==="AbortError"?"TIMEOUT":String(error?.code||error?.name||"NETWORK_ERROR").slice(0,80);
  }finally{
    clearTimeout(timer);
  }
}
result.elapsedMs=Date.now()-started;

await fs.writeFile(path.join(OUT_DIR,"auth-endpoint-diagnostic.json"),JSON.stringify(result,null,2));
console.log("PHASE0_AUTH_ENDPOINT_DIAGNOSTIC");
console.log(JSON.stringify(result,null,2));
