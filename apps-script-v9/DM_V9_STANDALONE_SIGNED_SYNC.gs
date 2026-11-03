/**
 * Delta OPS V9 - standalone publisher to isolated Supabase sandbox.
 * READS only from the existing V9 shadow outbox. Never modifies V8.1.
 * NO triggers are installed. OFF until script property DM_V9_STANDALONE_INGEST_ENABLED=true
 * and HMAC secrets are configured on both Apps Script and Supabase Edge Function.
 */
var DM_V9_STANDALONE_EDGE_URL_ =
  "https://biztlietuvvonigcfdwy.supabase.co/functions/v1/delta-v9-ingest";
var DM_V9_OUTBOX_TAB_ = "ENTREGAS_PREPARADAS";
var DM_V9_FIELDS_ = ["fecha","supervisor","proyecto","interno","numero_parte",
  "tipo_equipo","tarea","horas_productivas","largo","ancho","profundidad",
  "cantidad_produccion","unidad","observaciones","mes"];

function dmV9StandaloneConfig_(){
  var p=PropertiesService.getScriptProperties();
  return {
    outboxId:p.getProperty("DM_U4E_SHADOW_OUTBOX_SPREADSHEET_ID")||"",
    secret:p.getProperty("DM_V9_STANDALONE_INGEST_HMAC_SECRET")||"",
    enabled:p.getProperty("DM_V9_STANDALONE_INGEST_ENABLED")==="true",
    snapshotTag:p.getProperty("DM_V9_STANDALONE_SNAPSHOT_TAG")||"2026-10-30",
    cursor:Math.max(2,Number(p.getProperty("DM_V9_STANDALONE_CURSOR")||2)||2)
  };
}
function dmV9StandaloneRead_(cfg){
  if(!cfg.outboxId)throw Error("V9_OUTBOX_ID_NOT_CONFIGURED");
  var sheet=SpreadsheetApp.openById(cfg.outboxId).getSheetByName(DM_V9_OUTBOX_TAB_);
  if(!sheet)throw Error("V9_OUTBOX_TAB_NOT_FOUND");
  return sheet;
}
function dmV9StandaloneSignature_(secret,text){
  return Utilities.computeHmacSha256Signature(text,secret,Utilities.Charset.UTF_8)
    .map(function(x){return("0"+(x&255).toString(16)).slice(-2);}).join("");
}
function dmV9StandaloneSignedCall_(secret,body){
  var ts=String(Math.floor(Date.now()/1000));
  var raw=JSON.stringify(body);
  var response=UrlFetchApp.fetch(DM_V9_STANDALONE_EDGE_URL_,{
    method:"post",contentType:"application/json",payload:raw,
    headers:{"X-V9-Timestamp":ts,"X-V9-Signature":dmV9StandaloneSignature_(secret,ts+"."+raw)},
    muteHttpExceptions:true,followRedirects:false
  });
  var status=response.getResponseCode();
  var result;
  try{result=JSON.parse(response.getContentText()||"{}");}
  catch(_){throw Error("V9_EDGE_INVALID_JSON_"+status);}
  if(status!==200||!result.ok)throw Error("V9_EDGE_REJECTED_"+status+"_"+String(result.error||"UNKNOWN").slice(0,90));
  return result;
}
function dmV9StandaloneRecord_(row,cfg){
  var values=JSON.parse(String(row[5]||""));
  var state=String(row[6]||"");
  var source=String(row[0]||"");
  var id=String(row[1]||"");
  if(!Array.isArray(values)||values.length!==15||
    !/^(rop02_jm|rop02_fs):[A-Za-z0-9_-]+:t[123]$/.test(id)||
    id.indexOf(source+":")!==0||
    !/^[0-9a-f]{64}$/.test(String(row[3]||""))||
    ["PREPARED_NO_SEND","WAITING_PRODUCTIVITY_NO_SEND"].indexOf(state)<0)
     throw Error("V9_OUTBOX_INVALID_RECORD_"+id);
  var data={};
  DM_V9_FIELDS_.forEach(function(key,i){data[key]=values[i]===null||values[i]===undefined?"":values[i];});
  data._v9={
    source_dataset:source,source_draft_revision:Number(row[2])||1,
    source_sha256:String(row[3]),productivity_state:state,
    publication_status:"PROVISIONAL_NOT_ACKED",snapshot:cfg.snapshotTag,
    origin:"V9_OUTBOX"
  };
  return {record_id:id,delivery_revision:1,payload:data};
}
function dmV9StandaloneSyncPreview(){
  var cfg=dmV9StandaloneConfig_();
  var sheet=dmV9StandaloneRead_(cfg);
  var last=sheet.getLastRow(),range=Math.min(Math.max(last-1,0),100);
  var pending=range?sheet.getRange(2,7,range,1).getValues()
    .filter(function(v){return v[0]==="WAITING_PRODUCTIVITY_NO_SEND";}).length:0;
  return {ok:true,mode:"V9_STANDALONE_LOCAL_PREVIEW",outboxRows:last-1,
    sampleWaitingProductivity:pending,cursor:cfg.cursor,
    sendingEnabled:cfg.enabled,signatureConfigured:cfg.secret.length>=32,
    operationsSent:0,productionWrites:0};
}
/**
 * Runs ONE batch of up to 100 ROP05 tasks. Repeated runs traverse outbox.
 * Query remote digest first. Existing revisions are never overwritten.
 * No automatic schedule is installed.
 */
function dmV9StandaloneSyncBatch(){
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))throw Error("V9_STANDALONE_PUBLISHER_BUSY");
  try{
    var cfg=dmV9StandaloneConfig_();
    if(!cfg.enabled)return {ok:true,mode:"DISABLED_NO_SEND",operationsSent:0};
    if(cfg.secret.length<32)throw Error("V9_HMAC_SECRET_NOT_CONFIGURED");
    var sheet=dmV9StandaloneRead_(cfg),last=sheet.getLastRow();
    if(last<2)return {ok:true,mode:"EMPTY_OUTBOX",operationsSent:0};
    var start=Math.min(Math.max(cfg.cursor,2),last);
    var end=Math.min(last,start+99);
    var rows=sheet.getRange(start,1,end-start+1,7).getValues();
    var records=rows.map(function(row){return dmV9StandaloneRecord_(row,cfg);});
    var probe=dmV9StandaloneSignedCall_(cfg.secret,{
      action:"probe",dataset:"rop05",
      ids:records.map(function(r){return r.record_id;})
    });
    if(probe.mode!=="V9_PROBE"||!Array.isArray(probe.rows))throw Error("V9_PROBE_INVALID");
    var remote={};
    probe.rows.forEach(function(r){remote[String(r.record_id)]=r;});
    var changes=[],skipped=0;
    records.forEach(function(record){
      var prev=remote[record.record_id],source=record.payload._v9;
      if(prev&&prev.source_sha256===source.source_sha256&&
        prev.productivity_state===source.productivity_state){skipped++;return;}
      record.delivery_revision=prev?Number(prev.delivery_revision)+1:1;
      changes.push(record);
    });
    var ack={ok:true,mode:"V9_NO_DIFFERENCES",created:0,updated:0};
    if(changes.length){
      ack=dmV9StandaloneSignedCall_(cfg.secret,{
        request_id:Utilities.getUuid(),dataset:"rop05",records:changes
      });
      if(ack.dataset!=="rop05"||Number(ack.created||0)+Number(ack.updated||0)+
        Number(ack.alreadyDelivered||0)!==changes.length)
        throw Error("V9_ACK_MISMATCH");
    }
    PropertiesService.getScriptProperties().setProperty("DM_V9_STANDALONE_CURSOR",
      String(end>=last?2:end+1));
    return {ok:true,mode:"V9_STANDALONE_SIGNED_BATCH",
      scanned:records.length,skipped:skipped,delivered:changes.length,
      created:ack.created||0,updated:ack.updated||0,
      cursorNext:end>=last?2:end+1,productionWrites:0};
  }finally{lock.releaseLock();}
}
