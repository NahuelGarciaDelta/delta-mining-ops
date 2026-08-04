# Web Worker — Informe de Costos — Fase 3C

## Cambio incorporado

La tabla **Resumen por equipo** dejó de filtrar y agrupar sus filas dentro del hilo principal de React.

Ahora el Worker persistente procesa:

- filtros por tipo, equipo y propiedad;
- agrupación por categoría operativa;
- promedio de amortización;
- promedio de porcentaje de mantenimiento;
- promedio de costo horario de mantenimiento;
- costo horario total;
- selección del modelo predominante;
- detalle de las máquinas incluidas en cada categoría;
- ordenamiento operativo de categorías.

## Comando agregado

`PROCESS_RESUMEN_EQUIPO`

React mantiene visible el último resultado mientras el Worker calcula el nuevo. Las respuestas atrasadas se descartan mediante un token de solicitud.

## Fases incluidas

- Fase 1: edición de categorías en Worker.
- Fase 2: procesamiento final de Amortización en Worker.
- Fase 3A: Costo mensual acumulado en Worker.
- Fase 3B: Mano de Obra en Worker.
- Fase 3C: Resumen por equipo en Worker.

## Validación

Se validó la sintaxis del archivo Worker con `node --check`.

El build completo no pudo ejecutarse en este entorno porque el `node_modules` disponible no contiene el binding nativo Linux de Rolldown (`@rolldown/binding-linux-x64-gnu`). En una PC con las dependencias instaladas ejecutar:

```bash
npm install
npm run build
npm run dev
```
