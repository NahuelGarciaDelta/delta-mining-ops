# 4J — Conciliación ROP05 existente vs identidades V9 (2026-10-30)

## Resultado 4I confirmado

El usuario ejecutó `dmV9PrevisualizarFase4iRevisionesPublicacionV1` a las 13:11 ART: ok=true, outboxRows=5295, distinctTasks=5295, draftsChecked=5295, readyCandidates=5287, waitingProductivity=8, historyGaps=0, ackProofsChecked=0, firstDeliveryRevisionCandidates=5287, productionWrites=0, localWrites=0, realTransmissions=0, authorizedToTransmit=0, closureConfirmed=false, publishingEnabled=false.

## Conciliación 4J, READ ONLY (NO SQL ALTER/INSERT/UPDATE)

Tablas comparadas por herramientas conectadas, sin exportación:
- Libro privado outbox V9 `1eAVJ4UJaPKz0xso_mxbvQCSoVb9viisREppxpaEQ-P8`, `ENTREGAS_PREPARADAS!A2:G5296`: 5.295 tareas, cada una con clave estable y JSON canónico de 15 valores.
- Libro ROP05 productivo `1HYlylloC0TMsOWTpwvZ8YaXk5RLRKZ2PmOlhc7TCovw`, `ROP05 nuevo!A4431:O9727`: 5.297 filas físicas, incluidas posibles filas fuera del conjunto V9.
- Supabase PROD `jwfocqaxlckuxoklwyxs` `public.rop05`: 9.726 filas, `source_dataset='rop05'`, source_row 2..9727, 5.297 filas en tramo 4431..9727; 90 sincronizadas en últimas 24 horas (consulta leída a las 13:xx ART). **Se verificaron conteos y esquema de Supabase, NO igualdad campo a campo de las 9.726 filas Supabase contra Sheets**.

Se normalizaron los valores de fecha DD/MM/YYYY a YYYY-MM-DD, mes MM/YYYY sin prefijo de escape, valores vacíos y cadenas de las 15 columnas; la coincidencia exacta usa los 15 valores y la natural usa (fecha, proyecto, interno, número de parte, equipo, tarea).

| Clasificación V9 vs fila ROP05 Sheets existente | Cantidad |
|---|---:|
| Coincidencia exacta única de los 15 campos | 5.238 |
| Sin coincidencia exacta, pero una coincidencia natural única | 34 |
| Sin coincidencia exacta ni natural | 23 |
| Total | 5.295 |

Todos los 8 registros de productividad pendiente quedaron entre las 5238 coincidencias exactas. De las 34 coincidencias naturales, cambios observados en columnas: largo 26, ancho 3, profundidad 8, cantidad producida 30 (un registro puede afectar varias columnas). No hubo otras diferencias de columnas entre esos 34. Esto es compatible con actualizaciones diferidas de productividad, aunque el mecanismo concreto de edición no se puede afirmar solo con el corte actual.

Las 23 sin correspondencia están todas en José María, repartidas por fecha de parte:
- 2026-08-26: 1
- 2026-09-01: 1; 09-02: 4; 09-03: 3; 09-04: 4; 09-05: 4; 09-06: 2
- 2026-10-28: 2; 10-29: 2
Ninguna de esas 23 tiene un candidato en la hoja ROP05 existente usando **fecha+proyecto+interno+número de parte** ni siquiera sin fecha usando proyecto+interno+número de parte; eso refuerza ausencia del parte en la población ROP05 actual, pero no confirma autorización para insertarlo ni explica el motivo.

A la inversa, 25 filas de ROP05 no se pudieron emparejar con ninguna de las 5295 tareas V9 en la comparación realizada (podrían abarcar filas históricas, registro de excepciones o tareas suprimidas; NO borrarlas).

## Implicación de migración

**No publicar las 5.287 candidatas como nuevas inserciones.** La mayoría ya existe en el ROP05 legado y la tabla Supabase actual se identifica por `source_dataset='rop05'` y `source_row` físico, mientras V9 pretende `(dataset,source_id,tarea)`. Hay que construir un **índice sidecar (task_key -> source_row legado) con reglas de unicidad y revisión** sin reescribir primero `public.rop05`.

- 5.238: asociaciones EXACTAS candidatas a aceptación automática de lectura, todavía falta verificación Supabase por fila.
- 34: asociaciones por clave natural única con dimensiones/cantidad divergentes; analizar la versión deseada y la fecha de actualización, no crear un nuevo registro.
- 23: cuarentena, investigar ausencia en ROP05; no insertar automáticamente.
- 25 filas del legado no vinculadas: conservar y analizar procedencia antes de borrar cualquier cosa.

El usuario indicó expresamente que un ROP02 puede contener horas sin productividad y modificarse días después. Mantener el mismo `task_key`, no equiparar sin tarea a eliminación, no usar la fila física como identidad futura. Las revisiones locales de borrador no deben confundirse con la secuencia remota de publicación.

## Seguridad y estado

Solo consultas a producción, ninguna escritura. No se generaron ACK reales ni se activaron triggers V9. La fase 4I queda aprobada para cálculo de publicación. La fase 4J es conciliación READ ONLY, **NO** cutover ni aprobación para escrituras productivas. Conservar V8.1 operando hasta introducir el índice de identidad con prueba de concurrencia, recibos remotos versionados, reversibilidad y exclusiones.

## Siguiente avance significativo

Diseñar/codificar puente sidecar y consulta de conciliación `task_key -> legacy source_row` con bloqueo de conflictos, sin modificar `rop05`; contrastar el vínculo con registros existentes de Supabase por source_row. Evaluar primero entorno aislado y reglas de cierre/publicación (sin imponer cierre administrativo inexistente). No crear nueva secuencia redundante de pruebas 4H/4I.
