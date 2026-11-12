import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync(new URL("../src/standalone/adapters/supabaseReadApi.js",import.meta.url),"utf8");
const from=source.indexOf("export function mapV9PmSourceRows(rows){");
const to=source.indexOf("\n// Read original Google Sheets through the authenticated V9 relay.",from);
assert.ok(from>=0&&to>from);
const normalizedDate=value=>{
 const raw=String(value??"").trim();
 const iso=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
 if(iso)return iso[1]+"-"+iso[2].padStart(2,"0")+"-"+iso[3].padStart(2,"0");
 const local=raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
 return local?local[3]+"-"+local[2].padStart(2,"0")+"-"+local[1].padStart(2,"0"):raw;
};
const mapper=new Function("normalizeV9PmDate",source.slice(from,to).replace("export function","function")+";return mapV9PmSourceRows")(normalizedDate);

test("V9 preserves last PM hour, interval and active flag from ORIGINAL Sheets",()=>{
 const out=mapper([{_entity:"CONFIG",INTERNO:"CAR-0089-JM",INTERVALO_HS:500,ALERTA_DESDE_HS:400,ATRASADO_DESDE_HS:500,HOROMETRO_ULTIMO_PM:3122,FECHA_ULTIMO_PM:"08/11/2026",ACTIVO:"SI"}]);
 assert.equal(out.config.length,1);
 assert.equal(out.config[0].interno,"CAR-0089-JM");
 assert.equal(out.config[0].horometroUltimoPM,3122);
 assert.equal(out.config[0].intervalo,500);
 assert.equal(out.config[0].alertaDesde,400);
 assert.equal(out.config[0].activo,"SI");
 assert.equal(out.config[0].fechaUltimoPM,"2026-11-08");
});

test("V9 converts historical PM records and preserves already normalized camelCase",()=>{
 const out=mapper([
  {_entity:"REGISTROS",ID_PM:"abc",INTERNO:"CAC-0040",FECHA:"10/11/2026",HOROMETRO:8367,ESTADO:"REALIZADO"},
  {_entity:"CONFIG",interno:"CAC-0060",intervalo:500,alertaDesde:400,atrasadoDesde:500,horometroUltimoPM:780,activo:"SI"}
 ]);
 assert.equal(out.registros[0].fecha,"2026-11-10");
 assert.equal(out.registros[0].idPM,"abc");
 assert.equal(out.config[0].horometroUltimoPM,780);
 assert.equal(out.config[0].intervalo,500);
});

test("V9 receives all four original PM sections, not raw column names",()=>{
 const out=mapper([{_entity:"PROGRAMACION",ID:"a",DURACION_HS:4,FECHA:"2026-11-11"},{_entity:"REPUESTO",ID:"b",CANTIDAD_MINIMA:2,STOCK_ACTUAL:5}]);
 assert.equal(out.programaciones[0].duracionHs,4);
 assert.equal(out.repuestos[0].cantidadMinima,2);
 assert.equal(out.repuestos[0].stockActual,5);
});
