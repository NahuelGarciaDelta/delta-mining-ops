# Recuperación Nano — 2026-10-28

## Estado y alcance
- **Rama:** `fix/delta-supabase-recovery-20261028` (preview, no fusionada).
- **Producción:** `main` no modificada; el botón engranaje Configuración de Control ROP05 vs ROP02, con selección de proyectos/equipos y badge lateral dependiente del alcance, ya está incorporado en main (`540272f`).
- **Plan:** Free / Nano, sin ampliación, DDL ni modificaciones productivas.
- **Datos:** sin escrituras SQL, cambios RLS, credenciales, tablas o registros por estas correcciones.

## Causa corroborada
Soporte Supabase confirmó swap ~1 GB/1 GB, Disk I/O burst 0%, I/O wait 77,5%. Antes del cambio se reproducían `statement timeout` y PostgREST PGRST002/5xx.
- Paginación exacta (Prefer: count=exact) añadía COUNT a las lecturas históricas; eliminada previamente en `c3e8dd8`.
- `delta_source_versions()` público ejecutado bajo `anon` es **SECURITY INVOKER**. `anon` tiene EXECUTE, pero no SELECT sobre `public.rop02_project_sources`. El RPC hace múltiples `count(*)`. No se han ampliado permisos.
- Revalidación indirecta desde la app podía activar el RPC, fallar, y forzar consultas repetidas con otras pestañas.
- El fallback de consulta ROP02 hacía hasta cinco descargas históricas después de un fallo de un único endpoint; estaba envuelto en timeouts `Promise.race` que no abortaban la petición subyacente.

## Cambios de frontend
1. Eliminar uso automático de `delta_source_versions`: `fetchSupabaseVersions()` devuelve `null` sin tocar la red. `fetchSupabaseVersionsLightweight()` queda sólo para diagnóstico, sin `count=exact` y sin conteos de filas presentados como confirmados.
2. Refresco por fuente cada 20 minutos como máximo en el motor general; *Actualizar* manual fuerza descarga real. La caché se señala como no verificada, nunca como dato confirmado de Supabase.
3. Eliminar respuesta `ok:true,data:[]` fabricada al agotar tiempo de espera de ROP02.
4. Eliminar `Promise.race` de lectura ROP02 y la cascada de fallback de cinco históricos tras un error. Sólo queda la lectura directa filtrada; si falla, error explícito y fuente anterior intacta.
5. Mantener páginas serializadas, límite global de dos solicitudes, `limit+1` para `hasMore` sin recuento exacto y carga diferida del dashboard (cambios anteriores de esta rama).

## Evidencia en Supabase (sólo lectura)
- A las 13:34 UTC la base respondió con un cliente activo; posteriormente la actividad observada fue baja, sin transacciones bloqueadas en la muestra.
- `pg_cron` 29, 30, 31 y 32 **activos**. A las 13:43 UTC el cron 32 registró `succeeded`, y la Edge `rop02-jm-tail-reconcile` devolvió HTTP 200. 29, 30 y 31 registraron ejecuciones `succeeded` recientes y Edge HTTP 200.
- `private.delta_external_sync_log`: ROP02 JM `OK_INCREMENTAL` 13:29:11 UTC (58 filas), FS `OK_INCREMENTAL` 13:08:20 UTC (26 filas), ROP05 `OK` 13:14:36 UTC (38 filas).
- Últimas filas físicas observadas sin recuentos masivos: JM 10181, FS 5705, Filo Sur 228, El Zorro 146, El Fierro 6, ROP05 9636, Lista Maestra 135.
- Índices únicos existentes `(source_dataset,source_row)` para rop02 y rop05 impiden duplicación con esas claves. No se verificó exhaustivamente correspondencia con Google Sheets ni ausencia de huecos en todo el histórico.
- `EXPLAIN (ANALYZE, BUFFERS)` sobre la última fila JM: Index Only Scan Backward, ejecución **0,205 ms**, 3 buffers compartidos. **No se agregan índices.**

## Verificación y reversión
- Se agregan/actualizan pruebas regresivas de 1) RPC sin consultas, 2) refresco manual/caché, 3) rechazo del ROP02 incompleto, 4) ausencia de fallback en cascada.
- Vercel Git Preview y GitHub Actions validan compilación/casos. Un build READY no certifica el login real ni todas las pantallas. Revisar resultados CI más recientes antes de promover.
- Sin baseline comparable de Disk I/O, CPU y egress *con tráfico real en este preview*, no atribuir una mejora cuantificada.
- Reversión: no fusionar esta rama y conservar `main` intacta. No hay SQL que revertir.

## Pendientes
- Prueba real autenticada en Preview: Inicio, Lista Maestra, ROP02 y ROP05.
- Medir en Observability el uso de RAM/swap y Disk I/O con carga equivalente.
- Comparar Sheets vs PostgreSQL para datos incrementales; HTTP 200 no garantiza por sí solo filas actualizadas.
- El plan Free/Nano sigue con margen de memoria limitado; aunque las lecturas se optimizaron, no se puede garantizar disponibilidad absoluta.
