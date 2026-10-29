# Fase 3A — ROP05 y RMA15, simulación de mapeo sin escrituras

Fecha: 2026-10-29. Estado: preparada y probada **localmente**, no instalada en Apps Script ni integrada en `main`.

## Diagnóstico del clon V9 confirmado por el usuario

El preflight V2 devolvió `ok: true`, `failed: 0`, con:
- ROP05: 9.684 filas válidas, GID de la hoja real 230972854 corregido en el clon.
- RMA15 JM: 2.124 filas válidas incluyendo las siete excepciones históricas sin interno (filas 849, 864, 957, 1020, 1086, 1088 y 1168).
- RMA15 FS: 1.542 filas válidas.

## Revisión de Supabase

- `apply_rop05_external_delta_v1(p_upserts, p_delete_source_rows)` y `apply_typed_sheet_delta_v1(p_dataset, p_upserts, p_delete_source_rows)` implementan upserts por `source_dataset + source_row`, aceptan cargas de hasta 10.000 registros por operación y **permiten borrados** si se solicitan. Ninguna se llamó en esta fase.
- El `raw_data` de los 3.666 registros RMA15 conserva turno, lugar e intervención; las columnas tipadas `turno`, `lugar` e `intervencion` están vacías.
- El `raw_data` de ROP05 contiene texto de observaciones en 8.580 de 9.684 filas; la columna tipada `observaciones` está vacía en las 9.684. Es crítico conservar el encabezado largo.
- Se mantiene la corrección de lectura de RMA15 preparada en esta rama, sin promover a producción.

## Módulo local de simulación

El paquete `DELTA_OPS_V9_UNIFICADO_FASE3A_MAPEO_SEGURO_20261029.zip` contiene:
- `DM_UNIFIED_ROP05_RMA15_PHASE3_DRYRUN_V1.gs`: mapea origen en memoria y valida fechas, números, campo interno, intervenciones, observaciones, insumos y excepciones; no escribe en ninguna fuente.
- `TEST_LOCAL_PHASE3A.cjs`: pruebas Node con 13.350 filas simuladas, 7 excepciones, fallo deliberado de fecha y 0 llamadas de escritura.
- `LEEME_FASE3A.md`: instrucciones.

Las pruebas locales resultaron correctas, pero todavía debe ejecutarse en el clon de Google Apps Script para verificar los valores reales. El módulo agrega `probarMigracionFase3aV1`, requiere el módulo V2 y no requiere credenciales.

## Corte seguro pendiente

La fase 3B debe comparar payload contra las tablas reales antes de producir escrituras, resolver y probar la sincronización incremental y confirmar que los procesos antiguos no se deshabiliten antes de que se cubran sus dependencias (outbox, ROP02, ROP05, RMA15, insumos, etc.).

No se modificaron los activadores, los proyectos Apps Script activos, las funciones SQL, Vercel producción ni `main`.