const TARGET='/src/modules/equipment/EquipmentProfileView.jsx'

export function equipmentProfileDeduplicateLastRop02VitePlugin(){
  return{
    name:'delta-equipment-profile-deduplicate-last-rop02',
    enforce:'pre',
    transform(code,id){
      if(!id.replace(/\\/g,'/').endsWith(TARGET))return null
      let out=code

      // Inyecta una limpieza en runtime porque algunos plugins históricos agregan
      // la leyenda vieja después de otras transformaciones. Conservamos siempre
      // la línea nueva con clase dm-last-rop02-header y ocultamos únicamente la
      // variante obsoleta "Último registro ROP02: Sin registros".
      const hook='  const {movements:sharedMovements}=useEquipmentMovements(rop02All,["equipmentProfile"]);'
      if(out.includes(hook)&&!out.includes('dm-runtime-last-rop02-dedupe')){
        out=out.replace(hook,hook+`\n  // dm-runtime-last-rop02-dedupe\n  useEffect(()=>{\n    const raf=requestAnimationFrame(()=>{\n      const root=document.querySelector('.dm-equipment-profile .dm-equipment-header');\n      if(!root)return;\n      const keep=root.querySelector('.dm-last-rop02-header');\n      if(!keep)return;\n      for(const el of root.querySelectorAll('div')){\n        if(el===keep||el.contains(keep))continue;\n        const text=String(el.textContent||'').trim().replace(/\\s+/g,' ');\n        if(text==='Último registro ROP02: Sin registros')el.style.display='none';\n      }\n    });\n    return()=>cancelAnimationFrame(raf);\n  });`)
      }

      return out===code?null:{code:out,map:null}
    }
  }
}
