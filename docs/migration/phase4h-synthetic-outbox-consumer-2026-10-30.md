# Delta OPS V9 — Fase 4H: consumidor sintético con ACK, 30/10/2026

## Estado

Receptor 4G ya existe y fue probado en Supabase sandbox `biztlietuvvonigcfdwy` únicamente con IDs de prueba. Se creó una actualización del **mismo archivo 4D**, `DM_UNIFIED_PHASE4D_ACK_VERSION_SANDBOX_V1.gs`, conservando la prueba original 4D y añadiendo el entrypoint `probarMigracionFase4hAckDesdeColaV1`. No crea archivos Apps Script extra, no modifica el archivo 4B/4F V3. **Pendiente ejecución real por el usuario**.

## Qué comprueba

- Relee sólo estados G de `ENTREGAS_PREPARADAS` del workbook privado marcado en 4E; sin leer payloads operativos.
- Simula dos estados no enviables (solo horas, productividad pendiente), verificando que no haya solicitud HTTP.
- Usa un único ID sintético fijo `rop02_jm:test-4g-gas-4h-001:t1`; envía v1, replay v1, v2, replay v2 a `public.delta_4g_sandbox_accept_v1`. Datos 100 % ficticios, 15 strings, marcador `SIMULATED_4G`.
- Digest SHA-256 calculado sobre JSON canónico; request_id UUIDv8 estable derivado con el mismo algoritmo 4F. Verifica ACK contra dataset, taskKey, revisión, digest, request_id y marca sandbox.
- En caso de HTTP inesperado, respuesta incierta o ACK distinto, falla cerrado. Cero escritura local y cero escritura en producción.

## Validación local

Node `--check` OK; 74/74 aserciones con Apps Script, Google Sheets, SHA-256, HTTP y RPC simulados, incluyendo segundo run idempotente, URL productiva bloqueada, opt-in ausente, outbox productivo bloqueado, HTTP 504, ACK inconsistente, fuga de payload operativo bloqueada y 0 escrituras.

El código y test están en el archivo local entregado `DELTA_OPS_V9_FASE4H_CONSUMIDOR_ACK_SINTETICO_20261030.zip`. Para instalar: **reemplazar contenido del 4D existente en el CLON** (no agregar nuevo `.gs`), dejar 4B+4C intactos y ejecutar una sola vez `probarMigracionFase4hAckDesdeColaV1`. No repetir pruebas 3K/4A/4D.

## Reglas de negocio incorporadas

La productividad se puede cargar mucho después de las horas ROP02. No transmitir partes sin tareas ni tareas con productividad pendiente, no declarar bajas por desaparición temporal. `PREPARED_NO_SEND` NO garantiza cierre administrativo; no autoriza envíos reales. No confundir versión de borrador 4E/4F con secuencia de versiones entregadas al servidor; el primer envío debe ser revisión de entrega 1. Pendientes el contrato de cierre formal, separación de revisiones de entrega, sidecar de identidad real, tratamiento de IDs ambiguos y supresiones heredadas, y cutover reversible.
