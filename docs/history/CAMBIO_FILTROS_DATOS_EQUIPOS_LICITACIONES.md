# Licitaciones — Datos Equipos: filtros y selección de insumos RMA15

Se incorporaron filtros por período, proyecto, categoría de amortización, equipo e insumo exacto de RMA15 (código + descripción).

- Las categorías continúan saliendo automáticamente de Informe de Costos → Amortización.
- Los equipos disponibles salen de Lista Maestra y respetan las equivalencias de internos.
- El selector de insumos se genera dinámicamente con los códigos y descripciones utilizados en RMA15 dentro del período y filtros activos.
- El costo horario de mantenimiento se recalcula usando solamente los insumos seleccionados, manteniendo la misma lógica de mano de obra del Informe de Costos.
- Se muestra un resumen de insumos incluidos y una columna de trazabilidad en la tabla.
- El consumo de combustible sigue siendo informativo y no se suma al costo horario total.
- La exportación Excel incluye el detalle de insumos considerados.

## Validaciones

- Imports locales: OK (50 archivos JS/JSX).
- Parseo JSX/JS con TypeScript: OK.
- Worker y motor de Informe de Costos: OK con `node --check`.
- El build de Vite no pudo ejecutarse en el entorno porque el registro interno no dispone de `@vitejs/plugin-react@4.3.4`.
