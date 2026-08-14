import test from "node:test";
import assert from "node:assert/strict";
import { esEquipoPropioDelta, getCostoHorarioAmortizacionOAlquiler } from "../src/modules/informe-costos/utils/amortizationCost.js";

test("equipo Delta usa costo de adquisición / vida útil", () => {
  const result = getCostoHorarioAmortizacionOAlquiler({
    propiedad: "DELTA",
    costoAdquisicion: 800000,
    vidaUtil: 8000,
    tarifaMensual: 999999,
    horasMensuales: 1
  });
  assert.equal(result.tipo, "AMORTIZACION");
  assert.equal(result.costoHorario, 100);
  assert.equal(result.divisor, 8000);
});

test("equipo alquilado nunca usa costo de adquisición", () => {
  const result = getCostoHorarioAmortizacionOAlquiler({
    propiedad: "TERCERO",
    costoAdquisicion: 9999999,
    vidaUtil: 1,
    tarifaMensual: 31900,
    horasMensuales: 200
  });
  assert.equal(result.tipo, "ALQUILER");
  assert.equal(result.costoHorario, 159.5);
  assert.equal(result.base, 31900);
});

test("alquiler usa 200 h como respaldo cuando el divisor no es válido", () => {
  const result = getCostoHorarioAmortizacionOAlquiler({ propiedad: "ALQUILADO", tarifaMensual: 20000, horasMensuales: 0 });
  assert.equal(result.costoHorario, 100);
  assert.equal(result.divisor, 200);
});

test("propiedad Delta tolera sufijos descriptivos", () => {
  assert.equal(esEquipoPropioDelta("Delta Mining"), true);
  assert.equal(esEquipoPropioDelta("Proveedor externo"), false);
});
