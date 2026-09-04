function cleanRoleFromHeader(){
  if(typeof document==="undefined")return;
  const role=String(window.sessionStorage?.getItem("dm_role")||"").trim();
  if(!role)return;
  const headers=document.querySelectorAll(".dm-app-content > div");
  headers.forEach(header=>{
    const spans=header.querySelectorAll("span");
    spans.forEach(span=>{
      [...span.childNodes].forEach(node=>{
        if(node.nodeType!==Node.TEXT_NODE)return;
        const value=String(node.nodeValue||"");
        if(value.includes(` · ${role} · `))node.nodeValue=value.replace(` · ${role} · `," · ");
      });
    });
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
