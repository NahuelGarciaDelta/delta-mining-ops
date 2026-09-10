import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import {C} from "./components/ui/index.jsx";
import {applyAppearance,readLastAppearance} from "./services/userAppearance.js";
import {DATA_REFRESH_INTERVAL_MS,dispatchDataRefreshPolicyTick,installLegacyRefreshIntervalPolicy} from "./services/dataRefreshPolicy.js";
import {installAdministrativeTableExports} from "./services/administrativeTableExports.js";
import {installMechanicRoleGuard} from "./services/mechanicRoleGuard.js";
import {installUserHeaderDisplay} from "./services/userHeaderDisplay.js";
import {installWelcomeRefreshButton} from "./services/welcomeRefreshButton.js";

// Una sola política para toda la aplicación: cache inmediato + revalidación cada 5 minutos.
installLegacyRefreshIntervalPolicy();

// La apariencia elegida por el último usuario se aplica ANTES de montar React.
if(typeof window!=="undefined"){
  applyAppearance(readLastAppearance(),C);
  window.addEventListener("dm-appearance-saved",event=>{
    applyAppearance(event?.detail||readLastAppearance(),C);
  });
  installAdministrativeTableExports();
  installMechanicRoleGuard();
  installUserHeaderDisplay();
  installWelcomeRefreshButton();
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Solo dispara la política de actualización. Ya NO vuelve a descargar por la fuerza
// ROP02 + ROP05 + RMA15 completos cada 5 minutos: esa precarga competía con la vista
// activa, multiplicaba tráfico y era una de las causas de la lentitud general.
if(typeof window!=="undefined"){
  let lastRefresh=Date.now();
  const refreshPolicy=()=>{
    if(document.hidden||navigator.onLine===false)return;
    lastRefresh=Date.now();
    dispatchDataRefreshPolicyTick("auto");
  };
  const id=window.setInterval(refreshPolicy,DATA_REFRESH_INTERVAL_MS);
  const onVisible=()=>{
    if(document.hidden)return;
    if(Date.now()-lastRefresh>=DATA_REFRESH_INTERVAL_MS)refreshPolicy();
  };
  const onOnline=()=>refreshPolicy();
  document.addEventListener("visibilitychange",onVisible);
  window.addEventListener("online",onOnline);
  window.addEventListener("beforeunload",()=>{
    window.clearInterval(id);
    document.removeEventListener("visibilitychange",onVisible);
    window.removeEventListener("online",onOnline);
  },{once:true});
}

// PWA: actualización obligatoria del Service Worker y del bundle.
// Cuando un SW nuevo toma control, esta página se recarga exactamente una vez.
if ("serviceWorker" in navigator) {
  let swRegistration=null;
  let controllerReloading=false;

  navigator.serviceWorker.addEventListener("controllerchange",()=>{
    if(controllerReloading)return;
    controllerReloading=true;
    window.location.reload();
  });

  const updateServiceWorker=async()=>{
    try{
      if(swRegistration)await swRegistration.update();
    }catch(_){}
  };

  window.addEventListener("load",async()=>{
    try{
      swRegistration=await navigator.serviceWorker.register(
        "/sw.js?v=20260909-api-network-only-v22",
        {updateViaCache:"none"}
      );
      await swRegistration.update();
      if(swRegistration.waiting){
        swRegistration.waiting.postMessage({type:"SKIP_WAITING"});
      }
    }catch(error){
      console.error("No se pudo registrar/actualizar el Service Worker:",error);
    }
  });

  document.addEventListener("visibilitychange",()=>{
    if(!document.hidden)updateServiceWorker();
  });
  window.addEventListener("online",updateServiceWorker);
}

let deferredInstallPrompt = null;
window.dmPwaInstallAvailable = false;
window.dmInstallPWA = async () => {
  if (!deferredInstallPrompt) return false;
  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  window.dmPwaInstallAvailable = false;
  window.dispatchEvent(new Event("dm-pwa-install-unavailable"));
  return choice?.outcome === "accepted";
};

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  window.dmPwaInstallAvailable = true;
  window.dispatchEvent(new Event("dm-pwa-install-available"));
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  window.dmPwaInstallAvailable = false;
  window.dispatchEvent(new Event("dm-pwa-install-unavailable"));
});
