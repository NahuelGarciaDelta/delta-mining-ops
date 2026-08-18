import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import {preloadHistoricalDatasets} from "./services/globalPreload.js";
import {DATA_REFRESH_INTERVAL_MS,dispatchDataRefreshPolicyTick,installLegacyRefreshIntervalPolicy} from "./services/dataRefreshPolicy.js";

// Una sola política para toda la aplicación: cualquier auto-refresh legacy de
// 5 minutos se normaliza a 10 minutos antes de que React monte sus effects.
installLegacyRefreshIntervalPolicy();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Mantiene calientes los históricos comunes (ROP02/ROP05/RMA15) aunque el usuario
// esté trabajando en otra pestaña. Siempre conserva el cache visible y actualiza
// la copia persistida en segundo plano.
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

// Registro PWA e instalación en el escritorio.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("No se pudo registrar el Service Worker:", error);
    });
  });
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
