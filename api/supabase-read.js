const SUPABASE_URL=String(process.env.VITE_SUPABASE_URL||"https://jwfocqaxlckuxoklwyxs.supabase.co").replace(/\/+$/,"");
const SUPABASE_KEY=String(process.env.VITE_SUPABASE_ANON_KEY||"sb_publishable_XZAcQcWEDdgtZY_NWADy1g_HxoV0UZ2").trim();

export const config={maxDuration:30};

const ALLOWED_TABLES=new Set(["rop02_frontend","rop02","rop05","rma15_frontend","lista_equipos","insumos"]);
const ALLOWED_RPCS=new Set(["delta_source_versions","app_pm_snapshot"]);

function allowedTarget(raw){
  const value=String(raw||"").trim();
  if(!value.startsWith("/rest/v1/"))return false;
  const relative=value.slice("/rest/v1/".length).split("?")[0];
  if(relative.startsWith("rpc/"))return ALLOWED_RPCS.has(relative.slice(4));
  return ALLOWED_TABLES.has(relative);
}

export default async function handler(req,res){
  if(req.method!=="GET"&&req.method!=="POST"){
    res.setHeader("Allow","GET, POST");
    return res.status(405).json({ok:false,error:{message:"Método no permitido"}});
  }
  const targetPath=String(req.query?.target||"");
  if(!allowedTarget(targetPath))return res.status(400).json({ok:false,error:{message:"Consulta Supabase no permitida"}});
  if(req.method==="POST"&&!targetPath.startsWith("/rest/v1/rpc/"))return res.status(405).json({ok:false,error:{message:"Sólo se permiten POST a RPC de lectura"}});

  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),25000);
  try{
    const headers={
      apikey:SUPABASE_KEY,
      Authorization:`Bearer ${SUPABASE_KEY}`,
      Accept:"application/json",
    };
    const prefer=String(req.headers["x-delta-supabase-prefer"]||"").trim();
    if(prefer)headers.Prefer=prefer;
    let body;
    if(req.method==="POST"){
      headers["Content-Type"]="application/json";
      body=typeof req.body==="string"?req.body:JSON.stringify(req.body||{});
    }
    const upstream=await fetch(`${SUPABASE_URL}${targetPath}`,{method:req.method,headers,body,cache:"no-store",signal:controller.signal});
    const text=await upstream.text();
    res.setHeader("Cache-Control","no-store, max-age=0");
    res.setHeader("Content-Type",upstream.headers.get("content-type")||"application/json; charset=utf-8");
    const contentRange=upstream.headers.get("content-range");
    if(contentRange)res.setHeader("Content-Range",contentRange);
    res.setHeader("X-Delta-Supabase-Proxy","1");
    return res.status(upstream.status).send(text);
  }catch(error){
    const timedOut=error?.name==="AbortError";
    return res.status(timedOut?504:502).json({ok:false,error:{message:timedOut?"Supabase no respondió al proxy dentro de 25 segundos":String(error?.message||error||"No se pudo contactar Supabase")}});
  }finally{
    clearTimeout(timer);
  }
}
