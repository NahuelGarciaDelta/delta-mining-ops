# Fase 3I V1 — Auditoría de campos (solo lectura)

Fecha 2026-10-30. Se creó paquete `DELTA_OPS_V9_UNIFICADO_FASE3I_AUDITORIA_CAMPOS_20261030.zip` y módulo `DM_UNIFIED_PHASE3I_FIELD_AUDIT_READONLY_V1.gs` para copiar como **archivo nuevo** al Apps Script CLON `DELTA OPS - V9 UNIFICADO - PRUEBAS`.

## Evidencia previa
- Fase 3H validada: tres payloads sintéticos ROP05/RMA15 JM/RMA15 FS recuperaron ACK por reintento, uno con insumo descriptivo bloqueado. Verificación SQL en sandbox confirmó 3 filas y 3 receipts nuevos, 0 duplicados.
- En consulta **solo lectura a Supabase productivo** se encontró ROP05 con **9702 registros** frente a 9684 del inventario anterior, es decir **18 más**; la hoja ROP05 reporta grilla de 9703 filas incluyendo encabezado. Este crecimiento exige invalidar cualquier inferencia de paridad basada solo en el baseline anterior.
- La consulta remota detectó `observaciones` tipada vacía en 9702 ROP05; 8598 tienen observación literal en `raw_data`. Requiere lectura con fallback y análisis de mapeo; no sobrescribir masivamente.

## Entregables y pruebas
- `.gs`: audita exhaustivamente fuente Sheets -> `DM_UNIFIED_PHASE3A_V3_.mapRow` por lotes 250 x 6, con estado independiente `DM_U3I_V1_STATE` en ScriptProperties; captura por campo `input`, `mapped`, `emptyAfterMapping`, advertencias, internos vacíos, operativo ausente, insumos descriptivos y presencia de claves raw_data. Solo registra conteos y números de fila, sin literales ni credenciales.
- `02_SQL_AUDITORIA_PRODUCCION_SOLO_SELECT.sql`: consultas SELECT para conteos, observaciones tipadas vs raw, turno/lugar/intervención RMA15 y tres casos históricos.
- `03_CONTRATO_COLA_ACK_Y_CORTE.md`: diseño del futuro consumidor versionado con baseline confirmado independiente, snapshot inmutable, request_id idempotente, bloqueo de revisiones conflictivas y ACK por versión.
- `TEST_LOCAL_PHASE3I_V1.cjs` + referencia V3 exclusiva para ejecutar pruebas Node: **11/11 PASS**, incluyendo cambios de origen, insumo ambiguo, operativo ausente y no alteración de propiedades previas.

## Restricciones
**No instalado ni ejecutado aún en Apps Script del usuario**. No usa UrlFetchApp ni credenciales Supabase; no escribe en Sheets, Supabase o cola 3D, no crea triggers. La auditoría 3I prueba validez del mapeo **en Sheets**, no equivalencia exhaustiva campo a campo con Supabase: la segunda mitad exige comparación remota individual y de totales en etapa posterior. Las siete excepciones históricas de interno JM y las cantidades descriptivas siguen pendientes de revisión antes de habilitar escrituras.

## Pasos en clon
1. Crear archivo nuevo `DM_UNIFIED_PHASE3I_FIELD_AUDIT_READONLY_V1`, sin reemplazar 3A/3C/3D/3H.
2. Ejecutar ÚNICAMENTE `probarMigracionFase3iPreflightV1` y revisar `sourceStatus` y `queue3d` antes de iniciar.
3. Si es correcto, iniciar `dmUnifiedPhase3iStartV1`, luego repetir `probarMigracionFase3iContinueV1` hasta `completed:true`.
4. Si hay cambio real de tamaño/encabezado durante el recorrido, detener y diagnosticar. Únicamente tras confirmarlo, `dmUnifiedPhase3iRestartSoloEstadoV1` reinicia la **auditoría 3I** sin borrar otra propiedad.

Production, sus triggers, Supabase real, Vercel y GitHub main **no modificados**.