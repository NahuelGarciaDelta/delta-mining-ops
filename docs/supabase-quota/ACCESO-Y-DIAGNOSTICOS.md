# Diagnóstico real con acceso Management — 14/10/2026

El acceso seguro SUPABASE_ACCESS_TOKEN quedó habilitado y fue probado: GET /v1/projects HTTP 200, un proyecto jwfocqaxlckuxoklwyxs en prhrkgunfokkpopvvdsv. No se copió ningún token al repositorio ni a los reportes. GET de perfil de organización devuelve 403; no es bloqueo de red. Las lecturas del proyecto, funciones, analytics y SQL read_only=true sí están autorizadas. No se necesita que el usuario encuentre manualmente las funciones Edge.

## Lo ejecutado realmente

- Inventario remoto de 16 funciones Edge desplegadas. ACTIVE significa desplegada, no que todas se ejecuten continuamente.
- Lectura de cron.job con SQL read_only=true, SIN recuperar comandos completos/tokens: hay dos jobs activos, lista-equipos-auto-sync → lista-equipos-version-watch (`*/5 * * * *`), e insumos-auto-sync (`*/15 * * * *`). No se cambió ninguna programación.
- Analytics API counts, ventana interval=7day: buckets 07/10–14/10, algunos días parciales; suma visible 43.658 requests REST, 16 Auth, 0 Storage, 0 Realtime. Son conteos reales; NO equivalen a bytes ni deben confundirse con los 30 días de las capturas. El endpoint agregado api-requests-count devolvió 43.684 en su ventana por defecto; no se equipararon ventanas ni momentos distintos.
- Analytics de TODAS las funciones, interval=1day, devuelve buckets horarios con extremos parciales. Observado: lista-equipos-version-watch 252 requests / 9 errores servidor; insumos-auto-sync 82 / 2; lista-equipos-auto-sync 27 / 0; delta-rop02-incremental-sync 46 / 0; delta-rop05-incremental-sync 38 / 0. Las otras no devolvieron buckets en esa ventana; eso no prueba ausencia histórica. ROP02/ROP05 incremental tienen invocaciones aunque no aparezcan en cron.job: falta identificar su cliente externo/programación. No se eliminaron funciones ni se invocó ninguna para probarla.
- pg_stat_statements real: reset 08/10/2026 12:02:55 UTC. Entre las consultas acumuladas figuran 4.539 lecturas wildcard ROP02 ordenadas fecha/source_key y 8.641 lecturas ROP02 con proyección. El RPC delta_source_versions acumula 589 llamadas, media ~1.022 ms. Los períodos incluyen días previos a las optimizaciones del 13/10; no sirven como medición exclusivamente posterior. `rows=1` en estos statements corresponde al agregado JSON de PostgREST, NO a una sola fila de negocio transferida.
- Lectura de definiciones de RPC y fuentes Edge instaladas, sin ejecutarlas. Se confirmó que delta_source_versions usa max(synced_at) y counts por dataset. sync_typed_dataset actualiza synced_at=now() sin predicado de cambio en los conflictos.
- Lectura sanitaria de sheet_sync_health: Insumos conserva last_success_at 08/10 16:46 UTC y consecutive_failures=42; último error saneado: "The signal has been aborted". Su rama changed=false retorna sin limpiar fallos, de modo que el contador almacenado puede estar desactualizado y NO demuestra 42 ejecuciones consecutivas recientes fallidas. Tampoco el last_success_at antiguo demuestra por sí solo que los precios hayan cambiado en Sheets o estén obsoletos. Hay 2 errores HTTP 500 observados en la ventana reciente. No se reconstruyeron ni alteraron datos.

## Nueva corrección preparada: Edge Insumos

Fuente real recuperada de sourcemap del bundle remoto. En tableRows había un GET select=source_row,codigo,precio_unitario cuya respuesta no se consumía, seguido de HEAD count=exact. Se quitó SOLO el GET innecesario y se mantiene el HEAD, filtro source_dataset y manejo de error. Archivo: supabase/functions/insumos-auto-sync/index.ts. No se cambió el parseo de códigos/precios, validación de fuente, guard de reducción, dryRun, token, scheduler ni sincronización. No se desplegó esta función ni se cargaron secretos.

Muestra real del GET equivalente mediante el proxy público: 1.000 filas, 66.707 bytes JSON. Si el job alcanzara ese control en todas las 96 ejecuciones diarias programadas, quitar un GET ahorraría ~6,4 MB/día / 192,1 MB en 30 días; algunos recorridos llaman al control dos veces y las solicitudes abortadas antes del control no lo hacen. Es una estimación condicional, no ahorro mensual aplicado ni cuota facturada. Test local con fetch simulado confirma HEAD único y rechazo de HTTP 403. No hubo prueba real de la nueva función contra Google/DB.

El timeout de Google no queda resuelto por esta corrección: ocurre antes de tableRows. No se relajaron límites/validaciones, no se aumentó el polling ni se cambió la frescura. Se requiere investigar latencia real de Apps Script y respuestas en un sandbox antes de modificar esa parte.

## Propuesta SQL reversible, NO aplicada

supabase/proposals/20261014_skip_unchanged_typed_rows/ contiene forward.sql, rollback.sql y manifest.json de la definición real actual. Se agrega WHERE … IS DISTINCT FROM excluded.… en cuatro conflictos (ROP05, RMA15, Lista, Insumos) para evitar marcar como recién sincronizados registros idénticos. Firma, valores asignados, comportamiento previo de eliminaciones y respuesta sourceRows/deleted permanecen; no se añadieron eliminaciones. CREATE OR REPLACE conserva la función existente/grants; no modifica RLS ni autenticación.

Este predicado elimina una causa demostrada de invalidación artificial cuando llegan payloads idénticos; falta medir con qué frecuencia ocurre. La comprobación local verifica que SOLO cambien esos predicados y que el rollback contenga la definición recuperada. NO es un test de PostgreSQL. Debe probarse en copia DB con insert/update/delete/no-op/nulls/concurrencia, triggers y contratos de todos los sincronizadores antes de solicitar/aplicar una migración productiva. Está fuera de migrations para que no se ejecute por herramientas automáticas. No se ejecutó forward ni rollback en producción.

## Monitoreo realmente disponible

Se ejecutó `python3 scripts/collect-supabase-diagnostics.py /ruta/privada/nuevo-snapshot.json`. Hace cuatro lecturas Management (proyectos, funciones, cron saneado, counts), sin invocar Edge, sin secretos en salida y sin polling en frontend. Puede correr manualmente una vez al día. Es estándar Python, sin nuevas dependencias. El schema oficial OpenAPI /api/v1-json confirma estos endpoints y read_only para SQL.

API Management observada expone counts/analytics recientes, pero no se encontró en el schema público un endpoint de facturación de 30 días por servicio. No se inventó una URL privada ni se interpretaron counters PostgreSQL como bytes facturados. El cálculo de presupuesto sigue usando exportación Usage con supabase-usage-budget.mjs; la captura 6,096 GB continúa siendo la evidencia del total de 30 días.

## Conclusión actualizada

Se confirmó acceso, inventario único, schedules, tráfico REST predominante en los counts recientes, lectura Edge desperdiciada e invalidación innecesaria potencial por timestamps. No se atribuyó un porcentaje preciso de los 6,096 GB a cada causa: faltan bytes de Usage por servicio y series diarias después de publicar correcciones autorizadas.

Frontend optimizado permanece en Preview; nueva Edge y SQL solo preparados. Producción y main siguen sin cambios. No puede garantizarse todavía 3,6–3,9 GB/mes ni ausencia de restricción el 10/11/2026. Se requiere separar aprobación del frontend, ensayo de Edge/SQL y monitoreo posterior. No se habilitaron pagos ni cambió el plan.
