const WEAR_FLAG="dm_rma15_subview";
const WEAR_BUTTON_ID="dm-sidebar-desgaste";
const WEAR_ACTIVE_EVENT="dm-open-wear";
const WEAR_CLOSE_EVENT="dm-close-wear";

function text_(node){
  return String(node?.textContent||"").replace(/\s+/g," ").trim();
}

function findMaintenanceButton_(){
  return [...document.querySelectorAll("nav button")].find(button=>
    button.id!==WEAR_BUTTON_ID&&text_(button)==="Mantenimiento"
  )||null;
}

function setLabelColor_(button,color){
  const spans=[...button.querySelectorAll("span")];
  const label=spans.find(span=>text_(span)==="Desgaste"||text_(span)==="Mantenimiento");
  if(label)label.style.color=color;
}

function setWearVisual_(wearButton,maintenanceButton){
  if(!wearButton)return;
  const active=sessionStorage.getItem(WEAR_FLAG)==="desgaste"&&text_(document.querySelector(".dm-app-content h1"))==="Desgaste";

  if(active){
    wearButton.style.background="rgba(239,35,60,.12)";
    wearButton.style.borderLeft="2px solid #ef233c";
    setLabelColor_(wearButton,"#ef233c");
    if(maintenanceButton){
      maintenanceButton.style.background="none";
      maintenanceButton.style.borderLeftColor="rgba(234,179,8,.13)";
      const label=[...maintenanceButton.querySelectorAll("span")].find(span=>text_(span)==="Mantenimiento");
      if(label)label.style.color="";
    }
  }else{
    wearButton.style.background="none";
    wearButton.style.borderLeftColor="rgba(234,179,8,.13)";
    setLabelColor_(wearButton,"");
  }
}

function buildWearButton_(maintenanceButton){
  const button=maintenanceButton.cloneNode(true);
  button.id=WEAR_BUTTON_ID;
  button.type="button";
  button.title="Desgaste";
  button.removeAttribute("aria-current");

  const spans=[...button.querySelectorAll("span")];
  const label=spans.find(span=>text_(span)==="Mantenimiento");
  if(label)label.textContent="Desgaste";

  button.style.background="none";
  button.style.borderLeftColor="rgba(234,179,8,.13)";

  button.addEventListener("click",event=>{
    event.preventDefault();
    event.stopPropagation();

    const realMaintenance=findMaintenanceButton_();
    // Usamos la navegación real ya existente de React para entrar a la vista mant.
    // Después activamos el submodo Desgaste. Si ya estamos en Mantenimiento,
    // el evento custom actualiza la vista sin depender de un remount.
    if(realMaintenance)realMaintenance.click();
    sessionStorage.setItem(WEAR_FLAG,"desgaste");
    window.dispatchEvent(new CustomEvent(WEAR_ACTIVE_EVENT));
    queueMicrotask(()=>setWearVisual_(button,realMaintenance));
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

  // Cualquier navegación React normal abandona Desgaste. Así el flag nunca queda
  // pegado entre módulos, PCs, recargas o al volver a Mantenimiento.
  if(sessionStorage.getItem(WEAR_FLAG)==="desgaste"){
    sessionStorage.removeItem(WEAR_FLAG);
    window.dispatchEvent(new CustomEvent(WEAR_CLOSE_EVENT));
  }
}

export function installGlobalWearSidebarBridge(){
  if(typeof window==="undefined"||typeof document==="undefined")return ()=>{};
  if(window.__dmWearSidebarBridgeInstalled)return ()=>{};
  window.__dmWearSidebarBridgeInstalled=true;

  // No conservar estados defectuosos de la implementación anterior al recargar.
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

if(typeof window!=="undefined"&&typeof document!=="undefined"){
  installGlobalWearSidebarBridge();
}

export { WEAR_FLAG, WEAR_ACTIVE_EVENT, WEAR_CLOSE_EVENT };
