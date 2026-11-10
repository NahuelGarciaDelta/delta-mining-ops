// V9 reads all original ROP02 sheets before mounting the operational views.
// Never replace that complete universe with an independently filtered/partial
// historical snapshot (which intentionally omits CTA and truck codes for the
// original application's welcome dashboard).
const TARGET_OFFICE="/src/modules/oficina-tecnica/OficinaTecnicaModule.jsx";
const TARGET_ROUTE="/src/modules/oficina-tecnica/OficinaTecnicaRoute.jsx";

export function v9UnifiedControlSourcesVitePlugin(){
 return {
  name:"v9-unified-control-sources",
  enforce:"pre",
  transform(source,id){
   const path=String(id||"").replace(/\\/g,"/").split("?")[0];
   if(path.endsWith(TARGET_OFFICE)){
    const start=source.indexOf("function ViewAtrasoROP02({rop02All,onLegacyFallback}){");
    const boundary="  const atrasoSource=remoteRop02||rop02All;";
    const end=start<0?-1:source.indexOf(boundary,start);
    if(start<0||end<0)throw Error("[v9-unified-control] Atraso source block missing");
    const replacement="function ViewAtrasoROP02({rop02All,onLegacyFallback}){\n  const atrasoSource=rop02All;";
    const next=source.slice(0,start)+replacement+source.slice(end+boundary.length);
    return {code:next,map:null};
   }
   if(path.endsWith(TARGET_ROUTE)){
    const begin='  useEffect(()=>{\n  if(!controlErrorsView)return;\n  let active=true;\n  refreshHistoricalDataset("rop02",historicalQuery)';
    const endMarker=' },[controlErrorsView,historicalQuery,assignedProjectsKey]);';
    const start=source.indexOf(begin);
    const end=start<0?-1:source.indexOf(endMarker,start);
    if(start<0||end<0)throw Error("[v9-unified-control] Control errors remote refresh block missing");
    // Preserve hook order while skipping an unnecessary second full ROP02 read.
    const next=source.slice(0,start)+"  useEffect(()=>{},[controlErrorsView,historicalQuery,assignedProjectsKey]);"+source.slice(end+endMarker.length);
    return {code:next,map:null};
   }
   return null;
  }
 };
}
