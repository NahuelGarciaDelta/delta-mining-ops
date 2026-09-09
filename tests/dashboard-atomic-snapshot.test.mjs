import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  resolveDashboardScope,
  validateDashboardSnapshotResponse,
  validateCachedDashboardSnapshot,
  dashboardDateKey,
  historicalDashboardDistribution,
  DASHBOARD_SNAPSHOT_CACHE_VERSION,
} from "../src/modules/home/dashboardSnapshotPolicy.js";

function historicalRows(project){
  const rows=[];
  for(let month=2;month<=8;month++){
    const mm=String(month).padStart(2,"0");
    for(let i=0;i<25;i++)rows.push({fecha:`2026-${mm}-${String((i%20)+1).padStart(2,"0")}`,proyecto:project,horas:6,maquina:`EQ-${month}-${i}`});
  }
  return rows;
}

const scopeTwo=resolveDashboardScope("JOSE MARIA Y FILO DEL SOL");
const completeRop=[...historicalRows("JOSE MARIA"),...historicalRows("FILO DEL SOL"),{fecha:"2026-03-01",proyecto:"FILO SUR",horas:5},{fecha:"2026-07-01",proyecto:"EL ZORRO",horas:5}];
const completeRma=[{fecha:"2026-07-01",proyecto:"JOSE MARIA",costoTotal:100},{fecha:"2026-07-02",proyecto:"FILO DEL SOL",costoTotal:200}];

function response(rop02=completeRop){
  return{
    ok:true,
    action:"dashboard_snapshot",
    backendVersion:"2026-09-09-DASHBOARD-SNAPSHOT-V1",
    rop02,
    rma15:completeRma,
    stats:{
      rop02:rop02.length,
      rma15:completeRma.length,
      rma15ConCodigos:2,
      rma15Valorizados:2,
      rop02Fuentes:{rop02_jm:{rows:175},rop02_fs:{rows:175},rop02_filosur:{rows:1},rop02_zorro:{rows:1}},
    },
    coverage:{rop02Min:"2026-02-01",rop02Max:"2026-08-20",rma15Min:"2026-07-01",rma15Max:"2026-07-02"},
  };
}

test("alcance TODO exige los cuatro proyectos y un alcance restringido sólo los autorizados",()=>{
  const global=resolveDashboardScope("TODO");
  assert.deepEqual(global.requiredSources,["rop02_jm","rop02_fs","rop02_filosur","rop02_zorro"]);
  assert.deepEqual(scopeTwo.projects,["JOSE MARIA","FILO DEL SOL"]);
  assert.deepEqual(scopeTwo.requiredSources,["rop02_jm","rop02_fs"]);
});

test("fechas del dashboard aceptan ISO, DD/MM/YYYY y timestamps",()=>{
  assert.equal(dashboardDateKey("2026-07-31"),"2026-07-31");
  assert.equal(dashboardDateKey("31/07/2026"),"2026-07-31");
  assert.equal(dashboardDateKey("2026-07-31T18:30:00-03:00"),"2026-07-31");
});

test("snapshot válido se publica con los dos proyectos autorizados y conserva histórico",()=>{
  const checked=validateDashboardSnapshotResponse(response(),2026,scopeTwo);
  assert.equal(checked.rop02.length,350);
  assert.ok(checked.rop02.every(row=>["JOSE MARIA","FILO DEL SOL"].includes(row.proyecto)));
  const distribution=historicalDashboardDistribution(checked.rop02);
  for(const month of ["2026-02","2026-03","2026-04","2026-05","2026-06","2026-07","2026-08"]){
    assert.ok(distribution[month]?.hours>0,`${month} debe conservar horas`);
  }
});

test("si falta una fuente autorizada la transacción completa se rechaza",()=>{
  const onlyJm=completeRop.filter(row=>row.proyecto!=="FILO DEL SOL");
  assert.throws(()=>validateDashboardSnapshotResponse(response(onlyJm),2026,scopeTwo),/falta FILO DEL SOL/i);
});

test("el último snapshot compuesto sólo se acepta para la misma versión/año/alcance",()=>{
  const checked=validateDashboardSnapshotResponse(response(),2026,scopeTwo);
  const cached={
    ok:true,
    cacheVersion:DASHBOARD_SNAPSHOT_CACHE_VERSION,
    year:2026,
    scopeKey:scopeTwo.scopeKey,
    updatedAt:"2026-09-09T20:00:00.000Z",
    rop02:checked.rop02,
    rma15:checked.rma15,
  };
  assert.ok(validateCachedDashboardSnapshot(cached,2026,scopeTwo));
  assert.equal(validateCachedDashboardSnapshot({...cached,scopeKey:"GLOBAL"},2026,scopeTwo),null);
  assert.equal(validateCachedDashboardSnapshot({...cached,cacheVersion:7},2026,scopeTwo),null);
});

test("las dos entradas del Dashboard usan snapshot atómico y no la caché ROP02 por fuente",()=>{
  const wrapper=fs.readFileSync(new URL("../src/modules/home/ExecutiveDashboardHistorical.jsx",import.meta.url),"utf8");
  const homeFilter=fs.readFileSync(new URL("../src/modules/home/ViewBienvenidaProjectFilter.jsx",import.meta.url),"utf8");
  const sources=fs.readFileSync(new URL("../src/config/viewSources.js",import.meta.url),"utf8");
  assert.match(wrapper,/dashboard-atomic-snapshot/);
  assert.match(wrapper,/if\(prev\.ready\)/);
  assert.match(homeFilter,/validateDashboardSnapshotResponse/);
  assert.match(homeFilter,/dashboardSnapshot\.ready\?dashboardSnapshot\.rop02:\[\]/);
  assert.match(sources,/dashboard:\["rop05"\]/);
});
