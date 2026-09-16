const BUTTON_CLASS="dm-admin-table-export";
const WRAPPED_ATTR="data-dm-admin-export-ready";

function isAdministrative(){
  return String(window.sessionStorage.getItem("dm_role")||"").trim().toUpperCase()==="ADMINISTRATIVO";
}
function visible(el){
  if(!el||!el.isConnected)return false;
  const style=window.getComputedStyle(el);
  if(style.display==="none"||style.visibility==="hidden")return false;
  return el.getClientRects().length>0;
}
function clean(value){return String(value??"").replace(/\s+/g," ").trim();}
function tableTitle(table,index){
  let node=table.parentElement;
  for(let depth=0;node&&depth<5;depth++,node=node.parentElement){
    const heading=[...node.querySelectorAll(":scope > h1,:scope > h2,:scope > h3,:scope > h4,:scope > div")]
      .find(el=>el!==table&&visible(el)&&clean(el.textContent).length>0&&clean(el.textContent).length<90);
    if(heading)return clean(heading.textContent).replace(/[\\/:*?"<>|]/g," ").slice(0,55);
  }
  return `Tabla_${index+1}`;
}
function extractVisibleTable(table){
  const rows=[];
  const trList=[...table.querySelectorAll("tr")].filter(visible);
  for(const tr of trList){
    const cells=[...tr.children].filter(cell=>(cell.tagName==="TH"||cell.tagName==="TD")&&visible(cell));
    if(cells.length)rows.push(cells.map(cell=>clean(cell.innerText||cell.textContent)));
  }
  return rows;
}
async function exportTable(table,index){
  const rows=extractVisibleTable(table);if(!rows.length)return;
  const XLSX=await import("xlsx");
  const title=tableTitle(table,index),wb=XLSX.utils.book_new(),ws=XLSX.utils.aoa_to_sheet(rows);
  const width=Math.max(...rows.map(r=>r.length),1);
  ws["!cols"]=Array.from({length:width},(_,c)=>({wch:Math.min(45,Math.max(10,...rows.map(r=>clean(r[c]).length+2)))}));
  XLSX.utils.book_append_sheet(wb,ws,"Datos");XLSX.writeFile(wb,`${title||"Tabla"}.xlsx`);
}
function decorateTable(table,index=0){
  if(!isAdministrative()||!(table instanceof HTMLTableElement)||!table.closest?.(".dm-app-content")||!visible(table)||table.getAttribute(WRAPPED_ATTR)==="1")return;
  table.setAttribute(WRAPPED_ATTR,"1");
  const host=table.parentElement;if(!host)return;
  const button=document.createElement("button");button.type="button";button.className=BUTTON_CLASS;button.textContent="↓ Excel";button.title="Descargar exactamente las filas visibles de esta tabla";
  Object.assign(button.style,{display:"block",margin:"6px 8px 6px auto",padding:"6px 10px",borderRadius:"7px",border:"1px solid rgba(34,197,94,.55)",background:"rgba(34,197,94,.12)",color:"#22c55e",fontSize:"10px",fontWeight:"800",fontFamily:"Inter,Arial,sans-serif",cursor:"pointer",position:"relative",zIndex:"12"});
  button.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();exportTable(table,index).catch(error=>console.warn("No se pudo exportar la tabla",error));});
  host.insertBefore(button,table);
}
function processNode(node){
  if(!isAdministrative()||!(node instanceof Element))return;
  const owner=node.closest?.("table");if(owner)decorateTable(owner,0);
  if(node.matches?.("table"))decorateTable(node,0);
  node.querySelectorAll?.("table").forEach((table,index)=>decorateTable(table,index));
}
function fullScan(){
  if(!isAdministrative())return;
  document.querySelectorAll(".dm-app-content table").forEach((table,index)=>decorateTable(table,index));
}
export function installAdministrativeTableExports(){
  if(typeof window==="undefined"||window.__dmAdminTableExportsInstalled)return;
  window.__dmAdminTableExportsInstalled=true;
  let raf=0;const pending=new Set();
  const flush=()=>{raf=0;const nodes=[...pending];pending.clear();nodes.forEach(processNode);};
  const schedule=node=>{if(node instanceof Element)pending.add(node);if(!raf)raf=requestAnimationFrame(flush);};
  const observer=new MutationObserver(mutations=>mutations.forEach(mutation=>{
    if(mutation.type!=="childList")return;
    mutation.addedNodes.forEach(node=>{if(node instanceof Element)schedule(node);});
  }));
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener("storage",()=>requestAnimationFrame(fullScan));
  window.addEventListener("dm-user-session-changed",()=>requestAnimationFrame(fullScan));
  requestAnimationFrame(fullScan);
}
