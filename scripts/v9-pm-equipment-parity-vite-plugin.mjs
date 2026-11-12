// V9-only patch: keep the fleet panel consistent with the PM dashboard.
// PM equipment identity itself must follow the original app's exact normalized
// key; suffix aliases are not merged when selecting PM_CONFIG baselines.
export function v9PmEquipmentParityVitePlugin(){
 return {
  name:"v9-pm-equipment-parity",
  enforce:"pre",
  transform(source,id){
   const path=String(id||"").replace(/\\/g,"/").split("?")[0];
   if(!path.endsWith("/src/modules/mantenimiento/MantenimientoProgramadoView.jsx"))return null;
   // Fail the V9 build if this component regresses to alias-merging PM keys.
   if(!source.includes("const norm = v => String(v ?? \"\").toUpperCase().normalize(\"NFD\")"))
     throw Error("[v9-pm-parity] original PM identity normalization missing");
   let next=source;
   const oldPanel="const panelVisibles = useMemo(() => visibles.filter(e => panelInternosActivos7Dias.has(norm(e.interno))), [visibles, panelInternosActivos7Dias]);";
   const newPanel="const panelVisibles = useMemo(() => visibles, [visibles]);";
   if(!next.includes(oldPanel))throw Error("[v9-pm-parity] exact code panel filter missing");
   next=next.replace(oldPanel,newPanel);
   return {code:next,map:null};
  }
 };
}
