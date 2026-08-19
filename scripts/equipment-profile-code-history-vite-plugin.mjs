const TARGET = '/src/modules/equipment/EquipmentProfileView.jsx'

export function equipmentProfileCodeHistoryVitePlugin() {
  return {
    name: 'delta-equipment-profile-code-history',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').endsWith(TARGET)) return null
      let out = code

      // SOLO Ficha Única: todos los identificadores declarados en la misma fila de
      // Lista Maestra forman un único grupo de identidad histórica. Esto incluye
      // Código nuevo, Código anterior/viejo, Código de Drusila, interno y variantes.
      // No se reescriben ni agrupan los registros fuente en ROP02/ROP05/RMA15.
      out = out.replace(
        'const MASTER_CODE_HEADERS=["Codigo nuevo","Código nuevo","Código de Drusila","Codigo de Drusila","Código Drusila","Codigo Drusila","Interno","Código interno","Codigo Int","Código viejo","Codigo viejo"];',
        'const MASTER_CODE_HEADERS=["Codigo nuevo","Código nuevo","CODIGO NUEVO","Código de Drusila","Codigo de Drusila","Código Drusila","Codigo Drusila","CODIGO DRUSILA","Interno","Código interno","Codigo interno","Codigo Int","Código Equipo","Codigo Equipo","Código viejo","Codigo viejo","CODIGO VIEJO","Código anterior","Codigo anterior","CODIGO ANTERIOR"];'
      )

      // Reemplazamos el select nativo por un desplegable controlado, con altura máxima,
      // búsqueda y scroll interno. Así nunca se sale de la pantalla aunque haya cientos
      // de equipos.
      out = out.replace(
`function EquipmentPicker({options,value,onChange}){
  return <select value={value||""} onChange={e=>onChange(e.target.value)} style={{width:"100%",height:40,boxSizing:"border-box",borderRadius:8,border:\`1px solid \${C.border}\`,background:"#151515",color:C.text,padding:"0 12px",fontSize:12,fontWeight:700,outline:"none",cursor:"pointer"}}>
    <option value="">Seleccionar equipo...</option>
    {options.map(o=><option key={o.key} value={o.value}>{o.label}</option>)}
  </select>;
}`,
`function EquipmentPicker({options,value,onChange}){
  const [open,setOpen]=useState(false);
  const [search,setSearch]=useState("");
  const ref=React.useRef(null);
  useEffect(()=>{const close=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};document.addEventListener("mousedown",close);return()=>document.removeEventListener("mousedown",close);},[]);
  const current=options.find(o=>canonicalEquipmentCode(o.value)===canonicalEquipmentCode(value))||null;
  const filtered=useMemo(()=>{const q=norm(search);return q?options.filter(o=>norm(o.label).includes(q)):options;},[options,search]);
  return <div ref={ref} style={{position:"relative",width:"100%",minWidth:0}}>
    <button type="button" onClick={()=>setOpen(v=>!v)} style={{width:"100%",height:40,boxSizing:"border-box",borderRadius:8,border:\`1px solid \${C.border}\`,background:"#151515",color:C.text,padding:"0 36px 0 12px",fontSize:12,fontWeight:700,outline:"none",cursor:"pointer",textAlign:"left",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",position:"relative"}}>
      {current?.label||value||"Seleccionar equipo..."}<span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",fontSize:11}}>⌄</span>
    </button>
    {open&&<div style={{position:"absolute",top:"calc(100% + 5px)",left:0,right:0,zIndex:10000,background:"#141414",border:\`1px solid \${C.border}\`,borderRadius:9,boxShadow:"0 14px 36px rgba(0,0,0,.6)",padding:6,minWidth:0,maxWidth:"100%"}}>
      <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar equipo..." style={{width:"100%",height:34,boxSizing:"border-box",borderRadius:7,border:\`1px solid \${C.border}\`,background:"#0f0f0f",color:C.text,padding:"0 10px",fontSize:11,outline:"none",marginBottom:5}}/>
      <div style={{maxHeight:"min(320px, calc(100vh - 210px))",overflowY:"auto",overflowX:"hidden"}}>
        {filtered.map(o=><button type="button" key={o.key} onClick={()=>{onChange(o.value);setOpen(false);setSearch("");}} style={{display:"block",width:"100%",border:0,borderRadius:6,background:canonicalEquipmentCode(o.value)===canonicalEquipmentCode(value)?"rgba(37,99,235,.35)":"transparent",color:C.text,textAlign:"left",padding:"8px 9px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"normal",overflowWrap:"anywhere"}}>{o.label}</button>)}
        {!filtered.length&&<div style={{padding:12,color:C.textMuted,fontSize:11}}>Sin coincidencias</div>}
      </div>
    </div>}
  </div>;
}`
      )

      // Agregamos estado de proyecto para filtrar el selector sin modificar el historial
      // de los registros originales.
      out = out.replace(
        '  const [selectedMonth,setSelectedMonth]=useState("");\n  const [activeTab,setActiveTab]=useState("resumen");',
        '  const [selectedMonth,setSelectedMonth]=useState("");\n  const [selectedProject,setSelectedProject]=useState("");\n  const [activeTab,setActiveTab]=useState("resumen");'
      )

      // Un único option por equipo físico. Si TOP-0039, TOP-0067 y/o otro código están
      // declarados en la misma fila de Lista Maestra, todos apuntan al código preferido
      // de esa fila y no vuelven a aparecer duplicados en el selector.
      out = out.replace(
`  const allCodes=useMemo(()=>{
    const catalog=new Map();
    const add=(raw,explicitMaster=null,fromMaster=false)=>{
      const rawCode=String(raw||"").trim();
      const key=canonicalEquipmentCode(rawCode);
      if(!key||(!fromMaster&&!looksLikeEquipmentCode(rawCode)))return;
      const master=explicitMaster||masterIndex.get(key)||null;
      const masterCodes=master?codesOfMaster(master):[];
      const preferred=cleanEquipmentCode(masterCodes[0]||rawCode);
      const existing=catalog.get(key);
      if(existing&&(!master||existing.master))return;
      const marca=pick(master||{},["Marca"]),modelo=pick(master||{},["Modelo"]),familia=pick(master||{},["Familia","Tipo"]);
      catalog.set(key,{key,value:preferred,label:\`\${preferred}\${marca||modelo?\` · \${[marca,modelo].filter(Boolean).join(" ")}\`:familia?\` · \${familia}\`:""}\`,master});
    };
    listaEquipos.forEach(row=>{const codes=codesOfMaster(row);if(codes.length)add(codes[0],row,true);});
    // Los índices ya recorrieron las fuentes completas: reutilizarlos evita una segunda
    // pasada por miles de registros sólo para construir el desplegable.
    for(const bucket of rop02Index.values())if(bucket[0])add(sourceCode(bucket[0]));
    for(const bucket of rop05Index.values())if(bucket[0])add(sourceCode(bucket[0]));
    for(const bucket of rma15Index.values())if(bucket[0])add(sourceCode(bucket[0]));
    for(const bucket of movementIndex.values())if(bucket[0])add(bucket[0].internoNormalizado||bucket[0].interno);
    (pm.config||[]).forEach(r=>add(pick(r,["Interno","Codigo","Equipo"])));
    for(const bucket of pmRegIndex.values())if(bucket[0])add(pick(bucket[0],["Interno","Codigo","Equipo"]));
    return [...catalog.values()].sort((a,b)=>a.label.localeCompare(b.label,"es",{numeric:true,sensitivity:"base"}));
  },[listaEquipos,rop02Index,rop05Index,rma15Index,pm.config,pmRegIndex,masterIndex,movementIndex]);`,
`  const allCodes=useMemo(()=>{
    const catalog=new Map();
    const add=(raw,explicitMaster=null,fromMaster=false)=>{
      const rawCode=String(raw||"").trim();
      const rawKey=canonicalEquipmentCode(rawCode);
      if(!rawKey||(!fromMaster&&!looksLikeEquipmentCode(rawCode)))return;
      const master=explicitMaster||masterIndex.get(rawKey)||null;
      const masterCodes=master?codesOfMaster(master):[];
      const preferred=cleanEquipmentCode(masterCodes[0]||rawCode);
      const groupKey=canonicalEquipmentCode(preferred)||rawKey;
      const existing=catalog.get(groupKey);
      if(existing&&(!master||existing.master))return;
      const marca=pick(master||{},["Marca"]),modelo=pick(master||{},["Modelo"]),familia=pick(master||{},["Familia","Tipo"]);
      const aliases=masterCodes.map(cleanEquipmentCode).filter(Boolean);
      const oldAliases=aliases.filter(c=>canonicalEquipmentCode(c)!==groupKey);
      const aliasText=oldAliases.length?\` (antes: \${oldAliases.join(" / ")})\`:"";
      catalog.set(groupKey,{key:groupKey,value:preferred,label:\`\${preferred}\${aliasText}\${marca||modelo?\` · \${[marca,modelo].filter(Boolean).join(" ")}\`:familia?\` · \${familia}\`:""}\`,master,aliases});
    };
    listaEquipos.forEach(row=>{const codes=codesOfMaster(row);if(codes.length)add(codes[0],row,true);});
    for(const bucket of rop02Index.values())if(bucket[0])add(sourceCode(bucket[0]));
    for(const bucket of rop05Index.values())if(bucket[0])add(sourceCode(bucket[0]));
    for(const bucket of rma15Index.values())if(bucket[0])add(sourceCode(bucket[0]));
    for(const bucket of movementIndex.values())if(bucket[0])add(bucket[0].internoNormalizado||bucket[0].interno);
    (pm.config||[]).forEach(r=>add(pick(r,["Interno","Codigo","Equipo"])));
    for(const bucket of pmRegIndex.values())if(bucket[0])add(pick(bucket[0],["Interno","Codigo","Equipo"]));
    return [...catalog.values()].sort((a,b)=>a.label.localeCompare(b.label,"es",{numeric:true,sensitivity:"base"}));
  },[listaEquipos,rop02Index,rop05Index,rma15Index,pm.config,pmRegIndex,masterIndex,movementIndex]);

  const projectOptions=useMemo(()=>[...new Set((rop02All||[]).map(r=>String(r.proyecto||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es",{sensitivity:"base"})),[rop02All]);
  const visibleCodes=useMemo(()=>{
    if(!selectedProject)return allCodes;
    const target=norm(selectedProject);
    return allCodes.filter(option=>{
      const aliases=option.aliases?.length?option.aliases:(option.master?codesOfMaster(option.master):[option.value]);
      return aliases.some(alias=>(rop02Index.get(canonicalEquipmentCode(alias))||[]).some(row=>norm(row.proyecto)===target));
    });
  },[allCodes,selectedProject,rop02Index]);`
      )

      // Normalizamos también la selección actual al código preferido de la fila maestra,
      // para que un sessionStorage viejo con TOP-0039 abra la misma ficha que TOP-0067.
      out = out.replace(
        '  const selectedKey=detailKey;\n  const selectedOption=useMemo(()=>allCodes.find(o=>o.key===selectedKey)||null,[allCodes,selectedKey]);\n  const master=masterIndex.get(selectedKey)||selectedOption?.master||null;',
        '  const selectedMasterRow=masterIndex.get(detailKey)||null;\n  const selectedPreferred=cleanEquipmentCode((selectedMasterRow?codesOfMaster(selectedMasterRow)[0]:"")||detailKey);\n  const selectedKey=canonicalEquipmentCode(selectedPreferred);\n  const selectedOption=useMemo(()=>allCodes.find(o=>o.key===selectedKey)||null,[allCodes,selectedKey]);\n  const master=selectedMasterRow||selectedOption?.master||null;'
      )

      // El índice maestro original ya indexa todos los MASTER_CODE_HEADERS contra la
      // misma fila. A partir de cualquiera de esos códigos obtenemos la fila y luego
      // todo el conjunto de aliases de ese equipo físico.
      out = out.replace(
        '  const master=masterIndex.get(selectedKey)||selectedOption?.master||null;\n  const op=rop02Index.get(selectedKey)||[];\n  const prod=rop05Index.get(selectedKey)||[];\n  const mant=rma15Index.get(selectedKey)||[];\n  const pmReg=pmRegIndex.get(selectedKey)||[];',
        `  const master=masterIndex.get(selectedKey)||selectedOption?.master||null;\n  const profileAliasKeys=useMemo(()=>{\n    const keys=[];\n    const add=value=>{const k=canonicalEquipmentCode(value);if(k&&!keys.includes(k))keys.push(k);};\n    add(selectedKey);\n    if(master)codesOfMaster(master).forEach(add);\n    return keys;\n  },[master,selectedKey]);\n  const collectAliasRows=(index,sorter)=>{\n    const seen=new Set();\n    const rows=[];\n    for(const key of profileAliasKeys){\n      for(const row of index.get(key)||[]){\n        if(seen.has(row))continue;\n        seen.add(row);\n        rows.push(row);\n      }\n    }\n    return sorter?[...rows].sort(sorter):rows;\n  };\n  const op=useMemo(()=>collectAliasRows(rop02Index,(a,b)=>String(a.fecha||\"\").localeCompare(String(b.fecha||\"\"))),[rop02Index,profileAliasKeys]);\n  const prod=useMemo(()=>collectAliasRows(rop05Index),[rop05Index,profileAliasKeys]);\n  const mant=useMemo(()=>collectAliasRows(rma15Index,(a,b)=>String(b.fecha||\"\").localeCompare(String(a.fecha||\"\"))),[rma15Index,profileAliasKeys]);\n  const pmReg=useMemo(()=>collectAliasRows(pmRegIndex,(a,b)=>String(pick(b,[\"Fecha\",\"Fecha PM\"])||\"\").localeCompare(String(pick(a,[\"Fecha\",\"Fecha PM\"])||\"\"))),[pmRegIndex,profileAliasKeys]);`
      )

      out = out.replace(
        '    const cfg=pmCfgIndex.get(selectedKey)||{};',
        '    const cfg=profileAliasKeys.map(key=>pmCfgIndex.get(key)).find(Boolean)||{};'
      )
      out = out.replace(
        '  },[pmCfgIndex,selectedKey,pmReg,summary.currentH]);',
        '  },[pmCfgIndex,profileAliasKeys,pmReg,summary.currentH]);'
      )

      out = out.replace(
        '  const projectMovements=useMemo(()=>{\n    return mergeEquipmentMovements(op,movementIndex.get(selectedKey)||[],selectedKey);\n  },[op,movementIndex,selectedKey]);',
        `  const projectMovements=useMemo(()=>{\n    const persisted=[];\n    const seen=new Set();\n    for(const key of profileAliasKeys){\n      for(const movement of movementIndex.get(key)||[]){\n        const movementKey=movement?.id||[movement?.fecha,movement?.interno,movement?.desde,movement?.hasta,movement?.motivo].join('|');\n        if(seen.has(movementKey))continue;\n        seen.add(movementKey);\n        persisted.push(movement);\n      }\n    }\n    return mergeEquipmentMovements(op,persisted,selectedKey);\n  },[op,movementIndex,selectedKey,profileAliasKeys]);`
      )

      // Conservamos el código REAL de cada registro fuente. Ejemplo: una carga vieja
      // de TOP-0039 sigue viéndose TOP-0039 aunque la ficha esté consolidada con TOP-0067.
      out = out.replace(
        'interno:detailCode||sourceCode(r),proyecto:r.proyecto',
        'interno:sourceCode(r)||detailCode,proyecto:r.proyecto'
      )
      out = out.replace(
        'interno:detailCode||sourceCode(r),proyecto:r.proyecto,tarea:',
        'interno:sourceCode(r)||detailCode,proyecto:r.proyecto,tarea:'
      )

      // Aplicamos el filtro de proyecto al selector y lo mostramos junto al filtro de equipo.
      out = out.replace(
        '<div><div style={{fontSize:9,color:C.textMuted,fontWeight:800,marginBottom:4}}>EQUIPO</div><EquipmentPicker options={allCodes} value={selected} onChange={v=>setSelected(cleanEquipmentCode(v))}/></div>',
        '<div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(150px,.42fr)",gap:8,alignItems:"end"}}><div><div style={{fontSize:9,color:C.textMuted,fontWeight:800,marginBottom:4}}>EQUIPO</div><EquipmentPicker options={visibleCodes} value={selectedOption?.value||selectedPreferred||selected} onChange={v=>setSelected(cleanEquipmentCode(v))}/></div><label style={{fontSize:9,color:C.textMuted,fontWeight:800}}>PROYECTO<select value={selectedProject} onChange={e=>setSelectedProject(e.target.value)} style={{display:"block",width:"100%",marginTop:4,height:40,boxSizing:"border-box",background:"#151515",border:`1px solid ${C.border}`,color:C.text,borderRadius:8,padding:"0 9px",fontSize:11,fontWeight:700}}><option value="">Todos</option>{projectOptions.map(p=><option key={p} value={p}>{p}</option>)}</select></label></div>'
      )

      return out === code ? null : { code: out, map: null }
    }
  }
}
