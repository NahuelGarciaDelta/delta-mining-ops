import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {getMonthlyCutoffRange} from "../src/modules/analytics/monthlyCutoffRange.js";
import {selectRop02PeriodContinuityRows,limitRop02ErrorsToPeriod} from "../src/shared/rop02PeriodContinuity.js";

const source=readFileSync(new URL("../src/modules/oficina-tecnica/OficinaTecnicaModule.jsx",import.meta.url),"utf8");
const start=source.indexOf("function ControlDeErrores({rop02All,extState,setExtState})");
const end=source.indexOf("// ─── ControlPorEquipo",start);
assert.ok(start>=0&&end>start);
const view=source.slice(start,end);

test("todos los meses de Control de errores aplican el período 26 del anterior al 25",()=>{
 const expected=[
 ["2025-12-26","2026-01-25"],
 ["2026-01-26","2026-02-25"],
 ["2026-02-26","2026-03-25"],
 ["2026-03-26","2026-04-25"],
 ["2026-04-26","2026-05-25"],
 ["2026-05-26","2026-06-25"],
 ["2026-06-26","2026-07-25"],
 ["2026-07-26","2026-08-25"],
 ["2026-08-26","2026-09-25"],
 ["2026-09-26","2026-10-25"],
 ["2026-10-26","2026-11-25"],
 ["2026-11-26","2026-12-25"]
 ];
 expected.forEach(([startISO,endISO],monthIndex)=>{
   const result=getMonthlyCutoffRange(monthIndex,2026);
   assert.equal(result.startISO,startISO,"inicio "+monthIndex);
   assert.equal(result.endISO,endISO,"fin "+monthIndex);
 });
 assert.deepEqual(
  [getMonthlyCutoffRange(0,2027).startISO,getMonthlyCutoffRange(0,2027).endISO],
  ["2026-12-26","2027-01-25"]
 );
});

test("Control de errores comparte el corte 26-25 en vista, contadores, aceptados y Excel",()=>{
 assert.match(view,/getMonthlyCutoffRange\(mesIdx,año\)/);
 assert.match(view,/const rangoDesde=fechaDesde\|\|periodo\.fechaD/);
 assert.match(view,/const rangoHasta=fechaHasta\|\|periodo\.fechaH/);
 assert.match(view,/row\.fecha>=rangoDesde&&row\.fecha<=rangoHasta/);
 assert.match(view,/selectRop02PeriodContinuityRows\(controlScope,rangoDesde,rangoHasta\)/);
 assert.match(view,/limitRop02ErrorsToPeriod\(/);
 assert.match(view,/if\(error\.fecha<rangoDesde\|\|error\.fecha>rangoHasta\)return false/);
 assert.match(view,/Período operativo \(26–25\)/);
 assert.match(view,/XLSX\.writeFile\(workbook,"Control_de_errores_ROP02\.xlsx"\)/);
});

test("al cambiar mes o año se borran fechas manuales anteriores sin borrar proyecto/máquina",()=>{
 assert.match(view,/mesIdx:Number\(value\),fechaDesde:"",fechaHasta:""/);
 assert.match(view,/año:value,fechaDesde:"",fechaHasta:""/);
 assert.match(view,/setExtState\(state=>\(\{\.\.\.state,mesIdx:Number\(value\)/);
 assert.match(view,/setExtState\(state=>\(\{\.\.\.state,año:value/);
 assert.match(view,/fechaDesde\|\|fechaHasta\?"Período personalizado/);
});

test("el corte 26/09–25/10 detecta el error MOT-0090 y conserva referencia anterior del 25/09",()=>{
 const {startISO,endISO}=getMonthlyCutoffRange(9,2026);
 const rows=[
  {fecha:"2026-09-25",maquina:"MOT-0090-JM",proyecto:"JOSE MARIA",turno:"TURNO DIA",horometroFinal:767},
  {fecha:"2026-09-30",maquina:"MOT-0090-JM",proyecto:"JOSE MARIA",turno:"TURNO DIA",horometroFinal:800},
  {fecha:"2026-10-01",maquina:"MOT-0090-JM",proyecto:"JOSE MARIA",turno:"TURNO DIA",horometroInicial:804,horometroFinal:811},
  {fecha:"2026-10-26",maquina:"MOT-0090-JM",proyecto:"JOSE MARIA",turno:"TURNO DIA",horometroInicial:850}
 ];
 const scope=selectRop02PeriodContinuityRows(rows,startISO,endISO);
 assert.deepEqual(scope.map(r=>r.fecha),["2026-09-25","2026-09-30","2026-10-01"]);
 assert.equal(scope[2].horometroInicial-scope[1].horometroFinal,4);
 const result=limitRop02ErrorsToPeriod({
  erroresHoro:[{fecha:"2026-09-25",diff:1},{fecha:"2026-10-01",diff:4},{fecha:"2026-10-26",diff:2}],
  erroresPartes:[],erroresDuplicados:[]
 },startISO,endISO);
 assert.deepEqual(result.erroresHoro.map(r=>r.diff),[4]);
});
