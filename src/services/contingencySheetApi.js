// Contingencia de lectura: datos originales de Google Sheets a través de Apps Script V9.
// Nunca utiliza la API de Supabase, jamás efectúa POST ni descarta páginas fallidas.
// El contrato coincide con fetchSupabaseSource para reutilizar los módulos existentes.
export const CONTINGENCY_SHEET_SOURCES=new Set([
  "rop02_jm","rop02_fs","rop02_filosur","rop02_zorro",
  "rop05","rma15_jm","rma15_fs","insumos","lista_equipos"
]);

export const CONTINGENCY_UNAVAILABLE_SOURCES=new Set(["rop02_fierro"]);
const PAGE_SIZE=900;
const MAX_PAGES=90;
const inFlight=new Map();

// Una página de Sheets puede excluir filas físicas completamente vacías.
// Sólo asignamos un número físico cuando no hay filas omitidas en esa página.
export function decoratePhysicalRows(rows,meta,source){
  const array=Array.isArray(rows)?rows:[];
  const offset=Number(meta?.offset??0);
  const start=Number(meta?.headerRow);
  const limit=Number(meta?.limit);
  const total=Number(meta?.rows);
  const physicalWindow=Number.isFinite(total)&&Number.isFinite(limit)
    ?Math.min(limit,Math.max(0,total-offset)):array.length;
  const unambiguous=Number.isInteger(start)&&start>0&&physicalWindow===array.length;
  return array.map((row,index)=>{
    const explicit=Number(row?._sourceRow);
    const rowNumber=Number.isInteger(explicit)&&explicit>0?explicit:
      unambiguous?start+1+offset+index:null;
    return {...row,_sourceDataset:source,_sourceRow:rowNumber,
      ...(rowNumber===null?{_sourceRowUnverified:true}:{})};
  });
}

export async function readCompleteSheetSource(source,readPage,{
  pageSize=PAGE_SIZE,maxPages=MAX_PAGES
}={}){
  if(!CONTINGENCY_SHEET_SOURCES.has(source)){
    throw new Error(`${source}: el Apps Script V9 no tiene una hoja configurada para esta fuente. No se muestran datos incompletos como actuales.`);
  }
  if(typeof readPage!=="function")throw new Error("Lector de Apps Script no disponible");
  const rows=[];
  let sourceStamp=null,version=null,totalPhysical=null,lastMeta=null;
  const seen=new Set();
  for(let page=0;page<maxPages;page++){
    const offset=page*pageSize;
    const result=await readPage(source,{offset,limit:pageSize});
    if(result?.ok!==true||!Array.isArray(result.data)){
      throw new Error(`${source}: página ${page+1} inválida o fallida`);
    }
    const meta=result.meta||{};
    if(String(meta.source||source)!==source)throw new Error(`${source}: respuesta de otra fuente`);
    if(Number(meta.offset??offset)!==offset)throw new Error(`${source}: desplazamiento de página inesperado`);
    const pageTotal=Number(meta.rows);
    if(!Number.isSafeInteger(pageTotal)||pageTotal<0)throw new Error(`${source}: el servidor no indicó cantidad de filas físicas`);
    if(totalPhysical!==null&&pageTotal!==totalPhysical)throw new Error(`${source}: la hoja cambió de tamaño durante la lectura; se requiere reintento completo`);
    if(totalPhysical===null)totalPhysical=pageTotal;
    const stamp=String(meta.serverStamp||"").trim();
    const ver=String(meta.serverVersion??"").trim();
    if(page===0){sourceStamp=stamp;version=ver;}
    if(page>0&&((sourceStamp&&stamp&&sourceStamp!==stamp)||(version&&ver&&version!==ver))){
      throw new Error(`${source}: la hoja cambió durante la lectura; no se combinarán versiones`);
    }
    // La página recorre filas físicas, no sólo registros no vacíos.
    if(result.data.length>pageSize)throw new Error(`${source}: la página excede el límite solicitado`);
    const decorated=decoratePhysicalRows(result.data,{...meta,offset,limit:pageSize},source);
    for(const row of decorated){
      if(row._sourceRow!==null){
        if(seen.has(row._sourceRow))throw new Error(`${source}: número de fila duplicado en respuesta`);
        seen.add(row._sourceRow);
      }
    }
    rows.push(...decorated);
    lastMeta=meta;
    const hasMore=meta.hasMore===true;
    const nextOffset=Number(meta.nextOffset);
    if(!hasMore){
      if(offset+pageSize<totalPhysical&&totalPhysical!==0)throw new Error(`${source}: final prematuro del historial`);
      return {ok:true,source:"google-sheets-contingency",data:rows,
        meta:{...lastMeta,source,rows:rows.length,physicalRows:totalPhysical,
          returnedRows:rows.length,hasMore:false,offset:0,nextOffset:null,
          serverTime:meta.serverTime||meta.fetchedAt||new Date().toISOString(),
          dataProvider:"Google Sheets · Apps Script V9",
          unverifiedPhysicalRows:rows.filter(r=>r._sourceRow===null).length}};
    }
    if(!Number.isInteger(nextOffset)||nextOffset!==offset+pageSize||nextOffset>totalPhysical){
      throw new Error(`${source}: paginación incompleta o incongruente`);
    }
  }
  throw new Error(`${source}: excede ${maxPages} páginas; no se entrega una copia parcial`);
}

export function shareSheetRead(source,loader){
  if(inFlight.has(source))return inFlight.get(source);
  const task=Promise.resolve().then(loader).finally(()=>{if(inFlight.get(source)===task)inFlight.delete(source);});
  inFlight.set(source,task);return task;
}
