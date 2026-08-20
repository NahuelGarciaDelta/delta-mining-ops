import {useCallback,useEffect,useMemo,useRef,useState} from "react";

export const DEFAULT_PROGRESSIVE_ROWS=100;

export function getProgressiveRowsState(rows=[],limit=DEFAULT_PROGRESSIVE_ROWS){
  const safeRows=Array.isArray(rows)?rows:[];
  const safeLimit=Math.max(0,Number(limit)||DEFAULT_PROGRESSIVE_ROWS);
  const visibleRows=safeRows.slice(0,safeLimit);
  return{visibleRows,visibleCount:visibleRows.length,totalCount:safeRows.length,hasMore:visibleRows.length<safeRows.length};
}

export function useProgressiveRows(rows=[],options={}){
  const resetKey=options.resetKey;
  // RABA03 debe mostrar siempre el universo completo. Remitos ya renderiza
  // directamente filteredRemitos completo, sin paginacion progresiva.
  const showAllRows=resetKey==="solicitudes"||resetKey==="raba03";
  const safeRows=Array.isArray(rows)?rows:[];
  const configuredInitialLimit=Number(options.initialLimit)||DEFAULT_PROGRESSIVE_ROWS;
  const initialLimit=showAllRows?Math.max(1,safeRows.length):configuredInitialLimit;
  const increment=showAllRows?Math.max(1,safeRows.length):(Number(options.increment)||DEFAULT_PROGRESSIVE_ROWS);
  const[limit,setLimit]=useState(initialLimit);
  const previousResetKey=useRef(resetKey);
  const resetPending=previousResetKey.current!==resetKey;
  const effectiveLimit=showAllRows?Math.max(1,safeRows.length):(resetPending?initialLimit:limit);
  useEffect(()=>{previousResetKey.current=resetKey;setLimit(initialLimit);},[safeRows,resetKey,initialLimit]);
  const state=useMemo(()=>getProgressiveRowsState(safeRows,effectiveLimit),[safeRows,effectiveLimit]);
  const showMore=useCallback(()=>setLimit(current=>Math.min(safeRows.length,current+increment)),[safeRows.length,increment]);
  return{
    ...state,
    showMore,
    reset:useCallback(()=>setLimit(initialLimit),[initialLimit]),
  };
}
