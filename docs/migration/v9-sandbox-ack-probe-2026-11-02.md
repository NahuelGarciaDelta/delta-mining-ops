# DELTA OPS V9 — avance funcional de ACK verificable en sandbox (02/11/2026)

## Estado del punto de partida
Se confirmó en la rama de migración que las fases documentadas llegan a 4N. Los archivos Google Apps Script **4B/4D de ejecución** no están versionados allí; los documentos indican reemplazos realizados en el clon. NO recrear el clon ni reinstalar activadores para suplir esta falta.

Supabase productivo `jwfocqaxlckuxoklwyxs`, consultas READ ONLY: 5295 identidades, 5272 revisiones sombra, cero delivery receipts, cero habilitaciones. Compuerta dinámica al momento de la consulta: 5195 BLOCKED_CLOSURE_UNCONFIRMED, 35 BLOCKED_SOURCE_DRIFT, 33 BLOCKED_LEGACY_REVIEW, 1 BLOCKED_NUMERIC_ANOMALY, 8 BLOCKED_PRODUCTIVITY_PENDING, 23 BLOCKED_UNLINKED. No aplicar rebase ni publicar automáticamente.

Supabase sandbox `biztlietuvvonigcfdwy`: receptor `public.v9_ingest_accept_batch_v1` existente, 5295 filas ROP05 versión 1, 53 recibos de lotes, 13 datasets catalogados (ninguno migrado). Son pruebas de ingestión del sandbox, **NO ACK de publicación operativa en producción**.

## Cambio funcional realizado, sólo sandbox
En vez de crear otro receptor, se amplió la firma EXISTENTE y compatible `public.v9_ingest_probe_v1(text,text[])`, sin alterar los argumentos ni quitar campos anteriores. Agrega:
- `payload_sha256`: huella persistida por el servidor para el contenido JSONB canónico.
- `digest_verified`: compara esa huella con el contenido realmente persistido. Una respuesta de probe con `digest_verified=false` obliga a bloquear la confirmación.
- Se mantienen `record_id`, `delivery_revision`, `source_sha256`, `productivity_state`, `publication_status`.

Migración aplicada exclusivamente a sandbox: [SQL](../../supabase/v9_migration/20261102_v9_sandbox_probe_digest.sql). La comprobación sigue siendo `SECURITY INVOKER`, `service_role` tiene EXECUTE y anon/authenticated no. No hay nuevos triggers, POST, escritura operativa ni cambio en V8.1.

Esta consulta **no crea un ACK ni acredita un cierre administrativo**. Para resolver HTTP incierto, el consumidor deberá reintentar el mismo `request_id` usando el receptor idempotente y/o contrastar revision+hash con el probe. No confundir `source_sha256` del borrador con `payload_sha256` del JSONB remoto. Una ausencia en el probe no autoriza un DELETE.

## Verificaciones ejecutadas
- Tests Node de contrato en `tests/v9-ack-probe-contract.test.mjs`: **4/4 PASS** (`node --test tests/v9-ack-probe-contract.test.mjs`), con SHA git de los archivos locales igual al repositorio.
- Sandbox SQL: tres registros existentes consultados, **3/3 hashes y revisiones correctas**; 0 payloads crudos devueltos; solicitud de registro inexistente -> `[]`; total 5295 filas sin cambios.
- Sandbox SQL: muestra máxima de 100 registros, **100/100 con hash válido**.
- Control de permisos: anon=false, authenticated=false, service_role=true.
- Entradas inválidas: 101 identificadores y dataset desconocido rechazados como `V9_BAD_PROBE`.

## Rollback explícito
Archivo [reversión exacta](../../supabase/v9_migration/rollback_20261102_v9_sandbox_probe_digest.sql), capturado antes de modificar el RPC. Si fuera necesario, ejecutar **solo** en el SQL editor del proyecto sandbox `biztlietuvvonigcfdwy`. Restituye el cuerpo original de `v9_ingest_probe_v1` y sus permisos. Verificar la firma y que la prueba vuelva a devolver las claves anteriores. No ejecutarlo en producción.

## Pendientes obligatorios para publicación real
1. Versionar el código **real** de los Apps Script 4B/4D instalados en clon; la rama contiene documentación y scripts anteriores, no ese consumidor operativo. Evitar reconstruirlo a ciegas.
2. Integrar transporte del outbox con `request_id`, `delivery_revision` independiente de `draft_revision`, confirmación remota de `payload_sha256`, receipt duradero y recuperación de HTTP ambiguo. La ampliación del probe facilita un paso, no sustituye el consumidor.
3. Formalizar publicación provisional o validación de cierre **sin** exigir productividad simultánea a ROP02. `WAITING_PRODUCTIVITY_NO_SEND` no implica cero ni baja. Nueva tarea tardía: misma identidad+tarea, nueva revisión entregable.
4. Investigar 35 referencias con deriva, 23 tareas sin contraparte, 33 revisiones heredadas y anomalía numérica; preservar 8 pendientes y los casos históricos de ID ambiguo sin corrección automática.
5. Mantener V8.1 como escritor único hasta un canary reversible autorizado y comprobar remitos, RABA03, insumos, lista de equipos, RMA15, stock, usuarios y otros módulos contra sincronizador actual, no contra sólo la visibilidad del frontend.

## Condición de corte
No confundir 53 recibos de pruebas del sandbox con ACK productivos. No modificar `public.rop05` productivo ni liberar CHECK `delivery_enabled=false` sin autorización y reconciliación live; respaldar estado y realizar rollback por restauración del escritor previo, nunca por eliminación indiscriminada de datos.
