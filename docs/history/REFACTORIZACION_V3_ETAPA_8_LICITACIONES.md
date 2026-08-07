# Delta Mining V3 — Etapa 8: Licitaciones modular

## Cambios realizados

- Se extrajo `LicitacionesModule` de `src/App.jsx`.
- Se creó `src/modules/licitaciones/LicitacionesModule.jsx`.
- Se creó `src/modules/licitaciones/LicitacionesRoute.jsx` con carga diferida (`React.lazy`).
- Se centralizaron los datos de planillas en `licitacionPlanillasData.js`.
- Se agregó un puente temporal de dependencias compartidas (`LICITACIONES_DEPS`) para conservar exactamente el comportamiento actual mientras continúa la modularización.
- `App.jsx` pasó de aproximadamente 11.547 a 10.801 líneas.

## Funcionalidad conservada

- Nueva Licitación.
- Control de Licitaciones.
- Costos de Equipos.
- Estados y resultados.
- Línea de tiempo e hitos.
- Guardado en Google Sheets y respaldo local.
- Exportaciones Excel.
- Fórmulas y planillas internas históricas.

## Validaciones

- Sintaxis JSX/JavaScript de `App.jsx`: OK.
- Sintaxis de `LicitacionesModule.jsx`: OK.
- Sintaxis de `LicitacionesRoute.jsx`: OK.
- Sintaxis de `licitacionPlanillasData.js`: OK.
- Revisión de dependencias externas del módulo: OK.

## Build

El build completo no pudo ejecutarse en este entorno porque el registro npm interno no contiene `@vitejs/plugin-react@4.3.4`.

En una PC con acceso normal a npm:

```bash
npm install
npm run build
npm run dev
```
