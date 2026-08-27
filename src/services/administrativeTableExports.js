import * as XLSX from "xlsx";

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

function exportTable(table,index){
  const rows=extractVisibleTable(table);
  if(!rows.length)return;
  const title=tableTitle(table,index);
  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.aoa_to_sheet(rows);
  const width=Math.max(...rows.map(r=>r.length),1);
  ws["!cols"]=Array.from({length:width},(_,c)=>({wch:Math.min(45,Math.max(10,...rows.map(r=>clean(r[c]).length+2)))}));
  XLSX.utils.book_append_sheet(wb,ws,"Datos");
  XLSX.writeFile(wb,`${title||"Tabla"}.xlsx`);
}

function decorateTable(table,index){
  if(!isAdministrative()||table.getAttribute(WRAPPED_ATTR)==="1")return;
  table.setAttribute(WRAPPED_ATTR,"1");
  const host=table.parentElement;
  if(!host)return;
  const button=document.createElement("button");
  button.type="button";
  button.className=BUTTON_CLASS;
  button.textContent="↓ Excel";
  button.title="Descargar exactamente las filas visibles de esta tabla";
  Object.assign(button.style,{display:"block",margin:"6px 8px 6px auto",padding:"6px 10px",borderRadius:"7px",border:"1px solid rgba(34,197,94,.55)",background:"rgba(34,197,94,.12)",color:"#22c55e",fontSize:"10px",fontWeight:"800",fontFamily:"Inter,Arial,sans-serif",cursor:"pointer",position:"relative",zIndex:"12"});
  button.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();exportTable(table,index);});
  host.insertBefore(button,table);
}

function scan(){
  if(!isAdministrative())return;
  [...document.querySelectorAll(".dm-app-content table")].filter(visible).forEach(decorateTable);
}

export function installAdministrativeTableExports(){
  if(typeof window==="undefined"||window.__dmAdminTableExportsInstalled)return;
  window.__dmAdminTableExportsInstalled=true;
  let raf=0;
  const schedule=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(scan);};
  const observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:["style","class"]});
  window.addEventListener("storage",schedule);
  document.addEventListener("click",()=>setTimeout(schedule,0),true);
  schedule();
}
