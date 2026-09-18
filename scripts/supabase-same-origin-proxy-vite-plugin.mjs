const TARGET='/src/services/supabaseReadApi.js';

function requiredReplace(source,pattern,replacement,label){
  if(!pattern.test(source))throw new Error(`[delta-supabase-same-origin-proxy] No se encontró el ancla requerida: ${label}`);
  return source.replace(pattern,replacement);
}

export function supabaseSameOriginProxyVitePlugin(){
  let command='build';
  return{
    name:'delta-supabase-same-origin-proxy',
    enforce:'pre',
    configResolved(config){
      command=config.command;
    },
    transform(code,id){
      if(!id.replace(/\\/g,'/').endsWith(TARGET))return null;

      // En desarrollo local Vite no dispone de las funciones /api de Vercel.
      // Supabase admite la lectura directa con la publishable/anon key, por lo
      // que no debemos reescribir estas llamadas durante `npm run dev`.
      if(command==='serve')return null;

      if(code.includes('/api/supabase-read?target='))return null;

      let out=code;
      out=requiredReplace(
        out,
        /const\s+response\s*=\s*await\s+fetch\(\s*`\$\{SUPABASE_URL\}\$\{path\}`\s*,\s*\{/,
        `const proxyUrl=\`/api/supabase-read?target=\${encodeURIComponent(path)}\`;\n    const response=await fetch(proxyUrl,{`,
        'fetch directo Supabase -> proxy Vercel'
      );

      out=requiredReplace(
        out,
        /headers\s*:\s*authHeaders\(\{\s*\.\.\.\(prefer\?\{Prefer:prefer\}:\{\}\),\s*\.\.\.\(body!==null\?\{"Content-Type":"application\/json"\}:\{\}\)\s*\}\),/,
        `headers:{Accept:"application/json",...(prefer?{"X-Delta-Supabase-Prefer":prefer}:{}),...(body!==null?{"Content-Type":"application/json"}:{})},`,
        'headers Supabase -> headers proxy Vercel'
      );

      if(!out.includes('/api/supabase-read?target='))throw new Error('[delta-supabase-same-origin-proxy] No quedó aplicado el proxy');
      return {code:out,map:null};
    }
  };
}
