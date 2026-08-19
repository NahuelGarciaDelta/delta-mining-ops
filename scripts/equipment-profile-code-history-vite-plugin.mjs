const TARGET = '/src/modules/equipment/EquipmentProfileView.jsx'

export function equipmentProfileCodeHistoryVitePlugin() {
  return {
    name: 'delta-equipment-profile-code-history',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').endsWith(TARGET)) return null
      let out = code

      // Ficha Única: todos los códigos de una misma fila de Lista Maestra son aliases
      // del mismo equipo físico. No altera ROP02/ROP05/RMA15 fuera de esta vista.
      out = out.replace(/const MASTER_CODE_HEADERS=\[[^;]+\];/,
        'const MASTER_CODE_HEADERS=["Codigo nuevo","Código nuevo","CODIGO NUEVO","Código de Drusila","Codigo de Drusila","Código Drusila","Codigo Drusila","CODIGO DRUSILA","Interno","Código interno","Codigo interno","Codigo Int","Código Equipo","Codigo Equipo","Código viejo","Codigo viejo","CODIGO VIEJO","Código anterior","Codigo anterior","CODIGO ANTERIOR"];')

      // Dropdown con portal visual (position:fixed): queda por encima de TODA la app y
      // nunca lo recorta el header/cards. Se reposiciona según el botón.
      out = out.replace(/function EquipmentPicker\(\{options,value,onChange\}\)\{[\s\S]*?\n\}/,
`function EquipmentPicker({options,value,onChange}){
  const [open,setOpen]=useState(false),[search,setSearch]=useState("");
  const [box,setBox]=useState(null);
  const ref=React.useRef(null),buttonRef=React.useRef(null);
  const place=()=>{const r=buttonRef.current?.getBoundingClientRect();if(r)setBox({left:r.left,top:r.bottom+5,width:r.width});};
  useEffect(()=>{if(!open)return;place();const fn=()=>place();window.addEventListener("resize",fn);window.addEventListener("scroll",fn,true);return()=>{window.removeEventListener("resize",fn);window.removeEventListener("scroll",fn,true);};},[open]);
  useEffect(()=>{const close=e=>{if(ref.current&&!ref.current.contains(e.target)&&!buttonRef.current?.contains(e.target))setOpen(false);};document.addEventListener("mousedown",close);return()=>document.removeEventListener("mousedown",close);},[]);
  const current=options.find(o=>canonicalEquipmentCode(o.value)===canonicalEquipmentCode(value))||null;
  const filtered=useMemo(()=>{const q=norm(search);return q?options.filter(o=>norm(o.label).includes(q)):options;},[options,search]);
  return <div style={{position:"relative",width:"100%",minWidth:0}}>
    <button ref={buttonRef} type="button" onClick={()=>{place();setOpen(v=>!v);}} style={{width:"100%",height:40,boxSizing:"border-box",borderRadius:8,border:\`1px solid \${C.border}\`,background:"#151515",color:C.text,padding:"0 36px 0 12px",fontSize:12,fontWeight:700,outline:"none",cursor:"pointer",textAlign:"left",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",position:"relative"}}>{current?.label||value||"Seleccionar equipo..."}<span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)"}}>⌄</span></button>
    {open&&box&&<div ref={ref} style={{position:"fixed",left:box.left,top:box.top,width:box.width,zIndex:2147483647,background:"#141414",border:\`1px solid \${C.border}\`,borderRadius:9,boxShadow:"0 18px 44px rgba(0,0,0,.72)",padding:6,boxSizing:"border-box"}}>
      <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar equipo..." style={{width:"100%",height:34,boxSizing:"border-box",borderRadius:7,border:\`1px solid \${C.border}\`,background:"#0f0f0f",color:C.text,padding:"0 10px",fontSize:11,outline:"none",marginBottom:5}}/>
      <div style={{maxHeight:"min(380px, calc(100vh - 160px))",overflowY:"auto",overflowX:"hidden",overscrollBehavior:"contain"}}>{filtered.map(o=><button type="button" key={o.key} onClick={()=>{onChange(o.value);setOpen(false);setSearch("");}} style={{display:"block",width:"100%",border:0,borderRadius:6,background:canonicalEquipmentCode(o.value)===canonicalEquipmentCode(value)?"rgba(37,99,235,.35)":"transparent",color:C.text,textAlign:"left",padding:"8px 9px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"normal",overflowWrap:"anywhere"}}>{o.label}</button>)}{!filtered.length&&<div style={{padding:12,color:C.textMuted,fontSize:11}}>Sin coincidencias</div>}</div>
    </div>}
  </div>;
}`)

      out = out.replace('  const [selectedMonth,setSelectedMonth]=useState("");\n  const [activeTab,setActiveTab]=useState("resumen");',
        '  const [selectedMonth,setSelectedMonth]=useState("");\n  const [selectedProject,setSelectedProject]=useState("");\n  const [activeTab,setActiveTab]=useState("resumen");')

      // Catálogo único por equipo físico. resolveMaster() también compara códigos
      // ignorando guiones/espacios para cubrir TOP0039 vs TOP-0039, etc.
      out = out.replace(/  const allCodes=useMemo\(\(\)=>\{[\s\S]*?\n  \},\[listaEquipos,rop02Index,rop05Index,rma15Index,pm\.config,pmRegIndex,masterIndex,movementIndex\]\);(?:\n  const projectOptions[\s\S]*?\[allCodes,selectedProject,rop02Index\]\);)?/,
`  const identityToken=value=>String(value||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
  const resolveMaster=raw=>{
    const direct=masterIndex.get(canonicalEquipmentCode(raw));
    if(direct)return direct;
    const token=identityToken(raw);
    if(!token)return null;
    return (listaEquipos||[]).find(row=>codesOfMaster(row).some(code=>identityToken(code)===token))||null;
  };
  const preferredOfMaster=row=>cleanEquipmentCode(
    pick(row||{},["Código nuevo","Codigo nuevo","CODIGO NUEVO"])||
    pick(row||{},["Código de Drusila","Codigo de Drusila","Código Drusila","Codigo Drusila","CODIGO DRUSILA"])||
    codesOfMaster(row||{})[0]||""
  );
  const allCodes=useMemo(()=>{
    const catalog=new Map(),claimedAliases=new Map();
    const add=(raw,explicitMaster=null,fromMaster=false)=>{
      const rawCode=String(raw||"").trim();
      if(!rawCode||(!fromMaster&&!looksLikeEquipmentCode(rawCode)))return;
      const master=explicitMaster||resolveMaster(rawCode)||null;
      const aliases=master?codesOfMaster(master).map(cleanEquipmentCode).filter(Boolean):[cleanEquipmentCode(rawCode)];
      const preferred=preferredOfMaster(master)||cleanEquipmentCode(rawCode);
      const groupKey=identityToken(preferred)||identityToken(rawCode);
      if(!groupKey)return;
      const aliasTokens=[...new Set(aliases.map(identityToken).filter(Boolean))];
      const alreadyOwned=aliasTokens.map(t=>claimedAliases.get(t)).find(Boolean);
      const effectiveKey=alreadyOwned||groupKey;
      const marca=pick(master||{},["Marca"]),modelo=pick(master||{},["Modelo"]),familia=pick(master||{},["Familia","Tipo"]);
      const next={key:effectiveKey,value:preferred,label:\`\${preferred}\${marca||modelo?\` · \${[marca,modelo].filter(Boolean).join(" ")}\`:familia?\` · \${familia}\`:""}\`,master,aliases};
      const existing=catalog.get(effectiveKey);
      if(!existing||(!existing.master&&master))catalog.set(effectiveKey,next);
      aliasTokens.forEach(t=>claimedAliases.set(t,effectiveKey));
    };
    for(const row of listaEquipos||[]){const aliases=codesOfMaster(row);if(aliases.length)add(preferredOfMaster(row)||aliases[0],row,true);}
    for(const bucket of rop02Index.values())if(bucket?.[0])add(sourceCode(bucket[0]));
    for(const bucket of rop05Index.values())if(bucket?.[0])add(sourceCode(bucket[0]));
    for(const bucket of rma15Index.values())if(bucket?.[0])add(sourceCode(bucket[0]));
    for(const bucket of movementIndex.values())if(bucket?.[0])add(bucket[0].internoNormalizado||bucket[0].interno);
    (pm.config||[]).forEach(r=>add(pick(r,["Interno","Codigo","Equipo"])));
    for(const bucket of pmRegIndex.values())if(bucket?.[0])add(pick(bucket[0],["Interno","Codigo","Equipo"]));
    return [...catalog.values()].sort((a,b)=>a.label.localeCompare(b.label,"es",{numeric:true,sensitivity:"base"}));
  },[listaEquipos,rop02Index,rop05Index,rma15Index,pm.config,pmRegIndex,masterIndex,movementIndex]);
  const projectOptions=useMemo(()=>[...new Set((rop02All||[]).map(r=>String(r.proyecto||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es",{sensitivity:"base"})),[rop02All]);
  const visibleCodes=useMemo(()=>{if(!selectedProject)return allCodes;const target=norm(selectedProject);return allCodes.filter(option=>(option.aliases||[option.value]).some(alias=>(rop02Index.get(canonicalEquipmentCode(alias))||[]).some(row=>norm(row.proyecto)===target)));},[allCodes,selectedProject,rop02Index]);`)

      // Seleccionar cualquier alias abre la ficha del mismo equipo físico y reúne sus
      // registros históricos manteniendo el interno original de cada fila.
      out = out.replace(/  const selectedKey=detailKey;[\s\S]*?  const pmReg=pmRegIndex\.get\(selectedKey\)\|\|\[\];/,
`  const selectedMasterRow=resolveMaster(detailKey)||null;
  const selectedPreferred=preferredOfMaster(selectedMasterRow)||cleanEquipmentCode(detailKey);
  const selectedKey=identityToken(selectedPreferred);
  const selectedOption=useMemo(()=>allCodes.find(o=>o.key===selectedKey||identityToken(o.value)===selectedKey)||null,[allCodes,selectedKey]);
  const master=selectedMasterRow||selectedOption?.master||resolveMaster(selectedPreferred)||null;
  const profileAliasKeys=useMemo(()=>{const keys=[];const add=v=>{const k=canonicalEquipmentCode(v);if(k&&!keys.includes(k))keys.push(k);};add(selectedPreferred);add(detailKey);if(master)codesOfMaster(master).forEach(add);return keys;},[master,selectedPreferred,detailKey]);
  const collectAliasRows=(index,sorter)=>{const seen=new Set(),rows=[];for(const key of profileAliasKeys)for(const row of index.get(key)||[]){if(seen.has(row))continue;seen.add(row);rows.push(row);}return sorter?[...rows].sort(sorter):rows;};
  const op=useMemo(()=>collectAliasRows(rop02Index,(a,b)=>String(a.fecha||"").localeCompare(String(b.fecha||""))),[rop02Index,profileAliasKeys]);
  const prod=useMemo(()=>collectAliasRows(rop05Index),[rop05Index,profileAliasKeys]);
  const mant=useMemo(()=>collectAliasRows(rma15Index,(a,b)=>String(b.fecha||"").localeCompare(String(a.fecha||""))),[rma15Index,profileAliasKeys]);
  const pmReg=useMemo(()=>collectAliasRows(pmRegIndex,(a,b)=>String(pick(b,["Fecha","Fecha PM"])||"").localeCompare(String(pick(a,["Fecha","Fecha PM"])||""))),[pmRegIndex,profileAliasKeys]);`)

      out = out.replace('    const cfg=pmCfgIndex.get(selectedKey)||{};',
        '    const cfg=profileAliasKeys.map(key=>pmCfgIndex.get(key)).find(Boolean)||{};')
      out = out.replace('  },[pmCfgIndex,selectedKey,pmReg,summary.currentH]);',
        '  },[pmCfgIndex,profileAliasKeys,pmReg,summary.currentH]);')
      out = out.replace(/  const projectMovements=useMemo\(\(\)=>\{\n    return mergeEquipmentMovements\(op,movementIndex\.get\(selectedKey\)\|\|\[\],selectedKey\);\n  \},\[op,movementIndex,selectedKey\]\);/,
        `  const projectMovements=useMemo(()=>{const persisted=[],seen=new Set();for(const key of profileAliasKeys)for(const movement of movementIndex.get(key)||[]){const mk=movement?.id||[movement?.fecha,movement?.interno,movement?.desde,movement?.hasta,movement?.motivo].join('|');if(seen.has(mk))continue;seen.add(mk);persisted.push(movement);}return mergeEquipmentMovements(op,persisted,selectedPreferred);},[op,movementIndex,selectedPreferred,profileAliasKeys]);`)

      // Selector siempre usa la lista filtrada por proyecto. NO agregamos otro select
      // junto al equipo: proyecto va debajo de MES en el bloque de filtros.
      out = out.replace(/<EquipmentPicker options=\{allCodes\} value=\{selected\} onChange=\{handleSelect\}\/>/g,
        '<EquipmentPicker options={visibleCodes} value={selected} onChange={handleSelect}/>')
      out = out.replace(/<EquipmentPicker options=\{allCodes\} value=\{selected\} onChange=\{v=>setSelected\(cleanEquipmentCode\(v\)\)\}\/>/g,
        '<EquipmentPicker options={visibleCodes} value={selected} onChange={v=>setSelected(cleanEquipmentCode(v))}/>')

      // Proyecto debajo de MES. Limpiar queda fijo dentro del panel y limpia proyecto.
      if (!out.includes('dm-equipment-project-filter')) {
        out = out.replace(
          /(<label style=\{\{fontSize:9,color:C\.textMuted,fontWeight:800\}\}>MES[\s\S]*?<\/label>)(\s*<DateIn label="Desde")/,
          `$1<label className="dm-equipment-project-filter" style={{fontSize:9,color:C.textMuted,fontWeight:800,gridColumn:"1 / 3",gridRow:"2"}}>PROYECTO<select value={selectedProject} onChange={e=>setSelectedProject(e.target.value)} style={{display:"block",marginTop:4,width:"100%",height:33,boxSizing:"border-box",background:"#151515",border:\`1px solid \${C.border}\`,color:C.text,borderRadius:8,padding:"0 9px",fontSize:11,fontWeight:700,outline:"none"}}><option value="">Todos los proyectos</option>{projectOptions.map(p=><option key={p} value={p}>{p}</option>)}</select></label>$2`
        )
      }
      out = out.replace(
        'gridTemplateColumns:"minmax(145px,1.2fr) minmax(120px,1fr) minmax(120px,1fr) auto",alignItems:"end",gap:8',
        'gridTemplateColumns:"minmax(135px,1fr) minmax(110px,.9fr) minmax(110px,.9fr) 76px",gridTemplateRows:"auto auto",alignItems:"end",gap:8'
      )
      out = out.replace(
        '<button onClick={clearFilters} style={{background:',
        '<button onClick={clearFilters} style={{gridColumn:"4",gridRow:"1",width:"100%",minWidth:0,background:'
      )
      out = out.replace(
        'const clearFilters=()=>{setSelectedMonth("");setFechaD("");setFechaH("");};',
        'const clearFilters=()=>{setSelectedMonth("");setSelectedProject("");setFechaD("");setFechaH("");};'
      )

      // Header/panel sin clipping. El dropdown usa fixed, pero esto también evita
      // recortes visuales de los filtros.
      out = out.replace('borderRadius:14,overflow:"hidden",boxShadow:',
        'borderRadius:14,overflow:"visible",position:"relative",zIndex:100,boxShadow:')
      out = out.replace(
        '.dm-equipment-filter-row input,.dm-equipment-filter-row select{width:100%!important}',
        '.dm-equipment-filter-row input,.dm-equipment-filter-row select{width:100%!important}\n    .dm-equipment-project-filter{min-width:0}'
      )

      out = out.replace(/interno:detailCode\|\|sourceCode\(r\),proyecto:r\.proyecto/g,
        'interno:sourceCode(r)||detailCode,proyecto:r.proyecto')

      return out === code ? null : { code: out, map: null }
    }
  }
}
