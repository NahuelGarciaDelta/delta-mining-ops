import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { abastecimientoLineEndingsVitePlugin } from '../scripts/abastecimiento-line-endings-vite-plugin.mjs';
import { abastecimientoInstantVitePlugin } from '../scripts/abastecimiento-instant-vite-plugin.mjs';

const id='C:/repo/src/modules/abastecimiento/AbastecimientoModule.jsx';
const source=fs.readFileSync('src/modules/abastecimiento/AbastecimientoModule.jsx','utf8');

test('Abastecimiento build transforma correctamente una copia CRLF de Windows',()=>{
  const crlf=source.replace(/\r?\n/g,'\r\n');
  const normalizedResult=abastecimientoLineEndingsVitePlugin().transform(crlf,id);
  assert.ok(normalizedResult?.code,'El normalizador debe transformar CRLF');
  assert.equal(normalizedResult.code.includes('\r\n'),false,'No deben quedar saltos CRLF');

  const instantResult=abastecimientoInstantVitePlugin().transform(normalizedResult.code,id);
  assert.ok(instantResult?.code,'El plugin de Abastecimiento debe completar la transformación');
  assert.match(instantResult.code,/fechaSalidaFuente:formatDateLocal\(pick\(r,\["Fecha de salida","Fecha salida"\]\)\)/);
  assert.match(instantResult.code,/const indicadoresCerrados=filasActivas\.filter\(/);
  assert.match(instantResult.code,/label="Ítems con salida" value=\{fmtNum\(d\.cerradas\+d\.parciales\)\}/);
});

test('el normalizador no altera una copia que ya usa LF',()=>{
  const lf=source.replace(/\r\n?/g,'\n');
  assert.equal(abastecimientoLineEndingsVitePlugin().transform(lf,id),null);
});
