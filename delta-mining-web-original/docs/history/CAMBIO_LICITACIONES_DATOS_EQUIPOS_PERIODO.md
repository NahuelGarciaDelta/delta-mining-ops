# Licitaciones — Datos Equipos por período

Cambios aplicados:

- Se ocultó el selector general de licitación en la pestaña Datos Equipos.
- Se agregaron filtros Desde y Hasta.
- Las categorías se leen automáticamente de Informe de Costos → Amortización.
- Se incluyen equipos y camiones, excluyendo camionetas y vehículos livianos.
- El consumo se calcula para el período como: combustible total / horas totales.
- La celda muestra litros, horas y el resultado en L/h.
- El mantenimiento se calcula para el mismo período.
- El combustible se muestra solo como dato informativo y no se suma al costo total horario.
- La exportación a Excel incluye período, litros totales y horas totales.

Validaciones realizadas:

- `npm run validate`: correcto.
- Parseo JSX con TypeScript: correcto.
- El build Vite no pudo ejecutarse en este entorno porque el registro npm no contiene `@vitejs/plugin-react@4.3.4`.
