const TARGET='/src/modules/equipment/EquipmentProfileView.jsx'

function replaceRequired(source,from,to,label){
  if(!source.includes(from))throw new Error(`[delta-equipment-profile-pm-units] No se encontró el ancla requerida: ${label}`)
  return source.split(from).join(to)
}

export function equipmentProfilePmUnitsVitePlugin(){
  return{
    name:'delta-equipment-profile-pm-units',
    enforce:'pre',
    transform(code,id){
      if(!id.replace(/\\/g,'/').endsWith(TARGET))return null
      let out=code

      // La Ficha Única debe aplicar exactamente el criterio operativo de Mantenimiento Programado:
      // camioneta = kilometraje / 8.000 km; camión = horómetro / 500 h; equipo vial = horómetro / 250 h.
      out=replaceRequired(
        out,
        '    const isTruck=isCanonicalTruckFamily(pick(master||{},["Familia","Tipo","Equipo"]));\n    const interval=isTruck?500:positiveOr(pick(cfg,["intervalo","Intervalo"]),250);',
        '    const pmFamily=String(pick(master||{},["Familia","Tipo","Tipo de equipo","Equipo"])||pick(cfg,["equipo","Equipo"])||"").normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toUpperCase();\n    const pmCode=canonicalEquipmentCode(selectedKey);\n    const isPickup=pmFamily.includes("CAMIONETA")||pmCode.startsWith("CTA");\n    const isTruck=!isPickup&&(isCanonicalTruckFamily(pmFamily)||["CAA","CAC","CAR","CAV"].some(prefix=>pmCode.startsWith(prefix)));\n    const unit=isPickup?"km":"h";\n    const interval=isPickup?8000:(isTruck?500:250);',
        'clasificación e intervalo PM'
      )

      out=replaceRequired(
        out,
        '    return{lastH,lastDate,interval,next,since,remaining,status,currentH,isTruck,inconsistent,latestOp};',
        '    return{lastH,lastDate,interval,next,since,remaining,status,currentH,isPickup,isTruck,unit,inconsistent,latestOp};',
        'unidad PM devuelta por pmInfo'
      )

      // Valores y unidades de lectura/uso.
      const valueReplacements=[
        ['`${fmt(pmInfo.currentH)} h`','`${fmt(pmInfo.currentH)} ${pmInfo.unit}`'],
        ['`${fmt(summary.totalHours)} h`','`${fmt(summary.totalHours)} ${pmInfo.unit}`'],
        ['`${fmt(summary.fuelRate,2)} L/h`','`${fmt(summary.fuelRate,2)} L/${pmInfo.unit}`'],
        ['`${fmt(pmInfo.lastH)} h`','`${fmt(pmInfo.lastH)} ${pmInfo.unit}`'],
        ['`${fmt(pmInfo.next)} h`','`${fmt(pmInfo.next)} ${pmInfo.unit}`'],
        ['`${fmt(Math.abs(pmInfo.remaining))} h de atraso`','`${fmt(Math.abs(pmInfo.remaining))} ${pmInfo.unit} de atraso`'],
        ['`${fmt(pmInfo.remaining)} h`','`${fmt(pmInfo.remaining)} ${pmInfo.unit}`'],
        ['`${fmt(pmInfo.interval)} h`','`${fmt(pmInfo.interval)} ${pmInfo.unit}`'],
        ['`${fmt(pmInfo.since)} h`','`${fmt(pmInfo.since)} ${pmInfo.unit}`'],
        ['`USD ${costPerHourUSD.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}/h`','`USD ${costPerHourUSD.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}/${pmInfo.unit}`']
      ]
      for(const [from,to] of valueReplacements)out=out.split(from).join(to)

      // Etiquetas dinámicas. ROP05 continúa expresándose en horas porque es productividad,
      // pero todo contador proveniente de ROP02/PM usa km para camionetas.
      out=out.replace('compactMetric("Horómetro actual",pmInfo.currentH?', 'compactMetric(pmInfo.isPickup?"Kilometraje actual":"Horómetro actual",pmInfo.currentH?')
      out=out.replace('compactMetric("Horas ROP02 (período)",', 'compactMetric(pmInfo.isPickup?"Km ROP02 (período)":"Horas ROP02 (período)",')
      out=out.replace('compactMetric("Costo mant. USD/h",', 'compactMetric(pmInfo.isPickup?"Costo mant. USD/km":"Costo mant. USD/h",')
      out=out.replace('dataRow("Horómetro último PM",', 'dataRow(pmInfo.isPickup?"Kilometraje último PM":"Horómetro último PM",')
      out=out.replace('dataRow("Horas desde PM",', 'dataRow(pmInfo.isPickup?"Km desde PM":"Horas desde PM",')

      // Textos neutros para que el tooltip no contradiga la unidad seleccionada.
      out=out.split('Último horómetro final real registrado en ROP02, independiente del filtro visual.').join('Última lectura final real registrada en ROP02, independiente del filtro visual.')
      out=out.split('Horas acumuladas del equipo en ROP02 para el período filtrado.').join('Uso acumulado del equipo en ROP02 para el período filtrado.')
      out=out.split('Combustible registrado dividido por horas ROP02 del período.').join('Combustible registrado dividido por el uso ROP02 del período.')
      out=out.split('Costo RMA15 del período dividido por las horas ROP02 del mismo período.').join('Costo RMA15 del período dividido por el uso ROP02 del mismo período.')
      out=out.split('Costo del período dividido por horas ROP02.').join('Costo del período dividido por el uso ROP02.')
      out=out.split('Objetivo de mantenimiento preventivo calculado con el último PM, intervalo configurado y horómetro actual.').join('Objetivo de mantenimiento preventivo calculado con el último PM, intervalo configurado y lectura actual.')
      out=out.split('Legajo de PM con último servicio, próximo objetivo y horas restantes calculadas contra el horómetro actual.').join('Legajo de PM con último servicio, próximo objetivo y uso restante calculado contra la lectura actual.')

      // Evolución: kilometraje para camionetas, horómetro para el resto.
      out=out.replace('title="Evolución de horómetro"', 'title={pmInfo.isPickup?"Evolución de kilometraje":"Evolución de horómetro"}')
      out=out.split('Evolución del horómetro final registrado en ROP02 dentro del período activo.').join('Evolución de la lectura final registrada en ROP02 dentro del período activo.')

      // En la tabla ROP02 la columna Cant. Hs./KM también cambia de nombre según el equipo.
      const colsStart=out.indexOf('  const rop02Cols=useMemo(')
      const colsEnd=colsStart>=0?out.indexOf('\n  const rop05Rows=',colsStart):-1
      if(colsStart<0||colsEnd<0)throw new Error('[delta-equipment-profile-pm-units] No se encontró el bloque de columnas ROP02')
      let colsBlock=out.slice(colsStart,colsEnd)
      colsBlock=colsBlock.replace('{key:"horas",label:"Horas",', '{key:"horas",label:pmInfo.isPickup?"Km":"Horas",')
      colsBlock=colsBlock.replace('],[]);', '],[pmInfo.isPickup]);')
      out=out.slice(0,colsStart)+colsBlock+out.slice(colsEnd)

      if(!out.includes('isPickup?8000:(isTruck?500:250)')||!out.includes('Kilometraje actual')||!out.includes('Km ROP02 (período)')){
        throw new Error('[delta-equipment-profile-pm-units] La transformación de unidades/intervalos quedó incompleta')
      }

      return out===code?null:{code:out,map:null}
    }
  }
}
