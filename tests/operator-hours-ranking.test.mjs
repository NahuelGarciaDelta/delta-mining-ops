import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {isHourlyRankingRecord,buildHourlyOperatorRanking} from "../src/modules/gestion-humana/operatorHoursRanking.js";
import {filterOperatorActivity} from "../src/modules/gestion-humana/gestionHumanaData.js";

const row=(maquina,horas,{operario="OPERARIO A",fecha="2026-10-20",tipo="",excluded=false,unidad="",estado="TRABAJO",proyecto="JOSE MARIA"}={})=>({
  maquina,horas,operario,fecha,proyecto,estado,_excluded:excluded,_tipo:tipo,
  unidad,turno:"TD",supervisor:"SUPERVISOR",
});
test("camionetas por prefijo, patente y categoría no entran, ni aunque usen el campo horas",()=>{
  for(const r of [
    row("CTA-1410",216,{tipo:"CAMIONETA CON MOCHILA",excluded:true,unidad:"KM"}),
    row("CTA-0879",400,{excluded:true}),
    row("AG201HG",300,{tipo:"CAMIONETA"}),
    row("PCA-0093",200,{tipo:"CAMIONETA"}),
    row("A123B",300,{tipo:"PICK UP"}),
  ])assert.equal(isHourlyRankingRecord(r),false,r.maquina);
});
test("admite camiones aun cuando ROP02 los marca excluidos de productividad",()=>{
  for(const r of [
    row("CAV-0078",9,{tipo:"CAMION VOLCADOR",excluded:true}),
    row("CAR-0089",8,{tipo:"CAMION REGADOR",excluded:true}),
    row("CAC-0040",7,{tipo:"CAMION COMBUSTIBLE",excluded:true}),
    row("CAT-0073",10,{tipo:"CAMION TRACTOR",excluded:true}),
    row("CAA-0030",6,{tipo:"CAMION CISTERNA",excluded:true}),
  ])assert.equal(isHourlyRankingRecord(r),true,r.maquina);
  assert.equal(isHourlyRankingRecord(row("CAA-0002",8,{tipo:"CAMION",excluded:true})),false);
});
test("admite máquinas viales por tipo, prefijo y formato histórico",()=>{
  for(const machine of ["MOT-0047","TOP-0032","EXC-0048","PCA-0101","CFN-0043","RTP-0016","RPC-0039","ROD-0001","MCA-0021","MNC-0022","MOT0047"]){
    assert.equal(isHourlyRankingRecord(row(machine,8)),true,machine);
  }
  assert.equal(isHourlyRankingRecord(row("XXX-0022",9,{tipo:"VIBROCOMPACTADOR"})),true);
  assert.equal(isHourlyRankingRecord(row("XXX-0023",9,{tipo:"EXCAVADORA"})),true);
});
test("auxiliares, generadores y mediciones km nunca suman como horas",()=>{
  assert.equal(isHourlyRankingRecord(row("CAT",9,{tipo:"GRUPO ELECTROGENO"})),false);
  assert.equal(isHourlyRankingRecord(row("PCA-0101",145,{unidad:"km"})),false);
  assert.equal(isHourlyRankingRecord(row("XXX-0101",12,{tipo:"OFICINA"})),false);
  assert.equal(isHourlyRankingRecord(row("TOP-0032",8,{estado:"FS"})),false);
  assert.equal(isHourlyRankingRecord(row("TOP-0032",-1)),false);
});
test("KPI, promedio, días, máquinas, Top15 y Excel comparten único ranking limpio",()=>{
  const records=[
    row("CTA-1410",400,{tipo:"CAMIONETA",excluded:true,unidad:"km"}),
    row("MOT-0047",8),
    row("MOT-0047",7,{fecha:"2026-10-21"}),
    row("CAV-0078",9,{excluded:true,tipo:"CAMION VOLCADOR"}),
    row("CTA-0879",202,{operario:"OPERARIO B",excluded:true,tipo:"CAMIONETA"}),
    row("EXC-0048",6,{operario:"OPERARIO B"}),
    row("GENERADOR",400,{operario:"OPERARIO C",tipo:"GRUPO ELECTROGENO"}),
  ];
  const summary=buildHourlyOperatorRanking(records);
  assert.deepEqual(summary.map(v=>v.operario),["OPERARIO A","OPERARIO B"]);
  assert.equal(summary[0].horas,24);
  assert.equal(summary[0].diasTrabajados,2);
  assert.equal(summary[0].promHsDia,12);
  assert.equal(summary[0].maquinas,"CAV-0078, MOT-0047");
  assert.equal(summary[1].horas,6);
  assert.equal(summary.reduce((s,v)=>s+v.horas,0),30);
  // No se altera la visibilidad de camionetas en el historial/operadores en sitio.
  assert.equal(filterOperatorActivity(records).some(v=>v.maquina==="CTA-1410"),true);
});
test("el componente consume el ranking validado en filtros, tarjetas, Top15 y Excel",()=>{
 const src=readFileSync(new URL("../src/modules/analytics/OperationalAnalytics.jsx",import.meta.url),"utf8");
 const begin=src.indexOf("function ViewRankingOperariosInner(");
 const end=src.indexOf("function HealthDashboardInner(",begin);
 const view=src.slice(begin,end);
 assert.match(view,/rop02All\|\|\[\]\)\.filter\(isHourlyRankingRecord\)/);
 assert.match(view,/buildHourlyOperatorRanking\(filtered\)/);
 assert.match(view,/label="Horas totales"/);
 assert.match(view,/ranking\.slice\(0,15\)/);
 assert.match(view,/excelFromCols\(cols,ranking/);
 assert.match(view,/camionetas y registros medidos en kilómetros/);
});
