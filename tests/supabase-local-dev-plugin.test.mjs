import test from 'node:test';
import assert from 'node:assert/strict';
import { supabaseSameOriginProxyVitePlugin } from '../scripts/supabase-same-origin-proxy-vite-plugin.mjs';

const TARGET_ID='C:\\repo\\src\\services\\supabaseReadApi.js';

test('same-origin proxy no transforma lecturas Supabase durante npm run dev',()=>{
  const plugin=supabaseSameOriginProxyVitePlugin();
  plugin.configResolved({command:'serve'});
  const code='export const untouched=true;';
  const result=plugin.transform(code,TARGET_ID);
  assert.equal(result,null);
});

test('same-origin proxy transforma el transporte en build sin depender del espaciado exacto',()=>{
  const plugin=supabaseSameOriginProxyVitePlugin();
  plugin.configResolved({command:'build'});
  const code=`async function request(path,{method="GET",body=null,prefer=""}={}){
    const response = await fetch( \`\${SUPABASE_URL}\${path}\` , {
      method, cache:"no-store", signal:controller?.signal,
      headers: authHeaders({ ...(prefer?{Prefer:prefer}:{}), ...(body!==null?{"Content-Type":"application/json"}:{}) }),
      body:body===null?undefined:JSON.stringify(body),
    });
    return response;
  }`;
  const result=plugin.transform(code,TARGET_ID);
  assert.ok(result?.code.includes('/api/supabase-read?target='));
  assert.ok(result.code.includes('X-Delta-Supabase-Prefer'));
  assert.ok(!result.code.includes('fetch( `${SUPABASE_URL}${path}`'));
});
