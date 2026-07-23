import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

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
const installButton = document.createElement("button");
installButton.type = "button";
installButton.textContent = "Instalar aplicación";
installButton.setAttribute("aria-label", "Instalar Delta Mining OPS en este equipo");
Object.assign(installButton.style, {
  position: "fixed",
  right: "18px",
  bottom: "18px",
  zIndex: "99999",
  display: "none",
  border: "1px solid rgba(255,255,255,.25)",
  borderRadius: "12px",
  padding: "11px 16px",
  background: "#0F243E",
  color: "#FFFFFF",
  fontWeight: "700",
  fontFamily: "inherit",
  cursor: "pointer",
  boxShadow: "0 10px 28px rgba(0,0,0,.28)"
});
document.body.appendChild(installButton);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.style.display = "block";
});

installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.style.display = "none";
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  installButton.style.display = "none";
});
