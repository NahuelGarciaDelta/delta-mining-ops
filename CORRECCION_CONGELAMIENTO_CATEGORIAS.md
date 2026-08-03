# Corrección del congelamiento al editar categorías

Se aisló completamente el editor de categorías del componente pesado `ViewCostosMant`.

## Cambios

- Cambiar la categoría de un modelo ya no actualiza el estado principal del Informe de Costos.
- Renombrar, crear o eliminar categorías se procesa dentro de un componente independiente.
- Los cambios se guardan inmediatamente en `localStorage` y en un snapshot en memoria.
- Amortización y Resumen por equipo sólo recalculan al volver a la subpestaña Amortización.
- Se evita ejecutar recorridos completos de RMA15, costo mensual, mano de obra y amortización en cada selección.
- Se actualizó el caché PWA.

## Build

Se intentó ejecutar `npm run build`. El código llegó hasta Vite, pero el entorno Linux no dispone del binding nativo `@rolldown/binding-linux-x64-gnu` porque el `node_modules` incluido originalmente fue instalado en Windows. En la PC de desarrollo, ejecutar `npm install` y `npm run build`.
