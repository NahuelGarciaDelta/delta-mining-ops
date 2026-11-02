/**
 * DELTA OPS — FASE 4A V3: CANDIDATOS DE COLA POR VENTANA CORTA (SOLO CLON)
 * Corrige V2: no escanea ~9700 filas por más de un minuto ni exige igualdad de lastRow.
 * Un getValues de hasta 512 filas y revalidación acotada de 18 referencias RAW.
 * Se tolera crecimiento durante el proceso, nunca se toma source_row como ID estable.
 * Estado exclusivamente en DM_U4A_V3_STATE en ScriptProperties del CLON.
 * NINGUNA escritura externa / red / trigger / ACK / cambio al esquema de producción.
 * Referencias SHA? Son hashes MD5 RAW de Supabase de 2026-10-30, no ACKs.
 */
var DM_UNIFIED_PHASE4A_V3_=(function(){
 'use strict';
 var PROP='DM_U4A_V3_STATE', P3C='DM_U3C_V1_STATE', P3I='DM_U3I_V1_STATE', DATASET='rop05';
 var BASE_LAST=9685, REF_LAST=9703, WINDOW=512, EXTENDED_WINDOW=2048, RECHECK_MARGIN=48;
 var REMOTE_RAW_DIGESTS={"9686":"58521c4c8091dbd93ff4b1923c2a6560","9687":"599e253fe8f2c2b24a6f0b7b2fc87102","9688":"c47f3870e775339bb4c4b212978dee7c","9689":"a7be9967a42194949408f5b012d1d3eb","9690":"4b5f5d6acbfa37c6c82ab7d957a127bb","9691":"684b63307ff5510e6daa415ea9db29df","9692":"204ea2893b7fe382da71e6bf295ab0f6","9693":"75660b291dd9b2df0a30df36e79fb292","9694":"34461ec8962f7384efd45fa1c1f2f97b","9695":"00dbbaa11b4a0407589807799f4fc834","9696":"526ccc80f91f1aaa4c5d102b8045776c","9697":"0adb4c443e96e859d6dd5d0b6b2fab99","9698":"2d66969b993fde5e4b23c7296f4c2820","9699":"cbb9f7cf9e0ffabcf92bd850e727b8c3","9700":"fb1c69d0d773f6782bcaa64bddb3035b","9701":"955f55ddcd2bb115d01761e4444f5120","9702":"0cf597f3fe148ac6d20a9ab8f0d25eef","9703":"0ac4c6957a79f54a99ee6acb8060cea4"};
 function guard_(v,msg){if(!v)throw new Error('FASE 4A V3 BLOQUEADA: '+msg);}
 function txt_(v){return String(v===null||v===undefined?'':v).trim();}
 function props_(){return PropertiesService.getScriptProperties();}
 function json_(k){var x=props_().getProperty(k);if(!x)return null;try{return JSON.parse(x);}catch(e){throw new Error('FASE 4A V3 BLOQUEADA: estado corrupto '+k);}}
 function hex_(a){return a.map(function(v){return ('0'+((v+256)%256).toString(16)).slice(-2);}).join('');}
 function sha_(x){return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(x),Utilities.Charset.UTF_8));}
 function md5_(s){return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5,s,Utilities.Charset.UTF_8));}
 function digest_(raw){return md5_(Object.keys(raw).sort().map(function(k){var v=txt_(raw[k]);guard_(!/[\u001d\u001e\u001f]/.test(k+v),'carácter de control no permitido');return k+'\u001e'+v;}).join('\u001f'));}
 function source_(){
  guard_(typeof SHEETS_CONFIG!=='undefined'&&SHEETS_CONFIG[DATASET],'falta configuración ROP05');
  guard_(typeof DM_UNIFIED_PHASE3A_V3_!=='undefined'&&typeof DM_UNIFIED_PHASE3A_V3_.mapRow==='function','falta mapeador 3A V3');
  var c=json_(P3C),i=json_(P3I),cfg=SHEETS_CONFIG[DATASET];
  guard_(c&&c.completed===true&&i&&i.completed===true,'fases 3C/3I incompletas');
  guard_(i.summary&&i.summary.scanned===13368,'fuentes de 3I distintas');
  var cp=(c.sources||[]).filter(function(x){return x.key===DATASET;})[0];
  var ip=(i.sources||[]).filter(function(x){return x.key===DATASET;})[0];
  guard_(cp&&cp.lastRow===BASE_LAST&&ip&&ip.lastRow===REF_LAST,'referencias 3C/3I no coinciden');
  var sh=SpreadsheetApp.openById(cfg.id).getSheetByName(cfg.sheet);
  guard_(sh&&String(sh.getSheetId())===String(cfg.gid),'hoja/GID inesperados');
  var last=sh.getLastRow(),cols=sh.getLastColumn();
  guard_(last>=REF_LAST,'hoja incompleta durante carga en lotes: lastRow='+last+'; no ejecutar hasta estabilizar');
  guard_(Number(cfg.headerRow)===Number(ip.headerRow),'fila de encabezado cambió');
  var headers=sh.getRange(cfg.headerRow,1,1,cols).getValues()[0].map(function(x,j){return txt_(x)||('col_'+j);});
  guard_(sha_({gid:cfg.gid,headerRow:Number(cfg.headerRow),headers:headers})===ip.headerHash,'encabezados diferentes al snapshot 3I');
  return {key:DATASET,cfg:cfg,sh:sh,headers:headers,mapped:ip.fieldPositions,lastRow:last,headerRow:ip.headerRow};
 }
 function assertHeader_(s){
  var h=s.sh.getRange(s.cfg.headerRow,1,1,s.headers.length).getValues()[0].map(function(x,j){return txt_(x)||('col_'+j);});
  guard_(sha_({gid:s.cfg.gid,headerRow:Number(s.cfg.headerRow),headers:h})===sha_({gid:s.cfg.gid,headerRow:Number(s.cfg.headerRow),headers:s.headers}),'encabezado cambió durante lectura');
 }
 function hashIndex_(s,start,end){
  guard_(start>s.headerRow&&end>=start,'rango inválido');
  var n=end-start+1,rows=s.sh.getRange(start,1,n,s.headers.length).getValues();
  guard_(rows.length===n,'lectura parcial de '+start+' a '+end);
  var known={},idx={},rowCount=0,issueCount=0;
  Object.keys(REMOTE_RAW_DIGESTS).forEach(function(k){known[REMOTE_RAW_DIGESTS[k]]=true;idx[REMOTE_RAW_DIGESTS[k]]=[];});
  rows.forEach(function(line,i){
   if(!line.some(function(v){return v!==''&&v!==null&&v!==undefined;}))return;
   rowCount++;
   var physical=start+i,m=DM_UNIFIED_PHASE3A_V3_.mapRow(s,line,physical);
   guard_(m&&m.payload&&m.payload.raw_data,'mapeo inválido fila '+physical);
   var h=digest_(m.payload.raw_data);
   if(known[h])idx[h].push({row:physical,issues:(m.issues||[]).length,warnings:(m.warnings||[]).length});
  });
  return {idx:idx,start:start,end:end,nonemptyRows:rowCount};
 }
 function missing_(idx){return Object.keys(REMOTE_RAW_DIGESTS).filter(function(k){return idx[REMOTE_RAW_DIGESTS[k]].length===0;}).map(Number);}
 function duplicates_(idx){return Object.keys(REMOTE_RAW_DIGESTS).filter(function(k){return idx[REMOTE_RAW_DIGESTS[k]].length>1;}).map(Number);}
 function matches_(idx){return Object.keys(REMOTE_RAW_DIGESTS).filter(function(k){return idx[REMOTE_RAW_DIGESTS[k]].length===1;}).length;}
 function preflight_(){var s=source_();return {ok:true,module:'DM_U4A_DYNAMIC_WINDOW_V3',readOnlyExternal:true,sourceLastRow:s.lastRow,refLastRow:REF_LAST,tailWindowRows:WINDOW,maxExpandedWindowRows:EXTENDED_WINDOW,refs:18,sourceRowStable:false,acceptGrowthDuringScan:true,propertyWritesOnly:PROP,existingV3:!!json_(PROP),remoteAckCount:0,readyForProductionWrites:false};}
 function report_(st){if(!st)return {ok:true,staged:false,readyForProductionWrites:false};return {ok:true,staged:true,referenceRows:st.entries.length,matchedInBoundedWindow:st.entries.filter(function(x){return x.status==='CONTENT_MATCH_NO_ACK';}).length,review:st.entries.filter(function(x){return x.status!=='CONTENT_MATCH_NO_ACK';}).length,shifted:st.entries.filter(function(x){return x.oldRow!==x.observedPhysicalRow;}).length,scanRows:st.scanRows,verifyRows:st.verifyRows,lastRowBefore:st.lastRowBefore,lastRowAfter:st.lastRowAfter,growthObserved:st.lastRowAfter>st.lastRowBefore,identityGloballyVerified:false,remoteAckCount:0,productionWrites:0,readyForProductionWrites:false,propertyWritesOnly:PROP,entries:st.entries,warning:'Huella RAW encontrada en una ventana acotada, NO unicidad global, NO identidad inmutable, NO ACK remoto ni permiso para sincronizar producción.'};}
 function stage_(){
  var lock=LockService.getScriptLock();guard_(lock.tryLock(5000),'otro proceso del clon ejecutándose');
  try{
   guard_(!json_(PROP),'ya hay estado V3; solo consultar dmUnifiedPhase4aStatusV3');
   var s=source_(),firstLast=s.lastRow;
   var result=hashIndex_(s,Math.max(s.headerRow+1,firstLast-WINDOW+1),firstLast);
   if(missing_(result.idx).length){ // Solo si hace falta, ampliar. Nunca escanear toda la planilla por rutina.
    result=hashIndex_(s,Math.max(s.headerRow+1,firstLast-EXTENDED_WINDOW+1),firstLast);
   }
   guard_(missing_(result.idx).length===0,'referencias ausentes de ventana hasta '+result.end+': '+missing_(result.idx).join(',')+'; no guardar');
   guard_(duplicates_(result.idx).length===0,'duplicado RAW en ventana: '+duplicates_(result.idx).join(',')+'; ID inmutable requerido');
   var location=Object.keys(REMOTE_RAW_DIGESTS).map(function(k){return result.idx[REMOTE_RAW_DIGESTS[k]][0].row;});
   var observedAfterFirst=s.sh.getLastRow();
   guard_(observedAfterFirst>=firstLast,'la fuente se redujo durante el muestreo; reintentar más tarde');
   guard_(observedAfterFirst-firstLast<=WINDOW,'crecimiento mayor a '+WINDOW+' filas durante el muestreo; reintentar');
   assertHeader_(s);
   // La revalidación de una zona compacta permite inserciones y desplazamientos.
   var minLoc=Math.min.apply(null,location),maxLoc=Math.max.apply(null,location);
   var reStart=Math.max(s.headerRow+1,minLoc-RECHECK_MARGIN);
   var reEnd=Math.min(observedAfterFirst, maxLoc+RECHECK_MARGIN+(observedAfterFirst-firstLast));
   var verification=hashIndex_(s,reStart,reEnd);
   guard_(missing_(verification.idx).length===0,'referencia cambió durante relectura; '+missing_(verification.idx).join(',')+'; no guardar');
   guard_(duplicates_(verification.idx).length===0,'duplicado RAW tras relectura: '+duplicates_(verification.idx).join(',')+'; no guardar');
   var after=s.sh.getLastRow();
   guard_(after>=observedAfterFirst,'origen se redujo en la relectura; no guardar');
   guard_(after-observedAfterFirst<=WINDOW,'nuevo crecimiento excesivo en relectura; no guardar');
   assertHeader_(s);
   var entries=Object.keys(REMOTE_RAW_DIGESTS).sort(function(a,b){return Number(a)-Number(b);}).map(function(k){
    var x=verification.idx[REMOTE_RAW_DIGESTS[k]][0];
    guard_(x.issues===0,'mapper con problemas en referencia '+k);
    return {oldRow:Number(k),observedPhysicalRow:x.row,rawDigest:REMOTE_RAW_DIGESTS[k],status:x.warnings?'REVIEW_REQUIRED':'CONTENT_MATCH_NO_ACK',warnings:x.warnings};
   });
   var st={version:3,createdAt:new Date().toISOString(),lastRowBefore:firstLast,lastRowAfter:after,scanRows:result.end-result.start+1,verifyRows:reEnd-reStart+1,entries:entries};
   props_().setProperty(PROP,JSON.stringify(st));
   return report_(st);
  }finally{lock.releaseLock();}
 }
 function status_(){var x=json_(PROP);if(x)guard_(x.version===3&&x.entries&&x.entries.length===18,'estado 4A V3 inválido');return report_(x);}
 return {preflight:preflight_,stage:stage_,status:status_};
}());
function probarMigracionFase4aPreflightV3(){Logger.log('=== FASE 4A V3 / PRECHECK VENTANA CORTA ===');var x=DM_UNIFIED_PHASE4A_V3_.preflight();Logger.log(JSON.stringify(x,null,2));return x;}
function probarMigracionFase4aCrearColaV3(){Logger.log('=== FASE 4A V3 / RECONCILIAR 18 REFERENCIAS EN VENTANA CORTA ===');var x=DM_UNIFIED_PHASE4A_V3_.stage();Logger.log(JSON.stringify(x,null,2));return x;}
function dmUnifiedPhase4aStatusV3(){var x=DM_UNIFIED_PHASE4A_V3_.status();Logger.log(JSON.stringify(x,null,2));return x;}