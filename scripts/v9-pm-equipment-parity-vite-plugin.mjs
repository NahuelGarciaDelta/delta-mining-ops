// V9-only patch: PM identity ignores terminal -JM at lookup time, not in Sheets.
// The full active PM equipment set was already built from ROP02 with the
// selected date range. A second exact-code panel filter wrongly hid trucks.
export function v9PmEquipmentParityVitePlugin(){
 return {
  name:"v9-pm-equipment-parity",
  enforce:"pre",
  transform(source,id){
   const path=String(id||"").replace(/\\/g,"/").split("?")[0];
   if(!path.endsWith("/src/modules/mantenimiento/MantenimientoProgramadoView.jsx"))return null;
   // Canonicalize only equipment IDs: -JM is ignored for PM seed,
   // configuration lookup, ROP02 activity and deduplication, without changing
   // the stored code or the project label.
   const oldNorm='const norm = v => String(v ?? "").toUpperCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/[^A-Z0-9]+/g, "").trim();';
   const newNorm='const norm = v => String(v ?? "").toUpperCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/(\\d)(?:[-_\\s]?JM)$/i, "$1").replace(/[^A-Z0-9]+/g, "").trim();';
   if(!source.includes(oldNorm))throw Error("[v9-pm-parity] PM norm anchor missing");
   source=source.replace(oldNorm,newNorm);
   const codeOld="const raw = text(value).toUpperCase().replace(/\\s*\\(.*?\\)/g, '').trim();";
   const codeNew="const raw = text(value).toUpperCase().replace(/\\s*\\(.*?\\)/g, '').trim().replace(/(?<=\\d)(?:[-_\\s]?JM)$/i, '');";
   // Only replace the codeVariants helper, never unrelated input fields.
   const start=source.indexOf("const codeVariants = value => {");
   const stop=source.indexOf("const activityForCode =",start);
   if(start<0||stop<0)throw Error("[v9-pm-parity] codeVariants missing");
   const helper=source.slice(start,stop);
   if(!helper.includes(codeOld))throw Error("[v9-pm-parity] codeVariants raw input missing");
   let next=source.slice(0,start)+helper.replace(codeOld,codeNew)+source.slice(stop);
   const oldPanel="const panelVisibles = useMemo(() => visibles.filter(e => panelInternosActivos7Dias.has(norm(e.interno))), [visibles, panelInternosActivos7Dias]);";
   const newPanel="const panelVisibles = useMemo(() => visibles, [visibles]);";
   if(!next.includes(oldPanel))throw Error("[v9-pm-parity] exact code panel filter missing");
   next=next.replace(oldPanel,newPanel);
   return {code:next,map:null};
  }
 };
}
