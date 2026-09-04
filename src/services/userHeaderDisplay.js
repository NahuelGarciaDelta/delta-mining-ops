function cleanRoleFromHeader(){
  if(typeof document==="undefined")return;
  const role=String(window.sessionStorage?.getItem("dm_role")||"").trim();
  if(!role)return;

  const root=document.querySelector(".dm-app-content");
  if(!root)return;

  root.querySelectorAll("span").forEach(span=>{
    const value=String(span.textContent||"").replace(/\s+/g," ").trim();
    if(value===`· ${role} ·`||value===role){
      // Mantener el rol visible, pero con una separación clara respecto del nombre/taller.
      span.style.removeProperty("display");
      span.removeAttribute("aria-hidden");
      span.style.setProperty("margin-left","8px");
      span.style.setProperty("margin-right","4px");
    }
  });
}

export function installUserHeaderDisplay(){
  if(typeof window==="undefined"||window.__dmUserHeaderDisplayInstalled)return;
  window.__dmUserHeaderDisplayInstalled=true;
  let queued=false;
  const schedule=()=>{
    if(queued)return;
    queued=true;
    window.requestAnimationFrame(()=>{
      queued=false;
      cleanRoleFromHeader();
    });
  };
  const observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  window.addEventListener("dm-user-session-changed",schedule);
  window.addEventListener("storage",schedule);
  schedule();
}
