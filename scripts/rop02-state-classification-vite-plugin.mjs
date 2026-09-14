const normalizeId=id=>String(id||"").replace(/\\/g,"/").split("?")[0];

const DETECT_ESTADO_RE=/function detectEstado\(trabajo,obs,hs\)\{[\s\S]*?return"TRABAJO";\n\}/;
const OLD_CALL='estado:detectEstado(trabajo,obs,cantHs),';
const NEW_CALL='estado:detectEstado(trabajo,obs,cantHs,getValue(r,["estado","Estado","ESTADO"])),';

const NEW_DETECT_ESTADO=`function detectEstado(trabajo,obs,hs,estadoOriginal=""){
  // Si hubo horas efectivas, el parte representa trabajo realizado.
  const numericHours=Number(String(hs??0).replace(",","."));
  if(Number.isFinite(numericHours)&&numericHours>0)return"TRABAJO";

  // Con 0 h (o un código textual en Cant. Hs.) se conserva la clasificación
  // operativa FS / OD / EM usando todas las fuentes disponibles del parte.
  const normalizeStateText=value=>String(value??"")
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g,"")
    .toUpperCase()
    .replace(/\\s+/g," ")
    .trim();
  const text=normalizeStateText(\`${'${estadoOriginal} ${hs} ${trabajo} ${obs}'}\`);
  const hasCode=code=>new RegExp(\`(^|[^A-Z])${'${code}'}([^A-Z]|$)\`).test(text);

  if(hasCode("OD")||text.includes("A DISPOSICION")||text.includes("ORDEN DEL DIA"))return"OD";
  if(hasCode("FS")||text.includes("FUERA DE SERVICIO"))return"FS";
  if(hasCode("EM")||text.includes("EQUIPO EN MANTENIMIENTO")||text.includes("EN MANTENIMIENTO")||text.includes("MANTENIMIENTO"))return"EM";
  return"TRABAJO";
}`;

export function rop02StateClassificationVitePlugin(){
  return{
    name:"delta-rop02-state-classification",
    enforce:"pre",
    transform(code,id){
      const file=normalizeId(id);
      if(!file.endsWith("/src/shared/domain/index.jsx"))return null;

      if(!DETECT_ESTADO_RE.test(code)){
        throw new Error("[rop02-state] No se encontró la función detectEstado esperada en src/shared/domain/index.jsx");
      }
      if(!code.includes(OLD_CALL)&&!code.includes(NEW_CALL)){
        throw new Error("[rop02-state] No se encontró la llamada de normalización ROP02 esperada");
      }

      let next=code.replace(DETECT_ESTADO_RE,NEW_DETECT_ESTADO);
      next=next.replace(OLD_CALL,NEW_CALL);
      return{code:next,map:null};
    },
  };
}
