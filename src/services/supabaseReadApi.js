const DEFAULT_SUPABASE_URL="https://jwfocqaxlckuxoklwyxs.supabase.co";
const DEFAULT_SUPABASE_KEY="sb_publishable_XZAcQcWEDdgtZY_NWADy1g_HxoV0UZ2";
const env=(typeof import.meta!=="undefined"&&import.meta.env)?import.meta.env:{};
const SUPABASE_URL=String(env.VITE_SUPABASE_URL||DEFAULT_SUPABASE_URL).replace(/\/+$/,"");
const SUPABASE_KEY=String(env.VITE_SUPABASE_ANON_KEY||DEFAULT_SUPABASE_KEY).trim();
const PAGE_SIZE=1000;
const PAGE_CONCURRENCY=4;
const REQUEST_TIMEOUT_MS=12000;

export const SUPABASE_TYPED_SOURCES=new Set([
  "rop02_fs","rop02_jm","rop02_filosur","rop02_zorro",
  "rop05","rma15_fs","rma15_jm","lista_equipos","insumos"
]);

const ROP02_PREFIX=Object.freeze({
  rop02_fs:"SRC|ROP02_FS|",
  rop02_jm:"SRC|ROP02_JM|",
  rop02_filosur:"SRC|ROP02_FILOSUR|",
  rop02_zorro:"SRC|ROP02_ZORRO|",
});

function headers(extra={}){
  return {
    apikey:SUPABASE_KEY,
    Authorization:`Bearer ${SUPABASE_KEY}`,
    Accept:"application/json",
    ...extra,
  };
}

function withTimeout(ms=REQUEST_TIMEOUT_MS){
  const controller=typeof AbortController!=="undefined"?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),ms):null;
  return {signal:controller?.signal,clear:()=>{if(timer)clearTimeout(timer);}};
}

async function supabaseFetch(path,{method="GET",body=null,prefer="",timeoutMs=REQUEST_TIMEOUT_MS}={}){
  const timeout=withTimeout(timeoutMs);
  try{
    const response=await fetch(`${SUPABASE_URL}${path}`,{
      method,
      cache:"no-store",
      signal:timeout.signal,
      headers:headers({
        ...(prefer?{Prefer:prefer}:{}),
        ...(body!==null?{"Content-Type":"application/json"}:{}),
      }),
      body:body===null?undefined:JSON.stringify(body),
    });
    const text=await response.text();
    if(!response.ok)throw new Error(`Supabase HTTP ${response.status}: ${text.slice(0,240)}`);
    let data=[];
    if(text){try{data=JSON.parse(text);}catch(_){throw new Error("Supabase devolvió una respuesta no válida");}}
    return {data,response};
  }catch(error){
    if(error?.name==="AbortError")throw new Error(`Supabase no respondió dentro de ${Math.round(timeoutMs/1000)} segundos`);
    throw error;
  }finally{timeout.clear();}
}

async function runLimited(items,limit,worker){
  const results=new Array(items.length);
  let cursor=0;
  const workers=Array.from({length:Math.min(Math.max(1,limit),items.length)},async()=>{
    while(true){
      const index=cursor++;
      if(index>=items.length)return;
      results[index]=await worker(items[index],index);
    }
  });
  await Promise.all(workers);
  return results;
}

function queryString(params){
  const q=new URLSearchParams();
  Object.entries(params||{}).forEach(([key,value])=>{
    if(value!==undefined&&value!==null&&value!=="")q.set(key,String(value));
  });
  return q.toString();
}

async function fetchPage(table,params,offset,{count=false}={}){
  const qs=queryString({...params,limit:PAGE_SIZE,offset});
  return supabaseFetch(`/rest/v1/${table}?${qs}`,{prefer:count?"count=exact":""});
}

async function fetchAll(table,params={}){
  const first=await fetchPage(table,params,0,{count:true});
  const firstRows=Array.isArray(first.data)?first.data:[];
  const range=String(first.response.headers.get("content-range")||"");
  const totalMatch=range.match(/\/(\d+)$/);
  const total=totalMatch?Number(totalMatch[1]):firstRows.length;
  if(!Number.isFinite(total)||total<=firstRows.length)return firstRows;
  const offsets=[];
  for(let offset=PAGE_SIZE;offset<total;offset+=PAGE_SIZE)offsets.push(offset);
  const pages=await runLimited(offsets,PAGE_CONCURRENCY,async offset=>{
    const page=await fetchPage(table,params,offset);
    return Array.isArray(page.data)?page.data:[];
  });
  return [firstRows,...pages].flat();
}

function rop02Legacy(row={}){
  return {
    Fecha:row.fecha,
    Interno:row.interno,
    Equipo:row.equipo,
    Operador:row.operador,
    "Supervisor Delta":row.supervisor_delta,
    "Supervisor Vial Cliente":row.supervisor_vial_cliente,
    "Turno de trabajo":row.turno_trabajo,
    Turno:row.turno_trabajo,
    "N° Parte":row.numero_parte,
    Proyecto:row.proyecto,
    "Horómetro inicial":row.horometro_inicial,
    "Horómetro final":row.horometro_final,
    HI:row.horometro_inicial,
    HF:row.horometro_final,
    "Cant. Hs.":row.cantidad_horas,
    Combustible:row.combustible,
    Aceite:row.aceite_text??row.aceite,
    "Descripción de los trabajos realizados":row.descripcion_trabajos,
    "Información sobre Desgaste":row.informacion_desgaste,
    Desgaste:row.informacion_desgaste,
    Observaciones:row.observaciones,
    Estado:row.estado,
    _sourceDataset:row.source_dataset,
    _sourceRow:row.source_row,
    _sourceKey:row.source_key,
  };
}

function rop05Legacy(row={}){
  return {
    ...(row.raw_data||{}),
    "Fecha del Parte Diario":row.fecha,
    Fecha:row.fecha,
    Supervisor:row.supervisor,
    Proyecto:row.proyecto,
    "Codigo Int":row.interno,
    "Código Interno del Equipo":row.interno,
    Interno:row.interno,
    "N° de Parte":row.numero_parte,
    "Tipo Equipo":row.tipo_equipo,
    Tarea:row.tarea,
    "CANTIDAD DE HS PRODUCTIVAS EFECTIVAS (SOLO CANTIDAD)":row.horas_productivas,
    Hs:row.horas_productivas,
    LARGO:row.largo,
    ANCHO:row.ancho,
    PROFUNDIDAD:row.profundidad,
    "CANTIDAD DE PRODUCCIÓN DE LA TAREA REALIZADA (SIN UNIDADES DE MEDIDA)":row.cantidad_produccion,
    Cantidad:row.cantidad_produccion,
    "UNIDAD DE PRODUCTIVIDAD":row.unidad,
    Unidad:row.unidad,
    Observaciones:row.observaciones,
    Mes:row.mes,
    _sourceDataset:row.source_dataset,
    _sourceRow:row.source_row,
  };
}

function rma15Legacy(row={}){
  const legacy={
    ...(row.raw_data||{}),
    "Fecha de OT":row.fecha_ot,
    Fecha:row.fecha_ot,
    Proyecto:row.proyecto,
    EQUIPO:row.equipo,
    Equipo:row.equipo,
    "CODIGO N° INTERNO":row.interno,
    Interno:row.interno,
    "Km / hs":row.km_hs,
    "TIPO DE MANTENIMIENTO":row.tipo_mantenimiento,
    "¿EQUIPO QUEDO OPERATIVO?":row.equipo_operativo===true?"SI":row.equipo_operativo===false?"NO":"",
    "TURNO EN QUE SE HIZO LA OT":row.turno,
    "TURNO EN EL QUE SE REALIZO LA INTERVENCION":row.turno,
    "INTERVENCIÓN O REPARACIÓN REALIZADA (Si es PM, especificar cual) LOS SOPLETEOS DE FILTROS VAN EN ESTA SECCION O CUALQUIER SERVICIO QUE SE REALICE)":row.intervencion,
    OBSERVACIONES:row.observaciones,
    "MAIL AVISADO":row.mail_avisado,
    _proyectoForzado:row.proyecto,
    _sourceDataset:row.source_dataset,
    _sourceRow:row.source_row,
  };
  for(const item of row.insumos||[]){
    legacy[`codigo ${item.posicion}`]=item.codigo||"";
    legacy[`nombre ${item.posicion}`]=item.nombre||"";
    legacy[`cantidad ${item.posicion}`]=item.cantidad??"";
  }
  return legacy;
}

function listaEquiposLegacy(row={}){
  const raw=row.raw_data||{};
  const familyFromRaw=raw.Familia||raw.FAMILIA||raw.Tipo||raw["Tipo de equipo"]||Object.entries(raw).find(([key])=>String(key).trim().toLowerCase().startsWith("familia"))?.[1]||"";
  const familia=String(row.familia||familyFromRaw||"").trim();
  return {
    ...raw,
    "Codigo nuevo":row.codigo_nuevo||raw["Codigo nuevo"]||raw["Código nuevo"]||"",
    "Código nuevo":row.codigo_nuevo||raw["Código nuevo"]||raw["Codigo nuevo"]||"",
    "Código de Drusila":row.codigo_drusila||raw["Código de Drusila"]||raw["Codigo de Drusila"]||"",
    "Codigo de Drusila":row.codigo_drusila||raw["Codigo de Drusila"]||raw["Código de Drusila"]||"",
    "Código anterior":row.codigo_anterior||raw["Código anterior"]||raw["Codigo anterior"]||"",
    "Codigo anterior":row.codigo_anterior||raw["Codigo anterior"]||raw["Código anterior"]||"",
    Familia:familia,
    Marca:row.marca||raw.Marca||"",
    Modelo:row.modelo||raw.Modelo||"",
    "Lugar de alquiler":row.lugar_alquiler||raw["Lugar de alquiler"]||"",
    _sourceDataset:row.source_dataset,
    _sourceRow:row.source_row,
  };
}

const rawLegacy=row=>({...((row&&row.raw_data)||{}),_sourceDataset:row?.source_dataset,_sourceRow:row?.source_row});

function sourceConfig(source){
  if(ROP02_PREFIX[source])return {
    table:"rop02_frontend",
    params:{
      select:"fecha,interno,equipo,operador,supervisor_delta,supervisor_vial_cliente,turno_trabajo,numero_parte,proyecto,horometro_inicial,horometro_final,cantidad_horas,combustible,aceite,aceite_text,descripcion_trabajos,informacion_desgaste,observaciones,source_key,source_dataset,source_row,synced_at,estado",
      source_key:`like.${ROP02_PREFIX[source]}*`,
      order:"fecha.asc,source_key.asc",
    },
    adapt:rop02Legacy,
  };
  if(source==="rop05")return {table:"rop05",params:{select:"*",order:"source_row.asc"},adapt:rop05Legacy};
  if(source==="rma15_fs")return {table:"rma15_frontend",params:{select:"*",source_dataset:"eq.rma15_fs",order:"source_row.asc"},adapt:rma15Legacy};
  if(source==="rma15_jm")return {table:"rma15_frontend",params:{select:"*",source_dataset:"eq.rma15_jm",order:"source_row.asc"},adapt:rma15Legacy};
  if(source==="lista_equipos")return {table:"lista_equipos",params:{select:"*",order:"source_row.asc"},adapt:listaEquiposLegacy};
  if(source==="insumos")return {table:"insumos",params:{select:"*",order:"source_row.asc"},adapt:rawLegacy};
  return null;
}

export async function fetchSupabaseSource(source){
  const config=sourceConfig(String(source||""));
  if(!config)throw new Error(`Fuente ${source} no disponible en Supabase`);
  const raw=await fetchAll(config.table,config.params);
  const data=raw.map(config.adapt);
  const latest=raw.reduce((max,row)=>Math.max(max,new Date(row?.synced_at||0).getTime()||0),0);
  return {
    ok:true,
    source:"supabase",
    data,
    meta:{
      source:String(source||""),
      rows:data.length,
      returnedRows:data.length,
      hasMore:false,
      serverVersion:latest||Date.now(),
      serverTime:new Date(latest||Date.now()).toISOString(),
    },
  };
}

export async function fetchSupabaseVersions(){
  try{
    const {data}=await supabaseFetch("/rest/v1/rpc/delta_source_versions",{method:"POST",body:{},timeoutMs:5000});
    const versions={};
    (Array.isArray(data)?data:[]).forEach(row=>{versions[row.source_key]=Number(row.server_version||0);});
    return {ok:true,source:"supabase",versions,serverTime:new Date().toISOString()};
  }catch(error){
    console.warn("No se pudo leer el manifiesto Supabase",error);
    return null;
  }
}

export async function fetchSupabaseHealth(){
  const started=performance.now();
  await supabaseFetch("/rest/v1/rop02?select=id&limit=1",{timeoutMs:5000});
  return {ok:true,source:"supabase",latencyMs:Math.round(performance.now()-started),serverTime:new Date().toISOString()};
}

function applyFilter(q,column,value){
  if(value===undefined||value===null||value==="")return;
  if(Array.isArray(value)){
    const clean=value.map(v=>String(v).trim()).filter(Boolean);
    if(clean.length)q.set(column,`in.(${clean.map(v=>`"${v.replace(/"/g,'\\"')}"`).join(",")})`);
  }else q.set(column,`eq.${String(value)}`);
}

function datasetConfig(dataset,params={}){
  if(dataset==="rop02"){
    const q={select:"*"};
    if(params.desde)q.fecha=`gte.${params.desde}`;
    if(params.hasta)q.fecha=q.fecha?undefined:`lte.${params.hasta}`;
    const filters=[];
    if(params.desde)filters.push(`fecha.gte.${params.desde}`);
    if(params.hasta)filters.push(`fecha.lte.${params.hasta}`);
    if(filters.length>1){delete q.fecha;q.and=`(${filters.join(",")})`;}
    else if(params.hasta&&!params.desde)q.fecha=`lte.${params.hasta}`;
    const qp=new URLSearchParams(q);
    applyFilter(qp,"proyecto",params.proyecto||params.project);
    applyFilter(qp,"interno",params.equipo);
    applyFilter(qp,"supervisor_delta",params.supervisor);
    applyFilter(qp,"operador",params.operario);
    applyFilter(qp,"estado",params.estado);
    applyFilter(qp,"equipo",params.tipo);
    const sortMap={fecha:"fecha",maquina:"interno",interno:"interno",equipo:"equipo",operario:"operador",supervisor:"supervisor_delta",turno:"turno_trabajo",parte:"numero_parte",proyecto:"proyecto",horas:"cantidad_horas",combustible:"combustible"};
    qp.set("order",`${sortMap[params.sortBy]||"fecha"}.${String(params.sortDirection||"desc").toLowerCase()==="asc"?"asc":"desc"},source_key.asc`);
    return {table:"rop02_frontend",query:qp,adapt:rop02Legacy};
  }
  if(dataset==="rop05"){
    const qp=new URLSearchParams({select:"*"});
    if(params.desde&&params.hasta)qp.set("and",`(fecha.gte.${params.desde},fecha.lte.${params.hasta})`);
    else if(params.desde)qp.set("fecha",`gte.${params.desde}`);else if(params.hasta)qp.set("fecha",`lte.${params.hasta}`);
    applyFilter(qp,"proyecto",params.proyecto||params.project);applyFilter(qp,"interno",params.equipo);applyFilter(qp,"supervisor",params.supervisor);applyFilter(qp,"unidad",params.unidad);applyFilter(qp,"tarea",params.tarea);applyFilter(qp,"tipo_equipo",params.tipo);
    qp.set("order",`${params.sortBy==="maquina"?"interno":"fecha"}.${String(params.sortDirection||"desc").toLowerCase()==="asc"?"asc":"desc"},source_row.asc`);
    return {table:"rop05",query:qp,adapt:rop05Legacy};
  }
  if(dataset==="rma15"){
    const qp=new URLSearchParams({select:"*"});
    if(params.desde&&params.hasta)qp.set("and",`(fecha_ot.gte.${params.desde},fecha_ot.lte.${params.hasta})`);
    else if(params.desde)qp.set("fecha_ot",`gte.${params.desde}`);else if(params.hasta)qp.set("fecha_ot",`lte.${params.hasta}`);
    applyFilter(qp,"proyecto",params.proyecto||params.project);applyFilter(qp,"interno",params.equipo);applyFilter(qp,"tipo_mantenimiento",params.tipo);
    qp.set("order",`fecha_ot.${String(params.sortDirection||"desc").toLowerCase()==="asc"?"asc":"desc"},source_row.asc`);
    return {table:"rma15_frontend",query:qp,adapt:rma15Legacy};
  }
  return null;
}

async function fetchDatasetRaw(config,params={}){
  const limit=params.limit==="all"?PAGE_SIZE:Math.min(Math.max(Number(params.limit)||250,1),2000);
  const offset=Math.max(Number(params.offset)||0,0);
  const base=Object.fromEntries(config.query.entries());
  if(params.limit==="all"){
    const raw=await fetchAll(config.table,base);
    return {raw,total:raw.length,hasMore:false,nextOffset:raw.length};
  }
  const first=await supabaseFetch(`/rest/v1/${config.table}?${queryString({...base,limit,offset})}`,{prefer:"count=exact"});
  const raw=Array.isArray(first.data)?first.data:[];
  const range=String(first.response.headers.get("content-range")||"");
  const totalMatch=range.match(/\/(\d+)$/);
  const total=totalMatch?Number(totalMatch[1]):raw.length;
  const next=offset+raw.length;
  return {raw,total,hasMore:next<total,nextOffset:next<total?next:null};
}

export async function fetchSupabaseDatasetQuery(params={}){
  const dataset=String(params.dataset||"").toLowerCase();
  const config=datasetConfig(dataset,params);
  if(!config)throw new Error(`Dataset histórico ${dataset} no está disponible en Supabase`);
  const {raw,total,hasMore,nextOffset}=await fetchDatasetRaw(config,params);
  const data=raw.map(config.adapt);
  return {ok:true,source:"supabase",data,rows:data.length,total,hasMore,nextOffset,offset:Number(params.offset||0),limit:params.limit||250};
}
