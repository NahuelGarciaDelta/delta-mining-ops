# Actualización de acceso

SUPABASE_ACCESS_TOKEN ya está habilitado. Se ejecutaron diagnósticos reales de proyecto/Edge/cron/SQL read-only y se prepararon correcciones adicionales: ver [ACCESO-Y-DIAGNOSTICOS.md](ACCESO-Y-DIAGNOSTICOS.md). Las limitaciones de acceso indicadas más abajo describen el estado anterior; ya no bloquean las lecturas de proyecto. Sigue faltando la serie de bytes facturados por servicio de 30 días.

# Auditoría y reducción de consumo — 14/10/2026

## Estado y alcance

Código optimizado en rama independiente perf/supabase-quota-20261014. Base d7e91f9457f5f5315bc203d04ab2bdff565e4a4d. No se tocó main, proyecto productivo, Apps Script V9, datos/roles de Sheets/Supabase, dependencias o migraciones. La versión Preview es para revisión; no cambia el consumo de usuarios productivos hasta una publicación autorizada.

**Se confirmó un exceso visible de Egress en las capturas del usuario: 6,096 GB en Last 30 days, frente a la cuota publicada de 5 GB.** Es el principal exceso observado. No se conoce el desglose por servicio ni si existieron otros excesos en el ciclo anterior que originaron el banner. Hay capturas reales del dashboard, pero no acceso Management API habilitado ni exportación diaria/listado de todos los proyectos. El código usa el proyecto jwfocqaxlckuxoklwyxs; falta confirmar sus métricas y otros proyectos de prhrkgunfokkpopvvdsv. No se afirma que todo sea egress ni que se haya alcanzado la meta mensual.

## Hallazgos y optimizaciones

1. ROP02 histórico usaba select=* en rop02_frontend, mientras el adaptador devuelve solo 21 columnas necesarias. Se reutiliza la misma proyección que ya usaban las fuentes ROP02 completas. Filtros temporales/proyecto/equipo/estado, orden, conteo, paginación y todas las salidas legacy se preservan. No se recortaron filas ni se quitó historia para ahorrar.
2. Existía deduplicación concurrente de fetchSource, pero las lecturas directas de páginas/RPCs no la compartían. Se añadió coalescencia por path/método/body/prefer/timeout. Solo solicitudes superpuestas comparten una promesa; al resolver o fallar se elimina. No hay TTL adicional ni datos obsoletos cacheados por esta capa. Un parámetro/timeout distinto crea otra solicitud. Los adaptadores se mantienen.
3. Taller/equipmentMovements y consumidores del historial podían pedir el mismo historial simultáneamente. Se comparte la lectura completa y su fallback exclusivamente mientras está en curso; cada consumidor sigue clasificando/cacheando sus filas y una lectura posterior tras guardar vuelve a obtener datos.
4. Las funciones RABA03 y snapshot de Abastecimiento también deduplican consumidores simultáneos, cada recurso con clave independiente. Su descarga paginada completa y datos raw necesarios se preservan. El reader Supabase RABA03 existe pero el flujo productivo principal está protegido por la autoridad Sheet; no se estima ahorro real si el reader no se ejecuta. La optimización es preventiva para consumidores habilitados.

No se introdujeron caché compartida entre usuarios en Vercel ni HTTP caching de lecturas; se mantienen no-store y la autoridad del backend. No se reintentan POST de escritura ni se deduplican mutaciones. No cambiaron reglas JM/FS, TD/TN, 26–25, OD/FS/EM, permisos, productividad, horas o V9.

## Revisión del repositorio y optimizaciones del 13/10

El barrido de src/ registró 104 líneas relacionadas con fetch/Supabase/RPC/intervalos/WebSocket; se revisaron los lectores centrales, App, VIEW_SOURCES, versiones, caché IndexedDB, históricos, Taller, Abastecimiento y transforms Vite. Las pruebas completas cubren rutas/módulos, ROP02/ROP05/RMA15, autenticación y horómetros. Eso no constituye observación de cada flujo de usuarios reales.

Se conservaron: hidratación IndexedDB, versiones exactas y rowCounts, invalidación por dataset (evita volver a descargar ROP05 por cambios de Insumos), memo de manifiesto 15 s, limitador global de páginas 5, comprobación liviana de versiones ante timeout del RPC, actualización periódica 5 min y omisión con pestaña oculta, reaprovechamiento de datasets de App en control ROP02/ROP05 y dashboards, confirmación/patch local de horómetros. No se ampliaron intervalos ni se desactivaron módulos.

Carga inicial fría de bienvenida incluye nueve fuentes y toda la historia requerida por los módulos. Conservada: sin medir su volumen/uso no se puede eliminar o limitar sin alterar criterios. Navegación de fuentes/históricos usa el mismo manifiesto y caché; pruebas confirman que cinco entradas repetidas a un histórico sin cambio solo descargan una vez y una nueva versión recarga. Las lecturas manuales siguen frescas. ROP05/RMA15/lista/insumos conservan raw_data y campos no normalizados necesarios; no se quitaron a ciegas.

No se encontraron clientes Realtime/Storage/Auth nativo en los readers principales; sí hay módulo RPC de autenticación Supabase heredado, fuera de Login V9. Eso no prueba ausencia de consumo Storage/Auth/Realtime en el proyecto, otras apps o sincronizadores. Los intervalos visuales/relojes no equivalen a llamadas DB. No se alteró la política global de intervalos.

Las configuraciones y SQL de sincronización/cron remoto no están disponibles en el repo: no se puede verificar si reescribir synced_at sin cambios invalida versiones periódicamente. Es una hipótesis a investigar, no causa confirmada. Falta pg_stat_statements, índices, planes reales, conexiones y jobs. Se preparó DIAGNOSTICO-LECTURA.sql, sin ejecutar; no se prepararon índices/migraciones especulativos ni se borró nada. El RPC rop02_latest_by_equipment_project aparece en código legacy, pero no en la allowlist del proxy; no se amplió sin definición/permisos remotos. El inicio actual usa datos ya hidratados; revisar ese flujo si se reactiva el snapshot externo.

## Usage real aportado por el usuario

Las capturas muestran Egress 6,096 GB, Cached Egress 0, Database Size 0,181 GB, Storage 0, MAU 0, Realtime conexiones/mensajes 0 y Edge Function Invocations 8.538. Log Ingestion 0,584 GB y Log Query 50,234 GB aparecen marcados UPCOMING: no se atribuyó a ellos una restricción sin verificar sus límites efectivos. DB size visible está por debajo de 500 MB y las cuotas con cero no muestran exceso en esta captura. La página oficial de pricing consultada confirma 500.000 invocaciones Edge incluidas, 200 conexiones Realtime concurrentes y 2 millones de mensajes; los valores visibles están por debajo. Falta identificar funciones/jobs y verificar límites efectivos de la organización. No sumar los 50,234 GB de Log Query a los 6,096 GB de Egress: son conceptos diferentes. 8.538 invocaciones / 30 días son 284,6 por día; sería compatible con un job cercano a cada cinco minutos si fuera un único job continuo, pero su periodicidad no está demostrada. Pricing también publica 1 GB de Log Ingestion y 100 GB de Log Query; los valores de la captura están debajo y figuran UPCOMING, sin confirmar su aplicación efectiva. No se atribuyó el egress a PostgreSQL exclusivamente.

Promedio calculado usando el filtro Last 30 days: 203,2 MB/día; exceso respecto de 5 GB: 1,096 GB / 21,92%. Proyección sin reducción a 30 días: 6,096 GB; a 31 días: 6,2992 GB. Para 3,9 GB hace falta ~36,02% de reducción; para 3,6 GB ~40,94%. Son cálculos sobre el agregado de la captura, NO una medición nueva. El gráfico incluye fechas 14/09–14/10 y el último día puede ser parcial. El ciclo que aparece arriba es nuevo (14/10–14/11): no interpretar el agregado Last 30 days como gasto acumulado de ese ciclo. El filtro de proyecto está truncado en la captura; posteriormente el usuario confirmó que DELTA Mining OPS es el único proyecto de la organización. Esta confirmación proviene del usuario, no de enumeración Management.

La proyección ROP02 de una fila (~20%) por sí sola NO demuestra el objetivo 36–41%. La coalescencia puede reducir más en flujos duplicados, pero falta su frecuencia real y el aporte de Edge/sincronizadores. No se promete cumplimiento a partir del benchmark.

## Mediciones y comparación

Muestra REAL acotada: dos GET consecutivos al proxy productivo, misma primera fila ordenada por source_key, limit=1. select=* devuelve 758 bytes JSON (26 columnas); proyección devuelve 606 bytes (21 columnas): 152 bytes, **20,05%** menos. No se publican valores de la fila. Son bytes de cuerpo observados en la aplicación, NO contadores facturados por Supabase, y una fila no representa toda la tabla. Columnas omitidas: id, created_at, updated_at, source_dataset, source_row; el adaptador usa source_key para identidad/posición, preservado. La muestra no tenía raw_data duplicado; no se atribuyó ahorro a un campo inexistente.

Benchmark reproducible: `node scripts/benchmark-supabase-quota.mjs`. Ejecuta código base y corregido con fixture sintético y fetch simulado, compara todas las salidas funcionales. Cuatro consumidores simultáneos de la misma página: 4 → 1 requests; 2576 → 511 bytes JSON: **80,16%** menos en ESTE patrón. No es una medición de Usage ni del tráfico medio.

| Métrica | Antes | Después | Ahorro / evidencia |
|---|---:|---:|---|
| Solicitudes Supabase, 4 lecturas iguales simultáneas | 4 | 1 | 75%, simulación |
| Bytes JSON de ese patrón | 2576 | 511 | 2065 bytes / 80,16%, simulación |
| Fila real ROP02, consulta select=* vs proyección | 758 | 606 | 152 bytes / 20,05%, muestra HTTP real |
| Datos transferidos al abrir app fría | No medido | No medido | Fuentes iniciales sin recorte; no atribuir ahorro global |
| Navegar 5 veces al mismo histórico sin cambios | 1 descarga de datos | 1 descarga de datos | Caché previa preservada; prueba simulada, manifiesto aparte |
| Actualizar/guardar y cambiar versión | Nueva lectura | Nueva lectura | Consistencia preservada; prueba simulada |
| Egress diario del alcance de la captura | 203,2 MB/día calculados | No medido tras cambios | Promedio de 6,096 GB / 30; falta desglose |
| Egress en Last 30 days | 6,096 GB reales del dashboard | No medido tras cambios | Captura del usuario; no extrapolar una fila |

No se conoce frecuencia de duplicación ni participación ROP02 en el egress. Ahorro proyectado = ahorro por evento × eventos observados; no se puede dar GB/día real sin ese dato. Si el egress ROP02 histórico observado es H y las muestras representativas muestran 20%, su componente sería ~0,8H, más reducción de duplicados observados; no aplicar el 80% a toda la organización. El objetivo de 3,6 GB/ciclo sigue SIN CONFIRMAR.

## Validación, configuración y riesgos

Tests adicionales comprueban proyección sin perder campos de negocio, claves distintas sin colisión, coalescencia concurrente, limpieza tras error, lectura fresca posterior, historial de Taller, RABA03/snapshot independiente, caché histórica por versión e invalidación al guardar. Monitoreo offline prueba ciclos de 31 días, múltiples proyectos y rechazo de duplicados/días faltantes. Autenticación en Chromium pasa con requests externos interceptados: primer ingreso/cambio/token/recarga/contraseña anterior rechazada. No es prueba real de escrituras en Google.

Resultado final de tests/build/Preview, hash del commit y URL están en el recibo externo de esta entrega. La suite alcanzó 391 tests luego de añadir la prueba de navegación; sin omisiones. Build conserva advertencia existente footer remitos. Preview se verifica por lectura/navegación: no se usan contraseñas reales ni se guardan horómetros. No se cambia configuración de Supabase ni Apps Script.

Conservar resultados remotos y todos los campos legacy depende del esquema actual probado/esperado; si Supabase cambia esquema, los tests/Preview deben repetirse. No se comparten lecturas asentadas entre tabs/dispositivos: se necesitaría una estrategia de servidor/versiones y validación adicional. La muestra real y los mocks no prueban carga de todos los módulos con todos los roles ni condiciones de sincronización remota.

## Estado Free y 10/11/2026

Fuentes oficiales y procedimiento diario están en MONITOREO.md. Free publicado: 5 GB uncached + 5 GB cached separados, 500 MB DB, 1 GB Storage, 50.000 MAU, máximo 2 proyectos activos. Falta confirmar límites y Usage efectivos por organización y el desglose de otros recursos. Realtime/Edge publicados: 200 conexiones / 2 millones de mensajes / 500.000 invocaciones. Reducir frontend solo reduce uso futuro: no borra cuotas ya consumidas. Un aviso puede persistir aunque se vuelva a límites; reincidencia puede restringir sin nueva gracia. No se habilitaron pagos ni cambió el plan.

**Conclusiones:** se identificaron y corrigieron causas concretas de consumo redundante en el código, la cuota Egress excedida está confirmada por captura; la distribución de sus causas facturadas aún no. Ahorro comprobado: 20,05% de cuerpo JSON en una fila real y 80,16% en un escenario simulado de cuatro lecturas. No puede confirmarse cumplimiento mensual ni ausencia de restricciones el 10/11. Faltan exportación diaria y desglose Usage por servicio/ciclo actual/anterior de TODOS los proyectos, diagnósticos SQL y varios días de medición representativa después de una publicación productiva autorizada. El Preview no resuelve por sí solo el consumo en producción.


## Preview y conservación de producción

Preview publicado: https://delta-mining-ops-audit-preview-90wko6qm3.vercel.app/ , proyecto delta-mining-ops-audit-preview, deployment dpl_FjPb4mydai4LLPLNGocttyzwY3uU, target staging (Preview), estado READY. Runtime del commit 90d6b41a7a8852ea86ec336152e5e2993ccadadf; la documentación de capturas se agregó posteriormente sin cambiar src/api/scripts. Login renderizado sin excepciones; Apps Script V9 y lectura Supabase acotada HTTP 200. Las funciones y variables del proyecto se conservaron; no hay secretos nuevos en el bundle.

Producción sigue en dpl_BHcEaYdi4ZztSnrupo92D7gPp8LZ; main sigue d7e91f9457f5f5315bc203d04ab2bdff565e4a4d. No se hizo push ni merge a main. La rama y ambos commits locales están conservados en esta entrega.


El usuario confirmó un único proyecto en la organización. No conoce los nombres/frecuencias Edge: no se le exige diagnosticarlos; el agente puede listar las funciones y diagnosticar llamadas/jobs cuando esté disponible SUPABASE_ACCESS_TOKEN seguro. Alternativa visual: proyecto → Edge Functions → lista/Logs; consultar Cron (Jobs) o un sincronizador externo para horarios, sin pulsar Test/Invoke ni ejecutar funciones. No se usó el token expuesto en el chat.
