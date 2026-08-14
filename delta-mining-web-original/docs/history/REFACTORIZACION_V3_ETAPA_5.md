# Delta Mining V3 — Etapa 5: estado aislado y reutilización de resultados

## Cambios

- Las pestañas pesadas quedan activadas tras su primera apertura; no vuelven a reconstruir el motor al salir y entrar.
- Se agregaron firmas de payload para evitar solicitudes duplicadas al Web Worker en Mano de Obra, Amortización y Resumen por equipo.
- Se inició la separación visual mediante `CostosTabPanel`, componente memoizado para aislar subárboles de tablas.
- Tabla de costos y Costo mensual ya usan el nuevo panel aislado.
- Se conserva todo el diagnóstico, categorías, equivalencias, virtualización y exportaciones.

## Resultado esperado

- Menos renders repetidos.
- Reapertura inmediata de tablas ya procesadas.
- Menos respuestas redundantes del Worker y menos actualizaciones de estado.
- Base preparada para extraer cada tabla a su propio archivo en las próximas etapas.
