import { promises as fs } from "node:fs";

const target=process.argv[2];
if(!target)throw new Error("Uso: node phase1c-rop02-row-reader-patch.mjs <index.jsx>");
let source=await fs.readFile(target,"utf8");
const original=source;
const marker='function toNumber(v){';
const reader=`function createRowValueReader(row){
  const source=row||{};
  const indexedKeys=Object.keys(source).map(key=>{
    const normalized=cleanKey(key);
    return{key,normalized,loose:normalized.replace(/[^a-z0-9]+/g,"")};
  });
  return keys=>{
    const wk=keys.map(cleanKey);
    const wkLoose=keys.map(cleanKeyLoose);
    for(const entry of indexedKeys){if(wk.includes(entry.normalized))return source[entry.key];}
    for(const entry of indexedKeys){if(wkLoose.includes(entry.loose))return source[entry.key];}
    for(const entry of indexedKeys){if(wk.some(w=>entry.normalized.includes(w)||w.includes(entry.normalized)))return source[entry.key];}
    for(const entry of indexedKeys){if(wkLoose.some(w=>entry.loose.includes(w)||w.includes(entry.loose)))return source[entry.key];}
    return"";
  };
}
`;
if((source.match(new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"g"))||[]).length!==1)throw new Error("Marcador toNumber no único");
source=source.replace(marker,reader+marker);
const lines=[
['const fechaRaw=getValue(r,["Fecha","Fecha:","col_0"]);','const read=createRowValueReader(r);\n    const fechaRaw=read(["Fecha","Fecha:","col_0"]);'],
['const internoRaw=String(getValue(r,["Interno","Código Interno","Codigo Interno","CODIGO N° INTERNO","col_1"])).trim();','const internoRaw=String(read(["Interno","Código Interno","Codigo Interno","CODIGO N° INTERNO","col_1"])).trim();'],
['const equipoRaw=String(getValue(r,["Equipo","EQUIPO","Tipo Equipo","Tipo de equipo","col_2"])).trim();','const equipoRaw=String(read(["Equipo","EQUIPO","Tipo Equipo","Tipo de equipo","col_2"])).trim();'],
['const operadorRaw=getValue(r,["Operador","col_3"]);','const operadorRaw=read(["Operador","col_3"]);'],
['const supervisorRaw=getValue(r,["Supervisor Delta","Supervisor","col_4"]);','const supervisorRaw=read(["Supervisor Delta","Supervisor","col_4"]);'],
['const supervisorClienteRaw=getValue(r,["Supervisor Vial Cliente","Supervisor Cliente","col_5"]);','const supervisorClienteRaw=read(["Supervisor Vial Cliente","Supervisor Cliente","col_5"]);'],
['const turnoRaw=getValue(r,["Turno de trabajo","Turno","col_6"]);','const turnoRaw=read(["Turno de trabajo","Turno","col_6"]);'],
['const parteRaw=getValue(r,["N° Parte","Nº Parte","N Parte","Parte","col_7"]);','const parteRaw=read(["N° Parte","Nº Parte","N Parte","Parte","col_7"]);'],
['const proyectoRaw=getValue(r,["Proyecto","Proyecto ","proyecto","col_8"]);','const proyectoRaw=read(["Proyecto","Proyecto ","proyecto","col_8"]);'],
['const hiRaw=getValue(r,["Horómetro inicial","Horometro inicial","HI","col_9"]);','const hiRaw=read(["Horómetro inicial","Horometro inicial","HI","col_9"]);'],
['const hfRaw=getValue(r,["Horómetro final","Horometro final","HF","col_10"]);','const hfRaw=read(["Horómetro final","Horometro final","HF","col_10"]);'],
['const cantHs=getValue(r,["Cant. Hs.","Cant.Hs/ KM","Cant.Hs","Cant Hs","Cantidad de horas","col_11"]);','const cantHs=read(["Cant. Hs.","Cant.Hs/ KM","Cant.Hs","Cant Hs","Cantidad de horas","col_11"]);'],
['const combustibleRaw=getValue(r,["Combustible","col_12"]);','const combustibleRaw=read(["Combustible","col_12"]);'],
['const aceiteRaw=getValue(r,["Aceite","col_13"]);','const aceiteRaw=read(["Aceite","col_13"]);'],
['const trabajo=String(getValue(r,["Descripción de los trabajos realizados","Descripcion de los trabajos realizados","Trabajos realizados","Descripción","Descripcion","col_14"])).trim();','const trabajo=String(read(["Descripción de los trabajos realizados","Descripcion de los trabajos realizados","Trabajos realizados","Descripción","Descripcion","col_14"])).trim();'],
['const desgasteRaw=getValue(r,["Información sobre Desgaste","Informacion sobre Desgaste","Desgaste","col_15"]);','const desgasteRaw=read(["Información sobre Desgaste","Informacion sobre Desgaste","Desgaste","col_15"]);'],
['const obs=String(getValue(r,["Observaciones","OBSERVACIONES","col_16"])).trim();','const obs=String(read(["Observaciones","OBSERVACIONES","col_16"])).trim();']
];
for(const [from,to] of lines){const count=source.split(from).length-1;if(count!==1)throw new Error(`Reemplazo no único: ${from}`);source=source.replace(from,to);}
const startMarker='function normalizeROP02(';
const endMarker='function normSupervisorROP05(';
if(source.split(startMarker).length!==2||source.split(endMarker).length!==2)throw new Error("Marcadores normalizeROP02 no únicos");
const start=source.indexOf(startMarker),end=source.indexOf(endMarker);
if(start<0||end<=start)throw new Error("Bloque normalizeROP02 inválido");
const normalizeROP02Block=source.slice(start,end);
if(/\bread\s*\(\s*r\s*,/.test(normalizeROP02Block))throw new Error("normalizeROP02 conserva una llamada read(r, ...)");
if(!normalizeROP02Block.includes('const read=createRowValueReader(r);'))throw new Error("Falta reader local ROP02");
if(normalizeROP02Block.includes('getValue(r,'))throw new Error("normalizeROP02 conserva getValue(r, ...)");
if((normalizeROP02Block.match(/\bread\s*\(\s*\[/g)||[]).length!==17)throw new Error("Cantidad inesperada de lecturas read([...])");
if(source===original)throw new Error("El parche no produjo cambios");
await fs.writeFile(target,source);
