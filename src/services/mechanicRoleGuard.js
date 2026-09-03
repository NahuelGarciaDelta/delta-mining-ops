const norm = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/\s+/g, " ")
  .trim()
  .toUpperCase();

const ROLE = "MECANICO";
const MARK = "data-dm-mechanic-hidden";
const HOME_ALLOWED = new Set(["INICIO", "CLIMA", "MI PERFIL"]);
const PM_ALLOWED_CHILDREN = new Set(["PLANIFICADOR", "PROGRAMACION", "PANEL DE FLOTA"]);
const ALLOWED_TITLES = new Set([
  "MANTENIMIENTO PROGRAMADO - PLANIFICADOR",
  "MANTENIMIENTO PROGRAMADO - PROGRAMACION",
  "MANTENIMIENTO PROGRAMADO - PANEL DE FLOTA",
]);

function isMechanic() {
  try {
    return norm(window.sessionStorage.getItem("dm_role")) === ROLE;
  } catch (_) {
    return false;
  }
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

function restore() {
  document.querySelectorAll(`[${MARK}]`).forEach((element) => setHidden(element, false));
}

function restrictWelcome() {
  const quick = document.querySelector(".dm-home-quick");
  if (quick) {
    [...quick.children].forEach((card) => {
      const text = norm(card.textContent);
      setHidden(card, !text.startsWith("MANTENIMIENTO"));
    });
  }

  const homeAside = document.querySelector(".dm-home > aside");
  if (homeAside) {
    const navButtons = homeAside.querySelectorAll("button");
    navButtons.forEach((button) => {
      const label = norm(button.textContent || button.title);
      if (!label) return;
      const isNavigation = ["INICIO", "DASHBOARD", "AGENDA", "CLIMA", "MI PERFIL"].includes(label);
      if (isNavigation) setHidden(button, !HOME_ALLOWED.has(label));
    });
  }
}

function restrictAppSidebar() {
  const nav = document.querySelector(".dm-app-sidebar nav");
  if (!nav) return;

  [...nav.children].forEach((entry) => {
    const firstButton = entry.matches?.("button") ? entry : entry.querySelector(":scope > button");
    if (!firstButton) return;
    const label = norm(firstButton.textContent || firstButton.title);
    const keep = label === "BIENVENIDA" || label === "MANTENIMIENTO PROGRAMADO";
    setHidden(entry, !keep);

    if (keep && label === "MANTENIMIENTO PROGRAMADO") {
      entry.querySelectorAll("button").forEach((button, index) => {
        if (index === 0) return;
        const childLabel = norm(button.textContent || button.title);
        setHidden(button, !PM_ALLOWED_CHILDREN.has(childLabel));
      });
    }
  });
}

function clickSidebarButton(label) {
  const wanted = norm(label);
  const buttons = [...document.querySelectorAll(".dm-app-sidebar nav button")];
  const button = buttons.find((candidate) => norm(candidate.textContent || candidate.title) === wanted);
  if (!button || button.disabled) return false;
  button.click();
  return true;
}

function enforceCurrentView() {
  const sidebar = document.querySelector(".dm-app-sidebar");
  if (!sidebar) return;
  const title = norm(document.querySelector(".dm-app-content h1")?.textContent).replace(/—/g, "-");
  if (!title || ALLOWED_TITLES.has(title)) return;

  // Al entrar al módulo Mantenimiento desde Bienvenida, deriva directamente
  // a Planificador. Si el usuario llegó a cualquier otro módulo, vuelve a Inicio.
  if (clickSidebarButton("Planificador")) return;
  clickSidebarButton("Bienvenida");
}

function applyGuard() {
  if (!isMechanic()) {
    restore();
    return;
  }
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
    window.requestAnimationFrame(() => {
      scheduled = false;
      applyGuard();
    });
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("storage", schedule);
  window.addEventListener("dm-user-session-changed", schedule);
  document.addEventListener("click", schedule, true);
  schedule();
}
