import {clearDatasetCache} from "./appCache.js";
import {clearHistoricalQueryMemory} from "../data/historicalDataService.js";
import {preloadHistoricalDatasets} from "./globalPreload.js";
import {dispatchDataRefreshPolicyTick} from "./dataRefreshPolicy.js";

const BUTTON_ID="dm-welcome-refresh-all";
let installed=false;
let refreshing=false;

function isWelcomeVisible(){
  const home=document.querySelector(".dm-home");
  if(!home)return false;
  const style=window.getComputedStyle(home);
  return style.display!=="none"&&style.visibility!=="hidden";
}

async function refreshAll(button){
  if(refreshing)return;
  refreshing=true;
  const original=button.innerHTML;
  button.disabled=true;
  button.innerHTML="↻ Actualizando...";
  try{
    clearHistoricalQueryMemory();
    await clearDatasetCache().catch(()=>{});
    dispatchDataRefreshPolicyTick("manual-global");
    await preloadHistoricalDatasets({force:true}).catch(()=>{});
  }finally{
    button.innerHTML=original;
    button.disabled=false;
    refreshing=false;
    window.location.reload();
  }
}

function ensureButton(){
  const existing=document.getElementById(BUTTON_ID);
  if(!isWelcomeVisible()){
    existing?.remove();
    return;
  }
  if(existing)return;

  const button=document.createElement("button");
  button.id=BUTTON_ID;
  button.type="button";
  button.innerHTML="↻ Actualizar";
  button.title="Actualizar todos los datos de la aplicación";
  Object.assign(button.style,{
    position:"fixed",
    top:"16px",
    left:"18px",
    zIndex:"2147483000",
    padding:"8px 13px",
    borderRadius:"9px",
    border:"1px solid rgba(239,35,60,.55)",
    background:"rgba(22,22,22,.88)",
    color:"#ef233c",
    fontFamily:"Inter,Arial,sans-serif",
    fontSize:"12px",
    fontWeight:"800",
    cursor:"pointer",
    boxShadow:"0 8px 24px rgba(0,0,0,.28)",
    backdropFilter:"blur(8px)",
    webkitBackdropFilter:"blur(8px)"
  });
  button.addEventListener("click",()=>refreshAll(button));
  document.body.appendChild(button);
}

export function installWelcomeRefreshButton(){
  if(typeof window==="undefined"||installed)return;
  installed=true;
  let queued=false;
  const schedule=()=>{
    if(queued)return;
    queued=true;
    window.requestAnimationFrame(()=>{queued=false;ensureButton();});
  };
  const observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:["class","style"]});
  window.addEventListener("popstate",schedule);
  window.addEventListener("hashchange",schedule);
  schedule();
}
