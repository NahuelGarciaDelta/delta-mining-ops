const ALL = new Set(["view", "edit", "approve", "delete", "export"]);
const READ_ONLY = new Set(["view", "export"]);
const EDIT = new Set(["view", "edit", "export"]);
const APPROVE = new Set(["view", "edit", "approve", "export"]);
const NONE = new Set();

function norm(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
}

const AREA_RULES = {
  "OFICINA TECNICA": ALL,
  MANTENIMIENTO: APPROVE,
  ABASTECIMIENTO: APPROVE,
  CALIDAD: EDIT,
  "TALLER CENTRAL": EDIT,
  LICITACIONES: APPROVE,
  ADMINISTRACION: READ_ONLY,
};

export function getCurrentUserIdentity() {
  return {
    role: norm(sessionStorage.getItem("dm_role") || "USUARIO"),
    area: norm(sessionStorage.getItem("dm_area")),
    project: norm(sessionStorage.getItem("dm_project") || "TODO"),
    email: String(sessionStorage.getItem("dm_user") || "").trim().toLowerCase(),
  };
}

export function getPermissionsForArea(targetArea, identity = getCurrentUserIdentity()) {
  const role = norm(identity.role);
  const userArea = norm(identity.area);
  const target = norm(targetArea);
  if (role === "ADMIN" || role === "ADMINISTRADOR") return new Set(ALL);
  if (role === "MECANICO") return target === "MANTENIMIENTO" ? new Set(READ_ONLY) : new Set(NONE);
  if (userArea === "OFICINA TECNICA") return new Set(ALL);
  if (!target) return new Set(READ_ONLY);
  if (userArea !== target) return new Set(READ_ONLY);
  return new Set(AREA_RULES[userArea] || EDIT);
}

export function can(action, targetArea, identity) {
  return getPermissionsForArea(targetArea, identity).has(action);
}

export function getPermissionSnapshot(identity = getCurrentUserIdentity()) {
  const areas = ["OFICINA TÉCNICA", "MANTENIMIENTO", "ABASTECIMIENTO", "CALIDAD", "TALLER CENTRAL", "LICITACIONES"];
  return Object.fromEntries(areas.map((area) => [area, [...getPermissionsForArea(area, identity)]]));
}
