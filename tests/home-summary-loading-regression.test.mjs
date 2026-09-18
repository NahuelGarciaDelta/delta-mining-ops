import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { patchHomeSummaryLoading } from '../scripts/home-summary-loading-fix-vite-plugin.mjs';

async function getSource(){
  return readFile(new URL('../src/modules/home/ViewBienvenida.jsx', import.meta.url), 'utf8');
}

function assertPatched(patched){
  assert.ok(patched.includes('disponibilidad:rop.length===0,'));
  assert.ok(!patched.includes('disponibilidad:rop.length===0||!movimientosLoaded||Boolean(movimientosError)'));
  assert.ok(!patched.includes('loaded:movimientosLoaded,error:movimientosError'));
  assert.ok(patched.includes('const [openOtReady,setOpenOtReady]=useState(false);'));
  assert.ok(patched.includes('setOpenOtSummary(Array.isArray(response?.data)?response.data:[]);'));
  assert.ok(patched.includes('if(alive)setOpenOtReady(true);'));
  assert.ok(patched.includes('ot:!openOtReady,'));
  assert.ok(!patched.includes('ot:rma.length===0||!movimientosLoaded||Boolean(movimientosError)'));
}

test('Resumen General no queda en Cargando por error o demora de movimientos', async () => {
  assertPatched(patchHomeSummaryLoading(await getSource()));
});

test('OT abiertas distingue entre esperando respuesta y resultado vacío válido', async () => {
  assertPatched(patchHomeSummaryLoading(await getSource()));
});

test('el parche funciona con CRLF de Windows', async () => {
  const source = (await getSource()).replace(/\n/g,'\r\n');
  assertPatched(patchHomeSummaryLoading(source));
});

test('el parche es idempotente para HMR', async () => {
  const once = patchHomeSummaryLoading(await getSource());
  const twice = patchHomeSummaryLoading(once);
  assert.equal(twice, once);
});
