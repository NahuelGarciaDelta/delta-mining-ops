# 4F — Cola local con snapshot inmutable, preparación de envíos (30/10/2026)

**Estado:** Código local preparado y probado 52/52 en simulación; pendiente instalación/ejecución del clon. NO aprobado para sincronización productiva.

## Antecedente verificado

4E creó el libro privado de pruebas `DELTA OPS V9 - OUTBOX SOMBRA 4E - PRUEBAS`: https://docs.google.com/spreadsheets/d/1eAVJ4UJaPKz0xso_mxbvQCSoVb9viisREppxpaEQ-P8/edit; 5296 identidades únicas (JM 2986, FS 2310), todas revisión 1, sin ACK. Se comprobó con lectura independiente.

## Cambio sobre el código 4B ya existente

Se preparó una única revisión de `DM_UNIFIED_PHASE4B_ROP05_GENERADOR_NO_DESTRUCTIVO_V1.gs`, entregada en ZIP local `DELTA_OPS_V9_FASE4F_COLA_LOCAL_CON_PAYLOAD_SIN_ENVIOS_20261030.zip`. **Reemplazar archivo 4B en el clon, no agregar nuevo .gs.** Conserva los módulos 4C y 4D existentes. Entrada nueva `dmV9Outbox4fPrepararEntregasV1` (sin triggers).

La función reutiliza el libro 4E existente y agrega `ENTREGAS_PREPARADAS` con dataset, `task_key`, revision, digest, request_id estable derivado de SHA-256 (UUIDv8 personalizado), JSON inmutable de los 15 campos canónicos de ROP05, estado `PREPARED_NO_SEND` o `HISTORY_GAP_NO_SEND`, created_at, campos reservados de intento/ACK, origen orientativo. NO transmite datos a Supabase, NO confirma ACK, NO escribe en ROP02/ROP05 originales. También añade revisiones nuevas a VERSIONES_SOMBRA cuando el digest cambió.

Protecciones: status de solo preparación; no generar DELETE por ausencia transitoria; detectar y bloquear adulteración, duplicados, formato y faltantes históricos irreconstruibles; reintentos idempotentes. Un corte entre las dos escrituras puede recuperarse si no se produjeron rangos parciales corruptos y el snapshot original permanece recuperable. No confundir esto con atomicidad transaccional o outbox de entrega remota.

## Importante: faltante de campos de tarea 3

La vista IMPORTRANGE de ROP05 lee la fuente B:AK, omitiendo AL:AN del ROP02 original (Ancho/Profundidad/Total tarea 3). Revisión dirigida del origen actual encontró una tarea 3 con esos campos en José María, fila ORIGINAL 4471 (tarea Traspaleo de material, 2 horas, ancho=1, profundidad=2), que de otro modo perdería datos. La nueva revisión 4B bloquea esta tarea en manifest/cola 4F, la informa en `task3UnmirroredBlocked` y `outputBlockedFirst` con razón `TASK3_EXTRA_COLUMNS_NOT_MIRRORED`. NO modifica la productividad ni repara ROP05 productivo sin diseño de corte.

## Pruebas y límites

52/52 PASS con Node y SpreadsheetApp simulado: 5296, segunda ejecución sin duplicación, actualización revisión 2, cambio de fila sin revisión, corte entre ledger y payload, recuperación, lagunas históricas, filas corruptas, validación de destinos, concurrencia, no hay nuevas llamadas a Supabase. Node syntax PASS. Resultados NO equivalen a ejecución del clon real.

**Privacidad:** ENTREGAS_PREPARADAS agrega una segunda copia de los 15 campos operativos dentro del libro de pruebas del usuario (actualmente no compartido). Debe seguir restringido y contar con política de retención antes de usar en producción. No subir payloads operativos a GitHub ni a sandbox sintético 4D.

**Siguiente etapa real:** receptor versionado para IDs de origen reales, permisos y control de acceso, retención de payloads, confirmación remota ligada a digest/request_id, proceso de reintento después de HTTP incierto y corte reversible. Resolver IDs anómalos y 4 duplicados suprimidos; rotar webhook original.
