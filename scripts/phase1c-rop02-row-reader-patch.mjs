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
['const fechaRaw=getValue(r,','const read=createRowValueReader(r);\n    const fechaRaw=read('],
['String(getValue(r,["Interno"','String(read(["Interno"'],['String(getValue(r,["Equipo"','String(read(["Equipo"'],
['const operadorRaw=getValue','const operadorRaw=read'],['const supervisorRaw=getValue','const supervisorRaw=read'],['const supervisorClienteRaw=getValue','const supervisorClienteRaw=read'],['const turnoRaw=getValue','const turnoRaw=read'],['const parteRaw=getValue','const parteRaw=read'],['const proyectoRaw=getValue','const proyectoRaw=read'],['const hiRaw=getValue','const hiRaw=read'],['const hfRaw=getValue','const hfRaw=read'],['const cantHs=getValue','const cantHs=read'],['const combustibleRaw=getValue','const combustibleRaw=read'],['const aceiteRaw=getValue','const aceiteRaw=read'],['String(getValue(r,["Descripción','String(read(["Descripción'],['const desgasteRaw=getValue','const desgasteRaw=read'],['String(getValue(r,["Observaciones"','String(read(["Observaciones"']
];
for(const [from,to] of lines){const count=source.split(from).length-1;if(count!==1)throw new Error(`Reemplazo no único: ${from}`);source=source.replace(from,to);}
if(/\bread\(r\s*,/.test(source))throw new Error("normalizeROP02 conserva una llamada read(r, ...)");
if(source===original)throw new Error("El parche no produjo cambios");
await fs.writeFile(target,source);
