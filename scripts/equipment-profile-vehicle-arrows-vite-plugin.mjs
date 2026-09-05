const PROFILE='/src/modules/equipment/EquipmentProfileView.jsx'

export function equipmentProfileVehicleArrowsVitePlugin(){
  return{
    name:'delta-equipment-profile-vehicle-arrows',
    enforce:'pre',
    transform(code,id){
      const path=id.replace(/\\/g,'/')
      let out=code

      if(path.endsWith(PROFILE)&&!out.includes('dm-equipment-arrow-navigation')){
        const selectedOptionRe=/(\s+const selectedOption=[^\n]+;)/
        if(selectedOptionRe.test(out)){
          out=out.replace(selectedOptionRe,`$1
  // dm-equipment-arrow-navigation: navegación GLOBAL por equipos con ← / →.
  // Se captura antes que inputs/selectores para que funcione aunque el foco quede
  // dentro del selector personalizado de equipos.
  useEffect(()=>{
    const moveEquipment=(direction)=>{
      const list=Array.isArray(allCodes)?allCodes:[];
      if(list.length<2)return false;
      const currentKey=canonicalEquipmentCode(selectedOption?.value||selected||detailKey);
      let idx=list.findIndex(o=>canonicalEquipmentCode(o.value)===currentKey||canonicalEquipmentCode(o.key)===currentKey);
      if(idx<0)idx=0;
      const nextIdx=direction>0?(idx+1)%list.length:(idx-1+list.length)%list.length;
      const next=list[nextIdx];
      if(!next?.value)return false;
      const nextCode=cleanEquipmentCode(next.value);
      setSelected(nextCode);
      setDetailKey(canonicalEquipmentCode(nextCode));
      onSelectCode?.(nextCode);
      return true;
    };
    const onKeyDown=(event)=>{
      if(event.key!=="ArrowLeft"&&event.key!=="ArrowRight")return;
      // Solo evitamos interferir con escritura real en textarea/contenteditable.
      // Inputs, selects y botones NO bloquean la navegación: el usuario pidió que
      // las flechas funcionen aun cuando el foco haya quedado en el selector.
      const active=document.activeElement;
      if(String(active?.tagName||"").toUpperCase()==="TEXTAREA"||active?.isContentEditable)return;
      if(moveEquipment(event.key==="ArrowRight"?1:-1)){
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
      }
    };
    window.addEventListener("keydown",onKeyDown,true);
    document.addEventListener("keydown",onKeyDown,true);
    return()=>{
      window.removeEventListener("keydown",onKeyDown,true);
      document.removeEventListener("keydown",onKeyDown,true);
    };
  },[selected,detailKey,selectedOption,allCodes,onSelectCode]);`)
        }
      }

      // Date navigation is implemented in App.jsx so every single-date view behaves consistently.


      return out===code?null:{code:out,map:null}
    }
  }
}
