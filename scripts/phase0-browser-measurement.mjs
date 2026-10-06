import { chromium } from "playwright";
import { promises as fs } from "node:fs";
import path from "node:path";

const BASE_URL=String(process.env.DM_PERF_BASE_URL||"http://127.0.0.1:4173").replace(/\/$/,"");
const EMAIL=String(process.env.DM_PERF_EMAIL||"").trim();
const PASSWORD=String(process.env.DM_PERF_PASSWORD||"");
const RUN_SLOW=String(process.env.DM_PERF_RUN_SLOW||"1")!=="0";
const outDir=path.join(process.cwd(),"artifacts","phase0");
await fs.mkdir(outDir,{recursive:true});

if(!EMAIL||!PASSWORD){
  console.error("Faltan DM_PERF_EMAIL / DM_PERF_PASSWORD.");
  process.exit(2);
}

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const escapeRx=value=>String(value).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
const safeName=value=>String(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"").toLowerCase();

async function snapshot(page){
  return page.evaluate(()=>window.dmPerf?.snapshot?.()||null);
}

async function waitForPerfQuiet(page,{quietMs=3500,maxMs=90000,minMs=1500}={}){
  const started=Date.now();
  let lastCount=-1;
  let changedAt=Date.now();
  await sleep(minMs);
  while(Date.now()-started<maxMs){
    const current=await page.evaluate(()=>window.dmPerf?.snapshot?.().eventCount??-1).catch(()=>-1);
    if(current!==lastCount){lastCount=current;changedAt=Date.now();}
    if(current>=0&&Date.now()-changedAt>=quietMs)return{settled:true,eventCount:current,waitedMs:Date.now()-started};
    await sleep(500);
  }
  return{settled:false,eventCount:lastCount,waitedMs:Date.now()-started};
}

async function login(page){
  await page.goto(`${BASE_URL}/?dmPerf=1`,{waitUntil:"domcontentloaded",timeout:90000});
  await page.getByPlaceholder("Correo electrónico").fill(EMAIL,{timeout:30000});
  await page.getByPlaceholder("Contraseña").fill(PASSWORD,{timeout:30000});
  await page.getByRole("button",{name:/^INGRESAR$/i}).click({timeout:30000});
  await page.waitForFunction(()=>sessionStorage.getItem("dm_auth")==="1"&&!!window.dmPerf,{timeout:90000});
  await page.locator(".dm-app-shell").waitFor({state:"visible",timeout:90000});
}

async function clickVisible(page,label,{exact=true,timeout=15000}={}){
  const rx=exact?new RegExp(`^${escapeRx(label)}$`,"i"):new RegExp(escapeRx(label),"i");
  const candidates=[
    page.getByRole("button",{name:rx}),
    page.getByText(rx,{exact:false}),
  ];
  for(const locator of candidates){
    const count=Math.min(await locator.count().catch(()=>0),20);
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

async function visibleButtonNames(page){
  return page.locator("button:visible").evaluateAll(nodes=>nodes.slice(0,120).map(node=>(node.innerText||node.getAttribute("aria-label")||node.title||"").trim()).filter(Boolean)).catch(()=>[]);
}

async function measureStep(page,label,action,{quietMs=2500,maxMs=60000}={}){
  const before=await snapshot(page);
  const beforeId=before?.events?.at(-1)?.id||0;
  const started=Date.now();
  let ok=true,error=null;
  try{await action();}catch(err){ok=false;error=String(err?.message||err);}
  const quiet=await waitForPerfQuiet(page,{quietMs,maxMs,minMs:800}).catch(err=>({settled:false,error:String(err)}));
  const after=await snapshot(page);
  const events=(after?.events||[]).filter(event=>(event.id||0)>beforeId);
  return{
    label,ok,error,durationMs:Date.now()-started,quiet,
    newEvents:events.length,
    networkRequests:events.filter(event=>event.type==="network:request").length,
    bytes:events.reduce((sum,event)=>sum+(Number(event.bytes??event.transferSize??event.estimatedBytes)||0),0),
    rows:events.reduce((sum,event)=>sum+(Number(event.rows)||0),0),
    viewReady:events.filter(event=>event.type==="view:ready"),
    datasetLoads:events.filter(event=>event.type==="dataset:load"),
    refreshEvents:events.filter(event=>String(event.type||"").startsWith("refresh:")),
  };
}

async function ensureSidebarChild(page,groupLabel,childLabel){
  if(await clickVisible(page,childLabel,{exact:true,timeout:3000}))return true;
  await clickVisible(page,groupLabel,{exact:true,timeout:8000});
  await sleep(250);
  return clickVisible(page,childLabel,{exact:true,timeout:8000});
}

async function openWelcomeModule(page,label){
  if(await clickVisible(page,label,{exact:false,timeout:10000}))return true;
  const buttons=await visibleButtonNames(page);
  throw new Error(`No se encontró módulo '${label}'. Botones visibles: ${buttons.join(" | ")}`);
}

function summarizeSnapshot(name,snap){
  const events=snap?.events||[];
  const req=events.filter(e=>e.type==="network:request");
  const datasets=events.filter(e=>e.type==="dataset:load");
  const cacheReads=events.filter(e=>e.type==="cache:read");
  const resources=events.filter(e=>e.type==="resource");
  return{
    scenario:name,
    eventCount:events.length,
    requests:req.length,
    requestBytes:req.reduce((s,e)=>s+(Number(e.bytes??e.contentLength)||0),0),
    resourceTransferBytes:resources.reduce((s,e)=>s+(Number(e.transferSize)||0),0),
    datasetRows:datasets.reduce((s,e)=>s+(Number(e.rows)||0),0),
    datasetEstimatedBytes:datasets.reduce((s,e)=>s+(Number(e.estimatedBytes??e.bytes)||0),0),
    datasetLoads:datasets.map(e=>({dataset:e.dataset||null,rows:e.rows||0,pages:e.pages||null,requests:e.requests||null,estimatedBytes:e.estimatedBytes??e.bytes??null,durationMs:e.durationMs??null})),
    cache:{
      reads:cacheReads.length,
      hits:cacheReads.reduce((s,e)=>s+(Number(e.hits)||0),0),
      misses:cacheReads.reduce((s,e)=>s+(Number(e.misses)||0),0),
      rows:cacheReads.reduce((s,e)=>s+(Number(e.rows)||0),0),
      estimatedBytes:cacheReads.reduce((s,e)=>s+(Number(e.estimatedBytes)||0),0),
    },
    longTasks:events.filter(e=>e.type==="longtask").map(e=>({durationMs:e.durationMs,name:e.name||""})),
    views:events.filter(e=>e.type==="view:ready").map(e=>({view:e.view,module:e.module,durationMs:e.durationMs})),
  };
}

async function runNormal(browser){
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage();
  page.on("console",msg=>{if(msg.type()==="error")console.log(`[browser:error] ${msg.text()}`);});
  page.on("pageerror",err=>console.log(`[pageerror] ${err.message}`));

  const started=Date.now();
  await login(page);
  const coldQuiet=await waitForPerfQuiet(page,{quietMs:4500,maxMs:120000,minMs:2500});
  const cold=await snapshot(page);

  await page.evaluate(()=>window.dmPerf?.reset?.());
  await page.reload({waitUntil:"domcontentloaded",timeout:90000});
  await page.waitForFunction(()=>sessionStorage.getItem("dm_auth")==="1"&&!!window.dmPerf,{timeout:60000});
  await page.locator(".dm-app-shell").waitFor({state:"visible",timeout:60000});
  const warmQuiet=await waitForPerfQuiet(page,{quietMs:3500,maxMs:90000,minMs:1500});
  const warm=await snapshot(page);

  await page.evaluate(()=>window.dmPerf?.reset?.());
  const steps=[];
  steps.push(await measureStep(page,"Bienvenida → Oficina Técnica",async()=>{if(!await openWelcomeModule(page,"Oficina Técnica"))throw new Error("No se pudo abrir Oficina Técnica");}));
  steps.push(await measureStep(page,"ROP02 / Equipos",async()=>{if(!await ensureSidebarChild(page,"ROP02","Equipos"))throw new Error("No se encontró ROP02 / Equipos");}));
  steps.push(await measureStep(page,"ROP05 / Productividad",async()=>{if(!await ensureSidebarChild(page,"ROP05","Productividad"))throw new Error("No se encontró ROP05 / Productividad");}));
  steps.push(await measureStep(page,"Control ROP05 vs ROP02",async()=>{if(!await clickVisible(page,"Control ROP05 vs ROP02",{exact:true}))throw new Error("No se encontró Control ROP05 vs ROP02");}));
  steps.push(await measureStep(page,"Botón Actualizar en Control",async()=>{if(!await clickVisible(page,"Actualizar",{exact:false,timeout:8000}))throw new Error("No se encontró botón Actualizar");},{quietMs:4000,maxMs:120000}));
  steps.push(await measureStep(page,"Volver a Bienvenida",async()=>{if(!await clickVisible(page,"Bienvenida",{exact:true}))throw new Error("No se encontró Bienvenida");}));
  steps.push(await measureStep(page,"Bienvenida → Mantenimiento",async()=>{if(!await openWelcomeModule(page,"Mantenimiento"))throw new Error("No se pudo abrir Mantenimiento");}));
  steps.push(await measureStep(page,"RMA15 / Mantenimiento",async()=>{if(!await ensureSidebarChild(page,"RMA15","Mantenimiento"))throw new Error("No se encontró RMA15 / Mantenimiento");}));
  steps.push(await measureStep(page,"Volver a Bienvenida 2",async()=>{if(!await clickVisible(page,"Bienvenida",{exact:true}))throw new Error("No se encontró Bienvenida");}));
  steps.push(await measureStep(page,"Bienvenida → Abastecimiento",async()=>{if(!await openWelcomeModule(page,"Abastecimiento"))throw new Error("No se pudo abrir Abastecimiento");}));
  steps.push(await measureStep(page,"RABA03",async()=>{if(!await ensureSidebarChild(page,"Abastecimiento","RABA03"))throw new Error("No se encontró RABA03");}));
  steps.push(await measureStep(page,"Remito",async()=>{if(!await clickVisible(page,"Remito",{exact:true}))throw new Error("No se encontró Remito");}));
  steps.push(await measureStep(page,"Control de stock",async()=>{if(!await ensureSidebarChild(page,"Stock crítico","Control de stock"))throw new Error("No se encontró Control de stock");}));
  steps.push(await measureStep(page,"Regreso final a Bienvenida",async()=>{if(!await clickVisible(page,"Bienvenida",{exact:true}))throw new Error("No se encontró Bienvenida");}));
  const navigation=await snapshot(page);

  const result={
    generatedAt:new Date().toISOString(),
    commit:process.env.GITHUB_SHA||null,
    branch:process.env.GITHUB_REF_NAME||null,
    baseUrl:BASE_URL,
    totalDurationMs:Date.now()-started,
    coldQuiet,warmQuiet,
    cold,
    warm,
    navigation,
    steps,
    summaries:[summarizeSnapshot("cold",cold),summarizeSnapshot("warm",warm),summarizeSnapshot("navigation",navigation)],
  };
  await context.close();
  return result;
}

async function runSlow(browser){
  if(!RUN_SLOW)return{skipped:true,reason:"DM_PERF_RUN_SLOW=0"};
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
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
  const started=Date.now();
  await login(page);
  const quiet=await waitForPerfQuiet(page,{quietMs:5000,maxMs:240000,minMs:4000});
  const snap=await snapshot(page);
  const result={
    generatedAt:new Date().toISOString(),
    totalDurationMs:Date.now()-started,
    network:{latencyMs:450,downloadBytesPerSec:187500,uploadBytesPerSec:75000,connectionType:"cellular3g"},
    quiet,
    snapshot:snap,
    summary:summarizeSnapshot("slow-cold",snap),
  };
  await context.close();
  return result;
}

const browser=await chromium.launch({headless:true});
let normal,slow;
try{
  normal=await runNormal(browser);
  await fs.writeFile(path.join(outDir,"browser-performance.json"),JSON.stringify(normal,null,2));
  slow=await runSlow(browser);
  await fs.writeFile(path.join(outDir,"browser-performance-slow.json"),JSON.stringify(slow,null,2));
}finally{
  await browser.close();
}

const summary={
  generatedAt:new Date().toISOString(),
  commit:process.env.GITHUB_SHA||null,
  branch:process.env.GITHUB_REF_NAME||null,
  normal:normal?.summaries||[],
  navigationSteps:(normal?.steps||[]).map(step=>({label:step.label,ok:step.ok,durationMs:step.durationMs,requests:step.networkRequests,bytes:step.bytes,rows:step.rows,error:step.error})),
  slow:slow?.summary||slow,
};
await fs.writeFile(path.join(outDir,"browser-performance-summary.json"),JSON.stringify(summary,null,2));

const csvRows=["scenario,requests,requestBytes,resourceTransferBytes,datasetRows,datasetEstimatedBytes,cacheHits,cacheMisses"];
for(const item of normal?.summaries||[]){
  csvRows.push([item.scenario,item.requests,item.requestBytes,item.resourceTransferBytes,item.datasetRows,item.datasetEstimatedBytes,item.cache?.hits||0,item.cache?.misses||0].join(","));
}
if(slow?.summary){const item=slow.summary;csvRows.push([item.scenario,item.requests,item.requestBytes,item.resourceTransferBytes,item.datasetRows,item.datasetEstimatedBytes,item.cache?.hits||0,item.cache?.misses||0].join(","));}
await fs.writeFile(path.join(outDir,"browser-performance-summary.csv"),csvRows.join("\n"));

console.log("Phase 0 browser measurement complete");
console.log(JSON.stringify(summary,null,2));
