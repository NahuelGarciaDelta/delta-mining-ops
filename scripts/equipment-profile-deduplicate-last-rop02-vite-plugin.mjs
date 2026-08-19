const TARGET='/src/modules/equipment/EquipmentProfileView.jsx'

export function equipmentProfileDeduplicateLastRop02VitePlugin(){
  return{
    name:'delta-equipment-profile-deduplicate-last-rop02',
    enforce:'pre',
    transform(code,id){
      if(!id.replace(/\\/g,'/').endsWith(TARGET))return null
      let out=code

      // La fecha del último ROP02 ya no debe mostrarse en el encabezado de la ficha.
      // Otros datos derivados del último registro (proyecto, estado, etc.) siguen intactos.
      const hook='  const {movements:sharedMovements}=useEquipmentMovements(rop02All,["equipmentProfile"]);'
      if(out.includes(hook)&&!out.includes('dm-runtime-hide-last-rop02')){
        out=out.replace(hook,hook+`\n  // dm-runtime-hide-last-rop02\n  useEffect(()=>{\n    const hide=()=>{\n      const root=document.querySelector('.dm-equipment-profile .dm-equipment-header');\n      if(!root)return;\n      const explicit=root.querySelector('.dm-last-rop02-header');\n      if(explicit)explicit.style.display='none';\n      for(const el of root.querySelectorAll('div')){\n        if(el.children.length)continue;\n        const text=String(el.textContent||'').trim().replace(/\\s+/g,' ');\n        if(/^Último registro ROP02:/i.test(text))el.style.display='none';\n      }\n    };\n    const raf=requestAnimationFrame(hide);\n    const timer=setTimeout(hide,100);\n    return()=>{cancelAnimationFrame(raf);clearTimeout(timer);};\n  });`)
      }

      return out===code?null:{code:out,map:null}
    }
  }
}
