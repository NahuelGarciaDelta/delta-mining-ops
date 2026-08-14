import {requireSupabase} from "./supabaseClient.js";

export async function fetchSupabaseSpecialCache(cacheKey){
  const key=String(cacheKey||"").trim();
  if(!key)return null;
  const {data,error}=await requireSupabase()
    .from("delta_special_cache")
    .select("payload,updated_at")
    .eq("cache_key",key)
    .maybeSingle();
  if(error)throw new Error(`Supabase cache ${key}: ${error.message}`);
  if(!data)return null;
  const payload=data.payload;
  if(payload&&typeof payload==="object"&&!Array.isArray(payload))return {...payload,_supabaseUpdatedAt:data.updated_at};
  return {ok:true,data:payload,_supabaseUpdatedAt:data.updated_at};
}
