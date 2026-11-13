import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const file=readFileSync(new URL("../src/standalone/adapters/supabaseReadApi.js",import.meta.url),"utf8");
const first=file.indexOf("let v9WelcomeSnapshotPending=null;");
const start=file.indexOf("export async function fetchSupabaseRop02LatestByEquipmentProject()",first);
const end=file.indexOf("\n}",start)+2;
assert.ok(first>=0&&start>first&&end>start,"Welcome snapshot function must be present");
const snippet=file.slice(first,end).replace("export async function","async function");
const normalized=value=>{
 const raw=String(value??"").trim();
 const iso=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
 if(iso)return iso[1]+"-"+iso[2].padStart(2,"0")+"-"+iso[3].padStart(2,"0");
 const loc=raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
 if(loc)return loc[3]+"-"+loc[2].padStart(2,"0")+"-"+loc[1].padStart(2,"0");
 return raw;
};

test("Cold welcome reads last 7 days without downloading all historical ROP02",async()=>{
 const makeDate=day=>new Date(Date.UTC(2026,9,1+day)).toISOString().slice(0,10);
 const rowsA=Array.from({length:1200},(_,i)=>({
  Fecha:makeDate(i<1100?Math.floor(i/40):30+Math.floor((i-1100)/15)),
  Interno:i>=1185?"CAR-0089-JM":"MOT-0047",
  Proyecto:"JOSE MARIA",
  "OD o FS":"OD",
  "Cant. Hs.":"5"
 }));
 // The most recent records are in November, not October.
 rowsA.splice(1100,100,...Array.from({length:100},(_,i)=>({
  Fecha:new Date(Date.UTC(2026,10,1+Math.floor(i/10))).toISOString().slice(0,10),
  Interno:i>=90?"CAR-0089-JM":"MOT-0047",
  Proyecto:"JOSE MARIA",
  "OD o FS":"OD",
  "Cant. Hs.":"5"
 })));
 const rowsB=Array.from({length:50},(_,i)=>({
  Fecha:new Date(Date.UTC(2026,10,4+Math.floor(i/10))).toISOString().slice(0,10),
  Interno:"CAC-0040",Proyecto:"FILO DEL SOL","OD o FS":"FS"
 }));
 const dataset={rop02_jm:rowsA,rop02_fs:rowsB};
 const requests=[];
 const getPage=async(source,limit,offset)=>{
  requests.push({source,limit,offset});
  const rows=dataset[source].slice(offset,offset+limit);
  return {total:dataset[source].length,rows:rows.map(payload=>({payload}))};
 };
 const f=new Function("getPage","ROP02_SOURCE_KEYS","normalizeV9PmDate","MAX_ROWS","fetchSupabaseSource",snippet+";return fetchSupabaseRop02LatestByEquipmentProject;")(getPage,Object.keys(dataset),normalized,60000,()=>{throw Error("Full history should not be needed for sorted Sheets")});
 const response=await f();
 assert.equal(response.referenceDate,"2026-11-10");
 assert.ok(response.data.some(row=>row.INTERNO==="CAR-0089-JM"));
 assert.ok(response.data.some(row=>row.INTERNO==="CAC-0040"));
 assert.ok(requests.length<10,"Cold page must avoid historic page fan-out");
 assert.ok(!requests.some(call=>call.source==="rop02_jm"&&call.offset>0&&call.offset<900),"Do not pull old JM history");
});

test("Welcome keeps full ROP02 history out of initial source list",()=>{
 const sources=readFileSync(new URL("../src/config/viewSources.js",import.meta.url),"utf8");
 assert.match(sources,/bienvenida:\["lista_equipos"\]/);
});
test("Welcome snapshot reads project tails and their seven-day pages concurrently",()=>{
 assert.match(file,/Math\.min\(5,ROP02_SOURCE_KEYS\.length\)/);
 assert.match(file,/Math\.min\(5,firstResults\.length\)/);
});
test("UI applies data as each source completes rather than waiting all sources",()=>{
 const app=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
 assert.match(app,/runWithConcurrency_\(toCheck,2,async key=>/);
 assert.match(app,/setRawSources\(prev=>\{/);
 assert.match(app,/const next=\{\.\.\.prev,\[key\]:item.value\}/);
});
