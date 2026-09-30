import { chromium } from "playwright";
import { promises as fs } from "node:fs";
import path from "node:path";

const baseUrl=String(process.env.DM_PERF_BASE_URL||"").replace(/\/$/,"");
const email=String(process.env.DM_PERF_EMAIL||"").trim();
const password=String(process.env.DM_PERF_PASSWORD||"");
const outDir=path.join(process.cwd(),"artifacts","phase1c-cpu");
if(!baseUrl||!email||!password)throw new Error("Faltan URL o credenciales de medición.");
await fs.mkdir(outDir,{recursive:true});

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const esc=value=>String(value).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");

async function login(page){
  let detail="sin detalle";
  for(let attempt=1;attempt<=2;attempt+=1){
    await page.goto(baseUrl,{waitUntil:"domcontentloaded",timeout:90000});
    await page.getByPlaceholder("Correo electrónico").fill(email,{timeout:45000});
    await page.getByPlaceholder("Contraseña").fill(password,{timeout:30000});
    await page.getByRole("button",{name:/^INGRESAR$/i}).click({timeout:30000});
    try{
      await page.locator(".dm-app-shell").waitFor({state:"visible",timeout:90000});
      return;
    }catch(_){
      detail=await page.locator(".dm-login-screen").innerText().catch(()=>detail);
    }
  }
  throw new Error(`Login no completado tras dos intentos: ${String(detail).replace(/\s+/g," ").slice(0,220)}`);
}

async function quiet(page,ms=3500){
  await sleep(ms);
  await page.waitForLoadState("domcontentloaded").catch(()=>{});
}

async function click(page,label,timeout=15000){
  const rx=new RegExp(`^${esc(label)}$`,"i");
  const loc=page.getByRole("button",{name:rx}).first();
  await loc.waitFor({state:"visible",timeout});
  await loc.click({timeout});
}

async function openOffice(page){
  const loc=page.getByRole("button",{name:/Oficina Técnica/i}).first();
  await loc.click({timeout:15000});
  await quiet(page);
}

function analyse(profile,coverage){
  const nodes=new Map((profile.nodes||[]).map(node=>[node.id,node]));
  const parent=new Map();
  for(const node of profile.nodes||[])for(const child of node.children||[])parent.set(child,node.id);
  const byName=new Map();
  const add=(id,key,field,value)=>{
    const node=nodes.get(id);if(!node)return;
    const frame=node.callFrame||{};
    const name=frame.functionName||"(anonymous)";
    const url=String(frame.url||"").split("/").pop()||"";
    const item=byName.get(name)||{function:name,url,totalMs:0,selfMs:0,samples:0,coverageCalls:0};
    item[field]+=value;byName.set(name,item);
  };
  const samples=profile.samples||[],deltas=profile.timeDeltas||[];
  samples.forEach((id,index)=>{
    const ms=Number(deltas[index]||0)/1000;
    let current=id;let guard=0;
    while(current&&guard++<120){add(current,"", "totalMs",ms);current=parent.get(current);}
    add(id,"","selfMs",ms);add(id,"","samples",1);
  });
  for(const script of coverage||[])for(const fn of script.functions||[]){
    const name=fn.functionName||"(anonymous)";
    const item=byName.get(name)||{function:name,url:String(script.url||"").split("/").pop()||"",totalMs:0,selfMs:0,samples:0,coverageCalls:0};
    item.coverageCalls+=Number(fn.ranges?.[0]?.count)||0;byName.set(name,item);
  }
  const ranking=[...byName.values()].filter(item=>item.totalMs>0||item.coverageCalls>0).sort((a,b)=>b.totalMs-a.totalMs);
  const names=["normalizeROP02","normalizeROP05","normalizeRMA15","loadFullDataset","calcControl"];
  const targeted=names.map(name=>ranking.find(item=>item.function===name)||{function:name,coverageCalls:0,totalMs:0,selfMs:0,samples:0,missing:true});
  return{ranking:ranking.slice(0,80),targeted};
}

async function profile(cdp,name,action){
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval",{interval:100});
  await cdp.send("Profiler.startPreciseCoverage",{callCount:true,detailed:false});
  await cdp.send("Profiler.start");
  const started=Date.now();
  await action();
  const coverage=(await cdp.send("Profiler.takePreciseCoverage")).result||[];
  const stopped=await cdp.send("Profiler.stop");
  await cdp.send("Profiler.stopPreciseCoverage");
  const result={scenario:name,durationMs:Date.now()-started,...analyse(stopped.profile,coverage)};
  await fs.writeFile(path.join(outDir,`${name}.cpu-profile.json`),JSON.stringify(stopped.profile));
  await fs.writeFile(path.join(outDir,`${name}.coverage.json`),JSON.stringify(coverage));
  return result;
}

const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage();
  const cdp=await context.newCDPSession(page);
  const results=[];
  results.push(await profile(cdp,"cold",async()=>{await login(page);await quiet(page,5000);}));
  results.push(await profile(cdp,"warm",async()=>{await page.reload({waitUntil:"domcontentloaded",timeout:90000});await page.locator(".dm-app-shell").waitFor({state:"visible",timeout:90000});await quiet(page,4000);}));
  await openOffice(page);
  await click(page,"ROP05",8000).catch(()=>{});
  results.push(await profile(cdp,"rop05",async()=>{await click(page,"Productividad");await quiet(page,5000);}));
  results.push(await profile(cdp,"control",async()=>{await click(page,"Control ROP05 vs ROP02");await quiet(page,4500);}));
  results.push(await profile(cdp,"refresh",async()=>{await click(page,"Actualizar",8000);await quiet(page,8000);}));
  await fs.writeFile(path.join(outDir,"cpu-profile-summary.json"),JSON.stringify({baseUrl,results},null,2));
  console.log(JSON.stringify(results.map(({scenario,durationMs,targeted,ranking})=>({scenario,durationMs,targeted,top:ranking.slice(0,10)})),null,2));
  await context.close();
}finally{await browser.close();}
