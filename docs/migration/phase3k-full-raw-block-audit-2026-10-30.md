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
## Ejecución real de fase 3K — 2026-10-30 09:43 ART

El usuario corrió preflight, prueba 16 firmas (16/16), start y continue hasta final:
`completed:true`, `ok:false`, `scanned:13368`, `comparedBlocks:55`, `matchedBlocks:53`, `mismatchedBlocks:2`, `mapperIssues:0`, `mapperWarnings:2`. Bloques ROP05 17 (filas 4252–4501) y 26 (6502–6751). `potentialMismatchedRows:500` es techo de filas de bloques, no recuento de diferencias.

Investigación exclusivamente READ ONLY posterior:
- Supabase actualizó huella de los dos bloques por SELECT y ambas son iguales al snapshot de referencia (17: 86038dc3ef30b0e4e1d25ab3329c1956, 26: 31dd46f0420384a42fcfd76c78f64d3e).
- Consultas individuales de 250 digests de ambos bloques y lecturas de Google Sheets a través de conector, con normalización de fechas serial a ISO y cálculo MD5 local de todos los raw campos: **500/500 firmas por fila iguales al contenido actual de Supabase**. La huella reagrupada del bloque 26 también coincide con la remota.
- Por tanto el desacuerdo del registro de ejecución GAS no se reproduce en comparación posterior, pero **no se puede declarar 3K aprobada sin resolver la inconsistencia**. Puede ser cambio transitorio de hoja, dato dependiente del momento o diferencia entre los entornos de cálculo; causa NO CONFIRMADA.

Se creó módulo estrictamente READ ONLY sin UrlFetchApp ni escrituras, con 500 digests de referencia remota: `migration/scripts/DM_UNIFIED_PHASE3K_DIAGNOSTICO_BLOQUES_V1.gs`. Copiar como nuevo archivo en CLON y ejecutar **solo** `probarMigracionFase3kDiagnosticarBloquesV1`. No reiniciar, borrar ni forzar `DM_U3K_V1_STATE`; no habilitar sincronizador productivo. Avance global estimado sigue en 45%.


## Diagnóstico posterior en Apps Script — 09:54 ART, 30/10/2026

El usuario ejecutó `probarMigracionFase3kDiagnosticarBloquesV1` en el clon. Log: `ok:true`, `rowsChecked:500`, `matchedRows:500`, `mismatchedRows:0`, `noWrites:true`, `productionTouched:false`, `previous3kStatePreserved:true`, `readyForProductionWrites:false`. Bloque 17 (4252–4501) y bloque 26 (6502–6751): **250/250 coincidencias cada uno** y ambas huellas completas MD5 iguales al snapshot de referencia del 30/10/2026. 

**Dictamen actualizado:** no se reproduce la discrepancia de 2 bloques registrada en el primer recorrido de 3K. No se conoce con certeza la causa inicial: pudieron existir cambios transitorios, diferencias de lectura u otra circunstancia. La primera auditoría original permanece conservada con `matchedBlocks:53`, `mismatchedBlocks:2`. No marcar arbitrariamente `55/55` en ese estado. Ejecutar una confirmación integral independiente y de solo lectura antes de afirmar equivalencia estable. Todavía hay diferencias conocidas en columnas tipadas (ROP05 `observaciones`, RMA15 `turno/lugar/intervencion`, conversiones de dimensiones y km_hs). Ningún permiso para escrituras productivas ni cambio de triggers.

## Segunda pasada de confirmación: NO CONFORME (2026-10-30 10:04 ART)

El usuario reportó que la segunda confirmación sufrió antes un error de lectura de última fila ROP05 7097 frente a snapshot 9703. Continuó (sin reiniciar propiedades) y obtuvo finalmente `completed:true`, `ok:false`, `scanned:13368`, `comparedBlocks:55`, `matchedBlocks:53`, `mismatchedBlocks:2`, `mapperIssues:0`, `mapperWarnings:2` en `DM_U3K_CONFIRM_V1_STATE`. Los mismos bloques 17 (filas 4252–4501) y 26 (6502–6751) fallaron que en el primer ciclo.

Importante: completed:true expresa solamente fin del recorrido. No significa que la prueba fue aprobada. Ambas pasadas están pendientes de resolver. Sin embargo, un diagnóstico posterior del usuario para esos dos bloques fue `rowsChecked:500`, `matchedRows:500`, `mismatchedRows:0`, con blockHashMatched:true en ambos, y una comparación externa independiente de las 500 filas produjo lo mismo. Los dos resultados son contradictorios, así que la causa NO está demostrada.

Se releyó metadata y últimas filas de `ROP05 nuevo` tras el error; la hoja tenía 9703 filas y datos no vacíos más allá de 7097. La lectura 7097 fue transitoria o un fenómeno del método de lectura en Apps Script; no atribuir a un actor ni sobrescritura sin evidencia. Las dos confirmaciones usan esencialmente el mismo algoritmo y la misma referencia, por lo que 53/55 repetido no es evidencia independiente de corrupción.

ACCIÓN: no reiniciar ni borrar estados 3K ni 3K_CONFIRM; no habilitar escrituras ni desactivar triggers. Instrumentar el recorrido para registrar huella real del bloque, diferencias por fila y conteo del origen antes/después EN EL MISMO INTENTO; distinguir fallas de lectura/origen de divergencias duraderas. Registrar evidencia, sin tratar a las 500 filas como erróneas ni dar por aprobada la equivalencia integral.