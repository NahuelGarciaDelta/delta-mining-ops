import {requireSupabase} from "./supabaseClient.js";

const GENERIC_MIRRORS=new Set([
  "insumos","lista_equipos","raba03","remitos_cargados",
  "licitaciones_db","licitacion_hitos_db","licitacion_equipos_db",
  "pm_config","pm_registros"
]);
const ROP02_SOURCES=new Set(["rop02_fs","rop02_jm","rop02_filosur","rop02_zorro"]);
const RMA15_SOURCES=new Set(["rma15_fs","rma15_jm"]);
const MIRRORED_SOURCES=new Set([...GENERIC_MIRRORS,...ROP02_SOURCES,...RMA15_SOURCES,"rop05"]);
const PAGE=1000;

export function isSupabaseMirrorSource(source){
  return MIRRORED_SOURCES.has(String(source||"").toLowerCase());
}

async function fetchPages(table,select,configure){
  const rows=[];
  for(let offset=0;;offset+=PAGE){
    let query=requireSupabase().from(table).select(select);
    query=configure(query).range(offset,offset+PAGE-1);
    const {data,error}=await query;
    if(error)throw new Error(`Supabase ${table}: ${error.message}`);
    const page=data||[];rows.push(...page);
    if(page.length<PAGE)break;
  }
  return rows;
}

function rop02Legacy(row={}){
  return {
    ...row,
    Fecha:row.fecha,Interno:row.interno,Equipo:row.equipo,Operador:row.operador,
    "Supervisor Delta":row.supervisor_delta,"Supervisor Vial Cliente":row.supervisor_vial_cliente,
    "Turno de trabajo":row.turno_trabajo,"N° Parte":row.numero_parte,Proyecto:row.proyecto,
    "Horómetro inicial":row.horometro_inicial,"Horómetro final":row.horometro_final,
    "Cant. Hs.":row.cantidad_horas,Combustible:row.combustible,Aceite:row.aceite,
    "Descripción de los trabajos realizados":row.descripcion_trabajos,
    "Información sobre Desgaste":row.informacion_desgaste,Observaciones:row.observaciones,Estado:row.estado,
  };
}
function rop05Legacy(row={}){
  return {...(row.raw_data||{}),
    "Fecha del Parte Diario":row.fecha,"Supervisor":row.supervisor,"Proyecto":row.proyecto,"Codigo Int":row.interno,
    "N° de Parte":row.numero_parte,"Tipo Equipo":row.tipo_equipo,"Tarea":row.tarea,
    "CANTIDAD DE HS PRODUCTIVAS EFECTIVAS\n(SOLO CANTIDAD)":row.horas_productivas,
    "LARGO":row.largo,"ANCHO":row.ancho,"PROFUNDIDAD":row.profundidad,
    "CANTIDAD DE PRODUCCIÓN DE LA TAREA REALIZADA\n(SIN UNIDADES DE MEDIDA)":row.cantidad_produccion,
    "UNIDAD DE PRODUCTIVIDAD":row.unidad,"Observación":row.observaciones,"Mes":row.mes,
  };
}
function rma15Legacy(row={}){
  const out={...(row.raw_data||{}),"Fecha de OT":row.fecha_ot,"EQUIPO":row.equipo,"CODIGO N° INTERNO":row.interno,
    "Km / hs":row.km_hs,"TIPO DE MANTENIMIENTO":row.tipo_mantenimiento,
    "¿EQUIPO QUEDO OPERATIVO?":row.equipo_operativo?"SI":"NO","TURNO EN QUE SE HIZO LA OT":row.turno,
    "LUGAR DONDE ESTAN LOS EQUIPOS":row.lugar,"OBSERVACIONES":row.observaciones,"MAIL AVISADO":row.mail_avisado,
    "INTERVENCIÓN O REPARACIÓN REALIZADA (Si es PM, especificar cual) LOS SOPLETEOS DE FILTROS VAN EN ESTA SECCION O CUALQUIER SERVICIO QUE SE REALICE)":row.intervencion,
    Proyecto:row.proyecto,
  };
  (Array.isArray(row.rma15_insumos)?row.rma15_insumos:[]).forEach(item=>{
    const pos=Number(item.posicion)||0;if(pos<1||pos>10)return;
    out[`codigo ${pos}`]=item.codigo??"";out[`nombre ${pos}`]=item.nombre??"";out[`cantidad ${pos}`]=item.cantidad??0;
  });
  return out;
}

async function fetchGeneric(dataset){
  const records=await fetchPages("delta_dataset_rows","source_row,row_data",q=>q.eq("dataset",dataset).order("source_row",{ascending:true}));
  return records.map(item=>item?.row_data||{});
}
async function fetchRop02(dataset){
  const records=await fetchPages("rop02_frontend","*",q=>q.eq("source_dataset",dataset).order("source_row",{ascending:true}));
  return records.map(rop02Legacy);
}
async function fetchRop05(){
  const records=await fetchPages("rop05","*",q=>q.order("source_dataset",{ascending:true}).order("source_row",{ascending:true}));
  return records.map(rop05Legacy);
}
async function fetchRma15(dataset){
  const records=await fetchPages("rma15_frontend","*",q=>q.eq("source_dataset",dataset).order("source_row",{ascending:true}));
  return records.map(rma15Legacy);
}

export async function fetchSupabaseMirrorSource(source){
  const dataset=String(source||"").toLowerCase();
  if(!isSupabaseMirrorSource(dataset))return null;
  let rows;
  if(ROP02_SOURCES.has(dataset))rows=await fetchRop02(dataset);
  else if(RMA15_SOURCES.has(dataset))rows=await fetchRma15(dataset);
  else if(dataset==="rop05")rows=await fetchRop05();
  else rows=await fetchGeneric(dataset);
  return {ok:true,source:dataset,data:rows,rows:rows.length,total:rows.length,compact:false,backend:"supabase",meta:{rows:rows.length}};
}
