/* OPTIONAL COPY-ONLY TEST HELPER. Never install this file in the production project.
 * The production backend is the single complete AppsScript_Delta_Mining_OPS_FINAL.txt.
 * Run only the public delta* functions below in a fresh test project.
 */
var DELTA_COPY_KNOWN_PRODUCTION_IDS_ = ["1HYlylloC0TMsOWTpwvZ8YaXk5RLRKZ2PmOlhc7TCovw", "1dt5THoDndDM9pBZYkNR0gjkPrSrunnkMA8DgqQZB2OU", "1RzOwDSmd1fw48hvPCfoauPnZGE44G9NgSazMdjVxj4Q", "1RpKLXTQNxlqoRy9c5FXI23ZV-OatlsRCvu4CuNWBt0w", "1HUSJBcMgOkSnMxul5QHWruIS3Jwx2Oyenf6VFWma4YI", "1WZEwuUTE8r-wUgTKeMsr1tsV1Ylq8fMULQjE-omCMOU", "1ZAZ8r1gtz6pBobJ7Nv1mQNtIWuNhckQxI6SkGxKWt_I", "1MKrJA-W_pj_Z1Dmk9ec9614oA9nnSy3SXn1b2iokpr8", "1CYXvmXk7XknGWq4TUJyTAaXz_TH1JOWcl2Zm7XurFTI", "1cEbCIkt0GM4EPU86CluvDyRzAN2c1K8tfG9TXLFzQc4", "1F3pPrhKSKQHHPln8o5n-M1NuHhZA--LKj93wa596_sk", "1jmTZ2_aJai-t1uj-sZB8MK1a6J47oXeiG5GIO_Gk6u4", "1GQeo1upm1P9I_JvyevRjRRJBAlzfXIoXwIPLuRd720g", "1eEgggHdcH0YhGnmlogN63nQgStNl2xoV0bkfF_DTPYU"];

function deltaCopyAssert_(condition, message) { if(!condition) throw new Error(message); }
function deltaCopyConfigure_() {
  var props=PropertiesService.getScriptProperties();
  deltaCopyAssert_(props.getProperty("DELTA_TEST_ONLY")==="1", "Falta DELTA_TEST_ONLY=1.");
  deltaCopyAssert_(props.getProperty("DELTA_TEST_ACK")==="COPIES_ONLY_NO_PRODUCTION", "Falta la confirmación de copias.");
  deltaCopyAssert_(props.getProperty("DELTA_TEST_SCRIPT_ID")===ScriptApp.getScriptId(), "El ID no corresponde al proyecto de prueba.");
  deltaCopyAssert_(ScriptApp.getProjectTriggers().length===0, "El proyecto de prueba debe estar sin triggers.");
  var map=JSON.parse(props.getProperty("DELTA_TEST_COPY_CONFIG")||"null");
  deltaCopyAssert_(map&&map.usuarios&&map.lista_equipos, "Falta DELTA_TEST_COPY_CONFIG.");
  var keys=["usuarios","lista_equipos"], allowed=[];
  // Validate every ID before opening ANY spreadsheet.
  keys.forEach(function(key){
    var entry=map[key];
    deltaCopyAssert_(entry&&/^[A-Za-z0-9_-]{20,}$/.test(String(entry.id||""))&&!/^REEMPLAZAR/.test(entry.id), "ID de copia inválido.");
    deltaCopyAssert_(DELTA_COPY_KNOWN_PRODUCTION_IDS_.indexOf(entry.id)<0, "Se bloqueó un ID de producción.");
    deltaCopyAssert_(Number(entry.headerRow)>0&&Math.floor(Number(entry.headerRow))===Number(entry.headerRow)&&entry.sheet, "Falta nombre de pestaña o fila de encabezados.");
    deltaCopyAssert_(allowed.indexOf(entry.id)<0, "Usuarios y equipos requieren copias separadas."); allowed.push(entry.id);
  });
  if(props.getProperty("DELTA_TEST_INITIALIZED")!=="1")
    deltaCopyAssert_(!props.getProperty("APP_AUTH_TOKEN_SECRET"), "Usá un proyecto nuevo: no reutilizar secretos de producción.");
  var config={};
  keys.forEach(function(key){
    var entry=map[key],book=SpreadsheetApp.openById(entry.id);
    deltaCopyAssert_(book.getName().indexOf("DELTA_TEST_")===0, "La copia debe llamarse DELTA_TEST_... .");
    deltaCopyAssert_(!!book.getSheetByName(entry.sheet), "No existe la pestaña configurada en la copia.");
    config[key]={id:entry.id,sheet:entry.sheet,gid:"",headerRow:Number(entry.headerRow)};
  });
  SHEETS_CONFIG=config;
  // Disable unrelated stores for this editor execution. Web requests reload the copy-only artifact.
  MOVIMIENTOS_EQUIPOS_DB_ID_="DISABLED_IN_COPY_EDITOR_TEST";
  ROP02_ACCELERATOR_DB_ID_="DISABLED_IN_COPY_EDITOR_TEST";
  LICITACIONES_DB_ID_="DISABLED_IN_COPY_EDITOR_TEST";
  PM_DB_ID_="DISABLED_IN_COPY_EDITOR_TEST";
  props.setProperty("DELTA_TEST_INITIALIZED","1");
  return {props:props,config:config};
}
function deltaCopySerializable_(value) {
  if(value instanceof Date)return value.toISOString();
  if(Array.isArray(value))return value.map(deltaCopySerializable_);
  if(value&&typeof value.getA1Notation==="function")return {sheet:value.getSheet().getName(),range:value.getA1Notation()};
  if(value===null||["string","boolean","number"].indexOf(typeof value)>=0)return value;
  return String(value);
}
function deltaCopyValidation_(rule) {
  if(!rule)return null;
  return {type:String(rule.getCriteriaType()),values:deltaCopySerializable_(rule.getCriteriaValues()),allowInvalid:rule.getAllowInvalid(),helpText:rule.getHelpText()};
}
function deltaCopyRowSnapshot_(context,row) {
  var sheet=context.sheet,range=sheet.getRange(row,1,1,sheet.getLastColumn());
  var values=range.getValues()[0],formulas=range.getFormulas()[0],formats=range.getNumberFormats()[0],notes=range.getNotes()[0],validation=range.getDataValidations()[0];
  var backgrounds=range.getBackgrounds()[0],colors=range.getFontColors()[0],weights=range.getFontWeights()[0],styles=range.getFontStyles()[0],sizes=range.getFontSizes()[0],families=range.getFontFamilies()[0];
  var horizontal=range.getHorizontalAlignments()[0],vertical=range.getVerticalAlignments()[0],wrap=range.getWrapStrategies()[0];
  var cells=values.map(function(value,index){
    return {value:formulas[index]?"FORMULA_RESULT_EXCLUDED":deltaCopySerializable_(value),formula:formulas[index],numberFormat:formats[index],note:notes[index],validation:deltaCopyValidation_(validation[index]),background:backgrounds[index],fontColor:colors[index],fontWeight:weights[index],fontStyle:styles[index],fontSize:sizes[index],fontFamily:families[index],horizontal:horizontal[index],vertical:vertical[index],wrap:String(wrap[index])};
  });
  var other=cells.filter(function(_,index){return index!==context.meter;});
  var meterMetadata=Object.assign({},cells[context.meter]);delete meterMetadata.value;
  return {rowCount:sheet.getLastRow(),columnCount:sheet.getLastColumn(),row:row,meterColumn:context.meter+1,meterValue:values[context.meter],otherHash:deltaCopyDigest_(JSON.stringify({headers:context.headers,cells:other})),meterMetadataHash:deltaCopyDigest_(JSON.stringify(meterMetadata))};
}
function deltaCopyDigest_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,text,Utilities.Charset.UTF_8).map(function(b){return ("0"+((b+256)%256).toString(16)).slice(-2);}).join("");
}
function deltaCopyEquipment_() {
  var context=listaMeterContext_(),identity={codigoDrusila:"AF479QX",codigoNuevo:"CTA-0530"};
  var row=listaMeterRow_(context,identity);listaMeterValidateRow_(context,row,identity);
  deltaCopyAssert_(!context.sheet.getRange(row,context.meter+1).getFormula(), "La lectura CTA-0530 contiene una fórmula: no se puede ejecutar la prueba de escritura.");
  return {context:context,identity:identity,row:row};
}
function deltaCopyAddUser_(label) {
  var info=getUsuariosSheetInfo_(),email="delta-v9-"+Utilities.getUuid().replace(/-/g,"")+"@example.invalid";
  var row=new Array(info.headers.length).fill("");
  row[info.emailIdx]=email;row[info.rolIdx]="USUARIO";row[info.proyectoIdx]="TODOS";row[info.activoIdx]="SI";row[info.nombreIdx]=label;row[info.passwordIdx]="";row[info.areaIdx]="TALLER CENTRAL";
  var rowNumber=info.sheet.getLastRow()+1;
  // Fixture creation is separate from meter mutation; it writes only a fictitious user in the copy.
  info.sheet.getRange(rowNumber,1,1,row.length).setValues([row]);SpreadsheetApp.flush();
  return {email:email,nombre:label,area:"TALLER CENTRAL"};
}
function deltaCheckCopies() {
  var setup=deltaCopyConfigure_(),equipment=deltaCopyEquipment_();
  var report={ok:true,copyOnly:true,executedAt:new Date().toISOString(),backendVersion:DELTA_BACKEND_VERSION_,scriptId:ScriptApp.getScriptId(),copyIds:[setup.config.usuarios.id,setup.config.lista_equipos.id],cta0530Found:true,row:equipment.row,column:equipment.context.meter+1};
  console.log(JSON.stringify(report));return report;
}
function deltaCopyIntegrationStatus_() {
  var setup=deltaCopyConfigure_(),equipment=deltaCopyEquipment_(),current=deltaCopyRowSnapshot_(equipment.context,equipment.row);
  var baseline=JSON.parse(setup.props.getProperty("DELTA_TEST_WEB_BASELINE")||"null");
  return {fixtureEmail:setup.props.getProperty("DELTA_TEST_WEB_EMAIL"),current:current,baseline:baseline,integrity:baseline?{otherCellsUnchanged:current.otherHash===baseline.otherHash,meterMetadataUnchanged:current.meterMetadataHash===baseline.meterMetadataHash,rowCountUnchanged:current.rowCount===baseline.rowCount,columnCountUnchanged:current.columnCount===baseline.columnCount}:null};
}
function deltaPrepareCopyWebUser() {
  var setup=deltaCopyConfigure_(),equipment=deltaCopyEquipment_(),fixture=deltaCopyAddUser_("Prueba HTTP V9");
  setup.props.setProperty("DELTA_TEST_WEB_EMAIL",fixture.email);
  setup.props.setProperty("DELTA_TEST_WEB_BASELINE",JSON.stringify(deltaCopyRowSnapshot_(equipment.context,equipment.row)));
  var report={ok:true,copyOnly:true,fixtureEmail:fixture.email,backendVersion:DELTA_BACKEND_VERSION_,scriptId:ScriptApp.getScriptId(),message:"Usuario ficticio con primer ingreso preparado. No se muestran secretos ni tokens."};
  console.log(JSON.stringify(report));return report;
}
function deltaRunCopiesIntegration() {
  var setup=deltaCopyConfigure_(),equipment=deltaCopyEquipment_(),context=equipment.context,row=equipment.row,cell=context.sheet.getRange(row,context.meter+1);
  var baseline=deltaCopyRowSnapshot_(context,row),originalValue=cell.getValue(),originalMirrorWriter=authMirrorWrite_;
  var fixture=deltaCopyAddUser_("Auditoría V9"),password1="COPY_"+Utilities.getUuid(),password2="COPY_"+Utilities.getUuid(),cases=[];
  var report={ok:false,copyOnly:true,kind:"Google Sheets copies, editor integration",executedAt:new Date().toISOString(),backendVersion:DELTA_BACKEND_VERSION_,scriptId:ScriptApp.getScriptId(),cases:cases,realHttpTimeoutTested:false};
  function check(name,condition){cases.push({name:name,passed:!!condition});deltaCopyAssert_(condition,"Falló: "+name);}
  function authenticate(password){return handleAuthenticateUser_(fixture.email,password);}
  function profile(current,next,id){return {email:fixture.email,currentPassword:current,newPassword:next,nombre:fixture.nombre,area:fixture.area,operationId:id};}
  function meter(value,expected,id,actor){return {operationId:id,actor:actor,updates:[{identity:equipment.identity,value:value,expectedValue:expected}]};}
  try {
    var login=authenticate("DELTA.MINING.APP");check("Primer ingreso",login.ok&&login.mustChangePassword===true);
    var profileRequest=profile("DELTA.MINING.APP",password1,"copy_profile_"+Utilities.getUuid());
    var saved=handleUpdateUserProfile_(profileRequest);check("Cambio de contraseña confirmado",saved.ok&&saved.mustChangePassword===false&&!!saved.authToken);
    check("Login con nueva contraseña",authenticate(password1).ok);
    check("Contraseña anterior rechazada",!authenticate("DELTA.MINING.APP").ok);
    check("Perfil idempotente",handleUpdateUserProfile_(profileRequest).deduplicated===true);
    // Inject only the mirror fault in memory. Storage operations still hit the actual copies.
    authMirrorWrite_=function(){throw new Error("Injected copy-only mirror failure");};
    var pending=handleUpdateUserProfile_(profile(password1,password2,"copy_profile_fault_"+Utilities.getUuid()));
    check("Espejo fallido después de escritura real en copia",pending.ok&&pending.authSync==="pending");
    check("Nueva contraseña usable durante fallo inyectado",authenticate(password2).ok&&!authenticate(password1).ok);
    authMirrorWrite_=originalMirrorWriter;
    var personal=authenticate(password2);check("Espejo recuperado",personal.ok&&setup.props.getProperty(authDirtyKey_(fixture.email))===null);
    var actor={email:fixture.email,token:personal.authToken},expected=listaMeterNumber_(originalValue,true);
    deltaCopyAssert_(expected!==null,"La lectura original está vacía; preparar un valor en la copia antes de esta prueba.");
    var request=meter(expected+1,expected,"copy_meter_"+Utilities.getUuid(),actor);
    var updated=handleListaHorometros_(request,false);check("CTA-0530: escritura y confirmación",updated.status==="complete"&&cell.getValue()===expected+1);
    var version=getDatasetVersion_("lista_equipos");
    check("Reintento sin nueva versión",handleListaHorometros_(request,false).status==="complete"&&getDatasetVersion_("lista_equipos")===version);
    var partialRequest=meter(expected+2,expected+1,"copy_partial_"+Utilities.getUuid(),actor);
    partialRequest.updates.push({identity:{codigoNuevo:"DELTA-NO-SUCH-EQUIPMENT"},value:1,expectedValue:0});
    var partial=handleListaHorometros_(partialRequest,false);check("Resultado parcial",partial.status==="partial"&&partial.updatedRows===1&&partial.failedRows===1);
    var conflict=handleListaHorometros_(meter(expected+3,expected,"copy_conflict_"+Utilities.getUuid(),actor),false);
    check("Conflicto no sobrescribe dato nuevo",conflict.results[0].code==="CONFLICT"&&cell.getValue()===expected+2);
    var lostRequest=meter(expected+3,expected+2,"copy_lost_"+Utilities.getUuid(),actor);
    handleListaHorometros_(lostRequest,false); // Deliberately discard the result, NOT an actual HTTP timeout.
    check("Respuesta descartada: verificación posterior",handleListaHorometros_(lostRequest,true).status==="complete"&&cell.getValue()===expected+3);
    var after=deltaCopyRowSnapshot_(context,row);
    check("Todas las demás columnas y metadatos conservados",baseline.otherHash===after.otherHash&&baseline.meterMetadataHash===after.meterMetadataHash);
    check("Sin filas ni columnas duplicadas",baseline.rowCount===after.rowCount&&baseline.columnCount===after.columnCount);
    report.ok=true;report.faultInjection={authMirror:true,lostHandlerResult:true,actualNetworkTimeout:false};
    report.integrity={beforeOtherHash:baseline.otherHash,afterOtherHash:after.otherHash,rowCount:after.rowCount,columnCount:after.columnCount};
  } catch(error) {report.error=error.message;}
  finally {
    authMirrorWrite_=originalMirrorWriter;
    // Restore ONLY the meter cell, and only in the validated copy. Never rewrite the row.
    try{cell.setValue(originalValue);SpreadsheetApp.flush();report.meterRestored=cell.getValue()===originalValue;}
    catch(_){report.ok=false;report.meterRestored=false;report.recovery="Restaurar manualmente sólo la celda de lectura en la copia desde el valor previo registrado.";}
  }
  setup.props.setProperty("DELTA_TEST_LAST_REPORT",JSON.stringify(report));console.log(JSON.stringify(report));return report;
}
function deltaCopyReadEquipment_() {
  deltaCopyConfigure_();var equipment=deltaCopyEquipment_(),context=equipment.context;
  var values=context.sheet.getRange(equipment.row,1,1,context.headers.length).getValues()[0],data={};
  context.headers.forEach(function(header,index){data[header]=values[index];});
  return {ok:true,data:[data],rowNumber:equipment.row,identity:equipment.identity,meterColumn:context.headers[context.meter],version:getDatasetVersion_("lista_equipos")};
}
