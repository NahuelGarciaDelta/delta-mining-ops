import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import {C} from "./components/ui/index.jsx";
import {applyAppearance,readLastAppearance} from "./services/userAppearance.js";
import {preloadHistoricalDatasets} from "./services/globalPreload.js";
import {DATA_REFRESH_INTERVAL_MS,dispatchDataRefreshPolicyTick,installLegacyRefreshIntervalPolicy} from "./services/dataRefreshPolicy.js";
import {installAdministrativeTableExports} from "./services/administrativeTableExports.js";
import {installMechanicRoleGuard} from "./services/mechanicRoleGuard.js";
import {installUserHeaderDisplay} from "./services/userHeaderDisplay.js";
import {installWelcomeRefreshButton} from "./services/welcomeRefreshButton.js";

// Una sola política para toda la aplicación: cualquier auto-refresh legacy de
// 5 minutos se normaliza a 10 minutos antes de que React monte sus effects.
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

// Mantiene calientes los históricos comunes (ROP02/ROP05/RMA15) aunque el usuario
// esté trabajando en otra pestaña.
if(typeof window!=="undefined"){
  let lastHistoricalRefresh=Date.now();
  const refreshHistorical=()=>{
    if(document.hidden||navigator.onLine===false)return;
    lastHistoricalRefresh=Date.now();
    dispatchDataRefreshPolicyTick("auto");
    preloadHistoricalDatasets({force:true}).catch(()=>{});
  };
  const id=window.setInterval(refreshHistorical,DATA_REFRESH_INTERVAL_MS);
  const onVisible=()=>{
    if(document.hidden)return;
    if(Date.now()-lastHistoricalRefresh>=DATA_REFRESH_INTERVAL_MS)refreshHistorical();
  };
  const onOnline=()=>refreshHistorical();
  document.addEventListener("visibilitychange",onVisible);
  window.addEventListener("online",onOnline);
  window.addEventListener("beforeunload",()=>{
    window.clearInterval(id);
    document.removeEventListener("visibilitychange",onVisible);
    window.removeEventListener("online",onOnline);
  },{once:true});
}

// PWA: actualización obligatoria del Service Worker y del bundle.
// El objetivo es impedir que una ventana instalada siga ejecutando una versión
// anterior del Dashboard aunque Vercel ya haya desplegado el código nuevo.
if ("serviceWorker" in navigator) {
  let swRegistration=null;
  let controllerReloading=false;
  const reloadKey="dm_sw_controller_v17_dashboard_history";

  navigator.serviceWorker.addEventListener("controllerchange",()=>{
    if(controllerReloading)return;
    controllerReloading=true;
    try{
      if(sessionStorage.getItem(reloadKey)!=="1"){
        sessionStorage.setItem(reloadKey,"1");
        window.location.reload();
        return;
      }
      sessionStorage.removeItem(reloadKey);
    }catch(_){}
  });

  const updateServiceWorker=async()=>{
    try{
      if(swRegistration)await swRegistration.update();
    }catch(_){}
  };

  window.addEventListener("load",async()=>{
    try{
      swRegistration=await navigator.serviceWorker.register(
        "/sw.js?v=20260909-dashboard-history-v17",
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
