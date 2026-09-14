const APPS_SCRIPT_TARGET = "https://script.google.com/macros/s/AKfycbxU-ihsxXTNn2wa5EO1OkSM5FjJ43MwxSx8dY0RjbnJRFBKF0BiNNq7QsuohWxmmeOhog/exec";

export const config = {
  maxDuration: 60,
};

const RETRYABLE_STATUS = new Set([404, 429, 500, 502, 503, 504]);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function appendQuery(target, query = {}) {
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      value.forEach((item) => target.searchParams.append(key, String(item)));
    } else if (value !== undefined && value !== null) {
      target.searchParams.set(key, String(value));
    }
  }
}

function buildOptions(req, signal) {
  const options = {
    method: req.method,
    redirect: "follow",
    cache: "no-store",
    signal,
    headers: {
      accept: "application/json,text/plain,*/*",
    },
  };

  if (req.method === "POST") {
    const contentType = String(
      req.headers["content-type"] || "application/x-www-form-urlencoded;charset=UTF-8",
    );
    options.headers["content-type"] = contentType;

    if (typeof req.body === "string") {
      options.body = req.body;
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      options.body = new URLSearchParams(req.body || {}).toString();
    } else {
      options.body = JSON.stringify(req.body || {});
    }
  }

  return options;
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: { message: "Método no permitido" } });
  }

  const target = new URL(APPS_SCRIPT_TARGET);
  appendQuery(target, req.query || {});

  let lastStatus = 502;
  let lastBody = "";
  let lastContentType = "application/json; charset=utf-8";
  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 27000);

    try {
      const upstream = await fetch(target.toString(), buildOptions(req, controller.signal));
      const body = await upstream.text();
      const contentType = upstream.headers.get("content-type") || "application/json; charset=utf-8";

      lastStatus = upstream.status;
      lastBody = body;
      lastContentType = contentType;

      if (!RETRYABLE_STATUS.has(upstream.status) || attempt === 1) {
        res.setHeader("Cache-Control", "no-store, max-age=0");
        res.setHeader("Content-Type", contentType);
        res.setHeader("X-Delta-Upstream-Status", String(upstream.status));
        return res.status(upstream.status).send(body);
      }
    } catch (error) {
      lastError = error;
      if (attempt === 1) break;
    } finally {
      clearTimeout(timer);
    }

    await sleep(500);
  }

  if (lastBody) {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("Content-Type", lastContentType);
    res.setHeader("X-Delta-Upstream-Status", String(lastStatus));
    return res.status(lastStatus).send(lastBody);
  }

  const timedOut = lastError?.name === "AbortError";
  return res.status(timedOut ? 504 : 502).json({
    ok: false,
    error: {
      message: timedOut
        ? "Apps Script no respondió dentro del tiempo disponible"
        : String(lastError?.message || lastError || "No se pudo contactar Apps Script"),
    },
  });
}
