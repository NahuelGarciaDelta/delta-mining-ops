import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync(new URL("../src/modules/home/ViewBienvenidaProjectFilter.jsx",import.meta.url),"utf8");

test("Dashboard Gerencial recibe histórico completo y Resumen General aplica el filtro diario",()=>{
  assert.match(source,/if\(dashboardVisible\)\{/);
  assert.match(source,/rop02All:Array\.isArray\(props\.rop02All\)\?props\.rop02All:\[\]/);
  assert.match(source,/summaryDayFiltered:false/);
  assert.match(source,/const dailySummaryRop02=effectiveDay\?projectFilteredRop02\.filter/);
  assert.match(source,/rop02All:dailySummaryRop02/);
  assert.match(source,/summaryDayFiltered:Boolean\(effectiveDay\)/);
});
