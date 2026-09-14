import {useCallback,useEffect,useState} from "react";
import {fetchStockData,readCachedStockData} from "../../../services/stockService.js";
import {registerRefreshTask} from "../../../services/refreshManager.js";

export function useSharedStock(url,onError){
  const[rows,setRows]=useState([]),[meta,setMeta]=useState(null),[loading,setLoading]=useState(true),[phase,setPhase]=useState("");
  const load=useCallback(async({silent=false}={})=>{
    if(!silent){setLoading(true);setPhase("Cargando Stock compartido…");}
    try{
      const response=await fetchStockData(url);
      setRows(Array.isArray(response.rows)?response.rows:[]);
      setMeta(response.meta||null);
      return response;
    }catch(error){
      if(!silent)onError?.(`No se pudo cargar el Stock compartido: ${error.message||error}`);
      throw error;
    }finally{
      if(!silent){setLoading(false);setPhase("");}
    }
  },[onError,url]);

  useEffect(()=>{
    let alive=true;
    const bootstrap=async()=>{
      const cached=await readCachedStockData().catch(()=>null);
      if(!alive)return;
      if(cached&&Array.isArray(cached.rows)){
        setRows(cached.rows);
        setMeta(cached.meta||null);
        setLoading(false);
        setPhase("");
        load({silent:true}).catch(()=>{});
        return;
      }
      load().catch(()=>{});
    };
    bootstrap();
    return()=>{alive=false;};
  },[load]);

  useEffect(()=>registerRefreshTask("abastecimiento-stock",()=>load({silent:true}),{views:["abastecimientoStock","abastecimientoStockDashboard"],priority:25}),[load]);
  return{rows,setRows,meta,setMeta,loading,setLoading,phase,setPhase,load};
}
