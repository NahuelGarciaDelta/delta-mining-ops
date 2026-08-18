import {getRop02,getRop05,getRma15,refreshCommonHistoricalDatasets} from "../data/historicalDataService.js";

let preloadPromise=null;
let preloadDone=false;

export function isHistoricalPreloadReady(){return preloadDone;}

export function preloadHistoricalDatasets({force=false}={}){
  if(force){
    return refreshCommonHistoricalDatasets().then(results=>{
      preloadDone=results.some(result=>result.status==="fulfilled");
      return preloadDone;
    });
  }

  if(preloadDone)return Promise.resolve(true);
  if(preloadPromise)return preloadPromise;

  const common={limit:"all",offset:0,sortBy:"fecha",sortDirection:"desc"};
  preloadPromise=Promise.allSettled([
    getRop02(common),getRop05(common),getRma15(common)
  ]).then(results=>{
    preloadDone=results.some(result=>result.status==="fulfilled");
    return preloadDone;
  }).finally(()=>{if(!preloadDone)preloadPromise=null;});

  return preloadPromise;
}
