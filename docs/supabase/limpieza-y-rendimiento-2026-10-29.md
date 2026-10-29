# Auditoría de limpieza y rendimiento de Supabase — 29/10/2026

**Proyecto:** `jwfocqaxlckuxoklwyxs` · **Repositorio:** `NahuelGarciaDelta/delta-mining-ops` · **Base de código:** `main`

## Estado y protecciones

- Se identificaron **50 tablas** en `public`, aproximadamente **119 MB** incluyendo índices (fotografía del 29/10/2026).
- **No se ejecutó DROP / TRUNCATE / DELETE / VACUUM FULL / ALTER ni cambios de cron en producción**.
- Este documento no autoriza operaciones destructivas y no contiene instrucciones de ejecución automática.
- No se deben eliminar datos históricos, sesiones, fuentes de sincronización, respaldos o procesos de DELTA GEO y DELTA AGENCY sin revisión de sus propietarios.
- Hay dependencias fuera del repo (Edge Functions, Apps Script, RPC y cron); ausencia de referencias en React **no prueba** que una tabla sea prescindible.

## Candidatas a ARCHIVAR, no eliminar todavía

| Tabla | Tamaño aproximado | Observaciones |
|---|---:|---|
| `rop05_backup_pre_drive_reconcile_20260814` | 5,2 MB | Respaldo histórico |
| `rop02_rebuild` | 3,9 MB | Posible tabla temporal de reconstrucción; revisar contenido/propietario |
| `rma15_backup_pre_drive_reconcile_20260814` | 3,9 MB | Respaldo histórico |
| `rop02_backup_pre_rebuild_20260814` | 3,6 MB | Respaldo histórico |
| `rop02_backup_pre_drive_reconcile_20260814` | 3,3 MB | Respaldo histórico |
| `rop02_orphans_backup_20260814` | 0,1 MB | Datos huérfanos a preservar hasta revisión |

En los controles del 29/10 no se hallaron referencias **explícitas al nombre** en funciones SQL `public`, vistas `public`, claves foráneas, triggers de estas tablas ni comandos cron. Este control NO cubre SQL dinámico, funciones privadas/externas, scripts no registrados, aplicaciones externas ni recuperación de incidentes. Las estadísticas de consultas no son evidencia concluyente de desuso.

### Protocolo obligatorio previo a una eventual retirada

1. **Exportar fuera de Supabase** cada tabla de forma íntegra, con definición, datos y metadatos pertinentes. Guardar en medio controlado y cifrado. No considerar un respaldo dentro de la misma base como liberación de espacio.
2. Verificar el respaldo: listado, restauración de prueba en una base aislada, conteo y control de integridad de las filas, junto con las referencias relevantes.
3. Revisar scripts externos (Apps Script, DELTA GEO y DELTA AGENCY), dashboards históricos, vistas, funciones `private`, RPC, cron y procedimientos de restauración.
4. Autorizar por tabla y programar una ventana de mantenimiento. Tomar medición de referencia y plan de reversión.
5. Solo entonces preparar una migración revisada para retirar las tablas autorizadas. **Nunca usar CASCADE**.
6. Comparar funcionamiento de ROP02, ROP05, RMA15, OT, Lista Maestra, Abastecimiento y usuario/login antes y después.

## Optimización implementada en la rama Preview

Archivo: `src/services/supabaseReadApi.js`.

- `fetchAll` **no solicita `count=exact`** cuando una fuente devuelve menos de 1.000 filas; para fuentes completas consulta total con un único **HEAD** sin descargar una segunda página. Si HEAD falla, sigue la paginación hasta completar datos.
- Se reemplaza `select=*` por proyecciones explícitas para `rop05`, `rma15_frontend`, `lista_equipos` e `insumos`, tanto en la lectura de fuentes tipadas como, cuando corresponde, en los listados históricos. Se conserva `raw_data`, `insumos`, `source_row`, `source_dataset` y `synced_at` para las adaptaciones vigentes.
- Se mantiene la cantidad, orden, semántica y forma de los datos que reciben los módulos. La mejora de egress es potencial, **no cuantificada en producción**.
- Pruebas automáticas: `tests/supabase-light-reads.test.mjs` para fuente chica, fuente grande y fallo del HEAD. Ejecutar `npm test`, `npm run validate` y `npm run build` antes del merge.

## Sincronizaciones: auditoría y prioridades

Los cron activos en la revisión estaban configurados así:

| Cron | Frecuencia | Recomendación |
|---|---|---|
| `lista-equipos-auto-sync` (invoca watcher) | Cada 5 min | Comparar último `serverVersion` almacenado vs. versión del origen y confirmar si genera worker redundante. No cambiar frecuencia sin definir latencia tolerada. |
| `insumos-auto-sync` | Cada 15 min | Revisar coste de lectura forzada de ~1.879 ítems y necesidad del `HEAD count=exact` por corrida. |
| `rop02-fierro-auto-sync` | Cada 15 min | **Mantener** la corrección V3 para fórmulas `IMPORTRANGE`; no volver a usar el timestamp del libro intermedio como prueba única de frescura. |
| `rop02-jm-tail-reconcile-hourly` | Cada hora | Mantener por seguridad de registros faltantes; revisar ventana limitada y métricas. |

La función `lista-equipos-version-watch` pregunta al origen por `versions`; cuando ve una versión distinta invoca el worker completo. Se observó que puede repetirse `worker.changed=false` aun con `detectedVersion` distinto del valor persistido. Auditar esa discrepancia para evitar releer el libro cada cinco minutos. **No actualizar salud/versiones artificialmente ni saltar cambios sin cotejo de contenido.**

## Estado de El Fierro (verificado)

- Fuente `rop02_fierro`: 8 partes físicos (filas 5–12), último 27/10/2026.
- Cron 29/10/2026, 13:22 hora argentina: HTTP 200, V3 `2026-10-29-ROP02-FIERRO-FORMULA-SAFE-V3`.
- `sheet_sync_health`: 8 origen, 8 destino, `changed=6`, `deleted=0`, cero fallos consecutivos.
- **No cambiar ni retroceder la versión V3 al optimizar otras sincronizaciones**.

## Hallazgos adicionales

- `rop02`: aproximadamente 28 MB totales (11 MB de datos y 17 MB de índices). Existen 19 índices; los de unicidad y clave primaria no deben retirarse por tener `idx_scan=0`.
- `rop05`: ~26 MB; `delta_dataset_rows`: ~21 MB; `rma15`: ~12 MB. Son datos operativos y/o capas de sincronización, no candidatos por tamaño.
- El asesor de rendimiento de Supabase informó 34 índices con estadísticas de uso nulo y 8 claves foráneas sin índice. Priorizar análisis de planes, no bajas automáticas de índices.
- **Reducir el número de tablas NO reduce automáticamente egress.** Medir bytes por respuesta, frecuencia de llamadas y transferencias duplicadas antes de atribuir mejoras.

## Criterios para avanzar

- Preview: probar inicio de sesión, historial, filtros, paginación, ROP02/ROP05/RMA15 y exportaciones; medir llamadas y bytes.
- Producción: sin cambios hasta aprobar la revisión del Preview.
- Limpieza de tablas: pendiente respaldo externo verificado; **0 tablas borradas** en este trabajo.
