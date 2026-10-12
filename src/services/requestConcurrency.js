// Shared concurrency budget across ALL large paged reads.
// Per-dataset limits alone can cause 4 sources x 4 pages = 16 parallel
// requests, saturating the small Supabase Free compute instance.
export function createRequestLimiter(maxConcurrent=5){
  const limit=Math.max(1,Math.floor(Number(maxConcurrent)||1));
  let active=0;
  const queue=[];
  return function limited(operation){
    return new Promise((resolve,reject)=>{
      const start=()=>{
        active++;
        Promise.resolve().then(operation).then(resolve,reject).finally(()=>{
          active--;
          const next=queue.shift();
          if(next)next();
        });
      };
      if(active<limit)start();
      else queue.push(start);
    });
  };
}
