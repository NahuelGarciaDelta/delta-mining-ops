# Alta de proyecto ROP02 — EL FIERRO

**Estado al 19/10/2026:** plantilla existente en Google Sheets con encabezados en fila 4, sin partes diarios; proyecto configurado en el frontend y en catálogo Supabase. Google Apps Script V9 actualizado debe publicarse antes de habilitar el sincronizador programado.

## Identidad de la fuente
- Dataset `rop02_fierro`
- Proyecto `EL FIERRO` (no asimilar a EL ZORRO ni FILO DEL SOL).
- Google spreadsheet ID `1Ud7GerplVfoV5YpVxhipg2hDZ-JTjBTyCux66R2caL0`.
- Pestaña `R_OP02_EL_FIERRO`; gid `967767400`; encabezados en fila `4`.
- Fuente original: https://docs.google.com/spreadsheets/d/1Ud7GerplVfoV5YpVxhipg2hDZ-JTjBTyCux66R2caL0/edit
- La primera fila con datos será la 5. `_sourceRow` debe indicar **fila física** y nunca índice de una lista filtrada.

## Despliegue secuenciado

1. En el Apps Script V9 **existente**, sustituir el código por el archivo completo entregado `AppsScript_Delta_Mining_OPS_V9_EL_FIERRO.gs` (no pegar como archivo adicional duplicando funciones). Publicar **nueva versión** manteniendo la misma implementación /exec.
2. Confirmar `?action=rop02_fierro&limit=all` => `ok:true`, `meta.sheetGidUsed=967767400`, `meta.headerRow=4`, `meta.rows=0` inicialmente. `?action=versions` => clave `rop02_fierro` con versión.
3. Asegurar que el trigger de edición/sync cubra la nueva planilla sin duplicar activadores de los proyectos existentes.
4. La migración `supabase/migrations/20261019_rop02_project_sources_registry.sql` ya está aplicada en Supabase. No volver a aplicarla. Verificar que `public.rop02_project_sources` contiene la entrada nueva y `rop02_frontend` no la filtra. Verificar que la cantidad de ROP02 anteriores permanece sin cambios.
5. Desplegar Edge Function `supabase/functions/rop02-project-auto-sync/index.ts` **sin cron inicialmente**. Comprobar con petición autenticada y de solo lectura/estado; con fuente vacía nunca debe escribir ni borrar otros proyectos.
6. Una vez que el endpoint esté sano, configurar un único cron de **15 minutos** usando token secret de Supabase Vault y payload `{"dataset":"rop02_fierro"}`. No hardcodear secretos en funciones ni migraciones. Para nuevas fuentes, se podrán registrar otros datasets mediante el mismo worker parametrizado.
7. Validar lectura `rop02_fierro` desde Supabase, filtros y vistas en Preview tras pasar CI de frontend. Hacer deploy productivo de frontend **solo después** de verificar V9 y worker. No hacer merge o deploy de otra rama por accidente.
8. Monitorear egress/free tier, `sheet_sync_health`, `delta_source_versions` y `rop02` con `source_dataset='rop02_fierro'` durante los primeros días. No dar por hecho ahorro facturado sin medición real.

## Alta de futuros proyectos
1. Recibir planilla y script existente, revisar **spreadsheet ID, gid, nombre de pestaña, fila encabezados, formato real** y validar que las 17 columnas son compatibles. Si no, implementar adaptador específico por esquema.
2. Agregar entrada en `SHEETS_CONFIG` de Apps Script y republicar versión existente; asegurar el mecanismo de versión y trigger.
3. Agregar fila en `public.rop02_project_sources` y definir autorizaciones necesarias. No conceder permisos anónimos de escritura.
4. Agregar proyecto a `src/config/rop02Sources.js`; todos los módulos de frontend toman el catálogo.
5. Usar `rop02-project-auto-sync` con parámetro dataset y un cron autorizado por fuente que solo sincronice ante cambios. No cargar filas de ejemplo en producción.
6. Probar con fuente vacía y con datos reales controlados; correr `npm run validate` y `npm run build`, Preview y despliegue productivo tras aprobación.

**Reglas operativas invariantes:** cortes mensuales 26–25; TD/TN independientes; HI contra HF anterior del mismo equipo/turno; OD/FS/EM sin deducir causas. Proyecto identificado por fila/fuente, jamás mezclado con otro.
