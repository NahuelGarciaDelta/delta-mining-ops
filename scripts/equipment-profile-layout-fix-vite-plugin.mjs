const TARGET = '/src/modules/equipment/EquipmentProfileView.jsx'

export function equipmentProfileLayoutFixVitePlugin() {
  return {
    name: 'delta-equipment-profile-layout-fix',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').endsWith(TARGET)) return null
      let out = code

      // Mantener el desplegable dentro del viewport: ancho controlado, altura compacta,
      // scroll interno y alineación hacia la derecha cuando corresponde.
      out = out.replace(
        /function EquipmentPicker\(\{options,value,onChange\}\)\{[\s\S]*?\n\}/,
`function EquipmentPicker({options,value,onChange}){
  const [open,setOpen]=useState(false),[search,setSearch]=useState("");
  const ref=React.useRef(null);
  useEffect(()=>{const close=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};document.addEventListener("mousedown",close);return()=>document.removeEventListener("mousedown",close);},[]);
  const current=options.find(o=>canonicalEquipmentCode(o.value)===canonicalEquipmentCode(value))||null;
  const filtered=useMemo(()=>{const q=norm(search);return q?options.filter(o=>norm(o.label).includes(q)):options;},[options,search]);
  return <div ref={ref} style={{position:"relative",width:"100%",minWidth:0}}>
    <button type="button" onClick={()=>setOpen(v=>!v)} style={{width:"100%",height:38,boxSizing:"border-box",borderRadius:8,border:\`1px solid \${C.border}\`,background:"#151515",color:C.text,padding:"0 34px 0 11px",fontSize:11,fontWeight:700,outline:"none",cursor:"pointer",textAlign:"left",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",position:"relative"}}>
      {current?.label||value||"Seleccionar equipo..."}<span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",fontSize:11}}>⌄</span>
    </button>
    {open&&<div style={{position:"absolute",top:"calc(100% + 4px)",right:0,left:"auto",zIndex:20000,width:"100%",maxWidth:"min(440px, calc(100vw - 36px))",background:"#141414",border:\`1px solid \${C.border}\`,borderRadius:9,boxShadow:"0 14px 36px rgba(0,0,0,.62)",padding:6,boxSizing:"border-box"}}>
      <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar equipo..." style={{width:"100%",height:32,boxSizing:"border-box",borderRadius:7,border:\`1px solid \${C.border}\`,background:"#0f0f0f",color:C.text,padding:"0 9px",fontSize:11,outline:"none",marginBottom:5}}/>
      <div style={{maxHeight:"220px",overflowY:"auto",overflowX:"hidden",overscrollBehavior:"contain"}}>
        {filtered.map(o=><button type="button" key={o.key} onClick={()=>{onChange(o.value);setOpen(false);setSearch("");}} style={{display:"block",width:"100%",border:0,borderRadius:6,background:canonicalEquipmentCode(o.value)===canonicalEquipmentCode(value)?"rgba(37,99,235,.35)":"transparent",color:C.text,textAlign:"left",padding:"7px 8px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}} title={o.label}>{o.label}</button>)}
        {!filtered.length&&<div style={{padding:11,color:C.textMuted,fontSize:11}}>Sin coincidencias</div>}
      </div>
    </div>}
  </div>;
}`
      )

      // Compactar y correr el panel de filtros hacia la izquierda para que MES/DESDE/HASTA
      // y LIMPIAR permanezcan siempre dentro del encabezado azul.
      out = out.replace(
        'gridTemplateColumns:"minmax(0,1fr) minmax(260px,420px)"',
        'gridTemplateColumns:"minmax(0,1.18fr) minmax(520px,40%)"'
      )
      out = out.replace(
        'gridTemplateColumns:"minmax(145px,1.2fr) minmax(120px,1fr) minmax(120px,1fr) auto"',
        'gridTemplateColumns:"minmax(112px,.95fr) minmax(104px,.85fr) minmax(104px,.85fr) 72px"'
      )
      out = out.replace(
        'padding:"7px 10px",fontSize:11,cursor:"pointer",height:33',
        'padding:"7px 6px",fontSize:10,cursor:"pointer",height:33,width:"72px",boxSizing:"border-box"'
      )
      out = out.replace(
        '.dm-equipment-header{grid-template-columns:minmax(0,1fr) minmax(520px,48%)!important;padding-inline:16px!important}',
        '.dm-equipment-header{grid-template-columns:minmax(0,1.15fr) minmax(500px,41%)!important;padding-inline:16px!important}'
      )

      return out === code ? null : { code: out, map: null }
    }
  }
}
