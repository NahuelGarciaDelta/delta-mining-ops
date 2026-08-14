import test from "node:test";
import assert from "node:assert/strict";
import {buildDatasetQueryKey,operationalMonthRange,yearsForRange} from "../src/data/historicalQueryParams.js";
import {createPagedDatasetController} from "../src/data/pagedDatasetController.js";

test("agosto usa el corte operativo 26-25",()=>{
  assert.deepEqual(operationalMonthRange(2026,8),{desde:"2026-07-26",hasta:"2026-08-25"});
});

test("enero cruza automaticamente las particiones anuales",()=>{
  const range=operationalMonthRange(2027,1);
  assert.deepEqual(range,{desde:"2026-12-26",hasta:"2027-01-25"});
  assert.deepEqual(yearsForRange(range.desde,range.hasta),[2026,2027]);
});

test("la cache diferencia rango equipo proyecto y pagina",()=>{
  const first=buildDatasetQueryKey("rop02",{desde:"2026-07-26",hasta:"2026-08-25",proyecto:"JM",equipo:"EXC-0034",limit:250,offset:0});
  const second=buildDatasetQueryKey("rop02",{desde:"2026-07-26",hasta:"2026-08-25",proyecto:"JM",equipo:"EXC-0034",limit:250,offset:250});
  assert.notEqual(first,second);
  assert.match(first,/EXC-0034/);
});

test("paginacion remota acumula 250 hasta completar 1137",async()=>{
  const all=Array.from({length:1137},(_,id)=>({id}));
  const calls=[];
  const controller=createPagedDatasetController(async(_dataset,params)=>{
    calls.push(params.offset);const data=all.slice(params.offset,params.offset+params.limit),next=params.offset+data.length;
    return{data,total:all.length,hasMore:next<all.length,nextOffset:next<all.length?next:null};
  });
  let state=await controller.loadFirst("rop02",{proyecto:"JM"});
  assert.equal(state.rows.length,250);
  for(const expected of [500,750,1000,1137]){state=await controller.loadMore("rop02",{proyecto:"JM"});assert.equal(state.rows.length,expected);}
  assert.deepEqual(calls,[0,250,500,750,1000]);
});

test("una respuesta obsoleta no reemplaza el filtro mas reciente",async()=>{
  const resolvers=[];
  const controller=createPagedDatasetController((_dataset,params)=>new Promise(resolve=>resolvers.push({project:params.proyecto,resolve})));
  const old=controller.loadFirst("rop02",{proyecto:"JM"});
  const current=controller.loadFirst("rop02",{proyecto:"FS"});
  resolvers[1].resolve({data:[{project:"FS"}],total:1,hasMore:false,nextOffset:null});
  await current;
  resolvers[0].resolve({data:[{project:"JM"}],total:1,hasMore:false,nextOffset:null});
  const stale=await old;
  assert.equal(stale.stale,true);
  assert.equal(controller.snapshot().rows[0].project,"FS");
});
