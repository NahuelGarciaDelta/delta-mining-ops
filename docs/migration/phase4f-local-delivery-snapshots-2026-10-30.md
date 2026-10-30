# 4F — Cola local con snapshot inmutable, preparación de envíos (30/10/2026)

**Estado:** Código local preparado y probado 53/53 en simulación; pendiente instalación/ejecución del clon. NO aprobado para sincronización productiva.

## Antecedente verificado

4E creó el libro privado de pruebas `DELTA OPS V9 - OUTBOX SOMBRA 4E - PRUEBAS`: https://docs.google.com/spreadsheets/d/1eAVJ4UJaPKz0xso_mxbvQCSoVb9viisREppxpaEQ-P8/edit; 5296 identidades únicas (JM 2986, FS 2310), todas revisión 1, sin ACK. Se comprobó con lectura independiente.

## Cambio sobre el código 4B ya existente

Se preparó una única revisión de `DM_UNIFIED_PHASE4B_ROP05_GENERADOR_NO_DESTRUCTIVO_V1.gs`, entregada en ZIP local `DELTA_OPS_V9_FASE4F_COLA_LOCAL_CON_PAYLOAD_SIN_ENVIOS_20261030.zip`. **Reemplazar archivo 4B en el clon, no agregar nuevo .gs.** Conserva los módulos 4C y 4D existentes. Entrada nueva `dmV9Outbox4fPrepararEntregasV1` (sin triggers).

La función reutiliza el libro 4E existente y agrega `ENTREGAS_PREPARADAS` con dataset, `task_key`, revision, digest, request_id estable derivado de SHA-256 (UUIDv8 personalizado), JSON inmutable de los 15 campos canónicos de ROP05, estado `PREPARED_NO_SEND` o `HISTORY_GAP_NO_SEND`, created_at, campos reservados de intento/ACK, origen orientativo. NO transmite datos a Supabase, NO confirma ACK, NO escribe en ROP02/ROP05 originales. También añade revisiones nuevas a VERSIONES_SOMBRA cuando el digest cambió.

Protecciones: status de solo preparación; no generar DELETE por ausencia transitoria; detectar y bloquear adulteración, duplicados, formato y faltantes históricos irreconstruibles; reintentos idempotentes. Un corte entre las dos escrituras puede recuperarse si no se produjeron rangos parciales corruptos y el snapshot original permanece recuperable. No confundir esto con atomicidad transaccional o outbox de entrega remota.

## Importante: faltante de campos de tarea 3

La vista IMPORTRANGE de ROP05 lee la fuente B:AK, omitiendo AL:AN del ROP02 original (Ancho/Profundidad/Total tarea 3). Revisión dirigida del origen actual encontró una tarea 3 con esos campos en José María, fila ORIGINAL 4471 (tarea Traspaleo de material, 2 horas, ancho=1, profundidad=2), que de otro modo perdería datos. La nueva revisión 4B bloquea esta tarea en manifest/cola 4F, la informa en `task3UnmirroredBlocked` y `outputBlockedFirst` con razón `TASK3_EXTRA_COLUMNS_NOT_MIRRORED`. NO modifica la productividad ni repara ROP05 productivo sin diseño de corte.

## Pruebas y límites

53/53 PASS con Node y SpreadsheetApp simulado: 5296, segunda ejecución sin duplicación, actualización revisión 2, cambio de fila sin revisión, corte entre ledger y payload, recuperación, lagunas históricas, filas corruptas, validación de destinos, concurrencia, no hay nuevas llamadas a Supabase. Node syntax PASS. Resultados NO equivalen a ejecución del clon real.

**Privacidad:** ENTREGAS_PREPARADAS agrega una segunda copia de los 15 campos operativos dentro del libro de pruebas del usuario (actualmente no compartido). Debe seguir restringido y contar con política de retención antes de usar en producción. No subir payloads operativos a GitHub ni a sandbox sintético 4D.

**Siguiente etapa real:** receptor versionado para IDs de origen reales, permisos y control de acceso, retención de payloads, confirmación remota ligada a digest/request_id, proceso de reintento después de HTTP incierto y corte reversible. Resolver IDs anómalos y 4 duplicados suprimidos; rotar webhook original.

ADENDA DE SEGURIDAD: el resultado reporta por separado excludedAmbiguousTasks y excludedTask3Unmirrored, sin mezclarlas en la salida. El test agregado verifica esa separación. No cambió ninguna hoja de operación.

## 4F V2 — nueva regla operativa: productividad diferida respecto a horas ROP02

El usuario informó expresamente que puede cargarse primero el ROP02 con horas, sin completar productividad; la tarea o medición se carga horas o días después. Por tanto, NO inferir productividad 0 ni bajas a partir de ausencias transitorias, ni fijar un SLA para completar automáticamente.

Se preparó un parche de seguridad sobre el MISMO DM_UNIFIED_PHASE4B_ROP05_GENERADOR_NO_DESTRUCTIVO_V1.gs (no otro archivo) y paquete local DELTA_OPS_V9_FASE4F_V2_PRODUCTIVIDAD_DIFERIDA_SIN_ENVIOS_20261030.zip. El cambio mantiene intacto el cálculo y las 15 columnas ROP05, y solo modifica estados de preparación local:

- ROP02 con horas pero sin tareas: cuenta rop02HoursNoTaskYet, NO crea ROP05 artificial y NO DELETE.
- Tarea cargada pero sin Hs t > 0: cuenta taskWithoutProductiveHoursYet, no prepara ROP05.
- Tarea con Hs t > 0 que requiere una medición y todavía no tiene unidad o ningún campo medición explícito: añade metadata WAITING_UNIT/WAITING_MEASURE, persistiendo en ENTREGAS_PREPARADAS con estado WAITING_PRODUCTIVITY_NO_SEND, nunca como PREPARED_NO_SEND.
- Si la unidad es HS, no exige una medición en otra unidad. Los equipos CAMION REGADOR, CAMION VOLCADOR y CAMIONETA siguen la regla heredada de cantidad productiva no aplicable; no bloquearlos por ese motivo.
- Un cero explícitamente ingresado no es lo mismo que una celda vacía; no se puede determinar cierre definitivo sin una señal de validación de negocio.
- Al cargar productividad más tarde, la clave original ID AppSheet+tarea es estable y el ledger 4E genera una revisión de contenido si cambió su digest. Las versiones de borrador anteriores NO deben enviarse como si fueran revisiones de entrega. La cola 4F bloquea versiones posteriores si la cadena previa no está lista (HISTORY_GAP_NO_SEND); el futuro consumidor debe separar revision_observada de revision_entregable y permitir rebase explícito sin perder historia.

Se verificaron 61/61 pruebas locales simuladas, incluido WAITING_UNIT, WAITING_MEASURE, reintento sin duplicación, nueva revisión por productividad completada y bloqueo de reentrega inconsistente. node --check via stdin PASS. No fue ejecutada la 4F actualizada en Apps Script y no hubo escrituras en Supabase.

IMPORTANTE: sustituir el archivo 4B antes de ejecutar la fase 4F; NO crear módulo extra, NO ejecutar Aplicar y NO activar triggers o RPC productivo. Verificar en clon con una ejecución de dmV9Outbox4fPrepararEntregasV1 si corresponde, sin exigir que todos los partes estén completos en simultáneo.