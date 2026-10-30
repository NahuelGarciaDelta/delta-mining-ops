import { timingSafeEqual } from "node:crypto";

export const config = { maxDuration: 30 };

const DB_REF = "jwfocqaxlckuxoklwyxs";
const GATES = new Set([
  "", "BLOCKED_CLOSURE_UNCONFIRMED", "BLOCKED_SOURCE_DRIFT",
  "BLOCKED_LEGACY_REVIEW", "BLOCKED_NUMERIC_ANOMALY",
  "BLOCKED_PRODUCTIVITY_PENDING", "BLOCKED_UNLINKED",
  "BLOCKED_SNAPSHOT_STALE"
]);

function secretMatches(candidate, configured) {
  if (typeof candidate !== "string" || typeof configured !== "string" || configured.length < 24) return false;
  const a = Buffer.from(candidate, "utf8");
  const b = Buffer.from(configured, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function fail(res, status, message) {
  return res.status(status).json({ ok: false, error: message });
}

function validDatabaseUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && u.hostname === `${DB_REF}.supabase.co`
      && (u.pathname === "/" || u.pathname === "") && !u.search && !u.hash
      ? u.origin : null;
  } catch { return null; }
}

async function safeJson(res) {
  const text = await res.text();
  if (text.length > 250000) throw new Error("UPSTREAM_RESPONSE_TOO_LARGE");
  try { return text ? JSON.parse(text) : null; } catch { throw new Error("UPSTREAM_RESPONSE_INVALID"); }
}

async function gasHealth(res) {
  const raw = String(process.env.DELTA_V9_GAS_URL || "");
  let u;
  try {
    u = new URL(raw);
    if (u.protocol !== "https:" || u.hostname !== "script.google.com" ||
        !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u.pathname)) throw new Error();
  } catch { return fail(res, 503, "V9_GAS_NOT_CONFIGURED"); }
  u.searchParams.set("action", "health");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(u.toString(), { method: "GET", redirect: "follow", cache: "no-store", signal: controller.signal });
    if (!response.ok) return fail(res, 502, "V9_GAS_HEALTH_HTTP_" + response.status);
    const result = await safeJson(response);
    if (!result || typeof result !== "object") return fail(res, 502, "V9_GAS_HEALTH_INVALID");
    return res.status(200).json({
      ok: result.ok === true,
      connected: true,
      mode: String(result.mode || result.module || "health").slice(0, 60),
      // Nunca reenviar payloads operativos, credenciales ni datos del script.
      note: "Apps Script V9 de pruebas; diagnóstico de lectura únicamente"
    });
  } catch (e) {
    return fail(res, 502, e?.name === "AbortError" ? "V9_GAS_TIMEOUT" : "V9_GAS_UNAVAILABLE");
  } finally { clearTimeout(timer); }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return fail(res, 405, "METHOD_NOT_ALLOWED");
  }
  const token = process.env.DELTA_V9_ADMIN_TOKEN;
  if (!token || token.length < 24) return fail(res, 503, "V9_ADMIN_TOKEN_NOT_CONFIGURED");
  if (!secretMatches(req.headers["x-delta-v9-admin-token"], token)) return fail(res, 401, "V9_UNAUTHORIZED");

  const body = typeof req.body === "object" && req.body && !Array.isArray(req.body) ? req.body : {};
  if (body.mode === "gas-health") return gasHealth(res);
  if (body.mode !== "preview") return fail(res, 400, "UNSUPPORTED_V9_ACTION");

  const limit = Number(body.limit ?? 20);
  const after = String(body.after ?? "");
  const gate = String(body.gate ?? "");
  if (!Number.isInteger(limit) || limit < 1 || limit > 50 ||
      !/^[A-Za-z0-9:_-]{0,150}$/.test(after) || !GATES.has(gate)) {
    return fail(res, 400, "INVALID_V9_FILTER");
  }

  const url = validDatabaseUrl(process.env.DELTA_V9_SUPABASE_URL || `https://${DB_REF}.supabase.co`);
  const key = String(process.env.DELTA_V9_SUPABASE_SERVICE_KEY || "");
  if (!url || !key || key.startsWith("sb_publishable_") || key.length < 30)
    return fail(res, 503, "V9_SUPABASE_SERVER_NOT_CONFIGURED");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 24000);
  try {
    const response = await fetch(`${url}/rest/v1/rpc/dm_v9_ops_read_v1`, {
      method: "POST", cache: "no-store", signal: controller.signal,
      headers: {
        apikey: key, Authorization: `Bearer ${key}`,
        "Content-Type": "application/json", Accept: "application/json"
      },
      body: JSON.stringify({ p_limit: limit, p_after: after, p_gate: gate })
    });
    if (!response.ok) return fail(res, 502, "V9_SUPABASE_READ_FAILED_" + response.status);
    const data = await safeJson(response);
    if (!data || data.ok !== true || data.mode !== "V9_READ_ONLY" || !Array.isArray(data.rows))
      return fail(res, 502, "V9_SUPABASE_CONTRACT_MISMATCH");
    return res.status(200).json(data);
  } catch (error) {
    return fail(res, error?.name === "AbortError" ? 504 : 502,
      error?.name === "AbortError" ? "V9_SUPABASE_TIMEOUT" : "V9_BACKEND_UNAVAILABLE");
  } finally { clearTimeout(timer); }
}
