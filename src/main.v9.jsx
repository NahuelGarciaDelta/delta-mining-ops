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

// Una pestaña que quedó abierta durante un deploy conserva el mapa de chunks
// anterior. Si Vite no encuentra un módulo con ese hash, carga el HTML nuevo
// una sola vez para alinear la pestaña con los archivos publicados.
const CHUNK_RECOVERY_KEY="dm_v9_chunk_recovery_at";
const CHUNK_RECOVERY_WINDOW_MS=90000;
const CHUNK_ERROR_RE=/failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|loading chunk .* failed|unable to preload css/i;
function chunkErrorText(value){
 if(!value)return"";
 if(typeof value==="string")return value;
 return String(value?.message||value?.reason?.message||value?.reason||value?.payload?.message||value?.payload||value||"");
}
function recoverChunkLoad(value,event){
 if(!CHUNK_ERROR_RE.test(chunkErrorText(value)))return false;
 const now=Date.now();let last=0;
 try{last=Number(sessionStorage.getItem(CHUNK_RECOVERY_KEY)||0)||0;}catch{}
 if(now-last<CHUNK_RECOVERY_WINDOW_MS)return false;
 try{sessionStorage.setItem(CHUNK_RECOVERY_KEY,String(now));}catch{}
 event?.preventDefault?.();
 const url=new URL(window.location.href);url.searchParams.set("_dm_chunk",String(now));
 window.location.replace(url.toString());
 return true;
}

if(typeof window!=="undefined"){
 window.addEventListener("vite:preloadError",event=>recoverChunkLoad(event?.payload||event,event));
 window.addEventListener("unhandledrejection",event=>recoverChunkLoad(event?.reason||event,event));
 window.addEventListener("error",event=>recoverChunkLoad(event?.error||event?.message||event,event),true);
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
