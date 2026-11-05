// ADAPTADOR V9: conserva los contratos de datos que consume el frontend Delta OPS.
import {requestV9,currentSession} from "../session.js";
import {ROP02_SOURCE_KEYS,ROP02_SOURCES} from "../../config/rop02Sources.js";
export const SUPABASE_TYPED_SOURCES=new Set([...ROP02_SOURCE_KEYS,"rop05","rma15_fs","rma15_jm","lista_equipos","insumos","mantenimiento_programado","combustible","raba03","movimientos_equipos"]);
// El relay V9 admite 1.000 filas por página. Usar ese tamaño reduce a la mitad los
// viajes autenticados sin cambiar el orden, el contenido ni los permisos de lectura.
const PAGE=1000,MAX_ROWS=60000;
const TIME=()=>new Date().toISOString();
function adaptSourceRecord(source,p,recordId){
 const result={...p,_sourceDataset:source,_sourceKey:recordId};
 if(source==="rop05"){
   // Los registros del nuevo Supabase guardan las columnas tipadas en minúsculas.
   // La app original consume encabezados de Sheets: preservar ambos nombres.
   return {...result,
     "Fecha del Parte Diario":p.fecha,Fecha:p.fecha,
     Supervisor:p.supervisor,Proyecto:p.proyecto,
     "Codigo Int":p.interno,"Código Interno del Equipo":p.interno,Interno:p.interno,
     "N° de Parte":p.numero_parte,
     "Tipo Equipo":p.tipo_equipo,Tarea:p.tarea,
     "CANTIDAD DE HS PRODUCTIVAS EFECTIVAS (SOLO CANTIDAD)":p.horas_productivas,
     Hs:p.horas_productivas,
     LARGO:p.largo,ANCHO:p.ancho,PROFUNDIDAD:p.profundidad,
     "CANTIDAD DE PRODUCCIÓN DE LA TAREA REALIZADA (SIN UNIDADES DE MEDIDA)":p.cantidad_produccion,
     Cantidad:p.cantidad_produccion,"UNIDAD DE PRODUCTIVIDAD":p.unidad,
     Unidad:p.unidad,Observaciones:p.observaciones,Mes:p.mes
   };
 }
 if(source.startsWith("rop02_")){
   // Algunas copias V9 conservan los encabezados de la planilla y otras las
   // claves normalizadas. Nunca sobrescribir un valor válido por undefined.
   const pick=(...keys)=>keys.map(key=>p[key]).find(value=>value!==undefined&&value!==null&&value!=="");
   const fecha=pick("fecha","Fecha"),interno=pick("interno","Interno"),equipo=pick("equipo","Equipo","Equipos");
   const operador=pick("operador","Operador"),supervisor=pick("supervisor_delta","Supervisor Delta");
   const supervisorCliente=pick("supervisor_vial_cliente","Supervisor Vial Cliente"),turno=pick("turno_trabajo","Turno de trabajo","Turno");
   const parte=pick("numero_parte","N° Parte"),proyecto=pick("proyecto","Proyecto","Proyecto ");
   const hi=pick("horometro_inicial","Horómetro inicial","HI"),hf=pick("horometro_final","Horómetro final","HF");
   const horas=pick("cantidad_horas","Cant. Hs."),combustible=pick("combustible","Combustible"),aceite=pick("aceite_text","aceite","Aceite");
   const trabajos=pick("descripcion_trabajos","Descripción de los trabajos realizados"),desgaste=pick("informacion_desgaste","Información sobre Desgaste","Desgaste");
   return {...result,Fecha:fecha,Interno:interno,Equipo:equipo,
     Operador:operador,"Supervisor Delta":supervisor,
     "Supervisor Vial Cliente":supervisorCliente,
     "Turno de trabajo":turno,Turno:turno,
     "N° Parte":parte,Proyecto:proyecto,
     "Horómetro inicial":hi,"Horómetro final":hf,HI:hi,HF:hf,
     "Cant. Hs.":horas,Combustible:combustible,Aceite:aceite,
     "Descripción de los trabajos realizados":trabajos,
     "Información sobre Desgaste":desgaste,Desgaste:desgaste,Observaciones:pick("observaciones","Observaciones"),
     "OD o FS":p.od_fs??p.od_o_fs??p["OD o FS"]??p.estado??p.status??"",
     Estado:p.od_fs??p.od_o_fs??p["OD o FS"]??p.estado??p.status??""
   };
 }
 if(source.startsWith("rma15_")){
   return {...result,"Fecha de OT":p.fecha_ot,Fecha:p.fecha_ot,
     Proyecto:p.proyecto,EQUIPO:p.equipo,Equipo:p.equipo,
     "CODIGO N° INTERNO":p.interno,Interno:p.interno,
     "Km / hs":p.km_hs,"TIPO DE MANTENIMIENTO":p.tipo_mantenimiento,
     "¿EQUIPO QUEDO OPERATIVO?":p.equipo_operativo===true?"SI":p.equipo_operativo===false?"NO":"",
     "TURNO EN QUE SE HIZO LA OT":p.turno,
     "INTERVENCIÓN O REPARACIÓN REALIZADA (Si es PM, especificar cual) LOS SOPLETEOS DE FILTROS VAN EN ESTA SECCION O CUALQUIER SERVICIO QUE SE REALICE)":p.intervencion,
     OBSERVACIONES:p.observaciones,"MAIL AVISADO":p.mail_avisado
   };
 }
 if(source==="lista_equipos")return {...result,
   "Código nuevo":p.codigo_nuevo,"Código anterior":p.codigo_anterior,
   "Código de Drusila":p.codigo_drusila,Familia:p.familia,
   Marca:p.marca,Modelo:p.modelo,
   Lugar:p.lugar_alquiler,"Lugar de alquiler":p.lugar_alquiler,
   "Ubicación":p.lugar_alquiler,
   Propiedad:p.propiedad};
 return result;
}
function active(){const s=currentSession();if(!s)throw Error("V9_SESSION_REQUIRED");return s;}
async function getPage(source,limit=PAGE,offset=0,entity=""){
  return requestV9({action:"rows",dataset:source,limit,offset,...(entity?{entity}:{})},active());
}
export async function fetchSupabaseSource(source){
  if(!SUPABASE_TYPED_SOURCES.has(source))throw Error("V9_SOURCE_NOT_MIGRATED:"+source);
  const data=[];let latest=0,total=0;
  for(let offset=0;offset<MAX_ROWS;offset+=PAGE){
    const result=await getPage(source,PAGE,offset);
    const rows=Array.isArray(result.rows)?result.rows:[];
    for(const r of rows){
      const payload=r?.payload;
      if(!payload||typeof payload!=="object"||Array.isArray(payload))
        throw Error("V9_INVALID_PAYLOAD:"+source);
      const row=adaptSourceRecord(source,payload,r.record_id);
      if(Number.isInteger(Number(payload._sourceRow)))row._sourceRow=Number(payload._sourceRow);
      data.push(row);
      const t=Date.parse(r.updated_at||"")||0;if(t>latest)latest=t;
    }
    total=Number(result.total??data.length);
    if(!result.hasMore||rows.length===0)break;
    if(offset+rows.length>=MAX_ROWS)throw Error("V9_ROW_LIMIT:"+source);
  }
  return {ok:true,source:"supabase-v9",data,meta:{source,rows:data.length,returnedRows:data.length,total,hasMore:false,serverVersion:latest,serverTime:TIME()}};
}
export async function fetchSupabaseStockSnapshot(){
 const data=[];let total=0;
 for(let offset=0;offset<MAX_ROWS;offset+=PAGE){
  const result=await getPage("raba03",PAGE,offset,"STOCK_EXCEL");
  const rows=Array.isArray(result.rows)?result.rows:[];
  for(const r of rows){
   const p=r?.payload;if(!p||typeof p!=="object"||Array.isArray(p))throw Error("V9_INVALID_STOCK_PAYLOAD");
   const num=v=>{const n=Number(String(v??"").replace(",", "."));return Number.isFinite(n)?n:0;};
   data.push({id:p.ID??p.id??r.record_id,codigoArticulo:String(p.CODIGO_ARTICULO??p.codigoArticulo??""),descripcion:String(p.DESCRIPCION??p.descripcion??""),descripcionAdicional:String(p.DESCRIPCION_ADICIONAL??p.descripcionAdicional??""),descripcionDeposito:String(p.DESCRIPCION_DEPOSITO??p.descripcionDeposito??""),controlStock:String(p.CONTROL_STOCK??p.controlStock??""),saldoControlStock:num(p.SALDO_CONTROL_STOCK??p.saldoControlStock),stockMaximo:num(p.STOCK_MAXIMO??p.stockMaximo),stockMinimo:num(p.STOCK_MINIMO??p.stockMinimo)});
  }
  total=Number(result.total??data.length);
  if(!result.hasMore||rows.length===0)break;
  if(offset+rows.length>=MAX_ROWS)throw Error("V9_ROW_LIMIT:stock_excel");
 }
 const meta={version:1,active:data.length>0,activeSheet:"STOCK CRITICO",fileName:"Saldos.xlsx",sourceSheet:"STOCK CRITICO",rowCount:total,validRows:total,updatedAt:"2026-08-07T22:59:15.409Z"};
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
