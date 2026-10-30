import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {resolve,dirname,normalize} from "node:path";
const root=process.cwd();
const target=Object.fromEntries(Object.entries({
 "src/config/app.js":"src/standalone/adapters/configApp.js",
 "src/services/appsScriptApi.js":"src/standalone/adapters/appsScriptApi.js",
 "src/services/supabaseReadApi.js":"src/standalone/adapters/supabaseReadApi.js",
 "src/services/confirmedWrites.js":"src/standalone/adapters/confirmedWrites.js"
}).map(([k,v])=>[normalize(resolve(root,k)),resolve(root,v)]));

function isolateV9(){
 return{
  name:"delta-v9-standalone-backend-isolation",
  enforce:"pre",
  resolveId(source,importer){
   if(!importer||!source.startsWith("."))return null;
   const absolute=normalize(resolve(dirname(importer.split("?")[0]),source));
   return target[absolute]||null;
  },
  transform(code,id){
   const path=id.split("?")[0].replace(/\\/g,"/");
   if(!path.includes("/src/")||path.includes("/src/standalone/"))return null;
   let result=code
     .replaceAll("https://jwfocqaxlckuxoklwyxs.supabase.co","https://v8-disabled.invalid")
     .replaceAll("jwfocqaxlckuxoklwyxs","v8-disabled")
     .replaceAll("/api/apps-script","/api/v9-blocked")
     .replaceAll("/api/v9-ops","/api/v9-blocked")
     .replaceAll("sb_publishable_XZAcQcWEDdgtZY_NWADy1g_HxoV0UZ2","V8_PUBLISHABLE_KEY_DISABLED");
   return result===code?null:{code:result,map:null};
  },
  generateBundle(_opts,bundle){
   for(const asset of Object.values(bundle)){
    if(asset.type!=="chunk")continue;
    if(/jwfocqaxlckuxoklwyxs|\.supabase\.co\/functions\/v1\/delta-rop02-incremental-sync/.test(asset.code))
     this.error("V9 BUILD BLOCKED: se encontró una dependencia del Supabase V8.1");
   }
  }
 }
}
export default defineConfig({
 plugins:[isolateV9(),react()],
 build:{
  outDir:"dist",
  chunkSizeWarningLimit:900,
  rollupOptions:{
   input:resolve(root,"v9.html"),
   output:{manualChunks(id){
    const p=id.replace(/\\/g,"/");
    if(!p.includes("/node_modules/"))return;
    if(/\/node_modules\/(react|react-dom|scheduler)\//.test(p))return "react-vendor";
    if(p.includes("/node_modules/recharts/")||p.includes("/node_modules/d3-"))return "charts-vendor";
    if(p.includes("/node_modules/xlsx/"))return "xlsx-vendor";
   }}
  }
 }
});
