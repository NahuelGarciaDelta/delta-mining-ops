# DELTA OPS V9 — Sidecar productivo de identidad ROP05 instalado (30/10/2026)

## Autorización y alcance
El usuario autorizó expresamente **crear una tabla auxiliar en Supabase productivo y cargar los vínculos verificados, dejar casos dudosos en cuarentena, no modificar `public.rop05` y mantener deshabilitada toda publicación**. Se respetó este alcance.

Proyecto productivo: `jwfocqaxlckuxoklwyxs`. Migración ejecutada `v9_rop05_identity_bridge_locked_20261030` basada en [SQL ejecutado](../../supabase/v9_migration/20261030_v9_rop05_identity_bridge_locked.sql).

Se creó el esquema privado `delta_v9` y tabla `delta_v9.rop05_identity_bridge_v1`, con PK por `task_key`, `legacy_source_row` UNIQUE, `source_outbox_row` UNIQUE, validación de formatos y clases, huella SHA-256 de 15 campos, estado de productividad, fecha de snapshot, RLS y revocación de acceso a anon/authenticated. `service_role` tiene permiso SELECT pero **NO** INSERT/UPDATE. La base impone `CHECK (publishing_enabled=false)`, `CHECK (last_remote_ack_revision=0)` y `CHECK last_remote_ack_sha256 IS NULL` para impedir publicaciones o ACK artificiales hasta nueva migración autorizada.

## Carga real y controles de consistencia

Fuente: libro de pruebas privado [PUENTE_ROP05_V9](https://docs.google.com/spreadsheets/d/1eAVJ4UJaPKz0xso_mxbvQCSoVb9viisREppxpaEQ-P8/edit), 5295 claves únicas (puente cerrado al snapshot del 30/10/2026). En cada bloque se comparó directamente en PostgreSQL el SHA-256 de los 15 valores de `public.rop05.raw_data` contra el hash del puente **antes de insertar**. Cada bloque fallaría sin insertar si alguna fila física no existiese o hubiese cambiado. Inserciones idempotentes por `task_key` seguidas de comprobación de igualdad de TODOS los campos relevantes para cada bloque.

| Estado final | Registros |
|---|---:|
| Total identidades insertadas | **5295** |
| EXACT + DB_MATCH_15_FIELDS | **5238** |
| REVISAR_PRODUCTIVIDAD + DB_MATCH_15_FIELDS | **33** |
| REVISAR_PRODUCTIVIDAD + DB_TYPED_NUMERIC_ANOMALY | **1** |
| SIN_CONTRAPARTE + QUARANTINE_NO_LEGACY_ID | **23** |
| Total con fila ROP05 heredada | **5272** |
| IDs de tarea únicos | **5295** |
| Filas heredadas únicas | **5272** |
| Productividad diferida esperando carga | **8** |
| Habilitados para publicar | **0** |
| ACK operativos declarados | **0** |

**Auditoría final, consulta READ ONLY de la tabla:** 5272 vínculos, **0 filas huérfanas y 0 hashes distintos** respecto a `public.rop05.raw_data`. Los 23 sin contraparte permanecen con `legacy_source_row=NULL` y estado de cuarentena. El registro afectado por error numérico continúa clasificado como anomalía; su payload textual coincide pero la columna tipada `cantidad_produccion` está corrupta. Los 33 de revisión deben mantenerse fuera de publicación pese a coincidir con `raw_data` de Supabase, pues diferían de la representación Google Sheets anterior.

## Sistema existente preservado

La tabla `public.rop05` conservó **9726 filas**, incluidas **5297** del tramo administrado 4431–9727, en controles antes y después. No se hicieron INSERT/UPDATE/DELETE en `public.rop05`. No se editaron triggers, funciones productivas, Apps Script V8.1 ni datos operativos del ROP02. No hubo envío real V9.

## Límite temporal y trabajo pendiente

La copia de identidades es **snapshot** del 30/10/2026. V8.1 continúa sincronizando partes, por lo que revisiones posteriores deberán detectarse y reconciliarse antes de cualquier cutover. La tabla está bloqueada deliberadamente por restricción SQL, y no constituye aún un nuevo sincronizador de productividad.

Próximos hitos: (1) definir reconciliación incremental consistente entre ROP02/ROP05 y sidecar para cambios diferidos; (2) corregir y validar conversor decimal y dato tipado afectado, con backup/compare-and-swap; (3) resolver 23 faltantes, 34 revisiones y el caso original de tarea 3 no espejada; (4) diseñar canal de ACK operativo privado, secuencia independiente de versiones borrador, permisos, rollback; (5) cutover en lotes controlados. Cualquier habilitación de publicación V9 requiere autorización y nueva migración; no cambiar restricciones ni service_role en esta etapa.
