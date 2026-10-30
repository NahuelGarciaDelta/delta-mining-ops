# 4H validada en Apps Script y 4I preparada (30/10/2026)

## Registro de usuario 4H: 13:03 ART

El usuario ejecutó `probarMigracionFase4hAckDesdeColaV1`. Resultado `ok:true`, `4H_SYNTHETIC_ACK_FROM_REAL_OUTBOX_COUNTS`, `outboxRows:5295`, `readyNotConfirmed:5287`, `awaitingProductivity:8`, `historyGaps:0`, `syntheticNotSent:2`, `syntheticAckResponses:4`, `acceptedRevision1/2:true`, `replayRevision1/2:true`, `sandboxRef:biztlietuvvonigcfdwy`, `operationalRowsTransmitted:0`, `operationalRowsAcked:0`, `outboxRowsChanged:0`, `productionWrites:0`, `realAckCount:0`. FASE 4H queda validada para transporte sintético; no hubo ACK real de tareas ROP05.

## 4I: separar revisiones locales (borrador) y remotas (publicación)

La carga de productividad no es simultánea con ROP02: un parte primero puede tener horas y después tareas/mediciones. El primer envío de una tarea debe usar `deliveryRevision=1` aunque su borrador `draftRevision` ya haya cambiado tres veces. Después de un ACK real del hash publicado, cualquier cambio debe generar `deliveryRevision+1`, misma `task_key`, sin crear otra tarea ni borrar por una ausencia transitoria.

Se preparó el archivo actualizado `DM_UNIFIED_PHASE4D_ACK_VERSION_SANDBOX_V1.gs` que conserva 4D/4H y añade entrada `dmV9PrevisualizarFase4iRevisionesPublicacionV1`. Reutiliza el outbox 4E/4F privado existente en solo lectura, valida cada request_id de borrador, SHA-256 y payload JSON de 15 cadenas; agrupa tareas por identidad y selecciona la última revisión local. Omite WAITING_PRODUCTIVITY_NO_SEND y HISTORY_GAP_NO_SEND. PREPARED_NO_SEND es solo candidata, no autorización para transmitir. La primera secuencia de publicación empieza en revisión 1. El código también incluye motor puro que evalúa ACKs verificados suministrados por una futura cola de recibos y bloquea ACK falsos/desalineados, pero la ejecución real 4I le pasa lista vacía porque esa cola aún no existe.

RESULTADO LOCAL: `node --check` PASS, 32/32 aserciones locales PASS con 5295 tareas (5287 candidatas, 8 pendientes), productividad tardía, revisiones draft 3 -> delivery 1, draft4 -> delivery2, mismos request IDs, validaciones de hash, ACK inconsistentes, ausencia de actividad HTTP/producción y guardia de libros.

ENTREGABLE: `DELTA_OPS_V9_FASE4I_SECUENCIAS_PUBLICACION_SOLO_LECTURA_20261030.zip`. Instalar REEMPLAZANDO el contenido del archivo 4D ya existente en `DELTA OPS - V9 UNIFICADO - PRUEBAS`, no añadir un .gs extra. Ejecutar únicamente `dmV9PrevisualizarFase4iRevisionesPublicacionV1`. NO cambiar 4B/4F V3 ni 4C; NO enviar datos reales ni activar triggers.

## Corte todavía BLOQUEADO

No hay un outbox transaccional de publicación/ACK real, no hay política confirmada de cuándo la productividad está definitivamente lista (en el flujo actual se carga diferida); un candidato PREPARED no es un cierre. Considerar publicar provisional con upsert por ID y sobreescritura versionada posterior, evitando añadir tarea manual al administrativo, pero no habilitar sin contrato de lectores y rollback. La tabla `public.rop05` continúa con identidad `source_row`; se requiere sidecar/índice de identidad y migración controlada. Resolver 3 anomalías de ID y 4 supresiones por contenido, tarea 3 incompleta en espejo y secretos antiguos.
