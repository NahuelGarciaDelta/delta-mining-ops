# Auditoría de estabilidad y rendimiento — 2026-10-08

**Estado:** PARCIAL / NO-GO para producción.  
**Base auditada:** `origin/main` `b8c22e612f5a181f90f396adb1639095a695ba78`.  
**Alcance implementado:** estabilidad del pipeline de compilación Vite, regresión de Mantenimiento Programado y configuración de chequeos estáticos. No se modificaron datos, reglas de negocio, RLS, secretos, sincronizadores ni producción.

## Hallazgos y correcciones

| Módulo | Problema / causa raíz | Severidad | Solución implementada | Validación | Estado |
| --- | --- | --- | --- | --- | --- |
| Build Vite | Transformadores basados en texto comparaban anclas LF contra fuentes CRLF. El normalizador se ejecutaba después de los parches y `vehicle-km-maintenance` fallaba con “aliases de camiones”. | Crítica | Se registra el normalizador CRLF como primer plugin y el transformador PM normaliza localmente cuando se invoca aislado. | 13 pruebas focalizadas, incluidas CRLF y pipeline PM: PASS. | Corregido |
| Mantenimiento Programado | Un fallo de transformación podía impedir que se generara el bundle y bloqueaba el Panel de flota antes de renderizar. | Crítica | La corrección anterior permite completar la secuencia de plugins y mantiene las reglas vigentes: camiones por horómetro y camionetas por kilometraje. | `pm-vite-pipeline-regression.test.mjs`: 5/5 PASS. | Corregido |
| Calidad estática | ESLint declaraba incompleto el entorno del navegador y emitía 45 errores `no-undef` para APIs reales (por ejemplo `MutationObserver`, `Request`, `PerformanceObserver`). | Media | Se declararon sólo las APIs web realmente usadas como globales de solo lectura. | `npm run lint:eslint`: 0 errores, 824 warnings heredados. | Corregido |
| Pruebas de integración Apps Script | Dos suites requieren `AppsScript_Delta_Mining_OPS_FINAL.txt`, archivo ausente en la base auditada. | Alta | No se fabricó ni reemplazó un artefacto de integración. | `historical-query-backend` y `stock-validation` fallan con `ENOENT`. | Bloqueado |
| Build de producción | El sandbox de Windows rechaza `fs.realpathSync.native()` con `EPERM` aun con ACL correctas; `fs.realpathSync()` y la variante asíncrona sí funcionan. Vite 5 usa la variante nativa. | Alta | Se validó un shim de ejecución temporal (`fs.realpathSync.native = fs.realpathSync`) fuera del código versionado. No se modificaron Vite, HTML ni dependencias. | Con el shim: 957 módulos transformados y build PASS en 11,11 s. | Mitigado en entorno |
| Regresiones funcionales existentes | La suite completa contiene fallos de Abastecimiento, Home, Dashboard, Atraso, Stock y otros, presentes antes de estos cambios. | Alta | Fuera de este cambio acotado; se preservaron para evitar ocultar regresiones con cambios masivos. | `npm test`: FAIL en ambas mediciones; las regresiones PM/CRLF corregidas ya pasan focalmente. | Pendiente |

## Mediciones

| Indicador | Antes | Después | Estado / motivo |
| --- | --- | --- | --- |
| Build de producción | `EPERM` antes de transformar | 957 módulos; 11,11 s | PASS sólo mediante shim temporal de entorno. |
| Inicio de sesión, navegación y módulos | NO MEDIDA | NO MEDIDA | No hay servidor de producción, credenciales ni sesión autorizada en este entorno. |
| ROP02, ROP05, RMA15, Panel de flota, Gestión Humana e Informe de Costos | NO MEDIDA | NO MEDIDA | Requiere navegador autenticado y fuentes productivas; no se accedió a datos productivos. |
| Requests, transferencia, long tasks y memoria | NO MEDIDA | NO MEDIDA | No se ejecutó un navegador con DevTools/Lighthouse contra un despliegue. |
| Pipeline PM CRLF | FALLA | PASS | Antes fallaba al localizar anclas con CRLF; después, 13 pruebas focalizadas pasan. |
| ESLint `no-undef` | 45 errores | 0 errores | Persisten 824 advertencias heredadas de variables sin uso. |

No se infieren porcentajes de mejora a partir de pruebas estáticas.

## Validaciones ejecutadas

| Comando / prueba | Resultado |
| --- | --- |
| `npm ci` | PASS; npm informó 9 vulnerabilidades transitivas (2 low, 1 moderate, 6 high). No se ejecutó `npm audit fix` porque actualizar dependencias de forma masiva excede esta corrección y puede introducir regresiones. |
| `npm run check` | PASS |
| `npm run lint:security` | PASS |
| `npm run lint:eslint` | PASS sin errores; 824 warnings heredados |
| `node --test tests/pm-vite-pipeline-regression.test.mjs tests/rop02-trucks-pickups-split.test.mjs tests/abastecimiento-crlf-build.test.mjs` | PASS, 13/13 |
| `npm test` | FAIL por regresiones preexistentes y archivos de Apps Script faltantes; no se declara PASS. |
| `npm run build` | FAIL sin workaround por `EPERM` del entorno; PASS con shim temporal de `realpathSync.native`, sin cambios versionados. |
| `git diff --check` | PASS |

## Cambios

- `vite.config.js`: normalización de saltos de línea antes de transformadores frágiles.
- `scripts/vehicle-km-maintenance-vite-plugin.mjs`: tolerancia local a CRLF para la ejecución aislada y las pruebas.
- `eslint.config.js`: globals web faltantes para que ESLint no reporte APIs legítimas como indefinidas.

## Próximos pasos para obtener GO

1. Añadir el workaround sólo a la imagen de CI afectada o actualizar su sandbox/Node; no incorporarlo al runtime de la aplicación. El procedimiento reproducible queda en `performance-before-after.md`.
2. Restaurar o versionar bajo control el artefacto Apps Script exigido por las pruebas, sin exponer secretos.
3. Corregir por grupos las regresiones existentes de Abastecimiento, Home/Dashboard, Atraso y Stock; medir cada grupo contra esta base.
4. Ejecutar mediciones cold/warm autenticadas con datos representativos antes de afirmar mejoras de tiempo, red o memoria.

## Continuación remota — fase de reducción de trabajo redundante (2026-10-08)

La auditoría se continuó directamente en la rama `audit/full-app-performance-stability`, sin merge ni despliegue manual. Estos cambios **no modifican** registros productivos, endpoints de escritura, RLS, scripts de sincronización, cálculos de negocio ni interfaz.

### Hallazgo 1: recarga íntegra automática cada cinco minutos

`src/App.jsx` llamaba `loadSources(VIEW_SOURCES[view], {force:true})` desde `refreshCurrentView` aun para `reason:"auto"`. Esto obligaba a volver a descargar, adaptar y escribir en IndexedDB las fuentes activas incluso cuando sus versiones en Supabase no cambiaban.

**Corrección:** `src/data/refreshPlanner.js` utiliza `fetchSyncVersions` y compara cada `meta.serverVersion` local con el manifiesto remoto **y también la cantidad de filas** para omitir fuentes sin cambios. Si el manifiesto falla o falta una versión, se conserva el comportamiento seguro anterior (descarga completa). El botón manual mantiene `force:true`. Los refresh handlers específicos registrados en `refreshManager` siguen ejecutándose. No se alteraron los intervalos de actualización ni las reglas de negocio.

**Evidencia estructural:** en el manifiesto de Supabase existían, entre otros, 8.954 filas ROP02 JM, 5.052 ROP02 FS y 8.458 ROP05 durante el diagnóstico; estos totales son variables operativos y **no** son mediciones de latencia. Una vista sin cambios puede ahora omitir sus descargas completas y sus escrituras de caché.

### Hallazgo 2: normalización global al cambiar cualquier fuente

Un único efecto de `App.jsx` dependía del objeto completo `rawSources` y reejecutaba normalización ROP02, ROP05, RMA15, insumos y Lista Maestra cuando cualquier dataset cambiaba, aunque el resto de las referencias de origen permaneciera igual.

**Corrección:** `src/data/derivedRefreshPlanner.js` determina dependencias a partir de la identidad de cada snapshot y el proyecto seleccionado. La actualización de insumos recalcula RMA15 y su valorización, pero no ROP02 ni ROP05. ROP05 sigue invalidando el mapa canónico de nombres de ROP02, y Lista Maestra invalida vistas que dependen de alias. Se reutiliza el mapa de insumos si esa fuente no cambió. No se modificaron `normalizeROP02`, `normalizeROP05` o `normalizeRMA15`.

### Validaciones automáticas agregadas

- `tests/refresh-planner.test.mjs`: casos de versiones iguales, distintas, sin manifiesto, cachés inválidas, fuentes desconocidas y claves duplicadas.
- `tests/derived-refresh-planner.test.mjs`: casos de hidratación inicial, cambios aislados de costos/RMA15/ROP05, alias de flota y cambio de proyecto.
- `.github/workflows/audit-performance-regression.yml`: en la rama de auditoría ejecuta instalación, checks, pruebas focalizadas históricas y compilación Linux (sin shim EPERM).
- La suite completa `npm test` continúa marcada como **pendiente/NO-GO** debido a regresiones preexistentes; el nuevo workflow no declara que todas las suites pasen.

### Pendiente para autorización GO

- Medición reproducible cold/warm en navegador autenticado: tiempo de interacción, long tasks, CPU, memoria, tráfico real y resultados comparados.
- Pruebas funcionales integrales de todos los módulos afectados.
- Resolución o clasificación individual de la suite completa fallida.
- Evaluación adicional de vistas pesadas y consultas a Supabase (lecturas diagnósticas únicamente).
- **Sin merge a main ni deploy de producción.** Los cambios a la rama pueden activar compilaciones o previews automáticos por integraciones de GitHub/Vercel; eso es distinto de un deploy de producción.

**Protección adicional:** `fetchSupabaseVersions()` conserva los conteos del manifiesto en `rowCounts`; un conteo diferente fuerza la descarga aun si el timestamp de versión coincide. Esta equivalencia de conteos se verificó mediante consultas de solo lectura en las fuentes ROP02 JM/FS, RMA15 JM/FS, ROP05, insumos y lista de equipos. Se agregaron pruebas para cambios de cantidad sin cambio de versión.

### Continuación — coherencia de alias ROP05 (2026-10-08)

**Problema confirmado:** `planDerivedRefresh` invalidaba ROP02 y RMA15 cuando cambiaba `lista_equipos`, pero no ROP05. El efecto real de `src/App.jsx` resuelve `resolveEquipmentCodeAlias(r.maquina)` también en las filas derivadas de ROP05; de ese modo podía quedar una representación obsoleta de los códigos tras una actualización de la Lista Maestra.

**Corrección implementada:** `src/data/derivedRefreshPlanner.js` marca `rop05: true` ante cambios de `lista_equipos`; `tests/derived-refresh-planner.test.mjs` ajusta la expectativa anterior y añade una regresión aislada. Commits: `e7c75e9` y `b09b9d9`. Se mantiene el resto de la invalidación de datos y no se altera ningún cálculo, interfaz o registro operativo.

**Validación remota:** [GitHub Actions para `b09b9d9`](https://github.com/NahuelGarciaDelta/delta-mining-ops/actions/runs/37820535854) **PASS** (instalación, comprobaciones, pruebas de planificadores, regresiones Vite/PM y build Linux). La ejecución transitoria de `e7c75e9` falló al no corresponder aún su expectativa de test; quedó corregido por el commit de pruebas posterior. Esta validación es focalizada: `npm test` completo continúa NO-GO y no hay mediciones de velocidad en navegador.

**Despliegues:** no se hizo merge, deploy manual ni cambios de `main`. Se intentó inspeccionar la configuración de Vercel en modo lectura, pero respondió **403 forbidden** para el alcance conectado. Por ello no está verificado si pushes a esta rama generan previews automáticas.

**Próxima intervención recomendada:** cubrir en prueba de integración el efecto real React y los mapas globales de nombres/tareas; caracterizar fallas de la suite completa contra la base; revisar invalidación y concurrencia de refrescos, con mediciones reproducibles.

### Continuación — auditoría transversal del paginador histórico (2026-10-08)

**Alcance revisado:** estructura completa del repositorio (árbol de 429 entradas), catálogo de pruebas, políticas de refresco, coordinador de solicitudes Apps Script, deduplicador de datasets, paginación histórica y planificadores de datos. Este barrido **no equivale** a pruebas end-to-end exhaustivas de todos los módulos; la suite completa sigue pendiente.

**Problema 1:** `createPagedDatasetController.loadMore` permitía dos solicitudes paralelas con el mismo `nextOffset`; cuando ambas finalizaban podían anexar dos veces la misma página. **Corrección:** compartir la promesa de la página en curso dentro de la misma generación, sin bloquear la recuperación de nuevas páginas.

**Problema 2:** `request` dejaba `loading:true` cuando `fetchPage` rechazaba la promesa. **Corrección:** restituir el indicador de carga en caso de error de la generación vigente; los resultados viejos no pisan el estado tras una nueva consulta o un reset.

**Archivos:** `src/data/pagedDatasetController.js` (`d494abb`), `tests/historical-data-service.test.mjs` (`877f7a3`), `.github/workflows/audit-performance-regression.yml` (`9cd9562`). Tres regresiones agregadas: llamadas `loadMore` simultáneas, fallo y reintento de carga incremental, fallo de carga inicial.

**Validación:** la ejecución focalizada para el código previo a la ampliación del workflow (`d494abb`) finalizó PASS; la ejecución del commit de CI `9cd9562` debe verificarse separadamente antes de aprobar esta intervención. No se ejecutó `npm test` completo, medición en navegador ni mediciones productivas; no se afirman aceleraciones numéricas.

**Riesgos pendientes:** carga integral con sesión real, revisiones de todos los componentes y transformadores de Vite, incompatibilidades históricas en pruebas de Apps Script, resultados reproducibles de `npm test` y revisión de posible superposición del refresco automático. Sin merge, deploy manual ni cambios de datos productivos.

### Auditoría final solicitada — ejecución completa en GitHub Actions (2026-10-08)

**Evidencia reproducible:** [Run 37821985493](https://github.com/NahuelGarciaDelta/delta-mining-ops/actions/runs/37821985493) del commit `aed93ac`. El workflow incorporó `full-suite-diagnostic` con `npm run lint:eslint`, `npm test`, resumen de fallos y artefactos descargables; el `continue-on-error` se aplica únicamente a las comprobaciones diagnósticas y **no significa que la suite haya pasado**.

**Resultados reales de Linux:** la suite ejecutó **298 pruebas: 276 PASS, 22 FAIL**. `npm run lint:eslint` finalizó con código 0, aunque conserva advertencias heredadas. El job de checks focalizados y build Linux finalizó PASS. Estos son resultados de CI, no mediciones de navegador ni evaluación E2E de los módulos.

**Pruebas fallidas identificadas en los logs (22):**
- Atraso: snapshot/ventana reciente, visibilidad de equipos TOP-0036/PCA-0021, separación equipo/proyecto.
- Dashboard/Inicio: resumen diferido, fechas ISO/DD/MM/YYYY, limpieza de filtro global, reemplazo React de tabla, fuente Bienvenida, consulta resumen mensual, alcance del Dashboard Gerencial.
- Movimientos de equipos: TOP-0072 inferidos.
- Gestión Humana: fecha vigente y suma de estadísticas.
- Migración y contratos: router/headers Apps Script, suite `historical-query-backend.test.mjs`, paginación histórica de pantallas, rango de Informe de Costos, lecturas pesadas Supabase frente a Apps Script.
- Abastecimiento/Stock: bypass caché RABA03, suite `stock-auth-session.test.mjs` y flujo de Stock sin Drive/Base64/hojas versionadas.
- Perfil gerente: suite `gerente-profile.test.mjs`.

Las suites de Apps Script/Stock mantienen también referencias al antiguo `AppsScript_Delta_Mining_OPS_FINAL.txt` (ausente), constatadas en la salida de `npm test`. No corresponde fabricar el archivo ni eliminar las pruebas para obtener un resultado verde. Algunos fallos comprueban estructura por cadenas de texto y deberán contrastarse con el comportamiento actual antes de atribuirlos a regresiones; **la causa individual de todos los fallos no está demostrada**.

**Previews Vercel:** proyecto aislado `delta-mining-ops-audit-preview`, commit `d711441`; deployment https://delta-mining-ops-audit-preview-hyec9g399.vercel.app con `target=null` (preview) y estado **READY**, y otro build aislado READY. El usuario informa que la aplicación de prueba funciona bien. No se modificó el despliegue histórico de Delta Mining OPS. No están verificadas las credenciales/variables de producción del proyecto de prueba; evitar escrituras operativas hasta constatar el aislamiento.

**Decisión de auditoría:** **NO-GO para merge y despliegue productivo**. La preview puede usarse para revisión manual, pero falta corregir o justificar los 22 fallos y ejecutar pruebas funcionales con datos representativos, sin comprometer producción. No se afirma haber terminado una auditoría integral funcional completa cuando la evidencia no lo respalda.

### Revisión individual de las 22 fallas — continuación del 08/10/2026

Se inspeccionaron directamente las pruebas, su implementación y las expectativas de movimientos de equipo, Gestión Humana, Stock, router histórico y Atraso.

**Tres fallas con causa identificada en pruebas desactualizadas:**
1. `equipment-movement-history`: exigía inferir cada cambio de proyecto por ROP02, aunque `inferRop02ProjectMovements` documenta y aplica únicamente el primer proyecto observado; cambios posteriores requieren registro persistido. Se actualizó la prueba (commit `3bd1bd3`) sin cambiar datos ni lógica productiva.
2. `gestion-humana-data`, última fecha: esperaba dos personas, omitiendo el conductor de la camioneta CTA-001 que ahora debe ser visible por la regla explícita de Gestión Humana. La nueva expectativa incluye tres personas (commit `7187ba2`).
3. `gestion-humana-data`, resumen: esperaba 30 horas, dos equipos y cuatro partes, omitiendo la misma camioneta operativa de cinco horas. La prueba ahora exige 35 horas, tres equipos y cinco partes (commit `7187ba2`). No se alteró la lógica de cómputo.

**Contradicciones verificadas, todavía sin modificar:**
- `tests/atraso-rop02-filters.test.mjs` exige `atrasoROP02:[]`; `tests/atraso-remote-query.test.mjs` exige las cuatro fuentes de ROP02 para la misma vista. Ambos contratos son incompatibles. Debe validarse la pantalla real y la estrategia de fallback antes de escoger una.
- `tests/stock-validation.test.mjs` y `tests/historical-query-backend.test.mjs` leen directamente un Apps Script histórico ausente. Son pruebas ligadas a la arquitectura retirada y no acreditan por sí solas una regresión del frontend actual.
- La prueba de `instant-startup-regression` espera `REQUEST_TIMEOUT_MS=12000`, mientras la API Supabase usa un timeout principal de 45000 ms para fuentes grandes. Modificar ese timeout para satisfacer texto estático podría reintroducir errores; se requiere evaluación de la política y pruebas de red.

**Sin diagnóstico suficiente para declarar reparados:** las demás fallas de Dashboard, Atraso, Abastecimiento, perfiles y consultas históricas. Muchas son aserciones regex de archivos fuente, pero ello no basta para afirmar que están obsoletas: requieren contrato vigente y prueba funcional.

**CI posterior a cambios:** ejecución [37823263743](https://github.com/NahuelGarciaDelta/delta-mining-ops/actions/runs/37823263743), solicitada para comprobar los tests revisados. La validación final de la suite completa se debe comparar con los 22 fallos originales. No se hizo merge ni deploy adicional.

**Validación confirmada de los tres ajustes:** el workflow [37823263743](https://github.com/NahuelGarciaDelta/delta-mining-ops/actions/runs/37823263743) finalizó PASS en las verificaciones focalizadas, la compilación y el diagnóstico. La suite completa ejecutó **298 pruebas, 279 PASS, 19 FAIL**, frente a 276 PASS y 22 FAIL anteriores. Esta reducción de tres fallos corresponde exactamente a las expectativas revisadas de movimientos y Gestión Humana; el diagnóstico completo sigue fallando, aunque el workflow marca success debido a `continue-on-error` del job diagnóstico.

### Continuación con Apps Script real proporcionado — 2026-10-08

Se contrastó localmente el script completo compartido por el usuario (6.503 líneas) con las pruebas de contratos de backend. **El archivo no se publicó en el repositorio GitHub**: contiene configuración interna y referencias a planillas de la empresa; el repo frontend es público.

**Confirmado mediante inspección del código facilitado:**
- Router GET para `query_dataset`, `get_equipment_history`, `get_rop02_latest_by_equipment_project`.
- `getRop02SourcesForRange_` permite rango entre años; `readFilteredQuerySource_` filtra antes de paginar, con lectura por bloque; `handleQueryDataset_` ordena antes de paginar y publica total, hasMore, nextOffset y métricas.
- Existen aceleradores de resumen mensual y último ROP02.
- Stock usa `STOCK_TEMP`, bloqueo `tryLock(30000)`, promoción de hoja temporal tras escribir; en el cuerpo del reemplazo de Stock no se utiliza DriveApp. Otras partes del mismo backend sí usan DriveApp legítimamente: por eso es incorrecto buscar la palabra en las 6.503 líneas.
- El área de perfil se normaliza actualmente con `String(payload.area||"").trim().toUpperCase()` y solo ADMIN/ADMINISTRADOR puede cambiar el área; las pruebas que exigían la función `usuarioNormalizarArea_` no correspondían al script aportado.

**Actualización de pruebas:** Los tests dependientes del Apps Script externo ahora aceptan ejecutarse localmente al disponer del archivo `AppsScript_Delta_Mining_OPS_FINAL.txt`; cuando el archivo no está en un checkout público, quedan **SKIP explícito**, no PASS. La validación del Stock se limita al manejador pertinente. Se conservan las validaciones de las partes frontend independientes. Los commits son `2a37ed7`, `da00fc3`, `ba5875e` y `771ff34`.

**Evidencia CI sobre `ba5875e`:** 303 pruebas contabilizadas, 279 PASS, 17 FAIL, 7 SKIP. La reducción del número de fallos respecto de 19 **no demuestra dos correcciones funcionales**: corresponde principalmente a que los contratos de backend externo pasaron a SKIP cuando falta el script en CI. La ejecución posterior con `771ff34` requiere comprobación independiente. Se mantiene **NO-GO** y se recomienda ejecutar las aserciones de backend en entorno privado con el script real para poder certificar sus contratos.
