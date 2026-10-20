import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const VERSION = "2026-10-20-ROP02-ADMIN-REGISTRY-V4";
const MAX_OPS = 10000;

const DATASETS = {
  rop02_fs: {
    spreadsheetId: "1dt5THoDndDM9pBZYkNR0gjkPrSrunnkMA8DgqQZB2OU",
    gid: 396764804,
    project: "FILO DEL SOL",
    headerRow: 4,
  },
  rop02_jm: {
    spreadsheetId: "1RzOwDSmd1fw48hvPCfoauPnZGE44G9NgSazMdjVxj4Q",
    gid: 967767400,
    project: "JOSE MARIA",
    headerRow: 4,
  },
  rop02_filosur: {
    spreadsheetId: "1RpKLXTQNxlqoRy9c5FXI23ZV-OatlsRCvu4CuNWBt0w",
    gid: 1301566995,
    project: "FILO SUR",
    headerRow: 4,
  },
  rop02_zorro: {
    spreadsheetId: "1HUSJBcMgOkSnMxul5QHWruIS3Jwx2Oyenf6VFWma4YI",
    gid: 967767400,
    project: "EL ZORRO",
    headerRow: 4,
  },
  rop02_fierro: { spreadsheetId: "1Ud7GerplVfoV5YpVxhipg2hDZ-JTjBTyCux66R2caL0", gid: 967767400, project: "EL FIERRO", headerRow: 4 },
} as const;

type DatasetKey = keyof typeof DATASETS;
type DatasetCfg={spreadsheetId:string;gid:number;project:string;headerRow:number};
type DeltaLine = { source_row: number; values: unknown[] };
type Payload = {
  action?: string;
  dataset?: string;
  spreadsheetId?: string;
  gid?: number | string;
  source?: string;
  headers?: unknown[];
  upserts?: DeltaLine[];
  deleteSourceRows?: Array<number | string>;
  project?:string;sheetName?:string;headerRow?:number|string;
};

class HttpError extends Error {
  status: number;
  code: string;
  detail?: Record<string, unknown>;
  constructor(status: number, code: string, message: string, detail?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function adminKey(): string {
  const legacy = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (legacy) return legacy;
  const packed = String(Deno.env.get("SUPABASE_SECRET_KEYS") || "").trim();
  if (packed) {
    try {
      const parsed = JSON.parse(packed);
      const key = String(parsed?.default || "").trim();
      if (key) return key;
    } catch (_) {}
  }
  throw new HttpError(500, "ADMIN_KEY_MISSING", "No hay clave administrativa disponible.");
}

async function rpc(fn: string, payload: Record<string, unknown>): Promise<any> {
  const baseUrl = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
  if (!baseUrl) throw new HttpError(500, "SUPABASE_URL_MISSING", "SUPABASE_URL no está disponible.");
  const key = adminKey();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: key,
  };
  if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;

  const response = await fetch(`${baseUrl}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload || {}),
  });
  const text = await response.text();
  let parsed: any = null;
  if (text) {
    try { parsed = JSON.parse(text); } catch (_) { parsed = text; }
  }
  if (!response.ok) {
    throw new HttpError(500, "SUPABASE_RPC_ERROR", `RPC ${fn} respondió HTTP ${response.status}`, {
      rpc: fn,
      status: response.status,
      response: parsed,
    });
  }
  return parsed;
}


function restHeaders(extra:Record<string,string>={}):Record<string,string>{
 const key=adminKey();
 return {apikey:key,...(key.startsWith("sb_secret_")?{}:{Authorization:"Bearer "+key}),...extra};
}
async function restCall(path:string,opt:RequestInit={}):Promise<{data:any,headers:Headers}>{
 const original=String(Deno.env.get("SUPABASE_URL")||"");
 const base=original.endsWith("/")?original.slice(0,-1):original;
 if(!base)throw new HttpError(500,"SUPABASE_URL_MISSING","Falta URL");
 const res=await fetch(base+"/rest/v1/"+path,{...opt,headers:restHeaders((opt.headers||{}) as Record<string,string>)});
 const body=await res.text();
 if(!res.ok)throw new HttpError(502,"REGISTRY_ERROR","Registro Supabase HTTP "+res.status,{status:res.status});
 let data:any=null;
 if(body.trim()){try{data=JSON.parse(body);}catch{throw new HttpError(502,"REGISTRY_PARSE","Respuesta JSON inválida");}}
 return {data,headers:res.headers};
}
async function lookupDataset(key:string):Promise<any|null>{
 const r=await restCall("rop02_project_sources?dataset=eq."+encodeURIComponent(key)+"&select=dataset,project,spreadsheet_id,sheet_gid,sheet_name,header_row,enabled");
 return Array.isArray(r.data)?r.data[0]||null:null;
}
async function getCfg(key:string):Promise<DatasetCfg>{
 if(!/^rop02_[a-z0-9_]{2,45}$/.test(key))throw new HttpError(403,"DATASET_NOT_ALLOWED","Dataset ROP02 inválido");
 if(Object.prototype.hasOwnProperty.call(DATASETS,key))return DATASETS[key as DatasetKey];
 const row=await lookupDataset(key);
 if(!row||row.enabled!==true)throw new HttpError(403,"DATASET_NOT_REGISTERED","Registrá primero la fuente");
 return {spreadsheetId:String(row.spreadsheet_id),gid:Number(row.sheet_gid),project:String(row.project),headerRow:Number(row.header_row)};
}
async function registerCfg(p:Payload):Promise<any>{
 const dataset=String(p.dataset||"").trim().toLowerCase(),project=String(p.project||"").trim().replace(/\s+/g," ");
 const spreadsheetId=String(p.spreadsheetId||"").trim(),gid=Number(p.gid),head=Number(p.headerRow??4),sheetName=String(p.sheetName||"").trim();
 if(!/^rop02_[a-z0-9_]{2,45}$/.test(dataset))throw new HttpError(400,"INVALID_DATASET","Dataset inválido");
 if(project.length<3||project.length>90||!/^[a-zA-Z0-9_-]{20,}$/.test(spreadsheetId)||!Number.isSafeInteger(gid)||gid<0||head!==4||sheetName.length<1||sheetName.length>100)
   throw new HttpError(400,"INVALID_SOURCE","Libro, GID, proyecto o encabezados inválidos");
 const fixed=(DATASETS as Record<string,DatasetCfg>)[dataset];
 if(fixed&&(fixed.spreadsheetId!==spreadsheetId||fixed.gid!==gid))
   throw new HttpError(409,"FIXED_SOURCE_MISMATCH","No se puede reemplazar una fuente productiva protegida");
 const old=await lookupDataset(dataset);
 if(old&&String(old.spreadsheet_id)===spreadsheetId&&Number(old.sheet_gid)===gid)
   return {registered:true,unchanged:true,dataset};
 if(old){
   const countResp=await restCall("rop02?source_dataset=eq."+encodeURIComponent(dataset)+"&select=id",{method:"HEAD",headers:{Prefer:"count=exact"}});
   const n=Number((countResp.headers.get("content-range")||"").split("/").pop());
   if(!Number.isSafeInteger(n)||n!==0)throw new HttpError(409,"DATASET_HAS_ROWS","Cambiar un origen con históricos requiere una migración");
 }
 await restCall("rop02_project_sources?on_conflict=dataset",{method:"POST",
   headers:{"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"},
   body:JSON.stringify([{dataset,project:project.toUpperCase(),spreadsheet_id:spreadsheetId,sheet_gid:gid,sheet_name:sheetName,header_row:4,enabled:true}])});
 return {registered:true,unchanged:false,dataset};
}

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pick(row: Record<string, unknown>, names: string[]): unknown {
  const wanted = names.map(normalizeText);
  for (const key of Object.keys(row || {})) {
    if (wanted.includes(normalizeText(key))) return row[key];
  }
  return "";
}

function numberValue(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  let s = String(value).trim().replace(/[^\d,.-]/g, "");
  if (!s) return 0;
  const comma = s.lastIndexOf(",");
  const dot = s.lastIndexOf(".");
  if (comma !== -1 && dot !== -1) {
    if (comma > dot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (comma !== -1) {
    const decimals = s.length - comma - 1;
    s = decimals > 0 && decimals <= 2 ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (dot !== -1) {
    const decimals = s.length - dot - 1;
    s = decimals > 0 && decimals <= 2 ? s.replace(/,/g, "") : s.replace(/\./g, "");
  }
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function isoDate(value: unknown): string {
  const s = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  return m ? `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}` : s;
}

function stringValue(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function buildEntries(headers: unknown[], rows: DeltaLine[], headerRow: number) {
  if (!Array.isArray(headers) || headers.length < 1 || headers.length > 200) {
    throw new HttpError(400, "INVALID_HEADERS", "headers debe ser un array válido.");
  }
  if (!Array.isArray(rows)) throw new HttpError(400, "INVALID_UPSERTS", "upserts debe ser un array.");
  if (rows.length > MAX_OPS) throw new HttpError(413, "TOO_MANY_UPSERTS", `El delta supera ${MAX_OPS} upserts.`);

  const cleanHeaders = headers.map((h, i) => stringValue(h) || `col_${i}`);
  const seen = new Set<number>();
  return rows.map((line) => {
    const sourceRow = Number((line as any)?.source_row);
    const values = (line as any)?.values;
    if (!Number.isInteger(sourceRow) || sourceRow <= headerRow) {
      throw new HttpError(400, "INVALID_SOURCE_ROW", `source_row inválido: ${sourceRow}`);
    }
    if (seen.has(sourceRow)) throw new HttpError(400, "DUPLICATE_SOURCE_ROW", `source_row duplicado: ${sourceRow}`);
    if (!Array.isArray(values)) throw new HttpError(400, "INVALID_ROW_VALUES", `La fila ${sourceRow} no contiene values[].`);
    if (values.length > cleanHeaders.length) throw new HttpError(400, "ROW_WIDER_THAN_HEADERS", `La fila ${sourceRow} supera headers.`);
    seen.add(sourceRow);
    const raw: Record<string, unknown> = {};
    for (let i = 0; i < cleanHeaders.length; i++) raw[cleanHeaders[i]] = values[i] ?? "";
    return { source_row: sourceRow, row_data: raw };
  });
}

function mapRop02(entries: Array<{ source_row: number; row_data: Record<string, unknown> }>, cfg:DatasetCfg) {
  const typed = entries.map((entry) => {
    const r = entry.row_data;
    return {
      source_row: entry.source_row,
      fecha: isoDate(pick(r, ["Fecha", "Fecha:", "col_0"])),
      interno: stringValue(pick(r, ["Interno", "Código Interno", "Codigo Interno", "col_1"])),
      equipo: stringValue(pick(r, ["Equipo", "Tipo Equipo", "col_2"])),
      operador: stringValue(pick(r, ["Operador", "col_3"])),
      supervisor_delta: stringValue(pick(r, ["Supervisor Delta", "Supervisor", "col_4"])),
      supervisor_vial_cliente: stringValue(pick(r, ["Supervisor Vial Cliente", "Supervisor Cliente", "col_5"])),
      turno_trabajo: stringValue(pick(r, ["Turno de trabajo", "Turno", "col_6"])),
      numero_parte: stringValue(pick(r, ["N° Parte", "Nº Parte", "N Parte", "Parte", "col_7"])),
      proyecto: stringValue(pick(r, ["Proyecto", "project"]) || cfg.project),
      horometro_inicial: String(numberValue(pick(r, ["Horómetro inicial", "Horometro inicial", "HI", "col_9"]))),
      horometro_final: String(numberValue(pick(r, ["Horómetro final", "Horometro final", "HF", "col_10"]))),
      cantidad_horas: String(numberValue(pick(r, ["Cant. Hs.", "Cant.Hs/ KM", "Cant.Hs", "Cant Hs", "Cantidad de horas", "col_11"]))),
      combustible: String(numberValue(pick(r, ["Combustible", "col_12"]))),
      aceite: stringValue(pick(r, ["Aceite", "col_13"])),
      aceite_num: String(numberValue(pick(r, ["Aceite", "col_13"]))),
      descripcion_trabajos: stringValue(pick(r, ["Descripción de los trabajos realizados", "Descripcion de los trabajos realizados", "Trabajos realizados", "Descripción", "Descripcion", "col_14"])),
      informacion_desgaste: stringValue(pick(r, ["Información sobre Desgaste", "Informacion sobre Desgaste", "Desgaste", "col_15"])),
      observaciones: stringValue(pick(r, ["Observaciones", "OBSERVACIONES", "col_16"])),
    };
  });
  const invalid = typed.filter((r) => !/^\d{4}-\d{2}-\d{2}$/.test(r.fecha) || !r.interno);
  if (invalid.length) {
    throw new HttpError(409, "ROP02_PARSE_INCOMPLETE", `Se bloquearon ${invalid.length} upserts ROP02 sin fecha/interno.`, {
      sampleSourceRows: invalid.slice(0, 10).map((r) => r.source_row),
    });
  }
  return typed;
}

async function safeLog(dataset: string, source: string, status: string, rowCount: number, detail: Record<string, unknown>) {
  try {
    await rpc("log_delta_external_sync_v1", {
      p_dataset: dataset || null,
      p_source: source || null,
      p_status: status,
      p_row_count: rowCount,
      p_detail: detail || {},
    });
  } catch (err) {
    console.error("No se pudo registrar log:", err instanceof Error ? err.message : String(err));
  }
}

Deno.serve(async (req: Request) => {
  let authorized = false;
  let dataset = "";
  let source = "";
  let opCount = 0;
  try {
    if (req.method === "OPTIONS") return new Response(null, { status: 204 });
    if (req.method !== "POST") throw new HttpError(405, "METHOD_NOT_ALLOWED", "Usar POST.");

    const token = String(req.headers.get("x-delta-sync-token") || "").trim();
    if (!token) throw new HttpError(401, "UNAUTHORIZED", "Falta X-Delta-Sync-Token.");
    const tokenOk = await rpc("verify_delta_external_sync_token_v1", { p_token: token });
    if (tokenOk !== true) throw new HttpError(401, "UNAUTHORIZED", "Token de sincronización inválido.");
    authorized = true;

    let payload: Payload;
    try { payload = await req.json(); } catch (_) { throw new HttpError(400, "INVALID_JSON", "El body debe ser JSON válido."); }

    const action = String(payload.action || "delta").trim().toLowerCase();
    if (action === "probe") {
      return jsonResponse({ ok: true, action: "probe", version: VERSION, allowedDatasets: Object.keys(DATASETS), at: new Date().toISOString() });
    }
    if (action === "sources") {
      const response=await restCall("rop02_project_sources?enabled=eq.true&select=dataset,project,spreadsheet_id,sheet_gid,sheet_name,header_row,enabled&order=dataset.asc");
      if(!Array.isArray(response.data))throw new HttpError(502,"INVALID_CATALOG","Catálogo ROP02 no válido");
      return jsonResponse({ok:true,action:"sources",version:VERSION,sources:response.data});
    }
    if (action === "register") {
      const registered=await registerCfg(payload);
      return jsonResponse({ok:true,action:"register",version:VERSION,...registered});
    }
    if (action !== "delta") throw new HttpError(400, "INVALID_ACTION", `Acción no permitida: ${action}`);

    dataset = String(payload.dataset || "").trim();
    source = String(payload.source || "apps_script_externo").trim().slice(0, 300);
    const cfg=await getCfg(dataset);
    const spreadsheetId = String(payload.spreadsheetId || "").trim();
    const gid = Number(payload.gid);
    if (spreadsheetId !== cfg.spreadsheetId || gid !== cfg.gid) {
      throw new HttpError(403, "SOURCE_MISMATCH", "El spreadsheetId/gid no corresponde al dataset solicitado.");
    }

    const upserts = Array.isArray(payload.upserts) ? payload.upserts : [];
    const deletesRaw = Array.isArray(payload.deleteSourceRows) ? payload.deleteSourceRows : [];
    if (upserts.length + deletesRaw.length > MAX_OPS) throw new HttpError(413, "TOO_MANY_OPS", `El delta supera ${MAX_OPS} operaciones.`);

    const entries = buildEntries(payload.headers || [], upserts, cfg.headerRow);
    const typedRows = mapRop02(entries, cfg);

    const deleteSet = new Set<number>();
    for (const raw of deletesRaw) {
      const n = Number(raw);
      if (!Number.isInteger(n) || n <= cfg.headerRow) throw new HttpError(400, "INVALID_DELETE_SOURCE_ROW", `source_row a borrar inválido: ${raw}`);
      if (deleteSet.has(n)) throw new HttpError(400, "DUPLICATE_DELETE_SOURCE_ROW", `source_row a borrar duplicado: ${n}`);
      deleteSet.add(n);
    }
    const upsertSet = new Set(typedRows.map((r) => r.source_row));
    for (const n of deleteSet) if (upsertSet.has(n)) throw new HttpError(400, "UPSERT_DELETE_OVERLAP", `source_row ${n} aparece en upsert y delete.`);

    opCount = typedRows.length + deleteSet.size;
    if (opCount === 0) {
      return jsonResponse({ ok: true, immediate: true, incremental: true, noop: true, version: VERSION, dataset, source, upserts: 0, deletes: 0, at: new Date().toISOString() });
    }

    const result = await rpc("apply_rop02_external_delta_v2", {
      p_dataset: dataset,
      p_upserts: typedRows,
      p_delete_source_rows: Array.from(deleteSet),
    });

    await safeLog(dataset, source, "OK_INCREMENTAL", opCount, {
      version: VERSION,
      upserts: typedRows.length,
      deletes: deleteSet.size,
      result,
    });

    return jsonResponse({
      ok: true,
      immediate: true,
      incremental: true,
      version: VERSION,
      dataset,
      source,
      upserts: typedRows.length,
      deletes: deleteSet.size,
      result,
      at: new Date().toISOString(),
    });
  } catch (err) {
    const e = err instanceof HttpError ? err : new HttpError(500, "INTERNAL_ERROR", err instanceof Error ? err.message : String(err));
    if (authorized) {
      await safeLog(dataset, source, "ERROR_INCREMENTAL", opCount, { version: VERSION, code: e.code, message: e.message, detail: e.detail || {} });
    }
    return jsonResponse({ ok: false, error: { code: e.code, message: e.message, ...(e.detail ? { detail: e.detail } : {}) }, version: VERSION }, e.status);
  }
});
