# Fase 4E — persistencia comprobada en libro OUTBOX SOMBRA (30/10/2026)

## Ejecución real del usuario, 11:46 ART

Función `dmV9OutboxSombraV1Ejecutar`: `ok:true`, `mode:PERSISTENT_SHADOW_OUTBOX_ONLY`, `taskIdentities:5296`, `newVersions:5296`, `baselineNew:5296`, `changedVersion:0`, `unchanged:0`, `rowShiftWithoutRevision:0`, `previouslySeenNotInThisSnapshot:0`, `excludedAmbiguousTasks:1`, `suppressedByLegacyContentDedup:4`, `ledgerRowsAfter:5296`, `productionWrites:0`, `supabaseWrites:0`, `remoteAckCount:0`.

Libro generado por V9 clon, distinto de fuentes/hojas productivas:

- [DELTA OPS V9 - OUTBOX SOMBRA 4E - PRUEBAS](https://docs.google.com/spreadsheets/d/1eAVJ4UJaPKz0xso_mxbvQCSoVb9viisREppxpaEQ-P8/edit)
- ID `1eAVJ4UJaPKz0xso_mxbvQCSoVb9viisREppxpaEQ-P8`.
- Pestaña `VERSIONES_SOMBRA`: 5297 filas incluyendo encabezado. Pestaña de marca `__META_V9`: `DELTA_OPS_V9_OUTBOX_SHADOW_V1`.

## Verificación independiente del conector Google Sheets

Se leyó `A1:H5297` del libro. Resultado de revisión completa de 5296 filas:

| Chequeo | Resultado |
|---|---:|
| Registros | 5296 |
| Claves de tarea únicas | 5296 |
| Duplicados de (task_key, revision) | 0 |
| Claves/hashes/formato inválidos detectados | 0 |
| Dataset rop02_jm | 2986 |
| Dataset rop02_fs | 2310 |
| Revisión 1 | 5296 |
| Estado SHADOW_BASELINE_NO_ACK | 5296 |

**Dictamen:** outbox de seguimiento versionado en modo SOMBRA creado y validado en la cuenta del usuario. Se comprobó persistencia de una única ejecución inicial, NO se ejecutó una segunda corrida para verificar la idempotencia real del clon y NO existe ningún ACK remoto de registros operativos. No es todavía un outbox transaccional completo: no almacena payload de negocio, estado de entrega ni identidad de request/ACK.

## Diseño para siguiente integración, sin modificar producción

La siguiente versión debe conservar (dataset, task_key, revision, payload_sha256) como clave de idempotencia y preparar una cola de entrega separada con estado **PENDING -> SENDING/UNKNOWN -> ACKED**. Persistir `request_id`, fecha de intento, última respuesta, y ACK ligado exactamente a dataset + task_key + revision + digest; no inferir ACK por número de filas. Tras HTTP 504 o respuesta ambigua: **verificar recibo remoto** antes de reintentar; no generar solicitudes distintas para un mismo evento. No considerar ausencia transitoria de fila como DELETE. Resolver anomalías históricas de IDs y cuatro registros omitidos por deduplicación heredada antes del corte.

Seguridad y compatibilidad:
- En producción actual V8.1 y origen ROP02 siguen activos, no tocar triggers ni `generarROP05NuevoV9Aplicar`.
- El RPC 4D actualmente acepta sólo datos **sintéticos**; no apuntarle el outbox real, ni pasar IDs/partes reales a sandbox sin una fase de prueba explícitamente definida y acotada.
- El outbox 4E contiene únicamente hashes y metadatos, por lo que NO es posible reproducir el payload de la revisión histórica solo desde ese libro. Para la fase de entrega habrá que persistir el payload canónico o poder reconstruirlo con garantías de fuente; definir retención/cifrado/permisos de acuerdo con uso corporativo.
- La prueba inicial de 5296 filas no demuestra idempotencia de segundo run ni orden exacto bajo cargas concurrentes; pasar pruebas de snapshot consistente, edición y eliminación controlada antes de habilitar un segundo escritor.
- No aumentar el porcentaje general de forma artificial; el hito real siguiente es ACK de cola operativa, después del trabajo de contrato y autorización en entorno controlado.
