import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {getMonthlyCutoffRange} from "../src/modules/analytics/monthlyCutoffRange.js";

const source=readFileSync(new URL("../src/modules/oficina-tecnica/OficinaTecnicaModule.jsx",import.meta.url),"utf8");
const start=source.indexOf("function ControlDeErrores({rop02All,extState,setExtState})");
const end=source.indexOf("// ─── ControlPorEquipo",start);
assert.ok(start>=0&&end>start,"Sección de Control de errores encontrada");
const view=source.slice(start,end);

test("cada mes operativo controla del 26 anterior al 25 del mes seleccionado",()=>{
 const periods=[
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
 periods.forEach(([startISO,endISO],month)=>{
   const dates=getMonthlyCutoffRange(month,2026);
   assert.equal(dates.startISO,startISO,"inicio mes "+(month+1));
   assert.equal(dates.endISO,endISO,"fin mes "+(month+1));
 });
 const january=getMonthlyCutoffRange(0,2027);
 assert.equal(january.startISO,"2026-12-26");
 assert.equal(january.endISO,"2027-01-25");
});
test("Control de errores aplica período 26-25 a datos e indicadores",()=>{
 assert.match(view,/getMonthlyCutoffRange\(mesIdx,año\)/);
 assert.match(view,/const rangoDesde=fechaDesde\|\|periodo\.fechaD/);
 assert.match(view,/const rangoHasta=fechaHasta\|\|periodo\.fechaH/);
 assert.match(view,/row\.fecha>=rangoDesde&&row\.fecha<=rangoHasta/);
 assert.match(view,/calcularErroresControlEquipo\(filtered\)/);
 assert.match(view,/if\(error\.fecha<rangoDesde\|\|error\.fecha>rangoHasta\)return false/);
 assert.match(view,/Período operativo \(26–25\)/);
 assert.match(view,/XLSX\.writeFile\(workbook,"Control_de_errores_ROP02\.xlsx"\)/);
});
test("cambiar mes/año descarta fechas manuales viejas pero no elimina proyecto/máquina",()=>{
 assert.match(view,/mesIdx:Number\(value\),fechaDesde:"",fechaHasta:""/);
 assert.match(view,/año:value,fechaDesde:"",fechaHasta:""/);
 assert.match(view,/setExtState\(state=>\(\{\.\.\.state,mesIdx:Number\(value\)/);
 assert.match(view,/setExtState\(state=>\(\{\.\.\.state,año:value/);
 assert.match(view,/fechaDesde\|\|fechaHasta\?"Período personalizado/);
});
