// ADAPTADOR V9: conserva los contratos de datos que consume el frontend Delta OPS.
import {requestV9,currentSession} from "../session.js";
import {ROP02_SOURCE_KEYS,ROP02_SOURCES} from "../../config/rop02Sources.js";
export const SUPABASE_TYPED_SOURCES=new Set([...ROP02_SOURCE_KEYS,"rop05","rma15_fs","rma15_jm","lista_equipos","insumos","mantenimiento_programado","combustible","raba03","movimientos_equipos","movimientos_taller"]);
// El relay V9 admite 1.000 filas por página. Usar ese tamaño reduce a la mitad los
// viajes autenticados sin cambiar el orden, el contenido ni los permisos de lectura.
const PAGE=1000,MAX_ROWS=60000;
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
    const workers=Array.from({length:Math.min(3,Math.max(0,pageCount-1))},async()=>{
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
  const date=v=>String(v??"").slice(0,10);
  const from=String(params.desde||"").slice(0,10),to=String(params.hasta||"").slice(0,10);
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
export async function fetchSupabasePmSnapshot(){
 const r=await fetchSupabaseSource("mantenimiento_programado");
 const rows=Array.isArray(r.data)?r.data:[];
 const kind=row=>String(row?._entity||row?.entity||row?.tipo_registro||row?.tipo||"").trim().toUpperCase();
 const config=[],registros=[],programaciones=[],repuestos=[];
 for(const row of rows){
  const k=kind(row);
  if(k==="CONFIG"||k==="PM_CONFIG"||(!k&&("INTERVALO_HS" in row||"intervalo_hs" in row)))config.push(row);
  else if(k==="REGISTRO"||k==="REGISTROS"||k==="PM_REGISTROS"||(!k&&("ID_PM" in row||"id_pm" in row)))registros.push(row);
  else if(k==="PROGRAMACION"||k==="PROGRAMACIONES"||k==="PM_PROGRAMACION"||(!k&&("DURACION_HS" in row||"duracion_hs" in row)))programaciones.push(row);
  else if(k==="REPUESTO"||k==="REPUESTOS"||k==="PM_REPUESTOS"||(!k&&("CANTIDAD_MINIMA" in row||"cantidad_minima" in row)))repuestos.push(row);
 }
 return {ok:true,source:"supabase-v9",config,registros,programaciones,repuestos,
  rows:rows.length,serverTime:TIME()};
}
export async function fetchSupabaseRop02LatestByEquipmentProject(){
  // La pantalla de bienvenida usa este snapshot para sus tarjetas. Antes V9
  // respondía un arreglo vacío, por lo que OD, FS y disponibilidad quedaban
  // permanentemente en "Cargando" aunque los ROP02 ya estuvieran disponibles.
  const results=await Promise.all(ROP02_SOURCE_KEYS.map(fetchSupabaseSource));
  const latest=new Map();
  const asDate=value=>String(value??"").slice(0,10);
  const asText=value=>String(value??"").trim();
  for(const source of results){
    for(const row of source?.data||[]){
      const interno=asText(row.Interno??row.interno);
      const proyecto=asText(row.Proyecto??row.proyecto);
      const fecha=asDate(row.Fecha??row.fecha);
      if(!interno||!proyecto||!fecha)continue;
      const key=`${interno.toUpperCase()}|${proyecto.toUpperCase()}`;
      const current=latest.get(key);
      if(!current||fecha>current.ULTIMA_FECHA){
        latest.set(key,{
          INTERNO:interno,PROYECTO:proyecto,ULTIMA_FECHA:fecha,
          ULTIMO_ESTADO:row["OD o FS"]??row.Estado??row.estado??"",
          HORAS:row["Cant. Hs."]??row.cantidad_horas??row.horas??0,
          SUPERVISOR:row["Supervisor Delta"]??row.supervisor_delta??"",
          CARGAS_7D:1
        });
      }
    }
  }
  const data=[...latest.values()].sort((a,b)=>String(a.INTERNO).localeCompare(String(b.INTERNO),"es"));
  const referenceDate=data.reduce((max,row)=>row.ULTIMA_FECHA>max?row.ULTIMA_FECHA:max,"");
  return {ok:true,source:"supabase-v9",data,rows:data.length,total:data.length,referenceDate};
}
