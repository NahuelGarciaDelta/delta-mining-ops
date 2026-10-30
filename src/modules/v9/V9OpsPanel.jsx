import React, { useCallback, useMemo, useState } from "react";

const FILTERS = [
  ["", "Todos"],
  ["BLOCKED_CLOSURE_UNCONFIRMED", "Pendientes de criterio de publicación"],
  ["BLOCKED_SOURCE_DRIFT", "Fila desplazada / cambio de identidad"],
  ["BLOCKED_LEGACY_REVIEW", "Revisión de productividad heredada"],
  ["BLOCKED_NUMERIC_ANOMALY", "Anomalía numérica"],
  ["BLOCKED_PRODUCTIVITY_PENDING", "Productividad pendiente"],
  ["BLOCKED_UNLINKED", "Sin contraparte en ROP05"],
  ["BLOCKED_SNAPSHOT_STALE", "Snapshot desactualizado"]
];

const SHORT_LABELS = {
  BLOCKED_CLOSURE_UNCONFIRMED: "Cierre pendiente",
  BLOCKED_SOURCE_DRIFT: "Identidad desplazada",
  BLOCKED_LEGACY_REVIEW: "Revisión heredada",
  BLOCKED_NUMERIC_ANOMALY: "Anomalía numérica",
  BLOCKED_PRODUCTIVITY_PENDING: "Productividad pendiente",
  BLOCKED_UNLINKED: "Sin contraparte",
  BLOCKED_SNAPSHOT_STALE: "Datos desactualizados"
};

function humanDate(value) {
  const date = Date.parse(value || "");
  return Number.isFinite(date) ? new Date(date).toLocaleString("es-AR") : "—";
}

async function readV9(token, payload) {
  const response = await fetch("/api/v9-ops", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Delta-V9-Admin-Token": token
    },
    body: JSON.stringify(payload)
  });
  let result;
  try { result = await response.json(); }
  catch { throw new Error("V9 devolvió una respuesta no válida."); }
  if (!response.ok || result?.ok !== true) {
    const code = String(result?.error || "V9_UNAVAILABLE");
    const errors = {
      V9_UNAUTHORIZED: "Acceso técnico incorrecto.",
      V9_ADMIN_TOKEN_NOT_CONFIGURED: "Falta configurar la credencial de lectura V9 en Vercel.",
      V9_SUPABASE_SERVER_NOT_CONFIGURED: "Falta configurar la conexión privada a Supabase.",
      V9_GAS_NOT_CONFIGURED: "El Apps Script V9 de pruebas todavía no tiene una URL configurada."
    };
    const error = new Error(errors[code] || `No se pudo consultar V9 (${code}).`);
    error.code = code;
    throw error;
  }
  return result;
}

export default function V9OpsPanel({ C = {} }) {
  const [credential, setCredential] = useState("");
  const [activeCredential, setActiveCredential] = useState("");
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("");
  const [pageHistory, setPageHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [gasHealth, setGasHealth] = useState(null);
  const [gasBusy, setGasBusy] = useState(false);
  const surface = C.surface || "#1b2530";
  const border = C.border || "#394956";
  const text = C.text || "#f1f5f9";
  const secondary = C.textSub || "#a9b8c7";
  const accent = C.accent || "#3f93cf";
  const styleCard = { background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: 18 };

  const load = useCallback(async (secret, gate = "", history = []) => {
    if (!secret) { setError("Ingresá la clave técnica de V9."); return; }
    setBusy(true);
    setError("");
    try {
      const after = history.length ? history[history.length - 1] : "";
      const next = await readV9(secret, { mode: "preview", after, gate, limit: 20 });
      setData(next);
      setActiveCredential(secret);
      setPageHistory(history);
      setGasHealth(null);
    } catch (e) {
      setError(e.message || "No se pudo obtener el estado.");
      if (e.code === "V9_UNAUTHORIZED") {
        setActiveCredential("");
        setData(null);
      }
    } finally { setBusy(false); }
  }, []);

  const counters = useMemo(() => Object.entries(data?.counts || {})
    .sort((a, b) => b[1] - a[1]), [data]);
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const hasNext = rows.length === 20;
  const nextAfter = rows.length ? String(rows[rows.length - 1].task_key || "") : "";
  const total = Number(data?.total || 0);

  const inspectGas = async () => {
    if (!activeCredential) return;
    setGasBusy(true);
    setGasHealth(null);
    try {
      setGasHealth(await readV9(activeCredential, { mode: "gas-health" }));
    } catch (e) { setGasHealth({ ok: false, message: e.message }); }
    finally { setGasBusy(false); }
  };

  return (
    <section style={{ display: "grid", gap: 18, color: text, width: "100%", maxWidth: 1440, margin: "0 auto" }}>
      <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 23 }}>Delta Mining OPS · V9</h2>
          <p style={{ margin: "5px 0 0", fontSize: 13, color: secondary }}>
            Piloto de lectura: Supabase delta_v9 + Apps Script de pruebas
          </p>
        </div>
        <span style={{ padding: "7px 11px", border: `1px solid ${border}`, borderRadius: 999, fontSize: 12 }}>
          SIN PUBLICACIONES · V8.1 SIGUE OPERATIVO
        </span>
      </header>

      <div style={styleCard}>
        <strong>Conexión técnica</strong>
        <p style={{ fontSize: 12, color: secondary, margin: "8px 0 14px" }}>
          La clave se conserva solo en memoria mientras esta pantalla permanece abierta.
          No se guarda en el navegador ni se envía a Apps Script. La API de Vercel consulta
          Supabase desde el servidor, sin exponer su clave privada.
        </p>
        <form onSubmit={e => { e.preventDefault(); load(credential || activeCredential); }}
              style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          <input aria-label="Clave técnica V9" type="password" autoComplete="off"
            value={credential} onChange={e => setCredential(e.target.value)}
            placeholder="Clave de acceso técnico V9"
            style={{ flex: "1 1 220px", background: "transparent", color: text, border: `1px solid ${border}`, borderRadius: 8, padding: "10px 12px" }} />
          <button type="submit" disabled={busy || !(credential || activeCredential)}
            style={{ cursor: "pointer", color: "#fff", background: accent, border: "none", borderRadius: 8, padding: "10px 18px" }}>
            {busy ? "Consultando..." : data ? "Actualizar" : "Conectar"}
          </button>
          {data && <button type="button" onClick={() => { setActiveCredential(""); setCredential(""); setData(null); setError(""); setPageHistory([]); setGasHealth(null); }}
            style={{ cursor: "pointer", color: text, background: "transparent", border: `1px solid ${border}`, borderRadius: 8, padding: "10px" }}>
            Desconectar
          </button>}
        </form>
        {error && <p role="alert" style={{ color: "#ffb0a7", fontSize: 13, marginBottom: 0 }}>{error}</p>}
      </div>

      {data && <>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ ...styleCard, flex: "1 1 180px" }}>
            <div style={{ color: secondary, fontSize: 12 }}>Identidades V9</div>
            <div style={{ fontSize: 30, fontWeight: 750 }}>{total.toLocaleString("es-AR")}</div>
          </div>
          <div style={{ ...styleCard, flex: "1 1 180px" }}>
            <div style={{ color: secondary, fontSize: 12 }}>Publicaciones habilitadas</div>
            <div style={{ fontSize: 30, fontWeight: 750 }}>0</div>
          </div>
          <div style={{ ...styleCard, flex: "1 1 180px" }}>
            <div style={{ color: secondary, fontSize: 12 }}>ACK operativos</div>
            <div style={{ fontSize: 30, fontWeight: 750 }}>0</div>
          </div>
        </div>

        <div style={styleCard}>
          <h3 style={{ margin: "0 0 14px" }}>Estado de conciliación y publicación</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(205px, 1fr))", gap: 10 }}>
            {counters.map(([key, count]) => (
              <div key={key} style={{ padding: 12, borderRadius: 8, border: `1px solid ${border}` }}>
                <div style={{ fontSize: 12, color: secondary }}>{SHORT_LABELS[key] || key}</div>
                <strong style={{ fontSize: 24 }}>{Number(count).toLocaleString("es-AR")}</strong>
              </div>
            ))}
          </div>
          <p style={{ color: secondary, fontSize: 12, marginBottom: 0 }}>
            Corte de lectura: {humanDate(data.last_preview_generated_at)}. Los registros nuevos de V8.1
            pueden desplazar las filas; V9 bloquea esos vínculos hasta volver a conciliarlos.
          </p>
        </div>

        <div style={styleCard}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Tareas ROP05 con identidad V9</h3>
            <select aria-label="Filtrar estado de publicación" value={filter}
              onChange={e => { const gate = e.target.value; setFilter(gate); load(activeCredential, gate, []); }}
              style={{ background: surface, color: text, border: `1px solid ${border}`, borderRadius: 8, padding: "8px 12px", maxWidth: "100%" }}>
              {FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 790, fontSize: 12 }}>
              <thead><tr>{["Fecha", "Proyecto", "Equipo", "Nº parte", "Tarea", "Horas", "Cantidad", "Estado"].map(s =>
                <th key={s} style={{ textAlign: "left", padding: "10px 7px", borderBottom: `1px solid ${border}`, color: secondary }}>{s}</th>)}</tr></thead>
              <tbody>{rows.map(row => <tr key={row.task_key}>
                {[row.fecha || "—", row.proyecto || "—", row.interno || "—", row.numero_parte || "—", row.tarea || "—",
                  row.horas_productivas ?? "—", row.cantidad_produccion == null ? "—" : `${row.cantidad_produccion} ${row.unidad || ""}`,
                  SHORT_LABELS[row.publication_gate] || row.publication_gate].map((v, i) =>
                  <td key={i} style={{ padding: "9px 7px", borderBottom: `1px solid ${border}44` }}>{v}</td>)}
              </tr>)}</tbody>
            </table>
            {!rows.length && <p style={{ color: secondary, fontSize: 13 }}>No hay tareas en este estado.</p>}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: secondary }}>Página {pageHistory.length + 1} · {rows.length} tareas</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button disabled={!pageHistory.length || busy}
                onClick={() => load(activeCredential, filter, pageHistory.slice(0, -1))}
                style={{ padding: "8px 13px", cursor: "pointer" }}>Anterior</button>
              <button disabled={!hasNext || !nextAfter || busy}
                onClick={() => load(activeCredential, filter, [...pageHistory, nextAfter])}
                style={{ padding: "8px 13px", cursor: "pointer" }}>Siguiente</button>
            </div>
          </div>
        </div>

        <div style={styleCard}>
          <h3 style={{ marginTop: 0 }}>Apps Script V9 de pruebas</h3>
          <p style={{ fontSize: 12, color: secondary }}>
            Consulta únicamente la acción health de la implementación de prueba configurada en Vercel.
            Las escrituras siguen dirigidas al sistema V8.1 y NO se ejecutan desde esta pantalla.
          </p>
          <button type="button" disabled={gasBusy} onClick={inspectGas}
            style={{ padding: "9px 14px", cursor: "pointer" }}>{gasBusy ? "Comprobando..." : "Verificar Apps Script V9"}</button>
          {gasHealth && <span style={{ fontSize: 12, paddingLeft: 12, color: gasHealth.ok ? "#8ce6bd" : "#ffb0a7" }}>
            {gasHealth.ok ? "Conexión V9 correcta" : (gasHealth.message || "La conexión V9 no está disponible")}
          </span>}
        </div>
      </>}
      <p style={{ color: secondary, fontSize: 12, marginBottom: 0 }}>
        Este módulo es exclusivamente de lectura. No permite aprobar, enviar, editar o sincronizar partes.
        Nunca reemplaza el control de productividad diferida ni el cierre operativo.
      </p>
    </section>
  );
}
