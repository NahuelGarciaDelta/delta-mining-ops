// Catálogo ROP02: punto único para registrar nuevos frentes en el frontend.
// Cada fuente debe tener su dataset correspondiente en Apps Script y Supabase.
// Nunca tratar una fuente sin registros como otra fuente existente.
export const ROP02_SOURCES=[
  {key:"rop02_fs",project:"FILO DEL SOL",label:"Filo del Sol"},
  {key:"rop02_jm",project:"JOSE MARIA",label:"José María"},
  {key:"rop02_filosur",project:"FILO SUR",label:"Filo Sur"},
  {key:"rop02_zorro",project:"EL ZORRO",label:"El Zorro"},
  {key:"rop02_fierro",project:"EL FIERRO",label:"El Fierro"},
].map(source=>Object.freeze({...source,prefix:`SRC|${source.key.toUpperCase()}|` }));
export const ROP02_SOURCE_KEYS=ROP02_SOURCES.map(s=>s.key);
export const ROP02_SOURCE_MAP=ROP02_SOURCES.map(s=>Object.freeze([s.key,s.project]));
export const ROP02_PREFIX=Object.fromEntries(ROP02_SOURCES.map(s=>[s.key,s.prefix]));
export function rop02SourceFromKey(value){
  const key=String(value??"");
  return ROP02_SOURCES.find(source=>key.startsWith(source.prefix))?.key??"";
}

/**
 * Punto de entrada compartido para nuevas fuentes registradas en Supabase.
 * Mantiene referencias vivas a los arrays que ya usa la app y nunca altera
 * la identidad ni el proyecto de las cinco fuentes productivas existentes.
 */
export function registerRop02Source({dataset,project}={}) {
  const key=String(dataset??"").trim().toLowerCase();
  const projectName=String(project??"").trim().replace(/\s+/g," ").toUpperCase();
  if(!/^rop02_[a-z0-9_]{2,45}$/.test(key)||!projectName||projectName.length>90)return false;
  if(ROP02_SOURCE_KEYS.includes(key))return false;
  const prefix=`SRC|${key.toUpperCase()}|`;
  ROP02_SOURCES.push(Object.freeze({key,project:projectName,label:projectName,prefix}));
  ROP02_SOURCE_KEYS.push(key);
  ROP02_SOURCE_MAP.push(Object.freeze([key,projectName]));
  ROP02_PREFIX[key]=prefix;
  return true;
}
