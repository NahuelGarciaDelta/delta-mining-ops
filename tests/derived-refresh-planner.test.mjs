import test from "node:test";
import assert from "node:assert/strict";
import { planDerivedRefresh } from "../src/data/derivedRefreshPlanner.js";

const keys=["rop05","rop02_fs","rop02_jm","rop02_filosur","rop02_zorro","rma15_fs","rma15_jm","insumos","lista_equipos"];
const snapshot=()=>Object.fromEntries(keys.map(key=>[key,{ok:true,data:[key]}]));

test("initial hydration normalizes all source groups",()=>{
  assert.deepEqual(planDerivedRefresh(null,snapshot(),undefined,"TODO"),{rop05:true,rop02:true,insumos:true,rma15:true,listaEquipos:true});
});

test("unchanged snapshots require no heavy recomputation",()=>{
  const old=snapshot();
  assert.deepEqual(planDerivedRefresh(old,{...old},"TODO","TODO"),{rop05:false,rop02:false,insumos:false,rma15:false,listaEquipos:false});
});

test("new unit prices revalue RMA15 without recomputing ROP02 or ROP05",()=>{
  const old=snapshot(),next={...old,insumos:{data:[],ok:true}};
  assert.deepEqual(planDerivedRefresh(old,next,"TODO","TODO"),{rop05:false,rop02:false,insumos:true,rma15:true,listaEquipos:false});
});

test("ROP05 changes also refresh canonical ROP02 names",()=>{
  const old=snapshot(),next={...old,rop05:{data:[],ok:true}};
  assert.deepEqual(planDerivedRefresh(old,next,"TODO","TODO"),{rop05:true,rop02:true,insumos:false,rma15:false,listaEquipos:false});
});

test("RMA15 changes leave unrelated datasets untouched",()=>{
  const old=snapshot(),next={...old,rma15_jm:{data:[],ok:true}};
  assert.deepEqual(planDerivedRefresh(old,next,"TODO","TODO"),{rop05:false,rop02:false,insumos:false,rma15:true,listaEquipos:false});
});

test("equipment roster invalidates alias-dependent views",()=>{
  const old=snapshot(),next={...old,lista_equipos:{data:[],ok:true}};
  assert.deepEqual(planDerivedRefresh(old,next,"TODO","TODO"),{rop05:false,rop02:true,insumos:false,rma15:true,listaEquipos:true});
});

test("project change re-filters project-specific outputs",()=>{
  const old=snapshot();
  assert.deepEqual(planDerivedRefresh(old,old,"TODO","JOSE MARIA"),{rop05:true,rop02:true,insumos:false,rma15:true,listaEquipos:false});
});
