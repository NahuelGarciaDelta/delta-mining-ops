# Delta Mining V3 — Etapas 20 a 23 combinadas

## Cambios incluidos

### Etapa 20 — Analítica operativa modular
Se extrajeron de `App.jsx`:

- Ranking de operarios.
- Cambios de turno.
- Dashboard técnico de salud de fuentes.

Archivos nuevos:

- `src/modules/analytics/OperationalAnalytics.jsx`
- `src/modules/analytics/index.js`

### Etapa 21 — Costos unitarios modular
Se trasladó la vista completa de Costos Unitarios, incluyendo buscadores, editores y tablas, a:

- `src/modules/analytics/CostosUnitariosView.jsx`

La vista sigue recibiendo los mismos datos y conserva sus exportaciones.

### Etapa 22 — Datos históricos fuera del componente principal
La base histórica de Costo Mensual Acumulado dejó de estar embebida en `App.jsx` y ahora vive en:

- `src/data/historicalCostData.js`

Esto reduce el tamaño y el tiempo de análisis del archivo principal sin alterar los valores históricos.

### Etapa 23 — Acceso, escrituras y caché compartidos
Se centralizaron:

- permisos por área en `src/shared/access.js`;
- operaciones de escritura de Lista Maestra y ROP02 en `src/services/writeActions.js`;
- lectura y escritura individual/múltiple del caché en `src/services/appCache.js`.

## Resultado

- `App.jsx`: de aproximadamente 3.726 a 2.657 líneas.
- No se modificaron fórmulas, filtros, datos, permisos ni navegación.
- Se verificó que todos los imports locales existan.
- TypeScript no detectó identificadores faltantes (`TS2304/TS2552`) ni errores de sintaxis.

## Validación local recomendada

```bash
npm install
npm run build
npm run dev
```

El build completo no pudo ejecutarse en el entorno de generación porque `@vitejs/plugin-react@4.3.4` no se encuentra disponible en la caché npm local.
