import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// DELTA Mining / ROP02 / sincronizador de fuentes registradas.
// Correccion 2026-10-29: la fuente rop02_fierro es IMPORTRANGE/ARRAYFORMULA.
// Su contenido puede cambiar sin modificar la fecha de Drive del archivo espejo.
// Para ese dataset: lectura forzada, huella de contenido y bloqueo de reducciones.
// Resto de datasets: comportamiento previo sin cambios.
const VERSION = "2026-10-29-ROP02-FIERRO-FORMULA-SAFE-V3";
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxU-ihsxXTNn2wa5EO1OkSM5FjJ43MwxSx8dY0RjbnJRFBKF0BiNNq7QsuohWxmmeOhog/exec";
const FORMULA_DATASET = "rop02_fierro";
const text = (v) => v === null || v === undefined ? "" : String(v).trim();
const output = (data, status = 200) => new Response(JSON.stringify(data), {status, headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
const urlBase = () => text(Deno.env.get("SUPABASE_URL")).replace(/\/+$/, "");
const secret = () => {
  const raw = text(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  if (raw) return raw;
  try { return text(JSON.parse(text(Deno.env.get("SUPABASE_SECRET_KEYS"))).default); }
  catch { return ""; }
};
const headers = (extra = {}) => {
  const key = secret();
  if (!key) throw Error("SERVICE_ROLE_NOT_CONFIGURED");
  return {apikey:key, ...(key.startsWith("sb_secret_") ? {} : {Authorization:"Bearer "+key}), ...extra};
};
async function request(url, options = {}, timeoutMs = 45000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {...options, signal:controller.signal, redirect:"follow"});
    const body = await response.text();
    if (!response.ok) throw Error("UPSTREAM_HTTP_" + response.status);
    if (!body.trim()) return {response, data:null};
    try { return {response, data:JSON.parse(body)}; }
    catch { throw Error("UPSTREAM_NOT_JSON"); }
  } finally { clearTimeout(timer); }
}
async function rest(path, options = {}, timeoutMs = 30000) {
  return request(urlBase()+"/rest/v1/"+path, {...options, headers:headers(options.headers||{})}, timeoutMs);
}
async function rpc(name, data) {
  const result = await rest("rpc/"+name, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(data)});
  return result.data;
}
function csvDate(value) {
  const v = text(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const match = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2,"0")}-${match[1].padStart(2,"0")}` : "";
}
function numeric(value) {
  let str = text(value).replace(/\s+/g, "");
  if (!str || ["FS","OD","EM"].includes(str.toUpperCase())) return null;
  str = str.replace(/[^0-9,.\-]/g, "");
  if (str.includes(",") && str.includes("."))
    str = str.lastIndexOf(",") > str.lastIndexOf(".") ? str.replace(/\./g, "").replace(",", ".") : str.replace(/,/g, "");
  else if (str.includes(",")) str = str.replace(",", ".");
  const n = Number(str);
  return Number.isFinite(n) ? n : null;
}
function value(row, ...names) {
  const norm = x => text(x).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const desired = new Set(names.map(norm));
  for (const [key,v] of Object.entries(row||{})) if (desired.has(norm(key))) return v;
  return "";
}
function transform(row, config) {
  const sourceRow = Number(row._sourceRow);
  if (!Number.isSafeInteger(sourceRow) || sourceRow <= config.header_row) throw Error("SOURCE_ROW_MISSING_OR_INVALID");
  const fecha = csvDate(value(row,"Fecha","Fecha del Parte Diario"));
  const interno = text(value(row,"Interno","Codigo Interno del Equipo","Codigo Int"));
  if (!fecha || !interno) throw Error("SOURCE_DATE_OR_EQUIPMENT_MISSING");
  const rawHours = text(value(row,"Cant. Hs.","Cant Hs","Horas"));
  const explicitState = ["FS","OD","EM"].includes(rawHours.toUpperCase()) ? rawHours.toUpperCase() : "";
  const obs = text(value(row,"Observaciones"));
  return {
    source_row:sourceRow, fecha, interno, proyecto:config.project,
    equipo:text(value(row,"Equipo")), operador:text(value(row,"Operador")),
    supervisor_delta:text(value(row,"Supervisor Delta")), supervisor_vial_cliente:text(value(row,"Supervisor Vial Cliente")),
    turno_trabajo:text(value(row,"Turno de trabajo","Turno")),
    numero_parte:text(value(row,"N° Parte","Nº Parte","Numero de Parte")),
    horometro_inicial:numeric(value(row,"Horómetro inicial","Horometro inicial")),
    horometro_final:numeric(value(row,"Horómetro final","Horometro final")),
    cantidad_horas:numeric(rawHours), combustible:numeric(value(row,"Combustible")),
    aceite_num:numeric(value(row,"Aceite")), aceite:text(value(row,"Aceite")),
    descripcion_trabajos:text(value(row,"Descripción de los trabajos realizados")),
    informacion_desgaste:text(value(row,"Información sobre Desgaste")),
    observaciones:explicitState && !new RegExp("(^|[^A-Z])"+explicitState+"([^A-Z]|$)").test(obs.toUpperCase())
      ? (obs ? obs+" | " : "")+"Estado ROP02: "+explicitState : obs
  };
}
async function source(action, timeoutMs = 16000, since = "", force = false) {
  const uri = new URL(SCRIPT_URL);
  uri.searchParams.set("action", action);
  if (action !== "versions") {
    uri.searchParams.set("limit", "all");
    uri.searchParams.set("compact", "0");
    if (since) uri.searchParams.set("since", since);
    // La aplicación de Google Apps Script ya soporta force=1, que evita
    // el falso notModified y la caché de seis horas de los IMPORTRANGE.
    if (force) uri.searchParams.set("force", "1");
  }
  const {data} = await request(uri.toString(), {headers:{Accept:"application/json"}, cache:"no-store"}, timeoutMs);
  if (!data?.ok) throw Error("SCRIPT_ACTION_FAILED:"+action);
  return data;
}
async function countRows(dataset) {
  // Conservado SOLO para las otras fuentes: no se ejecuta para El Fierro.
  const {response} = await rest("rop02?source_dataset=eq."+encodeURIComponent(dataset)+"&select=id",
    {method:"HEAD", headers:{Prefer:"count=exact"}}, 12000);
  const n = Number((response.headers.get("content-range")||"").split("/").pop());
  if (!Number.isSafeInteger(n)||n<0) throw Error("DEST_COUNT_UNKNOWN");
  return n;
}
async function getHealth(dataset) {
  const {data} = await rest("sheet_sync_health?dataset=eq."+encodeURIComponent(dataset)+"&select=last_success_at,consecutive_failures,details,destination_rows", {}, 12000);
  return Array.isArray(data) ? data[0]??null : null;
}
async function saveHealth(dataset, state) {
  await rest("sheet_sync_health?on_conflict=dataset", {method:"POST", headers:{"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"},
    body:JSON.stringify([{dataset, updated_at:new Date().toISOString(), ...state}])}, 12000);
}
async function sha256Rows(rows) {
  const bytes = new TextEncoder().encode(JSON.stringify(rows));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,"0")).join("");
}

Deno.serve(async req => {
  const begun = Date.now(); let dataset = ""; let submitted = false;
  try {
    if (req.method !== "POST") return output({ok:false,error:"METHOD_NOT_ALLOWED"},405);
    const token = text(req.headers.get("x-delta-sync-token"));
    if (!token || await rpc("verify_rop02_sync_token",{p_token:token}) !== true)
      return output({ok:false,error:"UNAUTHORIZED"},401);
    const input = await req.json().catch(() => ({}));
    dataset = text(input.dataset||FORMULA_DATASET);
    if (!/^rop02_[a-z0-9_]+$/.test(dataset)) return output({ok:false,error:"INVALID_DATASET"},400);
    const {data:configs} = await rest("rop02_project_sources?dataset=eq."+encodeURIComponent(dataset)+"&enabled=eq.true&select=dataset,project,sheet_gid,sheet_name,header_row", {}, 12000);
    const config = Array.isArray(configs) ? configs[0] : null;
    if (!config) return output({ok:false,error:"SOURCE_NOT_REGISTERED"},404);

    const formula = dataset === FORMULA_DATASET;
    // Conservar consulta paralela original para los otros datasets.
    const [health, countedRows] = formula
      ? [await getHealth(dataset), null]
      : await Promise.all([getHealth(dataset), countRows(dataset)]);
    // Para El Fierro no consultar un COUNT exacto de Supabase.
    // El último estado confirmado es solo una referencia conservadora.
    const count = formula ? Number(health?.destination_rows||0) : countedRows;
    if (!Number.isSafeInteger(count)||count<0) throw Error("LAST_CONFIRMED_ROWS_INVALID");
    const lastModified = text(health?.details?.sourceModifiedAt);
    const consistent = Boolean(health?.last_success_at) &&
      Number(health.destination_rows) === count && Number(health?.consecutive_failures||0) === 0;
    const result = await source(dataset,55000,formula ? "" : (consistent ? lastModified : ""),formula);
    if (result?.notModified || result?.meta?.notModified) {
      if (formula) throw Error("FORMULA_SOURCE_MUST_BE_READ");
      if (!consistent||!lastModified) throw Error("UNVERIFIED_NOT_MODIFIED");
      return output({ok:true,changed:false,dataset,sourceVersion:Number(health?.details?.sourceVersion||0),rows:count,version:VERSION,durationMs:Date.now()-begun});
    }
    const serverVersion = Number(result?.meta?.serverVersion);
    if (!Number.isSafeInteger(serverVersion)||serverVersion<=0) throw Error("SOURCE_VERSION_INVALID");
    const sourceModifiedAt = text(result?.meta?.sourceModifiedAt);
    if (!Number.isFinite(Date.parse(sourceModifiedAt))) throw Error("SOURCE_MODIFIED_AT_INVALID");
    if (Number(result?.meta?.sheetGidUsed) !== Number(config.sheet_gid) || Number(result?.meta?.headerRow) !== Number(config.header_row))
      throw Error("SOURCE_SHEET_IDENTITY_MISMATCH");
    const raw = result.data;
    if (!Array.isArray(raw) || result?.meta?.hasMore || raw.length > 12000) throw Error("SOURCE_INCOMPLETE");
    const transformed = raw.map(row => transform(row,config));
    const sourceRowIds = transformed.map(row => row.source_row);
    const sourceRowIdSet = new Set(sourceRowIds);
    if (sourceRowIdSet.size !== transformed.length) throw Error("DUPLICATE_SOURCE_ROW");
    // Un IMPORTRANGE que temporalmente pierde filas no puede borrar partes.
    // La reconciliación explícita de bajas se realiza por separado.
    if (formula && Array.isArray(health?.details?.sourceRowIds)) {
      const previousIds = health.details.sourceRowIds;
      if (!previousIds.every(rowId => sourceRowIdSet.has(rowId)))
        throw Error("FORMULA_SOURCE_ROW_REMOVAL_BLOCKED");
    }
    if (transformed.length===0 && count!==0) throw Error("EMPTY_SOURCE_SHRINK_BLOCKED");
    if (formula && transformed.length<count) throw Error("FORMULA_SOURCE_SHRINK_BLOCKED");
    if (!formula && count>100 && transformed.length<Math.floor(count*.9)) throw Error("SUSPICIOUS_SOURCE_SHRINK_BLOCKED");

    // La huella se guarda SOLO despues de que el RPC confirma la escritura.
    // Evita el RPC de cada 15 minutos cuando las formulas no cambiaron.
    const sourceHash = formula ? await sha256Rows(transformed) : "";
    if (formula && consistent && text(health?.details?.sourceHash) === sourceHash && transformed.length===count) {
      return output({ok:true,changed:false,dataset,sourceVersion:serverVersion,rows:count,version:VERSION,
        verifiedBy:"content-sha256",durationMs:Date.now()-begun});
    }

    let changes = {ok:true,skipped:true};
    if (transformed.length) {
      submitted = true;
      changes = await rpc("sync_rop02_authoritative_low_io_v1",{p_dataset:dataset,p_rows:transformed});
      if (changes?.ok===false) throw Error("SYNC_RPC_FAILED");
      if (formula && (!changes || changes.ok!==true)) throw Error("SYNC_RPC_UNCONFIRMED");
    }
    const actual = formula ? transformed.length : await countRows(dataset);
    if (actual!==transformed.length) throw Error("POST_SYNC_COUNT_MISMATCH");
    const now = new Date().toISOString();
    await saveHealth(dataset,{last_attempt_at:now,last_success_at:now,last_error:"",consecutive_failures:0,
      source_rows:raw.length,destination_rows:actual,duration_ms:Date.now()-begun,
      details:{version:VERSION,sourceVersion:serverVersion,sourceModifiedAt, sheetName:config.sheet_name,
        ...(formula ? {sourceHash,sourceRowIds} : {}),changed:changes?.writtenUpserts??0,deleted:changes?.deleted??0}});
    return output({ok:true,changed:Boolean((changes?.writtenUpserts??0)||(changes?.deleted??0)),dataset,
      sourceVersion:serverVersion,rows:actual,version:VERSION,durationMs:Date.now()-begun});
  } catch(e) {
    const message = e instanceof Error ? e.message : String(e);
    // No repetir automaticamente escrituras con resultado incierto.
    return output({ok:false,dataset,error:message,outcomeUnknown:submitted,retryAutomatically:!submitted,
      version:VERSION,durationMs:Date.now()-begun},500);
  }
});
