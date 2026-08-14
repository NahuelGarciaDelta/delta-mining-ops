# Corrección V3 RC — paleta en Analytics

Se corrigió un acceso a `C.green` y `C.blue` durante la evaluación inicial del módulo `OperationalAnalytics.jsx`.

La configuración estática de los grupos de cambio de turno ahora usa valores de color literales. De esta forma no depende de que `applyDeps()` haya recibido todavía la paleta compartida.

Validaciones realizadas:

- `npm run validate`
- TypeScript `--noEmit` sobre todos los archivos JS/JSX de `src`
- resolución de los 50 archivos e imports locales

No fue posible ejecutar `vite build` porque el registro npm del entorno no contiene `@vitejs/plugin-react@4.3.4`.
