const PROFILE='/src/modules/equipment/EquipmentProfileView.jsx'
const ROUTE='/src/modules/oficina-tecnica/OficinaTecnicaRoute.jsx'

export function equipmentProfileVehicleArrowsVitePlugin(){
  return{
    name:'delta-equipment-profile-vehicle-arrows',
    // Debe ejecutarse sobre JSX fuente. Como post, React ya había transformado el archivo
    // y los marcadores no existían, por eso las flechas nunca se instalaban.
    enforce:'pre',
    transform(code,id){
      const path=id.replace(/\\/g,'/')
      let out=code

      if(path.endsWith(PROFILE)&&!out.includes('dm-equipment-arrow-navigation')){
        // Insertar inmediatamente después de selectedOption, aceptando cualquiera de
        // las variantes que dejan los plugins de aliases.
        const selectedOptionRe=/(\s+const selectedOption=[^\n]+;)/
        if(selectedOptionRe.test(out)){
          out=out.replace(selectedOptionRe,`$1
  // dm-equipment-arrow-navigation: ← / → recorre la lista de equipos.
  useEffect(()=>{
    const onKeyDown=(event)=>{
      if(event.key!=="ArrowLeft"&&event.key!=="ArrowRight")return;
      const active=document.activeElement;
      const tag=String(active?.tagName||"").toUpperCase();
      if(["INPUT","TEXTAREA","SELECT"].includes(tag)||active?.isContentEditable)return;
      const list=Array.isArray(allCodes)?allCodes:[];
      if(list.length<2)return;
      const currentKey=canonicalEquipmentCode(selectedOption?.value||selected||detailKey);
      let idx=list.findIndex(o=>canonicalEquipmentCode(o.value)===currentKey||canonicalEquipmentCode(o.key)===currentKey);
      if(idx<0)idx=0;
      const nextIdx=event.key==="ArrowRight"?(idx+1)%list.length:(idx-1+list.length)%list.length;
      const next=list[nextIdx];
      if(!next?.value)return;
      event.preventDefault();
      event.stopPropagation();
      const nextCode=cleanEquipmentCode(next.value);
      setSelected(nextCode);
      setDetailKey(canonicalEquipmentCode(nextCode));
      onSelectCode?.(nextCode);
    };
    window.addEventListener("keydown",onKeyDown,true);
    return()=>window.removeEventListener("keydown",onKeyDown,true);
  },[selected,detailKey,selectedOption,allCodes,onSelectCode]);`)
        }
      }

      if(path.endsWith(ROUTE)&&!out.includes('dm-daily-date-arrow-navigation')){
        const marker='  useEffect(()=>{if(props?.view!=="tallerCentral")setTallerTab("RESUMEN");},[props?.view]);'
        if(out.includes(marker)){
          out=out.replace(marker,`${marker}

  // dm-daily-date-arrow-navigation: en Equipos y Vehículos por día, ←/→ cambia un día.
  useEffect(()=>{
    const dailyViews=new Set(["rop02","equipos","vehiculos","listaVehiculos","vehiculosROP02"]);
    if(!dailyViews.has(props?.view))return;
    const onKeyDown=(event)=>{
      if(event.key!=="ArrowLeft"&&event.key!=="ArrowRight")return;
      const active=document.activeElement;
      const tag=String(active?.tagName||"").toUpperCase();
      if(["INPUT","TEXTAREA","SELECT"].includes(tag)||active?.isContentEditable)return;
      const visibleDateInputs=[...document.querySelectorAll('input[type="date"]')].filter(el=>el.offsetParent!==null&&!el.disabled);
      if(!visibleDateInputs.length)return;
      const input=visibleDateInputs[0];
      const base=input.value?new Date(input.value+"T12:00:00"):new Date();
      if(Number.isNaN(base.getTime()))return;
      base.setDate(base.getDate()+(event.key==="ArrowRight"?1:-1));
      const value=base.getFullYear()+"-"+String(base.getMonth()+1).padStart(2,"0")+"-"+String(base.getDate()).padStart(2,"0");
      const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value")?.set;
      if(!setter)return;
      setter.call(input,value);
      input.dispatchEvent(new Event("input",{bubbles:true}));
      input.dispatchEvent(new Event("change",{bubbles:true}));
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("keydown",onKeyDown,true);
    return()=>window.removeEventListener("keydown",onKeyDown,true);
  },[props?.view]);`)
        }
      }

      return out===code?null:{code:out,map:null}
    }
  }
}
