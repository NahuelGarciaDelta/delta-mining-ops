import { chromium } from "playwright";
import { promises as fs } from "node:fs";
import path from "node:path";

const BASELINE=String(process.env.DM_BASELINE_URL||"").replace(/\/$/,"");
const CANDIDATE=String(process.env.DM_CANDIDATE_URL||"").replace(/\/$/,"");
const EMAIL=String(process.env.DM_PERF_EMAIL||"").trim();
const PASSWORD=String(process.env.DM_PERF_PASSWORD||"");
const OUT=path.join(process.cwd(),"artifacts","full-regression");
await fs.mkdir(OUT,{recursive:true});
if(!BASELINE||!CANDIDATE||!EMAIL||!PASSWORD){console.error("Faltan URLs o credenciales.");process.exit(2);}

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const esc=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");

async function login(page,base){
  await page.goto(base,{waitUntil:"domcontentloaded",timeout:90000});
  if(await page.locator(".dm-app-shell").isVisible().catch(()=>false))return;
  await page.getByPlaceholder("Correo electr\u00f3nico").fill(EMAIL);
  await page.getByPlaceholder("Contrase\u00f1a").fill(PASSWORD);
  await page.getByRole("button",{name:/^INGRESAR$/i}).click();
  await page.locator(".dm-app-shell").waitFor({state:"visible",timeout:90000});
}

async function clickVisible(page,label,timeout=8000){
  const rx=new RegExp("^"+esc(label)+"$","i");
  for(const loc of [page.getByRole("button",{name:rx}),page.getByText(rx,{exact:true})]){
    const n=Math.min(await loc.count().catch(()=>0),40);
    for(let i=0;i<n;i++){
      const x=loc.nth(i);
      if(await x.isVisible().catch(()=>false)){try{await x.click({timeout});return true;}catch(_){}}
    }
  }
  return false;
}

async function welcome(page){if(await clickVisible(page,"Bienvenida",2500))await sleep(250);}
async function openModule(page,label){await welcome(page);return clickVisible(page,label,10000);}
async function openNav(page,group,label){
  if(await clickVisible(page,label,1800))return true;
  if(group)await clickVisible(page,group,5000);
  const until=Date.now()+10000;
  while(Date.now()<until){if(await clickVisible(page,label,1200))return true;await sleep(250);}return false;
}
async function settle(page,maxMs=45000){
  let last="",stable=0;const start=Date.now();
  while(Date.now()-start<maxMs){
    const state=await page.evaluate(()=>{
      const vis=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;};
      const txt=(document.body?.innerText||"").replace(/\s+/g," ").trim();
      const rows=[...document.querySelectorAll("tbody tr")].filter(vis).length;
      return txt.length+"|"+rows+"|"+([...document.querySelectorAll('[role=dialog]')].filter(vis).map(x=>x.innerText).join("|"));
    }).catch(()=>"ERR");
    if(state===last)stable+=500;else{last=state;stable=0;}
    if(stable>=2500)return true;
    await sleep(500);
  }
  return false;
}
function norm(v){return String(v||"").replace(/\u00daltima actualizaci\u00f3n[^\n]*/gi,"").replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g,"<TIME>").replace(/\s+/g," ").trim();}
function dice(a,b){
  const A=norm(a).toLowerCase().split(/\s+/).filter(Boolean),B=norm(b).toLowerCase().split(/\s+/).filter(Boolean);
  const m=new Map();for(const t of A)m.set(t,(m.get(t)||0)+1);let hit=0;for(const t of B){const n=m.get(t)||0;if(n){hit++;m.set(t,n-1);}}
  return A.length+B.length?2*hit/(A.length+B.length):1;
}
async function sig(page){
  return page.evaluate(()=>{
    const vis=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=="none"&&s.visibility!=="hidden"&&r.width>0&&r.height>0;};
    const txt=e=>(e?.innerText||e?.textContent||"").replace(/\s+/g," ").trim();
    const tables=[...document.querySelectorAll("table")].filter(vis).map(t=>{
      const rows=[...t.querySelectorAll("tbody tr")].filter(vis).map(txt);
      return {headers:[...t.querySelectorAll("thead th")].filter(vis).map(txt),rowsCount:rows.length,first:rows.slice(0,4),last:rows.slice(-2)};
    });
    return {
      text:txt(document.body),
      headings:[...document.querySelectorAll("h1,h2,h3")].filter(vis).map(txt).filter(Boolean),
      tables,
      controls:{buttons:[...document.querySelectorAll("button")].filter(vis).length,inputs:[...document.querySelectorAll("input")].filter(vis).length,selects:[...document.querySelectorAll("select")].filter(vis).length},
      dialogs:[...document.querySelectorAll('[role=dialog]')].filter(vis).map(txt),
      permissions:window.dmPermissionSnapshot||null
    };
  });
}
function compare(a,b){
  const textSimilarity=dice(a.text,b.text);
  const eq=k=>JSON.stringify(a[k])===JSON.stringify(b[k]);
  const tableShapeA=a.tables.map(t=>({headers:t.headers,rowsCount:t.rowsCount}));
  const tableShapeB=b.tables.map(t=>({headers:t.headers,rowsCount:t.rowsCount}));
  const tableSamplesA=a.tables.map(t=>({first:t.first,last:t.last}));
  const tableSamplesB=b.tables.map(t=>({first:t.first,last:t.last}));
  const tableShapeEqual=JSON.stringify(tableShapeA)===JSON.stringify(tableShapeB);
  const tableSamplesEqual=JSON.stringify(tableSamplesA)===JSON.stringify(tableSamplesB);
  const headingsEqual=eq("headings"),controlsEqual=eq("controls"),dialogsEqual=eq("dialogs"),permissionsEqual=eq("permissions");
  return {pass:textSimilarity>=0.985&&tableShapeEqual&&tableSamplesEqual&&headingsEqual&&controlsEqual&&dialogsEqual&&permissionsEqual,textSimilarity:+textSimilarity.toFixed(5),tableShapeEqual,tableSamplesEqual,headingsEqual,controlsEqual,dialogsEqual,permissionsEqual};
}

const S=[
["Bienvenida"],
["Oficina \u00b7 Equipos","Oficina T\u00e9cnica","ROP02","Equipos"],["Oficina \u00b7 Veh\u00edculos","Oficina T\u00e9cnica","ROP02","Veh\u00edculos"],["Oficina \u00b7 Combustible","Oficina T\u00e9cnica","ROP02","Combustible"],["Oficina \u00b7 Hor\u00f3metros","Oficina T\u00e9cnica","ROP02","Hor\u00f3metros"],["Oficina \u00b7 Control horas","Oficina T\u00e9cnica","ROP02","Control de horas mensuales"],
["Oficina \u00b7 Control errores","Oficina T\u00e9cnica","Control de ROP02","Control de errores"],["Oficina \u00b7 Control equipo","Oficina T\u00e9cnica","Control de ROP02","Control por Equipo"],["Oficina \u00b7 Atraso","Oficina T\u00e9cnica","Control de ROP02","Atraso"],
["Oficina \u00b7 Productividad","Oficina T\u00e9cnica","ROP05","Productividad"],["Oficina \u00b7 Discriminaci\u00f3n","Oficina T\u00e9cnica","ROP05","Discriminaci\u00f3n por tarea"],["Oficina \u00b7 Ranking","Oficina T\u00e9cnica","ROP05","Ranking Operarios"],
["Oficina \u00b7 Control ROP05 vs ROP02","Oficina T\u00e9cnica",null,"Control ROP05 vs ROP02"],["Oficina \u00b7 Lista Maestra","Oficina T\u00e9cnica",null,"Lista Maestra de Equipos"],
["Mantenimiento \u00b7 RMA15","Mantenimiento","RMA15","Mantenimiento"],["Mantenimiento \u00b7 Distribuci\u00f3n","Mantenimiento","RMA15","Distribuci\u00f3n de mantenimientos"],["Mantenimiento \u00b7 Control equipo","Mantenimiento","RMA15","Control por Equipo"],["Mantenimiento \u00b7 Informe costos","Mantenimiento","RMA15","Informe de Costos"],["Mantenimiento \u00b7 Costos unitarios","Mantenimiento","RMA15","Costos Unitarios"],
["PM \u00b7 Dashboard","Mantenimiento","Mantenimiento Programado","Dashboard"],["PM \u00b7 Planificador","Mantenimiento","Mantenimiento Programado","Planificador"],["PM \u00b7 Programaci\u00f3n","Mantenimiento","Mantenimiento Programado","Programaci\u00f3n"],["PM \u00b7 Panel flota","Mantenimiento","Mantenimiento Programado","Panel de flota"],["PM \u00b7 Registrar realizado","Mantenimiento","Mantenimiento Programado","Registrar realizado"],["PM \u00b7 Gesti\u00f3n","Mantenimiento","Mantenimiento Programado","Gesti\u00f3n y alertas"],["PM \u00b7 Configuraci\u00f3n","Mantenimiento","Mantenimiento Programado","Configuraci\u00f3n"],["PM \u00b7 Historial","Mantenimiento","Mantenimiento Programado","Historial"],
["Abastecimiento \u00b7 Dashboard","Abastecimiento","Abastecimiento","Dashboard"],["Abastecimiento \u00b7 RABA03","Abastecimiento","Abastecimiento","RABA03"],["Abastecimiento \u00b7 Remito","Abastecimiento","Abastecimiento","Remito"],["Abastecimiento \u00b7 Realizadas","Abastecimiento","Solicitudes","Realizadas"],["Abastecimiento \u00b7 Pendientes","Abastecimiento","Solicitudes","Pendientes"],["Abastecimiento \u00b7 Parciales","Abastecimiento","Solicitudes","Parciales"],["Abastecimiento \u00b7 Cerradas","Abastecimiento","Solicitudes","Cerradas"],["Abastecimiento \u00b7 Rechazadas","Abastecimiento","Solicitudes","Rechazadas"],["Abastecimiento \u00b7 Env\u00edos sin solicitud","Abastecimiento","Solicitudes","Env\u00edos sin solicitud"],["Abastecimiento \u00b7 Editar c\u00f3digos","Abastecimiento",null,"Editar c\u00f3digos"],["Abastecimiento \u00b7 Dashboard stock","Abastecimiento","Stock cr\u00edtico","Dashboard Stock"],["Abastecimiento \u00b7 Control stock","Abastecimiento","Stock cr\u00edtico","Control de stock"],
["Taller Central","Taller Central",null,"Taller Central"],["Calidad \u00b7 ICHC","Calidad",null,"ICHC"],["Licitaciones \u00b7 Nueva","Licitaciones",null,"Nueva Licitaci\u00f3n"],["Licitaciones \u00b7 Control","Licitaciones",null,"Control de Licitaciones"],["Licitaciones \u00b7 Costos equipos","Licitaciones",null,"Costos de Equipos"],["Licitaciones \u00b7 Datos equipos","Licitaciones",null,"Datos Equipos"]
];

async function nav(page,s){await welcome(page);if(s.length===1)return true;if(!await openModule(page,s[1]))return false;return s[3]?openNav(page,s[2],s[3]):true;}
function diagnostics(page){const d={pageErrors:[],consoleErrors:[],failed:[],fiveXX:[]};page.on("pageerror",e=>d.pageErrors.push(String(e.message||e)));page.on("console",m=>{if(m.type()==="error")d.consoleErrors.push(m.text())});page.on("requestfailed",r=>d.failed.push(r.url().split("?")[0]));page.on("response",r=>{if(r.status()>=500)d.fiveXX.push({url:r.url().split("?")[0],status:r.status()})});return d;}

const browser=await chromium.launch({headless:true});
const bc=await browser.newContext({viewport:{width:1440,height:1000}}),cc=await browser.newContext({viewport:{width:1440,height:1000}});
const bp=await bc.newPage(),cp=await cc.newPage();const bd=diagnostics(bp),cd=diagnostics(cp),results=[];
try{
 await Promise.all([login(bp,BASELINE),login(cp,CANDIDATE)]);await Promise.all([settle(bp,60000),settle(cp,60000)]);
 for(const s of S){
  const [bo,co]=await Promise.all([nav(bp,s),nav(cp,s)]);
  if(!bo&&!co){results.push({name:s[0],status:"SKIP"});continue;}
  if(bo!==co){results.push({name:s[0],status:"FAIL",reason:`availability baseline=${bo} candidate=${co}`});continue;}
  await Promise.all([settle(bp),settle(cp)]);const [a,b]=await Promise.all([sig(bp),sig(cp)]);const c=compare(a,b);results.push({name:s[0],status:c.pass?"PASS":"FAIL",...c,baseline:{headings:a.headings,tables:a.tables,controls:a.controls,dialogs:a.dialogs},candidate:{headings:b.headings,tables:b.tables,controls:b.controls,dialogs:b.dialogs}});console.log(`${c.pass?"PASS":"FAIL"} ${s[0]} ${c.textSimilarity}`);
 }
}finally{await bc.close();await cc.close();await browser.close();}
const fail=results.filter(x=>x.status==="FAIL"),pass=results.filter(x=>x.status==="PASS"),skip=results.filter(x=>x.status==="SKIP");
const newPageErrors=cd.pageErrors.filter(x=>!bd.pageErrors.includes(x));
const out={generatedAt:new Date().toISOString(),baseline:BASELINE,candidate:CANDIDATE,pass:fail.length===0&&newPageErrors.length===0&&cd.fiveXX.length===0,counts:{pass:pass.length,fail:fail.length,skip:skip.length,total:results.length},diagnostics:{baseline:bd,candidate:cd,newPageErrors},results};
await fs.writeFile(path.join(OUT,"parity.json"),JSON.stringify(out,null,2));
const md=["# Delta OPS parity",`Resultado: **${out.pass?"PASS":"FAIL"}** \u00b7 PASS ${pass.length} \u00b7 FAIL ${fail.length} \u00b7 SKIP ${skip.length}`,"","| Vista | Estado | Similitud | Tablas | Controles | Permisos |","|---|---|---:|---|---|---|",...results.map(r=>`| ${r.name} | ${r.status} | ${r.textSimilarity??""} | ${r.tableShapeEqual===undefined?"":r.tableShapeEqual?"OK":"DIFF"} | ${r.controlsEqual===undefined?"":r.controlsEqual?"OK":"DIFF"} | ${r.permissionsEqual===undefined?"":r.permissionsEqual?"OK":"DIFF"} |`)];
await fs.writeFile(path.join(OUT,"parity.md"),md.join("\n"));console.log(md.join("\n"));if(!out.pass)process.exit(1);
