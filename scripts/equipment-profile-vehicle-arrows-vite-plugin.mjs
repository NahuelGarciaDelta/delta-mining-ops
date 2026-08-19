const PROFILE='/src/modules/equipment/EquipmentProfileView.jsx'
const ROUTE='/src/modules/oficina-tecnica/OficinaTecnicaRoute.jsx'

export function equipmentProfileVehicleArrowsVitePlugin(){
  return{
    name:'delta-equipment-profile-vehicle-arrows',
    enforce:'post',
    transform(code,id){
      const path=id.replace(/\\/g,'/')
      let out=code
      if(path.endsWith(PROFILE)){
        // Navegación por teclado: izquierda/derecha recorre la lista visible de equipos.
        if(!out.includes('dm-equipment-arrow-navigation')){
          const marker='  const selectedOption=allCodes.find(o=>o.key===detailKey)||allCodes.find(o=>canonicalEquipmentCode(o.value)===detailKey);'
          if(out.includes(marker))out=out.replace(marker,`${marker}\n  // dm-equipment-arrow-navigation\n  useEffect(()=>{\n    const onKeyDown=(event)=>{\n      if(event.key!=="ArrowLeft"&&event.key!=="ArrowRight")return;\n      const tag=String(event.target?.tagName||"").toUpperCase();\n      if(["INPUT","TEXTAREA","SELECT"].includes(tag)||event.target?.isContentEditable)return;\n      const list=(typeof visibleCodes!=="undefined"&&Array.isArray(visibleCodes)?visibleCodes:allCodes)||[];\n      if(!list.length)return;\n      const currentKey=canonicalEquipmentCode(selectedOption?.value||selected);\n      let idx=list.findIndex(o=>canonicalEquipmentCode(o.value)===currentKey);\n      if(idx<0)idx=0;\n      const nextIdx=event.key==="ArrowRight"?Math.min(list.length-1,idx+1):Math.max(0,idx-1);\n      if(nextIdx===idx)return;\n      event.preventDefault();\n      const next=list[nextIdx];\n      setSelected(cleanEquipmentCode(next.value));\n      onSelectCode?.(cleanEquipmentCode(next.value));\n    };\n    window.addEventListener("keydown",onKeyDown);\n    return()=>window.removeEventListener("keydown",onKeyDown);\n  },[selected,selectedOption,allCodes,typeof visibleCodes!=="undefined"?visibleCodes:null,onSelectCode]);`)
        }
      }
      if(path.endsWith(ROUTE)&&!out.includes('dm-daily-date-arrow-navigation')){
        const marker='  useEffect(()=>{if(props?.view!=="tallerCentral")setTallerTab("RESUMEN");},[props?.view]);'
        if(out.includes(marker))out=out.replace(marker,`${marker}\n\n  // dm-daily-date-arrow-navigation: en Equipos/Vehículos, ←/→ cambia un día.\n  useEffect(()=>{\n    const dailyViews=new Set(["listaEquipos","equipos","vehiculos","listaVehiculos","vehiculosROP02"]);\n    if(!dailyViews.has(props?.view))return;\n    const onKeyDown=(event)=>{\n      if(event.key!=="ArrowLeft"&&event.key!=="ArrowRight")return;\n      const tag=String(event.target?.tagName||"").toUpperCase();\n      if(["INPUT","TEXTAREA","SELECT"].includes(tag)||event.target?.isContentEditable)return;\n      const inputs=[...document.querySelectorAll('input[type="date"]')].filter(el=>el.offsetParent!==null);\n      if(!inputs.length)return;\n      const input=inputs[0];\n      const base=input.value?new Date(input.value+"T12:00:00"):new Date();\n      base.setDate(base.getDate()+(event.key==="ArrowRight"?1:-1));\n      const value=base.getFullYear()+"-"+String(base.getMonth()+1).padStart(2,"0")+"-"+String(base.getDate()).padStart(2,"0");\n      const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value")?.set;\n      setter?.call(input,value);\n      input.dispatchEvent(new Event("input",{bubbles:true}));\n      input.dispatchEvent(new Event("change",{bubbles:true}));\n      event.preventDefault();\n    };\n    window.addEventListener("keydown",onKeyDown);\n    return()=>window.removeEventListener("keydown",onKeyDown);\n  },[props?.view]);`)
      }
      return out===code?null:{code:out,map:null}
    }
  }
}
