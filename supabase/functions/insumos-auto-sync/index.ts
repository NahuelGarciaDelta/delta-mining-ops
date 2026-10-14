import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const VERSION = "2026-10-14-INSUMOS-COUNT-ONLY-V2";
const DATASET = "insumos";
const SOURCE_URL = "https://script.google.com/macros/s/AKfycbxU-ihsxXTNn2wa5EO1OkSM5FjJ43MwxSx8dY0RjbnJRFBKF0BiNNq7QsuohWxmmeOhog/exec";
type Row = Record<string, unknown>;
const txt = (x: unknown) => x == null ? "" : String(x).trim();
const keyNorm = (x: unknown) => txt(x).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g," ");
const pick = (r: Row, keys: string[]): unknown => {
  const wanted = new Set(keys.map(keyNorm));
  for (const [k,v] of Object.entries(r||{})) if (wanted.has(keyNorm(k))) return v;
  return "";
};
function codeNorm(x: unknown): string {
  let s=txt(x).toUpperCase().replace(/\s+/g,"");
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(s)) s=s.replace(/[.,]/g,"");
  if (/^\d+\.0+$/.test(s)) s=s.replace(/\.0+$/,"");
  return s;
}
function amount(x:unknown):number {
  if (typeof x==="number") return x;
  let s=txt(x).replace(/\s/g,"").replace(/[^0-9,.\-]/g,"");
  if (!s) return NaN;
  const commas=(s.match(/,/g)||[]).length, dots=(s.match(/\./g)||[]).length;
  if (commas && dots) s=s.lastIndexOf(",")>s.lastIndexOf(".") ? s.replace(/\./g,"").replace(",",".") : s.replace(/,/g,"");
  else if (commas>1) s=s.replace(/,/g,"");
  else if (dots>1) s=s.replace(/\./g,"");
  else if (commas===1) {
    const [a,b]=s.split(",");
    s=b.length===3&&a.length<=3 ? a+b : a+"."+b;
  } else if (dots===1) {
    const [a,b]=s.split(".");
    s=b.length===3&&a.length<=3 ? a+b : s;
  }
  return Number(s);
}
function baseUrl() {
  const u=txt(Deno.env.get("SUPABASE_URL")).replace(/\/+$/,"");
  if (!u) throw Error("SUPABASE_URL_MISSING");
  return u;
}
function adminKey() {
  const a=txt(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  if (a) return a;
  try {
    const x=JSON.parse(txt(Deno.env.get("SUPABASE_SECRET_KEYS")));
    if (txt(x?.default)) return txt(x.default);
  } catch { /* none */ }
  throw Error("ADMIN_KEY_MISSING");
}
function authHeaders(more:Record<string,string>={}) {
  const a=adminKey();
  return {apikey:a,...(a.startsWith("sb_secret_") ? {} : {Authorization:"Bearer "+a}),...more};
}
async function rpc(fn:string,payload:Row) {
  const r=await fetch(baseUrl()+"/rest/v1/rpc/"+fn,{
    method:"POST",headers:authHeaders({"Content-Type":"application/json"}),
    body:JSON.stringify(payload)
  });
  const t=await r.text();let data:any;
  try {data=JSON.parse(t)} catch {data=t}
  if(!r.ok) throw Error(fn+"_HTTP_"+r.status+":"+t.slice(0,350));
  return data;
}
async function tableRows() {
  // Count-only safety check: the former GET body was never consumed.
  const cnt=await fetch(baseUrl()+"/rest/v1/insumos?source_dataset=eq.insumos&select=id",{
    method:"HEAD",headers:authHeaders({Prefer:"count=exact"})
  });
  if(!cnt.ok) throw Error("DEST_COUNT_"+cnt.status);
  return Number((cnt.headers.get("content-range")||"").split("/")[1]||0);
}
async function health() {
  const r=await fetch(baseUrl()+"/rest/v1/sheet_sync_health?dataset=eq.insumos&select=*",{
    headers:authHeaders({Accept:"application/json"})
  });
  if(!r.ok)throw Error("HEALTH_READ_"+r.status);
  return (await r.json())?.[0]||null;
}
async function saveHealth(o:Row) {
  const r=await fetch(baseUrl()+"/rest/v1/sheet_sync_health?on_conflict=dataset",{
    method:"POST",headers:authHeaders({"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"}),
    body:JSON.stringify([{dataset:DATASET,...o,updated_at:new Date().toISOString()}])
  });
  if(!r.ok)throw Error("HEALTH_WRITE_"+r.status+":"+(await r.text()).slice(0,250));
}
async function fetchSource() {
  const url=new URL(SOURCE_URL);
  url.searchParams.set("action","insumos");
  url.searchParams.set("limit","all");
  url.searchParams.set("force","1");
  url.searchParams.set("compact","0");
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),50000);
  try {
    const r=await fetch(url.toString(),{signal:c.signal,redirect:"follow",headers:{Accept:"application/json,text/plain,*/*"},cache:"no-store"});
    if(!r.ok) throw Error("SHEET_HTTP_"+r.status);
    const body=await r.json();
    if(!body?.ok||!Array.isArray(body.data))throw Error("SHEET_INVALID_RESPONSE");
    if(keyNorm(body?.meta?.sheetNameUsed)!=="hoja 1")throw Error("WRONG_SHEET_BLOCKED");
    return body;
  } finally {clearTimeout(timer)}
}
function transform(source:any) {
  const raw=source.data as Row[];
  const headerRow=Number(source.meta.headerRow||1);
  const lastRow=Number(source.meta.lastRow||0);
  if(headerRow!==1)throw Error("HEADER_ROW_MISMATCH");
  // No guessing missing source rows: fetchSheetData skips blanks.
  if(raw.length<1500 || raw.length>10000 || raw.length!==Number(source.meta.rows) || lastRow!==raw.length+1)
    throw Error("INCOMPLETE_SOURCE_BLOCKED:"+raw.length+"/"+source.meta.rows+"/"+lastRow);
  const codes=new Set<string>();
  const rows=raw.map((r:Row,i:number)=>{
    const codigo=codeNorm(pick(r,["Codigo","Código"]));
    const descripcion=txt(pick(r,["Descripcion","Descripción"]));
    const precio=amount(pick(r,["Precio unitario","Precio Unitario","Precio unitario con IVA"]));
    const extra=txt(pick(r,["Descripcion adicional","Descripción adicional"]));
    if(!codigo||codigo.length>70||!descripcion||!Number.isFinite(precio)||precio<=0)
      throw Error("INVALID_SOURCE_ROW_"+(i+2)+":"+codigo);
    if(codes.has(codigo))throw Error("DUPLICATE_CODE_BLOCKED:"+codigo);
    codes.add(codigo);
    return {source_row:i+2,codigo,descripcion,precio_unitario:String(precio),descripcion_adicional:extra,raw_data:r};
  });
  return rows;
}
const output=(o:Row,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
Deno.serve(async(req:Request)=>{
  const started=Date.now();
  let dryRun=false;
  try {
    if(req.method!=="POST")return output({ok:false,error:"METHOD_NOT_ALLOWED"},405);
    const token=txt(req.headers.get("x-delta-sync-token"));
    if(!token || await rpc("verify_rop02_sync_token",{p_token:token})!==true)
      return output({ok:false,error:"UNAUTHORIZED"},401);
    const payload=await req.json().catch(()=>({}));
    dryRun=payload?.dryRun===true;
    const s=await fetchSource();
    const rows=transform(s);
    const prevCount=await tableRows();
    if(prevCount>100 && rows.length<Math.floor(prevCount*0.9))
      throw Error("SUSPICIOUS_SOURCE_SHRINK_BLOCKED:"+rows.length+"/"+prevCount);
    const h=await health();
    const srcStamp=txt(s?.meta?.sourceModifiedAt);
    const previousStamp=txt(h?.details?.sourceModifiedAt);
    if(!dryRun && srcStamp && previousStamp===srcStamp && Number(h?.destination_rows)===rows.length && prevCount===rows.length)
      return output({ok:true,changed:false,dataset:DATASET,rows:rows.length,sourceModifiedAt:srcStamp,version:VERSION,durationMs:Date.now()-started});
    if(dryRun)
      return output({ok:true,dryRun:true,dataset:DATASET,rows:rows.length,destinationBefore:prevCount,sourceModifiedAt:srcStamp,version:VERSION,checkCodes:rows.filter(r=>["299","856","1054","1055","4175","4266"].includes(r.codigo)).map(r=>({codigo:r.codigo,precio:r.precio_unitario})),durationMs:Date.now()-started});
    const result=await rpc("sync_typed_dataset",{p_dataset:DATASET,p_rows:rows});
    const after=await tableRows();
    if(after!==rows.length) throw Error("POST_SYNC_COUNT_MISMATCH:"+after+"/"+rows.length);
    const now=new Date().toISOString();
    await saveHealth({last_attempt_at:now,last_success_at:now,last_error:"",consecutive_failures:0,source_rows:rows.length,destination_rows:after,duration_ms:Date.now()-started,details:{automatic:true,version:VERSION,sourceModifiedAt:srcStamp,serverVersion:s.meta?.serverVersion??null,result}});
    return output({ok:true,changed:true,dataset:DATASET,rows:rows.length,before:prevCount,after,sourceModifiedAt:srcStamp,version:VERSION,durationMs:Date.now()-started});
  }catch(e){
    const msg=e instanceof Error?e.message:String(e);
    if(!dryRun){
      try {
        const old=await health();
        await saveHealth({last_attempt_at:new Date().toISOString(),last_error:msg.slice(0,700),consecutive_failures:Number(old?.consecutive_failures||0)+1,duration_ms:Date.now()-started,details:{...(old?.details||{}),automatic:true,version:VERSION,lastFailureAt:new Date().toISOString()}});
      }catch{}
    }
    return output({ok:false,error:msg,dataset:DATASET,dryRun,version:VERSION,durationMs:Date.now()-started},500);
  }
});
