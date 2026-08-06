var SHEETS_CONFIG = {
  rop05: {
    id: "1HYlylloC0TMsOWTpwvZ8YaXk5RLRKZ2PmOlhc7TCovw",
    gid: "260616594",
    sheet: "ROP05 nuevo",
    label: "Productividad (ROP05)",
    proyecto: null,
    headerRow: 1
  },
  rop02_fs: {
    id: "1dt5THoDndDM9pBZYkNR0gjkPrSrunnkMA8DgqQZB2OU",
    gid: "396764804",
    sheet: "R_OP02_FS",
    label: "Partes — Filo del Sol",
    proyecto: "FILO DEL SOL",
    headerRow: 4
  },
  rop02_jm: {
    id: "1RzOwDSmd1fw48hvPCfoauPnZGE44G9NgSazMdjVxj4Q",
    gid: "967767400",
    sheet: "R_OP02_JM",
    label: "Partes — José María",
    proyecto: "JOSE MARIA",
    headerRow: 4
  },
  rop02_filosur: {
    id: "1RpKLXTQNxlqoRy9c5FXI23ZV-OatlsRCvu4CuNWBt0w",
    gid: "1301566995",
    sheet: "R_OP2_",
    label: "Partes — Filo Sur",
    proyecto: "FILO SUR",
    headerRow: 4
  },
  rma15_fs: {
    id: "1WZEwuUTE8r-wUgTKeMsr1tsV1Ylq8fMULQjE-omCMOU",
    gid: "1444625212",
    sheet: "FICHA DE VIDA EQUIPOS",
    label: "Mantenimiento — Filo del Sol",
    proyecto: "FILO DEL SOL",
    headerRow: 5
  },
  rma15_jm: {
    id: "1ZAZ8r1gtz6pBobJ7Nv1mQNtIWuNhckQxI6SkGxKWt_I",
    gid: "839351017",
    sheet: "FICHA DE VIDA EQUIPOS",
    label: "Mantenimiento — José María",
    proyecto: "JOSE MARIA",
    headerRow: 5
  },
  insumos: {
    id: "1qWaJx74_JQkybNg-RHks2R-6IcsEa6q2uOZn_sKSBBQ",
    gid: "0",
    sheet: "Costos",
    label: "Base de Datos Insumos",
    proyecto: null,
    headerRow: 1
  },
  raba03: {
    id: "1CYXvmXk7XknGWq4TUJyTAaXz_TH1JOWcl2Zm7XurFTI",
    gid: "",
    sheet: "Seguimiento Compra",
    label: "RABA03 — Abastecimiento",
    proyecto: null,
    headerRow: 6,
    autoHeader: false
  },
  lista_equipos: {
    id: "1cEbCIkt0GM4EPU86CluvDyRzAN2c1K8tfG9TXLFzQc4",
    gid: "952415879",
    sheet: "lista equipos",
    label: "Lista Maestra de Equipos",
    proyecto: null,
    headerRow: 5
  },
  pm_config: {
    id: "1jmTZ2_aJai-t1uj-sZB8MK1a6J47oXeiG5GIO_Gk6u4",
    gid: "",
    sheet: "PM_CONFIG",
    label: "Mantenimiento programado — configuración",
    proyecto: null,
    headerRow: 1,
    autoHeader: false
  },
  pm_registros: {
    id: "1jmTZ2_aJai-t1uj-sZB8MK1a6J47oXeiG5GIO_Gk6u4",
    gid: "",
    sheet: "PM_REGISTROS",
    label: "Mantenimiento programado — historial",
    proyecto: null,
    headerRow: 1,
    autoHeader: false
  },
  usuarios: {
    id: "1GQeo1upm1P9I_JvyevRjRRJBAlzfXIoXwIPLuRd720g",
    gid: "0",
    sheet: "Usuarios autorizados",
    label: "Usuarios autorizados",
    proyecto: null,
    headerRow: 1,
    autoHeader: false
  }
};

function doGet(e) {
  e = e || { parameter: {} };
  var p = e.parameter || {};
  var action = String(p.action || "").toLowerCase().trim();

  try {
    if (action === "clear_cache") {
      clearAllCache_();
      return buildResponse({ ok: true, message: "Cache limpiada" });
    }

    if (action === "health") return buildResponse(handleHealth());
    if (action === "diag") return buildResponse(handleDiag());
    if (action === "sync" || action === "versions") return buildResponse(handleSyncVersions_());
    if (action === "usuarios" || action === "users" || action === "auth_users") return buildResponse(handleUsuariosAutorizados_());
    if (action === "mantenimiento_programado" || action === "pm_programado") return buildResponse(handleGetMantenimientoProgramado_());

    if (action === "all") {
      return buildResponse(handleAll(p));
    }

    if (SHEETS_CONFIG[action]) {
      return buildResponse(handleSingle(action, p));
    }

    return buildResponse({
      ok: false,
      error: {
        code: "INVALID_ACTION",
        message: "Acción inválida: " + action
      }
    });

  } catch (err) {
    return buildResponse({
      ok: false,
      error: {
        code: "SERVER_ERROR",
        message: err.message
      }
    });
  }
}

function doPost(e) {
  try {
    var payload = null;

    if (e && e.parameter && e.parameter.payload) {
      payload = JSON.parse(e.parameter.payload);
    } else if (e && e.postData && e.postData.contents) {
      var raw = String(e.postData.contents || "");

      // Cuando React manda body: new URLSearchParams({payload: json})
      if (raw.indexOf("payload=") === 0 || raw.indexOf("&payload=") !== -1) {
        var parts = raw.split("&");
        for (var i = 0; i < parts.length; i++) {
          var kv = parts[i].split("=");
          if (decodeURIComponent(kv[0] || "") === "payload") {
            payload = JSON.parse(decodeURIComponent((kv.slice(1).join("=") || "").replace(/\+/g, "%20")));
            break;
          }
        }
      } else {
        payload = JSON.parse(raw);
      }
    }

    if (!payload || !payload.action) {
      return buildResponse({
        ok: false,
        error: { code: "POST_PAYLOAD_MISSING", message: "No llegó payload/action al Apps Script." }
      });
    }

    var action = String(payload.action || "").toLowerCase().trim();

    if (action === "add_lista_equipo") {
      return buildResponse(handleAddListaEquipo_(payload.row || {}));
    }

    if (action === "update_lista_equipo") {
      return buildResponse(handleUpdateListaEquipo_(payload.originalKeys || {}, payload.row || {}));
    }

    if (action === "bulk_update_lista_equipos_from_app") {
      return buildResponse(handleBulkUpdateListaEquiposFromApp_(payload.updates || []));
    }

    if (action === "update_rop02_row") {
      return buildResponse(handleUpdateROP02Row_(payload.target, payload.rowKey || {}, payload.fields || {}));
    }


    if (action === "add_raba03_rows_append_only") {
      return buildResponse(handleAddRABA03Rows_APPEND_ONLY_(payload.rows || []));
    }

    if (action === "save_raba03_cant_enviada") {
      return buildResponse(handleSaveRABA03CantEnviada_(payload.rows || []));
    }

    if (action === "save_raba03_codigos") {
      return buildResponse(handleSaveRABA03Codigos_(payload.rows || []));
    }

    if (action === "upsert_raba03_rows_safe_v2") {
      return buildResponse(handleAddRABA03Rows_SAFE_V2_(payload.rows || []));
    }

    if (action === "add_raba03_rows" || action === "upsert_raba03_rows") {
      return buildResponse(handleAddRABA03Rows_SAFE_V2_(payload.rows || []));
    }

    if (action === "save_pm_config") {
      return buildResponse(handleSavePMConfig_(payload.config || {}));
    }

    if (action === "registrar_pm_realizado") {
      return buildResponse(handleRegistrarPMRealizado_(payload.registro || {}));
    }

    return buildResponse({
      ok: false,
      error: { code: "INVALID_POST_ACTION", message: "Acción POST inválida: " + action }
    });

  } catch (err) {
    return buildResponse({
      ok: false,
      error: { code: "POST_ERROR", message: err.message }
    });
  }
}

function handleSingle(key, params) {
  var config = SHEETS_CONFIG[key];

  var options = {
    limit: getLimit_(params),
    offset: getOffset_(params),
    compact: String(params.compact || "").toLowerCase() === "1" ||
             String(params.compact || "").toLowerCase() === "true"
  };

  var force = String(params.force || "") === "1" || String(params.force || "").toLowerCase() === "true";
  var version = getDatasetVersion_(key);
  var cacheKey = "dm_json_" + key + "_v" + version + "_o" + options.offset + "_l" + String(options.limit) + "_c" + (options.compact ? "1" : "0");
  if (!force) {
    try {
      var cached = CacheService.getScriptCache().get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (cacheReadErr) {}
  }

  var result = fetchSheetData(config, options);

  if (!result.ok) return result;

  var response = {
    ok: true,
    fromCache: false,
    meta: {
      source: key,
      label: config.label,
      rows: result.totalRows,
      returnedRows: result.data.length,
      offset: result.offset,
      limit: result.limit,
      hasMore: result.hasMore,
      nextOffset: result.nextOffset,
      headerRow: result.headerRow || config.headerRow,
      fetchedAt: new Date().toISOString(),
      sheetNameUsed: result.sheetNameUsed,
      sheetGidUsed: result.sheetGidUsed,
      lastRow: result.lastRow,
      fechaRange: result.fechaRange
    },
    data: result.data
  };
  response.meta.serverVersion = version;
  response.meta.serverTime = new Date().toISOString();
  try {
    var packed = JSON.stringify(response);
    if (packed.length < 95000) CacheService.getScriptCache().put(cacheKey, packed, 30);
  } catch (cacheWriteErr) {}
  return response;
}

function handleAll(params) {
  var result = {
    ok: true,
    fromCache: false,
    sources: {},
    fetchedAt: new Date().toISOString()
  };

  var anyOk = false;

  Object.keys(SHEETS_CONFIG).forEach(function (key) {
    var config = SHEETS_CONFIG[key];

    var options = {
      limit: null,
      offset: 0,
      compact: false
    };

    // ROP05 es la pesada: por defecto devuelve solo 250.
    // Para traer todo: ?action=rop05&limit=all
    if (key === "rop05") {
      options.limit = getLimit_(params, 250);
      options.offset = getOffset_(params);
      options.compact = true;
    }

    var fetched = fetchSheetData(config, options);

    if (fetched.ok) {
      result.sources[key] = {
        ok: true,
        label: config.label,
        rows: fetched.totalRows,
        returnedRows: fetched.data.length,
        offset: fetched.offset,
        limit: fetched.limit,
        hasMore: fetched.hasMore,
        nextOffset: fetched.nextOffset,
        headerRow: fetched.headerRow || config.headerRow,
        sheetNameUsed: fetched.sheetNameUsed,
        sheetGidUsed: fetched.sheetGidUsed,
        lastRow: fetched.lastRow,
        fechaRange: fetched.fechaRange,
        data: fetched.data
      };
      anyOk = true;
    } else {
      result.sources[key] = {
        ok: false,
        label: config.label,
        headerRow: config.headerRow,
        error: fetched.error
      };
    }
  });

  if (!anyOk) {
    result.ok = false;
    result.error = {
      code: "ALL_FAILED",
      message: "No se pudo leer ninguna planilla."
    };
  }

  return result;
}

function fetchSheetData(config, options) {
  options = options || {};
  var limit = options.limit;
  var offset = Math.max(0, Number(options.offset || 0));
  var compact = !!options.compact;

  try {
    var ss = SpreadsheetApp.openById(config.id);
    var sheet = findSheetByGidOrName(ss, config.gid, config.sheet);

    if (!sheet) {
      return {
        ok: false,
        error: {
          code: "SHEET_NOT_FOUND",
          message: "No se encontró la hoja '" + config.sheet + "'."
        }
      };
    }

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();

    var headerRow = config.headerRow;
    if (config.autoHeader === true || String(config.headerRow).toLowerCase() === "auto") {
      headerRow = detectHeaderRow_(sheet, lastRow, lastCol);
    }

    if (lastRow < headerRow) {
      return {
        ok: false,
        error: {
          code: "EMPTY_SHEET",
          message: "La hoja no tiene suficientes filas."
        }
      };
    }

    var totalDataRows = Math.max(0, lastRow - headerRow);
    if (totalDataRows === 0) {
      return {
        ok: true,
        data: [],
        totalRows: 0,
        offset: offset,
        limit: limit,
        hasMore: false,
        nextOffset: null,
        sheetNameUsed: sheet.getName(),
        sheetGidUsed: sheet.getSheetId(),
        lastRow: lastRow,
        fechaRange: { min: null, max: null, columna: null },
        headerRow: headerRow
      };
    }

    var headers = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0].map(function (h, idx) {
      return String(h || "").trim() || ("col_" + idx);
    });

    var startDataRow = headerRow + 1 + offset;
    if (startDataRow > lastRow) {
      return {
        ok: true,
        data: [],
        totalRows: totalDataRows,
        offset: offset,
        limit: limit,
        hasMore: false,
        nextOffset: null,
        sheetNameUsed: sheet.getName(),
        sheetGidUsed: sheet.getSheetId(),
        lastRow: lastRow,
        fechaRange: { min: null, max: null, columna: null },
        headerRow: headerRow
      };
    }

    var rowsToRead = totalDataRows - offset;
    if (limit !== null && limit !== undefined) {
      rowsToRead = Math.min(rowsToRead, Number(limit));
    }

    var data = sheet.getRange(startDataRow, 1, rowsToRead, lastCol).getValues();

    var fechaColIdx = -1;
    for (var hi = 0; hi < headers.length; hi++) {
      if (normalizeText_(headers[hi]).indexOf("fecha") !== -1) {
        fechaColIdx = hi;
        break;
      }
    }

    var rows = [];
    var fechaMin = null;
    var fechaMax = null;

    for (var i = 0; i < data.length; i++) {
      var row = data[i];

      if (row.every(function (c) {
        return c === "" || c === null || c === undefined;
      })) {
        continue;
      }

      var obj = {};

      if (compact && config.sheet === "ROP05 nuevo") {
        obj = buildCompactROP05Row_(headers, row);
      } else {
        headers.forEach(function (h, j) {
          var val = row[j];
          obj[h] = val instanceof Date
            ? formatDate(val)
            : (val === null || val === undefined ? "" : String(val).trim());
        });
      }

      if (config.proyecto) {
        var proyKey = findKey(obj, ["proyecto", "project"]);
        if (!proyKey || !obj[proyKey]) {
          obj["Proyecto"] = config.proyecto;
          obj["proyecto"] = config.proyecto;
        }
      }

      if (fechaColIdx !== -1) {
        var rawFechaVal = row[fechaColIdx];
        var fechaStr = rawFechaVal instanceof Date
          ? formatDate(rawFechaVal)
          : String(rawFechaVal || "").trim();

        if (fechaStr) {
          if (fechaMin === null || fechaStr < fechaMin) fechaMin = fechaStr;
          if (fechaMax === null || fechaStr > fechaMax) fechaMax = fechaStr;
        }
      }

      rows.push(obj);
    }

    var nextOffset = offset + rowsToRead;
    var hasMore = nextOffset < totalDataRows;

    return {
      ok: true,
      data: rows,
      totalRows: totalDataRows,
      offset: offset,
      limit: limit,
      hasMore: hasMore,
      nextOffset: hasMore ? nextOffset : null,
      sheetNameUsed: sheet.getName(),
      sheetGidUsed: sheet.getSheetId(),
      lastRow: lastRow,
      fechaRange: {
        min: fechaMin,
        max: fechaMax,
        columna: fechaColIdx !== -1 ? headers[fechaColIdx] : null
      },
      headerRow: headerRow
    };

  } catch (err) {
    return {
      ok: false,
      error: {
        code: "FETCH_ERROR",
        message: err.message
      }
    };
  }
}

function buildCompactROP05Row_(headers, row) {
  function value(index) {
    var v = row[index];
    if (v instanceof Date) return formatDate(v);
    return v === null || v === undefined ? "" : String(v).trim();
  }

  return {
    "Fecha": value(0),
    "Fecha del Parte Diario": value(0),

    "Supervisor": value(1),
    "Proyecto": value(2),

    "Codigo Int": value(3),
    "Código Interno del Equipo": value(3),
    "Interno": value(3),

    "N° de Parte": value(4),
    "Parte": value(4),

    "Tipo Equipo": value(5),
    "Equipo": value(5),

    "Tarea": value(6),

    "Hs": value(7),
    "Horas": value(7),

    "Largo": value(8),
    "Ancho": value(9),
    "Profundidad": value(10),

    "Cantidad": value(11),
    "CantidadProduccion": value(11),

    "Unidad": value(12),
    "Unidad de productividad": value(12),

    "Observación": value(13),
    "Observacion": value(13),
    "Observaciones": value(13),

    "Mes": value(14)
  };
}

function getLimit_(params, defaultValue) {
  params = params || {};
  var raw = params.limit;

  if (raw === null || raw === undefined || raw === "") {
    return defaultValue === undefined ? null : defaultValue;
  }

  if (String(raw).toLowerCase() === "all") return null;

  var n = Number(raw);
  if (isNaN(n) || n <= 0) {
    return defaultValue === undefined ? null : defaultValue;
  }

  return Math.min(n, 2000);
}

function getOffset_(params) {
  params = params || {};
  var n = Number(params.offset || 0);
  return isNaN(n) || n < 0 ? 0 : n;
}

function handleHealth() {
  var sources = {};
  var allOk = true;

  Object.keys(SHEETS_CONFIG).forEach(function (key) {
    var config = SHEETS_CONFIG[key];
    var start = new Date().getTime();

    try {
      var ss = SpreadsheetApp.openById(config.id);
      var sheet = findSheetByGidOrName(ss, config.gid, config.sheet);

      if (!sheet) {
        allOk = false;
        sources[key] = {
          ok: false,
          label: config.label,
          sheet: config.sheet,
          headerRow: config.headerRow,
          latency: new Date().getTime() - start,
          error: {
            code: "SHEET_NOT_FOUND",
            message: "No se encontró la hoja '" + config.sheet + "'."
          }
        };
        return;
      }

      var lastRow = sheet.getLastRow();
      var lastCol = sheet.getLastColumn();
      var headerRow = (config.autoHeader === true || String(config.headerRow).toLowerCase() === "auto")
        ? detectHeaderRow_(sheet, lastRow, lastCol)
        : config.headerRow;

      sources[key] = {
        ok: lastRow >= headerRow,
        label: config.label,
        sheet: config.sheet,
        headerRow: headerRow,
        latency: new Date().getTime() - start,
        rows: Math.max(0, lastRow - headerRow),
        sheetNameUsed: sheet.getName(),
        sheetGidUsed: sheet.getSheetId(),
        lastRow: lastRow,
        lastCol: lastCol
      };

      if (lastRow < headerRow) allOk = false;

    } catch (err) {
      allOk = false;
      sources[key] = {
        ok: false,
        label: config.label,
        sheet: config.sheet,
        headerRow: config.headerRow,
        latency: new Date().getTime() - start,
        error: {
          code: "HEALTH_ERROR",
          message: err.message
        }
      };
    }
  });

  return {
    ok: allOk,
    sources: sources,
    checkedAt: new Date().toISOString()
  };
}

function handleDiag() {
  var result = {
    ok: true,
    sources: {},
    checkedAt: new Date().toISOString()
  };

  Object.keys(SHEETS_CONFIG).forEach(function (key) {
    var config = SHEETS_CONFIG[key];
    var fetched = fetchSheetData(config, { limit: 5, offset: 0 });

    if (fetched.ok) {
      result.sources[key] = {
        ok: true,
        label: config.label,
        configuredGid: config.gid,
        configuredSheetName: config.sheet,
        sheetNameUsed: fetched.sheetNameUsed,
        sheetGidUsed: fetched.sheetGidUsed,
        lastRow: fetched.lastRow,
        rows: fetched.totalRows,
        muestra: fetched.data.length,
        fechaRange: fetched.fechaRange
      };
    } else {
      result.sources[key] = {
        ok: false,
        label: config.label,
        configuredGid: config.gid,
        configuredSheetName: config.sheet,
        error: fetched.error
      };
    }
  });

  return result;
}


function normalizeHeaderText_(v) {
  return String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectHeaderRow_(sheet, lastRow, lastCol) {
  var maxScanRows = Math.min(lastRow, 40);
  var maxScanCols = Math.min(lastCol, 40);
  var values = sheet.getRange(1, 1, maxScanRows, maxScanCols).getValues();

  var headerGroups = [
    ["empresa", "company"],
    ["n sol", "n solicitud", "nro solicitud", "numero solicitud", "solicitud", "raba01"],
    ["proyecto", "centro costo", "centro de costo", "cc", "obra", "sector"],
    ["codigo", "cod", "articulo", "item"],
    ["descripcion", "detalle", "material", "insumo", "producto"],
    ["pedido por", "solicitante", "solicitado por", "pide", "usuario"],
    ["f sol", "fecha sol", "fecha solicitud", "fecha de solicitud", "fecha"],
    ["f req", "fecha req", "fecha requerida", "fecha de requerida"],
    ["remito", "raba08", "entrega", "estado entrega"],
    ["cantidad", "cant", "cantidad solicitada"]
  ];

  var bestRow = 1;
  var bestScore = -1;

  for (var r = 0; r < values.length; r++) {
    var row = values[r];
    var rowNorm = row.map(function (v) { return normalizeHeaderText_(v); });
    var nonEmpty = rowNorm.filter(function (v) { return v; }).length;
    if (!nonEmpty) continue;

    var score = 0;
    headerGroups.forEach(function (group) {
      var hit = false;
      for (var c = 0; c < rowNorm.length; c++) {
        var cell = rowNorm[c];
        if (!cell) continue;
        for (var g = 0; g < group.length; g++) {
          var wanted = normalizeHeaderText_(group[g]);
          if (cell === wanted || cell.indexOf(wanted) !== -1 || wanted.indexOf(cell) !== -1) {
            hit = true;
            break;
          }
        }
        if (hit) break;
      }
      if (hit) score += 1;
    });

    // Desempate: preferir filas con varios encabezados no vacíos.
    score += Math.min(nonEmpty, 12) / 100;

    if (score > bestScore) {
      bestScore = score;
      bestRow = r + 1;
    }
  }

  return bestScore >= 2 ? bestRow : 1;
}

function findSheetByGidOrName(ss, gid, name) {
  var sheets = ss.getSheets();

  // Para fuentes como RABA03, donde todavía no fijamos nombre/GID,
  // tomar la primera hoja con datos.
  if ((gid === null || gid === undefined || String(gid).trim() === "") &&
      (name === null || name === undefined || String(name).trim() === "")) {
    for (var s = 0; s < sheets.length; s++) {
      if (sheets[s].getLastRow() > 0 && sheets[s].getLastColumn() > 0) return sheets[s];
    }
    return sheets[0] || null;
  }

  if (gid !== null && gid !== undefined && String(gid).trim() !== "") {
    var gidNum = parseInt(gid, 10);

    if (!isNaN(gidNum)) {
      for (var i = 0; i < sheets.length; i++) {
        if (sheets[i].getSheetId() === gidNum) return sheets[i];
      }
    }
  }

  var wantedName = String(name || "").trim();

  if (wantedName) {
    for (var j = 0; j < sheets.length; j++) {
      if (sheets[j].getName().trim() === wantedName) {
        return sheets[j];
      }
    }
  }

  // Para fuentes configuradas solo con ID, usar la primera hoja visible.
  // Esto permite conectar RABA03 aunque todavía no esté definido el nombre exacto de la pestaña.
  return sheets.length ? sheets[0] : null;
}

function findKey(obj, candidates) {
  var keys = Object.keys(obj || {});

  for (var i = 0; i < candidates.length; i++) {
    var c = normalizeText_(candidates[i]);

    for (var j = 0; j < keys.length; j++) {
      if (normalizeText_(keys[j]).indexOf(c) !== -1) {
        return keys[j];
      }
    }
  }

  return null;
}

function normalizeText_(v) {
  return String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDate(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return "";

  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, "0");
  var day = String(d.getDate()).padStart(2, "0");

  return y + "-" + m + "-" + day;
}

function clearAllCache_() {
  try {
    var cache = CacheService.getScriptCache();
    var keys = ["dm_read_all"];

    Object.keys(SHEETS_CONFIG).forEach(function (key) {
      keys.push("dm_read_" + key);

      var version = getDatasetVersion_(key);
      [0].forEach(function (offset) {
        ["null", "250", "500", "1000", "2000"].forEach(function (limit) {
          keys.push("dm_json_" + key + "_v" + version + "_o" + offset + "_l" + limit + "_c0");
          keys.push("dm_json_" + key + "_v" + version + "_o" + offset + "_l" + limit + "_c1");
        });
      });
    });

    cache.removeAll(keys);
  } catch (e) {
    console.error("No se pudo limpiar la caché:", e);
  }
}


function handleUsuariosAutorizados_() {
  var VERSION = "USUARIOS_AUTORIZADOS_V34";
  var config = SHEETS_CONFIG.usuarios;

  if (!config) {
    return {
      ok: false,
      version: VERSION,
      error: {
        code: "USUARIOS_CONFIG_MISSING",
        message: "No está configurada la hoja de usuarios."
      }
    };
  }

  var ss = SpreadsheetApp.openById(config.id);
  var sheet = findSheetByGidOrName(ss, config.gid, config.sheet);

  if (!sheet) {
    return {
      ok: false,
      version: VERSION,
      error: {
        code: "USUARIOS_SHEET_NOT_FOUND",
        message: "No se encontró la hoja de usuarios. Verificar nombre: " + config.sheet
      }
    };
  }

  var headerRow = Number(config.headerRow || 1);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow <= headerRow || lastCol < 1) {
    return {
      ok: true,
      version: VERSION,
      action: "usuarios",
      rows: 0,
      data: [],
      message: "La hoja de usuarios no tiene datos."
    };
  }

  var headers = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0].map(function(h, idx) {
    return String(h || "").trim() || ("col_" + (idx + 1));
  });

  function normHeader(v) {
    return String(v || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function findIdx(candidates, fallback) {
    var wanted = candidates.map(normHeader);

    for (var i = 0; i < headers.length; i++) {
      var h = normHeader(headers[i]);
      for (var j = 0; j < wanted.length; j++) {
        if (h === wanted[j]) return i;
      }
    }

    for (var a = 0; a < headers.length; a++) {
      var hh = normHeader(headers[a]);
      for (var b = 0; b < wanted.length; b++) {
        if (hh.indexOf(wanted[b]) !== -1 || wanted[b].indexOf(hh) !== -1) return a;
      }
    }

    return fallback;
  }

  // Formato real del Excel:
  // A: Email | B: Rol | C: Proyecto | D: Activo
  var emailIdx = findIdx(["Email", "Mail", "Correo", "Correo electrónico", "Correo electronico", "Usuario", "User"], 0);
  var rolIdx = findIdx(["Rol", "Role", "Permiso", "Perfil"], 1);
  var proyectoIdx = findIdx(["Proyecto", "Centro de costo", "Centro de Costo", "Obra"], 2);
  var activoIdx = findIdx(["Activo", "Habilitado", "Estado", "Acceso"], 3);

  var values = sheet.getRange(headerRow + 1, 1, lastRow - headerRow, lastCol).getValues();
  var data = [];

  values.forEach(function(row) {
    var email = String(row[emailIdx] || "").trim().toLowerCase();
    if (!email) return;

    var activoRaw = activoIdx >= 0 && activoIdx < row.length
      ? String(row[activoIdx] || "SI").trim().toUpperCase()
      : "SI";

    // Si está vacío, se toma como activo.
    var activoNorm = activoRaw || "SI";

    if (
      activoNorm === "NO" ||
      activoNorm === "FALSE" ||
      activoNorm === "0" ||
      activoNorm === "INACTIVO" ||
      activoNorm === "BAJA"
    ) {
      return;
    }

    var rol = rolIdx >= 0 && rolIdx < row.length
      ? String(row[rolIdx] || "USUARIO").trim().toUpperCase()
      : "USUARIO";

    var proyecto = proyectoIdx >= 0 && proyectoIdx < row.length
      ? String(row[proyectoIdx] || "TODOS").trim().toUpperCase()
      : "TODOS";

    data.push({
      email: email,
      rol: rol,
      role: rol,          // alias para compatibilidad con React
      proyecto: proyecto,
      project: proyecto,  // alias para compatibilidad con React
      activo: activoNorm
    });
  });

  return {
    ok: true,
    version: VERSION,
    action: "usuarios",
    sheetNameUsed: sheet.getName(),
    headerRowUsed: headerRow,
    rows: data.length,
    data: data,
    fetchedAt: new Date().toISOString()
  };
}

function buildResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/*******************************************************
 * ESCRITURA DESDE LA APP WEB
 * - add_lista_equipo
 * - update_lista_equipo
 * - update_rop02_row
 *******************************************************/

function handleAddListaEquipo_(rowObj) {
  var config = SHEETS_CONFIG.lista_equipos;
  var ss = SpreadsheetApp.openById(config.id);
  var sheet = findSheetByGidOrName(ss, config.gid, config.sheet);
  if (!sheet) {
    return { ok: false, error: { code: "SHEET_NOT_FOUND", message: "No se encontró la hoja de Lista Maestra de Equipos." } };
  }

  var headers = getHeaders_(sheet, config.headerRow);
  var values = headers.map(function (h) {
    return normalizeWriteValue_(getValueByHeader_(rowObj, h));
  });

  var nextRow = Math.max(sheet.getLastRow() + 1, config.headerRow + 1);
  sheet.getRange(nextRow, 1, 1, headers.length).setValues([values]);

  try { clearAllCache_(); bumpDatasetVersion_("lista_equipos"); } catch (e) {}

  return {
    ok: true,
    action: "add_lista_equipo",
    rowNumber: nextRow,
    message: "Equipo agregado correctamente."
  };
}

function handleUpdateListaEquipo_(originalKeys, rowObj) {
  var config = SHEETS_CONFIG.lista_equipos;
  var ss = SpreadsheetApp.openById(config.id);
  var sheet = findSheetByGidOrName(ss, config.gid, config.sheet);
  if (!sheet) {
    return { ok: false, error: { code: "SHEET_NOT_FOUND", message: "No se encontró la hoja de Lista Maestra de Equipos." } };
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= config.headerRow) {
    return { ok: false, error: { code: "EMPTY_SHEET", message: "La Lista Maestra no tiene datos para actualizar." } };
  }

  var headers = getHeaders_(sheet, config.headerRow);
  var data = sheet.getRange(config.headerRow + 1, 1, lastRow - config.headerRow, lastCol).getValues();

  // Encabezados reales según tu Excel Lista de Equipos:
  // A: Código de Drusila | B: Codigo nuevo | C: Familia | D: Marca | E: Modelo | ...
  var drusilaHeader = originalKeys.codigoDrusilaHeader || findHeader_(headers, [
    "Código de Drusila", "Codigo de Drusila", "Código Drusila", "Codigo Drusila", "Cod Drusila", "Cod. Drusila", "Interno Drusila"
  ]);
  var nuevoHeader = originalKeys.codigoNuevoHeader || findHeader_(headers, [
    "Codigo nuevo", "Código nuevo", "Código Nuevo", "Codigo Nuevo", "Cod Nuevo", "Cod. Nuevo"
  ]);

  var drusilaIdx = headerIndex_(headers, drusilaHeader);
  var nuevoIdx = headerIndex_(headers, nuevoHeader);

  // La búsqueda se arma con TODO lo que puede identificar al equipo:
  // - claves originales enviadas por React
  // - valores editados del formulario
  // - variantes tipo "MNC-0015 — C338"
  var lookupRaw = [];
  function pushLookup_(v) {
    if (v === null || v === undefined) return;
    var t = String(v).trim();
    if (!t) return;
    lookupRaw.push(t);
    // Si viene "MNC-0015 — C338" o "MNC-0015 / C338", probar partes separadas.
    t.split(/[\/|,;–—]+/).forEach(function (part) {
      part = String(part || "").trim();
      if (part) lookupRaw.push(part);
    });
  }

  pushLookup_(originalKeys.codigoDrusila);
  pushLookup_(originalKeys.codigoNuevo);
  pushLookup_(originalKeys.codigoPrincipal);
  pushLookup_(originalKeys.codigoDrusilaNorm);
  pushLookup_(originalKeys.codigoNuevoNorm);
  (originalKeys.lookupKeys || []).forEach(pushLookup_);

  // Respaldo: también mirar los campos enviados en la fila editada.
  Object.keys(rowObj || {}).forEach(function (k) {
    var nk = normalizeText_(k);
    if (
      nk.indexOf("codigo") !== -1 ||
      nk.indexOf("cod ") !== -1 ||
      nk.indexOf("drusila") !== -1 ||
      nk.indexOf("interno") !== -1 ||
      nk.indexOf("nuevo") !== -1 ||
      nk.indexOf("modelo") !== -1
    ) {
      pushLookup_(rowObj[k]);
    }
  });

  var lookupNorm = uniqueArray_(lookupRaw.map(normalizeMachineCode_).filter(Boolean));

  if (!lookupNorm.length) {
    return { ok: false, error: { code: "NO_LOOKUP_KEY", message: "No llegó ningún código para buscar el equipo." } };
  }

  var foundIndex = -1;
  var matchedBy = "";

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var candidates = [];

    // Prioridad: columnas correctas de la Lista Maestra.
    if (drusilaIdx !== -1) candidates.push(row[drusilaIdx]);
    if (nuevoIdx !== -1) candidates.push(row[nuevoIdx]);

    // Respaldo definitivo: recorrer toda la fila. Esto evita que falle si el encabezado cambia.
    for (var c = 0; c < row.length; c++) candidates.push(row[c]);

    for (var j = 0; j < candidates.length; j++) {
      var candRaw = candidates[j];
      var candNorm = normalizeMachineCode_(candRaw);
      if (!candNorm) continue;

      // Coincidencia exacta normalizada: MNC-0015 == MNC0015.
      if (lookupNorm.indexOf(candNorm) !== -1) {
        foundIndex = i;
        matchedBy = String(candRaw || "");
        break;
      }
    }

    if (foundIndex !== -1) break;
  }

  if (foundIndex === -1) {
    return {
      ok: false,
      error: {
        code: "EQUIPO_NOT_FOUND",
        message: "No se encontró el equipo en lista equipos. Buscado: " + lookupRaw.join(" / ")
      }
    };
  }

  var targetRowNumber = config.headerRow + 1 + foundIndex;
  var currentValues = sheet.getRange(targetRowNumber, 1, 1, lastCol).getValues()[0];
  var newValues = currentValues.slice();

  // Actualizar usando coincidencia flexible contra los encabezados reales.
  Object.keys(rowObj || {}).forEach(function (key) {
    var idx = headerIndex_(headers, key);
    if (idx === -1) idx = findHeaderIndexFlexible_(headers, key);
    if (idx !== -1) newValues[idx] = normalizeWriteValue_(rowObj[key]);
  });

  sheet.getRange(targetRowNumber, 1, 1, lastCol).setValues([newValues]);

  try { clearAllCache_(); bumpDatasetVersion_("lista_equipos"); } catch (e) {}

  return {
    ok: true,
    action: "update_lista_equipo",
    rowNumber: targetRowNumber,
    matchedBy: matchedBy,
    message: "Equipo actualizado correctamente."
  };
}


function handleBulkUpdateListaEquiposFromApp_(updates) {
  var VERSION = "LISTA_EQUIPOS_BULK_APP_V1";
  updates = updates || [];

  if (!Array.isArray(updates) || updates.length === 0) {
    return {
      ok: false,
      version: VERSION,
      error: { code: "NO_UPDATES", message: "No llegaron diferencias para actualizar." }
    };
  }

  var updatedRows = 0;
  var skippedRows = 0;
  var failedRows = 0;
  var errors = [];

  updates.forEach(function (item, index) {
    try {
      var originalKeys = item.originalKeys || {};
      var row = item.row || {};
      var hasValues = Object.keys(row).some(function (k) {
        return row[k] !== null && row[k] !== undefined && String(row[k]).trim() !== "";
      });

      if (!hasValues) {
        skippedRows++;
        return;
      }

      var res = handleUpdateListaEquipo_(originalKeys, row);
      if (res && res.ok) {
        updatedRows++;
      } else {
        failedRows++;
        errors.push({
          index: index,
          code: res && res.error ? res.error.code : "UNKNOWN_ERROR",
          message: res && res.error ? res.error.message : "No se pudo actualizar la fila."
        });
      }
    } catch (err) {
      failedRows++;
      errors.push({ index: index, code: "EXCEPTION", message: err.message });
    }
  });

  try { clearAllCache_(); bumpDatasetVersion_("lista_equipos"); } catch (e) {}

  return {
    ok: failedRows === 0,
    version: VERSION,
    action: "bulk_update_lista_equipos_from_app",
    updatedRows: updatedRows,
    skippedRows: skippedRows,
    failedRows: failedRows,
    errors: errors.slice(0, 20),
    message: failedRows === 0
      ? (updatedRows + " equipos actualizados correctamente en Lista Maestra.")
      : (updatedRows + " equipos actualizados, " + failedRows + " con error.")
  };
}

function findHeaderIndexFlexible_(headers, key) {
  var wanted = normalizeText_(key);
  if (!wanted) return -1;

  for (var i = 0; i < headers.length; i++) {
    if (normalizeText_(headers[i]) === wanted) return i;
  }

  // Alias para los encabezados del Excel Lista de Equipos.
  var aliases = {
    "codigo drusila": ["codigo de drusila", "codigo drusila", "cod drusila"],
    "codigo de drusila": ["codigo de drusila", "codigo drusila", "cod drusila"],
    "codigo nuevo": ["codigo nuevo", "cod nuevo"],
    "familia": ["familia", "familia topadora retro pala etc"],
    "propiedad": ["propiedad", "propiedad nombre de la empresa o si es propio"],
    "n serie": ["n de serie", "n serie", "numero de serie"],
    "potencia": ["potencia"],
    "ano fabricacion": ["ano de fabricacion", "año de fabricacion"],
    "fecha ingreso": ["fecha de ingreso a la empresa", "fecha ingreso"],
    "horometro": ["horas"],
    "horas": ["horas"],
    "costo local usd siva": ["costo local en dolares sin iva", "costo local usd siva"],
    "tipo combustible": ["tipo de combustible", "tipo combustible"],
    "capacidad": ["capacidad balde litros etc", "capacidad"],
    "tarifa mensual alquiler": ["tarifa mensual de alquiler en dolares", "tarifa mensual alquiler"],
    "horas trab x mes": ["horas trab por mes", "horas trab x mes"],
    "cant neumaticos": ["cantidad de neumaticos", "cant neumaticos"],
    "costo neumatico usdu": ["costo de neumaticos en dolares por unidad", "costo neumatico usdu"],
    "combustible ltshs y kmhs": ["combustible ltshs y kmlts", "combustible lts hs y km lts"],
    "vida util hskm": ["vida util hskm", "vida util hs km"],
    "horas hombre mecanico": ["horas hombre mecanico"],
    "lugar de alquiler": ["lugar de alquiler"]
  };

  var possible = aliases[wanted] || [wanted];
  for (var a = 0; a < possible.length; a++) {
    var p = normalizeText_(possible[a]);
    for (var h = 0; h < headers.length; h++) {
      var hh = normalizeText_(headers[h]);
      if (hh === p || hh.indexOf(p) !== -1 || p.indexOf(hh) !== -1) return h;
    }
  }

  return -1;
}

function handleUpdateROP02Row_(target, rowKey, fields) {
  var key = String(target || "").toLowerCase().trim();
  var config = SHEETS_CONFIG[key];

  if (!config) {
    return { ok: false, error: { code: "INVALID_ROP02_TARGET", message: "Destino ROP02 inválido: " + target } };
  }

  var ss = SpreadsheetApp.openById(config.id);
  var sheet = findSheetByGidOrName(ss, config.gid, config.sheet);
  if (!sheet) {
    return { ok: false, error: { code: "SHEET_NOT_FOUND", message: "No se encontró la hoja destino." } };
  }

  var headers = getHeaders_(sheet, config.headerRow);
  var lastRow = sheet.getLastRow();
  if (lastRow <= config.headerRow) {
    return { ok: false, error: { code: "EMPTY_SHEET", message: "La hoja no tiene datos para actualizar." } };
  }

  var rowNumber = Number(rowKey.rowNumber || rowKey.fila || rowKey.row || 0);

  if (!rowNumber || rowNumber <= config.headerRow || rowNumber > lastRow) {
    return { ok: false, error: { code: "ROW_NUMBER_REQUIRED", message: "Para actualizar ROP02 falta un número de fila válido." } };
  }

  var values = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  Object.keys(fields || {}).forEach(function (keyField) {
    var idx = headerIndex_(headers, keyField);
    if (idx !== -1) values[idx] = normalizeWriteValue_(fields[keyField]);
  });

  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([values]);
  try { clearAllCache_(); bumpDatasetVersion_(key); } catch (e) {}

  return { ok: true, action: "update_rop02_row", rowNumber: rowNumber, message: "Fila actualizada correctamente." };
}

function getHeaders_(sheet, headerRow) {
  var lastCol = sheet.getLastColumn();
  return sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0].map(function (h, idx) {
    return String(h || "").trim() || ("col_" + idx);
  });
}

function getValueByHeader_(obj, header) {
  if (!obj) return "";
  if (Object.prototype.hasOwnProperty.call(obj, header)) return obj[header];

  var wanted = normalizeText_(header);
  var keys = Object.keys(obj);
  for (var i = 0; i < keys.length; i++) {
    if (normalizeText_(keys[i]) === wanted) return obj[keys[i]];
  }
  return "";
}

function findHeader_(headers, candidates) {
  for (var i = 0; i < candidates.length; i++) {
    var wanted = normalizeText_(candidates[i]);
    for (var j = 0; j < headers.length; j++) {
      if (normalizeText_(headers[j]) === wanted) return headers[j];
    }
  }
  for (var c = 0; c < candidates.length; c++) {
    var partial = normalizeText_(candidates[c]);
    for (var h = 0; h < headers.length; h++) {
      if (normalizeText_(headers[h]).indexOf(partial) !== -1) return headers[h];
    }
  }
  return "";
}

function headerIndex_(headers, header) {
  if (!header) return -1;
  var wanted = normalizeText_(header);
  for (var i = 0; i < headers.length; i++) {
    if (normalizeText_(headers[i]) === wanted) return i;
  }
  return -1;
}

function normalizeMachineCode_(v) {
  return String(v || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[()]/g, " ")
    .replace(/[^A-Z0-9]+/g, "")
    .trim();
}

function normalizeWriteValue_(v) {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v;
  return String(v).trim();
}

function uniqueArray_(arr) {
  var out = [];
  (arr || []).forEach(function (v) {
    if (v && out.indexOf(v) === -1) out.push(v);
  });
  return out;
}

/*******************************************************
 * ABASTECIMIENTO — CARGA MASIVA RABA03 DESDE EXCEL
 * Encabezados esperados en el Excel subido desde la app:
 * Empresa | Fecha de solicitud | Fecha requerida del producto | Autorizado por:
 * Centro de Costo | Código de articulo | Descripción de lo que se pidio | Cant.Solicitada
 *******************************************************/

function handleAddRABA03Rows_(rows) {
  rows = rows || [];
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, error: { code: "NO_ROWS", message: "No llegaron filas para cargar en RABA03." } };
  }

  var config = SHEETS_CONFIG.raba03;
  if (!config) {
    return { ok: false, error: { code: "RABA03_CONFIG_MISSING", message: "No existe la configuración raba03 en SHEETS_CONFIG." } };
  }

  var ss = SpreadsheetApp.openById(config.id);
  var sheet = findSheetByGidOrName(ss, config.gid, config.sheet);
  if (!sheet) {
    return { ok: false, error: { code: "SHEET_NOT_FOUND", message: "No se encontró la hoja RABA03." } };
  }

  var headerRow = config.headerRow || 6;
  var headers = getHeaders_(sheet, headerRow);
  var lastCol = headers.length;
  var lastRow = sheet.getLastRow();

  var nSolicitudIdx = findHeaderIndexByCandidatesRABA03_(headers, [
    "N° de solicitud", "Nº de solicitud", "N de solicitud", "Numero de solicitud", "Número de solicitud", "Solicitud"
  ]);

  function normalizeDateForKey_(v) {
    var d = parseDateRABA03_(v);
    if (d instanceof Date && !isNaN(d.getTime())) {
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }
    return normalizeText_(v);
  }

  function normalizeCodeForKey_(v) {
    return String(v || "")
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9]+/g, "")
      .trim();
  }

  function readNormalizedInput_(row) {
    row = row || {};
    return {
      empresa: getFlexibleValueRABA03_(row, ["empresa", "Empresa"]),
      fechaSolicitud: getFlexibleValueRABA03_(row, ["fechaSolicitud", "Fecha de solicitud", "Fecha solicitud"]),
      fechaRequerida: getFlexibleValueRABA03_(row, ["fechaRequerida", "Fecha requerida del producto", "Fecha requerida"]),
      pedidoPor: getFlexibleValueRABA03_(row, ["pedidoPor", "Autorizado por:", "Autorizado por", "Pedido por"]),
      centroCosto: normalizeCentroCostoRABA03_(getFlexibleValueRABA03_(row, ["centroCosto", "Centro de Costo", "Centro de costo", "Proyecto"])),
      codigoArticulo: getFlexibleValueRABA03_(row, ["codigoArticulo", "Código de articulo", "Código de artículo", "Codigo de articulo", "Codigo de artículo", "Código", "Codigo"]),
      descripcion: getFlexibleValueRABA03_(row, ["descripcion", "Descripción de lo que se pidio", "Descripción de lo que se pidió", "Descripcion de lo que se pidio", "Descripcion de lo que se pidió", "Descripción", "Descripcion"]),
      cantidadSolicitada: parseNumberRABA03_(getFlexibleValueRABA03_(row, ["cantidadSolicitada", "Cant.Solicitada", "Cant. Solicitada", "Cantidad solicitada", "Cantidad"]))
    };
  }

  function readNormalizedSheetRow_(values) {
    function get(cands) {
      var idx = findHeaderIndexByCandidatesRABA03_(headers, cands);
      return idx === -1 ? "" : values[idx];
    }
    return {
      empresa: get(["Empresa"]),
      fechaSolicitud: get(["Fecha de solicitud", "Fecha solicitud"]),
      fechaRequerida: get(["Fecha requerida del producto", "Fecha requerida"]),
      pedidoPor: get(["Pedido por", "Autorizado por", "Autorizado por:"]),
      centroCosto: normalizeCentroCostoRABA03_(get(["Centro de Costo", "Centro de costo", "Centro Costo", "Proyecto"])),
      codigoArticulo: get(["Código de articulo", "Código de artículo", "Codigo de articulo", "Codigo de artículo", "Código artículo", "Codigo articulo", "Código", "Codigo"]),
      descripcion: get(["Descripción de lo que se pidio", "Descripción de lo que se pidió", "Descripcion de lo que se pidio", "Descripcion de lo que se pidió", "Descripción", "Descripcion"]),
      cantidadSolicitada: parseNumberRABA03_(get(["Cant.Solicitada", "Cant. Solicitada", "Cantidad solicitada", "Cant Solicitada", "Cantidad"]))
    };
  }

  function buildKey_(r) {
    return [
      normalizeText_(r.empresa),
      normalizeDateForKey_(r.fechaSolicitud),
      normalizeDateForKey_(r.fechaRequerida),
      normalizeText_(r.pedidoPor),
      normalizeText_(r.centroCosto),
      normalizeCodeForKey_(r.codigoArticulo),
      normalizeText_(r.descripcion)
    ].join("|");
  }

  function buildValues_(r, nSolicitud) {
    var values = new Array(lastCol).fill("");
    setByHeaderCandidatesRABA03_(values, headers, ["N° de solicitud", "Nº de solicitud", "N de solicitud", "Numero de solicitud", "Número de solicitud", "Solicitud"], nSolicitud);
    setByHeaderCandidatesRABA03_(values, headers, ["Empresa"], r.empresa);
    setByHeaderCandidatesRABA03_(values, headers, ["Fecha de solicitud", "Fecha solicitud"], parseDateRABA03_(r.fechaSolicitud));
    setByHeaderCandidatesRABA03_(values, headers, ["Fecha requerida del producto", "Fecha requerida"], parseDateRABA03_(r.fechaRequerida));
    setByHeaderCandidatesRABA03_(values, headers, ["Pedido por", "Autorizado por", "Autorizado por:"], r.pedidoPor);
    setByHeaderCandidatesRABA03_(values, headers, ["Centro de Costo", "Centro de costo", "Centro Costo", "Proyecto"], r.centroCosto);
    setByHeaderCandidatesRABA03_(values, headers, ["Código de articulo", "Código de artículo", "Codigo de articulo", "Codigo de artículo", "Código artículo", "Codigo articulo", "Código", "Codigo"], r.codigoArticulo);
    setByHeaderCandidatesRABA03_(values, headers, ["Descripción de lo que se pidio", "Descripción de lo que se pidió", "Descripcion de lo que se pidio", "Descripcion de lo que se pidió", "Descripción", "Descripcion"], r.descripcion);
    setByHeaderCandidatesRABA03_(values, headers, ["Cant.Solicitada", "Cant. Solicitada", "Cantidad solicitada", "Cant Solicitada", "Cantidad"], r.cantidadSolicitada);
    return values;
  }

  var existingMap = {};
  var nextNumber = 1;
  if (lastRow > headerRow) {
    var existingValues = sheet.getRange(headerRow + 1, 1, lastRow - headerRow, lastCol).getValues();
    for (var er = 0; er < existingValues.length; er++) {
      var rowNumber = headerRow + 1 + er;
      var values = existingValues[er];
      var normalized = readNormalizedSheetRow_(values);
      var key = buildKey_(normalized);
      if (key.replace(/\|/g, "")) existingMap[key] = { rowNumber: rowNumber, values: values };

      if (nSolicitudIdx !== -1) {
        var n = parseInt(String(values[nSolicitudIdx] || "").replace(/[^0-9]/g, ""), 10);
        if (!isNaN(n) && n >= nextNumber) nextNumber = n + 1;
      }
    }
  }

  var toAppend = [];
  var updatedRows = 0;
  var insertedRows = 0;
  var skippedRows = 0;

  rows.forEach(function (row) {
    var normalized = readNormalizedInput_(row);
    var hasData = [normalized.empresa, normalized.fechaSolicitud, normalized.fechaRequerida, normalized.pedidoPor, normalized.centroCosto, normalized.codigoArticulo, normalized.descripcion, normalized.cantidadSolicitada].some(function (v) {
      return String(v || "").trim() !== "";
    });
    if (!hasData) {
      skippedRows++;
      return;
    }

    var key = buildKey_(normalized);
    var existing = existingMap[key];

    if (existing) {
      var oldNumber = nSolicitudIdx !== -1 ? existing.values[nSolicitudIdx] : "";
      var updatedValues = buildValues_(normalized, oldNumber || "");
      // Mantener columnas no importadas que ya existían en la hoja.
      for (var c = 0; c < lastCol; c++) {
        if (updatedValues[c] === "" && existing.values[c] !== "") updatedValues[c] = existing.values[c];
      }
      sheet.getRange(existing.rowNumber, 1, 1, lastCol).setValues([updatedValues]);
      updatedRows++;
    } else {
      var newValues = buildValues_(normalized, nextNumber + insertedRows);
      toAppend.push(newValues);
      existingMap[key] = { rowNumber: null, values: newValues };
      insertedRows++;
    }
  });

  if (toAppend.length) {
    var startRow = Math.max(sheet.getLastRow() + 1, headerRow + 1);
    sheet.getRange(startRow, 1, toAppend.length, lastCol).setValues(toAppend);
  }

  if (!insertedRows && !updatedRows) {
    return { ok: false, error: { code: "NO_VALID_ROWS", message: "No se encontraron filas válidas para cargar o actualizar." } };
  }

  try { clearAllCache_(); bumpDatasetVersion_("raba03"); } catch (e) {}

  return {
    ok: true,
    action: "add_raba03_rows",
    mode: "upsert",
    insertedRows: insertedRows,
    updatedRows: updatedRows,
    skippedRows: skippedRows,
    message: "Solicitudes RABA03 cargadas/actualizadas correctamente."
  };
}

function findHeaderIndexByCandidatesRABA03_(headers, candidates) {
  for (var i = 0; i < candidates.length; i++) {
    var wanted = normalizeText_(candidates[i]);
    for (var j = 0; j < headers.length; j++) {
      var h = normalizeText_(headers[j]);
      if (h === wanted || h.indexOf(wanted) !== -1 || wanted.indexOf(h) !== -1) return j;
    }
  }
  return -1;
}

function setByHeaderCandidatesRABA03_(values, headers, candidates, value) {
  var idx = findHeaderIndexByCandidatesRABA03_(headers, candidates);
  if (idx !== -1) values[idx] = normalizeWriteValue_(value);
}

function getFlexibleValueRABA03_(obj, candidates) {
  var keys = Object.keys(obj || {});
  for (var i = 0; i < candidates.length; i++) {
    var wanted = normalizeText_(candidates[i]);
    for (var k = 0; k < keys.length; k++) {
      if (normalizeText_(keys[k]) === wanted) return obj[keys[k]];
    }
  }
  for (var c = 0; c < candidates.length; c++) {
    var partial = normalizeText_(candidates[c]);
    for (var j = 0; j < keys.length; j++) {
      var nk = normalizeText_(keys[j]);
      if (nk && (nk.indexOf(partial) !== -1 || partial.indexOf(nk) !== -1)) return obj[keys[j]];
    }
  }
  return "";
}

function parseNumberRABA03_(v) {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;

  var txt = String(v).trim().replace(/\s/g, "");
  if (!txt) return 0;

  var hasComma = txt.indexOf(",") !== -1;
  var hasDot = txt.indexOf(".") !== -1;

  if (hasComma && hasDot) {
    txt = txt.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    txt = txt.replace(",", ".");
  } else if (hasDot) {
    var parts = txt.split(".");
    var isThousands = parts.length > 1 && parts.slice(1).every(function (p) { return p.length === 3; });
    if (isThousands) txt = parts.join("");
  }

  var n = Number(txt);
  return isNaN(n) ? 0 : n;
}

function parseDateRABA03_(v) {
  if (v === null || v === undefined || v === "") return "";
  if (v instanceof Date && !isNaN(v.getTime())) return v;

  var txt = String(v).trim();
  if (!txt) return "";

  var dm = txt.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2}|\d{4})$/);
  if (dm) {
    var y = Number(dm[3]);
    if (y < 100) y += 2000;
    return new Date(y, Number(dm[2]) - 1, Number(dm[1]));
  }

  var iso = txt.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  return txt;
}

function normalizeCentroCostoRABA03_(v) {
  var t = normalizeText_(v);
  if (!t) return "";
  if (t.indexOf("jose maria") !== -1 || t.indexOf("josemaria") !== -1 || t === "jm") return "JOSE MARIA";
  if (t.indexOf("filo del sol") !== -1 || t.indexOf("filo") !== -1 || t === "fs" || t === "fds") return "FILO DEL SOL";
  if (t.indexOf("oficina") !== -1 || t.indexOf("deposito") !== -1 || t.indexOf("admin") !== -1) return "OFICINA";
  return String(v || "").trim().toUpperCase();
}





/*******************************************************
 * ABASTECIMIENTO — CARGA MASIVA RABA03 SAFE V2
 * Acción nueva recomendada desde React:
 * upsert_raba03_rows_safe_v2
 *
 * Esta versión NO usa ningún headerRow dinámico nulo.
 * - Encabezados destino: fila 6.
 * - Datos destino: desde fila 7.
 * - Si existe una solicitud igual, actualiza.
 * - Si no existe, inserta.
 *******************************************************/

function handleAddRABA03Rows_SAFE_V2_(rows) {
  var VERSION = "RABA03_SAFE_V2_20260706_1905";
  rows = rows || [];

  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      ok: false,
      version: VERSION,
      error: { code: "NO_ROWS", message: "No llegaron filas para cargar en RABA03." }
    };
  }

  var config = SHEETS_CONFIG && SHEETS_CONFIG.raba03;
  if (!config) {
    return {
      ok: false,
      version: VERSION,
      error: { code: "RABA03_CONFIG_MISSING", message: "No existe la configuración raba03 en SHEETS_CONFIG." }
    };
  }

  var ss = SpreadsheetApp.openById(config.id);
  var sheet = findSheetByGidOrName(ss, config.gid, config.sheet);
  if (!sheet) {
    return {
      ok: false,
      version: VERSION,
      error: { code: "SHEET_NOT_FOUND", message: "No se encontró la hoja RABA03." }
    };
  }

  // Fijo y seguro: tu RABA03 tiene encabezados en fila 6.
  var headerRow = 6;
  var firstDataRow = 7;

  var lastRow = Math.max(sheet.getLastRow(), headerRow);
  var lastCol = Math.max(sheet.getLastColumn(), 16);

  var headers = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0].map(function (h, idx) {
    return String(h || "").trim() || ("col_" + (idx + 1));
  });

  function hidx(candidates) {
    var idx = findHeaderIndexByCandidatesRABA03_(headers, candidates);
    return idx;
  }

  var idx = {
    nSolicitud: hidx(["N° de solicitud", "Nº de solicitud", "N de solicitud", "Numero de solicitud", "Número de solicitud", "Solicitud"]),
    empresa: hidx(["Empresa"]),
    fechaSolicitud: hidx(["Fecha de solicitud", "Fecha solicitud"]),
    fechaRequerida: hidx(["Fecha requerida del producto", "Fecha requerida"]),
    pedidoPor: hidx(["Pedido por", "Autorizado por", "Autorizado por:"]),
    centroCosto: hidx(["Centro de Costo", "Centro de costo", "Centro Costo", "Proyecto"]),
    codigoArticulo: hidx(["Código de articulo", "Código de artículo", "Codigo de articulo", "Codigo de artículo", "Código artículo", "Codigo articulo", "Código", "Codigo"]),
    descripcion: hidx(["Descripción de lo que se pidio", "Descripción de lo que se pidió", "Descripcion de lo que se pidio", "Descripcion de lo que se pidió", "Descripción", "Descripcion"]),
    cantidadSolicitada: hidx(["Cant.Solicitada", "Cant. Solicitada", "Cantidad solicitada", "Cant Solicitada", "Cantidad"])
  };

  // Respaldo por posición del Excel/RABA03 si algún encabezado viene distinto.
  // A:N° solicitud, B:Empresa, C:Fecha solicitud, D:Fecha requerida, E:Pedido por,
  // F:Centro de costo, G:Código, H:Descripción, I:Cantidad.
  if (idx.nSolicitud === -1) idx.nSolicitud = 0;
  if (idx.empresa === -1) idx.empresa = 1;
  if (idx.fechaSolicitud === -1) idx.fechaSolicitud = 2;
  if (idx.fechaRequerida === -1) idx.fechaRequerida = 3;
  if (idx.pedidoPor === -1) idx.pedidoPor = 4;
  if (idx.centroCosto === -1) idx.centroCosto = 5;
  if (idx.codigoArticulo === -1) idx.codigoArticulo = 6;
  if (idx.descripcion === -1) idx.descripcion = 7;
  if (idx.cantidadSolicitada === -1) idx.cantidadSolicitada = 8;

  function normCode(v) {
    return String(v || "")
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9]+/g, "")
      .trim();
  }

  function normDateKey(v) {
    var d = parseDateRABA03_(v);
    if (d instanceof Date && !isNaN(d.getTime())) {
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }
    return normalizeText_(v);
  }

  function readInput(row) {
    row = row || {};
    return {
      empresa: getFlexibleValueRABA03_(row, ["empresa", "Empresa"]),
      fechaSolicitud: getFlexibleValueRABA03_(row, ["fechaSolicitud", "Fecha de solicitud", "Fecha solicitud"]),
      fechaRequerida: getFlexibleValueRABA03_(row, ["fechaRequerida", "Fecha requerida del producto", "Fecha requerida"]),
      pedidoPor: getFlexibleValueRABA03_(row, ["pedidoPor", "Autorizado por:", "Autorizado por", "Pedido por"]),
      centroCosto: normalizeCentroCostoRABA03_(getFlexibleValueRABA03_(row, ["centroCosto", "Centro de Costo", "Centro de costo", "Proyecto"])),
      codigoArticulo: getFlexibleValueRABA03_(row, ["codigoArticulo", "Código de articulo", "Código de artículo", "Codigo de articulo", "Codigo de artículo", "Código", "Codigo"]),
      descripcion: getFlexibleValueRABA03_(row, ["descripcion", "Descripción de lo que se pidio", "Descripción de lo que se pidió", "Descripcion de lo que se pidio", "Descripcion de lo que se pidió", "Descripción", "Descripcion"]),
      cantidadSolicitada: parseNumberRABA03_(getFlexibleValueRABA03_(row, ["cantidadSolicitada", "Cant.Solicitada", "Cant. Solicitada", "Cantidad solicitada", "Cantidad"]))
    };
  }

  function readSheet(values) {
    return {
      empresa: values[idx.empresa] || "",
      fechaSolicitud: values[idx.fechaSolicitud] || "",
      fechaRequerida: values[idx.fechaRequerida] || "",
      pedidoPor: values[idx.pedidoPor] || "",
      centroCosto: normalizeCentroCostoRABA03_(values[idx.centroCosto] || ""),
      codigoArticulo: values[idx.codigoArticulo] || "",
      descripcion: values[idx.descripcion] || "",
      cantidadSolicitada: parseNumberRABA03_(values[idx.cantidadSolicitada] || "")
    };
  }

  function keyOf(r) {
    return [
      normalizeText_(r.empresa),
      normDateKey(r.fechaSolicitud),
      normDateKey(r.fechaRequerida),
      normalizeText_(r.pedidoPor),
      normalizeText_(r.centroCosto),
      normCode(r.codigoArticulo),
      normalizeText_(r.descripcion)
    ].join("|");
  }

  function isValid(r) {
    return [
      r.empresa,
      r.fechaSolicitud,
      r.fechaRequerida,
      r.pedidoPor,
      r.centroCosto,
      r.codigoArticulo,
      r.descripcion,
      r.cantidadSolicitada
    ].some(function (v) { return String(v || "").trim() !== ""; });
  }

  function makeValues(r, nSolicitud, existingValues) {
    var values = existingValues ? existingValues.slice() : new Array(lastCol).fill("");

    values[idx.nSolicitud] = nSolicitud;
    values[idx.empresa] = normalizeWriteValue_(r.empresa);
    values[idx.fechaSolicitud] = normalizeWriteValue_(parseDateRABA03_(r.fechaSolicitud));
    values[idx.fechaRequerida] = normalizeWriteValue_(parseDateRABA03_(r.fechaRequerida));
    values[idx.pedidoPor] = normalizeWriteValue_(r.pedidoPor);
    values[idx.centroCosto] = normalizeWriteValue_(r.centroCosto);
    values[idx.codigoArticulo] = normalizeWriteValue_(r.codigoArticulo);
    values[idx.descripcion] = normalizeWriteValue_(r.descripcion);
    values[idx.cantidadSolicitada] = normalizeWriteValue_(r.cantidadSolicitada);

    return values;
  }

  var existingMap = {};
  var nextNumber = 1;

  if (lastRow >= firstDataRow) {
    var numExistingRows = lastRow - headerRow;
    if (numExistingRows > 0) {
      var existingValues = sheet.getRange(firstDataRow, 1, numExistingRows, lastCol).getValues();

      for (var i = 0; i < existingValues.length; i++) {
        var vals = existingValues[i];
        var r = readSheet(vals);
        var k = keyOf(r);
        if (k.replace(/\|/g, "")) {
          existingMap[k] = { rowNumber: firstDataRow + i, values: vals };
        }

        var n = parseInt(String(vals[idx.nSolicitud] || "").replace(/[^0-9]/g, ""), 10);
        if (!isNaN(n) && n >= nextNumber) nextNumber = n + 1;
      }
    }
  }

  var toAppend = [];
  var insertedRows = 0;
  var updatedRows = 0;
  var skippedRows = 0;

  rows.forEach(function (row) {
    var r = readInput(row);
    if (!isValid(r)) {
      skippedRows++;
      return;
    }

    var k = keyOf(r);
    var existing = existingMap[k];

    if (existing && existing.rowNumber) {
      var oldNumber = existing.values[idx.nSolicitud] || "";
      var updateVals = makeValues(r, oldNumber, existing.values);
      sheet.getRange(existing.rowNumber, 1, 1, lastCol).setValues([updateVals]);
      updatedRows++;
    } else {
      var newNumber = nextNumber + insertedRows;
      var appendVals = makeValues(r, newNumber, null);
      toAppend.push(appendVals);
      existingMap[k] = { rowNumber: null, values: appendVals };
      insertedRows++;
    }
  });

  if (toAppend.length > 0) {
    var appendStartRow = Math.max(sheet.getLastRow() + 1, firstDataRow);
    sheet.getRange(appendStartRow, 1, toAppend.length, lastCol).setValues(toAppend);
  }

  if (!insertedRows && !updatedRows) {
    return {
      ok: false,
      version: VERSION,
      error: { code: "NO_VALID_ROWS", message: "No se encontraron filas válidas para cargar o actualizar." },
      skippedRows: skippedRows
    };
  }

  try { clearAllCache_(); bumpDatasetVersion_("raba03"); } catch (e) {}

  return {
    ok: true,
    version: VERSION,
    action: "upsert_raba03_rows_safe_v2",
    mode: "upsert",
    insertedRows: insertedRows,
    updatedRows: updatedRows,
    skippedRows: skippedRows,
    headerRowUsed: headerRow,
    firstDataRow: firstDataRow,
    lastCol: lastCol,
    message: "Solicitudes RABA03 cargadas/actualizadas correctamente."
  };
}



/*******************************************************
 * ABASTECIMIENTO — RABA03 APPEND ONLY + GUARDAR DATOS
 * v22
 * - add_raba03_rows_append_only: SIEMPRE agrega filas nuevas.
 * - Si detecta repetidas dentro del archivo, solo avisa en la respuesta.
 * - save_raba03_cant_enviada: guarda Cant. enviada en RABA03 base.
 *******************************************************/

function handleAddRABA03Rows_APPEND_ONLY_(rows) {
  var VERSION = "RABA03_APPEND_ONLY_V22";
  rows = rows || [];

  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, version: VERSION, error: { code: "NO_ROWS", message: "No llegaron filas para cargar en RABA03." } };
  }

  var config = SHEETS_CONFIG && SHEETS_CONFIG.raba03;
  if (!config) {
    return { ok: false, version: VERSION, error: { code: "RABA03_CONFIG_MISSING", message: "No existe la configuración raba03 en SHEETS_CONFIG." } };
  }

  var ss = SpreadsheetApp.openById(config.id);
  var sheet = findSheetByGidOrName(ss, config.gid, config.sheet);
  if (!sheet) {
    return { ok: false, version: VERSION, error: { code: "SHEET_NOT_FOUND", message: "No se encontró la hoja RABA03." } };
  }

  var headerRow = 6;
  var firstDataRow = 7;
  var lastCol = Math.max(sheet.getLastColumn(), 16);
  var lastRow = Math.max(sheet.getLastRow(), headerRow);
  var headers = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0].map(function (h, idx) {
    return String(h || "").trim() || ("col_" + (idx + 1));
  });

  function hidx(candidates, fallback) {
    var idx = findHeaderIndexByCandidatesRABA03_(headers, candidates);
    return idx === -1 ? fallback : idx;
  }

  var idx = {
    nSolicitud: hidx(["N° de solicitud", "Nº de solicitud", "N de solicitud", "Numero de solicitud", "Número de solicitud", "Solicitud"], 0),
    empresa: hidx(["Empresa"], 1),
    fechaSolicitud: hidx(["Fecha de solicitud", "Fecha solicitud", "Fecha de so"], 2),
    fechaRequerida: hidx(["Fecha requerida del producto", "Fecha requerida", "Fecha reque"], 3),
    pedidoPor: hidx(["Pedido por", "Autorizado por", "Autorizado por:"], 4),
    centroCosto: hidx(["Centro de Costo", "Centro de costo", "Centro Costo", "Proyecto"], 5),
    codigoArticulo: hidx(["Código de articulo", "Código de artículo", "Codigo de articulo", "Codigo de artículo", "Código artículo", "Codigo articulo", "Código", "Codigo"], 6),
    descripcion: hidx(["Descripción de lo que se pidio", "Descripción de lo que se pidió", "Descripcion de lo que se pidio", "Descripcion de lo que se pidió", "Descripción", "Descripcion"], 7),
    cantidadSolicitada: hidx(["Cant.Solicitada", "Cant. Solicitada", "Cantidad solicitada", "Cant Solicitada", "Cantidad"], 8),
    cantidadEnviada: hidx(["Cant. Enviada", "Cant Enviada", "Cantidad enviada", "Cantidad Enviada"], 9)
  };

  function readInput(row) {
    row = row || {};
    return {
      empresa: getFlexibleValueRABA03_(row, ["empresa", "Empresa"]),
      fechaSolicitud: getFlexibleValueRABA03_(row, ["fechaSolicitud", "Fecha de solicitud", "Fecha solicitud"]),
      fechaRequerida: getFlexibleValueRABA03_(row, ["fechaRequerida", "Fecha requerida del producto", "Fecha requerida"]),
      pedidoPor: getFlexibleValueRABA03_(row, ["pedidoPor", "Autorizado por:", "Autorizado por", "Pedido por"]),
      centroCosto: normalizeCentroCostoRABA03_(getFlexibleValueRABA03_(row, ["centroCosto", "Centro de Costo", "Centro de costo", "Proyecto"])),
      codigoArticulo: getFlexibleValueRABA03_(row, ["codigoArticulo", "Código de articulo", "Código de artículo", "Codigo de articulo", "Codigo de artículo", "Código", "Codigo"]),
      descripcion: getFlexibleValueRABA03_(row, ["descripcion", "Descripción de lo que se pidio", "Descripción de lo que se pidió", "Descripcion de lo que se pidio", "Descripcion de lo que se pidió", "Descripción", "Descripcion"]),
      cantidadSolicitada: parseNumberRABA03_(getFlexibleValueRABA03_(row, ["cantidadSolicitada", "Cant.Solicitada", "Cant. Solicitada", "Cantidad solicitada", "Cantidad"]))
    };
  }

  function normCode(v) {
    return String(v || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]+/g, "").trim();
  }

  function normDateKey(v) {
    var d = parseDateRABA03_(v);
    if (d instanceof Date && !isNaN(d.getTime())) {
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }
    return normalizeText_(v);
  }

  function keyOf(r) {
    return [
      normalizeText_(r.empresa),
      normDateKey(r.fechaSolicitud),
      normDateKey(r.fechaRequerida),
      normalizeText_(r.pedidoPor),
      normalizeText_(r.centroCosto),
      normCode(r.codigoArticulo),
      normalizeText_(r.descripcion),
      String(parseNumberRABA03_(r.cantidadSolicitada))
    ].join("|");
  }

  function isValid(r) {
    return [r.empresa, r.fechaSolicitud, r.fechaRequerida, r.pedidoPor, r.centroCosto, r.codigoArticulo, r.descripcion, r.cantidadSolicitada]
      .some(function (v) { return String(v || "").trim() !== ""; });
  }

  var nextNumber = 1;
  if (lastRow >= firstDataRow) {
    var existingNums = sheet.getRange(firstDataRow, idx.nSolicitud + 1, lastRow - headerRow, 1).getValues();
    for (var n = 0; n < existingNums.length; n++) {
      var val = parseInt(String(existingNums[n][0] || "").replace(/[^0-9]/g, ""), 10);
      if (!isNaN(val) && val >= nextNumber) nextNumber = val + 1;
    }
  }

  var prepared = [];
  var keyCount = {};
  var skippedRows = 0;
  rows.forEach(function (row) {
    var r = readInput(row);
    if (!isValid(r)) {
      skippedRows++;
      return;
    }
    var k = keyOf(r);
    keyCount[k] = (keyCount[k] || 0) + 1;
    prepared.push({ row: r, key: k });
  });

  var duplicateRows = prepared.filter(function (x) { return keyCount[x.key] > 1; }).length;
  var valuesToAppend = [];
  prepared.forEach(function (x, i) {
    var r = x.row;
    var vals = new Array(lastCol).fill("");
    vals[idx.nSolicitud] = nextNumber + i;
    vals[idx.empresa] = normalizeWriteValue_(r.empresa);
    vals[idx.fechaSolicitud] = normalizeWriteValue_(parseDateRABA03_(r.fechaSolicitud));
    vals[idx.fechaRequerida] = normalizeWriteValue_(parseDateRABA03_(r.fechaRequerida));
    vals[idx.pedidoPor] = normalizeWriteValue_(r.pedidoPor);
    vals[idx.centroCosto] = normalizeWriteValue_(r.centroCosto);
    vals[idx.codigoArticulo] = normalizeWriteValue_(r.codigoArticulo);
    vals[idx.descripcion] = normalizeWriteValue_(r.descripcion);
    vals[idx.cantidadSolicitada] = normalizeWriteValue_(r.cantidadSolicitada);
    if (idx.cantidadEnviada !== -1) vals[idx.cantidadEnviada] = 0;
    valuesToAppend.push(vals);
  });

  if (!valuesToAppend.length) {
    return { ok: false, version: VERSION, error: { code: "NO_VALID_ROWS", message: "No se encontraron filas válidas para cargar." }, skippedRows: skippedRows };
  }

  var appendStartRow = Math.max(sheet.getLastRow() + 1, firstDataRow);
  sheet.getRange(appendStartRow, 1, valuesToAppend.length, lastCol).setValues(valuesToAppend);

  try { clearAllCache_(); bumpDatasetVersion_("raba03"); } catch (e) {}

  return {
    ok: true,
    version: VERSION,
    action: "add_raba03_rows_append_only",
    mode: "append_only",
    insertedRows: valuesToAppend.length,
    duplicateRows: duplicateRows,
    skippedRows: skippedRows,
    message: "Solicitudes agregadas correctamente. No se actualizó ninguna fila existente."
  };
}

function handleSaveRABA03CantEnviada_(rows) {
  var VERSION = "RABA03_SAVE_DATOS_V23";
  rows = rows || [];
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, version: VERSION, error: { code: "NO_ROWS", message: "No llegaron filas para guardar." } };
  }

  var config = SHEETS_CONFIG && SHEETS_CONFIG.raba03;
  if (!config) {
    return { ok: false, version: VERSION, error: { code: "RABA03_CONFIG_MISSING", message: "No existe la configuración raba03 en SHEETS_CONFIG." } };
  }

  var ss = SpreadsheetApp.openById(config.id);
  var sheet = findSheetByGidOrName(ss, config.gid, config.sheet);
  if (!sheet) {
    return { ok: false, version: VERSION, error: { code: "SHEET_NOT_FOUND", message: "No se encontró la hoja RABA03." } };
  }

  var headerRow = 6;
  var firstDataRow = 7;
  var lastRow = sheet.getLastRow();
  var lastCol = Math.max(sheet.getLastColumn(), 16);
  if (lastRow < firstDataRow) {
    return { ok: false, version: VERSION, error: { code: "EMPTY_SHEET", message: "La hoja RABA03 no tiene filas para actualizar." } };
  }

  var headers = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0].map(function (h, idx) {
    return String(h || "").trim() || ("col_" + (idx + 1));
  });

  var nIdx = findHeaderIndexByCandidatesRABA03_(headers, ["N° de solicitud", "Nº de solicitud", "N de solicitud", "Numero de solicitud", "Número de solicitud", "Solicitud"]);
  var enviadaIdx = findHeaderIndexByCandidatesRABA03_(headers, ["Cant. Enviada", "Cant Enviada", "Cantidad enviada", "Cantidad Enviada"]);

  // Fallbacks por posición fija de la planilla base:
  // A = N° solicitud, J = Cant. enviada, L = Nº Remito, M = Fecha de salida, N = Cantidad.
  if (nIdx === -1) nIdx = 0;
  if (enviadaIdx === -1) enviadaIdx = 9;
  var remitoIdx = 11;
  var fechaSalidaIdx = 12;
  var cantidadRemitoIdx = 13;

  var data = sheet.getRange(firstDataRow, 1, lastRow - headerRow, lastCol).getValues();
  var rowBySolicitud = {};
  for (var i = 0; i < data.length; i++) {
    var n = String(data[i][nIdx] || "").replace(/[^0-9]/g, "").trim();
    if (n) rowBySolicitud[n] = i;
  }

  function cleanText_(v) {
    if (v === null || v === undefined) return "";
    return String(v).trim();
  }

  var updatedRows = 0;
  rows.forEach(function (r) {
    var n = String((r && r.nSolicitud) || "").replace(/[^0-9]/g, "").trim();
    if (!n || rowBySolicitud[n] === undefined) return;

    var idxRow = rowBySolicitud[n];

    // J: Cant. enviada
    data[idxRow][enviadaIdx] = parseNumberRABA03_((r && r.cantidadEnviada) || 0);

    // L: Nº Remito
    data[idxRow][remitoIdx] = cleanText_(r && (r.numeroRemito || r.nRemito || r.remito));

    // M: Fecha de salida
    data[idxRow][fechaSalidaIdx] = cleanText_(r && (r.fechaSalida || r.fechaRemito));

    // N: Cantidad
    data[idxRow][cantidadRemitoIdx] = parseNumberRABA03_((r && (r.cantidad || r.cantidadRemito)) || 0);

    updatedRows++;
  });

  if (updatedRows > 0) {
    sheet.getRange(firstDataRow, 1, data.length, lastCol).setValues(data);
  }

  try { clearAllCache_(); bumpDatasetVersion_("raba03"); } catch (e) {}

  return {
    ok: true,
    version: VERSION,
    action: "save_raba03_cant_enviada",
    updatedRows: updatedRows,
    message: updatedRows + " filas actualizadas en RABA03 base (Cant. enviada, Nº Remito, Fecha de salida y Cantidad)."
  };
}

/*******************************************************
 * ABASTECIMIENTO — EDITAR CÓDIGOS RABA03
 * v28
 * Acción: save_raba03_codigos
 * - Busca por N° de solicitud.
 * - Actualiza únicamente la columna Código de artículo.
 *******************************************************/
function handleSaveRABA03Codigos_(rows) {
  var VERSION = "RABA03_SAVE_CODIGOS_V28";
  rows = rows || [];
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, version: VERSION, error: { code: "NO_ROWS", message: "No llegaron códigos para guardar." } };
  }

  var config = SHEETS_CONFIG && SHEETS_CONFIG.raba03;
  if (!config) {
    return { ok: false, version: VERSION, error: { code: "RABA03_CONFIG_MISSING", message: "No existe la configuración raba03 en SHEETS_CONFIG." } };
  }

  var ss = SpreadsheetApp.openById(config.id);
  var sheet = findSheetByGidOrName(ss, config.gid, config.sheet);
  if (!sheet) {
    return { ok: false, version: VERSION, error: { code: "SHEET_NOT_FOUND", message: "No se encontró la hoja RABA03." } };
  }

  var headerRow = 6;
  var firstDataRow = 7;
  var lastRow = sheet.getLastRow();
  var lastCol = Math.max(sheet.getLastColumn(), 16);
  if (lastRow < firstDataRow) {
    return { ok: false, version: VERSION, error: { code: "EMPTY_SHEET", message: "La hoja RABA03 no tiene filas para actualizar." } };
  }

  var headers = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0].map(function (h, idx) {
    return String(h || "").trim() || ("col_" + (idx + 1));
  });

  var nIdx = findHeaderIndexByCandidatesRABA03_(headers, ["N° de solicitud", "Nº de solicitud", "N de solicitud", "Numero de solicitud", "Número de solicitud", "Solicitud"]);
  var codigoIdx = findHeaderIndexByCandidatesRABA03_(headers, ["Código de articulo", "Código de artículo", "Codigo de articulo", "Codigo de artículo", "Código artículo", "Codigo articulo", "Código", "Codigo"]);

  // Fallbacks por posición fija de la planilla base:
  // A = N° solicitud, G = Código de artículo.
  if (nIdx === -1) nIdx = 0;
  if (codigoIdx === -1) codigoIdx = 6;

  var data = sheet.getRange(firstDataRow, 1, lastRow - headerRow, lastCol).getValues();
  var rowBySolicitud = {};
  for (var i = 0; i < data.length; i++) {
    var n = String(data[i][nIdx] || "").replace(/[^0-9]/g, "").trim();
    if (n) rowBySolicitud[n] = i;
  }

  var updatedRows = 0;
  var notFoundRows = 0;
  rows.forEach(function (r) {
    var n = String((r && r.nSolicitud) || "").replace(/[^0-9]/g, "").trim();
    if (!n || rowBySolicitud[n] === undefined) {
      notFoundRows++;
      return;
    }
    var idxRow = rowBySolicitud[n];
    data[idxRow][codigoIdx] = String((r && r.codigoArticulo) || "").trim();
    updatedRows++;
  });

  if (updatedRows > 0) {
    sheet.getRange(firstDataRow, 1, data.length, lastCol).setValues(data);
  }

  try { clearAllCache_(); bumpDatasetVersion_("raba03"); } catch (e) {}

  return {
    ok: true,
    version: VERSION,
    action: "save_raba03_codigos",
    updatedRows: updatedRows,
    notFoundRows: notFoundRows,
    message: updatedRows + " códigos actualizados en RABA03 base."
  };
}




/*******************************************************
 * MANTENIMIENTO PROGRAMADO — PM / RMA24
 * Base: 1jmTZ2_aJai-t1uj-sZB8MK1a6J47oXeiG5GIO_Gk6u4
 *******************************************************/
var PM_DB_ID_ = "1jmTZ2_aJai-t1uj-sZB8MK1a6J47oXeiG5GIO_Gk6u4";

function getPMDatabase_() {
  var ss = SpreadsheetApp.openById(PM_DB_ID_);
  var defs = {
    PM_CONFIG: [
      "INTERNO", "EQUIPO", "PROYECTO", "INTERVALO_HS", "ALERTA_DESDE_HS",
      "ATRASADO_DESDE_HS", "HOROMETRO_ULTIMO_PM", "FECHA_ULTIMO_PM",
      "TIPO_ULTIMO_PM", "HOROMETRO_ACTUAL_MANUAL", "ACTIVO",
      "OBSERVACIONES", "USUARIO_MODIFICACION", "FECHA_MODIFICACION"
    ],
    PM_REGISTROS: [
      "ID_PM", "INTERNO", "EQUIPO", "PROYECTO", "FECHA", "HOROMETRO",
      "TIPO_PM", "TECNICO", "N_OT", "OBSERVACIONES", "ESTADO",
      "USUARIO_CARGA", "FECHA_CARGA"
    ]
  };
  var out = {};

  Object.keys(defs).forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet && name === "PM_CONFIG") {
      var first = ss.getSheets()[0];
      if (first && first.getLastRow() <= 1 && first.getLastColumn() <= 1 && !String(first.getRange(1, 1).getValue() || "").trim()) {
        first.setName(name);
        sheet = first;
      }
    }
    if (!sheet) sheet = ss.insertSheet(name);

    var headers = defs[name];
    if (sheet.getMaxColumns() < headers.length) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
    }
    var current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    var mismatch = headers.some(function(h, i) { return String(current[i] || "").trim() !== h; });
    if (mismatch) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight("bold")
        .setBackground("#1a1a1a")
        .setFontColor("#ffffff");
      sheet.setFrozenRows(1);
    }
    out[name] = { sheet: sheet, headers: headers };
  });
  return out;
}

function pmIndex_(headers, name) {
  var wanted = normalizeText_(name);
  for (var i = 0; i < headers.length; i++) {
    if (normalizeText_(headers[i]) === wanted) return i;
  }
  return -1;
}

function pmCellValue_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone() || "America/Argentina/Buenos_Aires", "yyyy-MM-dd");
  return v === null || v === undefined ? "" : String(v).trim();
}

function pmReadRows_(target) {
  var sheet = target.sheet;
  var headers = target.headers;
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values.filter(function(row) {
    return row.some(function(v) { return v !== "" && v !== null && v !== undefined; });
  }).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = pmCellValue_(row[i]); });
    return obj;
  });
}

function pmConfigToClient_(row) {
  return {
    interno: String(row.INTERNO || "").trim(),
    equipo: String(row.EQUIPO || "").trim(),
    proyecto: String(row.PROYECTO || "").trim(),
    intervalo: Number(row.INTERVALO_HS || 250),
    alertaDesde: Number(row.ALERTA_DESDE_HS || 200),
    atrasadoDesde: Number(row.ATRASADO_DESDE_HS || 350),
    horometroUltimoPM: Number(row.HOROMETRO_ULTIMO_PM || 0),
    fechaUltimoPM: String(row.FECHA_ULTIMO_PM || "").slice(0, 10),
    tipoUltimoPM: String(row.TIPO_ULTIMO_PM || "PM 250").trim(),
    horometroActualManual: Number(row.HOROMETRO_ACTUAL_MANUAL || 0),
    activo: String(row.ACTIVO || "SI").trim().toUpperCase(),
    observaciones: String(row.OBSERVACIONES || "").trim()
  };
}

function pmRegistroToClient_(row) {
  return {
    idPM: String(row.ID_PM || "").trim(),
    interno: String(row.INTERNO || "").trim(),
    equipo: String(row.EQUIPO || "").trim(),
    proyecto: String(row.PROYECTO || "").trim(),
    fecha: String(row.FECHA || "").slice(0, 10),
    horometro: Number(row.HOROMETRO || 0),
    tipoPM: String(row.TIPO_PM || "PM 250").trim(),
    tecnico: String(row.TECNICO || "").trim(),
    ot: String(row.N_OT || "").trim(),
    observaciones: String(row.OBSERVACIONES || "").trim(),
    estado: String(row.ESTADO || "REALIZADO").trim()
  };
}


function pmInitialSeed_() {
  return [{"interno":"EXC-0005","equipo":"EXCAVADORA PC200","proyecto":"FILO DEL SOL","fechaUltimoPM":"2026-06-14","horometroUltimoPM":7593.0},{"interno":"EXC-0034","equipo":"EXCAVADORA PC350","proyecto":"FILO DEL SOL","fechaUltimoPM":"2026-06-12","horometroUltimoPM":5911.0},{"interno":"EXC-0048","equipo":"EXCAVADORA PC210","proyecto":"FILO DEL SOL","fechaUltimoPM":"2026-07-01","horometroUltimoPM":4915.0},{"interno":"CFN-0017","equipo":"CARGADORA WA320","proyecto":"JOSE MARIA","fechaUltimoPM":"2026-06-26","horometroUltimoPM":9361.0},{"interno":"PCA-0081","equipo":"CARGADORA WA320","proyecto":"FILO DEL SOL","fechaUltimoPM":"2026-07-01","horometroUltimoPM":2055.0},{"interno":"PCA-0093","equipo":"CARGADORA WA320","proyecto":"FILO DEL SOL","fechaUltimoPM":"2026-05-11","horometroUltimoPM":1351.0},{"interno":"PCA-0095","equipo":"CARGADORA WA320","proyecto":"FILO DEL SOL","fechaUltimoPM":"2026-06-30","horometroUltimoPM":1618.0},{"interno":"MOT-0014","equipo":"MOTONIVELADORA GD655","proyecto":"BAJA","fechaUltimoPM":"2026-04-10","horometroUltimoPM":7062.0},{"interno":"MOT-0047","equipo":"MOTONIVELADORA GD655","proyecto":"FILO DEL SOL","fechaUltimoPM":"2026-07-02","horometroUltimoPM":4417.0},{"interno":"MOT-0079","equipo":"MOTONIVELADORA GD656","proyecto":"FILO DEL SOL","fechaUltimoPM":"2026-06-24","horometroUltimoPM":451.0},{"interno":"TOP-0032","equipo":"TOPADORA D155AX","proyecto":"FILO DEL SOL","fechaUltimoPM":"2026-06-28","horometroUltimoPM":7141.0},{"interno":"TOP-0022","equipo":"TOPADORA D155AX","proyecto":"BAJA","fechaUltimoPM":"2026-01-31","horometroUltimoPM":3734.0},{"interno":"ROD-0001","equipo":"VIBRO AMMANN","proyecto":"BAJA","fechaUltimoPM":"2026-01-03","horometroUltimoPM":2634.0},{"interno":"RCP-0039","equipo":"VIBRO VOLVO","proyecto":"FILO DEL SOL","fechaUltimoPM":"2026-05-19","horometroUltimoPM":537.0},{"interno":"RTP-0020","equipo":"RETROPALA JD310P","proyecto":"FILO DEL SOL","fechaUltimoPM":"2026-06-03","horometroUltimoPM":2552.0},{"interno":"RTP-0016","equipo":"RETROPALA JD310P","proyecto":"BAJA","fechaUltimoPM":"2026-04-20","horometroUltimoPM":2755.0},{"interno":"RTP-0024","equipo":"RETROPALA JD310P","proyecto":"FILO DEL SOL","fechaUltimoPM":"2026-05-05","horometroUltimoPM":1803.0},{"interno":"EXC-0055","equipo":"EXCAVADORA PC210","proyecto":"JOSE MARIA","fechaUltimoPM":"2026-05-18","horometroUltimoPM":2606.0},{"interno":"MCA-0005","equipo":"MINICARGADORA L330","proyecto":"JOSE MARIA","fechaUltimoPM":"2026-07-06","horometroUltimoPM":4853.0},{"interno":"MOT-0049","equipo":"MOTONIVELADORA 670G","proyecto":"JOSE MARIA","fechaUltimoPM":"2026-04-21","horometroUltimoPM":3319.0},{"interno":"MOT-0051","equipo":"MOTONIVELADORA 670G","proyecto":"JOSE MARIA","fechaUltimoPM":"2026-05-11","horometroUltimoPM":5321.0},{"interno":"MOT-0069","equipo":"MOTONIVELADORA 670P","proyecto":"JOSE MARIA","fechaUltimoPM":"2026-07-05","horometroUltimoPM":1708.0},{"interno":"PCA-0021","equipo":"CAGADORA WA320","proyecto":"PREDIO","fechaUltimoPM":"2026-01-29","horometroUltimoPM":8135.0},{"interno":"PCA-0051","equipo":"CARGADORA WA320","proyecto":"BAJA","fechaUltimoPM":"2026-03-11","horometroUltimoPM":4734.0},{"interno":"PCA-0070","equipo":"CAGADORA WA320","proyecto":"JOSE MARIA","fechaUltimoPM":"2026-06-17","horometroUltimoPM":3100.0},{"interno":"PCA-0074","equipo":"CAGADORA WA320","proyecto":"JOSE MARIA","fechaUltimoPM":"2026-06-16","horometroUltimoPM":2320.0},{"interno":"PCA-0101","equipo":"CARGADORA WA320","proyecto":"JOSE MARIA","fechaUltimoPM":"2026-07-06","horometroUltimoPM":1175.0},{"interno":"RCP-0016","equipo":"VIBRO AMMANN","proyecto":"JOSE MARIA","fechaUltimoPM":"2026-05-25","horometroUltimoPM":2955.0},{"interno":"RCP-0036","equipo":"VIBRO AMMANN","proyecto":"JOSE MARIA","fechaUltimoPM":"2026-07-05","horometroUltimoPM":1480.0},{"interno":"RTP-0018","equipo":"RETROPALA CAT416","proyecto":"JOSE MARIA","fechaUltimoPM":"2026-06-07","horometroUltimoPM":4421.0},{"interno":"RTP-0030","equipo":"RETROAPALA CAT416","proyecto":"JOSE MARIA","fechaUltimoPM":"2026-07-01","horometroUltimoPM":1441.0},{"interno":"TOP-0048","equipo":"TOPADORA D155AX","proyecto":"JOSE MARIA","fechaUltimoPM":"2026-06-25","horometroUltimoPM":3206.0},{"interno":"TOP-0051","equipo":"TOPADORA D155AX","proyecto":"JOSE MARIA","fechaUltimoPM":"2026-06-26","horometroUltimoPM":2124.0},{"interno":"TOP-0058","equipo":"TOPADORA D155AX","proyecto":"FILO DEL SOL","fechaUltimoPM":"2026-05-09","horometroUltimoPM":3871.0},{"interno":"G1","equipo":"GENERADOR CAT","proyecto":"FILO DEL SOL","fechaUltimoPM":"2026-06-23","horometroUltimoPM":6604.0},{"interno":"CTA-0805","equipo":"AF374DO","proyecto":"FILO DEL SOL","fechaUltimoPM":"2026-05-27","horometroUltimoPM":159000.0},{"interno":"CTA-0888","equipo":"AH619FB","proyecto":"JOSE MARIA","fechaUltimoPM":"2026-05-22","horometroUltimoPM":43295.0},{"interno":"CTA-0848","equipo":"AH045UV","proyecto":"FILO DEL SOL","fechaUltimoPM":"2026-05-30","horometroUltimoPM":64414.0},{"interno":"CTA-0746","equipo":"AG575LI","proyecto":"FILO DEL SOL","fechaUltimoPM":"2026-03-31","horometroUltimoPM":105478.0},{"interno":"CTA-0745","equipo":"AG575LJ","proyecto":"FILO DEL SOL","fechaUltimoPM":"2026-04-19","horometroUltimoPM":97430.0},{"interno":"CAC-0027","equipo":"AG815QB","proyecto":"FILO DEL SOL","fechaUltimoPM":"2026-06-20","horometroUltimoPM":3500.0},{"interno":"CAC-0023","equipo":"AG661LL","proyecto":"FILO DEL SOL","fechaUltimoPM":"2026-05-19","horometroUltimoPM":5964.0},{"interno":"CTA-1131","equipo":"AG770BO","proyecto":"JOSE MARIA","fechaUltimoPM":"2026-07-03","horometroUltimoPM":69246.0},{"interno":"CAT-0073","equipo":"AE823BH","proyecto":"PREDIO","fechaUltimoPM":"2026-01-04","horometroUltimoPM":3117.0},{"interno":"CTA-0787","equipo":"AG201HX","proyecto":"JOSE MARIA","fechaUltimoPM":"2026-05-01","horometroUltimoPM":105008.0},{"interno":"CTA-0825","equipo":"AG319QB","proyecto":"JOSE MARIA","fechaUltimoPM":"2026-04-28","horometroUltimoPM":112883.0},{"interno":"CTA-1410","equipo":"AH619FA","proyecto":"JOSE MARIA","fechaUltimoPM":"2026-06-30","horometroUltimoPM":38596.0},{"interno":"CTA-1411","equipo":"AH452VY","proyecto":"JOSE MARIA","fechaUltimoPM":"2026-06-27","horometroUltimoPM":51566.0},{"interno":"CTA-0788","equipo":"AG201HO","proyecto":"FILO SUR","fechaUltimoPM":"2026-05-07","horometroUltimoPM":108110.0},{"interno":"CTA-1418","equipo":"AH589MH","proyecto":"GOMERIA","fechaUltimoPM":"2026-05-01","horometroUltimoPM":16035.0},{"interno":"CTA-1267","equipo":"AH106YK","proyecto":"FILO DEL SOL","fechaUltimoPM":"2026-06-13","horometroUltimoPM":78646.0},{"interno":"CTA-1067","equipo":"AG746DF","proyecto":"JOSE MARIA","fechaUltimoPM":"2026-06-09","horometroUltimoPM":107768.0},{"interno":"CTA-0879","equipo":"AG469HA","proyecto":"JOSE MARIA","fechaUltimoPM":"2026-05-07","horometroUltimoPM":108471.0},{"interno":"CAV-0114","equipo":"AH574ZG","proyecto":"JOSE MARIA","fechaUltimoPM":"2026-05-11","horometroUltimoPM":1044.0},{"interno":"CAR-0089","equipo":"AG661LM","proyecto":"JOSE MARIA","fechaUltimoPM":"2026-05-01","horometroUltimoPM":3122.0},{"interno":"CAA-0002","equipo":"AE450BP","proyecto":"JOSE MARIA","fechaUltimoPM":"2026-06-04","horometroUltimoPM":9690.0}];
}

function ensurePMInitialSeed_(db, force) {
  var props = PropertiesService.getScriptProperties();
  var seedVersion = "PM_INITIAL_SEED_ULTIMOS_PM_V3";

  var rows = pmInitialSeed_();
  var inserted = 0;
  var updated = 0;
  var skipped = 0;

  rows.forEach(function(item) {
    var rowNum = pmFindConfigRow_(db.PM_CONFIG, item.interno);
    if (rowNum > 0) {
      var current = db.PM_CONFIG.sheet.getRange(rowNum, 1, 1, db.PM_CONFIG.headers.length).getValues()[0];
      var currentObj = {};
      db.PM_CONFIG.headers.forEach(function(h, i) { currentObj[h] = pmCellValue_(current[i]); });
      var cfg = pmConfigToClient_(currentObj);
      if (Number(cfg.horometroUltimoPM || 0) > 0 && !force) { skipped++; return; }
      pmUpsertConfigUnlocked_(db.PM_CONFIG, {
        interno: item.interno,
        equipo: cfg.equipo || item.equipo,
        proyecto: cfg.proyecto || item.proyecto,
        intervalo: Number(cfg.intervalo || 250),
        alertaDesde: Number(cfg.alertaDesde || 200),
        atrasadoDesde: Number(cfg.atrasadoDesde || 350),
        horometroUltimoPM: Number(item.horometroUltimoPM || 0),
        fechaUltimoPM: item.fechaUltimoPM || "",
        tipoUltimoPM: cfg.tipoUltimoPM || "PM 250",
        horometroActualManual: Number(cfg.horometroActualManual || 0),
        activo: cfg.activo || "SI",
        observaciones: cfg.observaciones || "Importado desde Ultimos_PM_Equipos.xlsx"
      });
      updated++;
    } else {
      pmUpsertConfigUnlocked_(db.PM_CONFIG, {
        interno: item.interno,
        equipo: item.equipo,
        proyecto: item.proyecto,
        intervalo: 250,
        alertaDesde: 200,
        atrasadoDesde: 350,
        horometroUltimoPM: Number(item.horometroUltimoPM || 0),
        fechaUltimoPM: item.fechaUltimoPM || "",
        tipoUltimoPM: "PM 250",
        horometroActualManual: 0,
        activo: "SI",
        observaciones: "Importado desde Ultimos_PM_Equipos.xlsx"
      });
      inserted++;
    }
  });

  props.setProperty(seedVersion, "1");
  SpreadsheetApp.flush();
  return { inserted: inserted, updated: updated, skipped: skipped };
}

function handleGetMantenimientoProgramado_() {
  var db = getPMDatabase_();
  ensurePMInitialSeed_(db, false);
  var config = pmReadRows_(db.PM_CONFIG).map(pmConfigToClient_);
  var registros = pmReadRows_(db.PM_REGISTROS).map(pmRegistroToClient_);
  registros.sort(function(a, b) {
    return String(b.fecha || "").localeCompare(String(a.fecha || "")) || Number(b.horometro || 0) - Number(a.horometro || 0);
  });
  return {
    ok: true,
    action: "mantenimiento_programado",
    config: config,
    registros: registros,
    defaults: { intervalo: 250, alertaDesde: 200, atrasadoDesde: 350 },
    spreadsheetId: PM_DB_ID_,
    fetchedAt: new Date().toISOString()
  };
}

function pmFindConfigRow_(target, interno) {
  var idx = pmIndex_(target.headers, "INTERNO");
  var lastRow = target.sheet.getLastRow();
  if (idx < 0 || lastRow <= 1) return -1;
  var values = target.sheet.getRange(2, idx + 1, lastRow - 1, 1).getDisplayValues();
  var wanted = normalizeMachineCode_(interno);
  for (var i = 0; i < values.length; i++) {
    if (normalizeMachineCode_(values[i][0]) === wanted) return i + 2;
  }
  return -1;
}

function pmBuildConfigRow_(headers, config, existing) {
  var values = existing ? existing.slice() : new Array(headers.length).fill("");
  function set(name, value) {
    var idx = pmIndex_(headers, name);
    if (idx >= 0) values[idx] = value;
  }
  set("INTERNO", String(config.interno || "").trim());
  set("EQUIPO", String(config.equipo || "").trim());
  set("PROYECTO", String(config.proyecto || "").trim());
  set("INTERVALO_HS", Number(config.intervalo || 250));
  set("ALERTA_DESDE_HS", Number(config.alertaDesde || 200));
  set("ATRASADO_DESDE_HS", Number(config.atrasadoDesde || 350));
  set("HOROMETRO_ULTIMO_PM", Number(config.horometroUltimoPM || 0));
  set("FECHA_ULTIMO_PM", config.fechaUltimoPM ? parseDateRABA03_(config.fechaUltimoPM) : "");
  set("TIPO_ULTIMO_PM", String(config.tipoUltimoPM || "PM 250").trim());
  set("HOROMETRO_ACTUAL_MANUAL", Number(config.horometroActualManual || 0));
  set("ACTIVO", String(config.activo || "SI").trim().toUpperCase() === "NO" ? "NO" : "SI");
  set("OBSERVACIONES", String(config.observaciones || "").trim());
  set("USUARIO_MODIFICACION", pmUser_());
  set("FECHA_MODIFICACION", new Date());
  return values;
}

function pmUser_() {
  try { return Session.getActiveUser().getEmail() || "APP"; } catch (e) { return "APP"; }
}

function pmUpsertConfigUnlocked_(target, config) {
  var interno = String(config.interno || "").trim();
  if (!interno) throw new Error("Falta el interno del equipo.");
  var rowNum = pmFindConfigRow_(target, interno);
  var existing = rowNum > 0 ? target.sheet.getRange(rowNum, 1, 1, target.headers.length).getValues()[0] : null;
  var values = pmBuildConfigRow_(target.headers, config, existing);
  if (rowNum > 0) target.sheet.getRange(rowNum, 1, 1, target.headers.length).setValues([values]);
  else {
    rowNum = Math.max(target.sheet.getLastRow() + 1, 2);
    target.sheet.getRange(rowNum, 1, 1, target.headers.length).setValues([values]);
  }
  return rowNum;
}

function handleSavePMConfig_(config) {
  config = config || {};
  if (!String(config.interno || "").trim()) {
    return { ok: false, error: { code: "PM_INTERNO_REQUIRED", message: "Falta seleccionar el equipo." } };
  }
  var intervalo = Number(config.intervalo || 250);
  var alerta = Number(config.alertaDesde || 200);
  var atrasado = Number(config.atrasadoDesde || 350);
  if (intervalo <= 0 || alerta < 0 || atrasado <= alerta) {
    return { ok: false, error: { code: "PM_CONFIG_INVALID", message: "Revisá intervalo, alerta y límite de atraso." } };
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var db = getPMDatabase_();
    var rowNum = pmUpsertConfigUnlocked_(db.PM_CONFIG, config);
    SpreadsheetApp.flush();
    try { bumpDatasetVersion_("pm_config"); clearAllCache_(); } catch (e) {}
    return { ok: true, action: "save_pm_config", rowNumber: rowNum, message: "Configuración PM guardada." };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function handleRegistrarPMRealizado_(registro) {
  registro = registro || {};
  var interno = String(registro.interno || "").trim();
  var horometro = Number(registro.horometro || 0);
  if (!interno || horometro <= 0) {
    return { ok: false, error: { code: "PM_DATA_REQUIRED", message: "Falta el equipo o el horómetro del PM realizado." } };
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var db = getPMDatabase_();
    var fecha = String(registro.fecha || "").trim() || Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "America/Argentina/Buenos_Aires", "yyyy-MM-dd");
    var idPM = "PM-" + new Date().getTime() + "-" + normalizeMachineCode_(interno);
    var row = new Array(db.PM_REGISTROS.headers.length).fill("");
    function set(name, value) {
      var idx = pmIndex_(db.PM_REGISTROS.headers, name);
      if (idx >= 0) row[idx] = value;
    }
    set("ID_PM", idPM);
    set("INTERNO", interno);
    set("EQUIPO", String(registro.equipo || "").trim());
    set("PROYECTO", String(registro.proyecto || "").trim());
    set("FECHA", parseDateRABA03_(fecha));
    set("HOROMETRO", horometro);
    set("TIPO_PM", String(registro.tipoPM || "PM 250").trim());
    set("TECNICO", String(registro.tecnico || "").trim());
    set("N_OT", String(registro.ot || "").trim());
    set("OBSERVACIONES", String(registro.observaciones || "").trim());
    set("ESTADO", "REALIZADO");
    set("USUARIO_CARGA", pmUser_());
    set("FECHA_CARGA", new Date());
    var historyRow = Math.max(db.PM_REGISTROS.sheet.getLastRow() + 1, 2);
    db.PM_REGISTROS.sheet.getRange(historyRow, 1, 1, row.length).setValues([row]);

    var configRowNum = pmFindConfigRow_(db.PM_CONFIG, interno);
    var currentConfig = {};
    if (configRowNum > 0) {
      var cfgRow = db.PM_CONFIG.sheet.getRange(configRowNum, 1, 1, db.PM_CONFIG.headers.length).getValues()[0];
      db.PM_CONFIG.headers.forEach(function(h, i) { currentConfig[h] = pmCellValue_(cfgRow[i]); });
      currentConfig = pmConfigToClient_(currentConfig);
    }
    pmUpsertConfigUnlocked_(db.PM_CONFIG, {
      interno: interno,
      equipo: registro.equipo || currentConfig.equipo || "",
      proyecto: registro.proyecto || currentConfig.proyecto || "",
      intervalo: Number(currentConfig.intervalo || 250),
      alertaDesde: Number(currentConfig.alertaDesde || 200),
      atrasadoDesde: Number(currentConfig.atrasadoDesde || 350),
      horometroUltimoPM: horometro,
      fechaUltimoPM: fecha,
      tipoUltimoPM: registro.tipoPM || "PM 250",
      horometroActualManual: Math.max(horometro, Number(currentConfig.horometroActualManual || 0)),
      activo: currentConfig.activo || "SI",
      observaciones: currentConfig.observaciones || ""
    });

    SpreadsheetApp.flush();
    try { bumpDatasetVersion_("pm_config"); bumpDatasetVersion_("pm_registros"); clearAllCache_(); } catch (e) {}
    return {
      ok: true,
      action: "registrar_pm_realizado",
      idPM: idPM,
      horometroBaseNuevoCiclo: horometro,
      message: "PM registrado como realizado. El nuevo ciclo comienza desde " + horometro + " hs."
    };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/** Ejecutar una vez manualmente para crear y formatear PM_CONFIG y PM_REGISTROS. */
function setupMantenimientoProgramado_() {
  var db = getPMDatabase_();
  var seed = ensurePMInitialSeed_(db, false);
  SpreadsheetApp.flush();
  return {
    ok: true,
    spreadsheetId: PM_DB_ID_,
    sheets: Object.keys(db),
    seed: seed,
    message: "Base de Mantenimiento Programado configurada y últimos PM importados correctamente."
  };
}

/** Reimporta únicamente filas sin base. Usar manualmente si fuera necesario. */
function importarUltimosPMIniciales_() {
  var db = getPMDatabase_();
  PropertiesService.getScriptProperties().deleteProperty("PM_INITIAL_SEED_ULTIMOS_PM_V3");
  return ensurePMInitialSeed_(db, false);
}
