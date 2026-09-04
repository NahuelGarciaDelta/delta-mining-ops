const norm = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/\s+/g, " ")
  .trim()
  .toUpperCase();

const ROLE = "MECANICO";
const MARK = "data-dm-mechanic-hidden";
const NOTICE_MARK = "data-dm-readonly-notice-hidden";
const HOME_ALLOWED = new Set(["INICIO", "CLIMA", "MI PERFIL"]);
const PM_ALLOWED_CHILDREN = new Set(["PLANIFICADOR", "PROGRAMACION", "PANEL DE FLOTA"]);
const ALLOWED_TITLES = new Set([
  "MANTENIMIENTO PROGRAMADO - PLANIFICADOR",
  "MANTENIMIENTO PROGRAMADO - PROGRAMACION",
  "MANTENIMIENTO PROGRAMADO - PANEL DE FLOTA",
]);

function isMechanic() {
  try { return norm(window.sessionStorage.getItem("dm_role")) === ROLE; }
  catch (_) { return false; }
}

function setHidden(element, hidden) {
  if (!element) return;
  if (hidden) {
    if (!element.hasAttribute(MARK)) {
      element.setAttribute(MARK, "1");
      element.dataset.dmMechanicPreviousDisplay = element.style.display || "";
    }
    element.style.setProperty("display", "none", "important");
  } else if (element.hasAttribute(MARK)) {
    const previous = element.dataset.dmMechanicPreviousDisplay || "";
    element.style.removeProperty("display");
    if (previous) element.style.display = previous;
    element.removeAttribute(MARK);
    delete element.dataset.dmMechanicPreviousDisplay;
  }
}

function hideReadOnlyNotices() {
  const root = document.querySelector(".dm-app-content");
  if (!root) return;
  root.querySelectorAll("div").forEach((element) => {
    if (element.hasAttribute(NOTICE_MARK)) return;
    const ownText = [...element.childNodes]
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent || "")
      .join(" ");
    if (!norm(ownText).startsWith("MODO SOLO LECTURA")) return;
    element.setAttribute(NOTICE_MARK, "1");
    element.style.setProperty("display", "none", "important");
  });
}

function restore() {
  document.querySelectorAll(`[${MARK}]`).forEach((element) => setHidden(element, false));
}

function restrictWelcome() {
  const quick = document.querySelector(".dm-home-quick");
  if (quick) [...quick.children].forEach(card => setHidden(card, !norm(card.textContent).startsWith("MANTENIMIENTO")));
  const homeAside = document.querySelector(".dm-home > aside");
  if (homeAside) homeAside.querySelectorAll("button").forEach(button => {
    const label = norm(button.textContent || button.title);
    if (["INICIO", "DASHBOARD", "AGENDA", "CLIMA", "MI PERFIL"].includes(label)) setHidden(button, !HOME_ALLOWED.has(label));
  });
}

function restrictAppSidebar() {
  const nav = document.querySelector(".dm-app-sidebar nav");
  if (!nav) return;
  [...nav.children].forEach(entry => {
    const firstButton = entry.matches?.("button") ? entry : entry.querySelector(":scope > button");
    if (!firstButton) return;
    const label = norm(firstButton.textContent || firstButton.title);
    const keep = label === "BIENVENIDA" || label === "MANTENIMIENTO PROGRAMADO";
    setHidden(entry, !keep);
    if (keep && label === "MANTENIMIENTO PROGRAMADO") entry.querySelectorAll("button").forEach((button, index) => {
      if (index === 0) return;
      setHidden(button, !PM_ALLOWED_CHILDREN.has(norm(button.textContent || button.title)));
    });
  });
}

function clickSidebarButton(label) {
  const wanted = norm(label);
  const button = [...document.querySelectorAll(".dm-app-sidebar nav button")]
    .find(candidate => norm(candidate.textContent || candidate.title) === wanted);
  if (!button || button.disabled) return false;
  button.click();
  return true;
}

function enforceCurrentView() {
  const sidebar = document.querySelector(".dm-app-sidebar");
  if (!sidebar) return;
  const title = norm(document.querySelector(".dm-app-content h1")?.textContent).replace(/—/g, "-");
  if (!title || ALLOWED_TITLES.has(title)) return;
  const maintenanceGroup = [...document.querySelectorAll(".dm-app-sidebar nav button")]
    .find(button => norm(button.textContent || button.title) === "MANTENIMIENTO PROGRAMADO");
  if (maintenanceGroup) {
    const planificador = [...(maintenanceGroup.parentElement?.querySelectorAll("button") || [])]
      .find(button => norm(button.textContent || button.title) === "PLANIFICADOR");
    if (!planificador) maintenanceGroup.click();
  }
  if (clickSidebarButton("Planificador")) return;
  clickSidebarButton("Bienvenida");
}

function applyGuard() {
  hideReadOnlyNotices();
  if (!isMechanic()) { restore(); return; }
  restrictWelcome();
  restrictAppSidebar();
  enforceCurrentView();
}

export function installMechanicRoleGuard() {
  if (typeof window === "undefined" || window.__dmMechanicRoleGuardInstalled) return;
  window.__dmMechanicRoleGuardInstalled = true;
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => { scheduled = false; applyGuard(); });
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("storage", schedule);
  window.addEventListener("dm-user-session-changed", schedule);
  document.addEventListener("click", schedule, true);
  schedule();
}
