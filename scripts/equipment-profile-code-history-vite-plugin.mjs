const TARGET = '/src/modules/equipment/EquipmentProfileView.jsx'

export function equipmentProfileCodeHistoryVitePlugin() {
  return {
    name: 'delta-equipment-profile-code-history',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').endsWith(TARGET)) return null
      let out = code

      out = out.replace(/const MASTER_CODE_HEADERS=\[[^;]+\];/,
        'const MASTER_CODE_HEADERS=["Codigo nuevo","Código nuevo","CODIGO NUEVO","Código de Drusila","Codigo de Drusila","Código Drusila","Codigo Drusila","CODIGO DRUSILA","Interno","Código interno","Codigo interno","Codigo Int","Código Equipo","Codigo Equipo","Código viejo","Codigo viejo","CODIGO VIEJO","Código anterior","Codigo anterior","CODIGO ANTERIOR"];')

      out = out.replace(/function EquipmentPicker\(\{options,value,onChange\}\)\{[\s\S]*?\n\}/,
`function EquipmentPicker({options,value,onChange}){
  const [open,setOpen]=useState(false),[search,setSearch]=useState("");
  const ref=React.useRef(null);
  useEffect(()=>{const close=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};document.addEventListener("mousedown",close);return()=>document.removeEventListener("mousedown",close);},[]);
  const current=options.find(o=>canonicalEquipmentCode(o.value)===canonicalEquipmentCode(value))||null;
  const filtered=useMemo(()=>{const q=norm(search);return q?options.filter(o=>norm(o.label).includes(q)):options;},[options,search]);
  return <div ref={ref} style={{position:"relative",width:"100%",minWidth:0}}><button type="button" onClick={()=>setOpen(v=>!v)} style={{width:"100%",height:40,boxSizing:"border-box",borderRadius:8,border:\`1px solid \${C.border}\`,background:"#151515",color:C.text,padding:"0 36px 0 12px",fontSize:12,fontWeight:700,outline:"none",cursor:"pointer",textAlign:"left",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",position:"relative"}}>{current?.label||value||"Seleccionar equipo..."}<span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)"}}>⌄</span></button>{open&&<div style={{position:"absolute",top:"calc(100% + 5px)",left:0,right:0,zIndex:10000,background:"#141414",border:\`1px solid \${C.border}\`,borderRadius:9,boxShadow:"0 14px 36px rgba(0,0,0,.6)",padding:6,maxWidth:"100%"}}><input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar equipo..." style={{width:"100%",height:34,boxSizing:"border-box",borderRadius:7,border:\`1px solid \${C.border}\`,background:"#0f0f0f",color:C.text,padding:"0 10px",fontSize:11,outline:"none",marginBottom:5}}/><div style={{maxHeight:"min(320px, calc(100vh - 220px))",overflowY:"auto",overflowX:"hidden"}}>{filtered.map(o=><button type="button" key={o.key} onClick={()=>{onChange(o.value);setOpen(false);setSearch("");}} style={{display:"block",width:"100%",border:0,borderRadius:6,background:canonicalEquipmentCode(o.value)===canonicalEquipmentCode(value)?"rgba(37,99,235,.35)":"transparent",color:C.text,textAlign:"left",padding:"8px 9px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"normal",overflowWrap:"anywhere"}}>{o.label}</button>)}{!filtered.length&&<div style={{padding:12,color:C.textMuted,fontSize:11}}>Sin coincidencias</div>}</div></div>}</div>;
}`)

      out = out.replace('  const [selectedMonth,setSelectedMonth]=useState("");\n  const [activeTab,setActiveTab]=useState("resumen");','  const [selectedMonth,setSelectedMonth]=useState("");\n  const [selectedProject,setSelectedProject]=useState("");\n  const [activeTab,setActiveTab]=useState("resumen");')

      out = out.replace(/  const allCodes=useMemo\(\(\)=>\{[\s\S]*?\n  \},\[listaEquipos,rop02Index,rop05Index,rma15Index,pm\.config,pmRegIndex,masterIndex,movementIndex\]\);/,
`  const allCodes=useMemo(()=>{
    const catalog=new Map();
    const preferredOf=row=>cleanEquipmentCode(pick(row||{},["Código nuevo","Codigo nuevo","CODIGO NUEVO"])||pick(row||{},["Código de Drusila","Codigo de Drusila","Código Drusila","Codigo Drusila"])||codesOfMaster(row||{})[0]||"");
    const add=(raw,explicitMaster=null,fromMaster=false)=>{const rawCode=String(raw||"").trim(),rawKey=canonicalEquipmentCode(rawCode);if(!rawKey||(!fromMaster&&!looksLikeEquipmentCode(rawCode)))return;const master=explicitMaster||masterIndex.get(rawKey)||null;const preferred=preferredOf(master)||cleanEquipmentCode(rawCode),groupKey=canonicalEquipmentCode(preferred)||rawKey;if(catalog.has(groupKey))return;const aliases=master?codesOfMaster(master).map(cleanEquipmentCode).filter(Boolean):[cleanEquipmentCode(rawCode)];const marca=pick(master||{},["Marca"]),modelo=pick(master||{},["Modelo"]),familia=pick(master||{},["Familia","Tipo"]);catalog.set(groupKey,{key:groupKey,value:preferred,label:\`\${preferred}\${marca||modelo?\` · \${[marca,modelo].filter(Boolean).join(" ")}\`:familia?\` · \${familia}\`:""}\`,master,aliases});};
    listaEquipos.forEach(row=>{const preferred=preferredOf(row)||codesOfMaster(row)[0];if(preferred)add(preferred,row,true);});
    for(const bucket of rop02Index.values())if(bucket[0])add(sourceCode(bucket[0]));for(const bucket of rop05Index.values())if(bucket[0])add(sourceCode(bucket[0]));for(const bucket of rma15Index.values())if(bucket[0])add(sourceCode(bucket[0]));for(const bucket of movementIndex.values())if(bucket[0])add(bucket[0].internoNormalizado||bucket[0].interno);(pm.config||[]).forEach(r=>add(pick(r,["Interno","Codigo","Equipo"])));for(const bucket of pmRegIndex.values())if(bucket[0])add(pick(bucket[0],["Interno","Codigo","Equipo"]));
    return [...catalog.values()].sort((a,b)=>a.label.localeCompare(b.label,"es",{numeric:true,sensitivity:"base"}));
  },[listaEquipos,rop02Index,rop05Index,rma15Index,pm.config,pmRegIndex,masterIndex,movementIndex]);
  const projectOptions=useMemo(()=>[...new Set((rop02All||[]).map(r=>String(r.proyecto||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es",{sensitivity:"base"})),[rop02All]);
  const visibleCodes=useMemo(()=>{if(!selectedProject)return allCodes;const target=norm(selectedProject);return allCodes.filter(option=>(option.aliases||[option.value]).some(alias=>(rop02Index.get(canonicalEquipmentCode(alias))||[]).some(row=>norm(row.proyecto)===target)));},[allCodes,selectedProject,rop02Index]);`)

      out = out.replace(/  const selectedKey=detailKey;[\s\S]*?  const pmReg=pmRegIndex\.get\(selectedKey\)\|\|\[\];/,
`  const selectedMasterRow=masterIndex.get(detailKey)||null;
  const preferredOfMaster=row=>cleanEquipmentCode(pick(row||{},["Código nuevo","Codigo nuevo","CODIGO NUEVO"])||pick(row||{},["Código de Drusila","Codigo de Drusila","Código Drusila","Codigo Drusila"])||codesOfMaster(row||{})[0]||"");
  const selectedPreferred=preferredOfMaster(selectedMasterRow)||cleanEquipmentCode(detailKey);
  const selectedKey=canonicalEquipmentCode(selectedPreferred);
  const selectedOption=useMemo(()=>allCodes.find(o=>o.key===selectedKey)||null,[allCodes,selectedKey]);
  const master=selectedMasterRow||selectedOption?.master||masterIndex.get(selectedKey)||null;
  const profileAliasKeys=useMemo(()=>{const keys=[];const add=v=>{const k=canonicalEquipmentCode(v);if(k&&!keys.includes(k))keys.push(k);};add(selectedKey);if(master)codesOfMaster(master).forEach(add);return keys;},[master,selectedKey]);
  const collectAliasRows=(index,sorter)=>{const seen=new Set(),rows=[];for(const key of profileAliasKeys)for(const row of index.get(key)||[]){if(seen.has(row))continue;seen.add(row);rows.push(row);}return sorter?[...rows].sort(sorter):rows;};
  const op=useMemo(()=>collectAliasRows(rop02Index,(a,b)=>String(a.fecha||"").localeCompare(String(b.fecha||""))),[rop02Index,profileAliasKeys]);
  const prod=useMemo(()=>collectAliasRows(rop05Index),[rop05Index,profileAliasKeys]);
  const mant=useMemo(()=>collectAliasRows(rma15Index,(a,b)=>String(b.fecha||"").localeCompare(String(a.fecha||""))),[rma15Index,profileAliasKeys]);
  const pmReg=useMemo(()=>collectAliasRows(pmRegIndex,(a,b)=>String(pick(b,["Fecha","Fecha PM"])||"").localeCompare(String(pick(a,["Fecha","Fecha PM"])||""))),[pmRegIndex,profileAliasKeys]);`)

      out = out.replace('    const cfg=pmCfgIndex.get(selectedKey)||{};','    const cfg=profileAliasKeys.map(key=>pmCfgIndex.get(key)).find(Boolean)||{};').replace('  },[pmCfgIndex,selectedKey,pmReg,summary.currentH]);','  },[pmCfgIndex,profileAliasKeys,pmReg,summary.currentH]);')
      out = out.replace(/  const projectMovements=useMemo\(\(\)=>\{\n    return mergeEquipmentMovements\(op,movementIndex\.get\(selectedKey\)\|\|\[\],selectedKey\);\n  \},\[op,movementIndex,selectedKey\]\);/,`  const projectMovements=useMemo(()=>{const persisted=[],seen=new Set();for(const key of profileAliasKeys)for(const movement of movementIndex.get(key)||[]){const mk=movement?.id||[movement?.fecha,movement?.interno,movement?.desde,movement?.hasta,movement?.motivo].join('|');if(seen.has(mk))continue;seen.add(mk);persisted.push(movement);}return mergeEquipmentMovements(op,persisted,selectedKey);},[op,movementIndex,selectedKey,profileAliasKeys]);`)

      out = out.replace('<EquipmentPicker options={allCodes} value={selected} onChange={handleSelect}/>','<div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 150px",gap:8,minWidth:0}}><EquipmentPicker options={visibleCodes} value={selected} onChange={handleSelect}/><select value={selectedProject} onChange={e=>setSelectedProject(e.target.value)} style={{width:"100%",minWidth:0,height:40,boxSizing:"border-box",borderRadius:8,border:`1px solid ${C.border}`,background:"#151515",color:C.text,padding:"0 8px",fontSize:11,fontWeight:700,outline:"none"}}><option value="">Todos los proyectos</option>{projectOptions.map(p=><option key={p} value={p}>{p}</option>)}</select></div>')
      out = out.replace(/interno:detailCode\|\|sourceCode\(r\),proyecto:r\.proyecto/g,'interno:sourceCode(r)||detailCode,proyecto:r.proyecto')
      return out === code ? null : { code: out, map: null }
    }
  }
}
