import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const login=fs.readFileSync(new URL("../src/modules/auth/Login.jsx",import.meta.url),"utf8");
const authApi=fs.readFileSync(new URL("../src/services/supabaseAuthApi.js",import.meta.url),"utf8");

test("login autentica primero contra Supabase",()=>{
  assert.match(login,/authenticateSupabaseUser\(mail,pass\)/);
  assert.match(authApi,/rpc\/app_authenticate_user/);
  assert.match(authApi,/AUTH_TIMEOUT_MS=6000/);
});

test("login conserva fallback legacy sólo ante falla de infraestructura",()=>{
  assert.match(login,/catch\(supabaseError\)/);
  assert.match(login,/authenticateLegacyAppsScript\(APPS_SCRIPT_URL,mail,pass\)/);
  assert.match(login,/if\(!json\?\.ok\)/);
});

test("la sesión y los errores funcionales siguen usando el contrato existente",()=>{
  assert.match(login,/buildAuthenticatedUser\(json,mail\)/);
  assert.match(login,/saveAuthenticatedSession\(authenticatedUser/);
  assert.match(login,/AUTH_INVALID/);
  assert.match(login,/AUTH_INACTIVE/);
  assert.match(login,/mustChangePassword:!!json\.mustChangePassword/);
});
