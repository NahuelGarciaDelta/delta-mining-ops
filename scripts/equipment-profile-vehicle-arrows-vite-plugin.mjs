const PROFILE='/src/modules/equipment/EquipmentProfileView.jsx'
const ROUTE='/src/modules/oficina-tecnica/OficinaTecnicaRoute.jsx'

export function equipmentProfileVehicleArrowsVitePlugin(){
  return{
    name:'delta-equipment-profile-vehicle-arrows',
    enforce:'post',
    transform(code,id){
      const path=id.replace(/\\/g,'/')
      let out=code

      if(path.endsWith(PROFILE)&&!out.includes('dm-equipment-arrow-navigation')){
        // Inserción robusta después de selectedOption, sin depender de una variante exacta del código generado.
        out=out.replace(/(const selectedOption=[^;]+;)/,`$1
  // dm-equipment-arrow-navigation: ← / → recorre el equipo anterior/siguiente de la lista visible.
  useEffect(()=>{
    const onKeyDown=(event)=>{
      if(event.key!=="ArrowLeft"&&event.key!=="ArrowRight")return;
      const tag=String(event.target?.tagName||"").toUpperCase();
      if(["INPUT","TEXTAREA","SELECT","BUTTON"].includes(tag)||event.target?.isContentEditable)return;
      const list=(typeof visibleCodes!=="undefined"&&Array.isArray(visibleCodes)?visibleCodes:allCodes)||[];
      if(!list.length)return;
      const currentKey=canonicalEquipmentCode(selectedOption?.value||selected);
      let idx=list.findIndex(o=>canonicalEquipmentCode(o.value)===currentKey);
      if(idx<0)idx=list.findIndex(o=>canonicalEquipmentCode(o.key)===currentKey);
      if(idx<0)idx=0;
      const delta=event.key==="ArrowRight"?1:-1;
      const nextIdx=Math.max(0,Math.min(list.length-1,idx+delta));
      if(nextIdx===idx)return;
      const next=list[nextIdx];
      event.preventDefault();
      setSelected(cleanEquipmentCode(next.value));
      onSelectCode?.(cleanEquipmentCode(next.value));
    };
    window.addEventListener("keydown",onKeyDown);
    return()=>window.removeEventListener("keydown",onKeyDown);
  },[selected,selectedOption,allCodes,visibleCodes,onSelectCode]);`)
      }

      if(path.endsWith(ROUTE)&&!out.includes('dm-daily-date-arrow-navigation')){
        const marker='  useEffect(()=>{if(props?.view!=="tallerCentral")setTallerTab("RESUMEN");},[props?.view]);'
        if(out.includes(marker))out=out.replace(marker,`${marker}

  // dm-daily-date-arrow-navigation: en ROP02 Equipos y Vehículos, ←/→ cambia al día anterior/siguiente.
  useEffect(()=>{
    const dailyViews=new Set(["rop02","equipos","vehiculos","listaVehiculos","vehiculosROP02"]);
    if(!dailyViews.has(props?.view))return;
    const onKeyDown=(event)=>{
      if(event.key!=="ArrowLeft"&&event.key!=="ArrowRight")return;
      const tag=String(event.target?.tagName||"").toUpperCase();
      if(["INPUT","TEXTAREA","SELECT","BUTTON"].includes(tag)||event.target?.isContentEditable)return;

      // Sólo actuar cuando la vista esté efectivamente en modo "Por día".
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
    };
    window.addEventListener("keydown",onKeyDown);
    return()=>window.removeEventListener("keydown",onKeyDown);
  },[props?.view]);`)
      }

      return out===code?null:{code:out,map:null}
    }
  }
}
