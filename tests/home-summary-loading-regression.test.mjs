import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { patchHomeSummaryLoading } from '../scripts/home-summary-loading-fix-vite-plugin.mjs';

test('Resumen General no queda en Cargando por error o demora de movimientos', async () => {
  const source = await readFile(new URL('../src/modules/home/ViewBienvenida.jsx', import.meta.url), 'utf8');
  const patched = patchHomeSummaryLoading(source);

  assert.ok(patched.includes('disponibilidad:rop.length===0,'));
  assert.ok(!patched.includes('disponibilidad:rop.length===0||!movimientosLoaded||Boolean(movimientosError)'));
  assert.ok(!patched.includes('loaded:movimientosLoaded,error:movimientosError'));
});

test('OT abiertas distingue entre esperando respuesta y resultado vacío válido', async () => {
  const source = await readFile(new URL('../src/modules/home/ViewBienvenida.jsx', import.meta.url), 'utf8');
  const patched = patchHomeSummaryLoading(source);

  assert.ok(patched.includes('const [openOtReady,setOpenOtReady]=useState(false);'));
  assert.ok(patched.includes('setOpenOtSummary(Array.isArray(response?.data)?response.data:[]);'));
  assert.ok(patched.includes('if(alive)setOpenOtReady(true);'));
  assert.ok(patched.includes('ot:!openOtReady,'));
  assert.ok(!patched.includes('ot:rma.length===0||!movimientosLoaded||Boolean(movimientosError)'));
});
