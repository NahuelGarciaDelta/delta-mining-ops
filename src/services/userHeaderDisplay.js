let headerObserver=null;
let bootstrapObserver=null;
let queued=false;

function headerRoot(){return document.querySelector(".dm-app-content > div:first-child");}

function cleanRoleFromHeader(){
  if(typeof document==="undefined")return false;
  const role=String(window.sessionStorage?.getItem("dm_role")||"").trim();
  if(!role)return false;
  const root=headerRoot();
  if(!root)return false;
  root.querySelectorAll("span").forEach(span=>{
    const value=String(span.textContent||"").replace(/\s+/g," ").trim();
    if(value===`· ${role} ·`||value===role){
      span.style.removeProperty("display");
      span.removeAttribute("aria-hidden");
      span.style.setProperty("margin-left","8px");
      span.style.setProperty("margin-right","4px");
    }
  });
  return true;
}

function schedule(){
  if(queued)return;
  queued=true;
  window.requestAnimationFrame(()=>{queued=false;cleanRoleFromHeader();});
}

function attachHeaderObserver(){
  const root=headerRoot();
  if(!root)return false;
  bootstrapObserver?.disconnect();bootstrapObserver=null;
  headerObserver?.disconnect();
  headerObserver=new MutationObserver(schedule);
  headerObserver.observe(root,{childList:true,subtree:true,characterData:true});
  schedule();
  return true;
}

export function installUserHeaderDisplay(){
  if(typeof window==="undefined"||window.__dmUserHeaderDisplayInstalled)return;
  window.__dmUserHeaderDisplayInstalled=true;
  if(!attachHeaderObserver()){
    bootstrapObserver=new MutationObserver(()=>{if(attachHeaderObserver())bootstrapObserver=null;});
    bootstrapObserver.observe(document.documentElement,{childList:true,subtree:true});
  }
  const refresh=()=>{if(!attachHeaderObserver())schedule();};
  window.addEventListener("dm-user-session-changed",refresh);
  window.addEventListener("storage",refresh);
}
