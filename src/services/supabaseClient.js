import {createClient} from "@supabase/supabase-js";

const env=import.meta.env||{};
const url=String(env.VITE_SUPABASE_URL||"").trim();
const anonKey=String(env.VITE_SUPABASE_ANON_KEY||"").trim();

export const isSupabaseConfigured=Boolean(url&&anonKey);

export const supabase=isSupabaseConfigured?createClient(url,anonKey,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{headers:{"X-Client-Info":"delta-mining-ops"}},
}):null;

export function requireSupabase(){
  if(!supabase)throw new Error("Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY");
  return supabase;
}
