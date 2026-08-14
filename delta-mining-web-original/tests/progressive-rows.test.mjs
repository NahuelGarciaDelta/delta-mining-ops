import test from "node:test";
import assert from "node:assert/strict";
import {getProgressiveRowsState} from "../src/hooks/useProgressiveRows.js";

const rows=count=>Array.from({length:count},(_,id)=>({id}));

test("tablas pequeñas y límite exacto se muestran completas",()=>{
  assert.deepEqual(getProgressiveRowsState(rows(100),250),{visibleRows:rows(100),visibleCount:100,totalCount:100,hasMore:false});
  assert.equal(getProgressiveRowsState(rows(250),250).hasMore,false);
});

test("251 filas muestra 250 y permite continuar",()=>{
  const state=getProgressiveRowsState(rows(251),250);
  assert.equal(state.visibleCount,250);
  assert.equal(state.totalCount,251);
  assert.equal(state.hasMore,true);
});

test("501 filas progresan 250, 500 y 501",()=>{
  assert.equal(getProgressiveRowsState(rows(501),250).visibleCount,250);
  assert.equal(getProgressiveRowsState(rows(501),500).visibleCount,500);
  assert.equal(getProgressiveRowsState(rows(501),750).visibleCount,501);
  assert.equal(getProgressiveRowsState(rows(501),750).hasMore,false);
});

test("el slice visual ocurre después del filtro sobre el dataset completo",()=>{
  const source=rows(1000);
  const filtered80=source.filter(row=>row.id<80);
  const filtered600=source.filter(row=>row.id<600);
  assert.equal(getProgressiveRowsState(filtered80,250).visibleCount,80);
  assert.equal(getProgressiveRowsState(filtered600,250).visibleCount,250);
  assert.equal(filtered600.find(row=>row.id===599)?.id,599);
});
