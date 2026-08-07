# Delta Mining V3 — Etapa 12: dependencias compartidas

## Correcciones aplicadas

- `positionTip` se movió a `src/shared/dom.js`.
- Las rutas SVG de iconos se movieron a `src/shared/icons.js`.
- `fmtNum`, `toNumber` y `normDate` se centralizaron en `src/shared/formatters.js`.
- `components/ui/index.jsx` importa explícitamente todas sus dependencias.
- `App.jsx` importa explícitamente `positionTip` y ya no depende de una función global implícita.
- Se eliminó el bloque duplicado `PATHS` de `App.jsx`.

## Validaciones

- Todos los imports locales de los 34 archivos JS/JSX resuelven correctamente.
- No se detectaron identificadores indefinidos TS2304/TS2552 en `src`.
- Se validó sintaxis con `node --check` para helpers, Worker y motor de Informe de Costos.
- No se pudo ejecutar `vite build` en este entorno porque el registro npm interno no contiene `@vitejs/plugin-react@4.3.4`.
