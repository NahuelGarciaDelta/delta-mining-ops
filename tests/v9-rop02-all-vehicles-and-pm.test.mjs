import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {v9UnifiedControlSourcesVitePlugin} from "../scripts/v9-unified-control-sources-vite-plugin.mjs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("V9 Atraso uses complete original ROP02 rows, without filtered equipment snapshot",()=>{
 const src=read("src/modules/oficina-tecnica/OficinaTecnicaModule.jsx");
 const out=v9UnifiedControlSourcesVitePlugin().transform(src,"/app/src/modules/oficina-tecnica/OficinaTecnicaModule.jsx").code;
 const start=out.indexOf("function ViewAtrasoROP02(");
 const end=out.indexOf("function ViewControlROP02(",start);
 const view=out.slice(start,end);
 assert.match(view,/const atrasoSource=rop02All;/);
 assert.doesNotMatch(view,/getRop02LatestByEquipmentProject\(\{\}\)/);
 assert.doesNotMatch(view,/const atrasoSource=remoteRop02\|\|rop02All/);
});

test("V9 Error control does not overwrite complete ROP02 with a second history fetch",()=>{
 const src=read("src/modules/oficina-tecnica/OficinaTecnicaRoute.jsx");
 const out=v9UnifiedControlSourcesVitePlugin().transform(src,"/app/src/modules/oficina-tecnica/OficinaTecnicaRoute.jsx").code;
 assert.match(out,/setControlErrorsRop02\(scopedRop02ControlAll.length\?scopedRop02ControlAll:scopedRop02All\)/);
 assert.doesNotMatch(out,/refreshHistoricalDataset\("rop02",historicalQuery\)\.then/);
});

test("V9 applies all original PM vehicle plugins in correct sequence",()=>{
 const src=read("vite.v9.config.js");
 const order=["v9UnifiedControlSourcesVitePlugin()","pmPanelActive7DaysVitePlugin()","vehicleKmMaintenanceVitePlugin()","pmVehicleScopeVitePlugin()","pmVehicleDisplayVitePlugin()"];
 let previous=-1;
 for(const name of order){
  const found=src.lastIndexOf(name);
  assert.ok(found>previous,"Missing or incorrectly ordered V9 plugin: "+name);
  previous=found;
 }
});

test("V9 paged ROP02 snapshot and date-filtered history convert DD/MM/YYYY to ISO",()=>{
 const src=read("src/standalone/adapters/supabaseReadApi.js");
 assert.match(src,/const asDate=row=>normalizeV9PmDate\(row\?\.Fecha/);
 assert.match(src,/const date=v=>normalizeV9PmDate\(v\)/);
 assert.match(src,/const from=normalizeV9PmDate\(params\.desde\),to=normalizeV9PmDate\(params\.hasta\)/);
 assert.match(src,/const local=raw\.match\(/);
});
