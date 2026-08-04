let worker = null;
let requestId = 0;
const pending = new Map();

function rejectAll(error) {
  for (const { reject } of pending.values()) reject(error);
  pending.clear();
}

export function getInformeCostosWorker() {
  if (worker) return worker;

  worker = new Worker(
    new URL("../../../workers/informeCostos.worker.js", import.meta.url),
    { type: "module", name: "informe-costos-engine" },
  );

  worker.onmessage = ({ data }) => {
    const request = pending.get(data?.requestId);
    if (!request) return;
    pending.delete(data.requestId);
    if (data.ok) request.resolve(data.result);
    else request.reject(new Error(data.error || "Error del motor de Informe de Costos"));
  };

  worker.onerror = (event) => {
    const error = new Error(event?.message || "El motor de Informe de Costos dejó de responder");
    rejectAll(error);
    worker?.terminate();
    worker = null;
  };

  return worker;
}

export function informeCostosCommand(type, payload = {}, transfer = []) {
  const currentWorker = getInformeCostosWorker();
  const currentRequestId = ++requestId;

  return new Promise((resolve, reject) => {
    pending.set(currentRequestId, { resolve, reject, type });
    currentWorker.postMessage(
      { requestId: currentRequestId, type, payload },
      transfer,
    );
  });
}

export function terminateInformeCostosWorker() {
  if (!worker) return;
  worker.terminate();
  worker = null;
  rejectAll(new Error("Motor de Informe de Costos reiniciado"));
}
