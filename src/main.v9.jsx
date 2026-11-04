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
import {clearAuthenticatedSession} from "./services/authSession.js";
import {currentSession,refreshV9} from "./standalone/session.js";

if(typeof window!=="undefined"){
 // Add the V9 bearer token only to this same-origin, action-allowlisted relay.
 // Existing modules can keep their form-urlencoded write contracts.
 const nativeFetch=window.fetch.bind(window);
 window.fetch=async(input,init={})=>{
  let path="";
  try{
   const raw=typeof input==="string"?input:input?.url;
   path=new URL(raw,window.location.href).pathname;
  }catch{}
  if(path!=="/api/v9-write")return nativeFetch(input,init);
  const headers=new Headers(input instanceof Request?input.headers:undefined);
  new Headers(init?.headers||undefined).forEach((value,key)=>headers.set(key,value));
  if(!headers.has("Authorization")){
   let session=currentSession();
   if(session?.refresh_token&&Number(session.expires_at||0)*1000<Date.now()+60000){
    try{session=await refreshV9(session);}catch{}
   }
   if(session?.access_token)headers.set("Authorization","Bearer "+session.access_token);
  }
  return nativeFetch(input,{...init,headers});
 };
 // Do not render Delta OPS as signed in if only the old UI session survived.
 // Authentication must come from this sandbox's Supabase project.
 if(sessionStorage.getItem("dm_auth")==="1"&&!currentSession())clearAuthenticatedSession();
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
