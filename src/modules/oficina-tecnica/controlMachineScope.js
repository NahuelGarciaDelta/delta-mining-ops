// Configuración persistente del control cruzado ROP02 ↔ ROP05.
// Los filtros de alcance aplican a AMBOS conjuntos antes del cruce.
export function controlMachineCode(value, canonicalize = (x) => x) {
  const raw = String(value ?? "").trim();
  return raw ? String(canonicalize(raw) || raw).trim().toUpperCase() : "";
}

export function availableControlMachines(rop02Rows = [], rop05Rows = [], canonicalize) {
  const codes = new Set();
  for (const row of [...(rop02Rows || []), ...(rop05Rows || [])]) {
    const code = controlMachineCode(row?.maquina ?? row?._internoRaw, canonicalize);
    if (code) codes.add(code);
  }
  return [...codes].sort((a, b) => a.localeCompare(b, "es"));
}

// "todos": sin restricción; []: ningún equipo. Igual contrato que MultiSel.
export function filterControlMachines(rows = [], selection = "todos", canonicalize) {
  const safe = Array.isArray(rows) ? rows : [];
  if (selection == null || selection === "todos") return safe;
  const choices = Array.isArray(selection) ? selection : [selection];
  const allowed = new Set(choices.map(value => controlMachineCode(value, canonicalize)).filter(Boolean));
  if (!allowed.size) return [];
  return safe.filter(row => allowed.has(controlMachineCode(row?.maquina ?? row?._internoRaw, canonicalize)));
}

export function noControlMachinesSelected(selection) {
  return Array.isArray(selection) && selection.length === 0;
}

// Compartido por la tabla y el badge lateral para evitar conteos diferentes.
// Los dos conjuntos ya vienen filtrados por proyecto, equipo, fecha y tipo.
// La comparación NUNCA utiliza supervisor para decidir si existe contraparte.
export function calculateControlIssueRows(rows02 = [], rows05 = [], supervisor = "todos", deps = {}) {
  const { normDate, machineLookupVariants, cleanMachine, matchMulti, multiIsAll } = deps;
  if (![normDate, machineLookupVariants, cleanMachine, matchMulti, multiIsAll].every(fn => typeof fn === "function")) {
    throw new Error("Dependencias incompletas para cálculo de control ROP02 ↔ ROP05");
  }
  const keys = row => {
    const date = normDate(row?.fecha);
    if (!date) return [];
    const variants = [...machineLookupVariants(row?.maquina || "")];
    if (!variants.length) {
      const fallback = cleanMachine(row?.maquina || "");
      if (fallback) variants.push(fallback);
    }
    return variants.map(code => `${date}__${String(code || "").trim().toUpperCase()}`);
  };
  const keySet = list => new Set(list.flatMap(keys));
  const set02 = keySet(rows02), set05 = keySet(rows05);
  let faltanEn05 = rows02.filter(row => !keys(row).some(k => set05.has(k)));
  let faltanEn02 = rows05.filter(row => !keys(row).some(k => set02.has(k)));
  if (!multiIsAll(supervisor, "todos")) {
    faltanEn05 = faltanEn05.filter(row => matchMulti(row.supervisor, supervisor, "todos"));
    faltanEn02 = faltanEn02.filter(row => matchMulti(row.supervisor, supervisor, "todos"));
  }
  return { faltanEn05, faltanEn02, problemas: faltanEn05.length + faltanEn02.length };
}
