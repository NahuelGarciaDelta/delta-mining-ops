const DOMAIN_FILE_RE = /[\\/]src[\\/]shared[\\/]domain[\\/]index\.jsx$/;

const BEFORE_ROP02 = 'const productivos=(rop02All||[]).filter(r=>r.proyecto!=="EL ZORRO"&&!esNoProductivo(r.estado)&&!r._excluded);';
const AFTER_ROP02 = 'const productivos=(rop02All||[]).filter(r=>r.proyecto!=="EL ZORRO"&&Number(r.horas)>0&&!esNoProductivo(r.estado)&&!r._excluded);';

const BEFORE_ROP05 = 'const prod05=(rop05||[]).filter(r=>!r._excluded);';
const AFTER_ROP05 = 'const prod05=(rop05||[]).filter(r=>Number(r.horas)>0&&!r._excluded);';

export function rop02Rop05PositiveHoursVitePlugin(){
  return {
    name:'delta-rop02-rop05-positive-hours',
    enforce:'pre',
    transform(code,id){
      if(!DOMAIN_FILE_RE.test(id))return null;
      if(!code.includes(BEFORE_ROP02) || !code.includes(BEFORE_ROP05)){
        throw new Error('No se encontró la lógica esperada de calcControl para aplicar el criterio horas > 0.');
      }
      return {
        code:code.replace(BEFORE_ROP02,AFTER_ROP02).replace(BEFORE_ROP05,AFTER_ROP05),
        map:null,
      };
    },
  };
}
