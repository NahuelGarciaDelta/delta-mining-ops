# Refactorización Informe de Costos V2

## Arquitectura aplicada

El motor de cálculo dejó de vivir dentro del archivo del Web Worker y quedó separado de React:

- `src/modules/informe-costos/engine/InformeCostosEngine.js`
  - normalización y equivalencias;
  - costo mensual acumulado;
  - mano de obra;
  - amortización;
  - resumen por equipo;
  - actualización y renombrado de categorías;
  - caché en memoria del motor.
- `src/workers/informeCostos.worker.js`
  - router mínimo; no contiene lógica de negocio.
- `src/modules/informe-costos/services/informeCostosWorkerClient.js`
  - crea un único Worker persistente;
  - relaciona solicitudes y respuestas;
  - recupera el Worker si ocurre un error;
  - evita recrearlo en cada clic.
- `src/modules/informe-costos/hooks/useLatestWorkerRequest.js`
  - descarta respuestas antiguas cuando cambian filtros rápidamente;
  - mantiene visible el último resultado mientras se actualiza.

`App.jsx` ya no administra directamente el ciclo de vida del Worker. Usa el cliente centralizado mediante el mismo nombre de comando para conservar la funcionalidad existente.

## Compatibilidad

Se conservaron los comandos usados por la interfaz:

- `SET_MODEL_CATEGORY`
- `RENAME_CATEGORY`
- `PROCESS_AMORTIZATION_ROWS`
- `INIT_COST_MONTHLY_ENGINE`
- `QUERY_COST_MONTHLY`
- `PROCESS_MANO_OBRA`
- `PROCESS_RESUMEN_EQUIPO`

No se cambiaron las fórmulas ni las estructuras de respuesta.

## Dependencias

Se quitaron `latest` y la dependencia no utilizada `xlsx-js-style`. Se fijaron versiones estables de React 18, Vite 5, Recharts y XLSX.

## Validación realizada

Se validó con `node --check`:

- Worker;
- motor;
- cliente del Worker.

El build de Vite no pudo ejecutarse en el contenedor porque el registro npm interno no contiene `@vitejs/plugin-react` y el `node_modules` disponible pertenece a Vite 8 para Windows, sin el binding nativo Linux de Rolldown.

En una PC con acceso normal a npm ejecutar:

```bash
npm install
npm run build
npm run dev
```
