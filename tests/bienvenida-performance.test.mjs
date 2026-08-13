import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app=fs.readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
const home=fs.readFileSync(new URL("../src/modules/home/ViewBienvenida.jsx",import.meta.url),"utf8");

test("Bienvenida se monta aunque la carga global todavía esté activa",()=>{
  assert.match(app,/view!=="bienvenida"&&\(loading/);
  assert.match(app,/view==="bienvenida"\|\|lastUpdate/);
});

test("Resumen difiere cálculos y muestra loading granular sin ceros falsos",()=>{
  assert.match(home,/requestIdleCallback\(calculate/);
  assert.match(home,/loading:\{\s*flota:/);
  for(const block of ["flota","disponibilidad","ot","stock"]){
    assert.match(home,new RegExp(`summaryLoading\\.${block}`));
  }
  assert.match(home,/"Cargando…"/);
});

test("Bienvenida reutiliza cache de métricas y stock entre montajes",()=>{
  assert.match(home,/let bienvenidaSummaryCache=null/);
  assert.match(home,/let bienvenidaStockCache=null/);
  assert.match(home,/useState\(\(\)=>bienvenidaSummaryCache/);
  assert.match(home,/if\(bienvenidaStockCache\)return/);
});
