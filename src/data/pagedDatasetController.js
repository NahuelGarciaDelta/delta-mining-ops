export function createPagedDatasetController(fetchPage){
  let generation=0,state={rows:[],total:0,hasMore:false,nextOffset:0,loading:false};
  const request=async(dataset,params,append)=>{
    const token=append?generation:++generation;
    const offset=append?state.nextOffset||state.rows.length:0;
    state={...state,loading:true};
    const page=await fetchPage(dataset,{...params,limit:250,offset});
    if(token!==generation)return{...state,stale:true};
    const rows=append?[...state.rows,...(page.data||[])]:[...(page.data||[])];
    state={rows,total:Number(page.total||rows.length),hasMore:Boolean(page.hasMore),nextOffset:page.nextOffset,loading:false};
    return{...state,stale:false};
  };
  return{
    loadFirst:(dataset,params)=>request(dataset,params,false),
    loadMore:(dataset,params)=>state.hasMore?request(dataset,params,true):Promise.resolve({...state,stale:false}),
    reset:()=>{generation++;state={rows:[],total:0,hasMore:false,nextOffset:0,loading:false};return{...state};},
    snapshot:()=>({...state})
  };
}
