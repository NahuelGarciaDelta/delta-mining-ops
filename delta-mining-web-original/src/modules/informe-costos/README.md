# Módulo Informe de Costos

Este módulo contiene la vista, motor, Worker persistente, cliente y hooks del Informe de Costos.

## Estructura

- `InformeCostosView.jsx`: interfaz completa extraída de `App.jsx`.
- `engine/InformeCostosEngine.js`: motor de cálculo fuera de React.
- `services/informeCostosWorkerClient.js`: cliente singleton del Worker.
- `hooks/useLatestWorkerRequest.js`: control de solicitudes obsoletas.
- `../../workers/informeCostos.worker.js`: router del Worker.

Durante la Etapa 1, las dependencias visuales y utilitarias compartidas se reciben mediante `deps`. En las siguientes etapas se moverán a módulos compartidos y se eliminará gradualmente ese puente.
