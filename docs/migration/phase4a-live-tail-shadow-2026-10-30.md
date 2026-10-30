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