# Delta Mining OPS V3 — hardening y mantenibilidad

## Cambios aplicados

### 1. XSS en tooltips
- `Table` ya no concatena `observaciones` dentro de `innerHTML`.
- Los tooltips de fila se renderizan con React Portal.
- Los textos libres se renderizan como texto React (`white-space: pre-wrap`).
- Los tooltips enriquecidos usan un parser con allowlist de etiquetas y estilos; atributos/eventos/script/URL CSS no se trasladan al DOM.
- Se agregó escape explícito a tooltips imperativos históricos de Mantenimiento que interpolaban máquina/código/descripción.

### 2. Ciclo de vida React
- Se eliminaron los IDs globales `row-tip-hover` y `row-tip-pinned` del componente `Table`.
- Hover y pin quedan aislados por instancia mediante estado React y se desmontan automáticamente con la tabla.

### 3. Tests + lint + formato
- `node:test` con pruebas de amortización/alquiler y seguridad de tooltips.
- `scripts/security-audit.mjs` como gate ejecutable aun sin dependencias nuevas.
- ESLint y Prettier agregados a `devDependencies` y scripts de npm.
- `npm run validate` ahora ejecuta imports, checks del motor, auditoría de seguridad y tests.

### 4. Historial del repo
- 84 notas `CORRECCION_*`, `CAMBIO_*`, `REFACTORIZACION_*`, etc. fueron archivadas en `docs/history/`.
- Se agregó `CHANGELOG.md` como resumen humano y se recomienda Git como fuente de verdad.

### 5. Monolitos
- `App.jsx`: extraídos `usePwaInstall`, `useAppDialog`, permisos por vista y utilidades de estado persistido.
- `LicitacionesModule.jsx`: extraídos estado/base de licitaciones y `AcquisitionCostSelector` a `licitacionesState.jsx`.
- No se hizo una reescritura masiva del dominio para evitar regresiones funcionales.

### 6. Estilo
- Agregada configuración de Prettier y comandos `format` / `format:check`.
- Los módulos nuevos/refactorizados se dejaron con formato legible.
- La normalización total del repositorio queda automatizada con `npm run format`, evitando mantener reglas manuales de estilo.

## Validaciones realizadas en este entorno

- `npm run validate`: OK.
- 60 archivos JS/JSX: imports locales resueltos.
- 7 tests unitarios: OK.
- Auditoría de seguridad: OK.
- Checks del worker y `InformeCostosEngine.js`: OK.

## Limitación del entorno

No fue posible instalar `@vitejs/plugin-react@4.3.4` desde el registro npm interno disponible, y el acceso directo a npm público agotó el tiempo de espera. Por eso el build Vite final debe ejecutarse en una máquina con npm operativo.
