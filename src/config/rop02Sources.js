// Catálogo ROP02: punto único para registrar nuevos frentes en el frontend.
// Cada fuente debe tener su dataset correspondiente en Apps Script y Supabase.
// Nunca tratar una fuente sin registros como otra fuente existente.
export const ROP02_SOURCES=Object.freeze([
  {key:"rop02_fs",project:"FILO DEL SOL",label:"Filo del Sol"},
  {key:"rop02_jm",project:"JOSE MARIA",label:"José María"},
  {key:"rop02_filosur",project:"FILO SUR",label:"Filo Sur"},
  {key:"rop02_zorro",project:"EL ZORRO",label:"El Zorro"},
  {key:"rop02_fierro",project:"EL FIERRO",label:"El Fierro"},
].map(source=>Object.freeze({...source,prefix:`SRC|${source.key.toUpperCase()}|` })));
export const ROP02_SOURCE_KEYS=Object.freeze(ROP02_SOURCES.map(s=>s.key));
export const ROP02_SOURCE_MAP=Object.freeze(ROP02_SOURCES.map(s=>Object.freeze([s.key,s.project])));
export const ROP02_PREFIX=Object.freeze(Object.fromEntries(ROP02_SOURCES.map(s=>[s.key,s.prefix])));
export function rop02SourceFromKey(value){
  const key=String(value??"");
  return ROP02_SOURCES.find(source=>key.startsWith(source.prefix))?.key??"";
}
