# Corrección Etapa 7 — Licitaciones

Se corrigió el error:

`ReferenceError: LICITACION_PLANILLA_BY_TAB is not defined`

## Causa
Durante la modularización de Abastecimiento, las constantes de datos de las planillas de Licitaciones quedaron dentro de `AbastecimientoModule.jsx`, mientras `LicitacionesModule` continuó utilizándolas desde `App.jsx`.

## Corrección
- Se creó `src/modules/licitaciones/licitacionPlanillasData.js`.
- Se trasladaron allí todas las constantes de planillas utilizadas por Licitaciones.
- `App.jsx` ahora importa explícitamente esas constantes.
- Se eliminaron esos datos de `AbastecimientoModule.jsx`, ya que no pertenecen a ese módulo.

## Validación
Se validó la sintaxis y resolución interna mediante TypeScript sobre:
- `src/App.jsx`
- `src/modules/abastecimiento/AbastecimientoModule.jsx`
- `src/modules/licitaciones/licitacionPlanillasData.js`

El aviso de `beforeinstallprompt` no bloquea la app. Los errores de WebSocket corresponden al HMR de Vite y suelen desaparecer reiniciando `npm run dev`.
