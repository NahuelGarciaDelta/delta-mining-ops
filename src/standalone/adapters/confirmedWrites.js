// El formulario de acceso es el original de Delta OPS, pero su autenticación es V9.
import {loginV9,requestV9,saveSession,currentSession,refreshV9} from "../session.js";
export function newOperationId(){
  if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
  throw new Error("No se puede crear un identificador seguro.");
}
export async function requestAppsScript(url,payload,{timeoutMs=60000}={}){
  if(payload?.action==="authenticate_user"){
    const s=await loginV9(payload.email,payload.password);
    const result=await requestV9({action:"status"},s); // la API verifica token y rol en el servidor
    const p=result.profile||{};
    saveSession(s);
    const email=String(p.email||s.email||payload.email||"").toLowerCase();
    const user={
      email,
      rol:p.rol||"USUARIO",
      area:p.area||"OFICINA TECNICA",
      proyecto:p.proyecto||"TODO",
      nombre:p.nombre||email.split("@")[0]||"Usuario",
      authToken:s.access_token,
      token:s.access_token
    };
    return {ok:true,user,authToken:s.access_token,capabilities:{passwordHashProfile:"supabase-v9"},mustChangePassword:false};
  }

  let session=currentSession();
  if(!session?.access_token)throw new Error("V9_SESSION_REQUIRED");
  if(session.refresh_token&&Number(session.expires_at||0)*1000<Date.now()+60000)
    session=await refreshV9(session);

  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  const endpoint=String(url||"/api/v9-write");
  const send=token=>fetch(endpoint,{
    method:"POST",
    cache:"no-store",
    signal:controller.signal,
    headers:{
      "Content-Type":"application/x-www-form-urlencoded;charset=UTF-8",
      "Authorization":"Bearer "+token
    },
    body:new URLSearchParams({payload:JSON.stringify(payload)})
  });

  try{
    let response=await send(session.access_token);
    // Retry only after an explicit 401, before the relay accepts the operation.
    if(response.status===401&&session.refresh_token){
      session=await refreshV9(session);
      response=await send(session.access_token);
    }
    const result=await response.json().catch(()=>null);
    if(!result||typeof result.ok!=="boolean")
      throw new Error("Respuesta de confirmación inválida");
    if(!response.ok){
      const message=typeof result.error==="string"?result.error:result.error?.message;
      throw new Error(message||"HTTP "+response.status);
    }
    return result;
  }finally{
    clearTimeout(timer);
  }
}
