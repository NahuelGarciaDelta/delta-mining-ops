// ADAPTADOR V9: conserva los contratos de datos que consume el frontend Delta OPS.
import {requestV9,currentSession} from "../session.js";
import {ROP02_SOURCE_KEYS,ROP02_SOURCES} from "../../config/rop02Sources.js";
export const SUPABASE_TYPED_SOURCES=new Set([...ROP02_SOURCE_KEYS,"rop05","rma15_fs","rma15_jm","lista_equipos","insumos","mantenimiento_programado","combustible","raba03"]);
const PAGE=100,MAX_ROWS=60000;
const TIME=()=>new Date().toISOString();
function active(){const s=currentSession();if(!s)throw Error("V9_SESSION_REQUIRED");return s;}
async function getPage(source,limit=PAGE,offset=0){
  return requestV9({action:"rows",dataset:source,limit,offset},active());
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
      const row={...payload,_sourceDataset:source,_sourceKey:r.record_id};
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
export async function fetchSupabasePmSnapshot(){return {ok:false,error:{message:"Mantenimiento programado todavía no migrado al Supabase V9."}};}
export async function fetchSupabaseRop02LatestByEquipmentProject(){
  return {ok:true,source:"supabase-v9",data:[],rows:0,total:0,referenceDate:""};
}
