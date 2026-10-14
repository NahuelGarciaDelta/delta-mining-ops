import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {transform} from 'esbuild';
const source=fs.readFileSync(new URL('../supabase/functions/insumos-auto-sync/index.ts',import.meta.url),'utf8');
test('Insumos safety check transfers no rows; count and read errors are preserved',async t=>{
 const oldFetch=globalThis.fetch,oldDeno=globalThis.Deno;t.after(()=>{globalThis.fetch=oldFetch;if(oldDeno===undefined)delete globalThis.Deno;else globalThis.Deno=oldDeno});
 globalThis.Deno={env:{get:name=>name==='SUPABASE_URL'?'https://fixture.invalid':'fixture-only-key'},serve(){}};
 const transformed=await transform(source.replace('import "jsr:@supabase/functions-js/edge-runtime.d.ts";','')+'\nexport {tableRows};',{loader:'ts',format:'esm'});
 const mod=await import('data:text/javascript;base64,'+Buffer.from(transformed.code).toString('base64'));let calls=[];
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return{ok:true,headers:{get:()=> '0-0/1879'}}};
 assert.equal(await mod.tableRows(),1879);assert.equal(calls.length,1);assert.equal(calls[0].options.method,'HEAD');assert.equal(calls[0].options.headers.Prefer,'count=exact');assert.ok(calls[0].url.includes('source_dataset=eq.insumos'));
 globalThis.fetch=async()=>({ok:false,status:403});await assert.rejects(mod.tableRows(),/DEST_COUNT_403/);
});
