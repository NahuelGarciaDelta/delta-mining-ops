# DELTA OPS — Contingencia temporal de lectura por Apps Script
**Fecha:** 2026-10-28 · **Rama:** `emergency/appscript-source-readonly-20261028`

## Objetivo
Mantener acceso de consulta a las planillas originales mientras se resuelve la indisponibilidad de PostgREST y Auth por presión de memoria/SWAP e I/O en Supabase Nano, confirmado por soporte Supabase.

## Qué cambia
- `src/services/appsScriptApi.js`: `fetchSource`, `fetchHealth`, `fetchSyncVersions` y `fetchDatasetQuery` usan la publicación existente de Apps Script, no PostgREST, para las fuentes soportadas.
- `src/services/contingencySheetApi.js`: lectura secuencial de páginas físicas de hasta 900 filas, validación de continuidad de offset, cantidad de filas físicas, versión del origen y rechazo de páginas faltantes. Identidad física sólo si no hay ambigüedad por filas omitidas.
- `src/data/historicalDataService.js`: bienvenida pide su resumen por Apps Script; ROP02 no disfraza errores como datasets vacíos; el timeout de 12 s del query anterior deja de cortar la contingencia.
- `src/App.jsx`: bandera de contingencia visible con origen y riesgos. No se fusiona con producción.

## Límites confirmados
- No se ha cambiado el Apps Script que está desplegado. El endpoint debe continuar respondiendo a `backend_version`, `get_data_versions`, `lista_equipos`, `rop02_jm`, `rop02_fs`, `rop02_filosur`, `rop02_zorro`, `rop05`, `rma15_jm`, `rma15_fs`, `insumos`, `query_dataset` y `get_rop02_latest_by_equipment_project`.
- **ROP02 El Fierro:** el código Apps Script V9 en el repositorio no tiene este origen en `SHEETS_CONFIG`. No se reemplaza por otro proyecto; se emite error por fuente. Validar antes de cálculos de totales globales.
- Las escrituras de herramientas no migradas podrían seguir dependiendo de Supabase. Este preview sólo certifica una **alternativa de lectura**, no continuidad de todos los formularios, ni sincronización de salida, ni permisos/sesiones fuera del login de Apps Script.
- Apps Script tiene cuotas y límites de tiempo. La paginación reduce respuestas grandes, pero un timeout sigue siendo posible.
- La documentación de soporte Supabase confirma swap al límite y budget de I/O 0%; esta rama no corrige ese problema de infraestructura.
- No se verificó el resultado real del endpoint desde una sesión autenticada; Vercel READY sólo asegura el build.

## Validación
- Verificar preview con usuario autorizado, inicio de sesión y las secciones Lista Maestra, ROP02 JM/FS, ROP05 y RMA15, comprobando cantidades y fechas frente a las hojas.
- No confiar en valores vacíos, incompletos o con advertencia.
- Confirmar que operaciones de edición/alta se realizan en el destino correcto antes de habilitarlas operativamente.

## Reversión
- No promover la rama ni combinarla con `main`.
- Cuando PostgREST y Auth estén recuperados, abandonar el preview y utilizar producción original. No hay migración ni cambio SQL que revertir.
