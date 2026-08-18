import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// La app tenía el auto-refresh global fijado internamente en 5 minutos.
// Centralizamos el intervalo operativo en 10 minutos sin bloquear la interfaz:
// el caché visible permanece en pantalla y el refresco ocurre en segundo plano.
const nativeSetInterval=window.setInterval.bind(window);
window.setInterval=(handler,delay,...args)=>{
  const requested=Number(delay);
  const effective=requested===5*60*1000?10*60*1000:delay;
  return nativeSetInterval(handler,effective,...args);
};

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


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