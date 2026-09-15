const TOOLBAR_CLASS="dm-global-column-filter-toolbar";
const BUTTON_CLASS="dm-global-column-filter-toggle";
const FILTER_ROW_CLASS="dm-global-column-filter-row";
const HIDDEN_ROW_CLASS="dm-global-column-filter-hidden";
const READY_ATTR="data-dm-global-column-filters-ready";
const DISABLE_SELECTOR="[data-dm-disable-global-column-filters='1']";
const STYLE_ID="dm-global-column-filters-style";

const tableState=new WeakMap();
const toolbarOwner=new WeakMap();

function clean(value){
  return String(value??"").replace(/\s+/g," ").trim();
}

function normalized(value){
  return clean(value).toLocaleLowerCase("es-AR").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
}

function visible(el){
  if(!el||!el.isConnected)return false;
  const style=window.getComputedStyle(el);
  if(style.display==="none"||style.visibility==="hidden")return false;
  return el.getClientRects().length>0;
}

function installStyles(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement("style");
  style.id=STYLE_ID;
  style.textContent=`
    .${HIDDEN_ROW_CLASS}{display:none!important}
    .${TOOLBAR_CLASS}{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:7px 8px;border-bottom:1px solid rgba(42,42,42,.4);background:rgba(0,0,0,.12)}
    .${BUTTON_CLASS}{padding:6px 9px;border-radius:7px;border:1px solid #2a2a2a;background:#161616;color:#999;cursor:pointer;font-size:11px;font-family:Inter,Arial,sans-serif}
    .${BUTTON_CLASS}[data-active="1"]{border-color:#3b82f6;background:rgba(59,130,246,.12);color:#3b82f6}
    .${FILTER_ROW_CLASS}>th{background:#161616!important;padding:4px 5px!important;border-bottom:1px solid #2a2a2a!important}
    .${FILTER_ROW_CLASS} input{width:100%;min-width:0;background:rgba(0,0,0,.28);border:1px solid #2a2a2a;border-radius:5px;color:#f0f0f0;padding:4px 6px;font-size:9px;outline:none;font-family:Inter,Arial,sans-serif;text-transform:none;letter-spacing:normal}
    ${DISABLE_SELECTOR} .${TOOLBAR_CLASS},${DISABLE_SELECTOR} .${FILTER_ROW_CLASS}{display:none!important}
  `;
  document.head.appendChild(style);
}

function isColumnFilterButton(button){
  if(!button||button.classList?.contains(BUTTON_CLASS))return false;
  const label=normalized(button.textContent);
  return label==="filtro por columna"||label==="filtros por columna";
}

function hasNativeColumnFilters(table){
  const scrollHost=table.closest?.(".dm-table-scroll")||table.parentElement;
  if(!scrollHost)return false;

  const nativeToolbar=scrollHost.previousElementSibling;
  if(nativeToolbar&&[...nativeToolbar.querySelectorAll?.("button")||[]].some(isColumnFilterButton))return true;

  // Algunas tablas renderizan su control dentro del mismo contenedor de scroll.
  // Detectarlo también evita que el decorador global agregue un segundo botón.
  return [...scrollHost.querySelectorAll?.("button")||[]].some(isColumnFilterButton);
}

function leafHeaderLabels(table){
  const thead=table.tHead;
  if(!thead||!thead.rows.length)return [];
  const rows=[...thead.rows].filter(row=>!row.classList.contains(FILTER_ROW_CLASS));
  const headerRow=[...rows].reverse().find(row=>[...row.cells].some(cell=>cell.tagName==="TH"));
  if(!headerRow)return [];
  const labels=[];
  [...headerRow.cells].forEach((cell,index)=>{
    const span=Math.max(1,Number(cell.colSpan)||1);
    const label=clean(cell.innerText||cell.textContent)||`Columna ${index+1}`;
    for(let i=0;i<span;i++)labels.push(span>1?`${label} ${i+1}`:label);
  });
  return labels;
}

function getState(table){
  let state=tableState.get(table);
  if(!state){
    state={open:false,filters:[],toolbar:null,button:null,row:null};
    tableState.set(table,state);
  }
  return state;
}

function applyFilters(table){
  const state=getState(table);
  const filters=(state.filters||[]).map(normalized);
  const hasFilters=filters.some(Boolean);
  for(const tbody of [...table.tBodies]){
    for(const row of [...tbody.rows]){
      if(!hasFilters){row.classList.remove(HIDDEN_ROW_CLASS);continue;}
      const cells=[...row.cells];
      const matches=filters.every((query,index)=>{
        if(!query)return true;
        return normalized(cells[index]?.innerText||cells[index]?.textContent).includes(query);
      });
      row.classList.toggle(HIDDEN_ROW_CLASS,!matches);
    }
  }
}

function ensureFilterRow(table){
  const state=getState(table);
  if(!state.open)return;
  if(state.row?.isConnected)return;
  const labels=leafHeaderLabels(table);
  if(!labels.length)return;
  const row=document.createElement("tr");
  row.className=FILTER_ROW_CLASS;
  labels.forEach((label,index)=>{
    const th=document.createElement("th");
    const input=document.createElement("input");
    input.type="text";
    input.placeholder="Filtrar...";
    input.title=`Filtrar ${label}`;
    input.setAttribute("aria-label",`Filtrar ${label}`);
    input.value=state.filters[index]||"";
    input.addEventListener("input",()=>{
      state.filters[index]=input.value;
      applyFilters(table);
    });
    input.addEventListener("click",event=>event.stopPropagation());
    th.appendChild(input);
    row.appendChild(th);
  });
  table.tHead.appendChild(row);
  state.row=row;
  applyFilters(table);
}

function setOpen(table,open){
  const state=getState(table);
  state.open=!!open;
  state.button?.setAttribute("data-active",state.open?"1":"0");
  if(state.open){ensureFilterRow(table);return;}
  if(state.row?.isConnected)state.row.remove();
  state.row=null;
  // Igual que la tabla nativa: ocultar la fila de filtros no borra los criterios.
  applyFilters(table);
}

function cleanupTableUi(table,{clearFilters=false}={}){
  if(!(table instanceof HTMLTableElement))return;
  const state=tableState.get(table);
  if(state){
    if(state.toolbar?.isConnected)state.toolbar.remove();
    if(state.row?.isConnected)state.row.remove();
    state.toolbar=null;
    state.button=null;
    state.row=null;
    state.open=false;
    if(clearFilters)state.filters=[];
  }
  [...table.tHead?.querySelectorAll?.(`.${FILTER_ROW_CLASS}`)||[]].forEach(row=>row.remove());
  [...table.tBodies].forEach(tbody=>[...tbody.rows].forEach(row=>row.classList.remove(HIDDEN_ROW_CLASS)));
  table.removeAttribute(READY_ATTR);
}

function cleanupDisabledRegions(){
  document.querySelectorAll(DISABLE_SELECTOR).forEach(root=>{
    root.querySelectorAll(`.${TOOLBAR_CLASS}`).forEach(toolbar=>toolbar.remove());
    root.querySelectorAll("table").forEach(table=>cleanupTableUi(table,{clearFilters:true}));
  });
}

function cleanupOrphanToolbars(){
  const seenOwners=new WeakSet();
  document.querySelectorAll(`.${TOOLBAR_CLASS}`).forEach(toolbar=>{
    const owner=toolbarOwner.get(toolbar);
    if(!owner||!owner.isConnected||owner.closest?.(DISABLE_SELECTOR)||seenOwners.has(owner)){
      toolbar.remove();
      return;
    }
    seenOwners.add(owner);
  });
}

function ensureToolbar(table){
  const state=getState(table);
  if(state.toolbar?.isConnected&&state.button?.isConnected)return;
  const host=table.parentElement;
  if(!host)return;

  // Si React reemplazó la tabla pero dejó el contenedor vivo, eliminar barras
  // globales huérfanas antes de crear la nueva. Esto evita botones duplicados.
  [...host.querySelectorAll(`:scope > .${TOOLBAR_CLASS}`)].forEach(toolbar=>{
    const owner=toolbarOwner.get(toolbar);
    if(!owner||owner===table||!owner.isConnected)toolbar.remove();
  });

  const toolbar=document.createElement("div");
  toolbar.className=TOOLBAR_CLASS;
  toolbar.setAttribute("data-dm-global-column-filter-ui","1");
  const button=document.createElement("button");
  button.type="button";
  button.className=BUTTON_CLASS;
  button.textContent="Filtro por columna";
  button.title="Mostrar u ocultar filtros individuales para cada columna";
  button.setAttribute("data-active",state.open?"1":"0");
  button.addEventListener("click",event=>{
    event.preventDefault();
    event.stopPropagation();
    setOpen(table,!state.open);
  });
  toolbar.appendChild(button);
  host.insertBefore(toolbar,table);
  toolbarOwner.set(toolbar,table);
  state.toolbar=toolbar;
  state.button=button;
}

function eligible(table){
  if(!(table instanceof HTMLTableElement)||!visible(table))return false;
  if(table.closest?.(DISABLE_SELECTOR))return false;
  // Los gráficos de Recharts pueden contener estructuras auxiliares. Nunca se
  // debe inyectar la barra global de filtros dentro de un dashboard/gráfico.
  if(table.closest?.(".recharts-wrapper,.recharts-responsive-container,[class*='recharts-']"))return false;
  if(hasNativeColumnFilters(table))return false;
  return leafHeaderLabels(table).length>0;
}

function decorateTable(table){
  if(!eligible(table)){
    cleanupTableUi(table);
    return;
  }
  table.setAttribute(READY_ATTR,"1");
  ensureToolbar(table);
  ensureFilterRow(table);
  applyFilters(table);
}

function scan(){
  cleanupDisabledRegions();
  cleanupOrphanToolbars();
  [...document.querySelectorAll(".dm-app-content table")].forEach(decorateTable);
}

export function installGlobalTableColumnFilters(){
  if(typeof window==="undefined"||window.__dmGlobalTableColumnFiltersInstalled)return;
  window.__dmGlobalTableColumnFiltersInstalled=true;
  installStyles();
  let raf=0;
  const schedule=()=>{
    if(raf)cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{raf=0;scan();});
  };
  const observer=new MutationObserver(mutations=>{
    // Sólo reaccionar ante cambios estructurales. Los cambios de clase producidos
    // por el propio filtro no deben disparar otro ciclo del observer.
    if(mutations.some(mutation=>mutation.type==="childList"))schedule();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener("click",()=>setTimeout(schedule,0),true);
  window.addEventListener("dm-data-refresh",schedule);
  schedule();
}
