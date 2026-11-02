# Fase 4P — adaptador sintético desde 4F (2026-11-02)

## Estado
Se preparó un anexo para agregar al **mismo archivo 4D/4H del Apps Script clonado**. No crear nuevos módulos en el proyecto original y no reemplazar 4B/4F.

El adaptador convierte los 15 campos de una fila A:L de `ENTREGAS_PREPARADAS` en los 15 campos nombrados de `rop05` con `_v9`, manteniendo revisiones de borrador separadas de revisiones de entrega. Exige el estado `PREPARED_NO_SEND` (rechaza productividad pendiente y huecos históricos), valida digest e identidad del borrador, deriva un UUIDv8 de entrega determinista e incorpora comprobación remota `v9_ingest_probe_v1`.

**Bloqueo de seguridad:** el runner contiene exclusivamente una tarea sintética fija y valida *todos* sus valores antes de llamar a `v9_ingest_accept_batch_v1`. No hay selector ni envío de registros operativos, no hay triggers, ni cambios de producción.

## Verificación
- 14/14 tests de Node usando el 4B/4F real corregido y un transporte simulado: pasa segunda ejecución idempotente, bloqueo de productividad, huecos y hashes alterados, ACK perdido luego del commit, bloqueo de URL de producción.
- Prueba real mediante el **RPC de sandbox**, no desde Apps Script: 1 tarea ficticia `rop02_jm:test-4p-adapter-20261102:t1`, revisión 1 creada, replay confirmado; revisión 2 actualizada, replay confirmado.
- Probe remoto: `delivery_revision=2`, `digest_verified=true`, dos snapshots y dos receipts de esa tarea.
- Sandbox `public.v9_operational_rows`: 5.295 → 5.296 (una fila sintética nueva, sin modificar las 5.295 existentes).
- **No** se ha ejecutado aún el anexo dentro del clon. No asumir que GAS↔REST está validado ni que el outbox operativo posee ACK.

## Instalación segura en el clon
Archivo de entrega: `DM_U4D_V9_4P_ADAPTADOR_SINTETICO_ANEXO.gs` (artefacto descargable de la conversación; debe anexarse al existente 4D/4H, no ser módulo independiente en producción).

1. Revocar/rotar la clave `sb_secret_` de sandbox expuesta anteriormente y actualizar únicamente la propiedad privada del clon `DM_U3G_V1_TEST_SECRET_KEY`. Eliminar del clon la función que guardaba la clave literal. No almacenar ni enviar la clave por chat.
2. Verificar dependencias `dmU4dConfig_`, `dmU4dDigest_`, `dmV9U4fRequestId_`, `dmV9U4fLeerEstado_`, `dmU4iDeliveryRequestId_`.
3. Ejecutar `probarMigracionFase4pContratoLocalV1` (sin HTTP), luego —solo tras la rotación— `probarMigracionFase4pAdaptadorSandboxV1` (exclusivamente fixture).
4. **NO** ejecutar `generarROP05NuevoV9Aplicar`, activar triggers, sustituir V8.1, habilitar publicación real ni transmitir datos operativos.

## Próxima fase
Construir en el archivo existente un consumidor real **bloqueado por defecto** con ledger duradero, autorización de cierre administrativo de productividad, recuperación de ACK de requests estables, deriva de origen y revisión independiente. El estado `PROVISIONAL_NOT_ACKED` no constituye publicación formal.
