// V9 pilot: read-only, protected by the EXISTING Delta OPS session.
// Supabase validates the session and roles in public.dm_v9_ops_session_read_v1.
// No service-role key, no extra login, no ROP05 writes.
export const config = { maxDuration: 30 };

const DB_REF = "jwfocqaxlckuxoklwyxs";
const PUBLIC_KEY_FALLBACK = "sb_publishable_XZAcQcWEDdgtZY_NWADy1g_HxoV0UZ2";
const GATES = new Set([
  "", "BLOCKED_CLOSURE_UNCONFIRMED", "BLOCKED_SOURCE_DRIFT",
  "BLOCKED_LEGACY_REVIEW", "BLOCKED_NUMERIC_ANOMALY",
  "BLOCKED_PRODUCTIVITY_PENDING", "BLOCKED_UNLINKED",
  "BLOCKED_SNAPSHOT_STALE"
]);

function fail(res, status, error) {
  return res.status(status).json({ ok: false, error });
}

function readBody(req) {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) return {};
  return req.body;
}

async function safeJson(response) {
  const data = await response.text();
  if (data.length > 250000) throw new Error("RESPONSE_TOO_LARGE");
  try { return data ? JSON.parse(data) : null; }
  catch { throw new Error("INVALID_UPSTREAM_JSON"); }
}

function validDatabaseUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === `${DB_REF}.supabase.co`
      && (url.pathname === "/" || url.pathname === "")
      && !url.search && !url.hash ? url.origin : null;
  } catch { return null; }
}

async function gasHealth(res) {
  const raw = String(process.env.DELTA_V9_GAS_URL || "");
  let url;
  try {
    url = new URL(raw);
    if (url.protocol !== "https:" || url.hostname !== "script.google.com" ||
      !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)) throw new Error("BAD_URL");
  } catch { return fail(res, 503, "V9_GAS_NOT_CONFIGURED"); }
  url.searchParams.set("action", "health");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url.toString(), { method: "GET", redirect: "follow", cache: "no-store", signal: controller.signal });
    if (!response.ok) return fail(res, 502, "V9_GAS_HEALTH_UNAVAILABLE");
    const data = await safeJson(response);
    if (!data || typeof data !== "object") return fail(res, 502, "V9_GAS_INVALID_REPLY");
    return res.status(200).json({
      ok: data.ok === true,
      mode: String(data.mode || data.module || "health").slice(0, 60),
      note: "Apps Script V9 de pruebas, solo diagnóstico"
    });
  } catch (e) { return fail(res, 502, e?.name === "AbortError" ? "V9_GAS_TIMEOUT" : "V9_GAS_UNAVAILABLE"); }
  finally { clearTimeout(timer); }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return fail(res, 405, "METHOD_NOT_ALLOWED");
  }

  const token = req.headers["x-delta-auth-token"];
  if (typeof token !== "string" || token.length < 24 || token.length > 512)
    return fail(res, 401, "V9_SESSION_REQUIRED");

  const body = readBody(req);
  if (!["preview", "gas-health"].includes(body.mode)) return fail(res, 400, "UNSUPPORTED_V9_ACTION");
  const limit = body.mode === "gas-health" ? 1 : Number(body.limit ?? 20);
  const after = body.mode === "gas-health" ? "" : String(body.after ?? "");
  const gate = body.mode === "gas-health" ? "" : String(body.gate ?? "");
  if (!Number.isInteger(limit) || limit < 1 || limit > 50 ||
    !/^[A-Za-z0-9:_-]{0,150}$/.test(after) || !GATES.has(gate)) return fail(res, 400, "INVALID_V9_FILTER");

  const url = validDatabaseUrl(process.env.DELTA_V9_SUPABASE_URL || `https://${DB_REF}.supabase.co`);
  const key = String(process.env.DELTA_V9_SUPABASE_PUBLISHABLE_KEY || PUBLIC_KEY_FALLBACK);
  if (!url || !/^sb_publishable_[A-Za-z0-9_-]{15,}$/.test(key))
    return fail(res, 503, "V9_PUBLIC_BACKEND_NOT_CONFIGURED");

  // Optional V8.1 signature bridge. Both variables MUST be configured for
  // this branch only; no partial fallback if either one is present.
  const bridgeRaw = String(process.env.DELTA_V9_AUTH_BRIDGE_URL || "");
  const serviceKey = String(process.env.DELTA_V9_SUPABASE_SERVICE_KEY || "");
  const bridgeRequested = Boolean(bridgeRaw || serviceKey);
  let bridgeUrl = null;
  if (bridgeRequested) {
    try {
      const u = new URL(bridgeRaw);
      if (u.protocol !== "https:" || u.hostname !== "script.google.com" ||
          !new RegExp("^/macros/s/[A-Za-z0-9_-]+/exec$").test(u.pathname) ||
          u.search || u.hash || !/^sb_secret_[A-Za-z0-9_-]{25,}$/.test(serviceKey)) throw new Error();
      bridgeUrl = u.toString();
    } catch {
      return fail(res, 503, "V9_AUTH_BRIDGE_INCOMPLETE");
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 24000);
  try {
    if (bridgeRequested) {
      // The URL must be a *new deployment of the SAME Apps Script project* that
      // minted the user's HMAC token, with the v9_validate_existing_session action.
      // A separate Apps Script copy cannot verify that token.
      const form = new URLSearchParams({ payload: JSON.stringify({
        action: "v9_validate_existing_session", authToken: token
      }) });
      const checked = await fetch(bridgeUrl, {
        method: "POST", cache: "no-store", redirect: "follow",
        signal: controller.signal,
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: form.toString()
      });
      if (!checked.ok) return fail(res, 502, "V9_AUTH_BRIDGE_HTTP_FAILED");
      const proof = await safeJson(checked);
      if (!proof || proof.ok !== true || proof.mode !== "V9_SIGNED_SESSION_VALIDATED")
        return fail(res, 401, "V9_SESSION_REJECTED");
    }
    const queryKey = bridgeRequested ? serviceKey : key;
    const rpc = bridgeRequested ? "dm_v9_ops_read_v1" : "dm_v9_ops_session_read_v1";
    const requestBody = bridgeRequested
      ? { p_limit: limit, p_after: after, p_gate: gate }
      : { p_auth_token: token, p_limit: limit, p_after: after, p_gate: gate };
    const response = await fetch(`${url}/rest/v1/rpc/${rpc}`, {
      method: "POST", cache: "no-store", signal: controller.signal,
      headers: {
        apikey: queryKey, Authorization: `Bearer ${queryKey}`,
        "Content-Type": "application/json", Accept: "application/json"
      },
      body: JSON.stringify(requestBody)
    });
    if (response.status === 401 || response.status === 403)
      return fail(res, 401, "V9_SESSION_REJECTED");
    if (!response.ok) {
      const upstream = await safeJson(response).catch(() => ({}));
      const msg = String(upstream?.message || "");
      if (/V9_PERMISSION_DENIED|V9_PASSWORD_CHANGE_REQUIRED/i.test(msg))
        return fail(res, 403, "V9_PERMISSION_DENIED");
      if (/V9_SESSION_REQUIRED|Sesión inválida|Sesión requerida/i.test(msg))
        return fail(res, 401, "V9_SESSION_REJECTED");
      return fail(res, 502, "V9_BACKEND_READ_FAILED");
    }
    const data = await safeJson(response);
    if (!data || data.ok !== true || data.mode !== "V9_READ_ONLY" || !Array.isArray(data.rows))
      return fail(res, 502, "V9_BACKEND_CONTRACT_MISMATCH");
    if (body.mode === "gas-health") return gasHealth(res);
    return res.status(200).json(data);
  } catch (error) {
    return fail(res, error?.name === "AbortError" ? 504 : 502,
      error?.name === "AbortError" ? "V9_BACKEND_TIMEOUT" : "V9_BACKEND_UNAVAILABLE");
  } finally { clearTimeout(timer); }
}
