import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const dir=new URL('../supabase/proposals/20261014_skip_unchanged_typed_rows/',import.meta.url);
test('reversible proposal preserves business assignments and existing deletion clauses',()=>{
 const forward=fs.readFileSync(new URL('forward.sql',dir),'utf8'),rollback=fs.readFileSync(new URL('rollback.sql',dir),'utf8');
 const clean=s=>s.replace(/^--[^\n]*\n/gm,'').replace(/\r\n/g,'\n');
 const original=clean(rollback);
 const updateSets=s=>[...s.matchAll(/do update set ([^;]+?)(?:\n    WHERE|;)/g)].map(x=>x[1]);
 assert.deepEqual(updateSets(clean(forward)),updateSets(original));
 assert.equal((forward.match(/IS DISTINCT FROM/g)||[]).length,JSON.parse(fs.readFileSync(new URL('manifest.json',dir))).changedClauses.reduce((n,x)=>n+x.columns.length,1));
 assert.equal((forward.match(/delete from/g)||[]).length,(rollback.match(/delete from/g)||[]).length);
});
