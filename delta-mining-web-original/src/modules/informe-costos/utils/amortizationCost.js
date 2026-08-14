const norm = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
const number = value => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const parsed = Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function esEquipoPropioDelta(propiedad) {
  return norm(propiedad) === "DELTA" || norm(propiedad).startsWith("DELTA ");
}

/** Única regla de costo horario de capital/alquiler usada por Informe de Costos. */
export function getCostoHorarioAmortizacionOAlquiler(equipo = {}) {
  const propio = esEquipoPropioDelta(equipo.propiedad);
  const costoAdquisicion = number(equipo.costoAdquisicion);
  const vidaUtil = number(equipo.vidaUtil);
  const tarifaMensual = number(equipo.tarifaMensual);
  const horasMensualesInformadas = number(equipo.horasMensuales);
  const horasMensuales = horasMensualesInformadas > 0 ? horasMensualesInformadas : 200;
  const costoHorario = propio
    ? (vidaUtil > 0 ? costoAdquisicion / vidaUtil : 0)
    : (tarifaMensual > 0 ? tarifaMensual / horasMensuales : 0);
  return {
    tipo: propio ? "AMORTIZACION" : "ALQUILER",
    propio,
    costoHorario,
    base: propio ? costoAdquisicion : tarifaMensual,
    divisor: propio ? vidaUtil : horasMensuales,
    detalle: propio ? "Propio: costo adquisición / vida útil" : "Alquilado: tarifa mensual / horas mensuales",
  };
}
