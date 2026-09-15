import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('src/modules/abastecimiento/AbastecimientoModule.jsx','utf8');

test('rechazo confirmado se refleja localmente y la verificación queda en segundo plano',()=>{
  assert.match(source,/setRejectedSolicitudes\(prev=>\{/);
  assert.match(source,/loadEstadosSolicitudesCompartidos\(\{silent:true\}\)\.catch\(err=>\{/);
  assert.doesNotMatch(source,/await loadEstadosSolicitudesCompartidos\(\{silent:true\}\);\s*setRejectModal/);
  assert.match(source,/El rechazo se guardó, pero falló la verificación en segundo plano/);
});

test('restaurar rechazo tampoco espera una recarga completa de estados',()=>{
  assert.match(source,/delete next\[key\]/);
  assert.match(source,/La restauración se guardó, pero falló la verificación en segundo plano/);
});
