import { handleInformeCostosCommand } from "../modules/informe-costos/engine/InformeCostosEngine.js";

self.onmessage=(event)=>{
  const {requestId,type,payload={}}=event.data||{};
  const startedAt=performance.now();
  try{
    const result=handleInformeCostosCommand(type,payload);
    self.postMessage({requestId,ok:true,result,perf:{workerMs:performance.now()-startedAt,type}});
  }catch(error){
    self.postMessage({requestId,ok:false,error:error?.message||String(error),perf:{workerMs:performance.now()-startedAt,type}});
  }
};
