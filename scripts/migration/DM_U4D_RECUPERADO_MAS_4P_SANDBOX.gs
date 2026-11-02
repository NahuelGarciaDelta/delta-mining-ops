/**
 * DELTA OPS V9 — FASE 4D / RESTAURACIÓN DESDE CÓDIGO DEL USUARIO.
 * SOLO CLON V9 DE PRUEBAS. NO INSTALAR EN EL PRODUCTIVO.
 * Clave exclusiva de sandbox desde ScriptProperties; nunca en código.
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
      notes:'RPC con ACK para datos ficticios. NO habilita corte ni implica persistencia operativa.'};
    cfg.props.setProperty(DM_U4D_TEST_PROP_,JSON.stringify({version:1,confirmed:true,at:new Date().toISOString(),latestRevision:2}));
    Logger.log(JSON.stringify(out,null,2));return out;
  } finally {lock.releaseLock();}
}

/**
 * DELTA OPS V9 / FASE 4P — ADAPTADOR 4F -> receptor V9 del SANDBOX.
 * ANEXAR AL FINAL DEL ARCHIVO 4D/4H EXISTENTE del CLON (no crear otro .gs).
 * NO es un consumidor real de ENTREGAS_PREPARADAS; JAMÁS lee sus payloads.
 * Único envío permitido: dos revisiones de una tarea FICTICIA fija.
 * Usa credencial privada de 3G y endpoint exacto del sandbox, sin imprimirla.
 * No modifica Sheets, outbox 4E/4F, 3C/3D ni Supabase producción.
 * Requiere dmU4dConfig_, dmU4dDigest_, dmV9U4fRequestId_,
 * dmV9U4fLeerEstado_, dmU4iDeliveryRequestId_ ya existentes.
 */
var DM_U4P_TEST_TASK_='rop02_jm:test-4p-adapter-20261102:t1';
var DM_U4P_TEST_DATASET_='rop02_jm';
var DM_U4P_REMOTE_DATASET_='rop05';
var DM_U4P_FIELDS_=['fecha','supervisor','proyecto','interno','numero_parte',
  'tipo_equipo','tarea','horas_productivas','largo','ancho','profundidad',
  'cantidad_produccion','unidad','observaciones','mes'];
function dmU4pAssert_(ok,msg){if(!ok)throw new Error('FASE 4P BLOQUEADA: '+msg);}
function dmU4pDeps_(){
  ['dmU4dConfig_','dmU4dDigest_','dmV9U4fRequestId_',
   'dmV9U4fLeerEstado_','dmU4iDeliveryRequestId_'].forEach(function(fn){
    dmU4pAssert_(typeof globalThis[fn]==='function','falta dependencia '+fn);
  });
}
/** Puro: adapta un draft 4F (A:L) a un registro remoto, sin escribir. */
function dmU4pAdaptar4fV1_(draftRow,deliveryRevision){
  dmU4pAssert_(Number.isSafeInteger(deliveryRevision)&&deliveryRevision>=1&&
    deliveryRevision<=100000,'revision de entrega invalida');
  var d=dmV9U4fLeerEstado_(draftRow);
  dmU4pAssert_(d.status==='PREPARED_NO_SEND','productividad no confirmada: NO ENVIO');
  var fields=JSON.parse(d.payload),mapped={};
  DM_U4P_FIELDS_.forEach(function(k,i){mapped[k]=fields[i];});
  // No confundir revisión de borrador con revisión de ENTREGA.
  mapped._v9={origin:'GAS_4F_SANDBOX_ADAPTER',source_dataset:d.dataset,
    source_draft_revision:d.rev,source_sha256:d.digest,
    productivity_state:'PREPARED_NO_SEND',
    publication_status:'PROVISIONAL_NOT_ACKED',snapshot:'4F_CANONICAL_15_FIELDS'};
  var requestId=dmU4iDeliveryRequestId_(d.dataset,d.key,deliveryRevision,d.digest);
  dmU4pAssert_(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/.test(requestId),
    'request_id de publicación no es UUIDv8');
  return {p_request_id:requestId,p_dataset:DM_U4P_REMOTE_DATASET_,p_records:[{
    record_id:d.key,delivery_revision:deliveryRevision,payload:mapped
  }]};
}
/** Fixture idéntico al formato A:L 4F. No lee hojas ni contiene datos reales. */
function dmU4pFixture4fV1_(draftRevision){
  dmU4pAssert_(draftRevision===1||draftRevision===2,'fixture revision invalida');
  var arr=['2000-01-01','SIMULADO','PRUEBAS','TEST-4P','N-TEST-4P',
    'EQUIPO FICTICIO',draftRevision===1?'EXCAVACION FICTICIA':'EXCAVACION EDITADA',
    '5','0','0','0',draftRevision===1?'10':'12','M3',
    'SOLO TEST, SIN PARTE OPERATIVO',"'01/2000"];
  var canonical=JSON.stringify(arr),digest=dmU4dDigest_(canonical);
  return [DM_U4P_TEST_DATASET_,DM_U4P_TEST_TASK_,draftRevision,digest,
    dmV9U4fRequestId_(DM_U4P_TEST_DATASET_,DM_U4P_TEST_TASK_,draftRevision,digest),
    canonical,'PREPARED_NO_SEND','2000-01-01T00:00:00Z','','','',900000411];
}
/** Único canal de transporte, exclusivamente TEST-4P en sandbox. */
function dmU4pSandboxRpcV1_(cfg,rpc,args){
  dmU4pAssert_(cfg&&cfg.url==='https://biztlietuvvonigcfdwy.supabase.co',
    'URL distinta de sandbox');
  dmU4pAssert_(rpc==='v9_ingest_accept_batch_v1'||rpc==='v9_ingest_probe_v1',
    'RPC no permitida');
  if(rpc==='v9_ingest_accept_batch_v1'){
    dmU4pAssert_(args.p_dataset===DM_U4P_REMOTE_DATASET_&&Array.isArray(args.p_records)&&
      args.p_records.length===1,'solo lote sintetico unitario');
    var row=args.p_records[0],m=row.payload&&row.payload._v9;
    dmU4pAssert_(row.record_id===DM_U4P_TEST_TASK_&&
      (row.delivery_revision===1||row.delivery_revision===2)&&
      m&&m.source_dataset===DM_U4P_TEST_DATASET_&&
      m.publication_status==='PROVISIONAL_NOT_ACKED'&&
      m.productivity_state==='PREPARED_NO_SEND'&&
      m.snapshot==='4F_CANONICAL_15_FIELDS'&&
      row.payload.interno==='TEST-4P'&&row.payload.proyecto==='PRUEBAS'&&
      row.payload.fecha==='2000-01-01',
      'registro operativo o meta no sintetica: ENVIO PROHIBIDO');
    var canonical=dmU4pFixture4fV1_(row.delivery_revision);
    var expected=dmU4pAdaptar4fV1_(canonical,row.delivery_revision);
    dmU4pAssert_(JSON.stringify(expected)===JSON.stringify(args),
      'payload difiere del fixture autorizado');
  } else {
    dmU4pAssert_(args.p_dataset==='rop05'&&Array.isArray(args.p_record_ids)&&
      args.p_record_ids.length===1&&args.p_record_ids[0]===DM_U4P_TEST_TASK_,
      'sondeo no sintetico prohibido');
  }
  var url=cfg.url+'/rest/v1/rpc/'+rpc;
  var resp=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',
    headers:{apikey:cfg.key,Accept:'application/json'},
    payload:JSON.stringify(args),muteHttpExceptions:true,followRedirects:false});
  dmU4pAssert_(resp.getResponseCode()===200,
    'HTTP '+resp.getResponseCode()+'; sin ACK verificado');
  var json;
  try{json=JSON.parse(resp.getContentText());}catch(e){throw Error('4P: respuesta remota no JSON');}
  return json;
}
function dmU4pValidarAckV1_(ack,request){
  dmU4pAssert_(ack&&ack.ok===true&&ack.mode==='V9_INDEPENDENT_ONLY'&&
    ack.dataset==='rop05'&&ack.request_id===request.p_request_id&&
    ack.deleted===undefined&&Number(ack.created)+Number(ack.updated)+
    Number(ack.alreadyDelivered)===1&&
    /^[a-f0-9]{64}$/.test(String(ack.batch_sha256||'')),
    'ACK RPC no coincide con solicitud');
  return true;
}
function dmU4pValidarProbeV1_(probe,request){
  dmU4pAssert_(Array.isArray(probe)&&probe.length===1,'sin prueba de fila remota unica');
  var row=probe[0],sent=request.p_records[0];
  dmU4pAssert_(row.record_id===sent.record_id&&
    row.delivery_revision===sent.delivery_revision&&
    row.source_sha256===sent.payload._v9.source_sha256&&
    row.digest_verified===true&&
    /^[a-f0-9]{64}$/.test(String(row.payload_sha256||''))&&
    row.productivity_state==='PREPARED_NO_SEND'&&
    row.publication_status==='PROVISIONAL_NOT_ACKED',
    'prueba remota no corresponde a tarea, hash y revision');
  // El hash PostgreSQL (jsonb::text) NO es el digest canónico del array 4F.
  return {verified:true,sourceDigestMatches:true,remoteDigestVerified:true,
    deliveryRevision:row.delivery_revision};
}
/** ÚNICO runner con POST: cuatro ACK (v1, replay v1, v2, replay v2).
 * Es idempotente incluso si el piloto ya se completó antes. */
function probarMigracionFase4pAdaptadorSandboxV1(){
  dmU4pDeps_();
  var cfg=dmU4dConfig_();
  var lock=LockService.getScriptLock();
  dmU4pAssert_(lock.tryLock(5000),'otra ejecucion concurrente');
  try{
    var v1=dmU4pAdaptar4fV1_(dmU4pFixture4fV1_(1),1);
    var v2=dmU4pAdaptar4fV1_(dmU4pFixture4fV1_(2),2);
    dmU4pAssert_(v1.p_records[0].record_id===v2.p_records[0].record_id&&
      v1.p_records[0].payload._v9.source_sha256!==v2.p_records[0].payload._v9.source_sha256,
      'misma tarea no mantiene identidad ante revision');
    var a1=dmU4pSandboxRpcV1_(cfg,'v9_ingest_accept_batch_v1',v1);
    dmU4pValidarAckV1_(a1,v1);
    var a1r=dmU4pSandboxRpcV1_(cfg,'v9_ingest_accept_batch_v1',v1);
    dmU4pValidarAckV1_(a1r,v1);
    dmU4pAssert_(a1r.replay===true,'replay revision 1 no confirmado');
    var a2=dmU4pSandboxRpcV1_(cfg,'v9_ingest_accept_batch_v1',v2);
    dmU4pValidarAckV1_(a2,v2);
    var a2r=dmU4pSandboxRpcV1_(cfg,'v9_ingest_accept_batch_v1',v2);
    dmU4pValidarAckV1_(a2r,v2);
    dmU4pAssert_(a2r.replay===true,'replay revision 2 no confirmado');
    var probe=dmU4pSandboxRpcV1_(cfg,'v9_ingest_probe_v1',{
      p_dataset:'rop05',p_record_ids:[DM_U4P_TEST_TASK_]});
    var checked=dmU4pValidarProbeV1_(probe,v2);
    var out={ok:true,mode:'SYNTHETIC_4F_ADAPTER_ONLY',recordsSent:1,
      revisionsAccepted:2,replayReceipts:2,remoteProof:checked,
      operationalRowsRead:0,operationalRowsSent:0,localOutboxWrites:0,
      productionWrites:0,productionAck:0,
      note:'Solo fixture; NO habilita el consumidor real ni el corte de V8.1'};
    Logger.log(JSON.stringify(out,null,2));return out;
  }finally{lock.releaseLock();}
}
/** Prueba local segura, sin HTTP, credenciales, Sheets ni cambios persistentes. */
function probarMigracionFase4pContratoLocalV1(){
  dmU4pDeps_();
  var v1=dmU4pAdaptar4fV1_(dmU4pFixture4fV1_(1),1);
  var v2=dmU4pAdaptar4fV1_(dmU4pFixture4fV1_(2),2);
  dmU4pAssert_(v1.p_records[0].record_id===v2.p_records[0].record_id&&
    v1.p_request_id!==v2.p_request_id,'identidad/revisiones invalidas');
  var invalid=dmU4pFixture4fV1_(1);invalid[6]='WAITING_PRODUCTIVITY_NO_SEND';
  var blocked=false;
  try{dmU4pAdaptar4fV1_(invalid,1);}catch(e){blocked=true;}
  dmU4pAssert_(blocked,'productividad diferida fue considerada lista');
  var result={ok:true,mode:'LOCAL_NO_IO',distinctDeliveryRevisions:2,
    deferredProductivityBlocked:true,operationalRowsSent:0,productionWrites:0};
  Logger.log(JSON.stringify(result));return result;
}