import test from 'node:test';
import assert from 'node:assert/strict';
import {createInflightRead} from '../src/services/inflightRead.js';
import {fetchSupabaseDatasetQuery} from '../src/services/supabaseReadApi.js';
import {fetchAbastecimientoSnapshot,fetchRaba03FromSupabase} from '../src/services/raba03ReadApi.js';
import {getAllTallerMovements} from '../src/services/tallerMovements.js';

const response=data=>({ok:true,text:async()=>JSON.stringify(data),headers:{get:name=>name==='content-range'?'0-0/1':null}});
test('overlapping reads share one operation; completed and failed reads never become stale cache',async()=>{
 const read=createInflightRead();let release,calls=0;
 const work=()=>{calls++;return new Promise(r=>{release=r})};
 const first=read('A',work),second=read('A',work);assert.equal(first,second);
 await Promise.resolve();assert.equal(calls,1);release(1);assert.deepEqual(await Promise.all([first,second]),[1,1]);
 assert.equal(await read('A',()=>2),2);
 const failed=read('A',()=>{throw Error('failure')});await assert.rejects(failed,/failure/);
 assert.equal(await read('A',()=>3),3);assert.equal(await read('B',()=>4),4);
});
test('ROP02 projects/dates/sorts/turns retain results while concurrent identical pages share transfer',async t=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original});let calls=0;const paths=[];
 let row={source_key:'SRC|ROP02_JM|2',fecha:'2026-10-01',interno:'CTA-0530',proyecto:'JOSE MARIA',turno_trabajo:'TN',horometro_inicial:10,horometro_final:14,cantidad_horas:4,estado:'OD',aceite_text:'4 litros',observaciones:'preservar'};
 globalThis.fetch=async url=>{calls++;paths.push(new URL(url));await new Promise(r=>setTimeout(r,5));return response([row])};
 const params={dataset:'rop02',proyecto:'JOSE MARIA',desde:'2026-09-26',hasta:'2026-10-25',limit:250};
 const results=await Promise.all(Array.from({length:4},()=>fetchSupabaseDatasetQuery(params)));
 assert.equal(calls,1);results.forEach(r=>assert.deepEqual(r.data,results[0].data));
 const q=paths[0].searchParams;assert.notEqual(q.get('select'),'*');assert.equal(q.get('proyecto'),'eq.JOSE MARIA');assert.equal(q.get('and'),'(fecha.gte.2026-09-26,fecha.lte.2026-10-25)');
 assert.equal(results[0].data[0].Turno,'TN');assert.equal(results[0].data[0].Aceite,'4 litros');assert.equal(results[0].data[0].Estado,'OD');
 row={...row,horometro_final:15};assert.equal((await fetchSupabaseDatasetQuery(params)).data[0].HF,15);assert.equal(calls,2);
 await fetchSupabaseDatasetQuery({...params,proyecto:'FILO DEL SOL'});assert.equal(calls,3);
});
test('Abastecimiento simultaneous snapshot and RABA03 reads deduplicate independently; later saves remain fresh',async t=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original});let calls=0;
 globalThis.fetch=async url=>{calls++;await new Promise(r=>setTimeout(r,5));return response(String(url).includes('/rpc/')?{rows:[1]}:[{source_row:1,row_data:{Estado:'pendiente'}}])};
 const results=await Promise.all([fetchAbastecimientoSnapshot(),fetchAbastecimientoSnapshot(),fetchRaba03FromSupabase(),fetchRaba03FromSupabase()]);assert.equal(calls,2);assert.deepEqual(results[0],results[1]);assert.deepEqual(results[2],results[3]);
 await fetchAbastecimientoSnapshot();assert.equal(calls,3);
});
test('Taller simultaneous consumers share a complete history; subsequent read obtains a newly saved movement',async t=>{
 const original=globalThis.fetch,storage=globalThis.localStorage;t.after(()=>{globalThis.fetch=original;if(storage===undefined)delete globalThis.localStorage;else globalThis.localStorage=storage});globalThis.localStorage={setItem(){},getItem(){return null}};let calls=0;
 globalThis.fetch=async()=>{calls++;await new Promise(r=>setTimeout(r,5));return response({ok:true,data:[{TIPO:'SUBIDA',INTERNO:'CTA-0530',id:calls}]})};
 const data=await Promise.all(Array.from({length:4},()=>getAllTallerMovements()));assert.equal(calls,1);data.forEach(r=>assert.deepEqual(r,data[0]));assert.equal((await getAllTallerMovements())[0].id,2);assert.equal(calls,2);
});

test('repeated module navigation reuses bounded cache; explicit refresh reads newly saved data',async t=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original});
 const {getRop05,refreshHistoricalDataset,clearHistoricalQueryMemory}=await import('../src/data/historicalDataService.js');
 clearHistoricalQueryMemory();let version=100,rows=0;
 globalThis.fetch=async url=>{
   assert.doesNotMatch(String(url),/delta_source_versions/);
   rows++;return response([{fecha:'2026-10-01',interno:'CTA-0530',raw_data:{},horas_productivas:version}]);
 };
 const params={desde:'2026-09-26',hasta:'2026-10-25',limit:'all'};
 const first=await getRop05(params);
 for(let i=0;i<5;i++)assert.deepEqual((await getRop05(params)).data,first.data);
 assert.equal(rows,1);
 version=101;
 const refreshed=await refreshHistoricalDataset('rop05',params);
 assert.equal(rows,2);
 assert.notDeepEqual(refreshed.data,first.data);
 clearHistoricalQueryMemory();
});
