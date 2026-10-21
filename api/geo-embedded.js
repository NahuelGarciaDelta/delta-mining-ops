const GEO_SOURCE = "https://delta-geo.vercel.app/";
const HEAD_SCRIPT = '<style id="dm-geo-embedded-css">#login-modal,#auth-button{display:none!important}</style>';
const BRIDGE_SCRIPT = String.raw`<script>
(()=> {
 if(window.parent===window)return;
 const ORIGIN=window.location.origin;
 const overlay=document.createElement('div');
 overlay.id='geo-sso-overlay';
 overlay.style.cssText='position:fixed;inset:0;background:rgba(8,22,32,.90);z-index:9999999;display:flex;align-items:center;justify-content:center;padding:24px;font:600 16px Inter,Arial,sans-serif;color:#d8f7ee;text-align:center';
 overlay.textContent='Conectando con tu sesión de DELTA Mining OPS…';
 document.body.appendChild(overlay);
 let finished=false;
 const requestAccess=()=>{if(!finished)window.parent.postMessage({type:'DM_GEO_SSO_READY'},ORIGIN)};
 const timer=setInterval(requestAccess,1800); requestAccess();
 window.addEventListener('message',async ev=>{
   if(ev.source!==window.parent || ev.origin!==ORIGIN || finished)return;
   if(ev.data?.type==='DM_GEO_SSO_FAILED'){
     finished=true;clearInterval(timer);overlay.textContent='No se pudo validar el acceso automático. Volvé a DELTA Mining OPS.';
     return;
   }
   if(ev.data?.type!=='DM_GEO_SSO_TOKEN' || typeof ev.data.tokenHash!=='string')return;
   finished=true;clearInterval(timer);
   try{
     if(!client)throw Error('Conexión GEO no disponible');
     const result=await client.auth.verifyOtp({token_hash:ev.data.tokenHash,type:'magiclink'});
     if(result.error||!result.data?.session)throw (result.error||Error('Sesión no confirmada'));
     user=result.data.user;
     await loadData();
     closeModal('login-modal');
     document.querySelector('#environment-label').textContent='DATOS REALES · DELTA GEO';
     document.querySelector('#sync-label').textContent='Acceso desde DELTA Mining OPS';
     renderAll();
     overlay.remove();
     window.parent.postMessage({type:'DM_GEO_SSO_SUCCESS'},ORIGIN);
   }catch(e){
     overlay.textContent='No se pudo habilitar GEO con tu sesión de OPS.';
     window.parent.postMessage({type:'DM_GEO_SSO_FAILED'},ORIGIN);
   }
 });
})();
</script>`;
export const config = { maxDuration: 25 };
export default async function handler(req,res) {
 if(req.method!=="GET")return res.status(405).json({error:"method_not_allowed"});
 let upstream;
 try {
   const controller=new AbortController();
   const timer=setTimeout(()=>controller.abort(),15000);
   try{upstream=await fetch(GEO_SOURCE,{cache:"no-store",signal:controller.signal,headers:{accept:"text/html"}})}
   finally{clearTimeout(timer)}
 }catch{ return res.status(502).send("No se pudo cargar DELTA GEO"); }
 if(!upstream.ok)return res.status(502).send("DELTA GEO no está disponible");
 const input=await upstream.text();
 if(!input.startsWith("<!doctype html>") || !input.includes("const client =") || !input.includes("</body>")) return res.status(502).send("Versión GEO incompatible");
 const html=input
    .replace("</head>",HEAD_SCRIPT+"</head>")
    .replace("persistSession:true","persistSession:false")
    .replace("</body>",BRIDGE_SCRIPT+"</body>");
 res.setHeader("content-type","text/html; charset=utf-8");
 res.setHeader("cache-control","public, s-maxage=300, stale-while-revalidate=600");
 res.setHeader("X-Content-Type-Options","nosniff");
 return res.status(200).send(html);
}