import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {abastecimientoInstantVitePlugin} from "../scripts/abastecimiento-instant-vite-plugin.mjs";

const id="/repo/src/modules/abastecimiento/AbastecimientoModule.jsx";
const source=fs.readFileSync(new URL("../src/modules/abastecimiento/AbastecimientoModule.jsx",import.meta.url),"utf8").replace(/\r\n?/g,"\n");
const plugin=()=>abastecimientoInstantVitePlugin().transform(source,id);

test("acepta las tres lecturas Apps Script cuando remitos y estados usan fetchAction",()=>{
  assert.doesNotThrow(plugin);
});

for(const action of ["raba03","remitos_cargados","estados_solicitudes"]){
  test(`rechaza Abastecimiento si falta la lectura ${action}`,()=>{
    const missing=action==="raba03"
      ?source.replace("action=raba03","action=missing_raba03")
      :source.replace(`"${action}"`,`"missing_${action}"`);
    assert.throws(()=>abastecimientoInstantVitePlugin().transform(missing,id),/conservar todas sus lecturas por Apps Script/);
  });
}
