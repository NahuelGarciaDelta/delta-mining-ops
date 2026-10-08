# Validación de regresiones

| Área | Evidencia | Resultado |
| --- | --- | --- |
| Transformadores Vite CRLF | `pm-vite-pipeline-regression`, `rop02-trucks-pickups-split`, `abastecimiento-crlf-build` | PASS, 13/13 |
| Sintaxis de motor de costos | `npm run check` | PASS |
| Seguridad estática | `npm run lint:security` | PASS |
| ESLint | 0 errores, 824 advertencias heredadas | PASS con warnings |
| Build Vite | 957 módulos con workaround temporal de entorno | PASS condicionado |
| Aplicación productiva observada | La pantalla de Mantenimiento mostró 114 OT, tablas y gráficos sin loader infinito durante la inspección | PASS observacional; no es prueba automatizada |
| Suite completa | Fallos de Abastecimiento, Home/Dashboard, Atraso, Stock y contratos Apps Script ya presentes en la línea base | FAIL preexistente / pendiente |

## Clasificación del archivo Apps Script

`AppsScript_Delta_Mining_OPS_FINAL.txt` existió en commits históricos y fue retirado por `d482a36` (separación del desarrollo Supabase). Las pruebas que lo cargan siguen esperando ese monolito, mientras el árbol actual conserva `AppsScript_Delta_Mining_OPS_ROP02_OK.txt` y servicios de cliente. Restaurar el script histórico como producción sería una regresión de arquitectura; fabricar un fixture que sólo contenga cadenas esperadas daría un verde artificial. Se mantiene el fallo como contrato obsoleto hasta que se defina una fuente backend canónica versionada y sin secretos.
