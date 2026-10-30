// El formulario de acceso es el original de Delta OPS, pero su autenticación es V9.
import {loginV9,requestV9,saveSession} from "../session.js";
export function newOperationId(){
  if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
  throw new Error("No se puede crear un identificador seguro.");
}
export async function requestAppsScript(_url,payload){
  if(payload?.action!=="authenticate_user")
    throw new Error("V9_READ_ONLY: escrituras deshabilitadas hasta validar Apps Script V9.");
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
