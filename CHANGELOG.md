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
