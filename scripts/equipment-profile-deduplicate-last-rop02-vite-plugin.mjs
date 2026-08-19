const TARGET='/src/modules/equipment/EquipmentProfileView.jsx'

export function equipmentProfileDeduplicateLastRop02VitePlugin(){
  return{
    name:'delta-equipment-profile-deduplicate-last-rop02',
    enforce:'pre',
    transform(code,id){
      if(!id.replace(/\\/g,'/').endsWith(TARGET))return null
      let out=code
      const marker='Último registro ROP02:'
      const first=out.indexOf(marker)
      const last=out.lastIndexOf(marker)
      if(first<0||last<=first)return null

      // Los plugins históricos pueden dejar la leyenda vieja ("Sin registros") y
      // luego agregar la nueva con fecha. Conservamos siempre la última, que es la
      // consolidada y respeta aliases/filtros, y eliminamos el bloque JSX anterior.
      let start=out.lastIndexOf('{detailCode&&<div',first)
      let end=-1
      if(start>=0){
        end=out.indexOf('</div>}',first)
        if(end>=0)end+='</div>}'.length
      }
      if(start<0||end<0){
        start=out.lastIndexOf('<div',first)
        end=out.indexOf('</div>',first)
        if(end>=0)end+='</div>'.length
      }
      if(start>=0&&end>start)out=out.slice(0,start)+out.slice(end)
      return out===code?null:{code:out,map:null}
    }
  }
}
