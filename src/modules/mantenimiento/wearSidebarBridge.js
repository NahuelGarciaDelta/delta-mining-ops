const WEAR_FLAG="dm_rma15_subview";
const WEAR_BUTTON_ID="dm-sidebar-desgaste";
const WEAR_ACTIVE_EVENT="dm-open-wear";
const WEAR_CLOSE_EVENT="dm-close-wear";
const SIDEBAR_IDLE_COLOR="#a3a3a3";
const SIDEBAR_ACTIVE_COLOR="#ef233c";

function text_(node){return String(node?.textContent||"").replace(/\s+/g," ").trim();}
function findMaintenanceButton_(){return [...document.querySelectorAll("nav button")].find(button=>button.id!==WEAR_BUTTON_ID&&text_(button)==="Mantenimiento")||null;}
function label_(button){return [...(button?.querySelectorAll?.("span")||[])].find(span=>text_(span)==="Desgaste"||text_(span)==="Mantenimiento")||null;}
function setLabelColor_(button,color){const label=label_(button);if(label)label.style.color=color;}

function syncBaseTypography_(wearButton,maintenanceButton){
  if(!wearButton||!maintenanceButton)return;
  const sourceLabel=label_(maintenanceButton),wearLabel=label_(wearButton);
  if(sourceLabel&&wearLabel){
    const css=getComputedStyle(sourceLabel);
    wearLabel.style.fontFamily=css.fontFamily;
    wearLabel.style.fontSize=css.fontSize;
    wearLabel.style.fontWeight=css.fontWeight;
    wearLabel.style.lineHeight=css.lineHeight;
    wearLabel.style.letterSpacing=css.letterSpacing;
  }
}

function resetMaintenanceVisual_(maintenanceButton){
  if(!maintenanceButton)return;
  maintenanceButton.style.background="none";
  maintenanceButton.style.borderLeftColor="rgba(234,179,8,.13)";
  maintenanceButton.style.color=SIDEBAR_IDLE_COLOR;
  setLabelColor_(maintenanceButton,SIDEBAR_IDLE_COLOR);
}

function setWearVisual_(wearButton,maintenanceButton){
  if(!wearButton)return;
  syncBaseTypography_(wearButton,maintenanceButton);
  const active=sessionStorage.getItem(WEAR_FLAG)==="desgaste"&&text_(document.querySelector(".dm-app-content h1"))==="Desgaste";

  if(active){
    wearButton.style.background="rgba(239,35,60,.12)";
    wearButton.style.borderLeft="2px solid #ef233c";
    wearButton.style.color=SIDEBAR_ACTIVE_COLOR;
    setLabelColor_(wearButton,SIDEBAR_ACTIVE_COLOR);
    resetMaintenanceVisual_(maintenanceButton);
  }else{
    wearButton.style.background="none";
    wearButton.style.borderLeftColor="rgba(234,179,8,.13)";
    wearButton.style.color=SIDEBAR_IDLE_COLOR;
    setLabelColor_(wearButton,SIDEBAR_IDLE_COLOR);
  }
}

function buildWearButton_(maintenanceButton){
  const button=maintenanceButton.cloneNode(true);
  button.id=WEAR_BUTTON_ID;
  button.type="button";
  button.title="Desgaste";
  button.removeAttribute("aria-current");
  const label=[...button.querySelectorAll("span")].find(span=>text_(span)==="Mantenimiento");
  if(label)label.textContent="Desgaste";
  button.style.background="none";
  button.style.borderLeftColor="rgba(234,179,8,.13)";
  button.style.color=SIDEBAR_IDLE_COLOR;
  setLabelColor_(button,SIDEBAR_IDLE_COLOR);
  syncBaseTypography_(button,maintenanceButton);

  button.addEventListener("click",event=>{
    event.preventDefault();
    event.stopPropagation();
    const realMaintenance=findMaintenanceButton_();
    if(realMaintenance)realMaintenance.click();
    sessionStorage.setItem(WEAR_FLAG,"desgaste");
    window.dispatchEvent(new CustomEvent(WEAR_ACTIVE_EVENT));
    requestAnimationFrame(()=>setWearVisual_(button,realMaintenance));
  });
  return button;
}

function install_(){
  const maintenanceButton=findMaintenanceButton_();
  if(!maintenanceButton)return;
  let wearButton=document.getElementById(WEAR_BUTTON_ID);
  if(!wearButton||wearButton.parentNode!==maintenanceButton.parentNode){
    wearButton?.remove();
    wearButton=buildWearButton_(maintenanceButton);
    maintenanceButton.parentNode.insertBefore(wearButton,maintenanceButton.nextSibling);
  }
  setWearVisual_(wearButton,maintenanceButton);
}

function handleNavClick_(event){
  const button=event.target?.closest?.("nav button");
  if(!button||button.id===WEAR_BUTTON_ID)return;
  if(sessionStorage.getItem(WEAR_FLAG)==="desgaste"){
    sessionStorage.removeItem(WEAR_FLAG);
    window.dispatchEvent(new CustomEvent(WEAR_CLOSE_EVENT));
  }
}

export function installGlobalWearSidebarBridge(){
  if(typeof window==="undefined"||typeof document==="undefined")return()=>{};
  if(window.__dmWearSidebarBridgeInstalled)return()=>{};
  window.__dmWearSidebarBridgeInstalled=true;
  sessionStorage.removeItem(WEAR_FLAG);
  install_();
  const observer=new MutationObserver(()=>install_());
  observer.observe(document.body,{childList:true,subtree:true});
  document.addEventListener("click",handleNavClick_,true);
  return()=>{
    observer.disconnect();
    document.removeEventListener("click",handleNavClick_,true);
    document.getElementById(WEAR_BUTTON_ID)?.remove();
    window.__dmWearSidebarBridgeInstalled=false;
  };
}

if(typeof window!=="undefined"&&typeof document!=="undefined")installGlobalWearSidebarBridge();
export{WEAR_FLAG,WEAR_ACTIVE_EVENT,WEAR_CLOSE_EVENT};
