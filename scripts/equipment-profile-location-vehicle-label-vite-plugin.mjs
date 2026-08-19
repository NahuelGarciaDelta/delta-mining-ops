const TARGET='/src/modules/equipment/EquipmentProfileView.jsx'

export function equipmentProfileLocationVehicleLabelVitePlugin(){
  return{
    name:'delta-equipment-profile-location-vehicle-label',
    enforce:'pre',
    transform(code,id){
      if(!id.replace(/\\/g,'/').endsWith(TARGET))return null
      let out=code

      if(!out.includes('const displayDetailCode=')){
        out=out.replace(
          '  const detailCode=selectedOption?.value||cleanEquipmentCode(selected);',
`  const detailCode=selectedOption?.value||cleanEquipmentCode(selected);
  const detailFamily=String(pick(master||{},["Familia","Tipo","Tipo de equipo","Equipo"])||"").normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toUpperCase();
  const isVehicleDetail=detailFamily.includes("CAMIONETA")||detailFamily.includes("CAMION");
  const vehiclePatent=isVehicleDetail?String(pick(master||{},["Código de Drusila","Codigo de Drusila","Código Drusila","Codigo Drusila","CODIGO DRUSILA"])||"").trim():"";
  const displayDetailCode=vehiclePatent&&canonicalEquipmentCode(vehiclePatent)!==canonicalEquipmentCode(detailCode)?\`${'${detailCode}'} (${'${vehiclePatent}'})\`:detailCode;
  const lastProject=String(summary.lastOp?.proyecto||"—").trim()||"—";
  const currentRentalPlace=String(pick(master||{},["Lugar de alquiler","Lugar alquiler","LUGAR DE ALQUILER","Lugar de Alquiler"])||"—").trim()||"—";`
        )
      }

      out=out.replace('{detailCode||"Seleccioná un equipo"}','{displayDetailCode||"Seleccioná un equipo"}')

      out=out.replace(
        'const marca=pick(master||{},["Marca"]),modelo=pick(master||{},["Modelo"]),familia=pick(master||{},["Familia","Tipo"]);',
        'const marca=pick(master||{},["Marca"]),modelo=pick(master||{},["Modelo"]),familia=pick(master||{},["Familia","Tipo"]),familyNorm=String(familia||"").normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toUpperCase(),isVehicle=familyNorm.includes("CAMIONETA")||familyNorm.includes("CAMION"),patente=isVehicle?String(pick(master||{},["Código de Drusila","Codigo de Drusila","Código Drusila","Codigo Drusila","CODIGO DRUSILA"])||"").trim():"",displayPreferred=patente&&canonicalEquipmentCode(patente)!==canonicalEquipmentCode(preferred)?`${preferred} (${patente})`:preferred;'
      )
      out=out.replace(
        'label:`${preferred}${marca||modelo?` · ${[marca,modelo].filter(Boolean).join(" ")}`:familia?` · ${familia}`:""}`',
        'label:`${displayPreferred}${marca||modelo?` · ${[marca,modelo].filter(Boolean).join(" ")}`:familia?` · ${familia}`:""}`'
      )

      out=out.replace(
        '<span>{familia||"Equipo"}</span><span>·</span><span>{marca||"Sin marca"}</span><span>·</span><span>{modelo||"Sin modelo"}</span><span>·</span><span style={{color:C.blue}}>{project}</span>',
        '<span>{familia||"Equipo"}</span><span>·</span><span>{marca||"Sin marca"}</span><span>·</span><span>{modelo||"Sin modelo"}</span>'
      )

      if(!out.includes('dm-equipment-location-lines')){
        out=out.replace(
          '          </div>}\n        </div>\n        <div className="dm-equipment-filter-panel"',
`          </div>}
          {detailCode&&<div className="dm-equipment-location-lines" style={{marginTop:7,display:"flex",flexDirection:"column",gap:3,fontSize:11,fontWeight:700,color:C.textSub}}>
            <div><span style={{color:C.textMuted}}>Último proyecto:</span> <span style={{color:C.blue}}>{lastProject}</span></div>
            <div><span style={{color:C.textMuted}}>Lugar actual:</span> <span style={{color:C.text}}>{currentRentalPlace}</span></div>
          </div>}
        </div>
        <div className="dm-equipment-filter-panel"`
        )
      }

      return out===code?null:{code:out,map:null}
    }
  }
}
