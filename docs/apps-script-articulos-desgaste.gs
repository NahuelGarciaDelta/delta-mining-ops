/*
 * DELTA MINING OPS — ARTÍCULOS DE DESGASTE
 *
 * Integrar este bloque en el Apps Script principal compartido de DELTA MINING OPS.
 * Spreadsheet destino: Informe de insumos comprados / Base de Datos Insumos.
 *
 * PASOS:
 * 1) Agregar la entrada `articulos_desgaste` a SHEETS_CONFIG (ver bloque inferior).
 * 2) Agregar el action POST `save_articulos_desgaste` dentro de doPost.
 * 3) Pegar las funciones de este archivo.
 * 4) Ejecutar UNA vez `instalarArticulosDesgaste()` desde Apps Script.
 * 5) Volver a implementar la aplicación web de Apps Script con la misma URL.
 */

/* =========================================================
 * 1. AGREGAR DENTRO DE SHEETS_CONFIG
 * =========================================================
 *
 * articulos_desgaste: {
 *   id: "1qWaJx74_JQkybNg-RHks2R-6IcsEa6q2uOZn_sKSBBQ",
 *   gid: "",
 *   sheet: "Articulos de desgaste",
 *   label: "Articulos de desgaste",
 *   proyecto: null,
 *   headerRow: 1,
 *   autoHeader: false
 * },
 *
 * IMPORTANTE: al estar en SHEETS_CONFIG, el doGet existente ya permite:
 *   ?action=articulos_desgaste&limit=all
 */

/* =========================================================
 * 2. AGREGAR DENTRO DE doPost(e), antes de INVALID_POST_ACTION
 * =========================================================
 *
 * if (action === "save_articulos_desgaste") {
 *   return buildResponse(handleSaveArticulosDesgaste_(payload.rows || []));
 * }
 */

var ARTICULOS_DESGASTE_DB_ID_ = "1qWaJx74_JQkybNg-RHks2R-6IcsEa6q2uOZn_sKSBBQ";
var ARTICULOS_DESGASTE_SHEET_ = "Articulos de desgaste";
var ARTICULOS_DESGASTE_HEADERS_ = [
  "Código",
  "Descripción",
  "Descripción adicional",
  "Clasificación"
];

function normalizarArticuloDesgasteCodigo_(value) {
  return String(value == null ? "" : value)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function ensureArticulosDesgasteSheet_() {
  var ss = SpreadsheetApp.openById(ARTICULOS_DESGASTE_DB_ID_);
  var sheet = ss.getSheetByName(ARTICULOS_DESGASTE_SHEET_);

  if (!sheet) {
    sheet = ss.insertSheet(ARTICULOS_DESGASTE_SHEET_);
  }

  var needsHeader = sheet.getLastRow() === 0;
  if (!needsHeader) {
    var current = sheet
      .getRange(1, 1, 1, Math.max(sheet.getLastColumn(), ARTICULOS_DESGASTE_HEADERS_.length))
      .getDisplayValues()[0]
      .slice(0, ARTICULOS_DESGASTE_HEADERS_.length)
      .map(function(v){ return String(v || "").trim(); });

    needsHeader = ARTICULOS_DESGASTE_HEADERS_.some(function(header, index){
      return current[index] !== header;
    });
  }

  if (needsHeader) {
    sheet
      .getRange(1, 1, 1, ARTICULOS_DESGASTE_HEADERS_.length)
      .setValues([ARTICULOS_DESGASTE_HEADERS_]);
  }

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, ARTICULOS_DESGASTE_HEADERS_.length)
    .setFontWeight("bold");
  sheet.autoResizeColumns(1, ARTICULOS_DESGASTE_HEADERS_.length);

  return sheet;
}

function instalarArticulosDesgaste() {
  var sheet = ensureArticulosDesgasteSheet_();
  SpreadsheetApp.flush();

  Logger.log(
    "Hoja central lista: " +
    sheet.getParent().getName() +
    " / " +
    sheet.getName()
  );
}

function handleSaveArticulosDesgaste_(rows) {
  rows = Array.isArray(rows) ? rows : [];

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var sheet = ensureArticulosDesgasteSheet_();
    var unique = {};

    rows.forEach(function(row) {
      row = row || {};

      var codigo = normalizarArticuloDesgasteCodigo_(
        row.codigo != null ? row.codigo :
        row.Código != null ? row.Código :
        row.Codigo != null ? row.Codigo :
        row.CODIGO
      );

      if (!codigo) return;

      var descripcion = String(
        row.articulo != null ? row.articulo :
        row.descripcion != null ? row.descripcion :
        row.Descripción != null ? row.Descripción :
        row.Descripcion != null ? row.Descripcion : ""
      ).trim();

      var adicional = String(
        row.descripcionAdicional != null ? row.descripcionAdicional :
        row["Descripción adicional"] != null ? row["Descripción adicional"] :
        row["Descripcion adicional"] != null ? row["Descripcion adicional"] : ""
      ).trim();

      var clasificacion = String(
        row.clasificacion != null ? row.clasificacion :
        row.Clasificación != null ? row.Clasificación :
        row.Clasificacion != null ? row.Clasificacion : ""
      ).trim();

      unique[codigo] = [codigo, descripcion, adicional, clasificacion];
    });

    var values = Object.keys(unique)
      .sort(function(a, b) {
        return a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });
      })
      .map(function(key) { return unique[key]; });

    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet
        .getRange(2, 1, lastRow - 1, Math.max(sheet.getLastColumn(), ARTICULOS_DESGASTE_HEADERS_.length))
        .clearContent();
    }

    if (values.length) {
      sheet
        .getRange(2, 1, values.length, ARTICULOS_DESGASTE_HEADERS_.length)
        .setValues(values);
    }

    sheet.autoResizeColumns(1, ARTICULOS_DESGASTE_HEADERS_.length);
    SpreadsheetApp.flush();

    var version = null;
    try {
      version = bumpDatasetVersion_("articulos_desgaste", true);
    } catch (_) {}

    try {
      CacheService.getScriptCache().removeAll([]);
    } catch (_) {}

    return {
      ok: true,
      action: "save_articulos_desgaste",
      rows: values.length,
      sheet: ARTICULOS_DESGASTE_SHEET_,
      version: version,
      savedAt: new Date().toISOString()
    };
  } finally {
    lock.releaseLock();
  }
}

function probarArticulosDesgaste() {
  var sheet = ensureArticulosDesgasteSheet_();
  var lastRow = sheet.getLastRow();
  var rows = lastRow > 1 ? lastRow - 1 : 0;

  Logger.log("Articulos de desgaste configurado correctamente.");
  Logger.log("Spreadsheet ID: " + ARTICULOS_DESGASTE_DB_ID_);
  Logger.log("Hoja: " + ARTICULOS_DESGASTE_SHEET_);
  Logger.log("Artículos actuales: " + rows);
}
