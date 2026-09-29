import test from "node:test";
import assert from "node:assert/strict";
import {fetchAction,resetAppsScriptInflightForTests} from "../src/services/appsScriptApi.js";

const url="https://example.test/api/apps-script";

function withFetch(handler){
  const original=globalThis.fetch;
  globalThis.fetch=handler;
  return()=>{globalThis.fetch=original;resetAppsScriptInflightForTests();};
}

function jsonResponse(body={ok:true,data:[{id:"same"}]},status=200){
  return {ok:status>=200&&status<300,status,text:async()=>JSON.stringify(body)};
}

test("dos requests Apps Script idénticos en vuelo comparten una sola llamada",async()=>{
  let calls=0;
  const restore=withFetch(async()=>{
    calls+=1;
    await new Promise(resolve=>setTimeout(resolve,15));
    return jsonResponse();
  });
  try{
    const [first,second]=await Promise.all([
      fetchAction(url,"stock_excel_data",{compact:false,retries:0}),
      fetchAction(url,"stock_excel_data",{compact:false,retries:0}),
    ]);
    assert.equal(calls,1);
    assert.deepEqual(first,{ok:true,data:[{id:"same"}]});
    assert.deepEqual(second,first);
  }finally{restore();}
});

test("parámetros funcionales distintos no comparten la llamada",async()=>{
  let calls=0;
  const restore=withFetch(async()=>{
    calls+=1;
    return jsonResponse();
  });
  try{
    await Promise.all([
      fetchAction(url,"licitaciones_compartidas",{compact:false,retries:0,params:{proyecto:"JM",periodo:"2026-09"}}),
      fetchAction(url,"licitaciones_compartidas",{compact:false,retries:0,params:{proyecto:"FS",periodo:"2026-09"}}),
    ]);
    assert.equal(calls,2);
  }finally{restore();}
});

test("un fallo libera la entrada inflight para un nuevo intento",async()=>{
  let calls=0;
  const restore=withFetch(async()=>{
    calls+=1;
    return calls===1?jsonResponse({ok:false},500):jsonResponse({ok:true,data:[{id:"retry"}]});
  });
  try{
    await assert.rejects(fetchAction(url,"get_equipment_movements",{compact:false,retries:0}),/HTTP 500/);
    const retry=await fetchAction(url,"get_equipment_movements",{compact:false,retries:0});
    assert.equal(calls,2);
    assert.deepEqual(retry,{ok:true,data:[{id:"retry"}]});
  }finally{restore();}
});

test("un refresh explícito posterior no queda bloqueado por una request finalizada",async()=>{
  let calls=0;
  const restore=withFetch(async()=>{
    calls+=1;
    return jsonResponse({ok:true,data:[{version:calls}]});
  });
  try{
    const initial=await fetchAction(url,"remitos_cargados",{force:true,compact:false,retries:0,params:{limit:"all"}});
    const refreshed=await fetchAction(url,"remitos_cargados",{force:true,compact:false,retries:0,params:{limit:"all"}});
    assert.equal(calls,2);
    assert.deepEqual(initial,{ok:true,data:[{version:1}]});
    assert.deepEqual(refreshed,{ok:true,data:[{version:2}]});
  }finally{restore();}
});
