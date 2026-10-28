import test from "node:test";
import assert from "node:assert/strict";
import {bootstrapRop02Catalog} from "../src/services/rop02Catalog.js";
import {ROP02_SOURCE_KEYS,ROP02_SOURCES,ROP02_SOURCE_MAP,ROP02_PREFIX,rop02SourceFromKey} from "../src/config/rop02Sources.js";
import {VIEW_SOURCES} from "../src/config/viewSources.js";
import {SUPABASE_TYPED_SOURCES} from "../src/services/supabaseReadApi.js";
import {DASHBOARD_PROJECT_DEFS,resolveDashboardScope} from "../src/modules/home/dashboardSnapshotPolicy.js";

const example={dataset:"rop02_batidero",project:"BATIDERO"};
test("Rop02 auto-registra una nueva fuente sin quitar las cinco productivas",async t=>{
  const oldFetch=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{
    assert.match(String(url),/\/rest\/v1\/rpc\/rop02_public_catalog/);
    assert.equal(options.method,"POST");
    return new Response(JSON.stringify([
      {dataset:"rop02_fs",project:"FILO DEL SOL"},
      {dataset:"rop02_jm",project:"JOSE MARIA"},
      {dataset:"rop02_filosur",project:"FILO SUR"},
      {dataset:"rop02_zorro",project:"EL ZORRO"},
      {dataset:"rop02_fierro",project:"EL FIERRO"},
      example
    ]),{status:200,headers:{"content-type":"application/json"}});
  };
  t.after(()=>{globalThis.fetch=oldFetch;});
  const result=await bootstrapRop02Catalog();
  assert.equal(result.ok,true);
  assert.equal(result.newSources,1);
  for(const key of ["rop02_fs","rop02_jm","rop02_filosur","rop02_zorro","rop02_fierro",example.dataset])
    assert.ok(ROP02_SOURCE_KEYS.includes(key),key);
  assert.equal(ROP02_SOURCES.find(s=>s.key===example.dataset).project,"BATIDERO");
  assert.ok(ROP02_SOURCE_MAP.some(([key,project])=>key===example.dataset&&project==="BATIDERO"));
  assert.equal(ROP02_PREFIX[example.dataset],"SRC|ROP02_BATIDERO|");
  assert.equal(rop02SourceFromKey("SRC|ROP02_BATIDERO|2026|12"),example.dataset);
  assert.equal(SUPABASE_TYPED_SOURCES.has(example.dataset),true);
  // Bienvenida sólo consulta Lista Maestra y sus RPC de resumen: no debe
  // incorporar un histórico completo cuando el catálogo descubre un proyecto.
  for(const view of ["rop02","horometros","dashboard","ctrlEquipo","controlErrores","atrasoROP02","gestionHumanaHistorial","tallerCentral","listaEquipos","pmDashboard","vehiculos"]){
    assert.ok(VIEW_SOURCES[view].includes(example.dataset),view);
  }
  assert.ok(DASHBOARD_PROJECT_DEFS.some(s=>s.source===example.dataset&&s.id==="BATIDERO"));
  assert.deepEqual([...resolveDashboardScope("BATIDERO").requiredSources],[example.dataset]);
  const second=await bootstrapRop02Catalog();
  assert.equal(second.newSources,0);
  assert.equal(ROP02_SOURCE_KEYS.filter(k=>k===example.dataset).length,1);
});

test("Origen del proyecto se mantiene aislado del resto",()=>{
  assert.equal(rop02SourceFromKey("SRC|ROP02_JM|203"),"rop02_jm");
  assert.equal(rop02SourceFromKey("SRC|ROP02_FS|203"),"rop02_fs");
  assert.equal(rop02SourceFromKey("SRC|ROP02_BATIDERO|203"),"rop02_batidero");
  assert.equal(rop02SourceFromKey("SRC|ROP02_DESCONOCIDO|203"),"");
});
