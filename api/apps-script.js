const APPS_SCRIPT_TARGET = "https://script.google.com/macros/s/AKfycbxU-ihsxXTNn2wa5EO1OkSM5FjJ43MwxSx8dY0RjbnJRFBKF0BiNNq7QsuohWxmmeOhog/exec";

export const config = {
  maxDuration: 60,
};

const RETRYABLE_STATUS = new Set([404, 429, 500, 502, 503]);
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

function sendUpstream(res, status, body, contentType, attempt) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", contentType || "application/json; charset=utf-8");
  res.setHeader("X-Delta-Upstream-Status", String(status));
  res.setHeader("X-Delta-Proxy-Attempt", String(attempt + 1));
  return res.status(status).send(body);
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: { message: "Método no permitido" } });
  }

  const target = new URL(APPS_SCRIPT_TARGET);
  const query = { ...(req.query || {}) };

  // RABA03 tiene a Google Sheet como fuente de verdad. Nunca permitir que una
  // respuesta vieja del CacheService del Apps Script sobreviva a una edición,
  // alta o baja hecha directamente sobre la hoja.
  if (req.method === "GET" && String(query.action || "").trim().toLowerCase() === "raba03") {
    query.force = "1";
    query.limit = "all";
  }
  appendQuery(target, query);

  // GET puede reintentarse una vez únicamente ante un HTTP transitorio que volvió
  // rápido. POST jamás se reintenta: repetir una escritura podría duplicarla.
  const maxAttempts = req.method === "GET" ? 2 : 1;
  let lastStatus = 502;
  let lastBody = "";
  let lastContentType = "application/json; charset=utf-8";
  let lastError = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    // Un único intento largo, pero siempre por debajo del timeout del cliente ROP02.
    // Si expira NO se lanza otro intento de 27 s que prolongue artificialmente la espera.
    const timer = setTimeout(() => controller.abort(), 40000);

    try {
      const upstream = await fetch(target.toString(), buildOptions(req, controller.signal));
      const body = await upstream.text();
      const contentType = upstream.headers.get("content-type") || "application/json; charset=utf-8";

      lastStatus = upstream.status;
      lastBody = body;
      lastContentType = contentType;

      if (!RETRYABLE_STATUS.has(upstream.status) || attempt === maxAttempts - 1) {
        return sendUpstream(res, upstream.status, body, contentType, attempt);
      }
    } catch (error) {
      lastError = error;
      // Un timeout ya consumió el presupuesto útil. No repetir una ejecución lenta.
      if (error?.name === "AbortError" || attempt === maxAttempts - 1) break;
    } finally {
      clearTimeout(timer);
    }

    await sleep(300);
  }

  if (lastBody) {
    return sendUpstream(res, lastStatus, lastBody, lastContentType, maxAttempts - 1);
  }

  const timedOut = lastError?.name === "AbortError";
  res.setHeader("Cache-Control", "no-store, max-age=0");
  return res.status(timedOut ? 504 : 502).json({
    ok: false,
    error: {
      message: timedOut
        ? "Apps Script no respondió dentro de 40 segundos"
        : String(lastError?.message || lastError || "No se pudo contactar Apps Script"),
    },
  });
}
