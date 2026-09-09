import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync(new URL("../src/modules/home/ViewBienvenidaProjectFilter.jsx",import.meta.url),"utf8");

test("Dashboard Gerencial no recibe el ROP02 reducido al día del Resumen General",()=>{
  assert.match(
    source,
    /const rop02ForCurrentHomeView=dashboardVisible\?projectFilteredRop02:dailySummaryRop02;/,
    "El Dashboard debe recibir el histórico completo filtrado solo por proyecto"
  );
  assert.match(
    source,
    /rop02All:rop02ForCurrentHomeView/,
    "No debe volver a pasarse filteredRop02 diario directamente como rop02All"
  );
  assert.match(
    source,
    /summaryDayFiltered:!dashboardVisible&&Boolean\(effectiveDay\)/,
    "El filtro diario debe quedar limitado al Resumen General"
  );
});
