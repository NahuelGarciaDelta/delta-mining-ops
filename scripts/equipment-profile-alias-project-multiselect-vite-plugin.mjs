const TARGET='/src/modules/equipment/EquipmentProfileView.jsx'

export function equipmentProfileAliasProjectMultiselectVitePlugin(){
  return{
    name:'delta-equipment-profile-alias-project-multiselect',
    enforce:'pre',
    transform(code,id){
      if(!id.replace(/\\/g,'/').endsWith(TARGET))return null
      let out=code

      // La identidad física se arma por componentes conectados. Si dos filas de la
      // Lista Maestra comparten cualquier código, todos sus códigos pertenecen al mismo equipo.
      // Para el nombre visible se prioriza el código ACTUAL: un Código nuevo/Drusila que
      // no figure como Código anterior/viejo dentro del mismo componente.
      out=out.replace(/  const physicalIdentity=useMemo\(\(\)=>\{[\s\S]*?\n  \},\[listaEquipos\]\);/,
`  const physicalIdentity=useMemo(()=>{
    const parent=new Map(),rank=new Map(),rowByAlias=new Map(),rowsByRoot=new Map();
    const ensure=k=>{if(k&&!parent.has(k)){parent.set(k,k);rank.set(k,0);}};
    const find=k=>{ensure(k);let p=parent.get(k);while(p!==parent.get(p))p=parent.get(p);let x=k;while(parent.get(x)!==p){const n=parent.get(x);parent.set(x,p);x=n;}return p;};
    const union=(a,b)=>{if(!a||!b)return;let ra=find(a),rb=find(b);if(ra===rb)return;const aa=rank.get(ra)||0,bb=rank.get(rb)||0;if(aa<bb)[ra,rb]=[rb,ra];parent.set(rb,ra);if(aa===bb)rank.set(ra,aa+1);};
    const rowAliases=new Map();
    for(const row of listaEquipos||[]){
      const aliases=codesOfMaster(row).map(cleanEquipmentCode).map(canonicalEquipmentCode).filter(Boolean);
      rowAliases.set(row,aliases);aliases.forEach(ensure);for(let i=1;i<aliases.length;i++)union(aliases[0],aliases[i]);
    }
    const firstOwner=new Map();
    for(const [row,aliases] of rowAliases){for(const k of aliases){if(firstOwner.has(k)){const other=firstOwner.get(k);const oa=rowAliases.get(other)||[];if(oa[0]&&aliases[0])union(oa[0],aliases[0]);}else firstOwner.set(k,row);}}
    for(const [row,aliases] of rowAliases){for(const k of aliases){const root=find(k);rowByAlias.set(k,row);if(!rowsByRoot.has(root))rowsByRoot.set(root,[]);if(!rowsByRoot.get(root).includes(row))rowsByRoot.get(root).push(row);}}
    const aliasToPreferred=new Map(),aliasToMaster=new Map(),aliasesByPreferred=new Map();
    const read=row=>({
      nuevo:cleanEquipmentCode(pick(row||{},["Código nuevo","Codigo nuevo","CODIGO NUEVO"])),
      drusila:cleanEquipmentCode(pick(row||{},["Código de Drusila","Codigo de Drusila","Código Drusila","Codigo Drusila","CODIGO DRUSILA"])),
      anterior:cleanEquipmentCode(pick(row||{},["Código anterior","Codigo anterior","CODIGO ANTERIOR","Código viejo","Codigo viejo","CODIGO VIEJO"]))
    });
    const allRoots=new Set([...parent.keys()].map(find));
    for(const root of allRoots){
      const rows=rowsByRoot.get(root)||[];
      const oldKeys=new Set();for(const r of rows){const x=read(r);const k=canonicalEquipmentCode(x.anterior);if(k)oldKeys.add(k);}
      const currentCandidates=[];
      for(const r of rows){const x=read(r);if(x.nuevo&&!oldKeys.has(canonicalEquipmentCode(x.nuevo)))currentCandidates.push({code:x.nuevo,row:r,priority:0});}
      for(const r of rows){const x=read(r);if(x.drusila&&!oldKeys.has(canonicalEquipmentCode(x.drusila)))currentCandidates.push({code:x.drusila,row:r,priority:1});}
      const aliases=[...parent.keys()].filter(k=>find(k)===root);
      if(!currentCandidates.length){for(const k of aliases){if(!oldKeys.has(k))currentCandidates.push({code:cleanEquipmentCode(k),row:rowByAlias.get(k)||rows[0]||null,priority:2});}}
      const chosen=currentCandidates.sort((a,b)=>a.priority-b.priority)[0]||{code:cleanEquipmentCode(aliases[0]||root),row:rows[0]||null};
      const preferred=cleanEquipmentCode(chosen.code)||cleanEquipmentCode(root),preferredKey=canonicalEquipmentCode(preferred)||root,master=chosen.row||rows[0]||null;
      aliasesByPreferred.set(preferredKey,aliases);
      for(const k of aliases){aliasToPreferred.set(k,preferredKey);aliasToMaster.set(k,master||rowByAlias.get(k)||null);}
      aliasToPreferred.set(preferredKey,preferredKey);if(master)aliasToMaster.set(preferredKey,master);
    }
    const preferredOf=row=>{if(!row)return"";const aliases=rowAliases.get(row)||[];const mapped=aliases.map(k=>aliasToPreferred.get(k)).find(Boolean);return mapped?cleanEquipmentCode(mapped):(read(row).nuevo||read(row).drusila||codesOfMaster(row)[0]||"");};
    return{aliasToPreferred,aliasToMaster,aliasesByPreferred,preferredOf};
  },[listaEquipos]);`)

      out=out.replace('const aliases=master?codesOfMaster(master).map(cleanEquipmentCode).filter(Boolean):[cleanEquipmentCode(rawCode)];',
        'const aliases=(physicalIdentity.aliasesByPreferred.get(groupKey)||[]).map(cleanEquipmentCode).filter(Boolean);if(!aliases.length)aliases.push(...(master?codesOfMaster(master).map(cleanEquipmentCode).filter(Boolean):[cleanEquipmentCode(rawCode)]));')
      out=out.replace('if(master)codesOfMaster(master).forEach(add);return keys;',
        'for(const alias of physicalIdentity.aliasesByPreferred.get(selectedKey)||[])add(alias);if(master)codesOfMaster(master).forEach(add);return keys;')

      // Proyecto multiselección.
      out=out.replace('const [selectedProject,setSelectedProject]=useState("");','const [selectedProject,setSelectedProject]=useState([]);')
      out=out.replace(/const visibleCodes=useMemo\(\(\)=>\{if\(!selectedProject\)return allCodes;const target=norm\(selectedProject\);return allCodes\.filter\(option=>\(option\.aliases\|\|\[option\.value\]\)\.some\(alias=>\(rop02Index\.get\(canonicalEquipmentCode\(alias\)\)\|\|\[\]\)\.some\(row=>norm\(row\.proyecto\)===target\)\)\);\},\[allCodes,selectedProject,rop02Index\]\);/,
        'const visibleCodes=useMemo(()=>{if(!selectedProject.length)return allCodes;const targets=new Set(selectedProject.map(norm));return allCodes.filter(option=>(option.aliases||[option.value]).some(alias=>(rop02Index.get(canonicalEquipmentCode(alias))||[]).some(row=>targets.has(norm(row.proyecto)))));},[allCodes,selectedProject,rop02Index]);')

      if(!out.includes('function ProjectMultiPicker(')){
        out=out.replace('function EquipmentPicker({options,value,onChange}){',
`function ProjectMultiPicker({options,value,onChange}){
  const [open,setOpen]=useState(false);const ref=React.useRef(null);
  useEffect(()=>{const close=e=>{if(!ref.current?.contains(e.target))setOpen(false)};document.addEventListener("mousedown",close);return()=>document.removeEventListener("mousedown",close)},[]);
  const selected=Array.isArray(value)?value:[];const label=!selected.length?"Todos los proyectos":selected.length===1?selected[0]:selected.length+" proyectos";
  const toggle=p=>onChange(selected.includes(p)?selected.filter(x=>x!==p):[...selected,p]);
  return <div ref={ref} style={{position:"relative",marginTop:4,width:"100%",minWidth:230}}><button type="button" onClick={()=>setOpen(v=>!v)} style={{width:"100%",height:33,boxSizing:"border-box",background:"#151515",border:\`1px solid \${C.border}\`,color:C.text,borderRadius:8,padding:"0 28px 0 8px",fontSize:11,fontWeight:700,textAlign:"left",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",cursor:"pointer",position:"relative"}}>{label}<span style={{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)"}}>⌄</span></button>{open&&<div style={{position:"absolute",left:0,top:37,width:"100%",minWidth:230,zIndex:2147483000,background:"#141414",border:\`1px solid \${C.border}\`,borderRadius:8,padding:6,boxShadow:"0 12px 32px rgba(0,0,0,.65)",maxHeight:240,overflowY:"auto"}}><button type="button" onClick={()=>onChange([])} style={{display:"block",width:"100%",border:0,background:"transparent",color:C.text,textAlign:"left",padding:"7px 8px",fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>Todos los proyectos</button>{options.map(p=><label key={p} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 8px",color:C.text,fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}><input type="checkbox" checked={selected.includes(p)} onChange={()=>toggle(p)}/><span>{p}</span></label>)}</div>}</div>;
}

function EquipmentPicker({options,value,onChange}){`)
      }
      out=out.replace(/<select value=\{selectedProject\} onChange=\{e=>setSelectedProject\(e\.target\.value\)\} style=\{\{display:"block",marginTop:4,width:"100%",minWidth:0,height:33,boxSizing:"border-box",background:"#151515",border:`1px solid \$\{C\.border\}`,color:C\.text,borderRadius:8,padding:"0 8px",fontSize:11,fontWeight:700,outline:"none"\}\}><option value="">Todos los proyectos<\/option>\{projectOptions\.map\(p=><option key=\{p\} value=\{p\}>\{p\}<\/option>\)\}<\/select>/,
        '<ProjectMultiPicker options={projectOptions} value={selectedProject} onChange={setSelectedProject}/>')
      out=out.replace('gridColumn:"1",gridRow:"2"','gridColumn:"1 / 3",gridRow:"2"')
      out=out.replace('setSelectedProject("")','setSelectedProject([])')

      // El proyecto seleccionado filtra también LOS DATOS de la ficha, no sólo el selector.
      const projectFilter='if(selectedProject.length){const targets=new Set(selectedProject.map(norm));rows=rows.filter(r=>targets.has(norm(r.proyecto||r.proyectoActual||r.centroCosto||"")));}';
      out=out.replace('let rows=op;\n    if(fechaD||fechaH)',`let rows=op;\n    ${projectFilter}\n    if(fechaD||fechaH)`).replace('},[op,fechaD,fechaH]);','},[op,selectedProject,fechaD,fechaH]);')
      out=out.replace('let rows=prod;\n    if(fechaD||fechaH)',`let rows=prod;\n    ${projectFilter}\n    if(fechaD||fechaH)`).replace('},[prod,fechaD,fechaH]);','},[prod,selectedProject,fechaD,fechaH]);')
      out=out.replace('let rows=mant;\n    if(fechaD||fechaH)',`let rows=mant;\n    ${projectFilter}\n    if(fechaD||fechaH)`).replace('},[mant,fechaD,fechaH]);','},[mant,selectedProject,fechaD,fechaH]);')
      out=out.replace('let rows=pmReg;\n    if(fechaD||fechaH)',`let rows=pmReg;\n    ${projectFilter}\n    if(fechaD||fechaH)`).replace('},[pmReg,fechaD,fechaH]);','},[pmReg,selectedProject,fechaD,fechaH]);')

      return out===code?null:{code:out,map:null}
    }
  }
}
