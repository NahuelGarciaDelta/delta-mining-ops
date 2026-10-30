// Mismo frontend y módulos de Delta OPS productivo.
// La separación de backend se hace únicamente en vite.v9.config.js (build V9).
import React from "react";
import {createRoot} from "react-dom/client";
import App from "./App.jsx";
import {C} from "./components/ui/index.jsx";
import {applyAppearance,readLastAppearance} from "./services/userAppearance.js";
import {installGlobalTableColumnFilters} from "./services/globalTableColumnFilters.js";
import {installAdministrativeTableExports} from "./services/administrativeTableExports.js";
import {installMechanicRoleGuard} from "./services/mechanicRoleGuard.js";
import {installUserHeaderDisplay} from "./services/userHeaderDisplay.js";
import {installWelcomeRefreshButton} from "./services/welcomeRefreshButton.js";
import {installLegacyRefreshIntervalPolicy} from "./services/dataRefreshPolicy.js";

if(typeof window!=="undefined"){
 window.__DELTA_OPS_V9_INDEPENDENT__=true;
 applyAppearance(readLastAppearance(),C);
 window.addEventListener("dm-appearance-saved",e=>{applyAppearance(e?.detail||readLastAppearance(),C)});
 installLegacyRefreshIntervalPolicy();
 installAdministrativeTableExports();
 installGlobalTableColumnFilters();
 installMechanicRoleGuard();
 installUserHeaderDisplay();
 installWelcomeRefreshButton();
}
createRoot(document.getElementById("root")).render(
 <React.StrictMode><App/></React.StrictMode>
);
// No se instala el service-worker de V8.1 y no se inicializan fuentes antiguas.
