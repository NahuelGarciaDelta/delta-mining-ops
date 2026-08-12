import { handleInformeCostosCommand } from "../modules/informe-costos/engine/InformeCostosEngine.js";

self.onmessage=(event)=>{
  const {requestId,type,payload={}}=event.data||{};
  const receivedAt=performance.timeOrigin+performance.now();
  const startedAt=performance.now();
  try{
    const result=handleInformeCostosCommand(type,payload);
    const finishedAt=performance.timeOrigin+performance.now();
    self.postMessage({requestId,ok:true,result,perf:{receivedAt,calculationStartedAt:performance.timeOrigin+startedAt,calculationFinishedAt:finishedAt,responseSentAt:finishedAt,workerMs:performance.now()-startedAt,type}});
  }catch(error){
    const finishedAt=performance.timeOrigin+performance.now();
    self.postMessage({requestId,ok:false,error:error?.message||String(error),perf:{receivedAt,calculationStartedAt:performance.timeOrigin+startedAt,calculationFinishedAt:finishedAt,responseSentAt:finishedAt,workerMs:performance.now()-startedAt,type}});
  }
};
