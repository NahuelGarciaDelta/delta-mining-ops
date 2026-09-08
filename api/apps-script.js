const APPS_SCRIPT_TARGET="https://script.google.com/macros/s/AKfycbxU-ihsxXTNn2wa5EO1OkSM5FjJ43MwxSx8dY0RjbnJRFBKF0BiNNq7QsuohWxmmeOhog/exec";

export const config={
  maxDuration:60
};

export default async function handler(req,res){
  if(req.method!=="GET"){
    res.setHeader("Allow","GET");
    return res.status(405).json({ok:false,error:{message:"Método no permitido"}});
  }

  try{
    const target=new URL(APPS_SCRIPT_TARGET);
    for(const [key,value] of Object.entries(req.query||{})){
      if(Array.isArray(value))value.forEach(item=>target.searchParams.append(key,String(item)));
      else if(value!==undefined&&value!==null)target.searchParams.set(key,String(value));
    }

    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),55000);
    let upstream;
    try{
      upstream=await fetch(target.toString(),{
        method:"GET",
        redirect:"follow",
        cache:"no-store",
        signal:controller.signal,
        headers:{"accept":"application/json,text/plain,*/*"}
      });
    }finally{
      clearTimeout(timer);
    }

    const body=await upstream.text();
    res.setHeader("Cache-Control","no-store, max-age=0");
    res.setHeader("Content-Type",upstream.headers.get("content-type")||"application/json; charset=utf-8");
    return res.status(upstream.status).send(body);
  }catch(error){
    const timedOut=error?.name==="AbortError";
    return res.status(timedOut?504:502).json({
      ok:false,
      error:{message:timedOut?"Apps Script no respondió dentro de 55 segundos":String(error?.message||error)}
    });
  }
}
