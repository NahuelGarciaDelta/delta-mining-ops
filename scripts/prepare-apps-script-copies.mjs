import fs from "node:fs";
import path from "node:path";
import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";
import { inspectBackend, walk, sha256 } from "./apps-script-audit.mjs";

export function prepareCopiesBackend(sourceBytes, map) {
  const inspected = inspectBackend(sourceBytes),
    targets = inspected.sheetIds;
  if (!map || typeof map !== "object" || Array.isArray(map))
    throw new Error("El mapa debe ser un objeto ID original -> ID de copia.");
  const expected = Object.keys(map);
  if (expected.length !== targets.length || targets.some((id) => !Object.hasOwn(map, id)))
    throw new Error("Se requiere una copia para CADA ID configurado, incluyendo movimientos, PM y licitaciones.");
  if (
    Object.values(map).some(
      (id) =>
        typeof id !== "string" ||
        !/[A-Za-z0-9_-]{20,}/.test(id) ||
        !/^[A-Za-z0-9_-]+$/.test(id) ||
        /^REEMPLAZAR/.test(id) ||
        targets.includes(id)
    )
  )
    throw new Error("ID de copia inválido o apunta a un ID de producción configurado.");
  if (new Set(Object.values(map)).size !== targets.length)
    throw new Error("Las copias deben conservar la separación de archivos originales.");
  const edits = [];
  walk(inspected.ast, (node) => {
    if (node.type === "Literal" && typeof node.value === "string" && targets.includes(node.value))
      edits.push({ range: node.range, text: JSON.stringify(map[node.value]) });
  });
  // A copied spreadsheet may assign different tab GIDs. Resolve by the unchanged tab names.
  for (const statement of inspected.ast.body) {
    if (statement.type !== "VariableDeclaration") continue;
    for (const declaration of statement.declarations) {
      if (declaration.id.name !== "SHEETS_CONFIG") continue;
      walk(declaration.init, (node) => {
        if (
          node.type === "Property" &&
          (node.key.name || node.key.value) === "gid" &&
          node.value.type === "Literal" &&
          node.value.value !== ""
        )
          edits.push({ range: node.value.range, text: '""' });
      });
    }
  }
  let source = inspected.source;
  for (const edit of edits.sort((a, b) => b.range[0] - a.range[0]))
    source = source.slice(0, edit.range[0]) + edit.text + source.slice(edit.range[1]);
  const copy = inspectBackend(Buffer.from(source));
  if (copy.functions.some((fn) => inspected.functions.find((prior) => prior.name === fn.name)?.sha256 !== fn.sha256))
    throw new Error("El reemplazo alteró una función: se detuvo la preparación.");
  const guard = `
// COPY-ONLY WEB APP. Never paste this derived artifact into the production project.
var DELTA_COPY_SOURCE_SHA256_ = ${JSON.stringify(inspected.sha256)};
var DELTA_COPY_ALLOWED_IDS_ = ${JSON.stringify(Object.values(map))};
var DELTA_COPY_PRODUCTION_IDS_ = ${JSON.stringify(targets)};
var deltaCopyBaseDoGet_ = doGet;
var deltaCopyBaseDoPost_ = doPost;
function deltaCopyGuard_(testKey) {
 var props=PropertiesService.getScriptProperties();
 if(props.getProperty("DELTA_TEST_ONLY")!=="1" || props.getProperty("DELTA_TEST_ACK")!=="COPIES_ONLY_NO_PRODUCTION" || props.getProperty("DELTA_TEST_SCRIPT_ID")!==ScriptApp.getScriptId())throw new Error("Configuración de sandbox incompleta.");
 var access=props.getProperty("DELTA_TEST_ACCESS_KEY");
 if(!access||access.length<32||/^(GENERAR|REEMPLAZAR)/.test(access)||testKey!==access)throw new Error("Clave de acceso de prueba ausente o inválida.");
 var ids=Object.keys(SHEETS_CONFIG).map(function(key){return SHEETS_CONFIG[key].id;}).concat([MOVIMIENTOS_EQUIPOS_DB_ID_,ROP02_ACCELERATOR_DB_ID_,LICITACIONES_DB_ID_,PM_DB_ID_]);
 ids.forEach(function(id){if(DELTA_COPY_PRODUCTION_IDS_.indexOf(id)>=0||DELTA_COPY_ALLOWED_IDS_.indexOf(id)<0)throw new Error("Destino fuera de las copias permitidas.");});
 DELTA_COPY_ALLOWED_IDS_.forEach(function(id){if(SpreadsheetApp.openById(id).getName().indexOf("DELTA_TEST_")!==0)throw new Error("La planilla debe tener prefijo DELTA_TEST_.");});
}
function deltaCopyParsePayload_(e) {
 if(e&&e.parameter&&e.parameter.payload)return JSON.parse(e.parameter.payload);
 var raw=String(e&&e.postData&&e.postData.contents||"");
 if(raw.indexOf("payload=")===0){var encoded=raw.split("&").filter(function(part){return part.indexOf("payload=")===0;})[0].slice(8);return JSON.parse(decodeURIComponent(encoded.replace(/\\+/g,"%20")));}
 return JSON.parse(raw);
}
doGet=function(e){
 try{
  deltaCopyGuard_(e&&e.parameter&&e.parameter.testKey);
  if(String(e&&e.parameter&&e.parameter.action||"")==="copy_test_status"){
   var report=deltaCopyIntegrationStatus_();
   return buildResponse({ok:true,copyOnly:true,backendVersion:DELTA_BACKEND_VERSION_,sourceSha256:DELTA_COPY_SOURCE_SHA256_,scriptId:ScriptApp.getScriptId(),copyIds:DELTA_COPY_ALLOWED_IDS_,report:report});
  }
  var action=String(e&&e.parameter&&e.parameter.action||"");
  if(["backend_version","version_backend","lista_equipos"].indexOf(action)<0)return buildResponse({ok:false,error:{code:"COPY_ACTION_BLOCKED",message:"Esta implementación sólo admite las pruebas autorizadas."}});
  return deltaCopyBaseDoGet_(e);
 }catch(error){return buildResponse({ok:false,error:{code:"COPY_SANDBOX_NOT_READY",message:error.message}});}
};
doPost=function(e){
 try{
  var payload=deltaCopyParsePayload_(e);deltaCopyGuard_(payload.testKey);
  if(payload.action==="copy_read_lista")return buildResponse(deltaCopyReadEquipment_());
  if(payload.action==="copy_test_status")return buildResponse({ok:true,copyOnly:true,backendVersion:DELTA_BACKEND_VERSION_,sourceSha256:DELTA_COPY_SOURCE_SHA256_,scriptId:ScriptApp.getScriptId(),copyIds:DELTA_COPY_ALLOWED_IDS_,report:deltaCopyIntegrationStatus_()});
  if(["authenticate_user","update_user_profile","update_lista_horometros","verify_lista_horometros"].indexOf(String(payload.action||""))<0)return buildResponse({ok:false,error:{code:"COPY_ACTION_BLOCKED",message:"Operación bloqueada en las copias."}});
  var fixture=PropertiesService.getScriptProperties().getProperty("DELTA_TEST_WEB_EMAIL");
  if(["authenticate_user","update_user_profile"].indexOf(payload.action)>=0&&String(payload.email||"")!==fixture)return buildResponse({ok:false,error:{code:"COPY_USER_BLOCKED",message:"Sólo se admite el usuario ficticio preparado."}});
  if(["update_lista_horometros","verify_lista_horometros"].indexOf(payload.action)>=0){
   if(!payload.actor||payload.actor.email!==fixture)throw new Error("Actor fuera del usuario de prueba.");
   (payload.updates||[]).forEach(function(item){if(!item.identity||["CTA-0530","DELTA-NO-SUCH-EQUIPMENT"].indexOf(item.identity.codigoNuevo)<0)throw new Error("Equipo fuera de la prueba autorizada.");});
  }
  return deltaCopyBaseDoPost_(e);
 }catch(error){return buildResponse({ok:false,error:{code:"COPY_SANDBOX_NOT_READY",message:error.message}});}
};
`;
  const finalSource = source + guard;
  return {
    source: finalSource,
    manifest: {
      copyOnly: true,
      parentSourceSha256: inspected.sha256,
      sha256: sha256(finalSource),
      unchangedBackendFunctionCount: copy.functions.length,
      copyIds: Object.values(map),
      replacedLiterals: edits.length,
      warning:
        "Only configuration IDs, copy-tab GIDs and an explicit test-only guard differ from the canonical production artifact. Install IntegrationCopies.gs alongside this copy-only artifact."
    }
  };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const [mapFile, outDir] = process.argv.slice(2);
  if (!mapFile || !outDir)
    throw new Error("Uso: node scripts/prepare-apps-script-copies.mjs <mapa.json> <directorio fuera del checkout>");
  const out = path.resolve(outDir),
    root = path.resolve(".");
  if (out === root || out.startsWith(root + path.sep))
    throw new Error("La salida debe quedar FUERA del checkout para no confundirla con producción.");
  if (fs.existsSync(out)) throw new Error("La salida ya existe; elegí un directorio nuevo para preservar archivos.");
  const prepared = prepareCopiesBackend(
    fs.readFileSync("AppsScript_Delta_Mining_OPS_FINAL.txt"),
    JSON.parse(fs.readFileSync(mapFile, "utf8"))
  );
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "Code-COPIAS.txt"), prepared.source);
  fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(prepared.manifest, null, 2) + "\n");
  fs.copyFileSync("integration/apps-script/IntegrationCopies.gs", path.join(out, "IntegrationCopies.gs"));
  console.log(JSON.stringify({ directory: out, ...prepared.manifest }, null, 2));
}
