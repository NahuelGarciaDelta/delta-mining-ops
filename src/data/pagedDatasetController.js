export function createPagedDatasetController(fetchPage){
  let generation=0,state={rows:[],total:0,hasMore:false,nextOffset:0,loading:false};
  let appendPending=null;
  const request=async(dataset,params,append)=>{
    const token=append?generation:++generation;
    const offset=append?state.nextOffset??state.rows.length:0;
    state={...state,loading:true};
    try{
      const page=await fetchPage(dataset,{...params,limit:250,offset});
      if(token!==generation)return{...state,stale:true};
      const rows=append?[...state.rows,...(page.data||[])]:[...(page.data||[])];
      state={rows,total:Number(page.total??rows.length),hasMore:Boolean(page.hasMore),nextOffset:page.nextOffset,loading:false};
      return{...state,stale:false};
    }catch(error){
      if(token===generation)state={...state,loading:false};
      throw error;
    }
  };
  return{
    loadFirst:(dataset,params)=>request(dataset,params,false),
    loadMore:(dataset,params)=>{
      if(appendPending&&appendPending.generation===generation)return appendPending.promise;
      if(!state.hasMore||state.loading)return Promise.resolve({...state,stale:false});
      const token=generation;
      const promise=request(dataset,params,true);
      appendPending={generation:token,promise};
      promise.then(()=>{if(appendPending?.promise===promise)appendPending=null;},()=>{if(appendPending?.promise===promise)appendPending=null;});
      return promise;
    },
    reset:()=>{generation++;appendPending=null;state={rows:[],total:0,hasMore:false,nextOffset:0,loading:false};return{...state};},
    snapshot:()=>({...state})
  };
}
