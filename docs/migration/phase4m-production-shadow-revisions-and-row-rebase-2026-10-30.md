# Delta OPS V9 — Historial sombra real y corrección de desplazamiento de filas (30/10/2026)

## Resultado persistente verificado

Proyecto PROD Supabase `jwfocqaxlckuxoklwyxs`, solo esquema privado `delta_v9`. Conservamos `public.rop05` y V8.1 intactos.

Se ejecutaron tres migraciones sobre **estructuras privadas V9**, documentadas en:
- [Captura de revisiones sombra](../../supabase/v9_migration/20261030_v9_shadow_revision_capture.sql)
- [Vista de salud de revisiones](../../supabase/v9_migration/20261030_v9_shadow_health_view.sql)
- [Reubicación auditada de 34 filas](../../supabase/v9_migration/20261030_v9_reconcile_34_shifted_rows.sql)

### Captura inicial

Se creó `delta_v9.rop05_shadow_revisions_v1` con payload canónico inmutable de 15 strings, `SHA256`, identidad funcional, revisión local, marca de captura y FK a `rop05_identity_bridge_v1`. Se añadieron funciones de codificación y captura `delta_v9.rop05_capture_shadow_v1(after_key, limit)`. Se captura exclusivamente contenido real de `public.rop05.raw_data` **cuando coincide el hash de referencia almacenado**; nunca se llama a un webhook ni se escribe en `public.rop05`.

Se recorrieron las 5295 identidades en bloques de hasta 300, insertando **5272 revisiones BASELINE**; 23 sin vínculo se omitieron. 0 gaps, 0 diferencias en SHA-256, 0 revisiones extra. Ejecución repetida de 300 tareas: **300 sin cambios, 0 duplicados**.

La vista privada `delta_v9.rop05_shadow_health_v1`, definida con `security_invoker=true`, compara dinámicamente SHA-256 e identidad de la fila actual con la última revisión; discrimina `UNCHANGED`, `CONTENT_CHANGED_PENDING_CAPTURE`, `IDENTITY_CHANGED_REVIEW`, `LEGACY_ROW_MISSING` y `QUARANTINE_UNLINKED`. NO es un trigger ni produce entregas.

### Detección durante trabajo en vivo

Mientras V8.1 seguía operativo, el total `public.rop05` pasó de 9726 a 9730 registros. La nueva vista detectó **34 tareas José María con identidad desplazada**: las filas originalmente 9692–9727 ahora eran 9696–9731. Se comprobó emparejamiento **1 a 1 de las 34 tareas por el SHA-256 completo de 15 campos**, desplazamiento exacto +4, y que ningún destino perteneciese a una tarea no afectada. No se tomó la posición física como identidad definitiva.

Se efectuó una **transacción única fail-closed** que:
1. Tomó bloqueo de sincronización y del sidecar.
2. Recalculó las 34 pruebas SHA-256 sobre filas actuales.
3. Aparcó temporalmente las 34 referencias de fila para conservar la restricción UNIQUE.
4. Reubicó solo el índice `delta_v9.rop05_identity_bridge_v1.legacy_source_row`.
5. Registró las 34 correspondencias viejo/nuevo en `delta_v9.rop05_identity_relocations_v1`.
6. Exigió que las 34 quedaran `UNCHANGED` al finalizar, o habría revertido toda la transacción.

**No hubo UPDATE/INSERT/DELETE en `public.rop05`.** Ninguna de las 4 filas adicionales coincidió exactamente con las 23 tareas sin vínculo, que permanecen en cuarentena.

### Auditoría final posterior a migraciones

| Indicador | Valor |
|---|---:|
| Identidades en sidecar | 5295 |
| Historiales sombra únicos / revisiones BASELINE | 5272 / 5272 |
| Reubicaciones auditadas | 34 |
| Estados UNCHANGED | 5272 |
| QUARANTINE_UNLINKED | 23 |
| IDENTITY_CHANGED_REVIEW | 0 |
| CONTENT_CHANGED_PENDING_CAPTURE | 0 |
| Publicaciones V9 habilitadas | 0 |
| ACK operativos | 0 |
| ROP05 productivo | 9730 |
| Privilegios anon sobre historial | Ninguno |
| Service-role: capturar o insertar historial | NO |

**Reglas de negocio:** los administrativos pueden cargar ROP02 horas antes de cargar productividad. Un cambio posterior mantiene el mismo `task_key` y genera `shadow_revision+1` al ejecutarse el capturador, siempre que la identidad funcional no cambie. Si cambia la identidad, queda en revisión; si cambia la fila física, hay que localizar por contenido/identidad y auditar un posible rebase antes de capturar. La función **no se ejecuta automáticamente**; únicamente queda disponible para administración con privilegios de base de datos.

## Limitaciones y siguiente integración

- La vista detecta cambios en **Supabase ROP05**, no en ROP02 aún pendiente de sincronización; no confundir su estado UNCHANGED con «administrativo cerró productividad».
- Los 23 sin contraparte siguen pendientes; 33 diferencias de hoja previas requieren revisión; 1 dato tipado numérico incorrecto debe corregirse junto con el parser; 8 tareas con productividad pendiente no son publicables.
- El flujo de publicación/ACK operativos, con reconciliación de ID estable, todavía no está activado. La restricción CHECK del sidecar sigue bloqueando `publishing_enabled` y `last_remote_ack_revision`, y no hay triggers.
- Antes de corte gradual reversible: diseñar consumidor privado con ACK firmado/idempotente y secuencia de publicación independiente del historial; resolver parser, cierre/provisionalidad de productividad, alcance de cuarentena y desplazamientos de filas.
