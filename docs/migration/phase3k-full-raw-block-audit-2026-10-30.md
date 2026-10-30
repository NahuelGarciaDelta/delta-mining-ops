# Fase 3K — Comparación integral de raw_data (2026-10-30)

**Estado:** preparada, snapshot de Supabase por SELECT, pruebas locales 14/14. Pendiente ejecución en el Apps Script del usuario.

## Entregables
- ZIP `DELTA_OPS_V9_UNIFICADO_FASE3K_AUDITORIA_INTEGRAL_RAW_20261030.zip` en conversación.
- Apps Script nuevo `DM_UNIFIED_PHASE3K_FULL_RAW_DIFF_READONLY_V1.gs` (no reemplaza 3I ni 3J).
- Test local `TEST_LOCAL_FASE3K_V1.cjs`, README, SELECT para regenerar huellas, snapshot JSON y estado técnico.

## Evidencia remota
Se calcularon mediante SELECT en Supabase productivo 55 huellas MD5 de bloques de hasta 250 filas, cubriendo ROP05 9702, RMA15 JM 2124 y RMA15 FS 1542, es decir 13368 registros. No había raw_data NULL ni caracteres de control separadores en las claves o valores. Se generaron 16 huellas adicionales de filas testigo para validar equivalencia de algoritmo antes de iniciar. Solo se transfirieron HUELLAS al módulo, NO filas, textos RAW ni secretos.

## Procedimiento seguro en clon V9
1. Crear archivo nuevo con el `.gs` y cero triggers.
2. Ejecutar SOLO `probarMigracionFase3kPreflightV1`, sin cambios locales.
3. Si el preflight es correcto, ejecutar `probarMigracionFase3kMuestrasV1` para comparar 16 hashes de TODOS los campos RAW.
4. Solo con muestras correctas, ejecutar una vez `dmUnifiedPhase3kStartV1` y continuar con `probarMigracionFase3kContinueV1` hasta `completed:true`, cuatro bloques por llamada.

## Seguridad e interpretación
Sin UrlFetchApp ni Supabase credenciales; no se mutan hojas, servidor ni colas previas. La única escritura es `DM_U3K_V1_STATE` dentro de ScriptProperties del CLON. Los cambios de última fila y encabezados bloquean la auditoría y requieren snapshot remoto nuevo. Una huella distinta identifica BLOQUE, no número exacto de filas distintas. Aun con 55/55 coincidencias, las columnas tipadas pueden seguir siendo distintas y no hay autorización para escrituras productivas.

## Progreso
Estimación global de unificación: **45 %** hasta sustitución segura total. Resta consumir cambios reales con ACK, corregir inconsistencias tipadas, procesos complementarios y corte/monitoreo/rollback. GitHub main, Apps Script originales, Vercel y Supabase no modificados.