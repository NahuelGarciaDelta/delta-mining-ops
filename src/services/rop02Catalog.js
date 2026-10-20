import {fetchSupabaseRop02Catalog,SUPABASE_TYPED_SOURCES} from "./supabaseReadApi.js";
import {registerRop02Source,ROP02_SOURCE_KEYS} from "../config/rop02Sources.js";
import {attachRop02SourceToViews} from "../config/viewSources.js";
import {attachRop02SourceToDashboard} from "../modules/home/dashboardSnapshotPolicy.js";

/**
 * Descubrimiento ROP02 automático. Una consulta RPC pequeña antes de hidratar
 * los módulos. Si Supabase no responde, la app sigue funcionando con sus
 * fuentes conocidas. No guarda IDs de Sheets ni token en el navegador.
 */
export async function bootstrapRop02Catalog(){
  try{
    const records=await fetchSupabaseRop02Catalog();
    let added=0;
    for(const record of records){
      const dataset=String(record?.dataset||"").trim().toLowerCase();
      const project=String(record?.project||"").trim();
      if(!registerRop02Source({dataset,project}))continue;
      SUPABASE_TYPED_SOURCES.add(dataset);
      attachRop02SourceToViews(dataset);
      attachRop02SourceToDashboard({dataset,project});
      added++;
    }
    return {ok:true,registered:ROP02_SOURCE_KEYS.length,newSources:added};
  }catch(error){
    // Evita bloquear el ingreso a la app por indisponibilidad del catálogo.
    console.warn("ROP02: catálogo temporalmente inaccesible; usando fuentes existentes",error?.message||error);
    return {ok:false,registered:ROP02_SOURCE_KEYS.length,newSources:0};
  }
}
