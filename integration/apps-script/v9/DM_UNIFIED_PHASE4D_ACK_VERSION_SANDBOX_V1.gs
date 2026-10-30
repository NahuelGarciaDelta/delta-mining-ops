/**
 * DELTA OPS V9 — 4D, ACK por identidad+revision en Supabase SANDBOX.
 * Registro estrictamente sintetico, no usa ROP02/ROP05 reales.
 * Requiere credencial EXCLUSIVA de proyecto de pruebas ya configurada en 3G.
 * Sin triggers; no cambia Sheets, V8.1, Supabase produccion ni estado de 4B/4C.
 * Funcion de prueba unica: probarMigracionFase4dAckSandboxV1()
 */
var DM_U4D_TEST_REF_ = 'biztlietuvvonigcfdwy';
var DM_U4D_PROD_REF_ = 'jwfocqaxlckuxoklwyxs';
var DM_U4D_URL_ = 'https://' + DM_U4D_TEST_REF_ + '.supabase.co';
var DM_U4D_RPC_ = 'delta_4d_sandbox_apply_v1';
var DM_U4D_TEST_ID_ = 'test-4d-rop05-gas-001';
var DM_U4D_TEST_PROP_ = 'DM_U4D_V1_SYNTHETIC_ACK';
function dmU4dAssert_(v, message) { if (!v) throw new Error('FASE 4D BLOQUEADA: '+message); }
function dmU4dHex_(bytes) {
  return bytes.map(function(b){return ('0'+(b&255).toString(16)).slice(-2);}).join('');
}
function dmU4dDigest_(s) {
  return dmU4dHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s,Utilities.Charset.UTF_8));
}
function dmU4dConfig_(){
  var props = PropertiesService.getScriptProperties();
  var ref = props.getProperty('DM_U3G_V1_SANDBOX_REF');
  var url = props.getProperty('DM_U3G_V1_SANDBOX_URL');
  var key = props.getProperty('DM_U3G_V1_TEST_SECRET_KEY');
  var approved = props.getProperty('DM_U3G_V1_SANDBOX_CONFIRMED');
  var opted = props.getProperty('DM_U3G_V1_ALLOW_SYNTHETIC_WRITES');
  dmU4dAssert_(ref===DM_U4D_TEST_REF_ && ref!==DM_U4D_PROD_REF_ && url===DM_U4D_URL_,'URL de sandbox inesperada');
  dmU4dAssert_(approved==='I_CREATED_A_SEPARATE_TEST_PROJECT' && opted==='YES_TEST_ONLY', 'autorizacion sintetica 3G ausente');
  dmU4dAssert_(/^sb_secret_[A-Za-z0-9_-]{15,}$/.test(String(key||'')), 'falta secret exclusivo sandbox');
  return {url:url,key:key,props:props};
}
function dmU4dReq_(revision){
  dmU4dAssert_(revision===1||revision===2,'revision sintetica no permitida');
  var payload={synthetic:true,marker:'DELTA_U4D_SANDBOX_ONLY',revision:revision,taskOrdinal:1,content:'FICTICIO_'+revision};
  var digest=dmU4dDigest_(JSON.stringify(payload));
  var requestId=revision===1?'00000000-0000-4000-8000-0000000004d1':'00000000-0000-4000-8000-0000000004d2';
  return {p_request_id:requestId,p_dataset:'rop05',p_record_id:DM_U4D_TEST_ID_,p_revision:revision,p_digest:digest,p_payload:payload};
}
function dmU4dPost_(cfg,req){
  dmU4dAssert_(DM_U4D_URL_==='https://biztlietuvvonigcfdwy.supabase.co','URL hardcodeada invalida');
  dmU4dAssert_(req.p_payload.synthetic===true && req.p_record_id===DM_U4D_TEST_ID_ && /^test-4d-/.test(req.p_record_id),'payload no sintetico');
  dmU4dAssert_(req.p_digest===dmU4dDigest_(JSON.stringify(req.p_payload)),'cambio del payload tras generar digest');
  var url=cfg.url+'/rest/v1/rpc/'+DM_U4D_RPC_;
  dmU4dAssert_(url.indexOf('https://'+DM_U4D_TEST_REF_+'.supabase.co/rest/v1/rpc/')===0,'destino fuera sandbox');
  var response=UrlFetchApp.fetch(url,{
    method:'post',contentType:'application/json',
    headers:{apikey:cfg.key,Accept:'application/json'},
    payload:JSON.stringify(req),muteHttpExceptions:true,followRedirects:false
  });
  var status=response.getResponseCode();
  dmU4dAssert_(status===200,'respuesta RPC HTTP '+status+'; no confirmar');
  var json;
  try {json=JSON.parse(response.getContentText());} catch(e){throw new Error('FASE 4D BLOQUEADA: RPC sin JSON');}
  dmU4dAssert_(json && json.ok===true && json.ack===true && json.sandbox===true && json.productionWrites===0,'ACK sin prueba sandbox');
  dmU4dAssert_(json.dataset===req.p_dataset && json.recordId===req.p_record_id &&
    json.acceptedRevision===req.p_revision && json.digest===req.p_digest,'ACK no coincide con identidad y version');
  return json;
}
function probarMigracionFase4dAckSandboxV1(){
  Logger.log('=== DELTA V9 FASE 4D / ACK VERSIONADO SOLO DATOS SINTETICOS SANDBOX ===');
  var cfg=dmU4dConfig_(),lock=LockService.getScriptLock();
  dmU4dAssert_(lock.tryLock(5000),'otra ejecucion en el clon');
  try {
    var r1=dmU4dReq_(1),a1=dmU4dPost_(cfg,r1),a1Replay=dmU4dPost_(cfg,r1);
    dmU4dAssert_(a1Replay.replayReceipt===true,'sin reintento idempotente revision 1');
    var r2=dmU4dReq_(2),a2=dmU4dPost_(cfg,r2),a2Replay=dmU4dPost_(cfg,r2);
    dmU4dAssert_(a2.latestRevision===2 && a2Replay.replayReceipt===true,'sin ACK version 2 o replay');
    var out={ok:true,mode:'SYNTHETIC_SANDBOX_ONLY',dataset:'rop05',syntheticId:DM_U4D_TEST_ID_,
      revision1Confirmed:a1.ack===true,revision1ReplayConfirmed:a1Replay.replayReceipt===true,
      revision2Confirmed:a2.ack===true,revision2ReplayConfirmed:a2Replay.replayReceipt===true,
      latestRevision:a2.latestRevision,sandboxRef:DM_U4D_TEST_REF_,
      realRecordsSent:0,productionWrites:0,realAckCount:0,
      notes:'RPC con ACK para datos ficticios. NO habilita corte ni implica persistencia de los 5290 registros operativos.'};
    cfg.props.setProperty(DM_U4D_TEST_PROP_,JSON.stringify({version:1,confirmed:true,at:new Date().toISOString(),latestRevision:2}));
    Logger.log(JSON.stringify(out,null,2));return out;
  } finally {lock.releaseLock();}
}

/**
 * DELTA OPS V9 / FASE 4H — Circuito de ACK sintético con cola 4F (READ ONLY).
 * REEMPLAZA el contenido del 4D existente; NO agregar nuevo archivo .gs.
 * - Revisa SOLO estados G de ENTREGAS_PREPARADAS en el libro privado 4E.
 * - Emplea un registro sintetico fijo, diferente de todos los ID AppSheet reales.
 * - Simula carga de horas sin tareas => NO ENVÍO.
 * - Simula tarea con productividad pendiente => NO ENVÍO.
 * - Envía v1 y v2 con los mismos metadatos de tarea sintética, SHA correcto y
 *   request_id estable. Repite ambos; comprueba ACK idempotente.
 * - No escribe ninguna celda, no modifica propiedades, no instala triggers.
 * - Jamás envía a Supabase datos operativos; el receptor 4G exige SIMULATED_4G.
 * - No autoriza corte o sincronización real.
 */
var DM_U4H_SANDBOX_RPC_='delta_4g_sandbox_accept_v1';
var DM_U4H_TASK_='rop02_jm:test-4g-gas-4h-001:t1';
var DM_U4H_DS_='rop02_jm';
var DM_U4H_BOOK_PROP_='DM_U4E_SHADOW_OUTBOX_SPREADSHEET_ID';
function dmU4hAssert_(ok,why){if(!ok)throw new Error('4H BLOQUEADA: '+why);}
function dmU4hOutboxSnapshot_(){
  dmU4hAssert_(typeof DM_V9_4E_PRODUCTION_IDS_!=='undefined' &&
    typeof DM_V9_4E_MAGIC_!=='undefined' && typeof dmV9U4fRequestId_==='function',
    'falta 4B/4F V3 en el proyecto de pruebas');
  var id=PropertiesService.getScriptProperties().getProperty(DM_U4H_BOOK_PROP_);
  dmU4hAssert_(!!id && DM_V9_4E_PRODUCTION_IDS_.indexOf(id)<0,'libro outbox no es de pruebas');
  var ss=SpreadsheetApp.openById(id);
  var meta=ss.getSheetByName('__META_V9');
  dmU4hAssert_(!!meta && meta.getRange(1,2).getValue()===DM_V9_4E_MAGIC_,'marcador de outbox incorrecto');
  var sh=ss.getSheetByName('ENTREGAS_PREPARADAS');
  dmU4hAssert_(!!sh,'falta hoja ENTREGAS_PREPARADAS');
  var count=sh.getLastRow()-1;
  dmU4hAssert_(count>=0 && count<=50000,'tamaño de cola fuera de límites');
  dmU4hAssert_(sh.getRange(1,7).getValue()==='delivery_state','columna G alterada');
  var states=count?sh.getRange(2,7,count,1).getValues():[];
  var counts={PREPARED_NO_SEND:0,WAITING_PRODUCTIVITY_NO_SEND:0,HISTORY_GAP_NO_SEND:0};
  states.forEach(function(row){
    var s=String(row[0]||'');
    dmU4hAssert_(Object.prototype.hasOwnProperty.call(counts,s),'estado desconocido en el outbox');
    counts[s]++;
  });
  return {outboxRows:count,readyNotConfirmed:counts.PREPARED_NO_SEND,
    awaitingProductivity:counts.WAITING_PRODUCTIVITY_NO_SEND,
    historyGaps:counts.HISTORY_GAP_NO_SEND};
}
function dmU4hFixture_(revision){
  dmU4hAssert_(revision===1||revision===2,'revisión sintética no prevista');
  // Todos los campos sintéticos. No se lee ni copia ninguna fila de negocio.
  var arr=Array(15).fill('SIMULATED_4G_FIELD');
  arr[0]='2000-01-01';arr[1]='TEST-ONLY';arr[2]='SIMULATED';
  arr[3]=revision===1?'SIMULATED_READY':'SIMULATED_EDITED';
  arr[12]='SIMULATED_QTY_'+revision;
  arr[14]='SIMULATED_4G';
  var canonical=JSON.stringify(arr);
  var digest=dmU4dDigest_(canonical);
  return {p_request_id:dmV9U4fRequestId_(DM_U4H_DS_,DM_U4H_TASK_,revision,digest),
    p_dataset:DM_U4H_DS_,p_task_key:DM_U4H_TASK_,p_revision:revision,
    p_digest:digest,p_canonical_json:canonical};
}
function dmU4hEnviarFixture_(cfg,req,syntheticState){
  if(syntheticState==='HOURS_ONLY_NO_TASK'||syntheticState==='WAITING_PRODUCTIVITY_NO_SEND'){
    return {skipped:true,state:syntheticState};
  }
  dmU4hAssert_(syntheticState==='PREPARED_NO_SEND','estado no permitido');
  dmU4hAssert_(cfg.url==='https://biztlietuvvonigcfdwy.supabase.co','URL fuera de sandbox');
  dmU4hAssert_(req.p_dataset===DM_U4H_DS_ && req.p_task_key===DM_U4H_TASK_ &&
    /^rop02_jm:test-4g-[a-z0-9_-]+:t1$/.test(req.p_task_key),'clave no sintética');
  var p;
  try{p=JSON.parse(req.p_canonical_json);}catch(e){throw new Error('4H BLOQUEADA: JSON mal formado');}
  dmU4hAssert_(Array.isArray(p)&&p.length===15 && p.every(function(x){return typeof x==='string';}) &&
    p[14]==='SIMULATED_4G' && p[1]==='TEST-ONLY','payload no sintético');
  dmU4hAssert_(req.p_digest===dmU4dDigest_(req.p_canonical_json),'SHA-256 cambió');
  dmU4hAssert_(req.p_request_id===dmV9U4fRequestId_(req.p_dataset,req.p_task_key,
    req.p_revision,req.p_digest),'request_id no determinista');
  var endpoint=cfg.url+'/rest/v1/rpc/'+DM_U4H_SANDBOX_RPC_;
  dmU4hAssert_(endpoint==='https://biztlietuvvonigcfdwy.supabase.co/rest/v1/rpc/delta_4g_sandbox_accept_v1',
    'ruta de RPC no autorizada');
  var response=UrlFetchApp.fetch(endpoint,{method:'post',contentType:'application/json',
    headers:{apikey:cfg.key,Accept:'application/json'},payload:JSON.stringify(req),
    muteHttpExceptions:true,followRedirects:false});
  dmU4hAssert_(response.getResponseCode()===200,
    'HTTP inesperado; ACK desconocido, no reintentar con nueva identidad');
  var ack;
  try{ack=JSON.parse(response.getContentText());}catch(e){throw new Error('4H BLOQUEADA: respuesta sin JSON');}
  dmU4hAssert_(ack && ack.ok===true && ack.ack===true && ack.sandbox===true &&
    ack.productionWrites===0 && ack.dataset===req.p_dataset &&
    ack.taskKey===req.p_task_key && ack.acceptedRevision===req.p_revision &&
    ack.digest===req.p_digest && ack.requestId===req.p_request_id &&
    Number(ack.latestRevision)>=req.p_revision,'ACK no coincide con el registro');
  return ack;
}
/** ÚNICA EJECUCIÓN 4H: lee estados locales y prueba 4 ACK sintéticos. */
function probarMigracionFase4hAckDesdeColaV1(){
  var lock=LockService.getScriptLock();
  dmU4hAssert_(lock.tryLock(5000),'otra prueba en ejecución');
  try{
    var bookSummary=dmU4hOutboxSnapshot_(); // 100% read-only
    var cfg=dmU4dConfig_(); // credencial EXCLUSIVA sandbox de 3G, sin imprimir
    var r1=dmU4hFixture_(1),r2=dmU4hFixture_(2);
    var skipHours=dmU4hEnviarFixture_(cfg,r1,'HOURS_ONLY_NO_TASK');
    var skipWaiting=dmU4hEnviarFixture_(cfg,r1,'WAITING_PRODUCTIVITY_NO_SEND');
    dmU4hAssert_(skipHours.skipped===true&&skipWaiting.skipped===true,'se intentó enviar pendiente');
    var a1=dmU4hEnviarFixture_(cfg,r1,'PREPARED_NO_SEND');
    var again1=dmU4hEnviarFixture_(cfg,r1,'PREPARED_NO_SEND');
    dmU4hAssert_(again1.replayReceipt===true,'replay v1 no reconocido');
    var a2=dmU4hEnviarFixture_(cfg,r2,'PREPARED_NO_SEND');
    var again2=dmU4hEnviarFixture_(cfg,r2,'PREPARED_NO_SEND');
    dmU4hAssert_(again2.replayReceipt===true && a2.latestRevision===2,'v2 o replay v2 incorrecto');
    var out={ok:true,mode:'4H_SYNTHETIC_ACK_FROM_REAL_OUTBOX_COUNTS',
      localOutbox:bookSummary,syntheticNotSent:2,syntheticAckResponses:4,
      acceptedRevision1:a1.ack===true,acceptedRevision2:a2.ack===true,
      replayRevision1:again1.replayReceipt===true,replayRevision2:again2.replayReceipt===true,
      sandboxRef:DM_U4D_TEST_REF_,
      operationalRowsTransmitted:0,operationalRowsAcked:0,
      outboxRowsChanged:0,productionWrites:0,realAckCount:0,
      warning:'4H es solo ensayo del transporte; las 5287 tareas PREPARED_NO_SEND no están formalmente cerradas ni sincronizadas.'};
    Logger.log(JSON.stringify(out,null,2));return out;
  }finally{lock.releaseLock();}
}

/**
 * DELTA OPS V9 / FASE 4I — PLANIFICADOR DE REVISIONES DE PUBLICACION (SOLO LECTURA).
 *
 * 4E/4F = revisiones de BORRADOR local, potencialmente múltiples por tarea.
 * 4I = secuencia de ENTREGA independiente: el primer ACK remoto es revision 1,
 *      aunque el borrador actual tenga revision 5, 10, etc.
 *
 * La carga diferida se trata como actualización del MISMO task_key.
 * Una tarea WAITING_PRODUCTIVITY_NO_SEND o HISTORY_GAP_NO_SEND no se propone.
 * Una tarea PREPARED_NO_SEND es solo CANDIDATA, no confirmación administrativa.
 *
 * CERO escrituras y CERO HTTP. No cambia el 4B ni agrega activadores.
 */
var DM_V9_4I_READ_COLS_=12;
var DM_V9_4I_EXPECTED_HEADER_=['dataset','task_key','revision','payload_sha256','request_id',
 'payload_canonical_json','delivery_state','created_at_utc','last_attempt_at_utc','ack_receipt',
 'last_error_code','source_row_hint'];
function dmU4iAssert_(x,reason){if(!x)throw new Error('FASE 4I BLOQUEADA: '+reason);}
/**
 * @param {Array<Array>} draftRows A:L from ENTREGAS_PREPARADAS, excluding heading.
 * @param {Array<Object>} verifiedAcks Internal only; must originate in a VERIFIED ACK ledger
 *    once built. For 4I actual preview, [] is passed deliberately (no such ledger yet).
 * Pure, never stores or transmits real payloads.
 */
function dmU4iPlanificar_(draftRows,verifiedAcks){
 dmU4iAssert_(Array.isArray(draftRows)&&Array.isArray(verifiedAcks),'entrada no array');
 var draftsByKey=new Map(),draftVersions=new Map();
 for(var i=0;i<draftRows.length;i++){
  var r=draftRows[i],ds=String(r[0]||''),key=String(r[1]||''),rev=Number(r[2]),digest=String(r[3]||'');
  var requestId=String(r[4]||''),canonical=String(r[5]||''),state=String(r[6]||'');
  dmU4iAssert_(ds==='rop02_jm'||ds==='rop02_fs','dataset desconocido');
  dmU4iAssert_(key.indexOf(ds+':')===0 && /:t[123]$/.test(key),'task_key invalido');
  dmU4iAssert_(Number.isSafeInteger(rev)&&rev>=1&&rev<=100000,'revision invalida');
  dmU4iAssert_(/^[a-f0-9]{64}$/.test(digest),'digest invalido');
  dmU4iAssert_(canonical.length>1&&canonical.length<30000,'payload vacio o excedido');
  dmU4iAssert_(dmU4dDigest_(canonical)===digest,'hash no coincide con payload');
  dmU4iAssert_(requestId===dmV9U4fRequestId_(ds,key,rev,digest),'request_id de borrador alterado');
  dmU4iAssert_(state==='PREPARED_NO_SEND'||state==='WAITING_PRODUCTIVITY_NO_SEND'||
   state==='HISTORY_GAP_NO_SEND','estado no reconocido');
  dmU4iAssert_(!r[8]&&!r[9]&&!r[10],'no deberia haber ACK ni intento en cola sombra');
  var parsed;
  try{parsed=JSON.parse(canonical);}catch(e){throw new Error('FASE 4I BLOQUEADA: payload JSON invalido');}
  dmU4iAssert_(Array.isArray(parsed)&&parsed.length===15&&parsed.every(function(x){return typeof x==='string';}),
   'formato canonico no coincide con ROP05');
  var pair=key+'#'+rev;
  dmU4iAssert_(!draftVersions.has(pair),'version de borrador duplicada');
  draftVersions.set(pair,true);
  var previous=draftsByKey.get(key);
  if(!previous||previous.draftRevision<rev){draftsByKey.set(key,{dataset:ds,key:key,draftRevision:rev,digest:digest,
   canonical:canonical,state:state});}
 }
 var ackByKey=new Map(),ackCount=0;
 verifiedAcks.forEach(function(a){
  dmU4iAssert_(a&&typeof a==='object','ack invalido');
  var ds=String(a.dataset||''),key=String(a.taskKey||''),rev=Number(a.deliveryRevision),digest=String(a.digest||'');
  dmU4iAssert_(ds==='rop02_jm'||ds==='rop02_fs','dataset ack invalido');
  dmU4iAssert_(key.indexOf(ds+':')===0&&/:t[123]$/.test(key),'clave de ack invalida');
  dmU4iAssert_(Number.isSafeInteger(rev)&&rev>=1&&rev<=100000,'revision ack invalida');
  dmU4iAssert_(/^[a-f0-9]{64}$/.test(digest),'hash ack invalido');
  dmU4iAssert_(a.verified===true && a.remoteAck===true,'ack sin comprobacion real');
  dmU4iAssert_(a.requestId===dmU4iDeliveryRequestId_(ds,key,rev,digest),'request_id ack invalido');
  dmU4iAssert_(draftsByKey.has(key),'ack para tarea desconocida en shadow');
  // El ACK debe corresponder a AL MENOS un snapshot de borrador conservado.
  // Un recibo de identidad conocida pero contenido desconocido nunca cuenta.
  var matchingSnapshot=draftRows.some(function(r){return String(r[1]||'')===key && String(r[3]||'')===digest;});
  dmU4iAssert_(matchingSnapshot,'ACK no coincide con ningún snapshot local');
  if(!ackByKey.has(key))ackByKey.set(key,[]);
  ackByKey.get(key).push({revision:rev,digest:digest});ackCount++;
 });
 ackByKey.forEach(function(arr,key){
  arr.sort(function(a,b){return a.revision-b.revision;});
  arr.forEach(function(x,i){dmU4iAssert_(x.revision===i+1,'ack remoto salteado o duplicado '+key);});
 });
 var result={distinctTasks:draftsByKey.size,draftRowsChecked:draftRows.length,
  readyCandidates:0,waitingProductivity:0,historyGaps:0,
  alreadyRemoteUpToDate:0,firstDeliveryRevisionCandidates:0,nextDeliveryRevisionCandidates:0,
  ackProofsChecked:ackCount,realTransmissions:0,productionWrites:0,localWrites:0,
  remoteAckWrites:0,authorizedToTransmit:0};
 var proposals=[];
 draftsByKey.forEach(function(draft,key){
  if(draft.state==='WAITING_PRODUCTIVITY_NO_SEND'){result.waitingProductivity++;return;}
  if(draft.state==='HISTORY_GAP_NO_SEND'){result.historyGaps++;return;}
  var old=ackByKey.get(key)||[];
  var latest=old.length?old[old.length-1]:null;
  if(latest&&latest.digest===draft.digest){result.alreadyRemoteUpToDate++;return;}
  var deliveryRev=latest?latest.revision+1:1;
  var deliveryRequestId=dmU4iDeliveryRequestId_(draft.dataset,key,deliveryRev,draft.digest);
  proposals.push({dataset:draft.dataset,taskKey:key,draftRevision:draft.draftRevision,
    deliveryRevision:deliveryRev,digest:draft.digest,requestId:deliveryRequestId});
  result.readyCandidates++;
  if(deliveryRev===1)result.firstDeliveryRevisionCandidates++;
  else result.nextDeliveryRevisionCandidates++;
 });
 return {summary:result,proposals:proposals};
}
/** SHA256-derived UUIDv8. Distinct namespace from 4F draft request IDs. */
function dmU4iDeliveryRequestId_(ds,key,deliveryRevision,digest){
 var h=dmU4dDigest_('delta-ops-v9/publication/1|'+ds+'|'+key+'|'+deliveryRevision+'|'+digest);
 return h.slice(0,8)+'-'+h.slice(8,12)+'-8'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);
}
/**
 * Lee A:L del libro 4E, calcula la primera secuencia publicable en memoria,
 * y únicamente devuelve CONTADORES. Nunca crea una pestaña ni modifica estados.
 * El 4I no posee fuente de ACK reales; por diseño le pasa lista vacía.
 * Ningún PREPARED_NO_SEND autoriza por sí solo el envío.
 */
function dmV9PrevisualizarFase4iRevisionesPublicacionV1(){
 var lock=LockService.getScriptLock();
 dmU4iAssert_(lock.tryLock(7000),'otra prueba en curso');
 try{
  dmU4iAssert_(typeof dmV9U4fRequestId_==='function' &&
    typeof DM_V9_4E_MAGIC_!=='undefined' && typeof DM_V9_4E_PRODUCTION_IDS_!=='undefined',
    'no esta instalada la revision 4F V3 del archivo 4B');
  var id=PropertiesService.getScriptProperties().getProperty('DM_U4E_SHADOW_OUTBOX_SPREADSHEET_ID');
  dmU4iAssert_(!!id && !DM_V9_4E_PRODUCTION_IDS_.includes(id),'no es el libro sombra privado');
  var book=SpreadsheetApp.openById(id),meta=book.getSheetByName('__META_V9');
  dmU4iAssert_(!!meta&&meta.getRange(1,2).getValue()===DM_V9_4E_MAGIC_,'marca del libro 4E incorrecta');
  var sh=book.getSheetByName('ENTREGAS_PREPARADAS');
  dmU4iAssert_(!!sh && sh.getLastRow()>=1 && sh.getLastRow()<=50001,'cola desconocida');
  var header=sh.getRange(1,1,1,DM_V9_4I_READ_COLS_).getValues()[0];
  dmU4iAssert_(header.every(function(x,i){return x===DM_V9_4I_EXPECTED_HEADER_[i];}),
    'encabezado de cola 4F no coincide');
  var n=sh.getLastRow()-1;
  var rows=n?sh.getRange(2,1,n,DM_V9_4I_READ_COLS_).getValues():[];
  var p=dmU4iPlanificar_(rows,[]).summary;
  var result={ok:true,mode:'4I_PUBLICATION_SEQUENCE_PREVIEW_ONLY',outboxRows:n,
    ...p,closureConfirmed:false,publishingEnabled:false,
    waitingForCutover:true,operationalPayloadsTransmitted:0,
    warning:'Revisiones de PUBLICACION propuestas, no enviadas; primeras publicaciones = rev 1 aun con borrador rev > 1.'};
  Logger.log(JSON.stringify(result,null,2));return result;
 }finally{lock.releaseLock();}
}