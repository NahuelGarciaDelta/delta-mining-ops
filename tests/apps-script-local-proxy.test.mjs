import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadConfigFromFile } from 'vite';

const configPath=fileURLToPath(new URL('../vite.config.js', import.meta.url));

test('Vite dev expone /api/apps-script y lo reenvía al Web App real', async()=>{
  const loaded=await loadConfigFromFile({command:'serve',mode:'development'},configPath);
  const proxy=loaded?.config?.server?.proxy?.['/api/apps-script'];

  assert.ok(proxy,'Falta proxy local para /api/apps-script');
  assert.equal(proxy.target,'https://script.google.com');
  assert.equal(proxy.changeOrigin,true);
  assert.equal(proxy.secure,true);
  assert.equal(proxy.followRedirects,true);

  const rewritten=proxy.rewrite('/api/apps-script?action=stock_excel_data&_test=1');
  assert.match(rewritten,/^\/macros\/s\/[^/]+\/exec\?action=stock_excel_data&_test=1$/);
});
