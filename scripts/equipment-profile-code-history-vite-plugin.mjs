const TARGET = '/src/modules/equipment/EquipmentProfileView.jsx'

export function equipmentProfileCodeHistoryVitePlugin() {
  return {
    name: 'delta-equipment-profile-code-history',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').endsWith(TARGET)) return null
      let out = code

      // El selector usa portal para no quedar recortado por ningún contenedor.
      if (!out.includes('from "react-dom"') && !out.includes("from 'react-dom'")) {
        out = 'import { createPortal } from "react-dom";\n' + out
      }

      out = out.replace(/const MASTER_CODE_HEADERS=\[[^;]+\];/,
        'const MASTER_CODE_HEADERS=["Codigo nuevo","Código nuevo","CODIGO NUEVO","Código de Drusila","Codigo de Drusila","Código Drusila","Codigo Drusila","CODIGO DRUSILA","Interno","Código interno","Codigo interno","Codigo Int","Código Equipo","Codigo Equipo","Código viejo","Codigo viejo","CODIGO VIEJO","Código anterior","Codigo anterior","CODIGO ANTERIOR"];')

      out = out.replace(/function EquipmentPicker\(\{options,value,onChange\}\)\{[\s\S]*?\n\}/,
`function EquipmentPicker({options,value,onChange}){
  const [open,setOpen]=useState(false),[search,setSearch]=useState("");
  const [popup,setPopup]=useState({left:0,top:0,width:0,maxHeight:360});
  const anchorRef=React.useRef(null),popupRef=React.useRef(null);
  const updatePopup=React.useCallback(()=>{
    const el=anchorRef.current;if(!el)return;
    const r=el.getBoundingClientRect();
    const vh=window.innerHeight||document.documentElement.clientHeight||800;
    const below=Math.max(0,vh-r.bottom-8),above=Math.max(0,r.top-8);
    const openDown=below>=220||below>=above;
    const available=Math.max(140,Math.min(420,(openDown?below:above)-4));
    setPopup({left:Math.max(6,r.left),top:openDown?r.bottom+5:Math.max(6,r.top-available-5),width:Math.max(220,r.width),maxHeight:available});
  },[]);
  useEffect(()=>{
    const close=e=>{if(anchorRef.current?.contains(e.target)||popupRef.current?.contains(e.target))return;setOpen(false);};
    document.addEventListener("mousedown",close);
    return()=>document.removeEventListener("mousedown",close);
  },[]);
  useEffect(()=>{
    if(!open)return;updatePopup();
    const fn=()=>updatePopup();window.addEventListener("resize",fn);window.addEventListener("scroll",fn,true);
    return()=>{window.removeEventListener("resize",fn);window.removeEventListener("scroll",fn,true);};
  },[open,updatePopup]);
  const current=options.find(o=>canonicalEquipmentCode(o.value)===canonicalEquipmentCode(value))||null;
  const filtered=useMemo(()=>{const q=norm(search);return q?options.filter(o=>norm(o.label).includes(q)):options;},[options,search]);
  const menu=open&&createPortal(<div ref={popupRef} style={{position:"fixed",left:popup.left,top:popup.top,width:popup.width,maxWidth:"calc(100vw - 12px)",zIndex:2147483647,background:"#141414",border:\`1px solid \${C.border}\`,borderRadius:9,boxShadow:"0 18px 48px rgba(0,0,0,.78)",padding:6,boxSizing:"border-box"}}><input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar equipo..." style={{width:"100%",height:34,boxSizing:"border-box",borderRadius:7,border:\`1px solid \${C.border}\`,background:"#0f0f0f",color:C.text,padding:"0 10px",fontSize:11,outline:"none",marginBottom:5}}/><div style={{maxHeight:Math.max(90,popup.maxHeight-46),overflowY:"scroll",overflowX:"hidden",overscrollBehavior:"contain",scrollbarGutter:"stable"}}>{filtered.map(o=><button type="button" key={o.key} onClick={()=>{onChange(o.value);setOpen(false);setSearch("");}} style={{display:"block",width:"100%",border:0,borderRadius:6,background:canonicalEquipmentCode(o.value)===canonicalEquipmentCode(value)?"rgba(37,99,235,.35)":"transparent",color:C.text,textAlign:"left",padding:"8px 9px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"normal",overflowWrap:"anywhere"}}>{o.label}</button>)}{!filtered.length&&<div style={{padding:12,color:C.textMuted,fontSize:11}}>Sin coincidencias</div>}</div></div>,document.body);
  return <div ref={anchorRef} style={{position:"relative",width:"100%",minWidth:0}}><button type="button" onClick={()=>{setOpen(v=>!v);setTimeout(updatePopup,0);}} style={{width:"100%",height:40,boxSizing:"border-box",borderRadius:8,border:\`1px solid \${C.border}\`,background:"#151515",color:C.text,padding:"0 36px 0 12px",fontSize:12,fontWeight:700,outline:"none",cursor:"pointer",textAlign:"left",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",position:"relative"}}>{current?.label||value||"Seleccionar equipo..."}<span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)"}}>⌄</span></button>{menu}</div>;
}`)

      out = out.replace('  const [selectedMonth,setSelectedMonth]=useState("");\n  const [activeTab,setActiveTab]=useState("resumen");','  const [selectedMonth,setSelectedMonth]=useState("");\n  const [selectedProject,setSelectedProject]=useState("");\n  const [activeTab,setActiveTab]=useState("resumen");')

      out = out.replace(/  const allCodes=useMemo\(\(\)=>\{[\s\S]*?\n  \},\[listaEquipos,rop02Index,rop05Index,rma15Index,pm\.config,pmRegIndex,masterIndex,movementIndex\]\);(?:\n  const projectOptions[\s\S]*?\n  const visibleCodes[\s\S]*?\);)?/,
`  const physicalIdentity=useMemo(()=>{
    const aliasToPreferred=new Map(),aliasToMaster=new Map();
    const preferredOf=row=>cleanEquipmentCode(pick(row||{},["Código nuevo","Codigo nuevo","CODIGO NUEVO"])||pick(row||{},["Código de Drusila","Codigo de Drusila","Código Drusila","Codigo Drusila","CODIGO DRUSILA"])||codesOfMaster(row||{})[0]||"");
    for(const row of listaEquipos||[]){
      const aliases=codesOfMaster(row).map(cleanEquipmentCode).filter(Boolean),preferred=preferredOf(row)||aliases[0];
      const preferredKey=canonicalEquipmentCode(preferred);if(!preferredKey)continue;
      for(const alias of aliases){const k=canonicalEquipmentCode(alias);if(!k)continue;aliasToPreferred.set(k,preferredKey);aliasToMaster.set(k,row);}
      aliasToPreferred.set(preferredKey,preferredKey);aliasToMaster.set(preferredKey,row);
    }
    return{aliasToPreferred,aliasToMaster,preferredOf};
  },[listaEquipos]);
  const allCodes=useMemo(()=>{
    const catalog=new Map();
    const add=(raw,explicitMaster=null,fromMaster=false)=>{
      const rawCode=String(raw||"").trim(),rawKey=canonicalEquipmentCode(rawCode);if(!rawKey||(!fromMaster&&!looksLikeEquipmentCode(rawCode)))return;
      const master=explicitMaster||physicalIdentity.aliasToMaster.get(rawKey)||masterIndex.get(rawKey)||null;
      const groupKey=physicalIdentity.aliasToPreferred.get(rawKey)||canonicalEquipmentCode(physicalIdentity.preferredOf(master))||rawKey;
      const preferred=physicalIdentity.preferredOf(master)||cleanEquipmentCode(rawCode);
      const aliases=master?codesOfMaster(master).map(cleanEquipmentCode).filter(Boolean):[cleanEquipmentCode(rawCode)];
      const marca=pick(master||{},["Marca"]),modelo=pick(master||{},["Modelo"]),familia=pick(master||{},["Familia","Tipo"]);
      const next={key:groupKey,value:preferred,label:\`\${preferred}\${marca||modelo?\` · \${[marca,modelo].filter(Boolean).join(" ")}\`:familia?\` · \${familia}\`:""}\`,master,aliases};
      const current=catalog.get(groupKey);if(!current||(!current.master&&master))catalog.set(groupKey,next);
    };
    for(const row of listaEquipos||[]){const aliases=codesOfMaster(row);if(aliases.length)add(physicalIdentity.preferredOf(row)||aliases[0],row,true);}
    for(const bucket of rop02Index.values())if(bucket[0])add(sourceCode(bucket[0]));
    for(const bucket of rop05Index.values())if(bucket[0])add(sourceCode(bucket[0]));
    for(const bucket of rma15Index.values())if(bucket[0])add(sourceCode(bucket[0]));
    for(const bucket of movementIndex.values())if(bucket[0])add(bucket[0].internoNormalizado||bucket[0].interno);
    (pm.config||[]).forEach(r=>add(pick(r,["Interno","Codigo","Equipo"])));
    for(const bucket of pmRegIndex.values())if(bucket[0])add(pick(bucket[0],["Interno","Codigo","Equipo"]));
    return[...catalog.values()].sort((a,b)=>a.label.localeCompare(b.label,"es",{numeric:true,sensitivity:"base"}));
  },[listaEquipos,rop02Index,rop05Index,rma15Index,pm.config,pmRegIndex,masterIndex,movementIndex,physicalIdentity]);
  const projectOptions=useMemo(()=>[...new Set((rop02All||[]).map(r=>String(r.proyecto||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es",{sensitivity:"base"})),[rop02All]);
  const visibleCodes=useMemo(()=>{if(!selectedProject)return allCodes;const target=norm(selectedProject);return allCodes.filter(option=>(option.aliases||[option.value]).some(alias=>(rop02Index.get(canonicalEquipmentCode(alias))||[]).some(row=>norm(row.proyecto)===target)));},[allCodes,selectedProject,rop02Index]);`)

      out = out.replace(/  const selectedMasterRow=masterIndex\.get\(detailKey\)\|\|null;[\s\S]*?  const pmReg=useMemo\([\s\S]*?\);/,
`  const resolvedKey=physicalIdentity.aliasToPreferred.get(detailKey)||detailKey;
  const selectedMasterRow=physicalIdentity.aliasToMaster.get(detailKey)||physicalIdentity.aliasToMaster.get(resolvedKey)||masterIndex.get(detailKey)||masterIndex.get(resolvedKey)||null;
  const selectedPreferred=physicalIdentity.preferredOf(selectedMasterRow)||cleanEquipmentCode(resolvedKey);
  const selectedKey=canonicalEquipmentCode(selectedPreferred);
  const selectedOption=useMemo(()=>allCodes.find(o=>o.key===selectedKey)||null,[allCodes,selectedKey]);
  const master=selectedMasterRow||selectedOption?.master||physicalIdentity.aliasToMaster.get(selectedKey)||masterIndex.get(selectedKey)||null;
  const profileAliasKeys=useMemo(()=>{const keys=[];const add=v=>{const k=canonicalEquipmentCode(v);if(k&&!keys.includes(k))keys.push(k);};add(selectedKey);if(master)codesOfMaster(master).forEach(add);return keys;},[master,selectedKey]);
  const collectAliasRows=(index,sorter)=>{const seen=new Set(),rows=[];for(const key of profileAliasKeys)for(const row of index.get(key)||[]){if(seen.has(row))continue;seen.add(row);rows.push(row);}return sorter?[...rows].sort(sorter):rows;};
  const op=useMemo(()=>collectAliasRows(rop02Index,(a,b)=>String(a.fecha||"").localeCompare(String(b.fecha||""))),[rop02Index,profileAliasKeys]);
  const prod=useMemo(()=>collectAliasRows(rop05Index),[rop05Index,profileAliasKeys]);
  const mant=useMemo(()=>collectAliasRows(rma15Index,(a,b)=>String(b.fecha||"").localeCompare(String(a.fecha||""))),[rma15Index,profileAliasKeys]);
  const pmReg=useMemo(()=>collectAliasRows(pmRegIndex,(a,b)=>String(pick(b,["Fecha","Fecha PM"])||"").localeCompare(String(pick(a,["Fecha","Fecha PM"])||""))),[pmRegIndex,profileAliasKeys]);`)

      out = out.replace('    const cfg=pmCfgIndex.get(selectedKey)||{};','    const cfg=profileAliasKeys.map(key=>pmCfgIndex.get(key)).find(Boolean)||{};').replace('  },[pmCfgIndex,selectedKey,pmReg,summary.currentH]);','  },[pmCfgIndex,profileAliasKeys,pmReg,summary.currentH]);')
      out = out.replace(/  const projectMovements=useMemo\(\(\)=>\{[\s\S]*?\n  \},\[op,movementIndex,selectedKey(?:,profileAliasKeys)?\]\);/,`  const projectMovements=useMemo(()=>{const persisted=[],seen=new Set();for(const key of profileAliasKeys)for(const movement of movementIndex.get(key)||[]){const mk=movement?.id||[movement?.fecha,movement?.interno,movement?.desde,movement?.hasta,movement?.motivo].join('|');if(seen.has(mk))continue;seen.add(mk);persisted.push(movement);}return mergeEquipmentMovements(op,persisted,selectedKey);},[op,movementIndex,selectedKey,profileAliasKeys]);`)

      // El equipo ocupa toda la primera línea del panel.
      out = out.replace(/<div style=\{\{display:"grid",gridTemplateColumns:"minmax\(0,1fr\) 150px",gap:8,minWidth:0\}\}><EquipmentPicker options=\{visibleCodes\} value=\{selected\} onChange=\{handleSelect\}\/><select[\s\S]*?<\/select><\/div>/,
        '<EquipmentPicker options={visibleCodes} value={selected} onChange={handleSelect}/>')
      out = out.replace('<EquipmentPicker options={allCodes} value={selected} onChange={handleSelect}/>','<EquipmentPicker options={visibleCodes} value={selected} onChange={handleSelect}/>')
      out = out.replace('<EquipmentPicker options={allCodes} value={selected} onChange={v=>setSelected(cleanEquipmentCode(v))}/>','<EquipmentPicker options={visibleCodes} value={selected} onChange={v=>setSelected(cleanEquipmentCode(v))}/>')

      // Proyecto debajo de Mes. Desde/Hasta/Limpiar quedan siempre dentro del ancho.
      if(!out.includes('dm-equipment-project-filter')){
        out=out.replace(/(<label style=\{\{fontSize:9,color:C\.textMuted,fontWeight:800\}\}>MES[\s\S]*?<\/label>)(\s*<DateIn label="Desde")/,
          `$1<label className="dm-equipment-project-filter" style={{fontSize:9,color:C.textMuted,fontWeight:800,gridColumn:"1",gridRow:"2"}}>PROYECTO<select value={selectedProject} onChange={e=>setSelectedProject(e.target.value)} style={{display:"block",marginTop:4,width:"100%",minWidth:0,height:33,boxSizing:"border-box",background:"#151515",border:\`1px solid \${C.border}\`,color:C.text,borderRadius:8,padding:"0 8px",fontSize:11,fontWeight:700,outline:"none"}}><option value="">Todos los proyectos</option>{projectOptions.map(p=><option key={p} value={p}>{p}</option>)}</select></label>$2`)
      }
      out=out.replace(/gridTemplateColumns:"minmax\(145px,1\.2fr\) minmax\(120px,1fr\) minmax\(120px,1fr\) auto",alignItems:"end",gap:8/,
        'gridTemplateColumns:"minmax(0,1.1fr) minmax(0,1fr) minmax(0,1fr) 68px",gridTemplateRows:"auto auto",alignItems:"end",gap:8')
      out=out.replace(/gridTemplateColumns:"minmax\(135px,[^\"]+\",gridTemplateRows:"auto auto",alignItems:"end",gap:8/,
        'gridTemplateColumns:"minmax(0,1.1fr) minmax(0,1fr) minmax(0,1fr) 68px",gridTemplateRows:"auto auto",alignItems:"end",gap:8')
      out=out.replace('<button onClick={clearFilters} style={{background:','<button onClick={clearFilters} style={{gridColumn:"4",gridRow:"1",width:"100%",minWidth:0,padding:"7px 4px",background:')
      out=out.replace('const clearFilters=()=>{setSelectedMonth("");setFechaD("");setFechaH("");};','const clearFilters=()=>{setSelectedMonth("");setSelectedProject("");setFechaD("");setFechaH("");};')

      // El encabezado no recorta overlays y los controles pueden encogerse correctamente.
      out=out.replace('borderRadius:14,overflow:"hidden",boxShadow:','borderRadius:14,overflow:"visible",boxShadow:')
      out=out.replace('.dm-equipment-filter-row input,.dm-equipment-filter-row select{width:100%!important}', '.dm-equipment-filter-row input,.dm-equipment-filter-row select{width:100%!important;min-width:0!important;box-sizing:border-box!important}\n    .dm-equipment-project-filter{min-width:0}')
      out=out.replace(/interno:detailCode\|\|sourceCode\(r\),proyecto:r\.proyecto/g,'interno:sourceCode(r)||detailCode,proyecto:r.proyecto')

      return out === code ? null : { code: out, map: null }
    }
  }
}
