# Informe de Costos

El módulo separa el motor de cálculo del hilo principal de React.

- `engine/InformeCostosEngine.js`: cálculos puros y caché en memoria.
- `workers/informeCostos.worker.js`: router mínimo del Web Worker.
- `services/informeCostosWorkerClient.js`: Worker persistente y correlación de respuestas.
- `hooks/useLatestWorkerRequest.js`: descarta respuestas obsoletas al cambiar filtros.

React no importa el motor directamente. Toda operación pesada debe enviarse por
`informeCostosCommand`, evitando volver a serializar las fuentes al cambiar de pestaña.
