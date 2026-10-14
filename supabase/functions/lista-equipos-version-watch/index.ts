import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const VERSION = "2026-10-14-LISTA-EQUIPOS-WATCH-V2";
const DATASET = "lista_equipos";
const SOURCE_URL = "https://script.google.com/macros/s/AKfycbxU-ihsxXTNn2wa5EO1OkSM5FjJ43MwxSx8dY0RjbnJRFBKF0BiNNq7QsuohWxmmeOhog/exec";
const WORKER_URL = "https://jwfocqaxlckuxoklwyxs.supabase.co/functions/v1/lista-equipos-auto-sync";

const txt = (v: unknown) => v == null ? "" : String(v).trim();
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
function adminKey() {
  const a = txt(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  if (a) return a;
  const p = txt(Deno.env.get("SUPABASE_SECRET_KEYS"));
  if (p) {
    try {
      const j = JSON.parse(p);
      if (txt(j?.default)) return txt(j.default);
    } catch (_) {}
  }
  throw new Error("ADMIN_KEY_MISSING");
}
function baseUrl() {
  const u = txt(Deno.env.get("SUPABASE_URL")).replace(/\/+$/, "");
  if (!u) throw new Error("SUPABASE_URL_MISSING");
  return u;
}
function authHeaders(extra: Record<string, string> = {}) {
  const k = adminKey();
  return { apikey: k, ...(k.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${k}` }), ...extra };
}
async function metadataRequest(url:string,init:RequestInit) {
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),10000);
  try {
    const r=await fetch(url,{...init,signal:c.signal});
    const text=await r.text();
    if(!r.ok)throw Error("METADATA_HTTP_"+r.status);
    return text?JSON.parse(text):null;
  }finally{clearTimeout(timer);}
}
async function rpc(fn:string,payload:Record<string,unknown>){
  return metadataRequest(`${baseUrl()}/rest/v1/rpc/${fn}`,{method:"POST",headers:authHeaders({"Content-Type":"application/json"}),body:JSON.stringify(payload)});
}
async function getHealth(){
  const data=await metadataRequest(`${baseUrl()}/rest/v1/sheet_sync_health?dataset=eq.${DATASET}&select=server_version:details->>serverVersion,destination_rows`,{headers:authHeaders({Accept:"application/json"})});
  return Array.isArray(data)&&data[0]?data[0]:null;
}
async function getVersion() {
  const u = new URL(SOURCE_URL);
  u.searchParams.set("action", "versions");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const r = await fetch(u.toString(), { redirect: "follow", cache: "no-store", signal: controller.signal, headers: { Accept: "application/json,text/plain,*/*" } });
    const t = await r.text();
    if (!r.ok) throw new Error(`VERSIONS_${r.status}:${t.slice(0, 250)}`);
    const b = JSON.parse(t);
    const version = Number(b?.versions?.[DATASET] ?? b?.datasets?.[DATASET]?.version ?? 0);
    const updatedAt = txt(b?.updatedAt?.[DATASET] ?? b?.datasets?.[DATASET]?.updatedAt);
    if (!Number.isSafeInteger(version)||version<=0) throw new Error("VERSIONS_INVALID");
    return { version, updatedAt };
  } finally {
    clearTimeout(timer);
  }
}

let pendingWatch:Promise<any>|null=null;
async function inspectAndSync(token:string,started:number) {
    const current = await getVersion();
    const h = await getHealth();
    const stored = Number(h?.server_version ?? 0);
    if (stored === current.version && Number(h?.destination_rows || 0) > 0) {
      return ({ ok: true, changed: false, dataset: DATASET, serverVersion: current.version, sourceUpdatedAt: current.updatedAt, watchVersion: VERSION, durationMs: Date.now() - started });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 55000);
    try {
      const r = await fetch(WORKER_URL, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", "x-delta-sync-token": token },
        body: JSON.stringify({ source: "lista-equipos-version-watch", detectedVersion: current.version }),
      });
      const t = await r.text();
      let b: any = null;
      try { b = t ? JSON.parse(t) : null; } catch (_) { b = t; }
      if (!r.ok) throw new Error(`WORKER_HTTP_${r.status}`);
      if (b?.ok !== true) throw new Error("WORKER_UNCONFIRMED");
      return ({ ok: true, changed: b.changed !== false, dataset: DATASET, detectedVersion: current.version, sourceUpdatedAt: current.updatedAt, worker: b, watchVersion: VERSION, durationMs: Date.now() - started });
    } finally {
      clearTimeout(timer);
    }
}
Deno.serve(async (req:Request) => {
  const started=Date.now();
  try {
    if(req.method!=="POST")return json({ok:false,error:"METHOD_NOT_ALLOWED",version:VERSION},405);
    const token=txt(req.headers.get("x-delta-sync-token"));
    if(!token||await rpc("verify_rop02_sync_token",{p_token:token})!==true)return json({ok:false,error:"UNAUTHORIZED",version:VERSION},401);
    // Coalesce only concurrent checks in this isolate, never settled versions or auth.
    if(!pendingWatch){
      const task=inspectAndSync(token,started).finally(()=>{if(pendingWatch===task)pendingWatch=null;});
      pendingWatch=task;
    }
    return json(await pendingWatch);
  }catch(error){
    const timeout=error instanceof Error&&error.name==="AbortError";
    return json({ok:false,error:timeout?"WATCH_TIMEOUT":error instanceof Error?error.message:"WATCH_ERROR",retryAutomatically:false,dataset:DATASET,watchVersion:VERSION,durationMs:Date.now()-started},timeout?504:500);
  }
});
