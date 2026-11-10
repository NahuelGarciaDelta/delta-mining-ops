import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {atrasoIchcFixesVitePlugin} from "./scripts/atraso-ichc-fixes-vite-plugin.mjs";
import {rop02ControlVehicleFiltersVitePlugin} from "./scripts/rop02-control-vehicle-filters-vite-plugin.mjs";
import {vehicleKmMaintenanceVitePlugin} from "./scripts/vehicle-km-maintenance-vite-plugin.mjs";
import {pmVehicleScopeVitePlugin} from "./scripts/pm-vehicle-scope-vite-plugin.mjs";
import {pmVehicleDisplayVitePlugin} from "./scripts/pm-vehicle-display-vite-plugin.mjs";
import {pmPanelActive7DaysVitePlugin} from "./scripts/pm-panel-active-7-days-vite-plugin.mjs";
import {v9UnifiedControlSourcesVitePlugin} from "./scripts/v9-unified-control-sources-vite-plugin.mjs";
import {resolve,dirname,normalize} from "node:path";
const root=process.cwd();
const target=Object.fromEntries(Object.entries({
 "src/config/app.js":"src/standalone/adapters/configApp.js",
 "src/services/appsScriptApi.js":"src/standalone/adapters/appsScriptApi.js",
 "src/services/supabaseReadApi.js":"src/standalone/adapters/supabaseReadApi.js",
 "src/services/confirmedWrites.js":"src/standalone/adapters/confirmedWrites.js",
 "src/services/horometerUpdates.js":"src/standalone/adapters/horometerUpdates.js",
 "src/services/writeActions.js":"src/standalone/adapters/writeActions.js",
 "src/services/stockService.js":"src/standalone/adapters/stockService.js"
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
     .replaceAll("/api/supabase-read","/api/v9-blocked")
     .replaceAll("/api/v9-ops","/api/v9-blocked")
     .replaceAll("sb_publishable_XZAcQcWEDdgtZY_NWADy1g_HxoV0UZ2","V8_PUBLISHABLE_KEY_DISABLED");
   if(path.endsWith("/src/modules/oficina-tecnica/OficinaTecnicaModule.jsx")){
     // A second click verifies the same operation; it must never resend writes.
     result=result.replace("let operation=meterOperationRef.current;","let operation=meterOperationRef.current;const meterVerifyOnly=Boolean(operation);");
     result=result.replace("submitHorometerOperation(METER_API_URL,operation);","submitHorometerOperation(METER_API_URL,operation,{verifyOnly:meterVerifyOnly});");
   }
   return result===code?null:{code:result,map:null};
  },
  generateBundle(_opts,bundle){
   for(const asset of Object.values(bundle)){
    if(asset.type!=="chunk")continue;
    // Build fail-closed: no original Apps Script, production Supabase or legacy API.
    // This examines every generated JS chunk, including lazy-loaded modules.
    const legacy=[
      "jwfocqaxlckuxoklwyxs",
      "script.google.com/macros/s/",
      "/api/apps-script",
      "/api/supabase-read",
      "/api/v9-ops",
      "/functions/v1/delta-rop02-incremental-sync"
    ];
    if(legacy.some(fragment=>asset.code.includes(fragment)))
     this.error("V9 BUILD BLOCKED: referencia ejecutable a backend de Delta OPS V8.1");
   }
  }
 }
}
export default defineConfig({
 plugins:[v9UnifiedControlSourcesVitePlugin(),atrasoIchcFixesVitePlugin(),rop02ControlVehicleFiltersVitePlugin(),pmPanelActive7DaysVitePlugin(),vehicleKmMaintenanceVitePlugin(),pmVehicleScopeVitePlugin(),pmVehicleDisplayVitePlugin(),isolateV9(),react()],
 build:{
  outDir:"dist",
  chunkSizeWarningLimit:900,
  rollupOptions:{
   input:resolve(root,"index.html"),
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
