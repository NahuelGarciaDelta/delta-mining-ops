// Política única de carga/actualización de Delta Mining OPS.
// Regla general: mostrar cache válido inmediatamente y revalidar sin bloquear.
export const DATA_REFRESH_INTERVAL_MS=10*60*1000;
export const LEGACY_REFRESH_INTERVAL_MS=5*60*1000;
export const DATA_REFRESH_POLICY_EVENT="dm-data-refresh-policy-tick";

let intervalPolicyInstalled=false;
let nativeSetInterval=null;

// Compatibilidad con módulos legacy que todavía tengan un intervalo de 5 minutos
// hardcodeado. Se normaliza a 10 minutos sin tocar otros timers de la aplicación.
export function installLegacyRefreshIntervalPolicy(){
  if(intervalPolicyInstalled||typeof window==="undefined")return;
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
