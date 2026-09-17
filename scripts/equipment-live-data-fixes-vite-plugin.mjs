const normalizeId=id=>String(id||"").replace(/\\/g,"/").split("?")[0];

const APP_TARGET="/src/App.jsx";
const PM_TARGET="/src/modules/mantenimiento/MantenimientoProgramadoView.jsx";

function requiredReplace(source,from,to,label){
  if(!source.includes(from))throw new Error(`[delta-equipment-live-data-fixes] No se encontró el ancla requerida: ${label}`);
  return source.replace(from,to);
}

function transformApp(code){
  let out=code;
  out=requiredReplace(
    out,
    '    const run=()=>{if(!cancelled)loadSources(VIEW_SOURCES[view]||[],{background:true});};',
    '    const criticalLiveView=view==="equipmentProfile"||String(view||"").startsWith("pm");\n    const run=()=>{if(!cancelled)loadSources(VIEW_SOURCES[view]||[],{background:true,force:criticalLiveView});};',
    "recarga fresca al entrar a Ficha Única/Mantenimiento Programado"
  );
  return out;
}

function transformPm(code){
  let out=code;
  out=requiredReplace(
    out,
    '  const interno = text(pick(row, ["Codigo nuevo", "Código nuevo", "Código de Drusila", "Codigo de Drusila", "Interno", "Código interno", "Codigo interno"]));',
    `  const internoCandidates = [\n    pick(row, ["Codigo nuevo", "Código nuevo"]),\n    pick(row, ["Código de Drusila", "Codigo de Drusila"]),\n    pick(row, ["Interno", "Código interno", "Codigo interno"]),\n  ];\n  const interno = internoCandidates.map(text).find(value => {\n    const key = norm(value);\n    return key && !["NA", "SD", "SINCODIGO", "SININTERNO", "NODISPONIBLE"].includes(key);\n  }) || "";`,
    "fallback Código nuevo -> Código Drusila en PM"
  );
  return out;
}

export function equipmentLiveDataFixesVitePlugin(){
  return {
    name:"delta-equipment-live-data-fixes",
    enforce:"pre",
    transform(code,id){
      const file=normalizeId(id);
      let next=null;
      if(file.endsWith(APP_TARGET))next=transformApp(code);
      else if(file.endsWith(PM_TARGET))next=transformPm(code);
      else return null;
      if(next===code)return null;
      return {code:next,map:null};
    }
  };
}
