// Optional LOCAL mixed integration: real copy auth/meter, simulated operational reads.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { sha256 } from "./apps-script-audit.mjs";
import { validateCopyEndpoint } from "./probe-apps-script-copies.mjs";

const sources = [
  "lista_equipos",
  "rop02_jm",
  "rop02_fs",
  "rop02_filosur",
  "rop02_zorro",
  "rop05",
  "rma15_fs",
  "rma15_jm",
  "insumos"
];
export function createCopyFrontendMiddleware({ postCopy, fixtureTarget, date = "2026-10-14" }) {
  const stamp = new Date().toISOString();
  const rop = {
    fecha: date,
    interno: "CTA-0530",
    equipo: "Camioneta con mochila",
    proyecto: "JOSE MARIA",
    turno_trabajo: "TD",
    numero_parte: 1,
    horometro_inicial: fixtureTarget - 1,
    horometro_final: fixtureTarget,
    cantidad_horas: 1,
    descripcion_trabajos: "Fixture de integración en copias",
    estado: "TRABAJO",
    source_key: "SRC|ROP02_JM|2",
    synced_at: stamp
  };
  return async (req, res, next) => {
    const url = new URL(req.url, "http://127.0.0.1");
    res.setHeader("Content-Security-Policy", "connect-src 'self' ws://127.0.0.1:5176");
    if (!url.pathname.startsWith("/api/")) return next();
    function send(json, headers = {}) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");
      for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
      res.end(JSON.stringify(json));
    }
    try {
      if (url.pathname === "/api/apps-script") {
        if (req.method === "POST") {
          let raw = "";
          for await (const chunk of req) {
            raw += chunk;
            if (raw.length > 1048576) throw new Error("Payload demasiado grande");
          }
          const payload = JSON.parse(new URLSearchParams(raw).get("payload") || "{}");
          if (
            ![
              "authenticate_user",
              "update_user_profile",
              "update_lista_horometros",
              "verify_lista_horometros"
            ].includes(payload.action)
          )
            return send({
              ok: false,
              error: { code: "COPY_ACTION_BLOCKED", message: "Acción fuera de la integración autorizada." }
            });
          return send(await postCopy(payload));
        }
        const action = url.searchParams.get("action");
        if (action === "lista_equipos") return send(await postCopy({ action: "copy_read_lista" }));
        if (["query_dataset", "rop02_jm"].includes(action))
          return send({
            ok: true,
            data: [
              {
                Fecha: date,
                Interno: "CTA-0530",
                Proyecto: "JOSE MARIA",
                "Horómetro inicial": fixtureTarget - 1,
                "Horómetro final": fixtureTarget,
                HI: fixtureTarget - 1,
                HF: fixtureTarget,
                Turno: "TD",
                "N° Parte": 1,
                Estado: "TRABAJO"
              }
            ],
            total: 1,
            hasMore: false,
            versions: { rop02_jm: 1 }
          });
        return send({
          ok: true,
          data: [],
          versions: Object.fromEntries(sources.map((source) => [source, 1])),
          rowCounts: Object.fromEntries(
            sources.map((source) => [source, ["lista_equipos", "rop02_jm"].includes(source) ? 1 : 0])
          )
        });
      }
      if (url.pathname === "/api/supabase-read") {
        const target = url.searchParams.get("target") || "";
        let rows = [];
        if (target.startsWith("/rest/v1/lista_equipos")) {
          const result = await postCopy({ action: "copy_read_lista" });
          if (!result.ok) return send(result);
          rows = result.data.map((row) => ({
            raw_data: row,
            codigo_nuevo: result.identity.codigoNuevo,
            codigo_drusila: result.identity.codigoDrusila,
            source_dataset: "lista_equipos",
            source_row: result.rowNumber,
            synced_at: stamp
          }));
        } else if (target.startsWith("/rest/v1/rpc/delta_source_versions"))
          rows = sources.map((source) => ({
            source_key: source,
            server_version: Date.parse(stamp),
            rows: ["lista_equipos", "rop02_jm"].includes(source) ? 1 : 0
          }));
        else if (target.startsWith("/rest/v1/rpc/rop02_latest_by_equipment_project"))
          rows = [
            {
              INTERNO: "CTA-0530",
              PROYECTO: "JOSE MARIA",
              ULTIMA_FECHA: date,
              ULTIMO_ESTADO: "TRABAJO",
              HOROMETRO_FINAL: fixtureTarget
            }
          ];
        else if (
          target.startsWith("/rest/v1/rop02") &&
          (!target.includes("source_key=") || target.includes("ROP02_JM"))
        )
          rows = [rop];
        return send(rows, {
          "Content-Range": rows.length ? "0-" + (rows.length - 1) + "/" + rows.length : "*/0",
          "X-Delta-Copy-Integration": "operational-reads-simulated"
        });
      }
      return send({
        ok: false,
        error: { code: "COPY_ENDPOINT_BLOCKED", message: "Endpoint bloqueado en esta prueba." }
      });
    } catch {
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          ok: false,
          error: {
            code: "COPY_PROXY_ERROR",
            message: "No se pudo confirmar la respuesta del sandbox. Revisar acceso y conservar el ID de operación."
          }
        })
      );
    }
  };
}
export async function startCopyFrontend({ endpoint, expectedScriptId, testKey, request = fetch }) {
  const root = fileURLToPath(new URL("..", import.meta.url)),
    production = fs
      .readFileSync(new URL("../api/apps-script.js", import.meta.url), "utf8")
      .match(/https:\/\/script\.google\.com\/macros\/s\/[^"\s]+\/exec/)[0];
  const url = validateCopyEndpoint(endpoint, production),
    parentHash = sha256(fs.readFileSync(new URL("../AppsScript_Delta_Mining_OPS_FINAL.txt", import.meta.url)));
  if (!testKey || testKey.length < 32 || /^(GENERAR|REEMPLAZAR)/.test(testKey))
    throw new Error("Falta la clave privada de pruebas DELTA_COPY_TEST_KEY.");
  if (!expectedScriptId) throw new Error("Falta el ID del proyecto de copias.");
  async function postCopy(payload) {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await request(url, {
        method: "POST",
        redirect: "follow",
        signal: controller.signal,
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: new URLSearchParams({ payload: JSON.stringify({ ...payload, testKey }) })
      });
      if (!response.ok) throw new Error("Sandbox HTTP " + response.status);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }
  const status = await postCopy({ action: "copy_test_status" });
  if (
    !status.ok ||
    status.copyOnly !== true ||
    status.scriptId !== expectedScriptId ||
    status.sourceSha256 !== parentHash
  )
    throw new Error("El sandbox no coincide: el servidor no se inició.");
  const fixtureTarget = Number(status.report?.current?.meterValue) + 1;
  if (!Number.isFinite(fixtureTarget)) throw new Error("La lectura del sandbox no es numérica.");
  const middleware = createCopyFrontendMiddleware({ postCopy, fixtureTarget });
  const vite = await createServer({
    root,
    server: { host: "127.0.0.1", port: 5176, strictPort: true },
    plugins: [
      {
        name: "copy-only-integration",
        configureServer(server) {
          server.middlewares.use(middleware);
        },
        transformIndexHtml(html) {
          return html.replace(
            "<body>",
            '<body><div style="position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#ffdb6e;color:#111;font:12px sans-serif;padding:6px;text-align:center">PRUEBA EN COPIAS: autenticación y horómetros en Google; ROP02 y otras lecturas simuladas. Sin conexiones a Supabase.</div>'
          );
        }
      }
    ]
  });
  await vite.listen();
  return { vite, fixtureEmail: status.report.fixtureEmail };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const { vite, fixtureEmail } = await startCopyFrontend({
    endpoint: process.argv[2],
    expectedScriptId: process.argv[3],
    testKey: process.env.DELTA_COPY_TEST_KEY
  });
  console.log(
    JSON.stringify({
      port: 5176,
      fixtureEmail,
      mode: "Mixed integration: real copy writes; simulated ROP02/operational reads; CSP blocks external browser connections"
    })
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, async () => {
      await vite.close();
      process.exit(0);
    });
}
