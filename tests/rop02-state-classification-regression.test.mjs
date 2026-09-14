import test from "node:test";
import assert from "node:assert/strict";
import { rop02StateClassificationVitePlugin } from "../scripts/rop02-state-classification-vite-plugin.mjs";

const oldFunction=`function detectEstado(trabajo,obs,hs){
  const hsStr=String(hs||"").trim().toUpperCase();
  if(/\\bFS\\b/.test(hsStr)||hsStr.includes("FUERA DE SERVICIO"))return"FS";
  if(/\\bOD\\b/.test(hsStr)||hsStr.includes("ORDEN DEL DIA")||hsStr.includes("ORDEN DEL DÍA"))return"OD";
  if(/\\bEM\\b/.test(hsStr)||hsStr.includes("EQUIPO EN MANTENIMIENTO")||hsStr.includes("EN MANTENIMIENTO"))return"EM";
  return"TRABAJO";
}`;

const fixture=`${oldFunction}\nconst row={estado:detectEstado(trabajo,obs,cantHs),};`;
const transformed=rop02StateClassificationVitePlugin().transform(fixture,"/repo/src/shared/domain/index.jsx").code;
const fnSource=transformed.match(/function detectEstado\(trabajo,obs,hs,estadoOriginal=""\)\{[\s\S]*?\n\}/)?.[0];
const detectEstado=new Function(`${fnSource}; return detectEstado;`)();

test("ROP02 con 0 h conserva estados operativos FS/OD/EM",()=>{
  assert.equal(detectEstado("Equipo fuera de servicio","",0,""),"FS");
  assert.equal(detectEstado("Operativo a disposición","",0,""),"OD");
  assert.equal(detectEstado("Equipo en mantenimiento","",0,""),"EM");
});

test("estado explícito de Supabase también se respeta y horas > 0 siguen siendo trabajo",()=>{
  assert.equal(detectEstado("","",0,"FS"),"FS");
  assert.equal(detectEstado("","",0,"OD"),"OD");
  assert.equal(detectEstado("","",0,"EM"),"EM");
  assert.equal(detectEstado("Equipo fuera de servicio","",3,"FS"),"TRABAJO");
});

test("normalización ROP02 pasa el Estado original a la clasificación",()=>{
  assert.match(transformed,/getValue\(r,\["estado","Estado","ESTADO"\]\)/);
});
