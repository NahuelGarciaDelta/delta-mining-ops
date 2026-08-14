export function getDatasetVersion(source,record){
  return Number(source?.meta?.serverVersion||record?.data?.meta?.serverVersion||record?.version||0);
}

export function shouldDownloadDataset({source,record,serverVersion,force=false}){
  if(force)return true;
  if(!source?.ok||!Array.isArray(source.data))return true;
  const remote=Number(serverVersion||0);
  return remote<=0||getDatasetVersion(source,record)!==remote;
}

export function createRequestDeduper(){
  const pending=new Map();
  return {
    run(key,operation){
      if(pending.has(key))return pending.get(key);
      const task=Promise.resolve().then(operation).finally(()=>{if(pending.get(key)===task)pending.delete(key);});
      pending.set(key,task);
      return task;
    },
    has:key=>pending.has(key),
    clear:()=>pending.clear()
  };
}

export async function resolveDataset({cached,serverVersion,fetchDataset,force=false}){
  if(!shouldDownloadDataset({source:cached,serverVersion,force}))return{data:cached,from:"cache",stale:false};
  try{return{data:await fetchDataset(),from:"network",stale:false};}
  catch(error){
    if(cached?.ok&&Array.isArray(cached.data))return{data:cached,from:"cache",stale:true,error};
    throw error;
  }
}
