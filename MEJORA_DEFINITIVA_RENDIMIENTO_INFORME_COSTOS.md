# Mejora definitiva de rendimiento - Informe de Costos

Se implementaron tres cambios estructurales para evitar bloqueos de la interfaz:

1. **Web Worker** (`src/workers/informeCostos.worker.js`)
   - Calcula fuera del hilo principal la tabla base de costos.
   - Calcula Costo mensual acumulado y su variante para Mano de Obra.
   - Aplica cambios de categorías sobre filas de Amortización sin recalcular RMA15 en React.

2. **Caché persistente en IndexedDB** (`src/services/informeCostosCache.js`)
   - Al abrir Informe de Costos se muestra el último resultado disponible.
   - El Worker actualiza los datos en segundo plano.
   - Las categorías también se guardan de forma asíncrona.

3. **Recálculo incremental**
   - Cambiar o renombrar categorías no vuelve a recorrer RMA15.
   - Al regresar a Amortización, sólo se recategorizan las filas ya calculadas.
   - Mano de Obra, Costo mensual y la tabla base reutilizan resultados del Worker.

Se actualizó el caché PWA a `delta-mining-ops-v10-costos-worker-idb`.

## Validación

Los archivos JS nuevos fueron validados con `node --check`.
El build completo se intentó, pero el entorno no dispone del binding nativo Linux de Rolldown requerido por Vite 8. En una PC con las dependencias instaladas ejecutar:

```bash
npm install
npm run build
npm run dev
```
