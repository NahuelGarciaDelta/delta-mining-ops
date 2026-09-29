const env=(typeof import.meta!=="undefined"&&import.meta.env)?import.meta.env:{};

const STORAGE_KEY="dm_perf_debug";
const MAX_EVENTS=3000;
const events=[];
const viewStarts=new Map();
let installed=false;
let sequence=0;
let resourceObserver=null;
let longTaskObserver=null;

const now=()=>typeof performance!=="undefined"&&typeof performance.now==="function"?performance.now():Date.now();
const round=value=>Number.isFinite(Number(value))?Math.round(Number(value)*100)/100:null;

function localFlag_(){
  if(typeof window==="undefined")return false;
  try{return window.localStorage?.getItem(STORAGE_KEY)==="1";}catch(_){return false;}
}

function queryFlag_(){
  if(typeof window==="undefined")return false;
  try{return new URLSearchParams(window.location?.search||"").get("dmPerf")==="1";}catch(_){return false;}
}

export function isPerformanceDiagnosticsEnabled(){
  return env.DEV===true||String(env.VITE_DM_PERF_DIAGNOSTICS||"")==="1"||localFlag_()||queryFlag_();
}

export function estimatePerfTextBytes(text){
  const value=String(text??"");
  try{return new TextEncoder().encode(value).byteLength;}catch(_){return value.length*2;}
}

export function estimatePerfBytes(value){
  if(!isPerformanceDiagnosticsEnabled())return null;
  try{return estimatePerfTextBytes(JSON.stringify(value));}catch(_){return null;}
}

export function sanitizePerfUrl(input){
  const raw=String(input||"");
  try{
    const base=typeof window!=="undefined"&&window.location?.origin?window.location.origin:"http://localhost";
    const url=new URL(raw,base);
    const safe=new URLSearchParams();
    for(const key of ["action","dataset","source","limit","offset"]){
      const value=url.searchParams.get(key);
      if(value!==null&&value!=="")safe.set(key,value);
    }
    const query=safe.toString();
    return `${url.origin===base?"":url.origin}${url.pathname}${query?`?${query}`:""}`;
  }catch(_){return raw.split("?")[0].slice(0,240);}
}

function trimEvents_(){
  if(events.length>MAX_EVENTS)events.splice(0,events.length-MAX_EVENTS);
}

export function recordPerfEvent(type,detail={}){
  if(!isPerformanceDiagnosticsEnabled())return null;
  const event={
    id:++sequence,
    type:String(type||"event"),
    atMs:round(now()),
    at:new Date().toISOString(),
    ...detail,
  };
  events.push(event);
  trimEvents_();
  return event;
}

export function beginPerfSpan(type,detail={}){
  if(!isPerformanceDiagnosticsEnabled())return()=>null;
  const started=now();
  const spanId=`${String(type||"span")}-${++sequence}`;
  let done=false;
  recordPerfEvent(`${type}:start`,{...detail,spanId});
  return(endDetail={})=>{
    if(done)return null;
    done=true;
    return recordPerfEvent(type,{...detail,...endDetail,spanId,durationMs:round(now()-started)});
  };
}

export function summarizeCacheRecords(keys,recordMap={}){
  const wanted=[...new Set((keys||[]).filter(Boolean))];
  let hits=0,rows=0,estimatedBytes=0;
  const datasets=[];
  wanted.forEach(key=>{
    const record=recordMap?.[key]||null;
    const value=record?.data??record?.value;
    const hit=Boolean(value?.ok&&Array.isArray(value?.data));
    const count=hit?value.data.length:0;
    if(hit){hits+=1;rows+=count;}
    const bytes=hit?estimatePerfBytes(value?.data):null;
    if(Number.isFinite(bytes))estimatedBytes+=bytes;
    datasets.push({dataset:key,hit,rows:count,bytes:Number.isFinite(bytes)?bytes:null,updatedAt:record?.updatedAt||null});
  });
  return{keys:wanted,hits,misses:Math.max(0,wanted.length-hits),rows,estimatedBytes:estimatedBytes||0,datasets};
}

export function recordCacheRead(keys,recordMap={}){
  return recordPerfEvent("cache:read",summarizeCacheRecords(keys,recordMap));
}

export function recordCacheWrite(sources={}){
  const datasets=Object.entries(sources||{}).map(([dataset,value])=>({
    dataset,
    rows:Array.isArray(value?.data)?value.data.length:0,
    bytes:estimatePerfBytes(value?.data),
    serverVersion:Number(value?.meta?.serverVersion||0)||null,
  }));
  return recordPerfEvent("cache:write",{
    datasets,
    rows:datasets.reduce((sum,item)=>sum+item.rows,0),
    estimatedBytes:datasets.reduce((sum,item)=>sum+(Number(item.bytes)||0),0),
  });
}

export function markViewStart(view,module=""){
  if(!isPerformanceDiagnosticsEnabled())return;
  const key=`${String(module||"")}::${String(view||"")}`;
  viewStarts.set(key,now());
  recordPerfEvent("view:start",{view:String(view||""),module:String(module||"")});
}

export function markViewReady(view,module="",detail={}){
  if(!isPerformanceDiagnosticsEnabled())return null;
  const key=`${String(module||"")}::${String(view||"")}`;
  const started=viewStarts.get(key);
  if(started===undefined)return null;
  viewStarts.delete(key);
  return recordPerfEvent("view:ready",{
    view:String(view||""),module:String(module||""),...detail,
    durationMs:round(now()-started),
  });
}

function summarizeBy_(list,keySelector){
  const out={};
  list.forEach(event=>{
    const key=String(keySelector(event)||"sin-clasificar");
    if(!out[key])out[key]={events:0,durationMs:0,bytes:0,rows:0,requests:0};
    const item=out[key];
    item.events+=1;
    item.durationMs+=Number(event.durationMs)||0;
    item.bytes+=Number(event.bytes??event.estimatedBytes)||0;
    item.rows+=Number(event.rows)||0;
    if(event.type==="network:request")item.requests+=1;
  });
  Object.values(out).forEach(item=>{item.durationMs=round(item.durationMs);});
  return out;
}

export function snapshotPerformanceDiagnostics(){
  const list=events.map(event=>({...event}));
  return{
    enabled:isPerformanceDiagnosticsEnabled(),
    capturedAt:new Date().toISOString(),
    eventCount:list.length,
    events:list,
    byType:summarizeBy_(list,event=>event.type),
    byDataset:summarizeBy_(list,event=>event.dataset||event.detail?.dataset),
    byView:summarizeBy_(list,event=>event.view),
  };
}

export function resetPerformanceDiagnostics(){events.length=0;viewStarts.clear();sequence=0;}

function instrumentResponseBody_(response,finish,baseDetail){
  if(!response||typeof response!=="object")return false;
  const methods=["text","json","arrayBuffer","blob"];
  let wrapped=false;
  methods.forEach(method=>{
    const original=response[method];
    if(typeof original!=="function")return;
    try{
      response[method]=async(...args)=>{
        try{
          const value=await original.apply(response,args);
          let bytes=null;
          if(method==="text")bytes=estimatePerfTextBytes(value);
          else if(method==="arrayBuffer")bytes=value?.byteLength??null;
          else if(method==="blob")bytes=value?.size??null;
          else if(method==="json")bytes=estimatePerfBytes(value);
          finish({...baseDetail,bytes:Number.isFinite(bytes)?bytes:null,bodyMethod:method});
          return value;
        }catch(error){
          finish({...baseDetail,ok:false,error:String(error?.message||error),bodyMethod:method});
          throw error;
        }
      };
      wrapped=true;
    }catch(_){}
  });
  return wrapped;
}

function installFetchInstrumentation_(){
  if(typeof window==="undefined"||typeof window.fetch!=="function"||window.fetch.__dmPerfWrapped)return;
  const original=window.fetch.bind(window);
  const wrapped=async(input,init)=>{
    const method=String(init?.method||input?.method||"GET").toUpperCase();
    const url=sanitizePerfUrl(typeof input==="string"?input:input?.url||"");
    const finish=beginPerfSpan("network:request",{method,url});
    try{
      const response=await original(input,init);
      const base={ok:response.ok,status:response.status,method,url,contentLength:Number(response.headers?.get?.("content-length"))||null};
      const bodyWrapped=instrumentResponseBody_(response,finish,base);
      if(!bodyWrapped||response.body===null||method==="HEAD")finish(base);
      return response;
    }catch(error){
      finish({ok:false,method,url,error:String(error?.message||error)});
      throw error;
    }
  };
  wrapped.__dmPerfWrapped=true;
  wrapped.__dmPerfOriginal=original;
  window.fetch=wrapped;
}

function recordNavigation_(){
  if(typeof performance==="undefined")return;
  const nav=performance.getEntriesByType?.("navigation")?.[0];
  if(!nav)return;
  recordPerfEvent("browser:navigation",{
    durationMs:round(nav.duration),
    domInteractiveMs:round(nav.domInteractive),
    domContentLoadedMs:round(nav.domContentLoadedEventEnd),
    loadEventMs:round(nav.loadEventEnd),
    transferSize:Number(nav.transferSize)||0,
    encodedBodySize:Number(nav.encodedBodySize)||0,
    decodedBodySize:Number(nav.decodedBodySize)||0,
  });
}

function installObservers_(){
  if(typeof PerformanceObserver==="undefined")return;
  try{
    if(PerformanceObserver.supportedEntryTypes?.includes("resource")){
      resourceObserver=new PerformanceObserver(list=>{
        list.getEntries().forEach(entry=>recordPerfEvent("resource",{
          url:sanitizePerfUrl(entry.name),initiatorType:entry.initiatorType||"",durationMs:round(entry.duration),
          transferSize:Number(entry.transferSize)||0,encodedBodySize:Number(entry.encodedBodySize)||0,decodedBodySize:Number(entry.decodedBodySize)||0,
        }));
      });
      resourceObserver.observe({type:"resource",buffered:true});
    }
  }catch(_){}
  try{
    if(PerformanceObserver.supportedEntryTypes?.includes("longtask")){
      longTaskObserver=new PerformanceObserver(list=>{
        list.getEntries().forEach(entry=>recordPerfEvent("longtask",{durationMs:round(entry.duration),name:entry.name||""}));
      });
      longTaskObserver.observe({type:"longtask",buffered:true});
    }
  }catch(_){}
}

function exposeControls_(){
  if(typeof window==="undefined")return;
  window.dmPerf={
    get enabled(){return isPerformanceDiagnosticsEnabled();},
    snapshot:snapshotPerformanceDiagnostics,
    report(){
      const snapshot=snapshotPerformanceDiagnostics();
      try{
        console.group("Delta Mining · Performance diagnostics");
        console.table(snapshot.byType);
        const datasets=snapshot.events.filter(event=>event.type==="dataset:load"||event.type==="cache:read");
        if(datasets.length)console.table(datasets);
        const views=snapshot.events.filter(event=>event.type==="view:ready"||event.type==="refresh:view");
        if(views.length)console.table(views);
        console.groupEnd();
      }catch(_){}
      return snapshot;
    },
    reset:resetPerformanceDiagnostics,
    enable(){try{window.localStorage?.setItem(STORAGE_KEY,"1");}catch(_){}window.location?.reload?.();},
    disable(){try{window.localStorage?.removeItem(STORAGE_KEY);}catch(_){}window.location?.reload?.();},
  };
}

export function installPerformanceDiagnostics(){
  exposeControls_();
  if(installed||!isPerformanceDiagnosticsEnabled())return false;
  installed=true;
  installFetchInstrumentation_();
  installObservers_();
  recordPerfEvent("diagnostics:installed",{dev:env.DEV===true});
  if(typeof window!=="undefined"){
    if(document.readyState==="complete")recordNavigation_();
    else window.addEventListener("load",recordNavigation_,{once:true});
  }
  return true;
}

export function markPerf(type,detail={}){return recordPerfEvent(type,detail);}
