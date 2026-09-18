import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { createServer } from 'vite';

async function sourceFiles(dir){
  const entries=await readdir(dir,{withFileTypes:true});
  const files=[];
  for(const entry of entries){
    const full=join(dir,entry.name);
    if(entry.isDirectory())files.push(...await sourceFiles(full));
    else if(/\.(?:js|jsx)$/.test(entry.name))files.push(full);
  }
  return files;
}

test('Vite serve transforma todo src sin que ningún plugin rompa npm run dev', async () => {
  const server = await createServer({
    configFile: 'vite.config.js',
    logLevel: 'silent',
    server: { middlewareMode: true },
  });

  try {
    const supabase=await server.transformRequest('/src/services/supabaseReadApi.js');
    assert.ok(supabase?.code, 'Vite debe poder transformar supabaseReadApi.js en modo serve');
    assert.ok(supabase.code.includes('fetchSupabaseSource'));
    assert.ok(!supabase.code.includes('/api/supabase-read?target='), 'en npm run dev no debe aplicarse el proxy de Vercel');

    const files=await sourceFiles(join(process.cwd(),'src'));
    assert.ok(files.length>0,'debe encontrar archivos fuente para validar');

    for(const file of files){
      const requestPath='/'+relative(process.cwd(),file).split(sep).join('/');
      try{
        const result=await server.transformRequest(requestPath);
        assert.ok(result?.code,`Vite debe transformar ${requestPath}`);
      }catch(error){
        throw new Error(`Falló el pipeline de npm run dev al transformar ${requestPath}: ${error?.message||error}`,{cause:error});
      }
    }
  } finally {
    await server.close();
  }
});
