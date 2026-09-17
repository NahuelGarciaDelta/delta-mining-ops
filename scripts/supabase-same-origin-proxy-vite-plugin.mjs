const TARGET='/src/services/supabaseReadApi.js';

function requiredReplace(source,from,to,label){
  if(!source.includes(from))throw new Error(`[delta-supabase-same-origin-proxy] No se encontró el ancla requerida: ${label}`);
  return source.replace(from,to);
}

export function supabaseSameOriginProxyVitePlugin(){
  return{
    name:'delta-supabase-same-origin-proxy',
    enforce:'pre',
    transform(code,id){
      if(!id.replace(/\\/g,'/').endsWith(TARGET))return null;
      let out=code;
      out=requiredReplace(
        out,
        `    const response=await fetch(\`${'${SUPABASE_URL}'}${'${path}'}\`,{\n      method,cache:"no-store",signal:controller?.signal,\n      headers:authHeaders({...(prefer?{Prefer:prefer}:{}),...(body!==null?{"Content-Type":"application/json"}:{})}),\n      body:body===null?undefined:JSON.stringify(body),\n    });`,
        `    const proxyUrl=\`/api/supabase-read?target=${'${encodeURIComponent(path)}'}\`;\n    const response=await fetch(proxyUrl,{\n      method,cache:"no-store",signal:controller?.signal,\n      headers:{Accept:"application/json",...(prefer?{"X-Delta-Supabase-Prefer":prefer}:{}),...(body!==null?{"Content-Type":"application/json"}:{})},\n      body:body===null?undefined:JSON.stringify(body),\n    });`,
        'fetch directo Supabase -> proxy Vercel'
      );
      if(!out.includes('/api/supabase-read?target='))throw new Error('[delta-supabase-same-origin-proxy] No quedó aplicado el proxy');
      return {code:out,map:null};
    }
  };
}
