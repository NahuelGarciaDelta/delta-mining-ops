import test from "node:test";
import assert from "node:assert/strict";
import { buildAuthenticatedUser, getAuthenticatedUser, saveAuthenticatedSession, clearAuthenticatedSession } from "../src/services/authSession.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
}

test("conserva el token desde las cuatro ubicaciones compatibles", () => {
  const responses = [
    { authToken: "a", user: { email: "u@delta" } },
    { token: "b", user: { email: "u@delta" } },
    { user: { email: "u@delta", authToken: "c" } },
    { user: { email: "u@delta", token: "d" } },
  ];
  assert.deepEqual(responses.map(value => buildAuthenticatedUser(value).authToken), ["a", "b", "c", "d"]);
  assert.deepEqual(responses.map(value => buildAuthenticatedUser(value).token), ["a", "b", "c", "d"]);
});

test("restaura el usuario completo y elimina el token al cerrar sesión", () => {
  globalThis.sessionStorage = memoryStorage();
  saveAuthenticatedSession({ email:"user@delta", rol:"ADMIN", extra:"se conserva", authToken:"signed-token" });
  assert.deepEqual(getAuthenticatedUser(), {email:"user@delta",rol:"ADMIN",extra:"se conserva",authToken:"signed-token",token:"signed-token"});
  assert.equal(sessionStorage.getItem("dm_auth_token"), "signed-token");
  clearAuthenticatedSession();
  assert.equal(getAuthenticatedUser(), null);
  assert.equal(sessionStorage.getItem("dm_auth_token"), null);
});

test("Stock usa GET sin actor y POST con email/token, sin Base64", async () => {
  globalThis.sessionStorage = memoryStorage();
  saveAuthenticatedSession({email:"stock@delta",authToken:"signed-token"});
  const calls=[];
  globalThis.fetch=async(url,options={})=>{calls.push({url:String(url),options});return{ok:true,text:async()=>JSON.stringify({ok:true,rows:[]})};};
  const { fetchStockData, fetchStockStatus, clearSharedStock, uploadStockExcel } = await import("../src/services/stockService.js");
  await fetchStockData("https://example.test/exec");
  await fetchStockStatus("https://example.test/exec");
  await clearSharedStock("https://example.test/exec");
  await uploadStockExcel("https://example.test/exec",{file:{name:"stock.xlsx",type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},rows:[{codigoArticulo:"A1"}],sheetName:"Stock",replace:true});
  assert.match(calls[0].url,/action=stock_excel_data/);
  assert.match(calls[1].url,/action=stock_excel_status/);
  assert.equal(calls[0].options.method,undefined);
  assert.equal(calls[1].options.method,undefined);
  const payload=JSON.parse(new URLSearchParams(calls[2].options.body).get("payload"));
  assert.equal(payload.action,"stock_excel_clear");
  assert.deepEqual(payload.actor,{email:"stock@delta",token:"signed-token"});
  const uploadPayload=JSON.parse(new URLSearchParams(calls[3].options.body).get("payload"));
  assert.equal(uploadPayload.action,"stock_excel_replace");
  assert.deepEqual(uploadPayload.actor,{email:"stock@delta",token:"signed-token"});
  assert.equal(uploadPayload.fileName,"stock.xlsx");
  assert.deepEqual(Object.keys(uploadPayload).sort(), ["action","actor","fileName","mimeType","rows","sheetName"].sort());
  assert.equal("file" in uploadPayload,false);
  assert.doesNotMatch(JSON.stringify(uploadPayload),/base64/i);
});
