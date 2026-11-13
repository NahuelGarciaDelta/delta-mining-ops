import test from "node:test";
import assert from "node:assert/strict";
import { buildMonthlyAccumulatedHours, countCalendarMonths, monthlyAccumulatedCostRates } from "../src/modules/informe-costos/utils/monthlyAccumulatedCostMath.js";

const canonical = code => ({
  "CAR-0089": "AG661LM",
  "AG661LM": "AG661LM",
  "EXC-0014": "EXC-0034",
  "EXC-0034": "EXC-0034",
}[String(code || "").toUpperCase()] || String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, ""));

test("horas ROP02 consolidan código actual, histórico y equivalencia de Lista Maestra", () => {
  const hours = buildMonthlyAccumulatedHours([
    { maquina: "CAR-0089", fecha: "2026-01-10", horas: 7 },
    { maquina: "AG661LM", fecha: "2026-02-10", horas: "5.5" },
    { maquina: "EXC-0014", fecha: "2026-01-10", horas: 3 },
    { maquina: "EXC-0034", fecha: "2026-02-10", horas: 2 },
  ], { from: "2026-01-01", to: "2026-02-28", resolveIdentity: canonical });

  assert.equal(hours.get("AG661LM"), 12.5);
  assert.equal(hours.get("EXC-0034"), 5);
});

test("el promedio mensual cuenta todos los meses del rango aunque no tengan horas", () => {
  assert.equal(countCalendarMonths("2026-01-01", "2026-03-31"), 3);
  const rates = monthlyAccumulatedCostRates({ totalB: 600, averageMonthlyCost: 300, labor: 100, effectiveHours: 60, months: 3 });
  assert.equal(rates.averageMonthlyHours, 20);
  assert.equal(rates.monthlyUsdPerHour, 20);
  assert.equal(rates.accumulatedUsdPerHour, 15);
});

test("un divisor cero devuelve cero sin Infinity ni NaN", () => {
  const rates = monthlyAccumulatedCostRates({ totalB: 100, averageMonthlyCost: 50, labor: 25, effectiveHours: 0, months: 2 });
  assert.equal(rates.averageMonthlyHours, 0);
  assert.equal(rates.monthlyUsdPerHour, 0);
  assert.equal(rates.accumulatedUsdPerHour, 0);
  assert.ok(Object.values(rates).every(Number.isFinite));
});

test("las horas efectivas sólo suman números positivos del rango y excluyen estados sin operación", () => {
  const hours = buildMonthlyAccumulatedHours([
    { maquina: "MOT-1", fecha: "2026-01-01", horas: 8 },
    { maquina: "MOT-1", fecha: "2026-01-02", horas: 4, estado: "OD" },
    { maquina: "MOT-1", fecha: "2026-01-03", horas: "no numérico" },
    { maquina: "MOT-1", fecha: "2025-12-31", horas: 10 },
  ], { from: "2026-01-01", to: "2026-01-31", resolveIdentity: canonical });
  assert.equal(hours.get("MOT1"), 8);
});
