# Corrección y auditoría de dependencias UI

Se corrigió el error al abrir Oficina Técnica:

- `CostosUnitariosView.jsx` ya no depende de que la paleta `C` sea inyectada antes de renderizar `BtnExcel`.
- `OperationalAnalytics.jsx` recibió la misma protección preventiva.
- Ambos módulos importan la paleta compartida desde `src/components/ui/index.jsx` y la usan como respaldo.
- La inyección de dependencias conserva prioridad cuando está disponible, pero ya no puede reemplazar `C` por `undefined`.

Validaciones ejecutadas:

- `npm run validate`: 50 archivos JS/JSX y todos los imports locales resuelven.
- Transpilación sintáctica de todos los archivos `src/**/*.js` y `src/**/*.jsx` con TypeScript: sin errores.
- Verificación del Worker y del motor de Informe de Costos con `node --check`.

El build de Vite no pudo ejecutarse en este entorno porque el registro npm interno devuelve 404 para `@vitejs/plugin-react@4.3.4`.
