import React, { useEffect, useRef, useState } from "react";

export const LICITACIONES_STORAGE_KEY = "dm_licitaciones_v1";

export function createEmptyTender() {
  return {
    id: `LIC-${Date.now()}`,
    nombre: "Nueva Licitación",
    cliente: "",
    proyecto: "",
    fecha: new Date().toISOString().slice(0, 10),
    estado: "EN CURSO",
    resultado: "PENDIENTE",
    moneda: "USD",
    convenio: "AOMA",
    planillas: {},
    horasContrato1: 180,
    horasContrato2: 0,
    usarSegundoContrato: false,
    fechas: [],
    equipos: [],
    manoObra: {
      AOMA: [
        { id: "a1", categoria: "Operador vial", costoHora: 0 },
        { id: "a2", categoria: "Supervisor", costoHora: 0 },
        { id: "a3", categoria: "Mecánico", costoHora: 0 },
        { id: "a4", categoria: "Ayudante", costoHora: 0 }
      ],
      UOCRA: [
        { id: "u1", categoria: "Operador de equipo", costoHora: 0 },
        { id: "u2", categoria: "Capataz", costoHora: 0 },
        { id: "u3", categoria: "Oficial mecánico", costoHora: 0 },
        { id: "u4", categoria: "Ayudante", costoHora: 0 }
      ]
    },
    hombreVestido: [
      { id: "hv1", concepto: "Ropa y EPP", costoAnual: 0, vidaMeses: 12 },
      { id: "hv2", concepto: "Reposición", costoAnual: 0, vidaMeses: 12 },
      { id: "hv3", concepto: "Examen preocupacional", costoAnual: 0, vidaMeses: 12 }
    ],
    gastos: [
      { id: "g1", concepto: "Movilización", tipo: "monto", valor: 0 },
      { id: "g2", concepto: "Campamento", tipo: "monto", valor: 0 },
      { id: "g3", concepto: "Seguros", tipo: "porcentaje", valor: 0 },
      { id: "g4", concepto: "Garantías", tipo: "porcentaje", valor: 0 },
      { id: "g5", concepto: "Impuestos", tipo: "porcentaje", valor: 0 },
      { id: "g6", concepto: "Gastos generales", tipo: "porcentaje", valor: 0 },
      { id: "g7", concepto: "Utilidad", tipo: "porcentaje", valor: 0 }
    ],
    notas: ""
  };
}

export function normalizeTender(tender) {
  return {
    ...createEmptyTender(),
    ...tender,
    fechas: Array.isArray(tender?.fechas) ? tender.fechas : [],
    equipos: Array.isArray(tender?.equipos) ? tender.equipos : [],
    horasContrato1: tender?.horasContrato1 ?? tender?.equipos?.[0]?.horas ?? 180,
    horasContrato2: tender?.horasContrato2 ?? 0,
    usarSegundoContrato: Boolean(tender?.usarSegundoContrato),
    estado: String(tender?.estado || "EN CURSO").toUpperCase() === "CERRADA" ? "CERRADA" : "EN CURSO",
    resultado: ["GANADA", "PERDIDA"].includes(String(tender?.resultado || "").toUpperCase())
      ? String(tender.resultado).toUpperCase()
      : "PENDIENTE",
    planillas: tender?.planillas && typeof tender.planillas === "object" ? tender.planillas : {}
  };
}

export function loadLocalTenders() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LICITACIONES_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) && parsed.length ? parsed.map(normalizeTender) : [createEmptyTender()];
  } catch {
    return [createEmptyTender()];
  }
}

export function AcquisitionCostSelector({ C, value, onChange, averageCost, equipmentOptions = [] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const selected = value === "promedio"
    ? null
    : equipmentOptions.find((eq) => (eq.selectionId || eq.codigo) === value)
      || equipmentOptions.find((eq) => eq.codigo === value);
  const selectedCost = Number(selected?.adquisicion ?? selected?.costo ?? averageCost ?? 0);
  const money = (n) => Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 });
  const selectedTitle = selected ? selected.label : `PROMEDIO DE LA CATEGORÍA — USD ${money(averageCost)}`;

  return (
    <div ref={rootRef} style={{ position: "relative", width: "100%", minWidth: 170 }} title={selectedTitle}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "8px 10px", cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 8, fontWeight: 850 }}
      >
        <span>USD {money(selectedCost)}</span><span style={{ color: C.textMuted }}>▼</span>
      </button>
      {open ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 5px)", zIndex: 80, maxHeight: 280, overflowY: "auto", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: "0 14px 35px rgba(0,0,0,.55)", padding: 5 }}>
          <button type="button" onClick={() => { onChange("promedio"); setOpen(false); }} style={{ width: "100%", textAlign: "left", padding: "9px 10px", border: 0, borderRadius: 6, background: value === "promedio" ? `${C.blue}22` : "transparent", color: C.text, fontWeight: 850, cursor: "pointer" }}>
            PROMEDIO DE LA CATEGORÍA — USD {money(averageCost)}
          </button>
          {equipmentOptions.map((eq) => {
            const optionValue = eq.selectionId || eq.codigo;
            return (
              <button key={optionValue} type="button" onClick={() => { onChange(optionValue); setOpen(false); }} style={{ width: "100%", textAlign: "left", padding: "9px 10px", border: 0, borderRadius: 6, background: value === optionValue ? `${C.blue}22` : "transparent", color: C.text, fontWeight: 800, cursor: "pointer" }}>
                {eq.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
