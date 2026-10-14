# Auditoría y reducción de consumo — 14/10/2026

## Estado y alcance

Código optimizado en rama independiente perf/supabase-quota-20261014. Base d7e91f9457f5f5315bc203d04ab2bdff565e4a4d. No se tocó main, proyecto productivo, Apps Script V9, datos/roles de Sheets/Supabase, dependencias o migraciones. La versión Preview es para revisión; no cambia el consumo de usuarios productivos hasta una publicación autorizada.

**No se identificó aún la cuota exacta que provocó la advertencia.** Solo hay acceso público a lecturas y acceso Vercel; no hay Management API/Supabase dashboard habilitados. No se dispone de Usage de 30 días ni prueba de pertenencia/listado de todos los proyectos de la organización. El código usa el proyecto jwfocqaxlckuxoklwyxs; falta confirmar sus métricas y otros proyectos de prhrkgunfokkpopvvdsv. No se afirma que todo sea egress ni que se haya alcanzado la meta mensual.

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
| Egress diario de organización | Desconocido | Desconocido | Requiere Usage |
| Egress mensual de organización | Desconocido | Desconocido | Requiere Usage; no extrapolar una fila |

No se conoce frecuencia de duplicación ni participación ROP02 en el egress. Ahorro proyectado = ahorro por evento × eventos observados; no se puede dar GB/día real sin ese dato. Si el egress ROP02 histórico observado es H y las muestras representativas muestran 20%, su componente sería ~0,8H, más reducción de duplicados observados; no aplicar el 80% a toda la organización. El objetivo de 3,6 GB/ciclo sigue SIN CONFIRMAR.

## Validación, configuración y riesgos

Tests adicionales comprueban proyección sin perder campos de negocio, claves distintas sin colisión, coalescencia concurrente, limpieza tras error, lectura fresca posterior, historial de Taller, RABA03/snapshot independiente, caché histórica por versión e invalidación al guardar. Monitoreo offline prueba ciclos de 31 días, múltiples proyectos y rechazo de duplicados/días faltantes. Autenticación en Chromium pasa con requests externos interceptados: primer ingreso/cambio/token/recarga/contraseña anterior rechazada. No es prueba real de escrituras en Google.

Resultado final de tests/build/Preview, hash del commit y URL están en el recibo externo de esta entrega. La suite alcanzó 391 tests luego de añadir la prueba de navegación; sin omisiones. Build conserva advertencia existente footer remitos. Preview se verifica por lectura/navegación: no se usan contraseñas reales ni se guardan horómetros. No se cambia configuración de Supabase ni Apps Script.

Conservar resultados remotos y todos los campos legacy depende del esquema actual probado/esperado; si Supabase cambia esquema, los tests/Preview deben repetirse. No se comparten lecturas asentadas entre tabs/dispositivos: se necesitaría una estrategia de servidor/versiones y validación adicional. La muestra real y los mocks no prueban carga de todos los módulos con todos los roles ni condiciones de sincronización remota.

## Estado Free y 10/11/2026

Fuentes oficiales y procedimiento diario están en MONITOREO.md. Free publicado: 5 GB uncached + 5 GB cached separados, 500 MB DB, 1 GB Storage, 50.000 MAU, máximo 2 proyectos activos. Falta confirmar límites y Usage efectivos por organización, Realtime/Edge y otros recursos. Reducir frontend solo reduce uso futuro: no borra cuotas ya consumidas. Un aviso puede persistir aunque se vuelva a límites; reincidencia puede restringir sin nueva gracia. No se habilitaron pagos ni cambió el plan.

**Conclusiones:** se identificaron y corrigieron causas concretas de consumo redundante en el código, no la causa principal facturada del exceso. Ahorro comprobado: 20,05% de cuerpo JSON en una fila real y 80,16% en un escenario simulado de cuatro lecturas. No puede confirmarse cumplimiento mensual ni ausencia de restricciones el 10/11. Faltan Usage 30 días/ciclo actual/anterior de TODOS los proyectos, diagnósticos SQL y varios días de medición representativa después de una publicación productiva autorizada. El Preview no resuelve por sí solo el consumo en producción.
