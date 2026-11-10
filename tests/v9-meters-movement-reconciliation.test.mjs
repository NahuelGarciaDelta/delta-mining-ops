import test from "node:test";
import assert from "node:assert/strict";
import {reconcileHorometerReadback} from "../src/standalone/adapters/horometerUpdates.js";
import {readFileSync} from "node:fs";

const pending=(identity,value,expectedValue)=>({
 status:"pending",index:0,code:"V9_WRITE_CONFIRMATION_UNAVAILABLE",
 _requested:{identity,value,expectedValue}
});

test("Readback confirms updated vehicle meters without reissuing any writes",()=>{
 const rows=[{"Código nuevo":"CAC-0040","Código de Drusila":"AG661LL","HORAS":8472}];
 const result=reconcileHorometerReadback([pending({codigoNuevo:"CAC-0040"},8472,8400)],rows);
 assert.equal(result[0].status,"confirmed");
 assert.equal(result[0].changed,true);
 assert.equal(result[0].confirmation,"original_sheet_readback");
});

test("Readback refuses inconsistent cells, ambiguous codes and stale readings",()=>{
 const stale=reconcileHorometerReadback([pending({codigoNuevo:"CAC-0040"},8472,8400)],[{"Código nuevo":"CAC-0040","HORAS":8400}]);
 assert.equal(stale[0].status,"pending");
 const duplicate=reconcileHorometerReadback([pending({codigoNuevo:"CAC-0040"},8472,8400)],[{"Código nuevo":"CAC-0040","HORAS":8472},{"Código nuevo":"CAC-0040","HORAS":8472}]);
 assert.equal(duplicate[0].status,"pending");
});

test("V9 movement creation uses an operation UUID and a read-only fallback",()=>{
 const source=readFileSync(new URL("../src/services/equipmentMovements.js",import.meta.url),"utf8");
 assert.match(source,/action:"save_equipment_movement",operationId,movement:prepared/);
 assert.match(source,/String\(row\.id\|\|row\.ID\|\|""\)===operationId/);
 const gas=readFileSync(new URL("../apps-script-v9/DM_V9_APP_WRITE_BACKEND_V1.gs",import.meta.url),"utf8");
 assert.match(gas,/function handleSaveEquipmentMovement_\(movement, operationId, v9Actor\)/);
 assert.match(gas,/fixedId\|\|Utilities\.getUuid\(\)/);
});
