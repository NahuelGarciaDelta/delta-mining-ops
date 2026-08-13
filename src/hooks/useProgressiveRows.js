import {useCallback,useEffect,useMemo,useRef,useState} from "react";

export const DEFAULT_PROGRESSIVE_ROWS=250;

export function getProgressiveRowsState(rows=[],limit=DEFAULT_PROGRESSIVE_ROWS){
  const safeRows=Array.isArray(rows)?rows:[];
  const safeLimit=Math.max(0,Number(limit)||DEFAULT_PROGRESSIVE_ROWS);
  const visibleRows=safeRows.slice(0,safeLimit);
  return{visibleRows,visibleCount:visibleRows.length,totalCount:safeRows.length,hasMore:visibleRows.length<safeRows.length};
}

export function useProgressiveRows(rows=[],options={}){
  const initialLimit=Number(options.initialLimit)||DEFAULT_PROGRESSIVE_ROWS;
  const increment=Number(options.increment)||DEFAULT_PROGRESSIVE_ROWS;
  const resetKey=options.resetKey;
  const safeRows=Array.isArray(rows)?rows:[];
  const[limit,setLimit]=useState(initialLimit);
  const previousResetKey=useRef(resetKey);
  const resetPending=previousResetKey.current!==resetKey;
  const effectiveLimit=resetPending?initialLimit:limit;
  useEffect(()=>{previousResetKey.current=resetKey;setLimit(initialLimit);},[safeRows,resetKey,initialLimit]);
  const state=useMemo(()=>getProgressiveRowsState(safeRows,effectiveLimit),[safeRows,effectiveLimit]);
  const showMore=useCallback(()=>setLimit(current=>Math.min(safeRows.length,current+increment)),[safeRows.length,increment]);
  return{
    ...state,
    showMore,
    reset:useCallback(()=>setLimit(initialLimit),[initialLimit]),
  };
}
