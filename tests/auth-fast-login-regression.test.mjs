import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const login=fs.readFileSync(new URL("../src/modules/auth/Login.jsx",import.meta.url),"utf8");
const authApi=fs.readFileSync(new URL("../src/services/supabaseAuthApi.js",import.meta.url),"utf8");

test("login comparte la autoridad del cambio de contraseña sin un espejo Supabase independiente",()=>{
  assert.match(login,/authenticateLegacyAppsScript\(APPS_SCRIPT_URL,mail,pass\)/);
  assert.doesNotMatch(login,/authenticateSupabaseUser|catch\(supabaseError\)/);
  assert.match(login,/timeoutMs:45000/);
  assert.match(authApi,/rpc\/app_authenticate_user/); // Legacy module remains available to unrelated consumers.
});

test("la sesión y los errores funcionales siguen usando el contrato existente",()=>{
  assert.match(login,/buildAuthenticatedUser\(json,mail\)/);
  assert.match(login,/saveAuthenticatedSession\(authenticatedUser/);
  assert.match(login,/AUTH_INVALID/);
  assert.match(login,/AUTH_INACTIVE/);
  assert.match(login,/mustChangePassword:!!json\.mustChangePassword/);
});
