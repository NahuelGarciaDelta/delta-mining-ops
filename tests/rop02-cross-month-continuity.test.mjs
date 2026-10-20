import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {selectRop02PeriodContinuityRows,limitRop02ErrorsToPeriod} from "../src/shared/rop02PeriodContinuity.js";

const row=(fecha,maquina,proyecto,turno,parte,hi,hf)=>({
 fecha,maquina,proyecto,turno,parte,horometroInicial:hi,horometroFinal:hf
});
const old=row("2026-09-30","MOT-0090-JM","JOSE MARIA","TURNO DIA",33,800,800);
const broken=row("2026-10-01","MOT-0090-JM","JOSE MARIA","TURNO DIA",34,804,811);

test("MOT-0090-JM: incorpora referencia del 30/09 al evaluar octubre (800 vs 804)",()=>{
 const records=[row("2026-09-29","MOT-0090-JM","JOSE MARIA","TURNO DIA",32,791,800),
   broken,old,row("2026-10-02","MOT-0090-JM","JOSE MARIA","TURNO DIA",35,811,817)];
 const scope=selectRop02PeriodContinuityRows(records,"2026-10-01","2026-10-31");
 assert.deepEqual(scope.map(r=>r.fecha),["2026-09-30","2026-10-01","2026-10-02"]);
 assert.equal(scope[0].horometroFinal,800);
 assert.equal(scope[1].horometroInicial,804);
 assert.equal(scope[1].horometroInicial-scope[0].horometroFinal,4);
 assert.equal(scope[1].parte,scope[0].parte+1);
});
test("si hay TD y TN en día anterior preserva ambos y último HF disponible",()=>{
 const rows=[
 row("2026-09-30","MOT-0090-JM","JOSE MARIA","TD",33,800,800),
 row("2026-09-30","MOT-0090-JM","JOSE MARIA","TURNO NOCHE",34,800,805),
 row("2026-10-01","MOT-0090-JM","JOSE MARIA","TD",35,806,814)
 ];
 const scope=selectRop02PeriodContinuityRows(rows,"2026-10-01","2026-10-31");
 assert.equal(scope.length,3);
 assert.deepEqual(scope.map(x=>x.turno),["TD","TURNO NOCHE","TD"]);
});
test("no trae proyectos distintos del mismo equipo al controlar solo un proyecto",()=>{
 const records=[
 row("2026-09-29","MOT-0090-JM","FILO DEL SOL","TD",40,999,1000),
 old,broken,row("2026-10-01","MOT-0090-JM","EL ZORRO","TD",1,0,7)
 ];
 const scope=selectRop02PeriodContinuityRows(records,"2026-10-01","2026-10-31");
 assert.equal(scope.filter(x=>x.fecha==="2026-09-30"&&x.proyecto==="JOSE MARIA").length,1);
 assert.equal(scope.filter(x=>x.fecha==="2026-09-29"&&x.proyecto==="FILO DEL SOL").length,1);
 // El detector conserva su propia separación por proyecto: nunca cruza esas filas.
 const keys=new Set(scope.map(x=>x.maquina+"|||"+x.proyecto));
 assert.equal(keys.size,3);
});
test("no permite errores antiguos fuera del período visible",()=>{
 const result=limitRop02ErrorsToPeriod({
  erroresPartes:[{fecha:"2026-09-30",tipo:"ENTRE_DIAS"},{fecha:"2026-10-01",tipo:"ENTRE_DIAS"}],
  erroresHoro:[{fecha:"2026-09-30",diff:3},{fecha:"2026-10-01",diff:4},{fecha:"2026-11-01",diff:9}],
  erroresDuplicados:[{fecha:"2026-09-30"},{fecha:"2026-10-01"}],
 },"2026-10-01","2026-10-31");
 assert.equal(result.erroresPartes.length,1);
 assert.deepEqual(result.erroresHoro.map(x=>x.diff),[4]);
 assert.equal(result.erroresDuplicados.length,1);
});
test("cruce diciembre-enero y rango parcial sin registros anteriores",()=>{
 const items=[
 row("2026-12-31","MOT-0090-JM","JOSE MARIA","TD",90,900,909),
 row("2027-01-01","MOT-0090-JM","JOSE MARIA","TD",91,912,920),
 row("2027-02-02","MOT-0090-JM","JOSE MARIA","TD",92,920,925)
 ];
 const scoped=selectRop02PeriodContinuityRows(items,"2027-01-01","2027-01-31");
 assert.deepEqual(scoped.map(x=>x.fecha),["2026-12-31","2027-01-01"]);
 assert.deepEqual(selectRop02PeriodContinuityRows(items,"2026-10-01","2026-10-31"),[]);
});
test("el control de errores y ficha por equipo usan referencia histórica y resaltado",()=>{
 const code=readFileSync(new URL("../src/modules/oficina-tecnica/OficinaTecnicaModule.jsx",import.meta.url),"utf8");
 assert.match(code,/selectRop02PeriodContinuityRows\(controlScope,rangoDesde,rangoHasta\)/);
 assert.match(code,/selectRop02PeriodContinuityRows\(controlScope,periodo\.fechaD,periodo\.fechaH\)/);
 assert.match(code,/limitRop02ErrorsToPeriod\(/);
 assert.match(code,/fichaErrorEntreDias&&key==="hi"/);
 assert.match(code,/Corte de continuidad de horómetro/);
});
