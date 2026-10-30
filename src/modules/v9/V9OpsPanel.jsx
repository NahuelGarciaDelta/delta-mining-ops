import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getAuthenticatedUser } from "../../services/authSession.js";

// The V9 pilot shares the ordinary Delta OPS login. Its server endpoint
// validates the opaque session against the authoritative user table.
const FILTERS = [
  ["", "Todos"],
  ["BLOCKED_CLOSURE_UNCONFIRMED", "Cierre / publicación no confirmados"],
  ["BLOCKED_SOURCE_DRIFT", "Cambios de identidad o fila"],
  ["BLOCKED_LEGACY_REVIEW", "Productividad heredada a revisar"],
  ["BLOCKED_NUMERIC_ANOMALY", "Anomalías numéricas"],
  ["BLOCKED_PRODUCTIVITY_PENDING", "Productividad pendiente"],
  ["BLOCKED_UNLINKED", "Sin contraparte ROP05"],
  ["BLOCKED_SNAPSHOT_STALE", "Datos desactualizados"]
];
const LABELS = {
  BLOCKED_CLOSURE_UNCONFIRMED: "Cierre sin confirmar",
  BLOCKED_SOURCE_DRIFT: "Fila desplazada",
  BLOCKED_LEGACY_REVIEW: "Revisión heredada",
  BLOCKED_NUMERIC_ANOMALY: "Anomalía numérica",
  BLOCKED_PRODUCTIVITY_PENDING: "Productividad pendiente",
  BLOCKED_UNLINKED: "Sin contraparte",
  BLOCKED_SNAPSHOT_STALE: "Snapshot anterior"
};

function sessionToken() {
  return String(getAuthenticatedUser()?.authToken || getAuthenticatedUser()?.token || "");
}

async function requestV9(payload) {
  const token = sessionToken();
  if (!token) throw new Error("La sesión de Delta OPS no está disponible. Iniciá sesión nuevamente.");
  const res = await fetch("/api/v9-ops", {
    method: "POST", cache: "no-store",
    headers: { "Content-Type": "application/json", "X-Delta-Auth-Token": token },
    body: JSON.stringify(payload)
  });
  let data;
  try { data = await res.json(); } catch { throw new Error("Respuesta inválida del servicio V9."); }
  if (!res.ok || !data?.ok) {
    const code = String(data?.error || "");
    const known = {
      V9_SESSION_REQUIRED: "La sesión de Delta OPS está vacía.",
      V9_SESSION_REJECTED: "Tu sesión de Apps Script puede seguir activa, pero todavía no está vinculada con Supabase V9. El puente de autenticación está pendiente; no necesitás volver a iniciar sesión.",
      V9_PERMISSION_DENIED: "Tu perfil no tiene permiso para consultar el piloto V9.",
      V9_BACKEND_TIMEOUT: "La consulta a Supabase excedió el tiempo disponible.",
      V9_GAS_NOT_CONFIGURED: "Todavía no se configuró la URL del Apps Script V9 de pruebas.",
      V9_PUBLIC_BACKEND_NOT_CONFIGURED: "Falta configuración del servicio V9 en Vercel."
    };
    throw new Error(known[code] || `El piloto V9 no está disponible (${code || res.status}).`);
  }
  return data;
}

function formatDate(value) {
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? new Date(time).toLocaleString("es-AR") : "—";
}

export default function V9OpsPanel({ C = {} }) {
  const [snapshot, setSnapshot] = useState(null);
  const [filter, setFilter] = useState("");
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [health, setHealth] = useState(null);
  const [healthBusy, setHealthBusy] = useState(false);
  const border = C.border || "#405160";
  const color = C.text || "#ecf1f5";
  const secondary = C.textSub || "#a4b4c1";
  const surface = C.surface || "#1c2934";
  const accent = C.accent || "#397ca9";
  const panel = { padding: 16, borderRadius: 12, border: `1px solid ${border}`, background: surface };

  const load = useCallback(async (gate = "", cursorHistory = []) => {
    setBusy(true);
    setError("");
    try {
      const after = cursorHistory.length ? cursorHistory[cursorHistory.length - 1] : "";
      const data = await requestV9({ mode: "preview", gate, after, limit: 20 });
      setSnapshot(data);
      setHistory(cursorHistory);
    } catch (e) {
      setError(e.message || "No se pudo leer Supabase.");
    } finally { setBusy(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counters = useMemo(() =>
    Object.entries(snapshot?.counts || {}).sort((a, b) => Number(b[1]) - Number(a[1])),
    [snapshot]);
  const rows = Array.isArray(snapshot?.rows) ? snapshot.rows : [];
  const nextAfter = rows.length ? String(rows[rows.length - 1].task_key || "") : "";
  const hasNext = rows.length === 20 && Boolean(nextAfter);

  const checkScript = async () => {
    setHealthBusy(true);
    setHealth(null);
    try { setHealth(await requestV9({ mode: "gas-health" })); }
    catch (e) { setHealth({ ok: false, message: e.message }); }
    finally { setHealthBusy(false); }
  };

  const Action = ({ children, disabled, onClick }) =>
    <button type="button" disabled={disabled} onClick={onClick}
      style={{ padding: "9px 12px", borderRadius: 8, cursor: disabled ? "default" : "pointer",
        border: `1px solid ${border}`, background: surface, color, opacity: disabled ? 0.5 : 1 }}>
      {children}
    </button>;

  return (
    <section style={{ width: "100%", maxWidth: 1380, margin: "0 auto", display: "grid", gap: 14, color }}>
      <header style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>DELTA OPS · V9</h2>
          <p style={{ margin: "5px 0 0", fontSize: 13, color: secondary }}>
            Supabase + Apps Script de pruebas · Sesión actual de Delta OPS
          </p>
        </div>
        <span style={{ border: `1px solid ${border}`, borderRadius: 22, padding: "7px 12px", fontSize: 12 }}>
          PILOTO DE LECTURA · 0 ESCRITURAS V9
        </span>
      </header>
      <div style={panel}>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <strong>Conexión con Supabase V9</strong>
          <Action onClick={() => load(filter, history)} disabled={busy}> {busy ? "Actualizando..." : "Actualizar datos"} </Action>
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 12, color: secondary }}>
          Este piloto reutilizará la sesión actual cuando termine el puente de autenticación. No pedirá una segunda contraseña.
          Los registros de V8.1 continúan sincronizándose normalmente.
        </p>
        {error && <p role="alert" style={{ color: "#f0aaa5", margin: "12px 0 0" }}>{error}</p>}
        {!snapshot && busy && <p style={{ color: secondary }}>Consultando la base de datos…</p>}
      </div>

      {snapshot && <>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            ["Identidades V9", Number(snapshot.total || 0).toLocaleString("es-AR")],
            ["Publicaciones habilitadas", "0"],
            ["ACK operativos", "0"]
          ].map(([label, num]) => <div key={label} style={{ ...panel, flex: "1 1 160px" }}>
            <div style={{ fontSize: 12, color: secondary }}>{label}</div>
            <strong style={{ fontSize: 26 }}>{num}</strong>
          </div>)}
        </div>

        <div style={panel}>
          <h3 style={{ margin: "0 0 12px" }}>Conciliación de tareas ROP05</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 }}>
            {counters.map(([key, count]) => <div key={key}
              style={{ border: `1px solid ${border}`, borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 12, color: secondary }}>{LABELS[key] || key}</div>
              <strong style={{ fontSize: 24 }}>{Number(count).toLocaleString("es-AR")}</strong>
            </div>)}
          </div>
          <div style={{ marginTop: 10, color: secondary, fontSize: 12 }}>
            Consulta: {formatDate(snapshot.last_preview_generated_at)}. La compuerta bloquea identidades
            desplazadas o registros cambiados, hasta su conciliación.
          </div>
        </div>

        <div style={panel}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>Tareas con identidad V9</h3>
            <select aria-label="Filtrar estado de publicación" value={filter}
              onChange={e => { const value = e.target.value; setFilter(value); load(value, []); }}
              style={{ padding: 9, color, background: surface, border: `1px solid ${border}`, borderRadius: 8 }}>
              {FILTERS.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
            </select>
          </div>
          <div style={{ marginTop: 12, overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", minWidth: 770, width: "100%", fontSize: 12 }}>
              <thead><tr>{["Fecha","Proyecto","Interno","Nº parte","Tarea","Horas productivas","Producción","Estado"].map(h =>
                <th key={h} style={{ color: secondary, textAlign: "left", padding: 8, borderBottom: `1px solid ${border}` }}>{h}</th>)}</tr></thead>
              <tbody>{rows.map(row => <tr key={row.task_key}>
                {[
                  row.fecha || "—", row.proyecto || "—", row.interno || "—", row.numero_parte || "—",
                  row.tarea || "—", row.horas_productivas ?? "—",
                  row.cantidad_produccion == null ? "—" : `${row.cantidad_produccion} ${row.unidad || ""}`,
                  LABELS[row.publication_gate] || row.publication_gate
                ].map((value, i) =>
                  <td key={i} style={{ padding: 8, borderBottom: `1px solid ${border}55` }}>{value}</td>)}
              </tr>)}</tbody>
            </table>
            {!rows.length && <p style={{ color: secondary }}>No hay registros en ese estado.</p>}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 15 }}>
            <span style={{ fontSize: 12, color: secondary }}>Página {history.length + 1} · {rows.length} tareas</span>
            <div style={{ display: "flex", gap: 10 }}>
              <Action onClick={() => load(filter, history.slice(0,-1))} disabled={busy || !history.length}>Anterior</Action>
              <Action onClick={() => load(filter, [...history, nextAfter])} disabled={busy || !hasNext}>Siguiente</Action>
            </div>
          </div>
        </div>

        <div style={panel}>
          <h3 style={{ marginTop: 0 }}>Conexión Apps Script V9</h3>
          <p style={{ color: secondary, fontSize: 12 }}>
            Se consulta exclusivamente el endpoint health del script de pruebas configurado en Vercel.
            No activa triggers ni sincronizaciones.
          </p>
          <Action disabled={healthBusy} onClick={checkScript}>{healthBusy ? "Verificando…" : "Verificar Apps Script"}</Action>
          {health && <span style={{ marginLeft: 12, fontSize: 12, color: health.ok ? "#92e6bd" : "#f0aaa5" }}>
            {health.ok ? "Conectado" : (health.message || "No disponible")}
          </span>}
        </div>
      </>}
      <p style={{ fontSize: 12, color: secondary, margin: "4px 0" }}>
        Solo lectura: este módulo no aprueba, modifica, publica ni confirma partes. V8.1 permanece activo.
      </p>
    </section>
  );
}
