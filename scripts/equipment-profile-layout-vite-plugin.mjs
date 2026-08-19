const TARGET = '/src/modules/equipment/EquipmentProfileView.jsx'

export function equipmentProfileLayoutVitePlugin() {
  return {
    name: 'delta-equipment-profile-layout',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').endsWith(TARGET)) return null
      let out = code

      // El encabezado debe estar por encima de TODAS las cards y permitir que el
      // selector sobresalga, haya o no un equipo seleccionado.
      out = out.replace(
        'borderRadius:14,overflow:"hidden",boxShadow:',
        'borderRadius:14,overflow:"visible",position:"relative",zIndex:5000,boxShadow:'
      )
      out = out.replace(
        'borderRadius:14,overflow:"visible",boxShadow:',
        'borderRadius:14,overflow:"visible",position:"relative",zIndex:5000,boxShadow:'
      )
      out = out.replace(
        'className="dm-equipment-header" style={{padding:"16px 20px 12px",display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(260px,420px)",gap:18,alignItems:"start"}}',
        'className="dm-equipment-header" style={{padding:"16px 20px 12px",display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(520px,600px)",gap:18,alignItems:"start",position:"relative",zIndex:5001}}'
      )
      out = out.replace(
        'className="dm-equipment-filter-panel" style={{display:"flex",flexDirection:"column",gap:9,minWidth:0,width:"100%"}}',
        'className="dm-equipment-filter-panel" style={{display:"flex",flexDirection:"column",gap:9,minWidth:0,width:"100%",position:"relative",zIndex:5002}}'
      )

      // Selector: ancho del panel, scroll propio y z-index mayor que cualquier card.
      out = out.replace(/zIndex:10000/g, 'zIndex:999999')
      out = out.replace(
        'top:"calc(100% + 5px)",left:0,right:0,zIndex:999999',
        'top:"calc(100% + 5px)",left:0,right:0,zIndex:999999,width:"100%",boxSizing:"border-box",maxWidth:"100%"'
      )
      out = out.replace(
        /maxHeight:"min\([^\"]+\)",overflowY:"auto",overflowX:"hidden"/g,
        'maxHeight:"min(360px, calc(100vh - 170px))",overflowY:"auto",overflowX:"hidden",overscrollBehavior:"contain"'
      )

      // ---------------- IDENTIDAD FÍSICA DEL EQUIPO ----------------
      // Rehacemos de forma determinística el catálogo del selector. Todos los códigos
      // de una misma fila de Lista Maestra (nuevo, Drusila, anterior/viejo, interno)
      // se transforman en UNA sola opción. La prioridad visual es Código nuevo,
      // luego Código Drusila y finalmente cualquier otro alias.
      out = out.replace(
        /  const allCodes=useMemo\(\(\)=>\{[\s\S]*?\n  \},\[listaEquipos,rop02Index,rop05Index,rma15Index,pm\.config,pmRegIndex,masterIndex,movementIndex\]\);(?:\n  const projectOptions[\s\S]*?\n  \},\[allCodes,selectedProject,rop02Index\]\);)?/,
`  const allCodes=useMemo(()=>{
    const catalog=new Map();
    const preferredOf=row=>cleanEquipmentCode(
      pick(row||{},["Código nuevo","Codigo nuevo","CODIGO NUEVO"]) ||
      pick(row||{},["Código de Drusila","Codigo de Drusila","Código Drusila","Codigo Drusila","CODIGO DRUSILA"]) ||
      codesOfMaster(row||{})[0] || ""
    );
    const add=(raw,explicitMaster=null,fromMaster=false)=>{
      const rawCode=String(raw||"").trim();
      const rawKey=canonicalEquipmentCode(rawCode);
      if(!rawKey||(!fromMaster&&!looksLikeEquipmentCode(rawCode)))return;
      const master=explicitMaster||masterIndex.get(rawKey)||null;
      const aliases=master?codesOfMaster(master).map(cleanEquipmentCode).filter(Boolean):[cleanEquipmentCode(rawCode)];
      const preferred=preferredOf(master)||cleanEquipmentCode(rawCode);
      const groupKey=canonicalEquipmentCode(preferred)||rawKey;
      const marca=pick(master||{},["Marca"]),modelo=pick(master||{},["Modelo"]),familia=pick(master||{},["Familia","Tipo"]);
      const next={key:groupKey,value:preferred,label:\`${'${preferred}'}${'${marca||modelo?` · ${[marca,modelo].filter(Boolean).join(" ")}`:familia?` · ${familia}`:""}'}\`,master,aliases};
      const existing=catalog.get(groupKey);
      if(!existing || (!existing.master&&master))catalog.set(groupKey,next);
    };
    for(const row of listaEquipos||[]){
      const aliases=codesOfMaster(row);
      if(!aliases.length)continue;
      add(preferredOf(row)||aliases[0],row,true);
    }
    const addBucket=bucket=>{if(bucket?.[0])add(sourceCode(bucket[0]));};
    for(const bucket of rop02Index.values())addBucket(bucket);
    for(const bucket of rop05Index.values())addBucket(bucket);
    for(const bucket of rma15Index.values())addBucket(bucket);
    for(const bucket of movementIndex.values())if(bucket?.[0])add(bucket[0].internoNormalizado||bucket[0].interno);
    (pm.config||[]).forEach(r=>add(pick(r,["Interno","Codigo","Equipo"])));
    for(const bucket of pmRegIndex.values())if(bucket?.[0])add(pick(bucket[0],["Interno","Codigo","Equipo"]));
    return [...catalog.values()].sort((a,b)=>a.label.localeCompare(b.label,"es",{numeric:true,sensitivity:"base"}));
  },[listaEquipos,rop02Index,rop05Index,rma15Index,pm.config,pmRegIndex,masterIndex,movementIndex]);

  const projectOptions=useMemo(()=>[...new Set((rop02All||[]).map(r=>String(r.proyecto||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es",{sensitivity:"base"})),[rop02All]);
  const visibleCodes=useMemo(()=>{
    if(!selectedProject)return allCodes;
    const target=norm(selectedProject);
    return allCodes.filter(option=>(option.aliases||[option.value]).some(alias=>(rop02Index.get(canonicalEquipmentCode(alias))||[]).some(row=>norm(row.proyecto)===target)));
  },[allCodes,selectedProject,rop02Index]);`)

      // A partir de cualquier alias seleccionado abrimos SIEMPRE la misma ficha y
      // juntamos las filas de todos sus códigos históricos, sin reescribir ROP02.
      out = out.replace(
        /  \/\/ Si llega RPC-0016-JM,[\s\S]*?\n  const filteredOp=useMemo\(/,
`  // Si llega un código histórico, resolvemos primero su fila maestra y el código preferido.
  const selectedMasterRow=masterIndex.get(detailKey)||null;
  const preferredOfMaster=row=>cleanEquipmentCode(
    pick(row||{},["Código nuevo","Codigo nuevo","CODIGO NUEVO"]) ||
    pick(row||{},["Código de Drusila","Codigo de Drusila","Código Drusila","Codigo Drusila","CODIGO DRUSILA"]) ||
    codesOfMaster(row||{})[0] || ""
  );
  const selectedPreferred=preferredOfMaster(selectedMasterRow)||cleanEquipmentCode(detailKey);
  const selectedKey=canonicalEquipmentCode(selectedPreferred);
  const selectedOption=useMemo(()=>allCodes.find(o=>o.key===selectedKey)||null,[allCodes,selectedKey]);
  const master=selectedMasterRow||selectedOption?.master||masterIndex.get(selectedKey)||null;
  const profileAliasKeys=useMemo(()=>{
    const keys=[];
    const add=v=>{const k=canonicalEquipmentCode(v);if(k&&!keys.includes(k))keys.push(k);};
    add(selectedKey);
    if(master)codesOfMaster(master).forEach(add);
    return keys;
  },[master,selectedKey]);
  const collectAliasRows=(index,sorter)=>{
    const seen=new Set(),rows=[];
    for(const key of profileAliasKeys)for(const row of index.get(key)||[]){if(seen.has(row))continue;seen.add(row);rows.push(row);}
    return sorter?[...rows].sort(sorter):rows;
  };
  const op=useMemo(()=>collectAliasRows(rop02Index,(a,b)=>String(a.fecha||"").localeCompare(String(b.fecha||""))),[rop02Index,profileAliasKeys]);
  const prod=useMemo(()=>collectAliasRows(rop05Index),[rop05Index,profileAliasKeys]);
  const mant=useMemo(()=>collectAliasRows(rma15Index,(a,b)=>String(b.fecha||"").localeCompare(String(a.fecha||""))),[rma15Index,profileAliasKeys]);
  const pmReg=useMemo(()=>collectAliasRows(pmRegIndex,(a,b)=>String(pick(b,["Fecha","Fecha PM"])||"").localeCompare(String(pick(a,["Fecha","Fecha PM"])||""))),[pmRegIndex,profileAliasKeys]);

  const filteredOp=useMemo(() =>`)

      // El selector usa el catálogo ya agrupado.
      out = out.replace(/<EquipmentPicker options=\{(?:allCodes|visibleCodes)\} value=\{selected\} onChange=\{v=>setSelected\(cleanEquipmentCode\(v\)\)\}\/>/g,
        '<EquipmentPicker options={visibleCodes} value={selected} onChange={v=>setSelected(cleanEquipmentCode(v))}/>')
      out = out.replace(/<EquipmentPicker options=\{(?:allCodes|visibleCodes)\} value=\{selected\} onChange=\{handleSelect\}\/>/g,
        '<EquipmentPicker options={visibleCodes} value={selected} onChange={handleSelect}/>')

      // ---------------- FILTROS ----------------
      // Proyecto va en una fila propia, justo debajo de Mes. Desde/Hasta/Limpiar
      // permanecen en la primera fila y no pueden salir del recuadro.
      if (!out.includes('dm-equipment-project-filter')) {
        out = out.replace(
          /(<label style=\{\{fontSize:9,color:C\.textMuted,fontWeight:800\}\}>MES[\s\S]*?<\/label>)(\s*<DateIn label="Desde")/,
          `$1<label className="dm-equipment-project-filter" style={{fontSize:9,color:C.textMuted,fontWeight:800,gridColumn:"1 / 3",gridRow:"2"}}>PROYECTO<select value={selectedProject} onChange={e=>setSelectedProject(e.target.value)} style={{display:"block",marginTop:4,width:"100%",height:33,boxSizing:"border-box",background:"#151515",border:\`1px solid \${C.border}\`,color:C.text,borderRadius:8,padding:"0 9px",fontSize:11,fontWeight:700,outline:"none"}}><option value="">Todos los proyectos</option>{projectOptions.map(p=><option key={p} value={p}>{p}</option>)}</select></label>$2`
        )
      }
      out = out.replace(
        /gridTemplateColumns:"minmax\(145px,1\.2fr\) minmax\(120px,1fr\) minmax\(120px,1fr\) auto",alignItems:"end",gap:8/,
        'gridTemplateColumns:"minmax(135px,1fr) minmax(115px,.9fr) minmax(115px,.9fr) 76px",gridTemplateRows:"auto auto",alignItems:"end",gap:8'
      )
      out = out.replace(
        /gridTemplateColumns:"minmax\(135px,1\.05fr\) minmax\(110px,\.95fr\) minmax\(110px,\.95fr\) minmax\(74px,auto\)",gridTemplateRows:"auto auto",alignItems:"end",gap:8/,
        'gridTemplateColumns:"minmax(135px,1fr) minmax(115px,.9fr) minmax(115px,.9fr) 76px",gridTemplateRows:"auto auto",alignItems:"end",gap:8'
      )
      out = out.replace(
        '<button onClick={clearFilters} style={{background:',
        '<button onClick={clearFilters} style={{gridColumn:"4",gridRow:"1",minWidth:0,width:"100%",background:'
      )
      out = out.replace(
        'const clearFilters=()=>{setSelectedMonth("");setFechaD("");setFechaH("");};',
        'const clearFilters=()=>{setSelectedMonth("");setSelectedProject("");setFechaD("");setFechaH("");};'
      )

      // CSS final de apilamiento y responsive. El header tiene prioridad absoluta
      // mientras el resto de la ficha queda por debajo.
      out = out.replace(
        '.dm-equipment-profile *{min-width:0}',
        '.dm-equipment-profile *{min-width:0}\n    .dm-equipment-profile>.dm-equipment-metrics,.dm-equipment-profile>div:not(:first-of-type){position:relative;z-index:1}\n    .dm-equipment-filter-panel{isolation:isolate}\n    .dm-equipment-project-filter{min-width:0}'
      )
      out = out.replace(
        '.dm-equipment-header{grid-template-columns:minmax(0,1fr) minmax(520px,48%)!important;padding-inline:16px!important}',
        '.dm-equipment-header{grid-template-columns:minmax(0,1fr) minmax(500px,52%)!important;padding-inline:16px!important}'
      )

      return out === code ? null : { code: out, map: null }
    }
  }
}
