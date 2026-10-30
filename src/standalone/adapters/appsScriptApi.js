// Misma API interna que Delta OPS; todas las fuentes pasan exclusivamente por V9.
import {ROP02_SOURCE_KEYS} from "../../config/rop02Sources.js";
import {requestV9,currentSession} from "../session.js";
import {
 SUPABASE_TYPED_SOURCES,fetchSupabaseSource,fetchSupabaseHealth,
 fetchSupabasePmSnapshot,fetchSupabaseDatasetQuery,fetchSupabaseVersions
} from "./supabaseReadApi.js";
export function expandCompactSource(src){
 if(!src?.compact||!Array.isArray(src.headers)||!Array.isArray(src.rows))return src;
 return {...src,compact:false,data:src.rows.map(row=>Object.fromEntries(src.headers.map((h,i)=>[h,row?.[i]??""])))};
}
export function expandCompactResponse(j){if(!j)return j;if(j.compact)return expandCompactSource(j);if(j.sources)return {...j,sources:Object.fromEntries(Object.entries(j.sources).map(([k,v])=>[k,expandCompactSource(v)]))};return j;}
export function buildAppsScriptUrl(_base,action){return "/api/v9-blocked?action="+encodeURIComponent(action);}
export function sleep_(ms){return new Promise(r=>setTimeout(r,ms));}
export function resetAppsScriptInflightForTests(){}
export async function runWithConcurrency_(items,limit,worker){
 let i=0;const out=new Array(items.length);
 await Promise.all(Array.from({length:Math.min(items.length,Math.max(1,Number(limit)||1))},async()=>{
 while(i<items.length){const n=i++;try{out[n]={status:"fulfilled",value:await worker(items[n],n)}}catch(e){out[n]={status:"rejected",reason:e}}}
 }));return out;
}
export async function fetchAction(_url,action,{params={}}={}){
 const k=String(action||"");
 if(k==="health"||k==="diag")return fetchSupabaseHealth();
 if(["versions","get_data_versions"].includes(k))return fetchSupabaseVersions();
 if(k==="mantenimiento_programado")return fetchSupabasePmSnapshot();
 if(k==="query_dataset")return fetchSupabaseDatasetQuery(params);
 if(SUPABASE_TYPED_SOURCES.has(k))return fetchSupabaseSource(k);
 throw Error("V9_SOURCE_NOT_MIGRATED:"+k);
}
export async function fetchSource(_url,source,options={}){return fetchAction(_url,source,options)}
export async function fetchHealth(_url){return fetchSupabaseHealth()}
export async function fetchSyncVersions(_url){return fetchSupabaseVersions()}
export async function fetchRop02Bundle(){
 const sources={};const all=await Promise.all(ROP02_SOURCE_KEYS.map(fetchSupabaseSource));
 ROP02_SOURCE_KEYS.forEach((key,i)=>{sources[key]=all[i]});
 return {ok:true,source:"supabase-v9",bundleId:"v9-"+Date.now(),sources};
}
export async function fetchDatasetQuery(_url,params){return fetchSupabaseDatasetQuery(params)}
