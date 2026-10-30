# Fase 4A — Primer lote real, cola versionada sin escrituras (30/10/2026)

## Cambio de estrategia
No continuar ciclos íntegros de auditoría 3K como indicador de integración: dos pasadas arrojan 53/55 en los mismos bloques, mientras un diagnóstico individual independiente indica 500/500 filas y dos hashes de bloque correctos. Causa inicial no establecida; se preservan estados y se difiere esa incidencia a diagnóstico de estabilidad, sin escribir ni restaurar filas.

## Avance de sincronización incremental
Módulo entregado fuera de producción: `DM_UNIFIED_PHASE4A_LIVE_TAIL_ACK_GATE_V1.gs`, paquete `DELTA_OPS_V9_FASE4A_COLA_INCREMENTAL_REAL_SIN_ESCRITURAS_20261030.zip`.

Consume **18 filas reales ROP05** entre las físicas 9686–9703, aparecidas después del baseline 3C (9685), validadas por fase 3I (9703). Comparación contra SELECT Supabase productivo exclusivamente READ ONLY: 18 registros existentes, 18 huellas de raw_data. Etapa 4A crea, solo en el clon, metadatos con hash/version/status y bloquea si origen cambia, si hash difiere o hay errores del mapeador. Aún no configura ACK real, RPC de producción, triggers ni transmisión de payload. El estado `REMOTE_RAW_OBSERVED_NO_ACK` NO es ACK remoto de este consumidor.

Pruebas locales: **12/12 PASS** (origen recortado, encabezados, mismatch RAW, advertencias, no sobrescritura, no credenciales, no red y preservación de fases previas). **Pendiente ejecución en Apps Script clon**: primero `probarMigracionFase4aPreflightV1` y si está correcto, `probarMigracionFase4aCrearColaV1` una sola vez. Solo propiedad nueva `DM_U4A_V1_STATE`.

## Escalera de aceptación para finalizar la unificación
1. Integridad de origen + mapeos y excepciones (mucho avance, typed fields aún pendientes).
2. Cola real incremental y ACK de versión en sandbox; sin asumir ACK por mera existencia remota.
3. Sincronizador V9 con reglas de concurrencia y flujos de vuelta, cubrir ROP02, ROP05, RMA15, lista/insumos y outbox.
4. Un solo escritor validado, corte reversible y pruebas de app, triggers, errores y egress.

## Estimación global
Se sustituye el 45% estático por una medición de hitos (15 puntos entorno, 25 fidelidad, 20 protocolo ACK, 25 integración, 15 corte). Trabajo técnico preparado estimado 50/100 = 15+19+12+4+0. **Es estimación, no porcentaje de producción lista ni autorización de corte**. El sistema actual sigue operativo; no se tocó main, código productivo ni Supabase por escrituras.

## 4A V1 bloqueada por carga en lotes; solución V2 (30/10/2026, 10:17 ART)

El preflight V1 rechazó ROP05: `lastRow=9708` frente al snapshot congelado de 9703. El usuario aclaró que los administrativos cargan por las mañanas y un Apps Script vuelca lotes en Sheets. El connector Sheets confirmó 9708 filas; Supabase productivo por SELECT confirmó 9707 registros (sin encabezado) y desplazamientos de los últimos cinco partes de las filas físicas 9699–9703 a 9704–9708. Esto invalida la hipótesis de append-only para el origen.

Nuevo módulo 4A V2 `DM_UNIFIED_PHASE4A_LOTES_DINAMICOS_V2.gs`: reconoce las 18 referencias de raw_data por contenido en toda ROP05, tolera crecimiento, distingue posición original vs actual, bloquea fuentes truncadas, encabezados cambiantes, duplicados por contenido, referencias ausentes y cambios de tamaño durante lectura. Registra **solo metadatos** bajo `DM_U4A_V2_STATE` en el CLON. **12/12 pruebas locales aprobadas**. No sobrescribe el archivo ni el estado V1, no lee/escribe Supabase por red, no instala triggers. No es un sincronizador ni crea ACK. Pendiente preflight y ejecución en Apps Script real del clon.

**DECISIÓN ARQUITECTÓNICA CRÍTICA:** source_row física NO constituye identidad estable si el App Script que carga lotes inserta o reorganiza filas. Antes del corte productivo, generar y transportar un `record_id` inmutable desde el primer punto de registro (origen del lote), persistirlo en Sheets y Supabase y versionar/ACK por `(dataset,record_id,revision)`. El cotejo por hash full RAW es apto para auditoría, pero no reemplaza identidad única frente a partes idénticos o editados. Mantener procesos actuales y no tocar main.


## V3: ventanas acotadas (2026-10-30, 10:27 ART)
La 4A V2 aborto tras 79 s con cambio de cantidad de filas durante auditoria. El usuario confirmo que hay cargas matutinas por lotes. No es fallo de datos demostrado.
Se preparo modulo DM_UNIFIED_PHASE4A_VENTANAS_CORTAS_V3.gs, solo para el clon: lectura de las ultimas 512 filas; ampliacion eventual a 2048; segunda lectura de 18 huellas RAW; permite crecimiento concurrente de lastRow, pero bloquea recortes, encabezados mutados, ausencia o duplicados detectados en ventana y errores de mapeo. Solo guarda en DM_U4A_V3_STATE. 16/16 tests locales superados; pendiente ejecucion real del usuario.
LIMITACION: cotejo por contenido no equivale a identidad global ni a ACK remoto. Para sincronizador final se necesita identificador inmutable generado en el ingreso original de cada parte, revision, outbox, ACK y corte reversible. Produccion sin cambios; porcentaje permanece en 50% estimado.

## Fase 4A V3 — cierre operativo favorable 2026-10-30 10:40 ART

El usuario ejecutó `probarMigracionFase4aCrearColaV3` después de corregir el `key:DATASET` faltante en `source_()`. Resultado `ok:true`, `staged:true`, `referenceRows:18`, `matchedInBoundedWindow:18`, `review:0`, `shifted:5`, `scanRows:512`, `verifyRows:81`, `lastRowBefore:9718`, `lastRowAfter:9718`, `growthObserved:false`, `identityGloballyVerified:false`, `remoteAckCount:0`, `productionWrites:0`, `readyForProductionWrites:false`. Se observaron 5 registros desplazados de las filas 9699-9703 a 9714-9718; se recuperaron por hash de contenido. Se guardó únicamente `DM_U4A_V3_STATE`.

**Dictamen:** Aprobado el reconocimiento de referencias RAW desplazadas en una ventana acotada, sin escrituras. No se ha aprobado identidad inmutable, deduplicación global, sincronización productiva ni ACK. No repetir 4A para obtener progreso aparente.

**Siguiente entregable que produce avance real:** adaptar el flujo de INGESTA de partes y el esquema de persistencia para generar y preservar `record_id` inmutable, con `revision`/`content_hash`, sentinela de concurrencia e idempotencia. Debe ser generado ANTES de que Apps Script inserte o reordene filas; reutilizar un identificador fuente confiable si ya existe. Preparar consumidor ACK-gated usando la ruta sandbox sintética 3G/3H y ensayos de doble entrega, edición y reordenamiento. No desactivar V8.1 ni escribir en Supabase productivo antes de un corte planificado y validado.

Estado global: estimación previa de 50% (ingeniería; no representa porcentaje de datos sincronizados).
## 4B: revisión del script de ingesta y generador ROP05; candidato preparado (2026-10-30)

El usuario compartió el generador real `generarROP05Nuevo()` con funciones de sync V7.7.1. Se encontró origen de inestabilidad: lee los orígenes `Datos de ROP02 JM` y `Datos de ROP02 FS`, desde el 26/06/2026, transforma hasta 3 tareas por parte y desde fila física 4431 borra todo A:O con `clearContent()` antes de reescribir, ordenar y sincronizar por `source_row`. Eso produce ventanas de lectura incompleta y cambios físicos de posición. También deduplica por contenido, que puede colapsar partes distintos.

Conector de Google Sheets: ambas hojas ROP02 tienen 43 campos poblados en encabezado, sin UUID explícito del parte. El ID de fuente debe nacer antes de la generación de ROP05; `record_id` de ROP05 se deriva de `(rop02_record_id, task_no)`. No confundir fecha/equipo/número parte con ID realmente inmutable.

Se preparó en artefacto local del usuario `DM_UNIFIED_PHASE4B_ROP05_GENERADOR_NO_DESTRUCTIVO_V1.gs` para instalar como NUEVO módulo en clon. Cuenta con `generarROP05NuevoV9Previsualizar()` (solo lectura); `generarROP05NuevoV9Aplicar()` está bloqueada por propiedad deliberadamente no configurada y nunca debe usarse mientras el generador original escriba. El código optimiza rangos de escritura no contigua, evita vaciado completo antes de reescritura y revalida snapshots justo antes de cualquier aplicación. No resuelve atomicidad con otros proyectos, ACK remoto ni identidad global. Superó 15/15 pruebas locales simuladas, no pruebas productivas.

**Seguridad urgente:** El script original contiene credencial de webhook incrustada en código. No incluirla en artefactos, logs ni repositorios; rotar en coordinación con Edge Function y guardar nuevo secreto en ScriptProperties. El módulo candidato no incluye el token original.

**Próxima tarea de integración:** revisar código que incorpora originalmente ROP02 (AppSheet/importador), añadir ID inmutable y revision a ese origen, conservar los 15 campos visibles de ROP05; implementarlo en rama migratoria más sandbox ACK antes de un cutover con rollback. No modificar main ni apagar triggers activos por ahora.