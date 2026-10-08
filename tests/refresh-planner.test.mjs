import test from "node:test";
import assert from "node:assert/strict";
import { planVersionedRefresh } from "../src/data/refreshPlanner.js";

const source = version => ({ok:true,data:[{id:1}],meta:{serverVersion:version}});

test("omits unchanged datasets, preventing full reloads", () => {
  const current={rop02_jm:source(120),rma15_jm:source(200),insumos:source(300)};
  const versions={rop02_jm:120,rma15_jm:201,insumos:300};
  assert.deepEqual(planVersionedRefresh(["rop02_jm","rma15_jm","insumos"],current,versions),["rma15_jm"]);
});

test("does not suppress refresh when manifest is unavailable", () => {
  const current={rop02_jm:source(120)};
  assert.deepEqual(planVersionedRefresh(["rop02_jm"],current,null),["rop02_jm"]);
  assert.deepEqual(planVersionedRefresh(["rop02_jm"],current,{}),["rop02_jm"]);
});

test("refreshes missing, invalid and empty local snapshots", () => {
  const current={rop02_jm:{ok:false,data:[],meta:{serverVersion:10}},rma15_jm:{ok:true,data:null,meta:{serverVersion:10}}};
  assert.deepEqual(planVersionedRefresh(["rop02_jm","rma15_jm","insumos"],current,{rop02_jm:10,rma15_jm:10,insumos:10}),["rop02_jm","rma15_jm","insumos"]);
});

test("unknown sources and version-less legacy cache always refresh", () => {
  const current={rop02_jm:{ok:true,data:[],meta:{}},raba03:source(100)};
  assert.deepEqual(planVersionedRefresh(["rop02_jm","raba03"],current,{rop02_jm:100}),["rop02_jm","raba03"]);
});

test("deduplicates source keys preserving requested order", () => {
  const current={rop02_fs:source(99),rma15_fs:source(22)};
  assert.deepEqual(planVersionedRefresh(["rop02_fs","rop02_fs","rma15_fs",null,"rma15_fs"],current,{rop02_fs:99,rma15_fs:23}),["rma15_fs"]);
});

test("an unchanged empty-but-valid source remains cached until version changes", () => {
  const current={insumos:{ok:true,data:[],meta:{serverVersion:123}}};
  assert.deepEqual(planVersionedRefresh(["insumos"],current,{insumos:123}),[]);
  assert.deepEqual(planVersionedRefresh(["insumos"],current,{insumos:124}),["insumos"]);
});

test("row-count mismatch forces refresh even when timestamp version is unchanged", () => {
  const current={rop02_jm:{ok:true,data:[{id:1},{id:2}],meta:{serverVersion:120}}};
  assert.deepEqual(planVersionedRefresh(["rop02_jm"],current,{rop02_jm:120},{rop02_jm:1}),["rop02_jm"]);
});

test("matching row count keeps the unchanged local snapshot", () => {
  const current={rop02_jm:{ok:true,data:[{id:1},{id:2}],meta:{serverVersion:120}}};
  assert.deepEqual(planVersionedRefresh(["rop02_jm"],current,{rop02_jm:120},{rop02_jm:2}),[]);
  assert.deepEqual(planVersionedRefresh(["rop02_jm"],current,{rop02_jm:120}),[]);
});
