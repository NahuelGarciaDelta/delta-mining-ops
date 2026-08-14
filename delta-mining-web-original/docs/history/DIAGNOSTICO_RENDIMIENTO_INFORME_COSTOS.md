# Diagnóstico de rendimiento — Informe de Costos

Esta versión agrega mediciones sin modificar cálculos ni resultados.

## Cómo probar

1. Abrir **Informe de Costos**.
2. Esperar a que aparezca la primera tabla.
3. Presionar **🧪 Diagnóstico** en la barra de filtros.
4. Presionar **Reiniciar**.
5. Cerrar el panel y realizar, de a una, estas acciones:
   - abrir Costo mensual acumulado;
   - abrir Mano de Obra;
   - abrir Amortización;
   - abrir Resumen por equipo;
   - cambiar Proyecto;
   - cambiar Tipo de máquina;
   - cambiar Equipo;
   - renombrar una categoría;
   - asignar una categoría a un modelo.
6. Volver a abrir **🧪 Diagnóstico** y usar **Copiar informe**.

## Qué mide

- tiempo total de ida y vuelta de cada comando al Web Worker;
- tiempo neto del motor dentro del Worker;
- tiempo de render/commit de `InformeCostosView`;
- tiempo de pintado al cambiar de tabla;
- cantidad de renders;
- cantidad de registros RMA15, insumos y equipos;
- cantidad de filas, selects, inputs y nodos DOM activos;
- historial de cambios de tabla, filtros y comandos enviados al Worker.

## Interpretación rápida

- Si **Motor** tarda mucho: el cuello está en cálculos/agrupaciones.
- Si **Worker** tarda mucho pero **Motor** no: el cuello está en copiar datos entre React y Worker.
- Si **Render/commit** o **Pintado de tabla** tarda mucho: el cuello está en React/DOM.
- Si hay muchos renders por una sola acción: hay estados o efectos encadenados que deben aislarse.
- Si hay cientos de selects o miles de filas DOM: hay que reforzar virtualización y edición bajo demanda.

La aplicación mantiene la última funcionalidad existente. Esta etapa es únicamente de instrumentación para decidir la optimización siguiente con datos reales.
