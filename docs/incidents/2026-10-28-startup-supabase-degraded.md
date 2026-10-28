# DELTA OPS — Reparación controlada del 28/10/2026

**Estado:** frontend reparado en rama y preview; infraestructura Supabase todavía degradada. **No declarar incidente resuelto.**

## Evidencia confirmada
- La pantalla «Error al cargar datos — Apps Script» se mostraba durante una consulta a Supabase: `fetchHealth` delegaba en `fetchSupabaseHealth`, y `loadInitial` escalaba una falla de conectividad a error fatal de toda la aplicación.
- Durante la investigación, `execute_sql` falló por `Connection terminated due to connection timeout`, incluso para consultas pequeñas.
- En registros de PostgreSQL del 28/10/2026 (08:00–11:20 UTC) hubo **126** eventos «canceling statement due to statement timeout». Dos consultas observadas provenían de lecturas `rop02_frontend` y `rma15_frontend` con recuento exacto adicional (`count=exact`), una fuente de carga evitable.
- Ventana 10:50–11:28 UTC: **70** eventos de `statement timeout`, **11** «Connection reset by peer», **9** HTTP 500 y **4** HTTP 504 para `delta-rop05-incremental-sync`, **3** HTTP 500 y **1** HTTP 504 para `delta-rop02-incremental-sync-v2`. Los errores no prueban pérdida o duplicación de filas.
- Los cron 29/30/31/32 estaban activos. En 12 horas se observaron fallos de ejecución en 29 (29), 30 (11), 31 (9), 32 (3), y también ejecuciones con estado exitoso. Este estado confirma solamente pg_cron, no cada entrega HTTP.
- Vercel Runtime Logs respondió 403 para la sesión de consulta disponible. No se ha probado login autenticado ni recorrido funcional real.

## Correcciones limitadas a esta rama
1. `src/App.jsx`: errores de health de Supabase no bloquean navegación; errores por fuente se separan; cachés conservadas se identifican explícitamente como no verificadas; el timestamp de actualización no se incrementa por un ping o refresco vacío.
2. `src/services/supabaseReadApi.js`: la descarga completa `fetchAll` ya no realiza `count=exact`; lecturas paginadas secuenciales ordenadas con un límite seguro y sin retorno de historiales incompletos. Límite global 5→2. Si falla `delta_source_versions`, se evitan las 10 consultas fallback con `count=exact` que agravaban la saturación.
3. `scripts/intelligent-refresh-vite-plugin.mjs`: el plugin que altera el bundle compilado mantiene la publicación inmediata de cada fuente, pero reduce el paralelismo real 4→2.
4. `src/config/viewSources.js`: Bienvenida carga sólo Lista Maestra; otras fuentes se cargan al abrir sus módulos.
5. `src/modules/home/ViewBienvenida.jsx`: apertura del Dashboard interno activa carga histórica bajo demanda; fallo del resumen de OT ya no inicia fallback de RMA15 completo; resumen no verificado tiene aviso.
6. Actualizados y agregados tests de regresión para estos cambios.

## Pruebas observadas
- Previews de Vercel en estado READY para los commits de reparación. READY confirma compilación, no comportamiento bajo carga real.
- Ejecución aislada de `fetchAll` con **2057** filas sintéticas: todas recuperadas, 2057 claves únicas, primera fila 5, última 2061, páginas 0/1000/2000. Nueve verificaciones estáticas/funcionales adicionales pasaron.
- Se añadió prueba Node de paginación, degradación y health. No afirmar suite total PASS sin su ejecución real y logs de CI.
- Consulta de integridad a `public.rop02` falló por timeout durante la investigación. Conteos y sincronización actuales **no verificables aún**.
- No hay medición confiable de tráfico/consumo antes-después bajo cargas comparables; los cambios disminuyen consultas esperadas, pero la mejoría real debe medirse.

## Sin cambios a producción ni datos
- `main` permanece intacta. No se ejecutó SQL de escritura, DDL, migraciones ni cambios de cron, Edge Functions o plan.
- No se modificaron Apps Script, Google Sheets, contraseñas, permisos o registros históricos.

## Reversión
- Para descartar: no fusionar la rama ni asignar el preview a producción.
- Si se autorizara fusionar: revertir el commit de merge por GitHub y hacer deploy del commit previo, sin rollback de datos (no hay migraciones).

## Pendientes críticos
- Confirmar salud de Postgres/pg_cron por ventanas posteriores sin reintentos excesivos de SQL.
- Validar resultados HTTP reales de 29–32, integridad de ROP02/ROP05 y `sheet_sync_health` cuando Postgres responda.
- Verificar login y navegación de módulos desde un navegador autenticado en Preview.
- Medir I/O y egress antes/después de desplegar bajo tráfico comparable.
