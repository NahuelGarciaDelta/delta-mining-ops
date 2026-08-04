import { handleInformeCostosCommand } from "../modules/informe-costos/engine/InformeCostosEngine.js";

self.onmessage=(event)=>{
  const {requestId,type,payload={}}=event.data||{};
  try{
    const result=handleInformeCostosCommand(type,payload);
    self.postMessage({requestId,ok:true,result});
  }catch(error){
    self.postMessage({requestId,ok:false,error:error?.message||String(error)});
  }
};
