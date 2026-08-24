from pathlib import Path

view_path = Path('src/modules/home/ViewBienvenida.jsx')
wrapper_path = Path('src/modules/home/ViewBienvenidaProjectFilter.jsx')

view = view_path.read_text(encoding='utf-8')
wrapper = wrapper_path.read_text(encoding='utf-8')

old = 'export default function ViewBienvenida({onOpenModule,onNavigate,rawSources={},rma15=[],rop05=[],listaEquipos=[],rop02All=[],usdRate=1,nombreUsuario="Usuario",areaUsuario="OFICINA TÉCNICA",onOpenProfile,onLogout,esAdministrativo=false}){'
new = 'export default function ViewBienvenida({onOpenModule,onNavigate,rawSources={},rma15=[],rop05=[],listaEquipos=[],rop02All=[],usdRate=1,nombreUsuario="Usuario",areaUsuario="OFICINA TÉCNICA",onOpenProfile,onLogout,esAdministrativo=false,summaryDayFiltered=false}){'
assert old in view, 'ViewBienvenida signature not found'
view = view.replace(old, new, 1)

old = '  const effectiveRop02=Array.isArray(snapshotRop02)?snapshotRop02:(Array.isArray(rop02All)?rop02All:[]);'
new = '  const effectiveRop02=summaryDayFiltered&&Array.isArray(rop02All)?rop02All:(Array.isArray(snapshotRop02)?snapshotRop02:(Array.isArray(rop02All)?rop02All:[]));'
assert old in view, 'effectiveRop02 line not found'
view = view.replace(old, new, 1)

old = '''    const equipos=Array.isArray(listaEquipos)?listaEquipos:[];\n    const rop=effectiveRop02;\n    const rma=Array.isArray(fallbackRma15)?fallbackRma15:(Array.isArray(rma15)?rma15:[]);\n    const maxRopDate=rop.reduce((max,row)=>{const d=dateOf(row);return d&&(!max||d>max)?d:max;},null);\n    const seven=maxRopDate?new Date(maxRopDate):new Date();seven.setDate(seven.getDate()-6);seven.setHours(0,0,0,0);'''
new = '''    const equipos=Array.isArray(listaEquipos)?listaEquipos:[];\n    const ropSource=effectiveRop02;\n    const rma=Array.isArray(fallbackRma15)?fallbackRma15:(Array.isArray(rma15)?rma15:[]);\n    const maxRopDate=ropSource.reduce((max,row)=>{const d=dateOf(row);return d&&(!max||d>max)?d:max;},null);\n    const maxRopDateISO=isoOfDate(maxRopDate);\n    // El resumen operativo siempre trabaja sobre un único día. Cuando existe filtro\n    // externo de día, ropSource ya viene reducido; sin filtro toma el último día disponible.\n    const rop=maxRopDateISO?ropSource.filter(row=>isoOfDate(dateOf(row))===maxRopDateISO):[];'''
assert old in view, '7-day source block not found'
view = view.replace(old, new, 1)

old = '    rop.forEach(r=>{const d=dateOf(r), rawCode=codeOf(r), c=canonicalEquivalentMachineCode(rawCode);if(c&&d&&(r._snapshotActive!==false)&&d>=seven&&!activos.has(c))activos.set(c,{interno:c,lugar:r.proyecto||""});});'
new = '    rop.forEach(r=>{const d=dateOf(r), rawCode=codeOf(r), c=canonicalEquivalentMachineCode(rawCode);if(c&&d&&(r._snapshotActive!==false)&&!activos.has(c))activos.set(c,{interno:c,lugar:r.proyecto||""});});'
assert old in view, 'active 7-day condition not found'
view = view.replace(old, new, 1)

old = '      viales:operativos.viales.length,camiones:operativos.camiones.length,camionetas:operativos.camionetas.length,'
new = '      fechaResumen:maxRopDateISO,viales:operativos.viales.length,camiones:operativos.camiones.length,camionetas:operativos.camionetas.length,'
assert old in view, 'nextData counters not found'
view = view.replace(old, new, 1)

old = 'title="Calculada según el último registro ROP02 disponible de cada equipo dentro de los últimos 7 días. Trabajo u OD = disponible; FS = no disponible. Se excluyen equipos justificados como \'Bajó a San Juan\'."'
new = 'title="Calculada exclusivamente con los registros ROP02 del día seleccionado. Trabajo u OD = disponible; FS = no disponible. Se excluyen equipos justificados como \'Bajó a San Juan\'."'
assert old in view, 'availability tooltip not found'
view = view.replace(old, new, 1)

# Wrapper: helpers for ROP02 dates.
marker = 'const EMPTY_RMA_SENTINEL={__dmHomeEmptyProject:true};\n'
helper = '''const normalizeDateKey=value=>{\n  if(value instanceof Date&&!Number.isNaN(value.getTime()))return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`;\n  const raw=String(value??"").trim();\n  if(!raw)return "";\n  let match=raw.match(/^(\\d{4})-(\\d{1,2})-(\\d{1,2})/);\n  if(match)return `${match[1]}-${String(match[2]).padStart(2,"0")}-${String(match[3]).padStart(2,"0")}`;\n  match=raw.match(/^(\\d{1,2})[\\/-](\\d{1,2})[\\/-](\\d{2}|\\d{4})/);\n  if(match){let year=Number(match[3]);if(year<100)year+=2000;return `${year}-${String(match[2]).padStart(2,"0")}-${String(match[1]).padStart(2,"0")}`;}\n  const parsed=new Date(raw);\n  return Number.isNaN(parsed.getTime())?"":`${parsed.getFullYear()}-${String(parsed.getMonth()+1).padStart(2,"0")}-${String(parsed.getDate()).padStart(2,"0")}`;\n};\nconst dateFromRop02Row=row=>{\n  if(!row||typeof row!=="object")return "";\n  const direct=row.fecha??row.Fecha??row.FECHA??row.ultimaFecha??row.ULTIMA_FECHA;\n  if(direct)return normalizeDateKey(direct);\n  const key=Object.keys(row).find(k=>String(k).toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").includes("fecha"));\n  return key?normalizeDateKey(row[key]):"";\n};\nconst formatDayLabel=iso=>/^\\d{4}-\\d{2}-\\d{2}$/.test(String(iso||""))?`${iso.slice(8,10)}/${iso.slice(5,7)}/${iso.slice(0,4)}`:"Sin fecha";\n'''
assert marker in wrapper, 'wrapper marker not found'
if 'const normalizeDateKey=' not in wrapper:
    wrapper = wrapper.replace(marker, marker + helper, 1)

old = '  const [selection,setSelection]=React.useState(readInitialSelection);\n  const [portalHost,setPortalHost]=React.useState(null);'
new = '  const [selection,setSelection]=React.useState(readInitialSelection);\n  const [selectedDay,setSelectedDay]=React.useState("");\n  const [portalHost,setPortalHost]=React.useState(null);'
assert old in wrapper, 'wrapper state block not found'
wrapper = wrapper.replace(old, new, 1)

old = '''  const allSelected=selection===null||selectedValues.length===projectValues.length;\n  const selectedSet=React.useMemo(()=>new Set(selectedValues),[selectedValues]);'''
new = '''  const allSelected=selection===null||selectedValues.length===projectValues.length;\n  const selectedSet=React.useMemo(()=>new Set(selectedValues),[selectedValues]);\n  const projectFilteredRop02=React.useMemo(()=>{\n    const source=Array.isArray(props.rop02All)?props.rop02All:[];\n    return allSelected?source:source.filter(row=>selectedSet.has(projectFromRow(row)));\n  },[props.rop02All,allSelected,selectedSet]);\n  const availableDays=React.useMemo(()=>[...new Set(projectFilteredRop02.map(dateFromRop02Row).filter(Boolean))].sort((a,b)=>b.localeCompare(a)),[projectFilteredRop02]);\n  const effectiveDay=selectedDay&&availableDays.includes(selectedDay)?selectedDay:(availableDays[0]||"");'''
assert old in wrapper, 'selectedSet block not found'
wrapper = wrapper.replace(old, new, 1)

old = '''  const filteredProps=React.useMemo(()=>{\n    if(allSelected)return props;\n    const filterRows=rows=>Array.isArray(rows)?rows.filter(row=>selectedSet.has(projectFromRow(row))):rows;\n    const filteredRma=filterRows(props.rma15);\n    return {\n      ...props,\n      rop02All:filterRows(props.rop02All),\n      rop05:filterRows(props.rop05),\n      rma15:Array.isArray(filteredRma)&&filteredRma.length?filteredRma:[EMPTY_RMA_SENTINEL],\n    };\n  },[props,allSelected,selectedSet]);'''
new = '''  const filteredProps=React.useMemo(()=>{\n    const filterRows=rows=>Array.isArray(rows)?(allSelected?rows:rows.filter(row=>selectedSet.has(projectFromRow(row)))):rows;\n    const filteredRma=filterRows(props.rma15);\n    const filteredRop02=effectiveDay?projectFilteredRop02.filter(row=>dateFromRop02Row(row)===effectiveDay):projectFilteredRop02;\n    return {\n      ...props,\n      rop02All:filteredRop02,\n      rop05:filterRows(props.rop05),\n      rma15:Array.isArray(filteredRma)&&filteredRma.length?filteredRma:[EMPTY_RMA_SENTINEL],\n      summaryDayFiltered:Boolean(effectiveDay),\n    };\n  },[props,allSelected,selectedSet,projectFilteredRop02,effectiveDay]);'''
assert old in wrapper, 'filteredProps block not found'
wrapper = wrapper.replace(old, new, 1)

old = '''  const toggleProject=value=>{\n    if(value==="TODOS"){setSelection(null);return;}\n    setSelection(current=>{'''
new = '''  const toggleProject=value=>{\n    setSelectedDay("");\n    if(value==="TODOS"){setSelection(null);return;}\n    setSelection(current=>{'''
assert old in wrapper, 'toggleProject block not found'
wrapper = wrapper.replace(old, new, 1)

old = '''  const control=portalHost?createPortal(\n    <div ref={controlRef} style={{position:"relative",marginLeft:"auto"}} onClick={event=>event.stopPropagation()}>\n      <button type="button" aria-label="Filtrar resumen general por proyecto" aria-expanded={open} title="Filtrar resumen general por proyecto" onClick={()=>setOpen(value=>!value)} style={{minWidth:88,maxWidth:160,height:28,padding:"0 8px",borderRadius:7,border:"1px solid rgba(255,255,255,.16)",background:"rgba(10,24,36,.92)",color:"#fff",fontSize:10,fontWeight:800,outline:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",gap:6}}>\n        <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{summaryLabel||"Todos"}</span><span style={{fontSize:9,opacity:.8}}>▾</span>\n      </button>\n      {open&&<div style={{position:"absolute",right:0,top:34,zIndex:80,width:178,maxHeight:300,overflowY:"auto",padding:6,borderRadius:9,border:"1px solid rgba(255,255,255,.14)",background:"rgba(5,18,29,.98)",boxShadow:"0 16px 36px rgba(0,0,0,.38)",backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)"}}>'''
new = '''  const control=portalHost?createPortal(\n    <div ref={controlRef} style={{position:"relative",marginLeft:"auto",display:"flex",flexDirection:"column",gap:5,alignItems:"stretch"}} onClick={event=>event.stopPropagation()}>\n      <button type="button" aria-label="Filtrar resumen general por proyecto" aria-expanded={open} title="Filtrar resumen general por proyecto" onClick={()=>setOpen(value=>!value)} style={{minWidth:108,maxWidth:160,height:28,padding:"0 8px",borderRadius:7,border:"1px solid rgba(255,255,255,.16)",background:"rgba(10,24,36,.92)",color:"#fff",fontSize:10,fontWeight:800,outline:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",gap:6}}>\n        <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{summaryLabel||"Todos"}</span><span style={{fontSize:9,opacity:.8}}>▾</span>\n      </button>\n      <select aria-label="Filtrar resumen general por día" title="Día ROP02 del resumen" value={effectiveDay} onChange={event=>setSelectedDay(event.target.value)} disabled={!availableDays.length} style={{minWidth:108,maxWidth:160,height:26,padding:"0 7px",borderRadius:7,border:"1px solid rgba(255,255,255,.16)",background:"rgba(10,24,36,.92)",color:"#fff",fontSize:9,fontWeight:800,outline:"none",cursor:availableDays.length?"pointer":"default"}}>\n        {!availableDays.length&&<option value="">Sin registros</option>}\n        {availableDays.map(day=><option key={day} value={day}>{formatDayLabel(day)}</option>)}\n      </select>\n      {open&&<div style={{position:"absolute",right:0,top:34,zIndex:80,width:178,maxHeight:300,overflowY:"auto",padding:6,borderRadius:9,border:"1px solid rgba(255,255,255,.14)",background:"rgba(5,18,29,.98)",boxShadow:"0 16px 36px rgba(0,0,0,.38)",backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)"}}>'''
assert old in wrapper, 'control block not found'
wrapper = wrapper.replace(old, new, 1)

for required in ['summaryDayFiltered=false','const ropSource=effectiveRop02','const maxRopDateISO=isoOfDate(maxRopDate)','selectedDay,setSelectedDay','availableDays','summaryDayFiltered:Boolean(effectiveDay)','Filtrar resumen general por día']:
    assert required in (view + wrapper), required

view_path.write_text(view, encoding='utf-8')
wrapper_path.write_text(wrapper, encoding='utf-8')
print('Home summary latest-day filter patch applied.')
