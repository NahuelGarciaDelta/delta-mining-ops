import { useEffect, useMemo, useRef, useState } from 'react';
import { readInformeCostosCache, writeInformeCostosCache } from '../services/informeCostosCache';
const schedule=fn=>typeof window.requestIdleCallback==='function'?window.requestIdleCallback(fn,{timeout:900}):window.setTimeout(fn,30);
const cancel=id=>{if(!id)return;if(typeof window.cancelIdleCallback==='function')window.cancelIdleCallback(id);else window.clearTimeout(id);};
export function useInformeCostosWorker({enabled,cacheKey,payload}){
  const[result,setResult]=useState(null),[status,setStatus]=useState('idle');
  const workerRef=useRef(null),requestRef=useRef(0),payloadRef=useRef(payload);payloadRef.current=payload;
  const stableKey=useMemo(()=>String(cacheKey||'default'),[cacheKey]);
  useEffect(()=>{let alive=true;readInformeCostosCache(`costos:${stableKey}`).then(cached=>{if(alive&&cached){setResult(cached);setStatus('cached');}});return()=>{alive=false;};},[stableKey]);
  useEffect(()=>{if(!enabled||typeof Worker==='undefined')return;if(!workerRef.current)workerRef.current=new Worker(new URL('../workers/informeCostos.worker.js',import.meta.url),{type:'module'});const worker=workerRef.current;let disposed=false;const id=++requestRef.current;const onMessage=e=>{const msg=e.data||{};if(msg.id!==id||disposed)return;if(msg.ok){setResult(msg.result);setStatus('ready');writeInformeCostosCache(`costos:${stableKey}`,msg.result);}else{setStatus('error');console.error('Informe de Costos worker:',msg.error);}};worker.addEventListener('message',onMessage);setStatus(s=>s==='cached'?'updating':'loading');const scheduled=schedule(()=>{if(!disposed)worker.postMessage({id,type:'calculate',payload:payloadRef.current});});return()=>{disposed=true;cancel(scheduled);worker.removeEventListener('message',onMessage);};},[enabled,stableKey]);
  useEffect(()=>()=>{workerRef.current?.terminate();workerRef.current=null;},[]);
  return{result,status,isUpdating:status==='loading'||status==='updating'};
}
export function runCategoryWorker(payload){return new Promise((resolve,reject)=>{if(typeof Worker==='undefined'){resolve(payload);return;}const worker=new Worker(new URL('../workers/informeCostos.worker.js',import.meta.url),{type:'module'}),id=Date.now()+Math.random(),done=()=>worker.terminate();worker.onmessage=e=>{if(e.data?.id!==id)return;e.data.ok?resolve(e.data.result):reject(new Error(e.data.error||'Worker error'));done();};worker.onerror=e=>{reject(e.error||new Error(e.message));done();};worker.postMessage({id,type:'categories',payload});});}
