# Delta Mining OPS V3 RC.1

## Refactorización incluida

- `App.jsx` reducido de aproximadamente 18.800 líneas a 1.153 líneas.
- Oficina Técnica, Mantenimiento, Abastecimiento, Licitaciones, autenticación, bienvenida, analytics e Informe de Costos separados por módulos.
- Reglas de dominio, normalización de internos, exportaciones y correlaciones centralizadas en `src/shared/domain/index.jsx`.
- Dependencias de cada módulo centralizadas en `src/config/moduleDeps.jsx`.
- Acceso a Apps Script, caché, escrituras y diálogos separado en servicios.
- Componentes visuales reutilizables centralizados en `src/components/ui`.
- Backend incluido en `backend/AppsScript.gs`.
- URL de Apps Script configurable mediante `VITE_APPS_SCRIPT_URL`.
- Script `npm run validate` para comprobar imports locales y sintaxis de Worker/Engine.

## Validaciones realizadas en el entorno

- Parseo de todos los archivos JS/JSX mediante TypeScript.
- Comprobación de identificadores globales faltantes (`TS2304`, `TS2552`, `TS2448`, `TS2454`, `TS2459`): sin resultados.
- Resolución de imports locales: 51 archivos verificados.
- `node --check` del Worker y del motor de Informe de Costos: correcto.

## Validación final requerida en la PC de desarrollo

```bash
npm install
npm run validate
npm run build
npm run preview
```

El build de Vite no pudo ejecutarse en este entorno porque el registro npm interno no ofrece `@vitejs/plugin-react@4.3.4`.
