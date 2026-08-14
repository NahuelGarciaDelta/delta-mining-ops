import {createClient} from "@supabase/supabase-js";

const env=import.meta.env||{};
// URL y publishable key son credenciales públicas de frontend. Las variables de
// Vercel siguen teniendo prioridad; estos valores evitan que un deploy quede sin
// datos por una variable de entorno ausente.
const DEFAULT_URL="https://jwfocqaxlckuxoklwyxs.supabase.co";
const DEFAULT_PUBLISHABLE_KEY="sb_publishable_XZAcQcWEDdgtZY_NWADy1g_HxoV0UZ2";
const url=String(env.VITE_SUPABASE_URL||DEFAULT_URL).trim();
const anonKey=String(env.VITE_SUPABASE_ANON_KEY||DEFAULT_PUBLISHABLE_KEY).trim();

export const isSupabaseConfigured=Boolean(url&&anonKey);

export const supabase=isSupabaseConfigured?createClient(url,anonKey,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{headers:{"X-Client-Info":"delta-mining-ops"}},
}):null;

export function requireSupabase(){
  if(!supabase)throw new Error("Supabase no está configurado");
  return supabase;
}
