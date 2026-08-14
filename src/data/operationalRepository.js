import {requireSupabase} from "../services/supabaseClient.js";

const PAGE_SIZE=250;
const SERVER_PAGE_SIZE=2000;
const asArray=value=>Array.isArray(value)?value.filter(Boolean):(value?[value]:[]);
function applyMulti(query,column,value){const values=asArray(value);if(values.length===1)return query.eq(column,values[0]);if(values.length>1)return query.in(column,values);return query;}
function pageMeta(data,count,offset){const rows=(data||[]),total=Number(count||0),next=offset+rows.length;return{rows,total,hasMore:next<total,nextOffset:next<total?next:null};}

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
  const base={...(row.raw_data||{}),"Fecha de OT":row.fecha_ot,"EQUIPO":row.equipo,"CODIGO N° INTERNO":row.interno,
    "Km / hs":row.km_hs,"TIPO DE MANTENIMIENTO":row.tipo_mantenimiento,
    "¿EQUIPO QUEDO OPERATIVO?":row.equipo_operativo?"SI":"NO","TURNO EN QUE SE HIZO LA OT":row.turno,
    "LUGAR DONDE ESTAN LOS EQUIPOS":row.lugar,"OBSERVACIONES":row.observaciones,"MAIL AVISADO":row.mail_avisado,
    "INTERVENCIÓN O REPARACIÓN REALIZADA (Si es PM, especificar cual) LOS SOPLETEOS DE FILTROS VAN EN ESTA SECCION O CUALQUIER SERVICIO QUE SE REALICE)":row.intervencion,
    Proyecto:row.proyecto,
  };
  const insumos=Array.isArray(row.rma15_insumos)?row.rma15_insumos:[];
  insumos.forEach(item=>{
    const pos=Number(item.posicion)||0;if(pos<1||pos>10)return;
    base[`codigo ${pos}`]=item.codigo??"";base[`nombre ${pos}`]=item.nombre??"";base[`cantidad ${pos}`]=item.cantidad??0;
  });
  return base;
}

async function getRop05SinglePage(params={}){
  const limit=Math.min(Math.max(Number(params.limit)||PAGE_SIZE,1),SERVER_PAGE_SIZE),offset=Math.max(Number(params.offset)||0,0);
  let q=requireSupabase().from("rop05").select("*",{count:"exact"});
  if(params.desde)q=q.gte("fecha",params.desde);if(params.hasta)q=q.lte("fecha",params.hasta);
  q=applyMulti(q,"proyecto",params.proyecto);q=applyMulti(q,"interno",params.equipo);q=applyMulti(q,"supervisor",params.supervisor);q=applyMulti(q,"tipo_equipo",params.tipo);q=applyMulti(q,"unidad",params.unidad);
  if(params.tarea){const values=asArray(params.tarea);if(values.length)q=q.or(values.map(v=>`tarea.ilike.%${String(v).replace(/[%_,()]/g," ")}%`).join(","));}
  const sort={fecha:"fecha",maquina:"interno",equipo:"interno",supervisor:"supervisor",proyecto:"proyecto",tarea:"tarea",unidad:"unidad",horas:"horas_productivas"}[params.sortBy]||"fecha";
  q=q.order(sort,{ascending:String(params.sortDirection||"asc").toLowerCase()!=="desc"}).order("source_dataset",{ascending:true}).order("source_row",{ascending:true}).range(offset,offset+limit-1);
  const {data,error,count}=await q;if(error)throw new Error(`Supabase ROP05: ${error.message}`);
  const meta=pageMeta(data,count,offset),rows=(data||[]).map(rop05Legacy);return{ok:true,data:rows,rows:rows.length,total:meta.total,hasMore:meta.hasMore,nextOffset:meta.nextOffset,source:"supabase"};
}

export async function getRop05Page(params={}){
  if(params.limit!=="all")return getRop05SinglePage(params);
  const all=[];let offset=Math.max(Number(params.offset)||0,0),total=0;
  for(;;){const page=await getRop05SinglePage({...params,limit:SERVER_PAGE_SIZE,offset});total=page.total;all.push(...page.data);if(!page.hasMore||!page.data.length)break;offset=page.nextOffset;}
  return{ok:true,data:all,rows:all.length,total,hasMore:false,nextOffset:null,source:"supabase"};
}

async function getRma15SinglePage(params={}){
  const limit=Math.min(Math.max(Number(params.limit)||PAGE_SIZE,1),SERVER_PAGE_SIZE),offset=Math.max(Number(params.offset)||0,0);
  let q=requireSupabase().from("rma15_frontend").select("*",{count:"exact"});
  if(params.desde)q=q.gte("fecha_ot",params.desde);if(params.hasta)q=q.lte("fecha_ot",params.hasta);
  q=applyMulti(q,"proyecto",params.proyecto);q=applyMulti(q,"interno",params.equipo);q=applyMulti(q,"tipo_mantenimiento",params.tipo||params.tipoMant);
  const sort={fecha:"fecha_ot",maquina:"interno",equipo:"interno",proyecto:"proyecto",tipoMant:"tipo_mantenimiento",intervencion:"intervencion",operativo:"equipo_operativo"}[params.sortBy]||"fecha_ot";
  q=q.order(sort,{ascending:String(params.sortDirection||"asc").toLowerCase()!=="desc"}).order("source_dataset",{ascending:true}).order("source_row",{ascending:true}).range(offset,offset+limit-1);
  const {data,error,count}=await q;if(error)throw new Error(`Supabase RMA15: ${error.message}`);
  const meta=pageMeta(data,count,offset),rows=(data||[]).map(rma15Legacy);return{ok:true,data:rows,rows:rows.length,total:meta.total,hasMore:meta.hasMore,nextOffset:meta.nextOffset,source:"supabase"};
}

export async function getRma15Page(params={}){
  if(params.limit!=="all")return getRma15SinglePage(params);
  const all=[];let offset=Math.max(Number(params.offset)||0,0),total=0;
  for(;;){const page=await getRma15SinglePage({...params,limit:SERVER_PAGE_SIZE,offset});total=page.total;all.push(...page.data);if(!page.hasMore||!page.data.length)break;offset=page.nextOffset;}
  return{ok:true,data:all,rows:all.length,total,hasMore:false,nextOffset:null,source:"supabase"};
}

async function fetchAllPages(fetcher,params,onPage=()=>{}){let offset=0,total=0;do{const page=await fetcher({...params,limit:SERVER_PAGE_SIZE,offset});total=page.total;await onPage(page.data,{offset:page.nextOffset,total,hasMore:page.hasMore});if(!page.hasMore||!page.data.length)break;offset=page.nextOffset;}while(offset<total);return{total};}
export const fetchAllRop05Pages=(params,onPage)=>fetchAllPages(getRop05SinglePage,params,onPage);
export const fetchAllRma15Pages=(params,onPage)=>fetchAllPages(getRma15SinglePage,params,onPage);

async function fetchAllRma15Rows(selectColumns,configure=query=>query){
  const all=[],PAGE=1000;
  for(let offset=0;;offset+=PAGE){
    let q=requireSupabase().from("rma15").select(selectColumns);
    q=configure(q).range(offset,offset+PAGE-1);
    const {data,error}=await q;
    if(error)throw new Error(`Supabase RMA15: ${error.message}`);
    const page=data||[];all.push(...page);if(page.length<PAGE)break;
  }
  return all;
}

export async function getRma15EquipmentUniverse({year="2026"}={}){
  const from=`${year}-01-01`,to=`${year}-12-31`;
  const data=await fetchAllRma15Rows("interno",q=>q.gte("fecha_ot",from).lte("fecha_ot",to).not("interno","is",null).order("source_row"));
  const rows=[...new Set(data.map(r=>String(r.interno||"").trim().toUpperCase()).filter(Boolean))].sort();
  return{ok:true,action:"get_rma15_equipment_universe",year:String(year),data:rows,total:rows.length,source:"supabase"};
}

export async function getRma15OpenOtSummary(){
  const data=await fetchAllRma15Rows("interno,fecha_ot,proyecto,lugar,equipo_operativo,raw_data,source_row",q=>q.not("interno","is",null).order("interno").order("fecha_ot").order("source_row"));
  const groups=new Map();for(const r of data){const key=String(r.interno||"").trim().toUpperCase();if(!key)continue;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
  const items=[];for(const [interno,rows] of groups){const current=rows[rows.length-1];if(current.equipo_operativo!==false)continue;let start=current;for(let i=rows.length-2;i>=0;i--){if(rows[i].equipo_operativo!==false)break;start=rows[i];}const raw=current.raw_data||{};items.push({interno,lugar:current.proyecto||current.lugar||"",fechaNoOperativo:start.fecha_ot,ot:String(raw["N° OT"]||raw["Nº OT"]||raw.OT||raw.Orden||""),estado:String(raw.Operativo||raw["Estado operativo"]||raw.Estado||"NO")});}
  items.sort((a,b)=>String(a.fechaNoOperativo).localeCompare(String(b.fechaNoOperativo))||a.interno.localeCompare(b.interno));
  return{ok:true,action:"get_rma15_open_ot_summary",data:items,total:items.length,source:"supabase"};
}
