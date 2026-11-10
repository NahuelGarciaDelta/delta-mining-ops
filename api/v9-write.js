// Authenticated V9 write relay. The browser never receives a Sheets credential.
const REF = "biztlietuvvonigcfdwy";
const ALLOWED = new Set([
  "add_lista_equipo","update_lista_equipo","update_lista_horometros","verify_lista_horometros",
  "bulk_update_lista_equipos_from_app","update_rop02_row",
  "add_raba03_rows_append_only","upsert_raba03_rows_safe_v2","add_raba03_rows","upsert_raba03_rows",
  "save_remito_cargado","delete_remito_cargado","delete_raba03_solicitud_numero",
  "save_estado_solicitud","save_estados_solicitudes_bulk","delete_estado_solicitud","delete_estados_solicitudes_bulk",
  "save_raba03_cant_enviada","save_raba03_codigos",
  "save_licitacion","guardar_licitacion","delete_licitacion","eliminar_licitacion",
  "save_pm_programacion","save_pm_repuesto","save_pm_config","registrar_pm_realizado",
  "save_articulos_desgaste","save_equipment_movement","cancel_equipment_movement",
  "save_taller_movement","update_taller_movement","delete_taller_movement",
  "stock_excel_clear","stock_excel_upload","stock_excel_replace","upload_stock",
  "save_user_preferences","upload_user_background"
]);
// Movement writes remain server-gated until sandbox and idempotency are verified.
const TALLER_ACTIONS = new Set(["save_taller_movement","update_taller_movement","delete_taller_movement"]);
const TALLER_STATUS_ACTION = "v9_taller_write_status";
const ADMIN_ONLY = new Set([
  "update_user_profile","stock_excel_clear","delete_remito_cargado","delete_raba03_solicitud_numero",
  "delete_estado_solicitud","delete_estados_solicitudes_bulk","delete_licitacion","eliminar_licitacion"
]);
const OFFICETECH = new Set(["update_rop02_row"]);
const TALLER = new Set(["add_lista_equipo","update_lista_equipo","update_lista_horometros","verify_lista_horometros","bulk_update_lista_equipos_from_app"]);
const SUPPLY = new Set([
  "add_raba03_rows_append_only","upsert_raba03_rows_safe_v2","add_raba03_rows","upsert_raba03_rows",
  "save_remito_cargado","delete_remito_cargado","delete_raba03_solicitud_numero",
  "save_estado_solicitud","save_estados_solicitudes_bulk","delete_estado_solicitud","delete_estados_solicitudes_bulk",
  "save_raba03_cant_enviada","save_raba03_codigos","stock_excel_clear","stock_excel_upload","stock_excel_replace","upload_stock"
]);
const MAINT = new Set(["save_pm_programacion","save_pm_repuesto","save_pm_config","registrar_pm_realizado","save_articulos_desgaste"]);
export const config = { maxDuration: 30, api: { bodyParser: { sizeLimit: "1mb" } } };
const json = (res,status,body) => {
  res.setHeader("Cache-Control","no-store, max-age=0");
  res.setHeader("X-Content-Type-Options","nosniff");
  return res.status(status).json(body);
};
function parsePayload(req) {
  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
    if (typeof req.body.payload === "string") return JSON.parse(req.body.payload);
    if (req.body.payload && typeof req.body.payload === "object") return req.body.payload;
    return req.body;
  }
  if (typeof req.body === "string") {
    const form = new URLSearchParams(req.body);
    const raw = form.get("payload");
    return raw ? JSON.parse(raw) : JSON.parse(req.body);
  }
  return {};
}
function allowed(role,area,action) {
  if (!ALLOWED.has(action)) return false;
  if (role === "ADMIN") return true;
  if (ADMIN_ONLY.has(action)) return false;
  if (OFFICETECH.has(action)) return role === "OFICINA_TECNICA" || area === "OFICINA TECNICA";
  if (action === "update_lista_horometros" || action === "verify_lista_horometros" || action === "bulk_update_lista_equipos_from_app")
    return role === "OFICINA_TECNICA" || area === "OFICINA TECNICA" || area === "TALLER CENTRAL";
  if (TALLER.has(action)) return area === "TALLER CENTRAL";
  if (SUPPLY.has(action)) return role === "ADMINISTRATIVO" || area === "ABASTECIMIENTO";
  if (MAINT.has(action)) return role === "MECANICO" || role === "OFICINA_TECNICA" || area === "MANTENIMIENTO";
  if (action === "save_licitacion" || action === "guardar_licitacion") return role === "OFICINA_TECNICA" || area === "OFICINA TECNICA";
  if (action.includes("movement")) return role === "MECANICO" || role === "OFICINA_TECNICA" || area === "TALLER CENTRAL";
  return ["ADMINISTRATIVO","OFICINA_TECNICA","MECANICO"].includes(role);
}
async function verifiedUser(db,token) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(db.url + "/auth/v1/user", {
      method:"GET", redirect:"error", cache:"no-store", signal:controller.signal,
      headers:{ apikey:db.key, Authorization:"Bearer "+token, Accept:"application/json" }
    });
    if (!r.ok) return null;
    const u = await r.json();
    const meta = u?.app_metadata || {};
    const role = String(meta.v9_role || "").toUpperCase();
    if (!["ADMIN","OFICINA_TECNICA","ADMINISTRATIVO","MECANICO"].includes(role) || meta.v9_active !== true) return null;
    const area = String(meta.v9_area || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toUpperCase();
    return { email:String(u.email||"").toLowerCase(), role, area };
  } finally { clearTimeout(timer); }
}
// Verify the *deployed* Google Apps Script supports UUID-deduplicated writes.
// Source-controlled code alone is not proof that the /exec version was updated.
async function deployedTallerCapability(gasUrl,token){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),9000);
  try{
    let upstream=await fetch(gasUrl,{
      method:"POST",redirect:"manual",cache:"no-store",signal:controller.signal,
      headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8",Accept:"application/json"},
      body:new URLSearchParams({payload:JSON.stringify({action:"v9_write_capabilities",authToken:token})})
    });
    if([301,302,303,307,308].includes(upstream.status)){
      const loc=upstream.headers.get("location");
      let uri;
      try{uri=new URL(loc);}catch{return false;}
      if(uri.protocol!=="https:"||uri.hostname!=="script.googleusercontent.com")return false;
      upstream=await fetch(uri.toString(),{method:"GET",redirect:"error",cache:"no-store",signal:controller.signal,headers:{Accept:"application/json"}});
    }
    if(!upstream.ok)return false;
    const raw=await upstream.text();
    if(raw.length>10000)return false;
    let result;
    try{result=JSON.parse(raw);}catch{return false;}
    return result?.ok===true &&
      result?.action==="v9_write_capabilities" &&
      result?.schema==="taller-uuid-primary-key-v1" &&
      result?.idempotentSave===true &&
      result?.target==="GOOGLE_SHEETS_ORIGINAL";
  }catch{return false;}finally{clearTimeout(timer);}
}
export default async function handler(req,res) {
  if (req.method !== "POST") { res.setHeader("Allow","POST"); return json(res,405,{ok:false,error:"METHOD_NOT_ALLOWED"}); }
  const dbUrl=String(process.env.DELTA_V9_STANDALONE_SB_URL||"").replace(/\/+$/,"");
  const dbKey=String(process.env.DELTA_V9_STANDALONE_SB_PUBLISHABLE_KEY||"");
  if (dbUrl !== "https://"+REF+".supabase.co" || !/^sb_publishable_[A-Za-z0-9_-]{15,}$/.test(dbKey))
    return json(res,503,{ok:false,error:"V9_BACKEND_NOT_CONFIGURED"});
  const gasUrl=String(process.env.DELTA_V9_GAS_WRITE_URL||"").trim();
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(gasUrl))
    return json(res,503,{ok:false,error:"V9_WRITE_BRIDGE_NOT_CONFIGURED"});
  const token=String(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
  if (token.length < 60 || token.length > 4096) return json(res,401,{ok:false,error:"V9_SESSION_REQUIRED"});
  let payload;
  try { payload=parsePayload(req); } catch { return json(res,400,{ok:false,error:"INVALID_WRITE_PAYLOAD"}); }
  const action=String(payload?.action||"").trim().toLowerCase();
  if (!ALLOWED.has(action) && action !== TALLER_STATUS_ACTION) return json(res,400,{ok:false,error:"V9_WRITE_ACTION_NOT_ALLOWED"});
  try {
    const user=await verifiedUser({url:dbUrl,key:dbKey},token);
    if (!user) return json(res,401,{ok:false,error:"V9_SESSION_EXPIRED_OR_INACTIVE"});
    if (action !== TALLER_STATUS_ACTION && !allowed(user.role,user.area,action))
      return json(res,403,{ok:false,error:"V9_WRITE_FORBIDDEN"});
    // Never enable Taller movement writes by merely activating frontend buttons.
    // Sandbox and production must each be explicitly configured server-side.
    const configuredMode=String(process.env.DELTA_V9_TALLER_WRITE_MODE||"disabled").toLowerCase();
    const sandboxGas=String(process.env.DELTA_V9_TALLER_SANDBOX_GAS_URL||"").trim();
    const sandboxReady=configuredMode==="sandbox" &&
      /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(sandboxGas) &&
      sandboxGas!==gasUrl &&
      process.env.DELTA_V9_TALLER_SANDBOX_VERIFIED==="true";
    const approvalReady=configuredMode==="production" &&
      process.env.DELTA_V9_TALLER_PRODUCTION_APPROVED==="true";
    // Only Taller movements need the extra deployed-version handshake.\n    // Do not add another Apps Script roundtrip before meter batches or PM writes.\n    const productionReady=approvalReady && (TALLER_ACTIONS.has(action)||action===TALLER_STATUS_ACTION) && await deployedTallerCapability(gasUrl,token);
    const writeMode=sandboxReady?"sandbox":productionReady?"production":"disabled";
    if (action===TALLER_STATUS_ACTION)
      return json(res,200,{ok:true,mode:writeMode,canWrite:writeMode!=="disabled",requiresConfirmation:true});
    if (TALLER_ACTIONS.has(action)){
      if(writeMode==="disabled")return json(res,423,{ok:false,error:"V9_TALLER_WRITES_NOT_VERIFIED"});
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(payload.operationId||"")))
        return json(res,400,{ok:false,error:"V9_OPERATION_ID_REQUIRED"});
      if((action==="update_taller_movement"||action==="delete_taller_movement")&&!String(payload.id||"").trim())
        return json(res,400,{ok:false,error:"V9_MOVEMENT_ID_REQUIRED"});
    }
    const destinationUrl=TALLER_ACTIONS.has(action)&&writeMode==="sandbox"?sandboxGas:gasUrl;
    const outgoing={...payload,action,authToken:token};
    // Never trust the actor name supplied by the browser for movement writes.
    if(TALLER_ACTIONS.has(action)){
      outgoing.usuario=user.email;
      if(action!=="delete_taller_movement")
        outgoing.movement={...(payload.movement||{}),usuario:user.email};
    }
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
    try {
      let upstream=await fetch(destinationUrl,{
        method:"POST",redirect:"manual",cache:"no-store",signal:controller.signal,
        headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8","Accept":"application/json"},
        body:new URLSearchParams({payload:JSON.stringify(outgoing)})
      });
      if ([301,302,303,307,308].includes(upstream.status)) {
        const location=upstream.headers.get("location");
        let next;
        try { next=new URL(location); } catch { return json(res,502,{ok:false,error:"V9_GAS_REDIRECT_INVALID"}); }
        if (next.protocol!=="https:" || next.hostname!=="script.googleusercontent.com")
          return json(res,502,{ok:false,error:"V9_GAS_REDIRECT_REJECTED"});
        upstream=await fetch(next.toString(),{method:"GET",redirect:"error",cache:"no-store",signal:controller.signal,headers:{Accept:"application/json"}});
      }
      const text=await upstream.text();
      if (!upstream.ok || text.length>100000) return json(res,502,{ok:false,error:"V9_GAS_WRITE_FAILED"});
      let result; try { result=JSON.parse(text); } catch { return json(res,502,{ok:false,error:"V9_GAS_INVALID_REPLY"}); }
      if (typeof result?.ok !== "boolean") return json(res,502,{ok:false,error:"V9_GAS_INVALID_REPLY"});
      // A valid per-row meter receipt can contain confirmed, failed and pending
      // entries; return it intact so the UI never disguises backend validation
      // failures as 79 unknown writes due to an HTTP 409.
      const meterReceipt=(action==="update_lista_horometros"||action==="verify_lista_horometros"||
        action==="bulk_update_lista_equipos_from_app") &&
        Array.isArray(result.results) &&
        result.results.every(row=>["confirmed","failed","pending"].includes(row?.status));
      return json(res,(result.ok||meterReceipt)?200:409,result);
    } finally { clearTimeout(timer); }
  } catch {
    return json(res,502,{ok:false,error:"V9_WRITE_BRIDGE_UNAVAILABLE"});
  }
}
