# Web Worker – Fase 3B

Se trasladó al Worker persistente el armado de la tabla Mano de Obra:

- promedio mensual de mantenimiento por equipo;
- distribución proporcional del subtotal de mano de obra por proyecto;
- cálculo de filas CTA JM / CTA FS;
- costo de adquisición o alquiler ya resuelto por equipo;
- totales DELTA, ALQUILADO y general;
- ordenamiento de la tabla.

React conserva el último resultado visible mientras el Worker actualiza y descarta respuestas atrasadas mediante un token de solicitud.
