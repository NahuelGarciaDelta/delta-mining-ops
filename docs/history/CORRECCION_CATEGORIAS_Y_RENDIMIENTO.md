# Corrección aplicada

Esta versión conserva y deja activa la subpestaña **Amortización > Categorías por modelo** con:

- creación de categorías;
- cambio de nombre;
- eliminación con reasignación;
- asignación de cada combinación tipo/marca/modelo;
- persistencia local;
- recálculo del promedio por categoría.

También mantiene las optimizaciones de rendimiento del Informe de Costos:

- selector de categoría memoizado;
- edición de nombres confirmada al salir del campo o presionar Enter;
- guardado diferido durante tiempo ocioso;
- tabla de modelos renderizada progresivamente;
- cálculos pesados diferidos;
- cachés de metadatos, internos y costos reutilizados.

No se eliminó ninguna función del administrador de categorías.
