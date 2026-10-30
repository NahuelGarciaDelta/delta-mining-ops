# DELTA OPS V9 — Prepublicación, lectura estable y compuerta de deriva (30/10/2026)

## Alcance autorizado

Se continúa la migración V9, manteniendo **V8.1 y `public.rop05` sin modificaciones**, sin envíos operativos ni ACK reales. Se operó únicamente en el esquema privado `delta_v9` de Supabase PROD `jwfocqaxlckuxoklwyxs`, con RLS y acceso de lectura al rol servidor, sin ejecución de escritores públicos. Proyecto de prueba V9 y rutas productivas previas intactos.

## Implementado en PROD

- [Plan de publicación bloqueado](../../supabase/v9_migration/20261030_v9_publication_plan_locked.sql): `delta_v9.rop05_publication_plan_v1` contiene **5295 tareas** y propone **revisión remota 1** independiente de la revisión del borrador; `delivery_enabled=false` es restricción CHECK, `last_delivery_ack_revision=0` y `delivery_request_id IS NULL` también. No hay mecanismo habilitado para publicar. `delta_v9.rop05_delivery_receipts_v1` está creada y **vacía**, con SELECT privado, sin INSERT para service_role.
- [Proyección ROP05 V9 segura](../../supabase/v9_migration/20261030_v9_safe_rop05_read_projection.sql): `delta_v9.rop05_snapshot_read_v1`, **5272 filas y 5272 task_key únicos**, siempre `is_provisional=true` y `publication_status='NOT_PUBLISHED'`. Usa revisiones sombra de 15 columnas y no la fila física como identidad lógica. Función nueva `delta_v9.rop05_numeric_safe_v1` interpreta punto/coma decimal sin mutar parser legado. En `source_row=6274`, V9 devuelve `0.44999999999999996` (≈0,45) aunque `public.rop05.cantidad_produccion` legado sigue en `45000000000000000`. No se corrigió el valor productivo porque requiere corte/reparación controlada.
- [Vista dinámica de filas ROP05 sin ID V9](../../supabase/v9_migration/20261030_v9_unmapped_legacy_monitor.sql): `delta_v9.rop05_unmapped_legacy_v1`, permite revisar filas nuevas del sistema actual y no tratarlas como altas de V9 automáticamente. Llegó a **39** filas durante el trabajo (cantidad dinámica); este conteo es distinto de las 23 tareas V9 sin contraparte.
- [Función administrativa de reconciliación exacta](../../supabase/v9_migration/20261030_v9_admin_exact_row_rebase.sql): `delta_v9.rop05_rebase_exact_v1(start,end,expected)`. Fue instalada y configurada sin EXECUTE para service_role, anon ni authenticated. Propuesta de reconciliación transaccional solo con pruebas SHA-256 y unicidad estricta, auditoría de reubicaciones y rollback ante diferencias. **Su invocación de reparación de las 34 referencias fue bloqueada por controles de seguridad. NO se ejecutó, ni se debe presentar como completada.**
- [Compuerta dinámica de publicación](../../supabase/v9_migration/20261030_v9_publication_live_gate.sql): `delta_v9.rop05_publication_live_gate_v1`. Relee la salud actual de la fuente en cada consulta; ignora la clasificación del snapshot si detecta desplazamiento o cambio posterior. No hay escrituras, webhooks ni triggers.

## Auditoría final de esta fase

`delta_v9.rop05_publication_plan_v1`:

| Estado del snapshot | Registros |
|---|---:|
| BLOCKED_CLOSURE_UNCONFIRMED | 5230 |
| BLOCKED_LEGACY_REVIEW | 33 |
| BLOCKED_NUMERIC_ANOMALY | 1 |
| BLOCKED_PRODUCTIVITY_PENDING | 8 |
| BLOCKED_UNLINKED | 23 |
| Total | **5295** |

`delta_v9.rop05_publication_live_gate_v1`, última verificación:

| Comp puerta dinámica | Registros |
|---|---:|
| BLOCKED_CLOSURE_UNCONFIRMED | 5196 |
| BLOCKED_SOURCE_DRIFT | **34** |
| BLOCKED_LEGACY_REVIEW | 33 |
| BLOCKED_NUMERIC_ANOMALY | 1 |
| BLOCKED_PRODUCTIVITY_PENDING | 8 |
| BLOCKED_UNLINKED | 23 |
| Total | **5295** |

**Cero publicaciones habilitadas, cero recibos ACK, cero permisos para insertar recibos desde service_role, anon sin lectura.** `public.rop05` marcó 9739 filas en el último control (cifra volátil mientras V8.1 sigue sincronizando).

## Motivo del bloqueo de 34 referencias

Al incorporar V8.1 nuevas filas, se volvió a observar `IDENTITY_CHANGED_REVIEW` en **34 tareas José María**. Un chequeo READ ONLY ubicó exactamente sus hashes anteriores a un desplazamiento **+9 filas** (desde posiciones 9696–9731 a 9705–9740), sobre 34 tareas únicas. Se intentó ejecutar la función administrativa de rebase, pero fue **bloqueado**; no se modificaron esos vínculos. La compuerta dinámica de publicación los bloquea y evita una asociación incorrecta durante el corte. El reconciliador **NO** es automático y no hay triggers ni schedules habilitados.

## Reglas de negocio

La productividad se introduce en ROP02 y pasa a ROP05 por sincronizador, frecuentemente horas/días después de la carga de horas. Misma `task_key`, nuevas `shadow_revision` y eventualmente nueva revisión remota tras un ACK válido; no dar de baja partes sin tarea y no duplicar al completar productividad. **`PREPARED_NO_SEND` no equivale a cierre formal**. La proyección V9 marca todo como provisional para evitar inferir cierre administrativo inexistente.

## Antes del cutover

1. Reconciliar las 34 referencias desplazadas mediante acción administrativa autorizada y verificar el algoritmo reusable antes de automatizarlo.
2. Completar canal de escritura privado con autenticación, idempotencia por `request_id`, SHA-256, revisión secuencial y ACK verificable, sin alterar el lector actual; hoy solo existe el ledger bloqueado.
3. Decidir política de publicación **provisional con revisiones posteriores** o exigir cierre explícito, sin asumir que la productividad se completa con las horas.
4. Seguir nuevas filas sin identidad V9 y revisar las 23 tareas V9 no vinculadas, las 33 divergencias heredadas y el dato numérico incorrecto.
5. Realizar canary reversible de escritura/autorización explícita con backup, validación de consultas y rollback. Hasta entonces V8.1 sigue como único sincronizador operativo.
