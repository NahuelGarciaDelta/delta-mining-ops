import {requireSupabase} from "./supabaseClient.js";

const MIRRORED_SOURCES=new Set([
  "insumos","lista_equipos","raba03","remitos_cargados",
  "licitaciones_db","licitacion_hitos_db","licitacion_equipos_db",
  "pm_config","pm_registros"
]);

const PAGE=1000;

export function isSupabaseMirrorSource(source){
  return MIRRORED_SOURCES.has(String(source||"").toLowerCase());
}

export async function fetchSupabaseMirrorSource(source){
  const dataset=String(source||"").toLowerCase();
  if(!isSupabaseMirrorSource(dataset))return null;
  const rows=[];
  let offset=0;
  for(;;){
    const {data,error}=await requireSupabase()
      .from("delta_dataset_rows")
      .select("source_row,row_data")
      .eq("dataset",dataset)
      .order("source_row",{ascending:true})
      .range(offset,offset+PAGE-1);
    if(error)throw new Error(`Supabase ${dataset}: ${error.message}`);
    const page=data||[];
    rows.push(...page.map(item=>item?.row_data||{}));
    if(page.length<PAGE)break;
    offset+=PAGE;
  }
  return {ok:true,source:dataset,data:rows,rows:rows.length,total:rows.length,compact:false,backend:"supabase"};
}
