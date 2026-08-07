# Delta Mining V3 — Etapa 7: Mantenimiento modular

## Cambios

- Se extrajo `ViewMantenimiento` de `src/App.jsx`.
- Se extrajo `ViewDistribucionMantenimientos` de `src/App.jsx`.
- Se creó el módulo con carga diferida:

```text
src/modules/mantenimiento/
├── MantenimientoModule.jsx
├── MantenimientoRoute.jsx
└── index.js
```

- `App.jsx` ahora consume `MantenimientoRoute` para las vistas `mant` y `distMant`.
- Se creó `MANTENIMIENTO_DEPS` como puente temporal para las utilidades compartidas mientras continúa la modularización.
- No se modificaron filtros, tablas, cálculos, exportaciones ni diseño del módulo.

## Reducción

- `App.jsx`: aproximadamente 12.968 → 11.547 líneas.
- Mantenimiento extraído: aproximadamente 1.448 líneas.

## Validación

- Parseo completo de `App.jsx` y los archivos del módulo con TypeScript (`--noEmit`, JSX).
- Revisión de identificadores externos del módulo mediante `checkJs`.
- No quedaron referencias a `ViewMantenimiento` ni `ViewDistribucionMantenimientos` en el render principal.

## Build

El build completo no pudo ejecutarse en este entorno porque el registro npm disponible devuelve 404 para `@vitejs/plugin-react@4.3.4`.

Validación local recomendada:

```bash
npm install
npm run build
npm run dev
```

## Siguiente etapa sugerida

Extraer Oficina Técnica por bloques, comenzando por las vistas ROP02/ROP05 y sus controles, sin modificar comportamiento.
