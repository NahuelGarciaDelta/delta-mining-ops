# Optimización de render — Informe de Costos

## Diagnóstico confirmado

El motor del Web Worker tardaba menos de 10 ms en la mayoría de las operaciones, mientras que `InformeCostosView` registraba commits de entre 2,3 y 3,2 segundos y 136 renders.

## Cambios aplicados

1. Los cálculos de Amortización se ejecutan únicamente cuando está visible **Amortización** o **Resumen por equipo**.
2. El Worker de Resumen por equipo solo se solicita cuando está visible esa pestaña.
3. Al volver a Mano de Obra o Costo mensual no se vuelven a procesar Amortización y Resumen ocultos.
4. Se agregó comparación semántica de los datasets recibidos. Los ciclos de sincronización que crean arrays nuevos pero con los mismos datos ya no vuelven a renderizar todo el módulo.
5. La comparación usa un fingerprint completo por array, cacheado con `WeakMap`, para detectar cambios reales sin recalcularlo varias veces.
6. Se actualizó la versión del caché PWA.

## Validación

Se verificó la sintaxis de los archivos modificados por inspección y el Worker con `node --check`. El build completo no pudo ejecutarse en este entorno porque el registro npm disponible no contiene `@vitejs/plugin-react@4.3.4`.

## Prueba recomendada

1. Cerrar completamente la PWA instalada.
2. Publicar esta versión y volver a abrirla.
3. Reiniciar el panel de diagnóstico.
4. Abrir Mano de Obra, Amortización y Resumen.
5. Esperar al menos 20 segundos en cada pestaña para confirmar que la sincronización periódica no dispara nuevos commits de varios segundos.
