# Corrección final de rendimiento del Informe de Costos

Esta versión parte de la última variante estable anterior al Web Worker/IndexedDB específico del Informe de Costos y conserva el administrador de categorías.

Cambios aplicados:

- Se retiró la integración experimental que copiaba toda la base al Web Worker al abrir el informe o cambiar filtros.
- Los cálculos pesados dejan de depender de la pestaña activa; cambiar entre Mano de Obra, Amortización y Resumen no vuelve a recorrer toda la base.
- Se reutilizan mapas y agregados ya calculados para internos, proyectos, insumos, costos mensuales y mano de obra.
- La edición de categorías queda aislada y se persiste en momentos ociosos del navegador.
- Asignar o renombrar una categoría no recalcula RMA15 en cada clic o pulsación.
- Las filas grandes se renderizan progresivamente para mantener la interfaz disponible.
- Se mantienen crear, renombrar, eliminar, reasignar y restablecer categorías.
- Se mantienen equivalencias de internos, cálculos, filtros, tablas y exportaciones existentes.

Validación realizada:

- Se verificó que el proyecto no contenga los archivos del Worker experimental del Informe de Costos.
- Se verificó la presencia del administrador de categorías y de las optimizaciones de caché/memoización.
- El build completo no puede ejecutarse en este contenedor porque el proyecto original depende del binding nativo de Rolldown para Windows y el registro disponible no permite reinstalar todas las dependencias. Ejecutar en Windows: `npm install` y `npm run build`.
