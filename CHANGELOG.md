## 3.9.2 - Ficha única de equipo

- Selector de equipo convertido a lista desplegable.
- Eliminado el bloque redundante “Seleccioná un interno”.
- Costos RMA15 de la ficha convertidos de ARS a USD usando el parámetro USD/ARS de Informe de Costos.
- Tarjeta de costo RMA15 en una sola línea.
- Gráfico mensual y tabla histórica de insumos RMA15 con formato monetario USD.

# Changelog

Los cambios nuevos se documentan aquí de forma resumida y el detalle técnico vive en Git.

## 2026-08-07 — Hardening y mantenibilidad

- Tooltips de tablas migrados de DOM imperativo/`innerHTML` a React Portal.
- Sanitización por lista blanca para tooltips enriquecidos y texto libre de planillas.
- Auditoría automática de seguridad para evitar regresiones con `dangerouslySetInnerHTML`, `eval` o `innerHTML` en `Table`.
- Tests unitarios para amortización/alquiler y sanitización de tooltips.
- Configuración de ESLint y Prettier, con scripts de lint/formato.
- Extracción de hooks de PWA y diálogos desde `App.jsx`.
- Extracción de permisos por vista y utilidades de estado guardado desde `App.jsx`.
- Extracción del estado/base de Licitaciones y selector de costo de adquisición desde `LicitacionesModule.jsx`.
- Notas históricas movidas a `docs/history/` para mantener limpia la raíz.

## 3.9.0 - Plataforma integrada
- Motor único de actualización y auto-refresh.
- Permisos por acción y protección de cambio de área.
- Ficha única transversal del equipo.
- Dashboard ejecutivo en Bienvenida.
- Tablas avanzadas con filtros por columna, persistencia, resize y exportación.
- Comparación período anterior y José María vs Filo del Sol.
- PWA/offline con cache por dataset y banner de estado.
- Error boundaries por módulo.
- Versionado visible v3.9.0.
