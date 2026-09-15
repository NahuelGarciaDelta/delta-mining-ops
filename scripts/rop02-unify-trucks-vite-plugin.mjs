const normalizeId=id=>String(id||"").replace(/\\/g,"/").split("?")[0];

const DOMAIN_FILE="/src/shared/domain/index.jsx";
const OFFICE_FILE="/src/modules/oficina-tecnica/OficinaTecnicaModule.jsx";

function requiredReplace(source,from,to,label){
  if(!source.includes(from))throw new Error(`[delta-rop02-unify-trucks] No se encontró el ancla requerida: ${label}`);
  return source.replace(from,to);
}

function requiredReplaceAll(source,from,to,label,minCount=1){
  const count=source.split(from).length-1;
  if(count<minCount)throw new Error(`[delta-rop02-unify-trucks] Se esperaban al menos ${minCount} coincidencias para ${label} y se encontraron ${count}`);
  return source.split(from).join(to);
}

function transformDomain(code){
  const oldFn=`function isRop02ControlMachineExcluded(maquina){
  const raw=String(maquina||"").trim().toUpperCase();
  const compact=raw.replace(/[^A-Z0-9]/g,"");
  const norm=normalizeMachineCode(raw);
  return norm==="CAA-0002" || compact==="CAA0002" || /^CAA[-_\\s]*0002(?:[-_\\s]*JM)?$/i.test(raw);
}`;
  return requiredReplace(
    code,
    oldFn,
    'function isRop02ControlMachineExcluded(_maquina){return false;}',
    "exclusión especial CAA-0002"
  );
}

function transformOffice(code){
  let out=code;

  out=requiredReplace(
    out,
    '  const machine=row.maquina||row._internoRaw||"";\n  if((typeof isRop02ControlMachineExcluded==="function"&&isRop02ControlMachineExcluded(machine))||(typeof normalizeMachineCode==="function"&&normalizeMachineCode(machine)==="CAA-0002"))return false;\n',
    '',
    "exclusión CAA-0002 del universo horario"
  );

  const oldControlRows=`  const rop02ControlRows=useMemo(()=>rop02Prod.filter(r=>{
    const m=String(r.maquina||"").trim();
    return !/^CAA[-_\\s]*0002(?:[-_\\s]*JM)?$/i.test(m) && normalizeMachineCode(m)!=="CAA-0002";
  }),[rop02Prod]);`;
  out=requiredReplaceAll(
    out,
    oldControlRows,
    '  const rop02ControlRows=useMemo(()=>rop02Prod,[rop02Prod]);',
    "filtros especiales CAA-0002 en controles ROP02",
    2
  );

  if(out.includes('normalizeMachineCode(m)!=="CAA-0002"')||out.includes('normalizeMachineCode(machine)==="CAA-0002"')){
    throw new Error("[delta-rop02-unify-trucks] Quedó una exclusión especial de CAA-0002 en Oficina Técnica");
  }
  return out;
}

export function rop02UnifyTrucksVitePlugin(){
  return {
    name:"delta-rop02-unify-trucks",
    enforce:"pre",
    transform(code,id){
      const file=normalizeId(id);
      let next=null;
      if(file.endsWith(DOMAIN_FILE))next=transformDomain(code);
      else if(file.endsWith(OFFICE_FILE))next=transformOffice(code);
      else return null;
      if(next===code)return null;
      return {code:next,map:null};
    }
  };
}
