const TARGET = '/src/modules/equipment/EquipmentProfileView.jsx'

export function equipmentProfileLayoutVitePlugin() {
  return {
    name: 'delta-equipment-profile-layout',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').endsWith(TARGET)) return null
      let out = code

      // El desplegable de equipo debe poder salir visualmente del encabezado sin
      // quedar recortado por el contenedor azul.
      out = out.replace(
        'borderRadius:14,overflow:"hidden",boxShadow:',
        'borderRadius:14,overflow:"visible",boxShadow:'
      )

      // Asegura que el dropdown custom quede contenido horizontalmente y tenga
      // scroll vertical interno, sin crecer fuera del viewport.
      out = out.replace(
        'top:"calc(100% + 5px)",left:0,right:0,zIndex:10000',
        'top:"calc(100% + 5px)",left:0,right:0,zIndex:10000,width:"100%",boxSizing:"border-box"'
      )
      out = out.replace(
        'maxHeight:"min(320px, calc(100vh - 220px))",overflowY:"auto",overflowX:"hidden"',
        'maxHeight:"min(300px, calc(100vh - 180px))",overflowY:"auto",overflowX:"hidden",overscrollBehavior:"contain"'
      )

      // El plugin histórico anterior puede encontrar dos variantes del callback.
      // En ambos casos usamos visibleCodes y dejamos PROYECTO en su propia fila.
      out = out.replace(
        '<EquipmentPicker options={allCodes} value={selected} onChange={v=>setSelected(cleanEquipmentCode(v))}/>',
        '<EquipmentPicker options={visibleCodes} value={selected} onChange={v=>setSelected(cleanEquipmentCode(v))}/>'
      )
      out = out.replace(
        '<EquipmentPicker options={allCodes} value={selected} onChange={handleSelect}/>',
        '<EquipmentPicker options={visibleCodes} value={selected} onChange={handleSelect}/>'
      )

      // Inserta Proyecto inmediatamente después de MES, pero lo fija en la segunda
      // fila y primera columna para que visualmente quede justo debajo de MES.
      if (!out.includes('className="dm-equipment-project-filter"')) {
        out = out.replace(
          '</label><DateIn label="Desde"',
          '</label><label className="dm-equipment-project-filter" style={{fontSize:9,color:C.textMuted,fontWeight:800,gridColumn:"1",gridRow:"2"}}>PROYECTO<select value={selectedProject} onChange={e=>setSelectedProject(e.target.value)} style={{display:"block",marginTop:4,width:"100%",height:33,boxSizing:"border-box",background:"#151515",border:`1px solid ${C.border}`,color:C.text,borderRadius:8,padding:"0 9px",fontSize:11,fontWeight:700,outline:"none"}}><option value="">Todos los proyectos</option>{projectOptions.map(p=><option key={p} value={p}>{p}</option>)}</select></label><DateIn label="Desde"'
        )
      }

      // La fila de filtros gana una segunda línea sin empujar Limpiar fuera del panel.
      out = out.replace(
        'gridTemplateColumns:"minmax(145px,1.2fr) minmax(120px,1fr) minmax(120px,1fr) auto",alignItems:"end",gap:8',
        'gridTemplateColumns:"minmax(135px,1.05fr) minmax(110px,.95fr) minmax(110px,.95fr) minmax(74px,auto)",gridTemplateRows:"auto auto",alignItems:"end",gap:8'
      )

      // Limpiar también restablece el filtro de proyecto.
      out = out.replace(
        'const clearFilters=()=>{setSelectedMonth("");setFechaD("");setFechaH("");};',
        'const clearFilters=()=>{setSelectedMonth("");setSelectedProject("");setFechaD("");setFechaH("");};'
      )

      // Ajustes responsive: proyecto siempre queda bajo Mes; en pantallas angostas
      // todo el bloque permanece dentro del recuadro.
      out = out.replace(
        '.dm-equipment-filter-row input,.dm-equipment-filter-row select{width:100%!important}',
        '.dm-equipment-filter-row input,.dm-equipment-filter-row select{width:100%!important}\n    .dm-equipment-project-filter{min-width:0}'
      )

      return out === code ? null : { code: out, map: null }
    }
  }
}
