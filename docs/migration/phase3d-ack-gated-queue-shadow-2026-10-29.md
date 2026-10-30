# Fase 3D V1 — Cola incremental local en sombra, sin escrituras

Fecha: 29/10/2026. Estado: archivo generado, validado **localmente**, listo para copiar al clon Apps Script de pruebas; **no instalado**.

## Fase 3C confirmada
El usuario ejecutó el segundo ciclo de 3C: 13.350 escaneados, 13.350 sin cambios, 0 modificados, 0 nuevos, completed:true. Los hashes 3C son **última observación local, NO confirmación de Supabase**.

## Entrega
- Script `DM_UNIFIED_ROP05_RMA15_PHASE3D_QUEUE_SHADOW_V1.gs` (13,615 bytes), entregado como archivo descargable y dentro del ZIP `DELTA_OPS_V9_UNIFICADO_FASE3D_COLA_SEGURA_SOMBRA_20261029.zip` en la conversación.
- README `LEEME_FASE3D_V1.md`.
- Test local `TEST_LOCAL_PHASE3D_V1.cjs`, sin credenciales.

## Operación
El módulo requiere clon V9 con Fase 3A V3 y Fase 3C V1 instalados. Antes de iniciar, 3C debe estar `completed:true` y `cycle >= 2`. 

- `dmUnifiedPhase3dStartV1`: valida cabeceras, identidad de hojas y referencia 3C; inicia recorrido. No reinicia recorridos incompletos ni elimina candidatos previos.
- `probarMigracionFase3dV1`: continúa en grupos de hasta 6 lotes de 250 filas, compara hash por fila con el baseline *observado* de 3C y **solo** encola candidatos de modificación o alta. No confunde estos hashes con versiones recibidas remotamente.
- `dmUnifiedPhase3dStatusV1`: expone estado compacto y cola local con conteos y sourceRow, sin datos sensibles.
- Cola `DM_U3D_V1_PENDING` y checkpoint `DM_U3D_V1_STATE` en `ScriptProperties` del clon. La cola **no se borra** en un nuevo ciclo y no se marca como enviada. Máximo 100 entradas, detención segura por saturación.
- En caso de fallo después de persistir cola y antes de checkpoint, repetir la lectura no duplica entradas. Si cambia la referencia de 3C, el módulo detiene el escaneo.
- Advertencias de mapeo en un candidato => `requiresReview:true`.

## Pruebas locales
`node TEST_LOCAL_PHASE3D_V1.cjs`: **PASS** (13.350 filas, segunda lectura sin falsos positivos; modificación, agregado, campo ambiguo, reintento idempotente por fallo de checkpoint, prevención de uso de baseline 3C alterada, 0 llamadas externas).

## Bloqueos
Este código **NO incluye** `UrlFetchApp`, RPC, ACK, borrados, deploys o activadores. `supportsWrites:false`, `canAcknowledge:false`. **La columna de estado pendiente no equivale a datos recibidos por Supabase**. Aún se debe implementar comparador remoto fiable, consumidor con ACK por lote, idempotencia basada en `source_dataset + source_row`, revisión de insumos/operativo histórico y prevención de escritores simultáneos. Nunca cambiar `main` ni desactivar V8.1 sin un corte verificado.

Vercel, proyectos originales Apps Script, Supabase y `main` **no modificados** durante esta fase.

## Resultado real del clon V9 — aprobado (29/10, 21:46 Argentina)

El usuario ejecutó la fase 3D V1 en Apps Script y obtuvo `ok:true`, `completed:true`, `cycle:1`, `scanned:13350`, `unchanged:13350`, `modifiedCandidates:0`, `addedCandidates:0`, `pendingUnconfirmed:0`, `requiresReview:0`. Estado de seguridad: `readOnlyExternal:true`, `supportsWrites:false`, `canAcknowledge:false`, `canDelete:false`, `triggersInstalledByModule:false`.

`processedChunks:1` se refiere únicamente a la última ejecución, mientras `scanned` es acumulado del ciclo. Se conservaron advertencias históricas: ROP05 fila 3165 (2 km) y RMA15 FS fila 979 (cantidad descriptiva de insumo 6).

**Interpretación:** cola vacía porque no hay diferencias frente al baseline LOCAL 3C. Esto **NO demuestra igualdad de campos con Supabase**, ni ACK remoto, ni permite activar escrituras. No fabricar cambios en las hojas productivas. El próximo consumidor deberá probarse en modo simulado/aislado y confirmar ACK solo después de respuesta RPC válida, con comprobación de dataset, upserts, deletes:0, y ausencia de cambios concurrentes en fila mientras se confirma. El corte exige un único escritor y revisión de campos históricos.
