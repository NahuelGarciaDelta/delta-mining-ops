import { chromium } from "playwright";
import { promises as fs } from "node:fs";
import path from "node:path";

const BASE_URL=String(process.env.DM_PERF_BASE_URL||"https://delta-mining-ops.vercel.app").replace(/\/$/,"");
const EMAIL=String(process.env.DM_PERF_EMAIL||"").trim();
const PASSWORD=String(process.env.DM_PERF_PASSWORD||"");
const OUT_DIR=path.join(process.cwd(),"artifacts","phase0");
const OUT_FILE=path.join(OUT_DIR,"login-diagnostic.json");
await fs.mkdir(OUT_DIR,{recursive:true});

const safeLocation=url=>{
  try{const u=new URL(url);return `${u.origin}${u.pathname}`;}catch{return "invalid";}
};
const knownErrors=[
  "No se reconoce ese correo o contraseña. Usá el correo completo registrado.",
  "Este usuario figura como inactivo. Pedí que lo habiliten.",
  "No se pudo validar el acceso.",
  "El servidor de acceso está tardando demasiado. Intentá nuevamente en unos segundos.",
  "El servidor está ocupado. Intentá nuevamente en unos segundos.",
  "No se encontró el servicio de acceso. Actualizá la página e intentá nuevamente.",
  "Ingresá el correo electrónico registrado",
  "Ingresá el correo electrónico completo registrado",
  "Ingresá tu contraseña",
];

const result={
  generatedAt:new Date().toISOString(),
  target:safeLocation(BASE_URL),
  secretsPresent:Boolean(EMAIL&&PASSWORD),
  emailShapeValid:EMAIL.includes("@")&&EMAIL.includes("."),
  inputs:{emailVisible:false,passwordVisible:false},
  clicked:false,
  validatingObserved:false,
  appShellObserved:false,
  loginScreenObserved:false,
  genericError:null,
  authEvents:[],
  consoleWarnings:[],
  currentLocation:null,
  elapsedMs:null,
  diagnosticStatus:"NOT_STARTED",
};

async function save(){
  await fs.writeFile(OUT_FILE,JSON.stringify(result,null,2));
  console.log("PHASE0_LOGIN_DIAGNOSTIC");
  console.log(JSON.stringify(result,null,2));
}

if(!EMAIL||!PASSWORD){
  result.diagnosticStatus="SECRETS_MISSING";
  await save();
  process.exit(0);
}

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();
const started=Date.now();

page.on("console",msg=>{
  const text=String(msg.text()||"");
  if(msg.type()==="warning"&&/Supabase auth no disponible|fallback legacy/i.test(text)){
    result.consoleWarnings.push("Supabase auth no disponible; se intentó fallback legacy");
  }
});

page.on("response",async response=>{
  const url=response.url();
  const isSupabase=/\/rest\/v1\/rpc\/app_authenticate_user(?:\?|$)/i.test(url);
  const isLegacy=/\/api\/apps-script(?:\?|$)/i.test(url);
  if(!isSupabase&&!isLegacy)return;
  const entry={
    kind:isSupabase?"supabase-auth":"apps-script-fallback",
    url:safeLocation(url),
    status:response.status(),
    ok:response.ok(),
    outcomeOk:null,
    errorCode:null,
  };
  try{
    const contentType=String(response.headers()["content-type"]||"");
    if(contentType.includes("application/json")){
      const json=await response.json();
      if(typeof json?.ok==="boolean")entry.outcomeOk=json.ok;
      const code=String(json?.error?.code||"").trim();
      if(code)entry.errorCode=code.slice(0,80);
    }
  }catch{}
  result.authEvents.push(entry);
});

try{
  await page.goto(BASE_URL,{waitUntil:"domcontentloaded",timeout:60000});
  result.currentLocation=safeLocation(page.url());
  result.loginScreenObserved=await page.locator(".dm-login-screen").isVisible().catch(()=>false);

  const emailInput=page.getByPlaceholder("Correo electrónico");
  const passwordInput=page.getByPlaceholder("Contraseña");
  const loginButton=page.getByRole("button",{name:/^INGRESAR$/i});

  result.inputs.emailVisible=await emailInput.isVisible().catch(()=>false);
  result.inputs.passwordVisible=await passwordInput.isVisible().catch(()=>false);

  if(!result.inputs.emailVisible||!result.inputs.passwordVisible){
    result.diagnosticStatus="LOGIN_INPUTS_NOT_VISIBLE";
  }else{
    await emailInput.fill(EMAIL,{timeout:15000});
    await passwordInput.fill(PASSWORD,{timeout:15000});
    await loginButton.click({timeout:15000});
    result.clicked=true;

    await page.waitForTimeout(250);
    const deadline=Date.now()+60000;
    while(Date.now()<deadline){
      if(await page.locator(".dm-app-shell").isVisible().catch(()=>false)){
        result.appShellObserved=true;
        result.diagnosticStatus="LOGIN_SUCCESS";
        break;
      }

      const buttonText=await page.locator(".dm-login-screen button").first().innerText().catch(()=>"");
      if(/VALIDANDO/i.test(buttonText))result.validatingObserved=true;

      let found=null;
      for(const message of knownErrors){
        const exact=page.getByText(message,{exact:true});
        if(await exact.first().isVisible().catch(()=>false)){
          found=message;
          break;
        }
      }
      if(found){
        result.genericError=found;
        result.diagnosticStatus="LOGIN_REJECTED_OR_SERVICE_ERROR";
        await page.waitForTimeout(250);
        break;
      }
      await page.waitForTimeout(200);
    }

    if(result.diagnosticStatus==="NOT_STARTED"){
      result.diagnosticStatus="LOGIN_TIMEOUT";
    }
  }
}catch(error){
  result.diagnosticStatus="HARNESS_ERROR";
  result.harnessError=String(error?.message||error).replace(EMAIL,"[redacted-email]").replace(PASSWORD,"[redacted-password]").slice(0,500);
}finally{
  result.currentLocation=safeLocation(page.url());
  result.elapsedMs=Date.now()-started;
  await save();
  await context.close();
  await browser.close();
}
