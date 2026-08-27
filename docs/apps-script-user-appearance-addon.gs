/* DELTA MINING OPS — Preferencias de apariencia por usuario
 * Agregar estas funciones al Apps Script principal.
 * Requiere que doGet enrute action=user_preferences a handleUserPreferencesGet_(e.parameter.email)
 * y doPost enrute action=save_user_preferences a handleUserPreferencesSave_(payload).
 */

var DM_USER_APPEARANCE_HEADER_ = "Apariencia";

function dmGetUsuariosAppearanceInfo_() {
  var cfg = SHEETS_CONFIG.usuarios;
  if (!cfg) throw new Error("No existe SHEETS_CONFIG.usuarios");
  var ss = SpreadsheetApp.openById(cfg.id);
  var sh = ss.getSheetByName(cfg.sheet);
  if (!sh) throw new Error("No existe la hoja de usuarios: " + cfg.sheet);
  var lastCol = Math.max(1, sh.getLastColumn());
  var headers = sh.getRange(cfg.headerRow || 1, 1, 1, lastCol).getDisplayValues()[0].map(function(v){ return String(v || "").trim(); });
  var colEmail = headers.findIndex(function(h){ return h.toUpperCase() === "EMAIL"; });
  var colAppearance = headers.findIndex(function(h){ return h.toUpperCase() === DM_USER_APPEARANCE_HEADER_.toUpperCase(); });
  if (colEmail < 0) throw new Error("No se encontró la columna Email en Usuarios autorizados");
  if (colAppearance < 0) {
    colAppearance = lastCol;
    sh.getRange(cfg.headerRow || 1, colAppearance + 1).setValue(DM_USER_APPEARANCE_HEADER_);
  }
  return { ss:ss, sh:sh, colEmail:colEmail, colAppearance:colAppearance, headerRow:cfg.headerRow || 1 };
}

function dmFindUserAppearanceRow_(info, email) {
  var target = String(email || "").trim().toLowerCase();
  if (!target) throw new Error("Email requerido");
  var lastRow = info.sh.getLastRow();
  if (lastRow <= info.headerRow) return -1;
  var values = info.sh.getRange(info.headerRow + 1, info.colEmail + 1, lastRow - info.headerRow, 1).getDisplayValues();
  for (var i=0;i<values.length;i++) {
    if (String(values[i][0] || "").trim().toLowerCase() === target) return info.headerRow + 1 + i;
  }
  return -1;
}

function dmNormalizeAppearanceServer_(value) {
  value = value && typeof value === "object" ? value : {};
  var out = {
    accent: String(value.accent || "red"),
    background: String(value.background || "operations"),
    backgroundDim: Math.max(0, Math.min(85, Number(value.backgroundDim == null ? 48 : value.backgroundDim))),
    backgroundBlur: Math.max(0, Math.min(16, Number(value.backgroundBlur == null ? 0 : value.backgroundBlur))),
    panelOpacity: Math.max(35, Math.min(100, Number(value.panelOpacity == null ? 55 : value.panelOpacity))),
    density: String(value.density || "normal"),
    scale: String(value.scale || "normal"),
    sidebar: String(value.sidebar || "remember"),
    reducedMotion: !!value.reducedMotion
  };
  // Las imágenes personalizadas se mantienen locales: una celda de Sheets no es un almacén de archivos.
  if (out.background === "custom") out.background = "operations";
  return out;
}

function handleUserPreferencesGet_(email) {
  var info = dmGetUsuariosAppearanceInfo_();
  var row = dmFindUserAppearanceRow_(info, email);
  if (row < 0) throw new Error("Usuario no encontrado");
  var raw = String(info.sh.getRange(row, info.colAppearance + 1).getValue() || "").trim();
  var appearance = {};
  if (raw) {
    try { appearance = JSON.parse(raw); } catch (_) { appearance = {}; }
  }
  return { ok:true, appearance:dmNormalizeAppearanceServer_(appearance) };
}

function handleUserPreferencesSave_(payload) {
  payload = payload || {};
  var info = dmGetUsuariosAppearanceInfo_();
  var row = dmFindUserAppearanceRow_(info, payload.email);
  if (row < 0) throw new Error("Usuario no encontrado");
  var appearance = dmNormalizeAppearanceServer_(payload.appearance || {});
  info.sh.getRange(row, info.colAppearance + 1).setValue(JSON.stringify(appearance));
  SpreadsheetApp.flush();
  return { ok:true, appearance:appearance, savedAt:new Date().toISOString() };
}

/* RUTEO A INCORPORAR EN doGet(e):
if (action === "user_preferences") {
  return buildResponse(handleUserPreferencesGet_(e.parameter.email || ""));
}

RUTEO A INCORPORAR EN doPost(e), después de parsear payload:
if (action === "save_user_preferences") {
  return buildResponse(handleUserPreferencesSave_(payload));
}
*/
