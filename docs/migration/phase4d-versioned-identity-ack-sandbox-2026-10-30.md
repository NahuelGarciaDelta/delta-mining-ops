# 4D — ACK versionado por identidad en Supabase sandbox (30/10/2026)

## Validación recibida: 4B + 4C

El usuario ejecutó previsualización en clon: ok=true, DRY_RUN_NO_WRITES, 8.608 ROP02 cotejados, espejo 0 desajustes, 5.291 tareas ROP05 candidatas; 5.290 con identidad original AppSheet, 1 bloqueada (FS fila 531); JM ID repetido en filas 974 y 1004; 4 claves históricas suprimidas por deduplicación heredada. 23 posiciones cambiarían en 19 tramos; productionWrites=0.

## Nuevo entregable funcional sandbox

Se crearon en proyecto EXCLUSIVO de pruebas `biztlietuvvonigcfdwy` las tablas `delta_4d_sandbox.records`, `versions` y `receipts`, con RLS habilitado y RPC `public.delta_4d_sandbox_apply_v1` SECURITY DEFINER. Su EXECUTE se revocó de PUBLIC, anon y authenticated, se autorizó SOLO service_role. El procedimiento valida dataset, ID `test-4d-...`, revisión, SHA-256 declarado de 64 hex, JSONB synthetic=true, serialización por candados transaccionales, versión monotónica, unicidad de request_id y revision y ACK durable. No admite registros operativos reales. Nunca escribir en `jwfocqaxlckuxoklwyxs`.

Ensayo SQL ejecutado y validado en sandbox: escritura de revisión 1, reintento mismo request_id, revisión 2, reenvío idempotente de revisión anterior con nuevo request_id; tres intentos conflictivos rechazados (colisión revisión/hash, colisión request_id, falta de revisión inicial). Evidencia de cierre: 1 registro ficticio, 2 versiones, 3 recibos. SELECT de permisos confirmado anon=false, authenticated=false, service_role=true.

Módulo entregado para instalar en CLON `DM_UNIFIED_PHASE4D_ACK_VERSION_SANDBOX_V1.gs`. Reusa configuración de sandbox YA EXISTENTE de la fase 3G en ScriptProperties (no copiar clave). No usa datos reales, y la función `probarMigracionFase4dAckSandboxV1` hace alta+replay de v1 y actualización+replay v2, guardando SOLO `DM_U4D_V1_SYNTHETIC_ACK` como checkpoint local tras recibir cuatro ACK válidos. 10/10 pruebas locales con simulación de RPC, validación de sintaxis y bloqueo de URL de producción. Pendiente ejecución desde el Apps Script del usuario: AÚN NO es prueba de extremo a extremo real GAS->RPC.

## Pendientes para corte

Este es un protocolo de laboratorio, NO equivale a haber sincronizado los 5.290 ROP05. Construir outbox persistente que derive clave (dataset, ID original, tarea), revisión real e identidad de ejecución; reconciliar 3 anomalías de ID y 4 descartes, y migrar consumidores/lectores del modelo físico al inmutable con rollback. Mover secreto webhook productivo que fue expuesto a ScriptProperties y rotarlo. No ejecutar `generarROP05NuevoV9Aplicar`, no crear triggers nuevos ni desactivar V8.1.
