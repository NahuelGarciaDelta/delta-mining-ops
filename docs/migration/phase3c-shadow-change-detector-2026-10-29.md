# Fase 3C: detector incremental en sombra para ROP05 / RMA15

**Estado (29 octubre 2026):** implementado y probado localmente, entregado a través de ChatGPT como `DELTA_OPS_V9_UNIFICADO_FASE3C_SHADOW_20261029.zip`. Todavía NO instalado en el proyecto Apps Script de pruebas por el usuario. Producción y `main` sin cambios.

## Contexto verificado

El usuario ejecutó Fase 3A V3 sobre datos reales y obtuvo `ok:true`, `failed:0`, `readyForWrites:false`, con ROP05 9684/9684, RMA15 JM 2124/2124 (7 históricos con interno vacío) y RMA15 FS 1542/1542. El último inventario leído de Supabase coincide por cantidad e identidad de fila. Sin embargo, las 3666 columnas tipadas de `intervencion`, `turno`, `lugar` RMA15 están vacías aunque sus originales existen en `raw_data`; 8580 observaciones ROP05 también están presentes solo en `raw_data`. Se prepararon fallbacks de lectura en esta rama.

## Implementación en el paquete ZIP

Archivo Apps Script: `DM_UNIFIED_ROP05_RMA15_PHASE3C_SHADOW_V1.gs` (13.7 kB).

- Depende del código V9, Fase 2 V2 y Fase 3A V3 instalados en clon sin activadores.
- `dmUnifiedPhase3cStartV1()`: ejecuta diagnóstico V2, verifica fuentes/encabezados y guarda cursor.
- `probarMigracionFase3cV1()`: procesa máximo 8 lotes de 250 filas por ejecución y guarda huellas SHA-256 truncadas por fila en **ScriptProperties del clon** (hasta ~390 KB). El siguiente ciclo diferencia por fila `unchanged`, `modified`, `added`.
- `dmUnifiedPhase3cStatusV1()`: muestra estado y progreso.
- `dmUnifiedPhase3cRestartAfterAppendV1()`: reinicia excepcionalmente una pasada incompleta cuando la hoja ha **crecido** sin cambiar encabezados, conservando huellas previas. No admite recortes.
- Primera pasada crea referencia inicial. No equivale a comparar valores con Supabase.
- Conserva las siete excepciones RMA15 JM previamente verificadas mediante huella de su fila. Rechaza cualquier otro interno faltante y formatos no mapeables.
- No contiene `UrlFetchApp`, llamadas RPC, `doGet`, `doPost`, comandos de borrar/editar Sheets ni activadores. No lee ni escribe Supabase; **solo escribe el estado de seguimiento en las Propiedades del script del clon**.

## Pruebas locales

`TEST_LOCAL_PHASE3C_V1.cjs` valida sintaxis V9 + módulos, primera captura de 13.350 filas simuladas, segunda pasada idéntica sin falsos positivos, cambio de una fila, alta de una fila, altas que cruzan bloque de 250, recuperación tras error de escritura local de checkpoint, protección de nuevos internos vacíos y cero escrituras externas.

**Resultados: PASS**. Estas pruebas NO garantizan comportamiento en Google Apps Script real.

## Próximas acciones del usuario

1. Crear un nuevo archivo `DM_UNIFIED_ROP05_RMA15_PHASE3C_SHADOW_V1` en el clon V9.
2. Ejecutar `dmUnifiedPhase3cStartV1` una vez.
3. Ejecutar `probarMigracionFase3cV1` repetidamente hasta `completed:true`.
4. Ejecutar nuevo ciclo, sin editar los orígenes para inducir cambios, y verificar `unchanged`/altas/ediciones naturales.
5. Enviar registro final sin secretos.

## Puerta de seguridad para 3D

No activar nuevos escritores, disparadores ni alterar los dos proyectos originales hasta comparar valores de origen vs Supabase (no solo conteos), resolver insumos descriptivos FS filas 642 y 979 y operativo no informado fila 834, proteger `source_dataset+source_row`, implementar flujo de confirmación por lote y **prohibir siempre borrados**. Mantener costo de datos bajo y evitar réplica entera.

No se modificaron Supabase, Vercel de producción, `main`, Apps Script en vivo ni sus activadores.