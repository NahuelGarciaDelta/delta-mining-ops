import {installSheetMutationSupabaseMirror} from "./sheetMutationSupabaseMirror.js";

// Política única de carga/actualización de Delta Mining OPS.
// Regla general: mostrar cache válido inmediatamente y revalidar sin bloquear.
export const DATA_REFRESH_INTERVAL_MS=5*60*1000;
export const LEGACY_REFRESH_INTERVAL_MS=5*60*1000;
export const DATA_REFRESH_POLICY_EVENT="dm-data-refresh-policy-tick";

let intervalPolicyInstalled=false;
let nativeSetInterval=null;

// Compatibilidad con módulos legacy: cualquier intervalo histórico de 5 minutos
// queda alineado con la política global de 5 minutos, sin modificar otros timers.
// El mismo bootstrap instala el mirror Sheets -> Supabase antes de montar React,
// así ninguna escritura confirmada por Apps Script queda fuera de sincronización.
export function installLegacyRefreshIntervalPolicy(){
  if(typeof window==="undefined")return;
  installSheetMutationSupabaseMirror();
  if(intervalPolicyInstalled)return;
  intervalPolicyInstalled=true;
  nativeSetInterval=window.setInterval.bind(window);
  window.setInterval=(handler,delay,...args)=>{
    const normalized=Number(delay)===LEGACY_REFRESH_INTERVAL_MS
      ?DATA_REFRESH_INTERVAL_MS
      :delay;
    return nativeSetInterval(handler,normalized,...args);
  };
}

export function dispatchDataRefreshPolicyTick(reason="auto"){
  if(typeof window==="undefined"||typeof window.dispatchEvent!=="function")return;
  try{
    window.dispatchEvent(new CustomEvent(DATA_REFRESH_POLICY_EVENT,{detail:{reason,at:Date.now()}}));
  }catch(_){}
}
