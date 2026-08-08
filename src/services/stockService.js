import { getAuthenticatedUser } from "./authSession.js";

function actor() {
  const currentUser = getAuthenticatedUser();
  return {
    email: String(currentUser?.email || "").trim().toLowerCase(),
    token: String(currentUser?.authToken || currentUser?.token || ""),
  };
}

async function parseResponse(response) {
  if (!response.ok) throw new Error(`HTTP ${response.status} desde el Apps Script`);
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); }
  catch { throw new Error("El Apps Script devolvió una respuesta no válida."); }
  if (!json?.ok) throw new Error(json?.error?.message || "La operación de Stock no pudo completarse.");
  return json;
}

async function postStock(url, payload) {
  const currentActor = actor();
  if (!currentActor.email || !currentActor.token) {
    throw new Error("Tu sesión no tiene un token válido. Cerrá sesión e iniciá nuevamente.");
  }
  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    redirect: "follow",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: new URLSearchParams({ payload: JSON.stringify({ ...payload, actor: currentActor }) }).toString(),
  });
  return parseResponse(response);
}

function getStock(url, action) {
  const requestUrl = new URL(String(url || "").trim());
  requestUrl.searchParams.set("action", action);
  requestUrl.searchParams.set("_", String(Date.now()));
  return fetch(requestUrl.toString(), { cache: "no-store", redirect: "follow" }).then(parseResponse);
}

export function fetchStockStatus(url) { return getStock(url, "stock_excel_status"); }
export function fetchStockData(url) { return getStock(url, "stock_excel_data"); }

export function uploadStockExcel(url, { file, rows, sheetName, replace = false }) {
  return postStock(url, {
    action: replace ? "stock_excel_replace" : "stock_excel_upload",
    fileName: file.name,
    mimeType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    rows,
    sheetName: sheetName || "",
  });
}

export function clearSharedStock(url) {
  return postStock(url, { action: "stock_excel_clear" });
}
