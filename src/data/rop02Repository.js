import {requireSupabase} from "../services/supabaseClient.js";

const TABLE="rop02_frontend";
const PAGE_SIZE=250;
const SERVER_PAGE_SIZE=2000;
const SORT_COLUMNS={fecha:"fecha",maquina:"interno",interno:"interno",equipo:"equipo",operario:"operador",supervisor:"supervisor_delta",turno:"turno_trabajo",parte:"numero_parte",proyecto:"proyecto",horas:"cantidad_horas",combustible:"combustible"};

function legacyRow(row={}){
  return{
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

function applyFilters(query,p={}){
  const applyExact=(builder,column,value)=>{
    const values=Array.isArray(value)?value.map(String).map(x=>x.trim()).filter(Boolean):[];
    if(Array.isArray(value))return values.length?builder.in(column,values):builder;
    return value?builder.eq(column,value):builder;
  };
  if(p.desde)query=query.gte("fecha",p.desde);
  if(p.hasta)query=query.lte("fecha",p.hasta);
  query=applyExact(query,"proyecto",p.proyecto);
  query=applyExact(query,"interno",p.equipo);
  query=applyExact(query,"supervisor_delta",p.supervisor);
  query=applyExact(query,"operador",p.operario);
  query=applyExact(query,"turno_trabajo",p.turno);
  query=applyExact(query,"equipo",p.tipo);
  if(p.tarea){const values=Array.isArray(p.tarea)?p.tarea:[p.tarea];query=query.or(values.map(value=>`descripcion_trabajos.ilike.%${String(value).replace(/[%_,()]/g," ")}%`).join(","));}
  query=applyExact(query,"estado",p.estado);
  if(p.combustibleOnly)query=query.not("combustible","is",null).gt("combustible",0);
  return query;
}

async function getRop02SinglePage(params={}){
  const limit=Math.min(Math.max(Number(params.limit)||PAGE_SIZE,1),SERVER_PAGE_SIZE);
  const offset=Math.max(Number(params.offset)||0,0);
  const sort=SORT_COLUMNS[params.sortBy]||"fecha",ascending=String(params.sortDirection||"desc").toLowerCase()==="asc";
  let query=requireSupabase().from(TABLE).select("*",{count:"exact"});
  query=applyFilters(query,params).order(sort,{ascending}).order("source_dataset",{ascending:true}).order("source_row",{ascending:true}).range(offset,offset+limit-1);
  const {data,error,count}=await query;
  if(error)throw new Error(`Supabase ROP02: ${error.message}`);
  const rows=(data||[]).map(legacyRow),total=Number(count||0),next=offset+rows.length;
  return{ok:true,data:rows,rows:rows.length,total,hasMore:next<total,nextOffset:next<total?next:null,source:"supabase"};
}

export async function getRop02Page(params={}){
  if(params.limit!=="all")return getRop02SinglePage(params);
  const all=[];
  let offset=Math.max(Number(params.offset)||0,0),total=0;
  for(;;){
    const page=await getRop02SinglePage({...params,limit:SERVER_PAGE_SIZE,offset});
    total=page.total;
    all.push(...page.data);
    if(!page.hasMore||!page.data.length)break;
    offset=page.nextOffset;
  }
  return{ok:true,data:all,rows:all.length,total,hasMore:false,nextOffset:null,source:"supabase"};
}

export const getRop02ByDateRange=({desde,hasta,...rest})=>getRop02Page({desde,hasta,...rest});
export const getRop02ByEquipment=(equipo,params={})=>getRop02Page({...params,equipo});
export const getRop02ByProject=(proyecto,params={})=>getRop02Page({...params,proyecto});
export const getRop02EquipmentHistory=(equipo,params={})=>getRop02Page({...params,equipo,sortBy:"fecha",sortDirection:"asc"});
export const getRop02ForOperationalPeriod=(desde,hasta,params={})=>getRop02Page({...params,desde,hasta});

async function rpc(name,params={}){
  const {data,error}=await requireSupabase().rpc(name,params);
  if(error)throw new Error(`Supabase ${name}: ${error.message}`);
  const rows=(data||[]).map(legacyRow);
  return{ok:true,data:rows,rows:rows.length,total:rows.length,hasMore:false,nextOffset:null,source:"supabase"};
}
export const getLatestRop02ByEquipment=params=>rpc("rop02_latest_by_equipment_project",{p_project:params?.proyecto||null});
export const getRop02MonthlySummary=params=>rpc("rop02_monthly_summary",{p_from:params?.desde||null,p_to:params?.hasta||null,p_project:params?.proyecto||null});
export const getRop02OperationalSnapshot=(params={})=>rpc("rop02_operational_snapshot",{p_days:Number(params.days)||7,p_project:params.proyecto||null});
const arrayParam=value=>Array.isArray(value)?(value.length?value:null):(value?[value]:null);
export async function getRop02Stats(params={}){
  const {data,error}=await requireSupabase().rpc("rop02_filtered_stats_v2",{
    p_from:params.desde||null,p_to:params.hasta||null,p_projects:arrayParam(params.proyecto),
    p_equipment:arrayParam(params.equipo),p_supervisors:arrayParam(params.supervisor),
    p_operators:arrayParam(params.operario),p_states:arrayParam(params.estado),p_task:params.tarea||null,p_scope:params.scope||"equipment",
  });
  if(error)throw new Error(`Supabase rop02_filtered_stats_v2: ${error.message}`);
  return data||{};
}

export async function fetchAllRop02Pages(params={},onPage=()=>{}){
  let offset=0,total=0;
  do{
    const page=await getRop02SinglePage({...params,limit:SERVER_PAGE_SIZE,offset});
    total=page.total;await onPage(page.data,{offset:page.nextOffset,total,hasMore:page.hasMore});
    if(!page.hasMore||!page.data.length)break;
    offset=page.nextOffset;
  }while(offset<total);
  return{total};
}
