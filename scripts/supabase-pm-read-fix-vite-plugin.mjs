const TARGET='/src/services/supabaseReadApi.js';

export function supabasePmReadFixVitePlugin(){
  return{
    name:'delta-supabase-pm-read-fix',
    enforce:'pre',
    transform(code,id){
      if(!String(id||'').replace(/\\/g,'/').endsWith(TARGET))return null;
      const from=`export async function fetchSupabasePmSnapshot(){\n  const {data}=await request("/rest/v1/rpc/app_pm_snapshot",{method:"POST",body:{},timeoutMs:12000});\n  return data||{ok:false,error:{message:"Supabase no devolvió Mantenimiento Programado."}};\n}`;
      const to=`export async function fetchSupabasePmSnapshot(){\n  // app_pm_snapshot es STABLE y sin argumentos: GET evita los HTTP 400 observados\n  // al reenviar el body de un POST a través del proxy same-origin de Vercel.\n  const {data}=await request("/rest/v1/rpc/app_pm_snapshot",{method:"GET",timeoutMs:20000});\n  return data||{ok:false,error:{message:"Supabase no devolvió Mantenimiento Programado."}};\n}`;
      if(!code.includes(from))throw new Error('[delta-supabase-pm-read-fix] No se encontró fetchSupabasePmSnapshot');
      const out=code.replace(from,to);
      if(!out.includes('app_pm_snapshot",{method:"GET"'))throw new Error('[delta-supabase-pm-read-fix] No quedó aplicada la lectura GET de PM');
      return {code:out,map:null};
    }
  };
}
