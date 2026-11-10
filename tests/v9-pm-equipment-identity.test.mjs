import test from "node:test";
import assert from "node:assert/strict";
import {normalizePmEquipmentCode,preferredPmConfig} from "../src/modules/mantenimiento/pmEquipmentIdentity.js";

test("PM matches original, master and ROP02 identifiers with optional -JM",()=>{
 for(const key of ["TOP-0067","EXC-0055","MOT-0049","PCA-0070","CAR-0089","CAV-0114","CTA-0888"]){
  assert.equal(normalizePmEquipmentCode(key+"-JM"),normalizePmEquipmentCode(key));
  assert.equal(normalizePmEquipmentCode(key.replace("-","")+"JM"),normalizePmEquipmentCode(key));
 }
 assert.notEqual(normalizePmEquipmentCode("JOSE MARIA"),normalizePmEquipmentCode("JOSE MARIA JM"));
 assert.equal(normalizePmEquipmentCode("CAMIONETA"),"CAMIONETA");
});

test("PM uses latest documented service even if the code is suffixed",()=>{
 const old={interno:"TOP-0067-JM",fechaUltimoPM:"2026-06-15",horometroUltimoPM:3500};
 const current={interno:"TOP-0067",fechaUltimoPM:"2026-10-12",horometroUltimoPM:6070};
 assert.deepEqual(preferredPmConfig(old,current),current);
 assert.deepEqual(preferredPmConfig(current,old),current);
 const newerLegacy={...old,fechaUltimoPM:"2026-11-08",horometroUltimoPM:6250};
 assert.deepEqual(preferredPmConfig(current,newerLegacy),newerLegacy);
});

test("PM does not overwrite a valid service with an alias lacking a base",()=>{
 const valid={interno:"PCA-0070",fechaUltimoPM:"2026-10-24",horometroUltimoPM:4307};
 const empty={interno:"PCA-0070-JM",fechaUltimoPM:"",horometroUltimoPM:0};
 assert.deepEqual(preferredPmConfig(valid,empty),valid);
 assert.deepEqual(preferredPmConfig(empty,valid),valid);
});

test("PM prefers unsuffixed code on a genuine tie",()=>{
 const legacy={interno:"EXC-0055-JM",fechaUltimoPM:"2026-10-02",horometroUltimoPM:3500};
 const current={...legacy,interno:"EXC-0055"};
 assert.deepEqual(preferredPmConfig(legacy,current),current);
 assert.deepEqual(preferredPmConfig(current,legacy),current);
});
