const TARGET='/src/services/supabaseReadApi.js';

export function supabasePmReadFixVitePlugin(){
  let command='build';
  return{
    name:'delta-supabase-pm-read-fix',
    enforce:'pre',
    configResolved(config){
      command=config.command;
    },
    transform(code,id){
      if(!String(id||'').replace(/\\/g,'/').endsWith(TARGET))return null;

      // En npm run dev no debemos parchear este módulo. La lectura directa a
      // Supabase funciona localmente y evitamos que un parche pensado para el
      // build de Vercel pueda impedir que Vite arranque.
      if(command==='serve')return null;

      // Si ya está aplicado, no volver a tocar el código.
      if(/app_pm_snapshot["']\s*,\s*\{\s*method\s*:\s*["']GET["']/.test(code))return null;

      const pattern=/export\s+async\s+function\s+fetchSupabasePmSnapshot\s*\(\s*\)\s*\{[\s\S]*?request\(\s*["']\/rest\/v1\/rpc\/app_pm_snapshot["']\s*,\s*\{[\s\S]*?method\s*:\s*["']POST["'][\s\S]*?\}\s*\)\s*;[\s\S]*?return\s+data\s*\|\|\s*\{\s*ok\s*:\s*false\s*,\s*error\s*:\s*\{\s*message\s*:\s*["']Supabase no devolvió Mantenimiento Programado\.["']\s*\}\s*\}\s*;?\s*\}/;

      if(!pattern.test(code))throw new Error('[delta-supabase-pm-read-fix] No se encontró fetchSupabasePmSnapshot');

      const replacement=`export async function fetchSupabasePmSnapshot(){\n  // app_pm_snapshot es STABLE y sin argumentos: GET evita los HTTP 400 observados\n  // al reenviar el body de un POST a través del proxy same-origin de Vercel.\n  const {data}=await request("/rest/v1/rpc/app_pm_snapshot",{method:"GET",timeoutMs:20000});\n  return data||{ok:false,error:{message:"Supabase no devolvió Mantenimiento Programado."}};\n}`;

      const out=code.replace(pattern,replacement);
      if(!/app_pm_snapshot["']\s*,\s*\{\s*method\s*:\s*["']GET["']/.test(out))throw new Error('[delta-supabase-pm-read-fix] No quedó aplicada la lectura GET de PM');
      return {code:out,map:null};
    }
  };
}
