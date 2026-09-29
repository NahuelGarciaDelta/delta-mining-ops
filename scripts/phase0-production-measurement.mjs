import { chromium } from "playwright";
import { promises as fs } from "node:fs";
import path from "node:path";

const BASE_URL=String(process.env.DM_PERF_BASE_URL||"https://deltaminingops.vercel.app").replace(/\/$/,"");
const EMAIL=String(process.env.DM_PERF_EMAIL||"").trim();
const PASSWORD=String(process.env.DM_PERF_PASSWORD||"");
const RUN_SLOW=String(process.env.DM_PERF_RUN_SLOW||"1")!=="0";
const OUT_DIR=path.join(process.cwd(),"artifacts","phase0");
const MANIFEST_KEY="dm_app_cache_manifest_v7";
await fs.mkdir(OUT_DIR,{recursive:true});

if(!EMAIL||!PASSWORD){
  console.error("Faltan DM_PERF_EMAIL / DM_PERF_PASSWORD.");
  process.exit(2);
}

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const escapeRx=value=>String(value).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");

const probeInit=()=>{
  const MAX=6000;
  const events=[];
  let sequence=0;
  const round=v=>Number.isFinite(Number(v))?Math.round(Number(v)*100)/100:null;
  const safeUrl=input=>{
    try{
      const u=new URL(String(input||""),location.origin);
      return `${u.origin}${u.pathname}`;
    }catch(_){return String(input||"").split("?")[0].slice(0,220);}
  };
  const classify=(input,init={})=>{
    const raw=typeof input==="string"?input:input?.url||"";
    let action="",dataset="";
    try{
      const u=new URL(raw,location.origin);
      const parts=u.pathname.split("/").filter(Boolean);
      const restIndex=parts.indexOf("v1");
      if(u.hostname.includes("supabase.co")&&restIndex>=0&&parts[restIndex+1]){
        if(parts[restIndex+1]==="rpc")action=`rpc:${parts[restIndex+2]||""}`;
        else dataset=parts[restIndex+1];
      }
    }catch(_){}
    try{
      const body=typeof init?.body==="string"?init.body:"";
      if(body&&body.length<50000){
        const params=new URLSearchParams(body);
        const payload=params.get("payload");
        if(payload){
          const parsed=JSON.parse(payload);
          action=String(parsed?.action||action||"");
          dataset=String(parsed?.dataset||parsed?.source||parsed?.sourceKey||dataset||"");
        }
      }
    }catch(_){}
    return{url:safeUrl(raw),method:String(init?.method||input?.method||"GET").toUpperCase(),action,dataset};
  };
  const record=(type,detail={})=>{
    const event={id:++sequence,type,atMs:round(performance.now()),...detail};
    events.push(event);
    if(events.length>MAX)events.splice(0,events.length-MAX);
    return event;
  };
  const originalFetch=window.fetch?.bind(window);
  if(originalFetch){
    window.fetch=async(input,init)=>{
      const meta=classify(input,init||{});
      const started=performance.now();
      try{
        const response=await originalFetch(input,init);
        record("network",{
          ...meta,
          ok:response.ok,
          status:response.status,
          durationMs:round(performance.now()-started),
          contentLength:Number(response.headers?.get?.("content-length"))||0,
        });
        return response;
      }catch(error){
        record("network",{...meta,ok:false,status:0,durationMs:round(performance.now()-started),error:String(error?.name||"network-error")});
        throw error;
      }
    };
  }
  try{
    if(window.PerformanceObserver?.supportedEntryTypes?.includes("resource")){
      const observer=new PerformanceObserver(list=>{
        list.getEntries().forEach(entry=>record("resource",{
          url:safeUrl(entry.name),
          initiatorType:entry.initiatorType||"",
          durationMs:round(entry.duration),
          transferSize:Number(entry.transferSize)||0,
          encodedBodySize:Number(entry.encodedBodySize)||0,
          decodedBodySize:Number(entry.decodedBodySize)||0,
        }));
      });
      observer.observe({type:"resource",buffered:true});
    }
  }catch(_){}
  try{
    if(window.PerformanceObserver?.supportedEntryTypes?.includes("longtask")){
      const observer=new PerformanceObserver(list=>{
        list.getEntries().forEach(entry=>record("longtask",{durationMs:round(entry.duration),name:entry.name||""}));
      });
      observer.observe({type:"longtask",buffered:true});
    }
  }catch(_){}
  window.dmProbe={
    reset(){events.length=0;sequence=0;},
    snapshot(){
      const nav=performance.getEntriesByType?.("navigation")?.[0];
      return{
        capturedAt:new Date().toISOString(),
        events:events.map(e=>({...e})),
        navigation:nav?{
          durationMs:round(nav.duration),
          domInteractiveMs:round(nav.domInteractive),
          domContentLoadedMs:round(nav.domContentLoadedEventEnd),
          loadEventMs:round(nav.loadEventEnd),
          transferSize:Number(nav.transferSize)||0,
          encodedBodySize:Number(nav.encodedBodySize)||0,
          decodedBodySize:Number(nav.decodedBodySize)||0,
        }:null,
      };
    }
  };
};

async function addProbe(context){await context.addInitScript(probeInit);}

async function snapshot(page){
  return page.evaluate(key=>{
    let manifest={};
    try{manifest=JSON.parse(localStorage.getItem(key)||"{}");}catch(_){}
    return{
      probe:window.dmProbe?.snapshot?.()||null,
      manifest:Object.fromEntries(Object.entries(manifest||{}).map(([dataset,meta])=>[dataset,{
        count:Number(meta?.count)||0,
        updatedAt:meta?.updatedAt||null,
        version:meta?.version??null,
      }])),
    };
  },MANIFEST_KEY);
}

async function waitForQuiet(page,{quietMs=3500,maxMs=120000,minMs=1500}={}){
  const started=Date.now();
  let lastCount=-1;
  let changedAt=Date.now();
  await sleep(minMs);
  while(Date.now()-started<maxMs){
    const count=await page.evaluate(()=>window.dmProbe?.snapshot?.().events?.length??-1).catch(()=>-1);
    if(count!==lastCount){lastCount=count;changedAt=Date.now();}
    if(count>=0&&Date.now()-changedAt>=quietMs)return{settled:true,eventCount:count,waitedMs:Date.now()-started};
    await sleep(500);
  }
  return{settled:false,eventCount:lastCount,waitedMs:Date.now()-started};
}

async function login(page){
  let safe="sin detalle";
  for(let attempt=1;attempt<=2;attempt+=1){
    await page.goto(BASE_URL,{waitUntil:"domcontentloaded",timeout:90000});
    const emailInput=page.getByPlaceholder("Correo electrónico");
    await emailInput.waitFor({state:"visible",timeout:45000});
    await emailInput.fill(EMAIL,{timeout:30000});
    await page.getByPlaceholder("Contraseña").fill(PASSWORD,{timeout:30000});
    await page.getByRole("button",{name:/^INGRESAR$/i}).click({timeout:30000});
    try{
      await page.locator(".dm-app-shell").waitFor({state:"visible",timeout:90000});
      return;
    }catch(_){
      const ui=await page.locator(".dm-login-screen").innerText().catch(()=>"");
      safe=String(ui||"").replace(/\s+/g," ").slice(0,260)||safe;
    }
  }
  throw new Error(`Login no completado tras 2 intentos. UI visible: ${safe}`);
}

async function clickVisible(page,label,{exact=true,timeout=15000}={}){
  const rx=exact?new RegExp(`^${escapeRx(label)}$`,"i"):new RegExp(escapeRx(label),"i");
  const candidates=[page.getByRole("button",{name:rx}),page.getByText(rx,{exact:false})];
  for(const locator of candidates){
    const count=Math.min(await locator.count().catch(()=>0),30);
    for(let i=0;i<count;i+=1){
      const item=locator.nth(i);
      if(await item.isVisible().catch(()=>false)){
        await item.click({timeout});
        return true;
      }
    }
  }
  return false;
}

async function ensureSidebarChild(page,groupLabel,childLabel){
  if(await clickVisible(page,childLabel,{exact:true,timeout:3000}))return true;
  await clickVisible(page,groupLabel,{exact:true,timeout:8000});
  await sleep(250);
  return clickVisible(page,childLabel,{exact:true,timeout:8000});
}

async function openWelcomeModule(page,label){
  if(await clickVisible(page,label,{exact:false,timeout:10000}))return true;
  const buttons=await page.locator("button:visible").evaluateAll(nodes=>nodes.slice(0,100).map(n=>(n.innerText||n.title||"").trim()).filter(Boolean)).catch(()=>[]);
  throw new Error(`No se encontró módulo '${label}'. Botones visibles: ${buttons.join(" | ")}`);
}

function summarize(name,snap){
  const events=snap?.probe?.events||[];
  const network=events.filter(e=>e.type==="network");
  const resources=events.filter(e=>e.type==="resource");
  const manifestEntries=Object.entries(snap?.manifest||{}).map(([dataset,meta])=>({dataset,...meta}));
  const byDataset={};
  network.forEach(e=>{
    const key=e.dataset||e.action||e.url||"sin-clasificar";
    if(!byDataset[key])byDataset[key]={requests:0,durationMs:0,contentLength:0};
    byDataset[key].requests+=1;
    byDataset[key].durationMs+=Number(e.durationMs)||0;
    byDataset[key].contentLength+=Number(e.contentLength)||0;
  });
  Object.values(byDataset).forEach(v=>v.durationMs=Math.round(v.durationMs*100)/100);
  return{
    scenario:name,
    requests:network.length,
    requestContentLengthBytes:network.reduce((s,e)=>s+(Number(e.contentLength)||0),0),
    resourceTransferBytes:resources.reduce((s,e)=>s+(Number(e.transferSize)||0),0),
    resourceEncodedBytes:resources.reduce((s,e)=>s+(Number(e.encodedBodySize)||0),0),
    longTaskCount:events.filter(e=>e.type==="longtask").length,
    longTaskMs:Math.round(events.filter(e=>e.type==="longtask").reduce((s,e)=>s+(Number(e.durationMs)||0),0)*100)/100,
    navigation:snap?.probe?.navigation||null,
    cacheRows:manifestEntries.reduce((s,e)=>s+(Number(e.count)||0),0),
    cacheDatasets:manifestEntries,
    byDataset,
  };
}

async function measureStep(page,label,action,{quietMs=2500,maxMs=90000}={}){
  const before=await snapshot(page);
  const beforeId=before?.probe?.events?.at(-1)?.id||0;
  const started=Date.now();
  let ok=true,error=null;
  try{await action();}catch(err){ok=false;error=String(err?.message||err);}
  const quiet=await waitForQuiet(page,{quietMs,maxMs,minMs:800});
  const after=await snapshot(page);
  const events=(after?.probe?.events||[]).filter(e=>(e.id||0)>beforeId);
  return{
    label,ok,error,durationMs:Date.now()-started,quiet,
    requests:events.filter(e=>e.type==="network").length,
    resourceTransferBytes:events.filter(e=>e.type==="resource").reduce((s,e)=>s+(Number(e.transferSize)||0),0),
    longTaskMs:Math.round(events.filter(e=>e.type==="longtask").reduce((s,e)=>s+(Number(e.durationMs)||0),0)*100)/100,
    manifest:after.manifest,
    network:events.filter(e=>e.type==="network").map(e=>({url:e.url,action:e.action,dataset:e.dataset,status:e.status,durationMs:e.durationMs,contentLength:e.contentLength})),
  };
}

async function createContext(browser,{slow=false}={}){
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await addProbe(context);
  if(slow){
    const page=await context.newPage();
    const cdp=await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions",{
      offline:false,
      latency:450,
      downloadThroughput:187500,
      uploadThroughput:75000,
      connectionType:"cellular3g",
    });
    return{context,page};
  }
  return{context,page:await context.newPage()};
}

async function runNormal(browser){
  const {context,page}=await createContext(browser);
  page.on("pageerror",err=>console.log(`[pageerror] ${err.message}`));
  const started=Date.now();
  await login(page);
  const coldQuiet=await waitForQuiet(page,{quietMs:5000,maxMs:150000,minMs:3000});
  const cold=await snapshot(page);

  await page.reload({waitUntil:"domcontentloaded",timeout:90000});
  await page.locator(".dm-app-shell").waitFor({state:"visible",timeout:90000});
  const warmQuiet=await waitForQuiet(page,{quietMs:4000,maxMs:120000,minMs:2000});
  const warm=await snapshot(page);

  await page.evaluate(()=>window.dmProbe?.reset?.());
  const steps=[];
  steps.push(await measureStep(page,"Bienvenida → Oficina Técnica",async()=>{await openWelcomeModule(page,"Oficina Técnica");}));
  steps.push(await measureStep(page,"ROP02 / Equipos",async()=>{if(!await ensureSidebarChild(page,"ROP02","Equipos"))throw new Error("No se encontró ROP02 / Equipos");}));
  steps.push(await measureStep(page,"ROP05 / Productividad",async()=>{if(!await ensureSidebarChild(page,"ROP05","Productividad"))throw new Error("No se encontró ROP05 / Productividad");}));
  steps.push(await measureStep(page,"Control ROP05 vs ROP02",async()=>{if(!await clickVisible(page,"Control ROP05 vs ROP02",{exact:true}))throw new Error("No se encontró Control ROP05 vs ROP02");}));
  steps.push(await measureStep(page,"Botón Actualizar en Control",async()=>{if(!await clickVisible(page,"Actualizar",{exact:false,timeout:8000}))throw new Error("No se encontró botón Actualizar");},{quietMs:4500,maxMs:150000}));
  steps.push(await measureStep(page,"Volver a Bienvenida",async()=>{if(!await clickVisible(page,"Bienvenida",{exact:true}))throw new Error("No se encontró Bienvenida");}));
  steps.push(await measureStep(page,"Bienvenida → Mantenimiento",async()=>{await openWelcomeModule(page,"Mantenimiento");}));
  steps.push(await measureStep(page,"RMA15 / Mantenimiento",async()=>{if(!await ensureSidebarChild(page,"RMA15","Mantenimiento"))throw new Error("No se encontró RMA15 / Mantenimiento");}));
  steps.push(await measureStep(page,"Volver a Bienvenida 2",async()=>{if(!await clickVisible(page,"Bienvenida",{exact:true}))throw new Error("No se encontró Bienvenida");}));
  steps.push(await measureStep(page,"Bienvenida → Abastecimiento",async()=>{await openWelcomeModule(page,"Abastecimiento");}));
  steps.push(await measureStep(page,"RABA03",async()=>{if(!await ensureSidebarChild(page,"Abastecimiento","RABA03"))throw new Error("No se encontró RABA03");}));
  steps.push(await measureStep(page,"Remito",async()=>{if(!await clickVisible(page,"Remito",{exact:true}))throw new Error("No se encontró Remito");}));
  steps.push(await measureStep(page,"Control de stock",async()=>{if(!await ensureSidebarChild(page,"Stock crítico","Control de stock"))throw new Error("No se encontró Control de stock");}));
  steps.push(await measureStep(page,"Regreso final a Bienvenida",async()=>{if(!await clickVisible(page,"Bienvenida",{exact:true}))throw new Error("No se encontró Bienvenida");}));
  const navigation=await snapshot(page);
  const result={
    generatedAt:new Date().toISOString(),
    baseUrl:BASE_URL,
    totalDurationMs:Date.now()-started,
    coldQuiet,warmQuiet,cold,warm,navigation,steps,
    summaries:[summarize("cold",cold),summarize("warm",warm),summarize("navigation",navigation)],
  };
  await context.close();
  return result;
}

async function runSlow(browser){
  if(!RUN_SLOW)return{skipped:true,reason:"DM_PERF_RUN_SLOW=0"};
  const {context,page}=await createContext(browser);
  await login(page);
  const cdp=await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled",{cacheDisabled:true});
  await cdp.send("Network.emulateNetworkConditions",{
    offline:false,latency:450,downloadThroughput:187500,uploadThroughput:75000,connectionType:"cellular3g",
  });
  const started=Date.now();
  await page.reload({waitUntil:"domcontentloaded",timeout:90000});
  await page.locator(".dm-app-shell").waitFor({state:"visible",timeout:90000});
  const quiet=await waitForQuiet(page,{quietMs:6000,maxMs:240000,minMs:5000});
  const snap=await snapshot(page);
  const result={
    generatedAt:new Date().toISOString(),
    totalDurationMs:Date.now()-started,
    network:{latencyMs:450,downloadBytesPerSec:187500,uploadBytesPerSec:75000,connectionType:"cellular3g"},
    quiet,
    snapshot:snap,
    summary:summarize("slow-cold",snap),
  };
  await context.close();
  return result;
}

const browser=await chromium.launch({headless:true});
let normal,slow;
try{
  normal=await runNormal(browser);
  await fs.writeFile(path.join(OUT_DIR,"production-browser-performance.json"),JSON.stringify(normal,null,2));
  slow=await runSlow(browser);
  await fs.writeFile(path.join(OUT_DIR,"production-browser-performance-slow.json"),JSON.stringify(slow,null,2));
}finally{
  await browser.close();
}

const summary={
  generatedAt:new Date().toISOString(),
  commit:process.env.GITHUB_SHA||null,
  branch:process.env.GITHUB_REF_NAME||null,
  target:BASE_URL,
  normal:normal?.summaries||[],
  navigationSteps:(normal?.steps||[]).map(step=>({
    label:step.label,ok:step.ok,durationMs:step.durationMs,requests:step.requests,
    resourceTransferBytes:step.resourceTransferBytes,longTaskMs:step.longTaskMs,error:step.error,
  })),
  slow:slow?.summary||slow,
};
await fs.writeFile(path.join(OUT_DIR,"production-browser-performance-summary.json"),JSON.stringify(summary,null,2));

const csv=["scenario,requests,resourceTransferBytes,resourceEncodedBytes,cacheRows,longTaskCount,longTaskMs"];
for(const item of normal?.summaries||[]){csv.push([item.scenario,item.requests,item.resourceTransferBytes,item.resourceEncodedBytes,item.cacheRows,item.longTaskCount,item.longTaskMs].join(","));}
if(slow?.summary){const item=slow.summary;csv.push([item.scenario,item.requests,item.resourceTransferBytes,item.resourceEncodedBytes,item.cacheRows,item.longTaskCount,item.longTaskMs].join(","));}
await fs.writeFile(path.join(OUT_DIR,"production-browser-performance-summary.csv"),csv.join("\n"));

console.log("Phase 0 production browser measurement complete");
console.log(JSON.stringify(summary,null,2));
