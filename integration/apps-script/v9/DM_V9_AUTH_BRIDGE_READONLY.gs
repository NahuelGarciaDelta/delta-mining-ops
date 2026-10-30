/**
 * DELTA V9 - lectura de identidad de sesión V8.1 para prueba de integración.
 *
 * INSTALAR SOLO COMO FUENTE EN EL MISMO PROYECTO Apps Script QUE EMITE EL TOKEN,
 * bajo una implementación/version NUEVA y previa revisión.
 * No tiene doPost propio: el enrutamiento debe añadirse explícitamente.
 *
 * SEGURIDAD:
 * - Valida HMAC y expiración usando stockExcelVerifyAuthToken_ existente.
 * - Valida registro vigente/activo y política de cambio de contraseña.
 * - Nunca devuelve el token, HMAC, secretos o passwordHash.
 * - No agrega permisos, triggers, entregas o escrituras de ROP02/ROP05.
 */
function dmV9AuthBridgeVerifyExistingSession_(payload) {
  payload = payload || {};
  var token = String(payload.authToken || payload.token || "");
  if (token.length < 24 || token.length > 2048) {
    return {ok:false,error:{code:"V9_AUTH_REQUIRED"}};
  }
  var email = stockExcelVerifyAuthToken_(token);
  if (!email) return {ok:false,error:{code:"V9_AUTH_INVALID"}};
  var user = getAuthMirrorUser_(email);
  if (!user || !user.activo || user.mustChangePassword) {
    return {ok:false,error:{code:"V9_AUTH_INACTIVE_OR_PASSWORD_CHANGE"}};
  }
  var rol = String(user.rol || "").trim().toUpperCase();
  var area = String(user.area || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
  if (rol !== "ADMIN" && rol !== "ADMINISTRADOR" && area !== "OFICINA TECNICA") {
    return {ok:false,error:{code:"V9_ACCESS_DENIED"}};
  }
  return {
    ok:true,
    mode:"V9_SIGNED_SESSION_VALIDATED",
    user:{
      email:String(user.email || "").trim().toLowerCase(),
      rol:rol,
      area:area,
      proyecto:String(user.proyecto || "").trim().toUpperCase()
    },
    publicationsEnabled:false,
    deliveriesEnabled:false
  };
}

// Acción para integrar manualmente en el doPost YA EXISTENTE:
// if (action === "v9_validate_existing_session") {
//   return buildResponse(dmV9AuthBridgeVerifyExistingSession_(payload));
// }
//
// La respuesta solo prueba la sesión ante Apps Script. NO autoriza a Vercel a
// leer Supabase automáticamente sin el contrato de backend correspondiente.
// No duplicar doPost ni reutilizar el secreto del token en otro proyecto.
