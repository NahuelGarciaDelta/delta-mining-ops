# Fase 3F — ACK persistente sintético en dos ejecuciones (29/10/2026)

El usuario ejecutó **fase 3E** en Apps Script y confirmó `ok:true`, `passed:12`, `failed:0`, `readyForWrites:false`. La simulación anterior era solo de memoria.

## Objetivo
Probar un ACK ficticio perdido entre dos ejecuciones Apps Script distintas, sin tocar producción, Supabase ni las colas de fases anteriores.

## Archivos entregados en conversación
- `DM_UNIFIED_PHASE3F_PERSISTENT_ACK_SIM_V1.gs`, en `DELTA_OPS_V9_UNIFICADO_FASE3F_ACK_PERSISTENTE_SIMULADO_20261029.zip`
- `TEST_LOCAL_PHASE3F_V1.cjs`, `LEEME_FASE3F_V1.md`, `ESTADO_SEGURIDAD.md`

## Uso en clon
Crear un archivo .gs nuevo en clon V9 sin activadores, copiar el módulo y ejecutar:
1. `probarMigracionFase3fPaso1V1`: verifica 3D completada y cola real con 0 pendientes; guarda la propiedad `DM_U3F_V1_SIM_STATE` del CLON para el caso de ACK perdido. Esperado: `phase: ACK_LOST`, 2 pendientes (uno para revisión), cero ACK locales, 1 fila ficticia remota.
2. `probarMigracionFase3fPaso2V1` **en ejecución diferente**: verifica persistencia, respuestas negativas/dataset no coincidente/conteos/borrado; reintenta idempotentemente y marca **solo el cambio ficticio** como confirmado. Esperado: `phase: ACK_CONFIRMED`, 1 pendiente para revisión, 1 ACK ficticio, 1 fila remota ficticia, 8 pruebas aprobadas.
3. `dmUnifiedPhase3fStatusV1` consulta estado sin mutarlo.

## Seguridad
No contiene `UrlFetchApp.fetch`, `SpreadsheetApp`, llamadas RPC, `doGet`, `doPost` ni activadores. La única escritura es su propia ScriptProperty en el clon. **No escribe sobre `DM_U3D_V1_PENDING`, `DM_U3D_V1_STATE` ni `DM_U3C_V1_STATE` y no confirma la cola real.** No requiere credenciales.

La prueba Node con reinicio del VM entre pasos y ScriptProperties compartidas pasó; también validó cola real de prueba no vacía, 3D incompleta, estado corrupto y no alteración de propiedades ajenas. Las pruebas locales no equivalen a ejecución real en Google Apps Script. El usuario debe suministrar logs de ambos pasos.

## Puerta para próxima fase
Aún faltan pruebas de un consumidor **real** sobre un proyecto Supabase de prueba aislado, comparación de valores campo por campo y corte seguro para evitar escritores simultáneos. No habilitar sincronización en producción ni desactivar activadores de V8.1.
