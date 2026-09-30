import assert from "node:assert/strict";
import { createServer } from "vite";
import { performance } from "node:perf_hooks";
import path from "node:path";
const [baselineRoot,candidateRoot]=process.argv.slice(2); if(!baselineRoot||!candidateRoot)throw new Error("Uso: equivalence <baseline> <candidate>");
const expose={name:"phase1c-test-exports",transform(code,id){if(id.replace(/\\/g,"/").endsWith("/src/shared/domain/index.jsx"))return `${code}\nexport { cleanKey, cleanKeyLoose, getValue, createRowValueReader, normalizeROP02 };`;}};
async function load(root){const server=await createServer({root,server:{middlewareMode:true},plugins:[expose]});return{server,module:await server.ssrLoadModule("/src/shared/domain/index.jsx")};}
const old=await load(baselineRoot), next=await load(candidateRoot);
try{
 const row={"Fecha\n":"2026-09-01","Código Interno":"EQ-01","Horómetro inicial":"1.234,5","Descripción (tarea)":"Excavación","Espacios  múltiples":"x","col_0":0,"col_1":false,"col_2":"","col_3":null,"col_4":undefined,"Clave Ambigua":"primera","Clave":"segunda"};
 const reader=next.module.createRowValueReader(row);
 const cases=[["Fecha","Fecha:"],["Codigo Interno"],["Horometro"],["Descripcion tarea"],["Espacios multiples"],["col_0"],["col_1"],["col_2"],["col_3"],["col_4"],["Clave"]];
 for(const keys of cases)assert.strictEqual(reader(keys),old.module.getValue(row,keys),`reader: ${keys.join("/")}`);
 const rows=Array.from({length:120},(_,i)=>({"Fecha:":`2026-09-${String((i%28)+1).padStart(2,"0")}`,"Codigo Interno":`EQ-${i}`,"Equipo":"Excavadora","Supervisor Delta":"Ana","Horometro inicial":String(i),"Horometro final":String(i+2),"Cant. Hs.":i%2?"2":"0","Proyecto  ":"P1","Descripción de los trabajos realizados":"Tarea","col_16":i%3?"":"obs"}));
 assert.deepStrictEqual(next.module.normalizeROP02(rows,"DEF"),old.module.normalizeROP02(rows,"DEF"));
 const bench=(fn)=>{const start=performance.now();fn(rows,"DEF");return performance.now()-start};
 console.log(JSON.stringify({rows:rows.length,oldNormalizeMs:bench(old.module.normalizeROP02),newNormalizeMs:bench(next.module.normalizeROP02),equivalence:true},null,2));
}finally{await old.server.close();await next.server.close();}
