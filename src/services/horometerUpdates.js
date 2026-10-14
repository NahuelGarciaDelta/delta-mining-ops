import { newOperationId, requestAppsScript } from "./confirmedWrites.js";
import { getAuthenticatedUser, getAuthenticatedSessionRevision } from "./authSession.js";

export function meterNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  // Numeric values from ROP02 are already numbers. Do not strip their decimal point.
  const text = String(value).trim();
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? number : NaN;
}
export function createHorometerOperation(updates) {
  return { operationId: newOperationId(), updates };
}
export function summarizeHorometerResults(operation, results) {
  const confirmed = results.filter((result) => result.status === "confirmed");
  const failed = results.filter((result) => result.status === "failed");
  const uncertain = results.filter((result) => result.status === "pending");
  return {
    ok: confirmed.length === operation.updates.length,
    operationId: operation.operationId,
    results,
    status: uncertain.length ? "pending" : failed.length ? (confirmed.length ? "partial" : "failed") : "complete",
    updatedRows: confirmed.filter((result) => result.changed).length,
    skippedRows: confirmed.filter((result) => !result.changed).length,
    failedRows: failed.length,
    pendingRows: uncertain.length
  };
}
export async function submitHorometerOperation(url, operation, { verifyOnly = false } = {}) {
  const results = [];
  let version = null;
  let cacheWarning = null;
  const user = getAuthenticatedUser(),
    sessionRevision = getAuthenticatedSessionRevision();
  // Bound GAS execution time and receipt size. No source reload, Supabase query or polling.
  for (let offset = 0; offset < operation.updates.length; offset += 100) {
    const updates = operation.updates.slice(offset, offset + 100);
    if (getAuthenticatedSessionRevision() !== sessionRevision) {
      const error = new Error(
        "La sesión cambió. Verificá las lecturas antes de continuar; no se enviaron los lotes restantes."
      );
      error.code = "SESSION_CHANGED";
      throw error;
    }
    const batch = {
      operationId: `${operation.operationId}_${offset}`,
      updates,
      actor: { email: user?.email || "", token: user?.authToken || "" }
    };
    let response;
    try {
      response = await requestAppsScript(url, {
        action: verifyOnly ? "verify_lista_horometros" : "update_lista_horometros",
        ...batch
      });
    } catch {
      try {
        response = await requestAppsScript(url, { action: "verify_lista_horometros", ...batch });
      } catch {
        response = { status: "pending" };
      }
    }
    if (
      !Array.isArray(response.results) ||
      response.results.length !== updates.length ||
      response.results.some(
        (result, index) => result.index !== index || !["confirmed", "failed", "pending"].includes(result.status)
      )
    ) {
      // Pre-write validation failures are confirmed only when explicitly reported by the new backend.
      const status = response.status === "failed" ? "failed" : "pending";
      response = {
        ...response,
        results: updates.map((item, index) => ({
          index,
          identity: item.identity,
          status,
          code: response.error?.code || "CONFIRMATION_PENDING",
          message: response.error?.message
        }))
      };
    }
    if (response.version) version = response.version;
    if (response.cacheWarning) cacheWarning = response.cacheWarning;
    results.push(...response.results.map((result) => ({ ...result, index: result.index + offset })));
  }
  if (getAuthenticatedSessionRevision() !== sessionRevision) {
    const error = new Error(
      "La sesión cambió mientras se confirmaban las lecturas. Verificá el resultado al volver a ingresar."
    );
    error.code = "SESSION_CHANGED";
    throw error;
  }
  return { ...summarizeHorometerResults(operation, results), version, cacheWarning };
}
export function listaIdentityFromRow(row) {
  const normalize = (key) =>
    String(key)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const find = (names) => {
    const matches = Object.keys(row).filter((key) => names.includes(normalize(key)));
    const values = matches.map((key) => String(row[key] ?? "").trim()).filter(Boolean);
    // The Supabase adapter intentionally supplies accent/spelling aliases. They
    // identify one code when values agree; conflicting aliases remain unusable.
    const codes = new Set(values.map((value) => value.toUpperCase().replace(/[\s-]/g, "")));
    return codes.size === 1 ? values[0] : "";
  };
  return {
    codigoDrusila: find(["codigo de drusila", "codigo drusila", "cod drusila", "interno drusila"]),
    codigoNuevo: find(["codigo nuevo", "codigo interno", "codigo n interno", "interno"])
  };
}
export function patchConfirmedMeters(rows, results) {
  const code = (value) =>
    String(value ?? "")
      .trim()
      .toUpperCase()
      .replace(/[\s-]/g, "");
  return rows.map((row) => {
    const identities = row._listaIdentity || listaIdentityFromRow(row);
    const match = results.find(
      (result) =>
        result.status === "confirmed" &&
        !result.verificationWarning &&
        result.column &&
        Object.values(result.identity || {}).some(Boolean) &&
        Object.entries(result.identity || {}).every(([key, value]) => !value || code(identities[key]) === code(value))
    );
    return match
      ? { ...row, [match.column]: Object.hasOwn(match, "currentValue") ? match.currentValue : match.value }
      : row;
  });
}
