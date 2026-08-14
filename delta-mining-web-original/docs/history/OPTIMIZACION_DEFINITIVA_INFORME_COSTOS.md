# Optimización definitiva de Informe de Costos

Cambios aplicados sin eliminar el administrador de categorías:

- Los cálculos pesados ya no dependen de la pestaña activa. Después de la primera precarga quedan cacheados y cambiar entre Mano de Obra, Amortización y Resumen por equipo no vuelve a procesar toda la base.
- Se eliminaron las pestañas activas de las dependencias de los useMemo pesados de RMA15, costo mensual, históricos y acumulados.
- El click de una pestaña sólo cambia la vista; no dispara nuevamente filtros y agrupaciones completas.
- Las categorías visibles se actualizan inmediatamente y la copia usada por Amortización/Resumen se sincroniza de forma diferida cuando el navegador está libre.
- La tabla Categorías por modelo usa filas memoizadas: al asignar un modelo sólo se vuelve a renderizar la fila modificada.
- Se mantiene crear, renombrar, eliminar, reasignar y restablecer categorías.
- Se actualizó la versión del Service Worker para evitar que la PWA conserve el JavaScript anterior.

## Validación

Se intentó ejecutar `npm run build`, pero el entorno disponible no contiene el binding nativo Linux de Rolldown (`@rolldown/binding-linux-x64-gnu`). El intento no modificó las dependencias ni el código entregado.
