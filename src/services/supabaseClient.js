import {createClient} from "@supabase/supabase-js";

const env=(typeof import.meta!=="undefined"&&import.meta.env)?import.meta.env:{};

// Estos valores son públicos por diseño en una SPA: la URL del proyecto y la
// publishable key terminan incluidas en el bundle del navegador. Las variables
// de entorno siguen teniendo prioridad para permitir rotación/configuración por
// deployment, pero la app local no queda inutilizable si .env.local no existe.
const DEFAULT_SUPABASE_URL="https://jwfocqaxlckuxoklwyxs.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY="sb_publishable_XZAcQcWEDdgtZY_NWADy1g_HxoV0UZ2";

const url=String(env.VITE_SUPABASE_URL||DEFAULT_SUPABASE_URL).trim();
const anonKey=String(env.VITE_SUPABASE_ANON_KEY||DEFAULT_SUPABASE_PUBLISHABLE_KEY).trim();

export const isSupabaseConfigured=Boolean(url&&anonKey);

export const supabase=isSupabaseConfigured?createClient(url,anonKey,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{headers:{"X-Client-Info":"delta-mining-web-supabase"}},
}):null;

export function requireSupabase(){
  if(!supabase)throw new Error("Supabase no está configurado para esta aplicación.");
  return supabase;
}
