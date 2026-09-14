const TOOLBAR_CLASS="dm-global-column-filter-toolbar";
const BUTTON_CLASS="dm-global-column-filter-toggle";
const FILTER_ROW_CLASS="dm-global-column-filter-row";
const HIDDEN_ROW_CLASS="dm-global-column-filter-hidden";
const READY_ATTR="data-dm-global-column-filters-ready";
const STYLE_ID="dm-global-column-filters-style";

const tableState=new WeakMap();

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
  `;
  document.head.appendChild(style);
}

function hasNativeColumnFilters(table){
  const scrollHost=table.closest?.(".dm-table-scroll")||table.parentElement;
  // La tabla compartida de la app renderiza su barra inmediatamente antes del
  // contenedor de scroll. Miramos sólo ese hermano para no confundir dos tablas
  // distintas que estén dentro del mismo card.
  const nativeToolbar=scrollHost?.previousElementSibling;
  if(!nativeToolbar)return false;
  return [...nativeToolbar.querySelectorAll?.("button")||[]]
    .some(button=>normalized(button.textContent)==="filtros por columna");
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

function ensureToolbar(table){
  const state=getState(table);
  if(state.toolbar?.isConnected&&state.button?.isConnected)return;
  const host=table.parentElement;
  if(!host)return;
  const toolbar=document.createElement("div");
  toolbar.className=TOOLBAR_CLASS;
  toolbar.setAttribute("data-dm-global-column-filter-ui","1");
  const button=document.createElement("button");
  button.type="button";
  button.className=BUTTON_CLASS;
  button.textContent="Filtros por columna";
  button.title="Mostrar u ocultar filtros individuales para cada columna";
  button.setAttribute("data-active",state.open?"1":"0");
  button.addEventListener("click",event=>{
    event.preventDefault();
    event.stopPropagation();
    setOpen(table,!state.open);
  });
  toolbar.appendChild(button);
  host.insertBefore(toolbar,table);
  state.toolbar=toolbar;
  state.button=button;
}

function eligible(table){
  if(!(table instanceof HTMLTableElement)||!visible(table))return false;
  if(table.closest?.("[data-dm-disable-global-column-filters='1']"))return false;
  // Los gráficos de Recharts pueden contener estructuras auxiliares. Nunca se
  // debe inyectar la barra global de filtros dentro de un dashboard/gráfico.
  if(table.closest?.(".recharts-wrapper,.recharts-responsive-container,[class*='recharts-']"))return false;
  if(hasNativeColumnFilters(table))return false;
  return leafHeaderLabels(table).length>0;
}

function decorateTable(table){
  if(!eligible(table))return;
  table.setAttribute(READY_ATTR,"1");
  ensureToolbar(table);
  ensureFilterRow(table);
  applyFilters(table);
}

function scan(){
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
