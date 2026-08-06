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
