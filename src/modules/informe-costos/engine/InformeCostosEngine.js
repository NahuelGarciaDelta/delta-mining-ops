import { getCostoHorarioAmortizacionOAlquiler } from "../utils/amortizationCost.js";
import { canonicalEquipmentCode, isExcludedFromMaintenanceCostReport, isMaintenanceCostMachine, isMaintenanceCostTruck, resolveEquipmentCodeAlias } from "../../equipment/equipmentCode.js";
import { buildVisibleCategoryRowSpans } from "../utils/categoryRowSpan.js";
const norm=(v)=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toUpperCase();

function setModelCategory(payload){
  const next={...(payload.assignments||{})};
  const key=String(payload.modelKey||"");
  const value=norm(payload.value);
  if(value)next[key]=value;else delete next[key];
  return {assignments:next};
}

function renameCategory(payload){
  const oldName=norm(payload.oldName);
  const newName=norm(payload.newName);
  const source=payload.assignments||{};
  const effective=payload.effective||{};
  const next={...source};
  for(const row of payload.catalog||[]){
    const current=norm(source[row.key]||effective[row.key]||row.familia);
    if(current===oldName)next[row.key]=newName;
  }
  for(const key of Object.keys(next)){
    if(norm(next[key])===oldName)next[key]=newName;
  }
  return {assignments:next};
}

function isAll(value){
  if(value==null||value===""||value==="todos")return true;
  if(Array.isArray(value))return value.length===0||value.includes("todos");
  return false;
}
function selected(value){return Array.isArray(value)?value.map(norm):[norm(value)];}
function matchMulti(value,filter){
  if(isAll(filter))return true;
  return selected(filter).includes(norm(value));
}
function isMachineType(value,code="",family=""){
  return isMaintenanceCostMachine({code,type:value,family});
}
function isTruckType(value,code="",family=""){
  return isMaintenanceCostTruck({code,type:value,family});
}

export function matchesAmortizationTypeFilter(row,filter){
  if(isAll(filter))return true;
  const tipoSelections=selected(filter);
  const tipo=norm(row?.tipo);
  const metaTipo=norm(row?.metaTipo);
  const metaFamilia=norm(row?.metaFamilia);
  return tipoSelections.includes(tipo)||tipoSelections.includes(metaTipo)||
    (tipoSelections.includes("MAQUINAS")&&(isMachineType(tipo,row?.equipo,metaFamilia)||isMachineType(metaTipo,row?.equipo,metaFamilia)))||
    (tipoSelections.includes("CAMIONES")&&(isTruckType(tipo,row?.equipo,metaFamilia)||isTruckType(metaTipo,row?.equipo,metaFamilia)));
}

function isIncludedCostRow(row){
  return !isExcludedFromMaintenanceCostReport(row?.maquina||row?.equipo||"");
}
function sortValue(v){
  if(v==null)return "";
  if(typeof v==="number")return Number.isFinite(v)?v:"";
  const str=String(v).trim();
  if(!str)return "";
  const candidate=Number(str.replace(/\./g,"").replace(",","."));
  if(Number.isFinite(candidate)&&/^-?[\d.,]+$/.test(str.replace(/\s/g,"")))return candidate;
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
}
function compare(a,b){
  const av=sortValue(a),bv=sortValue(b);
  if(av===""&&bv!=="")return 1;
  if(bv===""&&av!=="")return -1;
  if(av===""&&bv==="")return 0;
  if(typeof av==="number"&&typeof bv==="number")return av-bv;
  return String(av).localeCompare(String(bv),"es-AR",{sensitivity:"base"});
}

function processAmortizationRows(payload){
  const rows=(Array.isArray(payload.rows)?payload.rows:[]).filter(isIncludedCostRow);
  const filters=payload.filters||{};
  const useLista=payload.useListaVidaUtil||{};
  const overrides=payload.vidaUtilOverride||{};
  const filtered=[];

  for(const row of rows){
    if(!matchMulti(row.equipo,filters.equipo))continue;
    if(!matchMulti(row.propiedad||"S/D",filters.propiedad))continue;
    if(!matchesAmortizationTypeFilter(row,filters.tipo))continue;
    const vidaLM=Number(row.vidaListaMaestra||row.vidaBase||row.vida||8000);
    const override=Number(overrides[row.equipo])||0;
    const usaLista=useLista[row.equipo]!==false;
    const vidaEfectiva=row._esDelta?(usaLista?vidaLM:(override>0?override:vidaLM)):(Number(row.horasMensuales)||Number(row._hsEf)||200);
    const costoInfo=getCostoHorarioAmortizacionOAlquiler({
      propiedad:row.propiedad,
      costoAdquisicion:row.costoAdquisicion??row.adq,
      vidaUtil:vidaEfectiva,
      tarifaMensual:row.tarifaMensual??row.adq,
      horasMensuales:vidaEfectiva
    });
    const amortEfectiva=costoInfo.costoHorario;
    const mant=Number(row.mantUSDhs)||0;
    const pct=amortEfectiva>0?mant/amortEfectiva:0;
    filtered.push({...row,vida:vidaEfectiva,amort:amortEfectiva,costoCapitalTipo:costoInfo.tipo,costoCapitalDetalle:costoInfo.detalle,pctMant:pct,totalUSDhs:amortEfectiva+(Number(row.hhHombreVestido)||0)+mant});
  }

  // La categoría de amortización es la única clave de agrupación. Se usa la
  // versión normalizada para evitar que diferencias de mayúsculas, tildes o
  // espacios separen equipos que pertenecen a la misma categoría.
  const categoryMeta=new Map();
  for(let index=0;index<filtered.length;index++){
    const row=filtered[index];
    const key=norm(row.tipo||"S/D")||"S/D";
    if(!categoryMeta.has(key))categoryMeta.set(key,{display:String(row.tipo||"S/D").trim()||"S/D",firstIndex:index,sum:0,count:0,rows:[]});
    const item=categoryMeta.get(key);
    const value=Number(row.pctMant);
    if(Number.isFinite(value)&&value>0){item.sum+=value;item.count++;}
    item.rows.push(row);
  }

  const sort=payload.sort;
  const dir=sort?.dir==="desc"?-1:1;
  const groups=[...categoryMeta.entries()].map(([key,item])=>{
    const prom=item.count?item.sum/item.count:0;
    const rows=item.rows.map(row=>({...row,tipo:item.display,promTipo:prom}));
    // El orden solicitado se aplica dentro de cada categoría. Nunca se mezclan
    // filas de categorías diferentes, porque el rowSpan de “Promedio por tipo”
    // depende de que el grupo sea contiguo.
    if(sort?.key&&sort.key!=="tipo")rows.sort((a,b)=>dir*compare(a?.[sort.key],b?.[sort.key]));
    return {key,...item,rows};
  });

  if(sort?.key==="tipo")groups.sort((a,b)=>dir*compare(a.display,b.display));
  else groups.sort((a,b)=>a.firstIndex-b.firstIndex||compare(a.display,b.display));

  const out=[];
  for(const group of groups){
    group.rows.forEach(row=>out.push(row));
  }
  return {rows:buildVisibleCategoryRowSpans(out)};
}


const costEngine={historicalRows:[],dynamicMonthly:[],dynamicMO:[],meta:{},metaCanonical:new Map(),queryCache:new Map()};
function arrayFilter(v){return Array.isArray(v)?v:[v].filter(Boolean)}
function getCostMeta(row){
  const rawCode=String(row?.maquina||row?.equipo||"");
  return costEngine.meta[rawCode]||costEngine.metaCanonical.get(row?._canonicalCode||canonicalEquipmentCode(rawCode))||row?.meta||{};
}
function matchesFilters(row,filters={}){
  const meta=getCostMeta(row);
  const rowCode=String(row?.maquina||row?.equipo||"");
  const proyecto=row.proyecto||((row.section==='JM')?'JOSE MARIA':'FILO DEL SOL');
  if(!matchMulti(proyecto,filters.proyecto))return false;
  if(!isAll(filters.propiedad)){
    const props=Array.isArray(meta.props)?meta.props:[meta.propiedad||'S/D'];
    const sel=arrayFilter(filters.propiedad).map(norm);
    if(!props.some(p=>sel.includes(norm(p))))return false;
  }
  const display=meta.display||row.equipo||row.maquina||'';
  if(!matchMulti(display,filters.maquina)&&!matchMulti(row.equipo||row.maquina,filters.maquina))return false;
  if(!isAll(filters.tipo)){
    const sels=arrayFilter(filters.tipo).map(norm);
    const tipo=norm(meta.tipo);
    const familia=norm(meta.familia||meta.family);
    if(!(sels.includes(tipo)||(sels.includes('MAQUINAS')&&isMachineType(tipo,rowCode,familia))||(sels.includes('CAMIONES')&&isTruckType(tipo,rowCode,familia))))return false;
  }
  return true;
}
function prepareCostRows(rows){
  return (Array.isArray(rows)?rows:[]).filter(isIncludedCostRow).map(row=>{
    const rawCode=String(row.maquina||row.equipo||"");
    const resolvedCode=resolveEquipmentCodeAlias(rawCode);
    const section=row.section||((norm(row.proyecto).includes("JOSE")||norm(row.proyecto).includes("JM"))?"JM":"FS");
    const canonicalCode=canonicalEquipmentCode(resolvedCode);
    return {
      ...row,
      ...(row.maquina!=null?{maquina:resolvedCode}:{equipo:resolvedCode}),
      _canonicalCode:canonicalCode,section
    };
  });
}

function sectionFromRentalLocation(value){
  const location=norm(value);
  if(!location)return "";
  const isJM=location==="JM"||location.includes("JOSE MARIA");
  const isFS=location==="FS"||location==="FILO"||location.includes("FILO DEL SOL");
  if(isJM===isFS)return "";
  return isJM?"JM":"FS";
}

function assignProjectFromMasterList(row){
  const meta=getCostMeta(row);
  let targetSection=sectionFromRentalLocation(meta.lugarAlquiler||meta.rentalLocation);
  // Respaldo de las correcciones ya confirmadas cuando Lugar de alquiler está vacío.
  if(!targetSection){
    const code=row._canonicalCode;
    const moveTopMarch=String(row.mes||"")==="2026-03"&&(code==="TOP0036"||code==="TOP0051");
    if(moveTopMarch||code==="PCA0101")targetSection="JM";
  }
  if(!targetSection||targetSection===row.section)return row;
  const code=row._canonicalCode;
  const addExistingHistorical=(String(row.mes||"")==="2026-03"&&(code==="TOP0036"||code==="TOP0051"))||code==="PCA0101";
  return {
    ...row,
    section:targetSection,
    proyecto:targetSection==="JM"?"JOSE MARIA":"FILO DEL SOL",
    ...(addExistingHistorical?{_addHistoricalSameMonth:true}:{}),
  };
}
function initCostMonthlyEngine(payload){
  const preparedDynamicMonthly=prepareCostRows(payload.dynamicMonthly);
  const preparedDynamicMO=prepareCostRows(payload.dynamicMO);
  costEngine.meta={};
  costEngine.metaCanonical=new Map();
  Object.entries(payload.meta||{}).forEach(([code,meta])=>{
    const resolvedCode=resolveEquipmentCodeAlias(code);
    const normalizedMeta={...meta,display:resolveEquipmentCodeAlias(meta?.display||resolvedCode)};
    costEngine.meta[code]=normalizedMeta;
    costEngine.meta[resolvedCode]=normalizedMeta;
    const key=canonicalEquipmentCode(resolvedCode);
    if(key&&!costEngine.metaCanonical.has(key))costEngine.metaCanonical.set(key,normalizedMeta);
  });
  const assignedDynamicMonthly=preparedDynamicMonthly.map(assignProjectFromMasterList);
  const assignedDynamicMO=preparedDynamicMO.map(assignProjectFromMasterList);
  // Un equipo se considera vigente si tiene al menos un registro en 2026. Una
  // vez vigente, se conservan también sus movimientos de 2025 para TOTAL 2025.
  // Así el histórico no revive equipos dados de baja, pero tampoco se pierde el
  // costo anterior de los equipos que siguen activos.
  const activeEquipmentCodes=new Set(
    [...assignedDynamicMonthly,...assignedDynamicMO]
      .filter(row=>String(row.mes||"").startsWith("2026-"))
      .map(row=>row._canonicalCode)
      .filter(Boolean)
  );
  costEngine.dynamicMonthly=assignedDynamicMonthly
    .filter(row=>String(row.mes||"").startsWith("2026-")&&activeEquipmentCodes.has(row._canonicalCode));
  costEngine.dynamicMO=assignedDynamicMO
    .filter(row=>String(row.mes||"").startsWith("2026-")&&activeEquipmentCodes.has(row._canonicalCode));
  costEngine.historicalRows=prepareCostRows(payload.historicalRows)
    .map(assignProjectFromMasterList)
    .filter(row=>activeEquipmentCodes.has(row._canonicalCode));
  costEngine.queryCache.clear();
  return {ready:true,counts:{historical:costEngine.historicalRows.length,monthly:costEngine.dynamicMonthly.length,mo:costEngine.dynamicMO.length}};
}
function aggregateRows(rows,months,rates,baseRate,filters,minMonth){
  const map=new Map();
  const ensure=(equipo,section)=>{const k=section+'__'+equipo; if(!map.has(k))map.set(k,{equipo,section,months:{},prev:0,corr:0,total:0}); return map.get(k)};
  for(const r of rows){
    if(!matchesFilters(r,filters))continue;
    const mes=r.mes; if(!mes|| (minMonth&&mes<minMonth))continue;
    const meta=getCostMeta(r);
    const section=r.section||((norm(r.proyecto).includes('JOSE')||norm(r.proyecto).includes('JM'))?'JM':'FS');
    const equipo=meta.display||r.maquina||'—';
    const row=ensure(equipo,section); if(!row.months[mes])row.months[mes]={prev:0,corr:0,total:0};
    if(r._addHistoricalSameMonth){
      if(!row._addHistoricalMonths)row._addHistoricalMonths={};
      row._addHistoricalMonths[mes]=true;
    }
    const usd=(Number(r.costo)||0)/(Number(rates?.[mes])||Number(baseRate)||1);
    if(r.esPrev){row.months[mes].prev+=usd;row.prev+=usd}else{row.months[mes].corr+=usd;row.corr+=usd}
    row.months[mes].total+=usd;row.total+=usd;
  }
  return map;
}
function mergeHistorical(map,filters,fixedMonths){
  const ensure=(equipo,section)=>{const k=section+'__'+equipo; if(!map.has(k))map.set(k,{equipo,section,months:{},prev:0,corr:0,total:0}); return map.get(k)};
  for(const x of costEngine.historicalRows){
    if(!matchesFilters(x,filters))continue;
    const meta=getCostMeta(x);
    const row=ensure(meta.display||x.equipo,x.section);
    for(const m of fixedMonths||[]){
      const d=x.months?.[m.key]||{};
      const prev=Number(d.prev)||0;
      const corr=Number(d.corr)||0;
      const total=Number(d.total)||(prev+corr);
      // El histórico fijo es un consolidado del mismo período. Cuando contiene
      // un importe reemplaza al valor dinámico de ese mes para evitar duplicarlo;
      // si está vacío, se conserva lo que venga actualmente desde la app.
      if(total!==0&&row._addHistoricalMonths?.[m.key]){
        const current=row.months[m.key]||{prev:0,corr:0,total:0};
        row.months[m.key]={
          prev:(Number(current.prev)||0)+prev,
          corr:(Number(current.corr)||0)+corr,
          total:(Number(current.total)||0)+total,
        };
      }
      else if(total!==0)row.months[m.key]={prev,corr,total};
      else if(!row.months[m.key])row.months[m.key]={prev:0,corr:0,total:0};
    }
  }
}
function finalizeMap(map,months){
  for(const row of map.values()){
    row.prev=0;row.corr=0;row.total=0;
    for(const m of months||[]){const d=row.months[m.key]||{};row.prev+=Number(d.prev)||0;row.corr+=Number(d.corr)||0;row.total+=Number(d.total)||0}
    delete row._addHistoricalMonths;
  }
  return [...map.values()].filter(x=>x.total>0).sort((a,b)=>a.section.localeCompare(b.section)||a.equipo.localeCompare(b.equipo));
}
function queryCostMonthly(payload){
  const cacheKey=JSON.stringify(payload);
  if(costEngine.queryCache.has(cacheKey))return costEngine.queryCache.get(cacheKey);
  const months=payload.months||[], fixed=payload.fixedMonths||[], rates=payload.rates||{}, baseRate=payload.baseRate||1;
  const map=aggregateRows(costEngine.dynamicMonthly,months,rates,baseRate,payload.filters,null);
  mergeHistorical(map,payload.filtersHistorical||payload.filters,fixed);
  const monthly=finalizeMap(map,months);
  const moMap=aggregateRows(costEngine.dynamicMO,months,rates,baseRate,payload.filtersMO,null);
  mergeHistorical(moMap,payload.filtersMO,fixed);
  const monthlyMO=finalizeMap(moMap,months);
  // Universo de Mano de Obra: nace de la misma fuente de Costo mensual, pero
  // respeta los filtros propios de MO. Así una máquina sigue apareciendo aunque
  // no tenga registros de mantenimiento en la fuente específica de Mano de Obra.
  const moUniverseMap=aggregateRows(costEngine.dynamicMonthly,months,rates,baseRate,payload.filtersMO,null);
  mergeHistorical(moUniverseMap,payload.filtersMO,fixed);
  const monthlyMOUniverse=finalizeMap(moUniverseMap,months);
  const accumMonths=payload.monthsAccum||months;
  const accumMap=aggregateRows(costEngine.dynamicMonthly,accumMonths,{},baseRate,payload.filters, null);
  const values=[...accumMap.values()]; const counts={}; for(const x of values)if(x.total>0)counts[x.section]=(counts[x.section]||0)+1;
  const acumulado=values.filter(x=>x.total>0).map(x=>{const n=(accumMonths||[]).filter(m=>Number(x.months[m.key]?.total)>0).length;const hs=x.section==='JM'?Number(payload.hsJM)||180:Number(payload.hsFS)||180;const mo=x.section==='JM'?Number(payload.subtotalJM)||0:Number(payload.subtotalFS)||0;const moEq=mo/(counts[x.section]||1);return {...x,promedio:n?x.total/n:0,mo:moEq,hsEf:hs,usdHs:hs?(x.total+moEq)/hs:0}}).sort((a,b)=>a.section.localeCompare(b.section)||a.equipo.localeCompare(b.equipo));
  const result={monthly,monthlyMO,monthlyMOUniverse,acumulado};
  costEngine.queryCache.set(cacheKey,result);
  if(costEngine.queryCache.size>20)costEngine.queryCache.delete(costEngine.queryCache.keys().next().value);
  return result;
}


function averageMonthlyTotal(row,months){
  let sum=0,count=0;
  for(const m of months||[]){
    const value=Number(row?.months?.[m.key]?.total)||0;
    if(value!==0){sum+=value;count++;}
  }
  return count?sum/count:0;
}
function isPickupMeta(code,meta={}){
  const tipo=norm(meta.tipo||meta.metaTipo||"");
  const familia=norm(meta.familia||meta.metaFamilia||"");
  if(familia)return familia.split(" ")[0]==="CAMIONETA";
  const raw=norm(code).replace(/\s+/g,"");
  const display=norm(meta.display||"").replace(/\s+/g,"");
  return tipo.includes("CAMIONETA")||/^CTA/.test(raw)||/^CTA/.test(display)||/^AG-?\d/.test(raw)||/^AH-?\d/.test(raw)||/^AG-?\d/.test(display)||/^AH-?\d/.test(display);
}
function calculateCtaStats(section,payload){
  const manual=section==="JM"?(Number(payload.ctaJM)||0):(Number(payload.ctaFS)||0);
  const rate=Number(payload.rateCTA)||Number(payload.baseRate)||1;
  const byPickup=new Map();
  for(const r of costEngine.dynamicMO||[]){
    const meta=getCostMeta(r);
    const sec=r.section||((norm(r.proyecto).includes("JOSE")||norm(r.proyecto).includes("JM"))?"JM":"FS");
    if(sec!==section||!isPickupMeta(r.maquina,meta))continue;
    const key=meta.display||r.maquina||"—";
    if(!byPickup.has(key))byPickup.set(key,{total:0,months:new Set()});
    const acc=byPickup.get(key);
    acc.total+=(Number(r.costo)||0)/rate;
    if(r.mes)acc.months.add(r.mes);
  }
  const avgs=[];
  for(const acc of byPickup.values()){
    const divisor=Math.max(1,acc.months.size||Number(payload.monthCount)||1);
    const avg=(Number(acc.total)||0)/divisor;
    if(avg>0)avgs.push(avg);
  }
  const mantenimientoPromedio=avgs.length?avgs.reduce((a,b)=>a+b,0)/avgs.length:0;
  const cantidad=manual>0?manual:byPickup.size;
  return {
    section,cantidad,mantenimientoPromedio,
    costoAdquisicionPromedio:Number(payload.costoAdquisicionPromedioCamionetas)||0,
    tieneFila:cantidad>0||mantenimientoPromedio>0||Number(payload.costoAdquisicionPromedioCamionetas)>0
  };
}
function processManoObra(payload){
  const months=Array.isArray(payload.months)?payload.months:[];
  const monthlyRows=(Array.isArray(payload.monthlyRows)?payload.monthlyRows:[]).filter(isIncludedCostRow);
  const universeRows=(Array.isArray(payload.universeRows)?payload.universeRows:monthlyRows).filter(isIncludedCostRow);
  const equipmentMeta=payload.equipmentMeta||{};
  const projectLabels=payload.projectLabels||{JM:"JOSE MARIA",FS:"FILO DEL SOL"};
  const ctaStats={FS:calculateCtaStats("FS",{...payload,monthCount:months.length}),JM:calculateCtaStats("JM",{...payload,monthCount:months.length})};
  const rowKey=row=>`${row?.section==="JM"?"JM":"FS"}__${canonicalEquipmentCode(row?.equipo||row?.maquina)}`;
  const laborByKey=new Map();
  monthlyRows.forEach(row=>{
    const key=rowKey(row);
    if(!laborByKey.has(key)){
      const monthCopy={};
      Object.entries(row.months||{}).forEach(([month,value])=>{monthCopy[month]={...value};});
      laborByKey.set(key,{...row,months:monthCopy});
      return;
    }
    const target=laborByKey.get(key);
    Object.entries(row.months||{}).forEach(([month,value])=>{
      const current=target.months[month]||(target.months[month]={prev:0,corr:0,total:0});
      current.prev=(Number(current.prev)||0)+(Number(value?.prev)||0);
      current.corr=(Number(current.corr)||0)+(Number(value?.corr)||0);
      current.total=(Number(current.total)||0)+(Number(value?.total)||0);
    });
  });
  const universeByKey=new Map();
  universeRows.forEach(row=>{const key=rowKey(row);if(!universeByKey.has(key))universeByKey.set(key,row);});
  const projectTotals={JM:0,FS:0};
  const prepared=[...universeByKey.entries()].map(([key,universeRow])=>{
    const row=laborByKey.get(key)||universeRow;
    const section=row.section==="JM"?"JM":"FS";
    const mantenimiento=laborByKey.has(key)?averageMonthlyTotal(row,months):0;
    projectTotals[section]+=mantenimiento;
    return {row:{...row,equipo:universeRow.equipo||row.equipo},section,mantenimiento,key};
  });
  projectTotals.JM+=Number(ctaStats.JM.mantenimientoPromedio)||0;
  projectTotals.FS+=Number(ctaStats.FS.mantenimientoPromedio)||0;
  const rows=[];
  for(const item of prepared){
    const {row,section,mantenimiento}=item;
    const subtotal=section==="JM"?(Number(payload.subtotalJM)||0):(Number(payload.subtotalFS)||0);
    const totalProyecto=Number(projectTotals[section])||0;
    const porcentaje=totalProyecto>0?mantenimiento/totalProyecto:0;
    const manoObra=subtotal*porcentaje;
    const meta=equipmentMeta[String(row.equipo||"")]||equipmentMeta[item.key]||{};
    rows.push({
      equipo:row.equipo,
      proyecto:projectLabels[section]||section,
      propiedad:meta.propiedad||"S/D",
      mantenimiento,porcentaje,manoObra,
      costoAdquisicion:Number(meta.costoAdquisicion)||0,
      total:mantenimiento+manoObra,
      isCTA:false
    });
  }
  for(const section of ["FS","JM"]){
    const st=ctaStats[section];
    if(!st?.tieneFila)continue;
    const project=projectLabels[section]||section;
    if(!matchMulti(project,payload.projectFilter))continue;
    const subtotal=section==="JM"?(Number(payload.subtotalJM)||0):(Number(payload.subtotalFS)||0);
    const totalProyecto=Number(projectTotals[section])||0;
    const mantenimiento=Number(st.mantenimientoPromedio)||0;
    const porcentaje=totalProyecto>0?mantenimiento/totalProyecto:0;
    const manoObra=subtotal*porcentaje;
    rows.push({
      equipo:section==="JM"?"CTA JM":"CTA FS",proyecto:project,propiedad:"DELTA",
      mantenimiento,porcentaje,manoObra,
      costoAdquisicion:(Number(st.costoAdquisicionPromedio)||0)*(Number(st.cantidad)||0),
      total:mantenimiento+manoObra,isCTA:true,cantidadCTA:st.cantidad||0,sortCTA:0
    });
  }
  rows.sort((a,b)=>String(a.proyecto).localeCompare(String(b.proyecto))||((a.isCTA?0:1)-(b.isCTA?0:1))||String(a.equipo).localeCompare(String(b.equipo)));
  const totalsFor=(source)=>source.reduce((acc,x)=>{acc.mantenimiento+=Number(x.mantenimiento)||0;acc.manoObra+=Number(x.manoObra)||0;acc.total+=Number(x.total)||0;return acc},{mantenimiento:0,manoObra:0,total:0});
  const delta=rows.filter(x=>norm(x.propiedad)==="DELTA");
  const rented=rows.filter(x=>norm(x.propiedad)!=="DELTA");
  const totals=[
    {equipo:"TOTAL DELTA",propiedad:"DELTA",...totalsFor(delta),isTotal:true},
    {equipo:"TOTAL ALQUILADO",propiedad:"ALQUILADO",...totalsFor(rented),isTotal:true},
    {equipo:"TOTAL",propiedad:"",...totalsFor(rows),isTotal:true}
  ];
  const sort=payload.sort;
  let sortedRows=rows;
  if(sort?.key){
    const dir=sort.dir==="desc"?-1:1;
    sortedRows=[...rows].sort((a,b)=>dir*compare(a?.[sort.key],b?.[sort.key]));
  }
  return {rows,sortedRows,totals,ctaStats,projectTotals};
}


function resumenTypeOrder(label){
  const t=norm(label);
  if(!t||t==="S/D"||t==="SD")return 9999;
  if(t.includes("CARGADOR FRONTAL L120"))return 10;
  if(t.includes("CARGADOR FRONTAL"))return 20;
  if(t.includes("EXCAVADORA PC350"))return 30;
  if(t.includes("EXCAVADORA"))return 40;
  if(t.includes("MINICARGADORA"))return 50;
  if(t.includes("MOTONIVELADORA"))return 60;
  if(t.includes("RETROPALA"))return 70;
  if(t.includes("RODILLO COMPACTADOR"))return 80;
  if(t.includes("TOPADORA"))return 90;
  if(t.includes("CAMIONETA")||t.includes("HILUX")||t.includes("PICK"))return 200;
  if(t.includes("GRUPO ELECTROGENO")||t.includes("GENERADOR"))return 210;
  if(t.includes("CAMION DE COMBUSTIBLE"))return 220;
  if(t.includes("CAMION REGADOR"))return 230;
  if(t.includes("CAMION VOLCADOR"))return 240;
  return 500;
}
function processResumenEquipo(payload){
  const source=(Array.isArray(payload.rows)?payload.rows:[]).filter(isIncludedCostRow);
  const filters=payload.filters||{};
  const filtered=[];
  for(const x of source){
    if(!matchMulti(x._resumenTipoValue,filters.tipo))continue;
    if(!matchMulti(x._resumenEquipoValue,filters.equipo))continue;
    if(!matchMulti(x._resumenPropiedadValue,filters.propiedad))continue;
    filtered.push(x);
  }
  const grupos=new Map();
  for(const x of filtered){
    const tipoGrupo=String(x._resumenTipoLabel||x.tipo||"S/D").trim()||"S/D";
    const key=norm(tipoGrupo);
    if(!grupos.has(key))grupos.set(key,{
      tipoGrupo,amorts:[],pctMantVals:[],mantVals:[],modelos:new Map(),detalleMaquinas:[],
      orden:Number(x._grupoIndex)||999,ordenTipo:Number(x._ordenGrupo)||9999
    });
    const g=grupos.get(key);
    const amort=Number(x.amort)||0;if(amort>0)g.amorts.push(amort);
    const pct=Number(x.pctMant)||0;if(pct>0)g.pctMantVals.push(pct);
    const mant=Number(x.mantUSDhs)||0;if(mant>0)g.mantVals.push(mant);
    const modelo=String(x._resumenModelo||x.modelo||"—")||"—";
    const mk=norm(modelo);
    if(!g.modelos.has(mk))g.modelos.set(mk,{modelo,count:0,orden:g.modelos.size});
    g.modelos.get(mk).count++;
    g.detalleMaquinas.push({equipo:x.equipo||"—",modelo,propiedad:x.propiedad||"S/D",amort,pctMant:pct,totalUSDhs:Number(x.totalUSDhs)||0});
    g.orden=Math.min(g.orden,Number(x._grupoIndex)||999);
    g.ordenTipo=Math.min(g.ordenTipo,Number(x._ordenGrupo)||9999);
  }
  const rows=[...grupos.values()].sort((a,b)=>resumenTypeOrder(a.tipoGrupo)-resumenTypeOrder(b.tipoGrupo)||a.orden-b.orden||a.ordenTipo-b.ordenTipo||a.tipoGrupo.localeCompare(b.tipoGrupo)).map(g=>{
    const avg=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:0;
    const costoAmort=avg(g.amorts),pctMant=avg(g.pctMantVals),costoHorario=avg(g.mantVals);
    const modelos=[...g.modelos.values()].sort((a,b)=>b.count-a.count||a.orden-b.orden||String(a.modelo).localeCompare(String(b.modelo)));
    return {
      maquina:g.tipoGrupo,modelo:modelos[0]?.modelo||"—",costoAmort,pctMant,costoHorario,
      costoTotal:costoAmort>0?costoAmort*(1+pctMant):0,_tipoGrupo:g.tipoGrupo,_detalleMaquinas:g.detalleMaquinas
    };
  });
  return {rows,filteredCount:filtered.length};
}

export function handleInformeCostosCommand(type,payload={}){
  if(type==="SET_MODEL_CATEGORY")return setModelCategory(payload);
  if(type==="RENAME_CATEGORY")return renameCategory(payload);
  if(type==="PROCESS_AMORTIZATION_ROWS")return processAmortizationRows(payload);
  if(type==="INIT_COST_MONTHLY_ENGINE")return initCostMonthlyEngine(payload);
  if(type==="QUERY_COST_MONTHLY")return queryCostMonthly(payload);
  if(type==="PROCESS_MANO_OBRA")return processManoObra(payload);
  if(type==="PROCESS_RESUMEN_EQUIPO")return processResumenEquipo(payload);
  if(type==="PING")return {pong:true};
  throw new Error(`Comando desconocido: ${type}`);
}

export function resetInformeCostosEngine(){
  costEngine.historicalRows=[];
  costEngine.dynamicMonthly=[];
  costEngine.dynamicMO=[];
  costEngine.meta={};
  costEngine.metaCanonical=new Map();
  costEngine.queryCache.clear();
}
