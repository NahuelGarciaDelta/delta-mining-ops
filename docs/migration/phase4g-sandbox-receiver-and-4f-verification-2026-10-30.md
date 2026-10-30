# DELTA OPS V9 — 4F V3 confirmado + 4G receptor aislado (30/10/2026)

## Resultado de Apps Script, 12:41 ART

El usuario ejecutó `dmV9Outbox4fPrepararEntregasV1`: `ok:true`, `mode:LOCAL_DELIVERY_PREPARED_NO_SEND`, `identitiesSnapshot=5295`, `preparedNew=0`, `alreadyPrepared=5295`, `stateTransitions=8`, `ledgerNewVersions=0`, `ledgerTotalVersions=5296`, `deliveryRows=5295`, `awaitingProductivity=8`, `rop02HoursNoTaskYet=2010`, `taskWithoutProductiveHoursYet=1`, `excludedAmbiguousTasks=1`, `excludedTask3Unmirrored=1`, `suppressedByLegacyContentDedup=4`, `historyGaps=0`, `missingHistoricalPayloads=0`, `productionWrites=0`, `supabaseWrites=0`, `realAckCount=0`.

Verificación independiente del libro [OUTBOX SOMBRA](https://docs.google.com/spreadsheets/d/1eAVJ4UJaPKz0xso_mxbvQCSoVb9viisREppxpaEQ-P8/edit): ENTREGAS_PREPARADAS 5295 claves únicas (5287 PREPARED_NO_SEND, 8 WAITING_PRODUCTIVITY_NO_SEND), VERSIONES_SOMBRA 5296 claves, diferencia de 1 JM por tarea 3 cuyas columnas originales no se incluyen en IMPORTRANGE. Sin hashes mal formados ni claves duplicadas. Las 2010 filas ROP02 con horas y sin tareas no son necesariamente atrasos; algunas pueden no requerir productividad.

`No results found for 'return {cfg...}'` aparece como aviso del buscador del editor de Apps Script, no excepción de runtime.

## Hallazgo de estructura productiva

Consulta SQL READ ONLY confirmó que `public.rop05` en Supabase PROD `jwfocqaxlckuxoklwyxs` aún usa `source_dataset` y `source_row` como identidad de la fila. NO cambiar la tabla ni escritores todavía.

## 4G creado y verificado, solo sandbox

En proyecto SANDBOX `biztlietuvvonigcfdwy` se añadieron las tablas privadas con RLS `delta_4g_sandbox.task_current`, `task_versions`, `receipts` y el RPC `public.delta_4g_sandbox_accept_v1`, accesible solo mediante `service_role` (anon/authenticated sin permiso). El RPC acepta EXCLUSIVAMENTE claves `test-4g-...` y un payload de 15 strings con marcador `SIMULATED_4G`, valida SHA-256 de los bytes exactos de JSON, revisión secuencial, request_id y replays idempotentes. Se verificaron v1, replay v1, v2 y replay histórico v1 con otro request, además de rechazos de SHA adulterado, salto de revisión, colisión de request_id y ID no sintético. Estado final: 1 registro ficticio, 2 versiones, 3 recibos. Cero producción, cero datos reales a sandbox.

SQL de referencia generado localmente en `4G_SANDBOX_RECEIVER.sql`; NO ejecutar ese SQL en producción.

## Condiciones para próximo corte

- La productividad puede cargarse después de las horas del parte: mismo ID+tarea, no DELETE ni duplicado.
- `PREPARED_NO_SEND` no equivale a productividad confirmada por el administrativo. Antes de enviar automáticamente, implementar cierre de productividad por criterio acordado; si se muestra preliminar, distinguir borrador de valor definitivo.
- Diseñar revisiones DE ENTREGA independientes de las revisiones de borrador de 4E. Si la tarea tenía 3 revisiones locales antes del primer envío, la entrega debe comenzar en revisión 1 para no quebrar la secuencia del receptor.
- Persistir request_id, SHA, payload y recibo; un timeout deja estado desconocido que se reconcilia por request_id antes de reintentar.
- Migrar con sidecar para ID de tarea sin cambiar `public.rop05` ni desactivar V8.1 hasta contar con corte reversible. Mantener excepciones de origen, duplicados heredados y tarea 3 no espejada.
