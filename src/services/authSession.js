import { applyAppearance, readLocalAppearance } from "./userAppearance.js";

export const AUTHENTICATED_USER_KEY = "dm_authenticated_user";

let appearanceColors = null;

function applyCurrentUserAppearance_(email=""){
  try{applyAppearance(readLocalAppearance(email||sessionStorage.getItem("dm_user")||""),appearanceColors);}catch(_){}
}

if(typeof window!=="undefined"){
  // Mantener authSession importable desde Node/tests sin arrastrar el entrypoint JSX
  // de UI. En navegador cargamos la paleta de forma diferida y reaplicamos la
  // apariencia cuando queda disponible.
  import("../components/ui/index.jsx")
    .then(module=>{
      appearanceColors=module?.C||null;
      applyCurrentUserAppearance_();
    })
    .catch(()=>{});
  applyCurrentUserAppearance_();
  window.addEventListener("dm-appearance-saved",event=>{
    try{applyAppearance(event?.detail||readLocalAppearance(sessionStorage.getItem("dm_user")||""),appearanceColors);}catch(_){}
  });
}

export function buildAuthenticatedUser(response, fallbackEmail = "") {
  const authToken = response?.authToken || response?.token || response?.user?.authToken || response?.user?.token || "";
  return {
    ...(response?.user || {}),
    email: response?.user?.email || fallbackEmail,
    authToken,
    token: authToken,
  };
}

export function getAuthenticatedUser() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(AUTHENTICATED_USER_KEY) || "null");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function saveAuthenticatedSession(user, { mustChangePassword = false, normalizeProject = value => value || "TODO" } = {}) {
  const authenticatedUser = { ...user };
  const email = String(authenticatedUser.email || "").trim().toLowerCase();
  const authToken = String(authenticatedUser.authToken || authenticatedUser.token || "");
  authenticatedUser.email = email;
  authenticatedUser.authToken = authToken;
  authenticatedUser.token = authToken;
  sessionStorage.setItem(AUTHENTICATED_USER_KEY, JSON.stringify(authenticatedUser));
  sessionStorage.setItem("dm_auth", "1");
  sessionStorage.setItem("dm_user", email);
  sessionStorage.setItem("dm_role", String(authenticatedUser.rol || authenticatedUser.role || "USUARIO").toUpperCase());
  sessionStorage.setItem("dm_project", normalizeProject(authenticatedUser.proyecto || authenticatedUser.project || "TODO"));
  sessionStorage.setItem("dm_name", authenticatedUser.nombre || authenticatedUser.name || email.split("@")[0]?.split(/[._-]+/)[0] || "Usuario");
  sessionStorage.setItem("dm_area", authenticatedUser.area || "");
  sessionStorage.setItem("dm_must_change_password", mustChangePassword ? "1" : "0");
  sessionStorage.setItem("dm_auth_token", authToken);
  applyCurrentUserAppearance_(email);
  return authenticatedUser;
}

export function updateAuthenticatedUser(patch) {
  const current = getAuthenticatedUser();
  if (!current) return null;
  const next = { ...current, ...patch };
  sessionStorage.setItem(AUTHENTICATED_USER_KEY, JSON.stringify(next));
  return next;
}

export function clearAuthenticatedSession() {
  ["dm_auth","dm_user","dm_role","dm_project","dm_name","dm_area","dm_must_change_password","dm_auth_token",AUTHENTICATED_USER_KEY]
    .forEach(key => sessionStorage.removeItem(key));
}
