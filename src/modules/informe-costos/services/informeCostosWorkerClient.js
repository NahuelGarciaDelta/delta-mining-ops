import { diagCount, diagEvent, diagTiming } from "./informeCostosDiagnostics.js";
let worker = null;
let requestId = 0;
const pending = new Map();
const inFlight = new Map();

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
    const receivedByReactAt = performance.timeOrigin + performance.now();
    const request = pending.get(data?.requestId);
    if (!request) return;
    pending.delete(data.requestId);
    const roundTripMs = performance.now() - request.startedAt;
    diagTiming(`Worker · ${request.type}`, roundTripMs, {
      workerMs: Number(data?.perf?.workerMs || 0),
      payloadBytes: request.payloadBytes,
      postToWorkerReceiveMs:Math.max(0,Number(data?.perf?.receivedAt||0)-request.postedAt),
      workerResponseToReactMs:Math.max(0,receivedByReactAt-Number(data?.perf?.responseSentAt||receivedByReactAt)),
    });
    if(data?.perf?.receivedAt)diagTiming(`Cola · ${request.type}`,Math.max(0,Number(data.perf.receivedAt)-request.postedAt));
    if(data?.perf?.responseSentAt)diagTiming(`Entrega · ${request.type}`,Math.max(0,receivedByReactAt-Number(data.perf.responseSentAt)));
    if (data?.perf?.workerMs != null) {
      diagTiming(`Motor · ${request.type}`, Number(data.perf.workerMs), { requestId: data.requestId });
    }
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
  let serializedPayload="";
  try { serializedPayload=JSON.stringify(payload); } catch (_) {}
  const requestKey=transfer.length?"":`${type}|${serializedPayload}`;
  if(requestKey&&inFlight.has(requestKey)){
    diagCount(`Solicitudes Worker deduplicadas · ${type}`);
    return inFlight.get(requestKey);
  }
  const command=new Promise((resolve, reject) => {
    const payloadBytes = serializedPayload.length;
    const startedAt=performance.now();
    const postedAt=performance.timeOrigin+startedAt;
    pending.set(currentRequestId, { resolve, reject, type, startedAt, postedAt, payloadBytes });
    diagCount(`Solicitudes Worker · ${type}`);
    diagEvent(`Enviado al Worker · ${type}`, { payloadBytes });
    currentWorker.postMessage(
      { requestId: currentRequestId, type, payload },
      transfer,
    );
  });
  if(!requestKey)return command;
  const tracked=command.finally(()=>{
    if(inFlight.get(requestKey)===tracked)inFlight.delete(requestKey);
  });
  inFlight.set(requestKey,tracked);
  return tracked;
}

export function terminateInformeCostosWorker() {
  if (!worker) return;
  worker.terminate();
  worker = null;
  inFlight.clear();
  rejectAll(new Error("Motor de Informe de Costos reiniciado"));
}
