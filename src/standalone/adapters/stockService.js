// Stock reads from the isolated V9 snapshot. The legacy GAS bridge targets the source workbook,
// so V9 writes remain blocked until a dedicated sandbox spreadsheet is configured.
import {readCachedSource,writeCachedSource} from "../../services/appCache.js";
import {fetchSupabaseStockSnapshot} from "./supabaseReadApi.js";
const STOCK_CACHE_KEY="stock_excel_data";
const WRITE_BLOCKED="V9_STOCK_WRITE_TARGET_NOT_CONFIGURED: la escritura está bloqueada hasta configurar una hoja sandbox independiente.";
export function fetchStockStatus(){
 return fetchSupabaseStockSnapshot().then(({meta,rows})=>({ok:true,meta,rows:Array.isArray(rows)?rows.length:0}));
}
export async function fetchStockData(){
 const response=await fetchSupabaseStockSnapshot();
 await writeCachedSource(STOCK_CACHE_KEY,{ok:true,data:response.rows,meta:response.meta}).catch(()=>{});
 return response;
}
export async function readCachedStockData(){
 const record=await readCachedSource(STOCK_CACHE_KEY).catch(()=>null);
 const value=record?.value||record?.data||null;
 if(!value?.ok||!Array.isArray(value.data))return null;
 return {ok:true,rows:value.data,meta:value.meta||null,cacheUpdatedAt:record?.updatedAt||null};
}
export async function uploadStockExcel(){
 throw new Error(WRITE_BLOCKED);
}
export async function clearSharedStock(){
 throw new Error(WRITE_BLOCKED);
}
