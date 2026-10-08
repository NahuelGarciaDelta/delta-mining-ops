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
| Build de producción | Vite no puede ejecutar `realpath(index.html)` en este worktree: `EPERM` del entorno de ejecución. | Alta | No se alteraron permisos, Vite ni el HTML para enmascarar una limitación del entorno. | `npm run build`: FAIL por `EPERM` antes de transformar la app. | Bloqueado |
| Regresiones funcionales existentes | La suite completa contiene fallos de Abastecimiento, Home, Dashboard, Atraso, Stock y otros, presentes antes de estos cambios. | Alta | Fuera de este cambio acotado; se preservaron para evitar ocultar regresiones con cambios masivos. | `npm test`: FAIL en ambas mediciones; las regresiones PM/CRLF corregidas ya pasan focalmente. | Pendiente |

## Mediciones

| Indicador | Antes | Después | Estado / motivo |
| --- | --- | --- | --- |
| Build de producción | NO MEDIDA | NO MEDIDA | Bloqueado por `EPERM` de `realpath` del worktree. |
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
| `npm run build` | FAIL por `EPERM` del entorno sobre `index.html`; no se declara PASS. |
| `git diff --check` | PASS |

## Cambios

- `vite.config.js`: normalización de saltos de línea antes de transformadores frágiles.
- `scripts/vehicle-km-maintenance-vite-plugin.mjs`: tolerancia local a CRLF para la ejecución aislada y las pruebas.
- `eslint.config.js`: globals web faltantes para que ESLint no reporte APIs legítimas como indefinidas.

## Próximos pasos para obtener GO

1. Ejecutar build y pruebas desde un checkout con permisos normales de Windows o CI; distinguir el bloqueo ambiental de los fallos de código.
2. Restaurar o versionar bajo control el artefacto Apps Script exigido por las pruebas, sin exponer secretos.
3. Corregir por grupos las regresiones existentes de Abastecimiento, Home/Dashboard, Atraso y Stock; medir cada grupo contra esta base.
4. Ejecutar mediciones cold/warm autenticadas con datos representativos antes de afirmar mejoras de tiempo, red o memoria.
