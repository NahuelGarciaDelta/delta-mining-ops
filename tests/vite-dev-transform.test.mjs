import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('Vite serve transforma supabaseReadApi sin que ningún plugin rompa npm run dev', async () => {
  const server = await createServer({
    configFile: 'vite.config.js',
    logLevel: 'silent',
    server: { middlewareMode: true },
  });

  try {
    const result = await server.transformRequest('/src/services/supabaseReadApi.js');
    assert.ok(result?.code, 'Vite debe poder transformar supabaseReadApi.js en modo serve');
    assert.ok(result.code.includes('fetchSupabaseSource'));
    assert.ok(!result.code.includes('/api/supabase-read?target='), 'en npm run dev no debe aplicarse el proxy de Vercel');
  } finally {
    await server.close();
  }
});
