// Transport does not retry a mutation. Callers decide how to reconcile each operation.
export function newOperationId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  throw new Error("El navegador no dispone de un generador seguro de identificadores.");
}

export async function requestAppsScript(url, payload, { timeoutMs = 60000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: new URLSearchParams({ payload: JSON.stringify(payload) })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (!result || typeof result.ok !== "boolean") throw new Error("Respuesta de confirmación inválida");
    return result;
  } finally {
    clearTimeout(timer);
  }
}
