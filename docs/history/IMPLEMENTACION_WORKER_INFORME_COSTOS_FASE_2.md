# Informe de Costos — Web Worker Fase 2

Esta fase conserva la Fase 1 y mueve fuera del hilo principal el procesamiento final de la tabla **Amortización**:

- filtros por equipo, propiedad y tipo;
- recálculo de amortización según vida útil de Lista Maestra o valor manual;
- cálculo de `% mantenimiento`;
- cálculo del promedio aritmético por categoría;
- ordenamiento por columnas;
- preparación de agrupaciones y `rowSpan` por categoría.

## Comportamiento

- La tabla anterior permanece visible mientras el Worker genera el nuevo resultado.
- Las solicitudes anteriores se descartan si el usuario cambia filtros rápidamente.
- Se muestra `Actualizando Amortización en segundo plano…` sin bloquear la interfaz.
- La edición de categorías de la Fase 1 sigue ejecutándose en el mismo Worker persistente.

## Validación realizada

- `node --check src/workers/informeCostos.worker.js`: correcto.
- Verificación de integración de los comandos y estados nuevos en `src/App.jsx`.

El build completo debe verificarse localmente con:

```bash
npm install
npm run build
npm run dev
```
