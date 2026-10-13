import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {historicalVersionsForDataset,historicalSnapshotMatchesManifest} from "../src/data/historicalVersionPolicy.js";

const manifest={ok:true,versions:{
  rop02_jm:101,rop02_fs:202,rop02_filosur:303,rop02_zorro:404,
  rop05:505,rma15_fs:606,rma15_jm:707,insumos:808
}};
const saved=(versions)=>({ok:true,data:[{id:1}],versions});

test("ROP02 historico utiliza solamente sus cuatro fuentes",()=>{
  const versions=historicalVersionsForDataset("rop02",manifest);
  assert.deepEqual(Object.keys(versions).sort(),["rop02_fs","rop02_filosur","rop02_jm","rop02_zorro"].sort());
  assert.equal(historicalSnapshotMatchesManifest("rop02",saved(versions),manifest),true);
  const unrelated={ok:true,versions:{...manifest.versions,rop05:99999}};
  assert.equal(historicalSnapshotMatchesManifest("rop02",saved(versions),unrelated),true);
});

test("un solo cambio ROP02 invalida el historico completo",()=>{
  const versions=historicalVersionsForDataset("rop02",manifest);
  assert.equal(historicalSnapshotMatchesManifest("rop02",saved(versions),{ok:true,versions:{...manifest.versions,rop02_jm:102}}),false);
});

test("ROP05 y RMA15 se invalidan independientemente",()=>{
  assert.equal(historicalSnapshotMatchesManifest("rop05",saved({rop05:505}),manifest),true);
  assert.equal(historicalSnapshotMatchesManifest("rma15",saved({rma15_jm:707,rma15_fs:606}),manifest),true);
  assert.equal(historicalSnapshotMatchesManifest("rma15",saved({rma15_jm:707,rma15_fs:605}),manifest),false);
});

test("manifiesto incompleto o datos invalidos no se consideran frescos",()=>{
  assert.equal(historicalSnapshotMatchesManifest("rop02",saved({rop02_jm:101}),manifest),false);
  assert.equal(historicalSnapshotMatchesManifest("rop02",saved({rop02_jm:101}),null),false);
  assert.equal(historicalSnapshotMatchesManifest("rop05",{ok:true,data:null,versions:{rop05:505}},manifest),false);
  assert.equal(historicalVersionsForDataset("rop02",{ok:true,versions:{rop02_jm:101}}),null);
});

test("la version cero no permite afirmar que hay datos completos",()=>{
  assert.equal(historicalVersionsForDataset("rop05",{ok:true,versions:{rop05:0}}),null);
});

test("seguridad: los GET iniciales y manuales pasan por control de version",()=>{
  const app=fs.readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
  assert.match(app,/if\(!force&&toCheck\.some\(/);
  assert.match(app,/planVersionedRefresh\(toCheck,knownSources,manifest\.versions,manifest\.rowCounts\)/);
  assert.match(app,/force:reason==="manual"/);
  assert.match(app,/if\(existingRequest\)return existingRequest/);
});

test("seguridad: ROP02 filtrado conserva la lectura viva sin cache historica",()=>{
  const source=fs.readFileSync(new URL("../src/data/historicalDataService.js",import.meta.url),"utf8");
  assert.match(source,/live&&!isOfficeControlFullQuery_\(params\)/);
  assert.match(source,/if\(!sync&&!live\)return cached/);
});
