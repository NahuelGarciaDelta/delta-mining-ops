# Implementación de rendimiento – Informe de Costos

## Cambios aplicados

1. Se agregó un Web Worker persistente en `src/workers/informeCostos.worker.js`.
2. La asignación y el renombrado masivo de categorías se procesan fuera del hilo principal.
3. La categoría usada en los cálculos de Amortización ya no se actualiza mientras se edita.
   Se sincroniza al volver a la subpestaña **Amortización**.
4. Se eliminó la precarga automática de todas las tablas al ingresar al Informe de Costos.
5. Los bloques pesados ahora se activan bajo demanda:
   - Tabla de costos / Top 3: sólo al abrir esas vistas.
   - Costo mensual: sólo en Costo mensual, Mano de Obra, Amortización o Resumen.
   - Mano de Obra: sólo en Mano de Obra, Amortización o Resumen.
   - Amortización: sólo al abrir Amortización o Resumen.
6. El Worker es singleton: no se vuelve a crear en cada cambio.

## Validación realizada

Se validó la sintaxis JSX/JavaScript con TypeScript (`tsc --noEmit`) para:

- `src/App.jsx`
- `src/main.jsx`
- `src/workers/informeCostos.worker.js`

El build de Vite no pudo ejecutarse en este entorno porque el registro interno no ofrece las dependencias del proyecto. En una PC con las dependencias instaladas ejecutar:

```bash
npm install
npm run build
npm run dev
```

## Nota

Esta versión conserva las fórmulas, equivalencias, categorías, filtros y tablas existentes. El cambio principal es cuándo y dónde se ejecutan los cálculos pesados.
