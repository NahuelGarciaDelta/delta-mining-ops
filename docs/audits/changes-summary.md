# Registro de cambios

## `53ef6aa fix: stabilize Vite transforms on CRLF checkouts`

- `vite.config.js`: normalizador de CRLF antes de transformadores por anclas.
- `scripts/vehicle-km-maintenance-vite-plugin.mjs`: normalización local para invocaciones aisladas y tests.
- `eslint.config.js`: globals web usados por el proyecto, sin desactivar reglas.
- `docs/audits/2026-10-08-performance-stability.md`: informe inicial.

No se modificaron datos, endpoints, secretos, RLS, reglas de negocio, sincronizadores ni apariencia visual.
