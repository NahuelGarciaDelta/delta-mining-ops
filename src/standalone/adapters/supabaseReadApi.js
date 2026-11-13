// ADAPTADOR V9: conserva los contratos de datos que consume el frontend Delta OPS.
import {requestV9,currentSession,refreshV9} from "../session.js";
import {ROP02_SOURCE_KEYS,ROP02_SOURCES} from "../../config/rop02Sources.js";
export const SUPABASE_TYPED_SOURCES=new Set([...ROP02_SOURCE_KEYS,"rop05","rma15_fs","rma15_jm","lista_equipos","insumos","mantenimiento_programado","combustible","raba03","movimientos_equipos","movimientos_taller"]);
// Read bounded pages to reduce Apps Script execution time and response sizes.
// Keep MAX_ROWS and full-page aggregation to preserve complete data integrity.
const PAGE=600,MAX_ROWS=60000;
const TIME=()=>new Date().toISOString();
// Original Sheets return display headers; sandbox snapshots return typed keys.
// Normalize both without replacing a populated original field with undefined.
const normHeader=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"");
function adaptSourceRecord(source,p,recordId){
 const original=p.raw_data&&typeof p.raw_data==="object"&&!Array.isArray(p.raw_data)?p.raw_data:{};
 const result={...original,...p,_sourceDataset:source,_sourceKey:recordId};
 const index=new Map(Object.entries(result).map(([key,value])=>[normHeader(key),value]));
 const pick=(...keys)=>{
   for(const key of keys){const v=result[key]??index.get(normHeader(key));if(v!==undefined&&v!==null&&v!=="")return v;}
   return undefined;
 };
 const set=(key,...aliases)=>{const v=pick(key,...aliases);if(v!==undefined)result[key]=v;};
 if(source==="rop05"){
   for(const [key,aliases] of Object.entries({
     "Fecha del Parte Diario":["fecha","Fecha"],Fecha:["fecha","Fecha del Parte Diario"],
     Supervisor:["supervisor"],Proyecto:["proyecto"],"Codigo Int":["interno","Código Interno del Equipo"],
     "Código Interno del Equipo":["interno","Codigo Int"],Interno:["interno","Codigo Int"],
     "N° de Parte":["numero_parte","N° Parte"],"Tipo Equipo":["tipo_equipo"],Tarea:["tarea"],
     "CANTIDAD DE HS PRODUCTIVAS EFECTIVAS (SOLO CANTIDAD)":["horas_productivas","Hs"],
     Hs:["horas_productivas"],LARGO:["largo"],ANCHO:["ancho"],PROFUNDIDAD:["profundidad"],
     "CANTIDAD DE PRODUCCIÓN DE LA TAREA REALIZADA (SIN UNIDADES DE MEDIDA)":["cantidad_produccion","Cantidad"],
     Cantidad:["cantidad_produccion"],"UNIDAD DE PRODUCTIVIDAD":["unidad","Unidad"],
     Unidad:["unidad"],Observaciones:["observaciones"],Mes:["mes"]
   }))set(key,...aliases);
 }else if(source.startsWith("rop02_")){
   for(const [key,aliases] of Object.entries({
     Fecha:["fecha"],Interno:["interno","Codigo Int"],Equipo:["equipo","Equipos"],
     Operador:["operador"],"Supervisor Delta":["supervisor_delta"],
     "Supervisor Vial Cliente":["supervisor_vial_cliente"],
     "Turno de trabajo":["turno_trabajo","Turno"],Turno:["turno_trabajo","Turno de trabajo"],
     "N° Parte":["numero_parte"],Proyecto:["proyecto","Proyecto "],
     "Horómetro inicial":["horometro_inicial","HI"],"Horómetro final":["horometro_final","HF"],
     HI:["horometro_inicial","Horómetro inicial"],HF:["horometro_final","Horómetro final"],
     "Cant. Hs.":["cantidad_horas"],Combustible:["combustible"],Aceite:["aceite_text","aceite"],
     "Descripción de los trabajos realizados":["descripcion_trabajos"],
     "Información sobre Desgaste":["informacion_desgaste","Desgaste"],
     Desgaste:["informacion_desgaste","Información sobre Desgaste"],
     Observaciones:["observaciones"],"OD o FS":["od_fs","od_o_fs","estado","status"],
     Estado:["od_fs","od_o_fs","OD o FS","estado","status"]
   }))set(key,...aliases);
 }else if(source.startsWith("rma15_")){
   for(const [key,aliases] of Object.entries({
     "Fecha de OT":["fecha_ot","Fecha OT","Fecha"],Fecha:["fecha_ot","Fecha de OT"],
     Proyecto:["proyecto"],EQUIPO:["equipo","Equipo"],Equipo:["equipo","EQUIPO"],
     "CODIGO N° INTERNO":["interno","Código interno","Codigo interno","CODIGO INTERNO"],
     Interno:["interno","CODIGO N° INTERNO","Código interno"],
     "Km / hs":["km_hs","Km/hs"],"TIPO DE MANTENIMIENTO":["tipo_mantenimiento","Tipo de mantenimiento"],
     "TURNO EN QUE SE HIZO LA OT":["turno"],
     "INTERVENCIÓN O REPARACIÓN REALIZADA (Si es PM, especificar cual) LOS SOPLETEOS DE FILTROS VAN EN ESTA SECCION O CUALQUIER SERVICIO QUE SE REALICE)":["intervencion","INTERVENCIÓN O REPARACIÓN REALIZADA (Si es PM, especificar cual) LOS SOPLETEOS DE FILTROS VAN EN ESTA SECCION O CUALQUIER SERVICIO QUE SE REALICE"],
     OBSERVACIONES:["observaciones"],"MAIL AVISADO":["mail_avisado"]
   }))set(key,...aliases);
   const operativo=pick("¿EQUIPO QUEDO OPERATIVO?","equipo_operativo");
   if(typeof operativo==="boolean")result["¿EQUIPO QUEDO OPERATIVO?"]=operativo?"SI":"NO";
   else if(operativo!==undefined)result["¿EQUIPO QUEDO OPERATIVO?"]=operativo;
 }else if(source==="lista_equipos"){
   for(const [key,aliases] of Object.entries({
     "Código nuevo":["codigo_nuevo","Codigo nuevo","CODIGO NUEVO","Codigo nuevo "],
     "Código anterior":["codigo_anterior","Codigo anterior"],
     "Código de Drusila":["codigo_drusila","Código Drusila","CODIGO DRUSILA"],
     Familia:["familia","Familia (Topadora, Retro Pala, etc.)","Familia (Topadora, Retro, Pala, etc.)","Familia \n(Topadora, Retro, Pala, etc.)"],
     Marca:["marca"],Modelo:["modelo"],Propiedad:["propiedad","Propiedad (nombre de la empresa, o si es propio)"],
     Lugar:["lugar_alquiler","Lugar de alquiler"],"Lugar de alquiler":["lugar_alquiler","Lugar"],
     "Ubicación":["lugar_alquiler","Lugar de alquiler"]
   }))set(key,...aliases);
 }
 return result;
}
function active(){const s=currentSession();if(!s)throw Error("V9_SESSION_REQUIRED");return s;}
async function getPage(source,limit=PAGE,offset=0,entity=""){
  // Operational V9 data comes directly from the original Sheets through the
  // authenticated Apps Script V9 bridge. Supabase is intentionally not used as
  // a live source here; it remains the disposable sandbox used by tests.
  const session=active();
  const response=await fetch("/api/v9-sheets-read",{
    method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},
    body:JSON.stringify({dataset:source,limit,offset,...(entity?{entity}:{})})
  });
  const body=await response.json().catch(()=>null);
  if(!response.ok||body?.ok!==true)throw Error(body?.error||"V9_SHEETS_READ_FAILED");
  const rows=Array.isArray(body.rows)?body.rows:[];
  return {...body,rows:rows.map((payload,index)=>({record_id:String(payload?._sourceRow??(offset+index+1)),payload,updated_at:""}))};
}
// Reuse in-flight reads so simultaneous dashboard/widgets do not fetch the same dataset twice.
const sourceInFlight=new Map();
export function fetchSupabaseSource(source){
  if(!SUPABASE_TYPED_SOURCES.has(source))return Promise.reject(Error("V9_SOURCE_NOT_MIGRATED:"+source));
  if(sourceInFlight.has(source))return sourceInFlight.get(source);
  const promise=(async()=>{
    const first=await getPage(source,PAGE,0);
    const total=Number(first.total??first.rows?.length??0);
    if(total>MAX_ROWS)throw Error("V9_ROW_LIMIT:"+source);
    const pageCount=Math.ceil(total/PAGE);
    const pages=new Array(Math.max(1,pageCount));pages[0]=first;
    // Limit parallel Apps Script calls to three to avoid exhausting GAS quotas.
    let cursor=1;
    const workers=Array.from({length:Math.min(2,Math.max(0,pageCount-1))},async()=>{
      while(cursor<pageCount){
        const index=cursor++;
        pages[index]=await getPage(source,PAGE,index*PAGE);
      }
    });
    await Promise.all(workers);
    const data=[];let latest=0;
    for(const page of pages){
      const rows=Array.isArray(page?.rows)?page.rows:[];
      for(const r of rows){
        const payload=r?.payload;
        if(!payload||typeof payload!=="object"||Array.isArray(payload))
          throw Error("V9_INVALID_PAYLOAD:"+source);
        const row=adaptSourceRecord(source,payload,r.record_id);
        if(Number.isInteger(Number(payload._sourceRow)))row._sourceRow=Number(payload._sourceRow);
        data.push(row);
        const t=Date.parse(r.updated_at||"")||0;if(t>latest)latest=t;
      }
    }
    if(data.length!==total)throw Error("V9_PAGE_COUNT_MISMATCH:"+source);
    return {ok:true,source:"google-sheets-original",data,meta:{source,rows:data.length,returnedRows:data.length,total,hasMore:false,serverVersion:latest,serverTime:TIME()}};
  })();
  sourceInFlight.set(source,promise);
  // Remove when settled: subsequent explicit refreshes still read live Sheets.
  promise.then(()=>{if(sourceInFlight.get(source)===promise)sourceInFlight.delete(source);},()=>{if(sourceInFlight.get(source)===promise)sourceInFlight.delete(source);});
  return promise;
}
// Read shared procurement sub-tables directly from the original RABA03 workbook.
// The same paginated relay is used, but the entity selects its own Sheets tab.
const entityInFlight=new Map();
export function fetchSupabaseRaba03Entity(entity){
  const key=String(entity||"").trim().toUpperCase();
  if(!["ESTADOS_SOLICITUDES","REMITOS_CARGADOS"].includes(key))
    return Promise.reject(Error("V9_RABA_ENTITY_NOT_ALLOWED"));
  if(entityInFlight.has(key))return entityInFlight.get(key);
  const pending=(async()=>{
    const first=await getPage("raba03",PAGE,0,key);
    const total=Number(first.total??first.rows?.length??0);
    if(!Number.isSafeInteger(total)||total<0||total>MAX_ROWS)throw Error("V9_RABA_ENTITY_ROW_LIMIT");
    const pages=[first],count=Math.ceil(total/PAGE);
    for(let offset=PAGE;offset<count*PAGE;offset+=PAGE){
      pages.push(await getPage("raba03",PAGE,offset,key));
    }
    const data=pages.flatMap(page=>page.rows.map(r=>r.payload));
    if(data.length!==total)throw Error("V9_RABA_ENTITY_PAGE_MISMATCH");
    return {ok:true,source:"google-sheets-original",data,rows:data.length,total,hasMore:false};
  })();
  entityInFlight.set(key,pending);
  pending.finally(()=>{if(entityInFlight.get(key)===pending)entityInFlight.delete(key);}).catch(()=>{});
  return pending;
}
export async function fetchSupabaseStockSnapshot(){
 const data=[];let total=0,latestUpdatedAt=null;
 for(let offset=0;offset<MAX_ROWS;offset+=PAGE){
  const result=await getPage("raba03",PAGE,offset,"STOCK_EXCEL");
  const rows=Array.isArray(result.rows)?result.rows:[];
  for(const r of rows){
   if(r?.updated_at&&(!latestUpdatedAt||r.updated_at>latestUpdatedAt))latestUpdatedAt=r.updated_at;
   const p=r?.payload;if(!p||typeof p!=="object"||Array.isArray(p))throw Error("V9_INVALID_STOCK_PAYLOAD");
   const num=v=>{const n=Number(String(v??"").replace(",", "."));return Number.isFinite(n)?n:0;};
   data.push({id:p.ID??p.id??r.record_id,codigoArticulo:String(p.CODIGO_ARTICULO??p.codigoArticulo??""),descripcion:String(p.DESCRIPCION??p.descripcion??""),descripcionAdicional:String(p.DESCRIPCION_ADICIONAL??p.descripcionAdicional??""),descripcionDeposito:String(p.DESCRIPCION_DEPOSITO??p.descripcionDeposito??""),controlStock:String(p.CONTROL_STOCK??p.controlStock??""),saldoControlStock:num(p.SALDO_CONTROL_STOCK??p.saldoControlStock),stockMaximo:num(p.STOCK_MAXIMO??p.stockMaximo),stockMinimo:num(p.STOCK_MINIMO??p.stockMinimo)});
  }
  total=Number(result.total??data.length);
  if(!result.hasMore||rows.length===0)break;
  if(offset+rows.length>=MAX_ROWS)throw Error("V9_ROW_LIMIT:stock_excel");
 }
 const meta={version:1,active:data.length>0,activeSheet:"STOCK CRITICO",fileName:"Saldos.xlsx",sourceSheet:"STOCK CRITICO",rowCount:total,validRows:total,updatedAt:latestUpdatedAt};
 return {ok:true,source:"supabase-v9",rows:data,meta};
}
export async function fetchSupabaseHealth(){
  const t=Date.now();await requestV9({action:"status"},active());
  return {ok:true,source:"supabase-v9",latencyMs:Date.now()-t,serverTime:TIME()};
}
export async function fetchSupabaseVersionsLightweight(){
  const r=await requestV9({action:"status"},active());
  const versions={},rowCounts={};
  for(const x of r.sources||[]){
    versions[x.dataset]=Date.parse(x.latest_row_at||"")||0;
    rowCounts[x.dataset]=Number(x.records||0);
  }
  return {ok:true,source:"supabase-v9",versions,rowCounts,serverTime:TIME()};
}
export const fetchSupabaseVersions=fetchSupabaseVersionsLightweight;
export async function fetchSupabaseRop02Catalog(){
  const r=await requestV9({action:"catalog"},active());
  const names=new Map(ROP02_SOURCES.map(s=>[s.key,s.project]));
  return (r.sources||[]).filter(x=>String(x.dataset).startsWith("rop02_"))
    .map(x=>({dataset:x.dataset,project:names.get(x.dataset)||x.label||x.dataset}));
}
export async function fetchSupabaseDatasetQuery(params={}){
  const ds=String(params.dataset||"").toLowerCase();
  const keys=ds==="rop02"?[...ROP02_SOURCE_KEYS]:ds==="rma15"?["rma15_jm","rma15_fs"]:ds==="rop05"?["rop05"]:[];
  if(!keys.length)throw Error("V9_DATASET_NOT_MIGRATED:"+ds);
  const results=await Promise.all(keys.map(fetchSupabaseSource));
  let data=results.flatMap(x=>x.data||[]);
  const normal=v=>String(v??"").trim().toUpperCase();
  const date=v=>normalizeV9PmDate(v);
  const from=normalizeV9PmDate(params.desde),to=normalizeV9PmDate(params.hasta);
  data=data.filter(x=>{
    const fecha=date(x.Fecha||x.fecha||x["Fecha del Parte Diario"]||x["Fecha de OT"]);
    if(from&&fecha<from)return false;if(to&&fecha>to)return false;
    const proyecto=normal(params.proyecto||params.project);
    if(proyecto&&proyecto!=="TODOS"&&proyecto!=="TODO"&&normal(x.Proyecto||x.proyecto)!==proyecto)return false;
    return true;
  });
  const offset=Math.max(0,Number(params.offset)||0),limit=String(params.limit||"").toLowerCase()==="all"?data.length:Math.min(Math.max(1,Number(params.limit)||250),2000);
  const rows=data.slice(offset,offset+limit);
  return {ok:true,source:"supabase-v9",data:rows,rows:rows.length,total:data.length,hasMore:offset+rows.length<data.length,nextOffset:offset+rows.length<data.length?offset+rows.length:null,offset,limit};
}
// Google Sheets dates can be display-formatted DD/MM/YYYY, while the PM module
// compares ISO YYYY-MM-DD dates. Preserve dates already in ISO format.
export function normalizeV9PmDate(value){
 if(typeof value==="number"&&Number.isFinite(value)&&value>=20000&&value<100000){
  const date=new Date(Date.UTC(1899,11,30)+Math.round(value)*86400000);
  return date.toISOString().slice(0,10);
 }
 const raw=String(value??"").trim();
 if(!raw)return "";
 if(/^\d{5,6}$/.test(raw)&&Number(raw)>=20000&&Number(raw)<100000){
  const date=new Date(Date.UTC(1899,11,30)+Number(raw)*86400000);
  return date.toISOString().slice(0,10);
 }
 const iso=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
 if(iso)return iso[1]+"-"+iso[2].padStart(2,"0")+"-"+iso[3].padStart(2,"0");
 const local=raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s|$)/);
 if(local)return local[3]+"-"+local[2].padStart(2,"0")+"-"+local[1].padStart(2,"0");
 return raw;
}
// Google Sheets publishes original uppercase column headers. V9 must return
// exactly the camelCase client contract produced by handleGetMantenimientoProgramado_
// in the original Apps Script; PM component does not consume raw Sheets rows.
export function mapV9PmSourceRows(rows){
 const pick=(row,...keys)=>{
  for(const key of keys){
   const v=row?.[key];
   if(v!==undefined&&v!==null&&v!=="")return v;
  }
  return undefined;
 };
 const asText=value=>String(value??"").trim();
 const asNum=(value,fallback=0)=>{
  if(value===undefined||value===null||value==="")return fallback;
  const n=Number(typeof value==="string"?value.trim().replace(",","."):value);
  return Number.isFinite(n)?n:fallback;
 };
 const classify=row=>asText(pick(row,"_entity","entity","tipo_registro","tipo")).toUpperCase();
 const config=[],registros=[],programaciones=[],repuestos=[];
 for(const row of rows||[]){
  const kind=classify(row);
  if(kind==="CONFIG"||kind==="PM_CONFIG"||(!kind&&("INTERVALO_HS" in row||"intervalo_hs" in row||"horometroUltimoPM" in row))){
   config.push({
    interno:asText(pick(row,"interno","INTERNO")),
    equipo:asText(pick(row,"equipo","EQUIPO")),
    proyecto:asText(pick(row,"proyecto","PROYECTO")),
    intervalo:asNum(pick(row,"intervalo","INTERVALO_HS","intervalo_hs"),250),
    alertaDesde:asNum(pick(row,"alertaDesde","ALERTA_DESDE_HS"),200),
    atrasadoDesde:asNum(pick(row,"atrasadoDesde","ATRASADO_DESDE_HS"),350),
    horometroUltimoPM:asNum(pick(row,"horometroUltimoPM","HOROMETRO_ULTIMO_PM")),
    fechaUltimoPM:normalizeV9PmDate(pick(row,"fechaUltimoPM","FECHA_ULTIMO_PM")),
    tipoUltimoPM:asText(pick(row,"tipoUltimoPM","TIPO_ULTIMO_PM"))||"PM 250",
    horometroActualManual:asNum(pick(row,"horometroActualManual","HOROMETRO_ACTUAL_MANUAL")),
    activo:asText(pick(row,"activo","ACTIVO")||"SI").toUpperCase(),
    observaciones:asText(pick(row,"observaciones","OBSERVACIONES"))
   });
  }else if(kind==="REGISTRO"||kind==="REGISTROS"||kind==="PM_REGISTROS"||(!kind&&("ID_PM" in row||"idPM" in row))){
   registros.push({
    idPM:asText(pick(row,"idPM","ID_PM")),
    interno:asText(pick(row,"interno","INTERNO")),
    equipo:asText(pick(row,"equipo","EQUIPO")),
    proyecto:asText(pick(row,"proyecto","PROYECTO")),
    fecha:normalizeV9PmDate(pick(row,"fecha","FECHA")),
    horometro:asNum(pick(row,"horometro","HOROMETRO")),
    tipoPM:asText(pick(row,"tipoPM","TIPO_PM"))||"PM 250",
    tecnico:asText(pick(row,"tecnico","TECNICO")),
    ot:asText(pick(row,"ot","N_OT")),
    observaciones:asText(pick(row,"observaciones","OBSERVACIONES")),
    estado:asText(pick(row,"estado","ESTADO"))||"REALIZADO"
   });
  }else if(kind==="PROGRAMACION"||kind==="PROGRAMACIONES"||kind==="PM_PROGRAMACION"||(!kind&&("DURACION_HS" in row||"duracionHs" in row))){
   programaciones.push({
    id:asText(pick(row,"id","ID")),
    interno:asText(pick(row,"interno","INTERNO")),
    equipo:asText(pick(row,"equipo","EQUIPO")),
    proyecto:asText(pick(row,"proyecto","PROYECTO")),
    fecha:normalizeV9PmDate(pick(row,"fecha","FECHA")),
    turno:asText(pick(row,"turno","TURNO"))||"TURNO DIA",
    tecnico:asText(pick(row,"tecnico","TECNICO")),
    duracionHs:asNum(pick(row,"duracionHs","DURACION_HS")),
    ubicacion:asText(pick(row,"ubicacion","UBICACION")),
    observaciones:asText(pick(row,"observaciones","OBSERVACIONES")),
    estado:asText(pick(row,"estado","ESTADO"))||"PROGRAMADO"
   });
  }else if(kind==="REPUESTO"||kind==="REPUESTOS"||kind==="PM_REPUESTOS"||(!kind&&("CANTIDAD_MINIMA" in row||"cantidadMinima" in row))){
   repuestos.push({
    id:asText(pick(row,"id","ID")),
    codigo:asText(pick(row,"codigo","CODIGO")),
    descripcion:asText(pick(row,"descripcion","DESCRIPCION")),
    tipoPM:asText(pick(row,"tipoPM","TIPO_PM"))||"PM 250",
    cantidadMinima:asNum(pick(row,"cantidadMinima","CANTIDAD_MINIMA")),
    stockActual:asNum(pick(row,"stockActual","STOCK_ACTUAL")),
    proyecto:asText(pick(row,"proyecto","PROYECTO"))||"TODOS",
    observaciones:asText(pick(row,"observaciones","OBSERVACIONES"))
   });
  }
 }
 registros.sort((a,b)=>String(b.fecha||"").localeCompare(String(a.fecha||""))||b.horometro-a.horometro);
 return {config,registros,programaciones,repuestos};
}
// Read original Google Sheets through the authenticated V9 relay.
export async function fetchOriginalSheetsDataset(dataset,{limit=1000}={}){
 const key=String(dataset||"").trim();
 if(!key)throw Error("V9_SHEETS_DATASET_REQUIRED");
 let session=currentSession();
 if(!session?.access_token)throw Error("V9_SESSION_REQUIRED");
 if(Number(session.expires_at||0)*1000<Date.now()+60000&&session.refresh_token)session=await refreshV9(session);
 const pageSize=Math.min(1000,Math.max(1,Number(limit)||1000));
 let refreshPromise=null,refreshed=false;
 const readPage=async offset=>{
  const request=async()=>{
   const response=await fetch("/api/v9-sheets-read",{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json","Authorization":"Bearer "+session.access_token},body:JSON.stringify({dataset:key,limit:pageSize,offset})});
   const body=await response.json().catch(()=>null);
   if(response.status===401&&session.refresh_token&&!refreshed){
    refreshed=true;
    refreshPromise=refreshPromise||refreshV9(session);
    session=await refreshPromise;
    return request();
   }
   if(!response.ok||body?.ok!==true)throw Error(body?.error||"V9_SHEETS_READ_FAILED");
   return body;
  };
  return request();
 };
 const first=await readPage(0);
 const total=Number(first.total??first.rows?.length??0);
 if(!Number.isSafeInteger(total)||total<0||total>MAX_ROWS)throw Error("V9_SHEETS_ROW_LIMIT:"+key);
 const pageCount=Math.max(1,Math.ceil(total/pageSize));
 const pages=new Array(pageCount);pages[0]=first;
 let cursor=1;
 await Promise.all(Array.from({length:Math.min(3,Math.max(0,pageCount-1))},async()=>{
  while(cursor<pageCount){
   const index=cursor++;
   pages[index]=await readPage(index*pageSize);
  }
 }));
 const all=[];
 for(let index=0;index<pageCount;index++){
  const page=pages[index],rows=Array.isArray(page?.rows)?page.rows:[];
  if(Number(page?.total??total)!==total)throw Error("V9_SHEETS_TOTAL_CHANGED_DURING_READ:"+key);
  const expected=Math.min(pageSize,Math.max(0,total-index*pageSize));
  if(rows.length!==expected)throw Error("V9_SHEETS_PAGE_COUNT_MISMATCH:"+key);
  all.push(...rows);
 }
 if(all.length!==total)throw Error("V9_SHEETS_PAGE_COUNT_MISMATCH:"+key);
 return {ok:true,source:"google-sheets-original-live",data:all,rows:all.length,total,hasMore:false,meta:{source:key,rows:all.length,total,live:true,serverTime:TIME()}};
}

export async function fetchSupabasePmSnapshot(){
 const r=await fetchOriginalSheetsDataset("mantenimiento_programado");
 const rows=Array.isArray(r.data)?r.data:[];
 const normalized=mapV9PmSourceRows(rows);
 return {ok:true,source:"google-sheets-original",...normalized,
  rows:rows.length,serverTime:TIME()};
}

// The welcome page only needs the latest operational day and last-seven-day
// activity, not the entire history of every AppSheet ROP02 sheet. Read bounded
// pages from the TAIL of the ORIGINAL Sheets and scan backwards through the
// seven-day window. Full historical sources are still fetched on demand by
// their modules, without caching this partial snapshot as a full ROP02 source.
let v9WelcomeSnapshotPending=null;
let v9WelcomeSnapshotCache=null;
export async function fetchSupabaseRop02LatestByEquipmentProject(){
  if(v9WelcomeSnapshotCache&&Date.now()-v9WelcomeSnapshotCache.at<60000)
    return v9WelcomeSnapshotCache.value;
  if(v9WelcomeSnapshotPending)return v9WelcomeSnapshotPending;
  const job=(async()=>{
    const pageSize=300;
    const sources=[];
    // Each request reads one bounded page. Read the five project tails together
    // so the welcome summary does not wait for a serial chain of Sheets roundtrips.
    let nextSource=0;
    const firstResults=new Array(ROP02_SOURCE_KEYS.length);
    await Promise.all(Array.from({length:Math.min(5,ROP02_SOURCE_KEYS.length)},async()=>{
      while(nextSource<ROP02_SOURCE_KEYS.length){
        const idx=nextSource++;
        const source=ROP02_SOURCE_KEYS[idx];
        const initial=await getPage(source,1,0);
        const total=Number(initial.total??0);
        if(!Number.isSafeInteger(total)||total<0||total>MAX_ROWS)throw Error("V9_WELCOME_INVALID_ROW_COUNT:"+source);
        const offset=Math.max(0,total-pageSize);
        const page=total?await getPage(source,total-offset,offset):{rows:[]};
        firstResults[idx]={source,total,offset,rows:(page.rows||[]).map(x=>x.payload)};
      }
    }));
    const asDate=row=>normalizeV9PmDate(row?.Fecha??row?.fecha??"");
    const dateMillis=iso=>/^\d{4}-\d{2}-\d{2}$/.test(iso)?Date.parse(iso+"T00:00:00Z"):NaN;
    const maxDate=firstResults.reduce((max,item)=>{
      for(const row of item.rows){
        const iso=asDate(row);
        if(Number.isFinite(dateMillis(iso))&&iso>max)max=iso;
      }
      return max;
    },"");
    if(!maxDate)throw Error("V9_WELCOME_NO_DATED_ROP02");
    const since=new Date(dateMillis(maxDate)-6*86400000).toISOString().slice(0,10);
    const records=[];
    // Backward pagination stops once an older date is reached. The AppSheet
    // sheets are chronological; check order and fall back to full history when
    // a source is unsorted instead of silently omitting records.
    let nextScan=0;
    await Promise.all(Array.from({length:Math.min(5,firstResults.length)},async()=>{
     while(nextScan<firstResults.length){
      const item=firstResults[nextScan++];
      let offset=item.offset;
      let pageRows=item.rows;
      let previousDate="";
      let outOfOrder=false;
      const accepted=[];
      while(true){
        let oldest="";
        for(let rowIdx=pageRows.length-1;rowIdx>=0;rowIdx--){
          const row=pageRows[rowIdx];
          const iso=asDate(row);
          if(!Number.isFinite(dateMillis(iso)))continue;
          if(previousDate&&iso>previousDate)outOfOrder=true;
          previousDate=iso;
          if(!oldest||iso<oldest)oldest=iso;
          if(iso>=since&&iso<=maxDate)accepted.push(row);
        }
        if(outOfOrder)break;
        if(offset===0||oldest&&oldest<since)break;
        const earlier=Math.max(0,offset-pageSize);
        const page=await getPage(item.source,offset-earlier,earlier);
        pageRows=(page.rows||[]).map(x=>x.payload);
        if(!pageRows.length)break;
        offset=earlier;
      }
      if(outOfOrder){
        const full=await fetchSupabaseSource(item.source);
        records.push(...(full.data||[]).filter(row=>{const date=asDate(row);return date>=since&&date<=maxDate;}));
      }else{
        records.push(...accepted);
      }
     }
    }));
    const latest=new Map();
    const asText=value=>String(value??"").trim();
    for(const row of records){
      const interno=asText(row.Interno??row.interno);
      const proyecto=asText(row.Proyecto??row.proyecto);
      const fecha=asDate(row);
      if(!interno||!proyecto||!fecha)continue;
      const key=interno.toUpperCase().replace(/[-_\s]*JM$/,"")+"|"+proyecto.toUpperCase();
      const current=latest.get(key);
      const candidate={
        INTERNO:interno,PROYECTO:proyecto,ULTIMA_FECHA:fecha,
        ULTIMO_ESTADO:row["OD o FS"]??row.Estado??row.estado??"",
        HORAS:row["Cant. Hs."]??row.cantidad_horas??row.horas??0,
        SUPERVISOR:row["Supervisor Delta"]??row.supervisor_delta??"",
        CARGAS_7D:(current?.CARGAS_7D||0)+1
      };
      if(!current||fecha>current.ULTIMA_FECHA)latest.set(key,candidate);
      else current.CARGAS_7D++;
    }
    const data=[...latest.values()].sort((a,b)=>String(a.INTERNO).localeCompare(String(b.INTERNO),"es"));
    return {ok:true,source:"google-sheets-original-recent",data,rows:data.length,total:data.length,referenceDate:maxDate};
  })();
  v9WelcomeSnapshotPending=job;
  try{
    const value=await job;
    v9WelcomeSnapshotCache={at:Date.now(),value};
    return value;
  }finally{
    if(v9WelcomeSnapshotPending===job)v9WelcomeSnapshotPending=null;
  }
}
