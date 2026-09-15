const env=(typeof import.meta!=="undefined"&&import.meta.env)?import.meta.env:{};
const SUPABASE_URL=String(env.VITE_SUPABASE_URL||"https://jwfocqaxlckuxoklwyxs.supabase.co").replace(/\/+$/,"");
const SUPABASE_KEY=String(env.VITE_SUPABASE_ANON_KEY||"sb_publishable_XZAcQcWEDdgtZY_NWADy1g_HxoV0UZ2").trim();
const PAGE_SIZE=1000;
const TIMEOUT_MS=12000;

function headers(extra={}){return {apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,Accept:"application/json",...extra};}

async function page(offset){
  const controller=typeof AbortController!=="undefined"?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),TIMEOUT_MS):null;
  try{
    const url=`${SUPABASE_URL}/rest/v1/abastecimiento_raba03?select=source_row,row_data,synced_at&order=source_row.asc&limit=${PAGE_SIZE}&offset=${offset}`;
    const res=await fetch(url,{cache:"no-store",signal:controller?.signal,headers:headers()});
    const text=await res.text();
    if(!res.ok)throw new Error(`Supabase RABA03 HTTP ${res.status}: ${text.slice(0,180)}`);
    let data=[];
    try{data=text?JSON.parse(text):[];}catch(_){throw new Error("Supabase RABA03 devolvió una respuesta inválida");}
    return Array.isArray(data)?data:[];
  }catch(error){
    if(error?.name==="AbortError")throw new Error("RABA03 no respondió dentro de 12 segundos");
    throw error;
  }finally{if(timer)clearTimeout(timer);}
}

export async function fetchRaba03FromSupabase(){
  const first=await page(0);
  let raw=[...first];
  if(first.length===PAGE_SIZE){
    for(let offset=PAGE_SIZE;;offset+=PAGE_SIZE){
      const next=await page(offset);
      raw.push(...next);
      if(next.length<PAGE_SIZE)break;
    }
  }
  const data=raw.map(row=>({...((row&&row.row_data)||{}),_sourceRow:row?.source_row??null}));
  const latest=raw.reduce((max,row)=>Math.max(max,new Date(row?.synced_at||0).getTime()||0),0);
  return {ok:true,source:"supabase",data,meta:{rows:data.length,serverTime:new Date(latest||Date.now()).toISOString()}};
}

export async function fetchAbastecimientoSnapshot(){
  const controller=typeof AbortController!=="undefined"?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),TIMEOUT_MS):null;
  try{
    const res=await fetch(`${SUPABASE_URL}/rest/v1/rpc/abastecimiento_snapshot`,{
      method:"POST",
      cache:"no-store",
      signal:controller?.signal,
      headers:headers({"Content-Type":"application/json"}),
      body:"{}"
    });
    const text=await res.text();
    if(!res.ok)throw new Error(`Supabase Abastecimiento HTTP ${res.status}: ${text.slice(0,180)}`);
    let data={};
    try{data=text?JSON.parse(text):{};}catch(_){throw new Error("Supabase Abastecimiento devolvió una respuesta inválida");}
    return {...(data||{}),ok:true,source:"supabase"};
  }catch(error){
    if(error?.name==="AbortError")throw new Error("Abastecimiento no respondió dentro de 12 segundos");
    throw error;
  }finally{if(timer)clearTimeout(timer);}
}
