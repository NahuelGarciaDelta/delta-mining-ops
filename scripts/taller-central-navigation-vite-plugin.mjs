export function tallerCentralNavigationVitePlugin(){
  return {
    name:'delta-taller-central-navigation',
    enforce:'pre',
    transform(code,id){
      let s=code;

      if(id.endsWith('/src/App.jsx')){
        const importAnchor='import { EquipmentProfileView } from "./modules/equipment/index.js";';
        if(s.includes(importAnchor)&&!s.includes('TallerCentralMovementPage')){
          s=s.replace(importAnchor,`${importAnchor}\nimport TallerCentralMovementPage from "./modules/taller-central/TallerCentralMovementPage.jsx";`);
        }
        s=s.replace('tallerCentral:"Taller Central",rop02:', 'tallerCentral:"Taller Central",tallerMovimientoSubida:"Subida de equipo",tallerMovimientoBaja:"Bajada de equipo",tallerMovimientoMovilizacion:"Movilización de equipo",tallerMovimientoCambio:"Cambio de equipo",rop02:');
        const oldNav=`if(activeModule==="tallerCentral"){\n      return [\n        {id:"bienvenida",icon:"home",label:"Bienvenida",type:"item",color:C.accent},\n        {id:"equipmentProfile",icon:"truck",label:"Ficha única del equipo",type:"item",color:C.teal},\n        {id:"tallerCentral",icon:"database",label:"Taller Central",type:"item",color:C.teal},\n      ];\n    }`;
        const newNav=`if(activeModule==="tallerCentral"){\n      return [\n        {id:"bienvenida",icon:"home",label:"Bienvenida",type:"item",color:C.accent},\n        {id:"equipmentProfile",icon:"truck",label:"Ficha única del equipo",type:"item",color:C.teal},\n        {id:"tallerCentral",icon:"database",label:"Taller Central",type:"item",color:C.teal},\n        {id:"grp_taller_movimientos",icon:"truck",label:"Movimiento de equipos",type:"group",color:C.accent,children:[\n          {id:"tallerMovimientoSubida",icon:"truck",label:"Subida"},\n          {id:"tallerMovimientoBaja",icon:"warn",label:"Bajada"},\n          {id:"tallerMovimientoMovilizacion",icon:"prod",label:"Movilización"},\n          {id:"tallerMovimientoCambio",icon:"refresh",label:"Cambio de equipo"},\n        ]},\n      ];\n    }`;
        if(s.includes(oldNav))s=s.replace(oldNav,newNav);
        const renderAnchor='{view==="equipmentProfile"&&<ModuleErrorBoundary name="Ficha única del equipo" onRetry={loadData}><EquipmentProfileView';
        if(s.includes(renderAnchor)&&!s.includes('tallerMovimientoSubida"].includes(view)')){
          const movementRender='{["tallerMovimientoSubida","tallerMovimientoBaja","tallerMovimientoMovilizacion","tallerMovimientoCambio"].includes(view)&&<ModuleErrorBoundary name="Movimiento de equipos" onRetry={loadData}><TallerCentralMovementPage mode={view==="tallerMovimientoBaja"?"BAJA":view==="tallerMovimientoMovilizacion"?"MOVILIZACION":view==="tallerMovimientoCambio"?"CAMBIO_EQUIPO":"SUBIDA"} listaEquipos={listaEquipos} rop02All={rop02All}/></ModuleErrorBoundary>}\n                ';
          s=s.replace(renderAnchor,movementRender+renderAnchor);
        }
      }

      if(id.endsWith('/src/modules/taller-central/TallerCentralMovementPage.jsx')){
        s=s.replace('import React,{useEffect,useMemo,useState} from "react";','import React,{useEffect,useMemo,useRef,useState} from "react";');
        s=s.replace(
          'import {deleteTallerMovement,getTallerMovements,saveTallerMovement,updateTallerMovement} from "../../services/tallerMovements.js";',
          'import {deleteTallerMovement,getCachedTallerMovements,getTallerMovements,saveTallerMovement,updateTallerMovement} from "../../services/tallerMovements.js";'
        );
        s=s.replace(
          'const tipo=String(mode||"SUBIDA").toUpperCase();const[form,setForm]=useState(EMPTY),[rows,setRows]=useState([]),[saving,setSaving]=useState(false),[msg,setMsg]=useState(""),[editingId,setEditingId]=useState("");',
          'const tipo=String(mode||"SUBIDA").toUpperCase();const requestRef=useRef(0);const[form,setForm]=useState(EMPTY),[rows,setRows]=useState(()=>getCachedTallerMovements(tipo).map(apiRow).filter(r=>r.tipo===tipo).sort((a,b)=>String(b.fechaHora).localeCompare(String(a.fechaHora))).slice(0,100)),[saving,setSaving]=useState(false),[msg,setMsg]=useState(""),[editingId,setEditingId]=useState("");'
        );
        s=s.replace(
          'const catalog=useMemo(()=>buildCatalog(listaEquipos,rop02All),[listaEquipos,rop02All]);const projects=useMemo(()=>[...new Set((rop02All||[]).map(r=>project(r?.proyecto||r?.lugar)).filter(Boolean))].sort(),[rop02All]);',
          'const catalog=useMemo(()=>buildCatalog(listaEquipos,rop02All),[listaEquipos,rop02All]);const projects=useMemo(()=>[...new Set((rop02All||[]).map(r=>project(r?.proyecto||r?.lugar)).filter(Boolean))].sort(),[rop02All]);const propertyOptions=useMemo(()=>{const vals=[...new Set((listaEquipos||[]).map(r=>String(pick(r,["Propiedad"])||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"));if(!vals.some(v=>norm(v)===norm("OTRO")))vals.push("OTRO");return vals;},[listaEquipos]);'
        );
        s=s.replace(
          'const load=async()=>{try{const all=await getTallerMovements();setRows(all.map(apiRow).filter(r=>r.tipo===tipo).sort((a,b)=>String(b.fechaHora).localeCompare(String(a.fechaHora))).slice(0,100));}catch(e){setMsg(e?.message||"No se pudo cargar el historial.");}};',
          'const load=async()=>{const requestId=++requestRef.current;const expected=tipo;try{const all=await getTallerMovements(expected);if(requestId!==requestRef.current)return;const next=all.map(apiRow).filter(r=>r.tipo===expected).sort((a,b)=>String(b.fechaHora).localeCompare(String(a.fechaHora))).slice(0,100);setRows(prev=>next.length?next:prev);}catch(e){if(requestId===requestRef.current)setMsg(e?.message||"No se pudo actualizar el historial. Se conservan los datos guardados.");}};'
        );
        s=s.replace(
          'useEffect(()=>{setForm(EMPTY);setEditingId("");setMsg("");load();},[tipo]);',
          'useEffect(()=>{requestRef.current+=1;setForm(EMPTY);setEditingId("");setMsg("");const cached=getCachedTallerMovements(tipo).map(apiRow).filter(r=>r.tipo===tipo).sort((a,b)=>String(b.fechaHora).localeCompare(String(a.fechaHora))).slice(0,100);setRows(prev=>cached.length?cached:prev.filter(r=>r.tipo===tipo));load();},[tipo]);'
        );
        s=s.replace('<Field label="Propiedad"><Select value={form.propiedad} onChange={v=>set("propiedad",v)}><option>DELTA</option><option>ALQUILADO</option><option>OTRO</option></Select></Field>','<Field label="Propiedad"><Select value={form.propiedad} onChange={v=>set("propiedad",v)}>{propertyOptions.map(p=><option key={p} value={p}>{p}</option>)}</Select></Field>');
        s=s.replace('<Field label="Propiedad"><Select value={form.propiedadEntra} onChange={v=>set("propiedadEntra",v)}><option>DELTA</option><option>ALQUILADO</option><option>OTRO</option></Select></Field>','<Field label="Propiedad"><Select value={form.propiedadEntra} onChange={v=>set("propiedadEntra",v)}>{propertyOptions.map(p=><option key={p} value={p}>{p}</option>)}</Select></Field>');
        s=s.replace(
          'const title=tipo==="SUBIDA"?"Registrar subida":tipo==="BAJA"?"Registrar bajada":tipo==="MOVILIZACION"?"Registrar movilización":"Registrar cambio de equipo";',
          'const visibleRows=rows.filter(r=>{const rt=String(r?.tipo||"").trim().toUpperCase();const motivo=String(r?.motivo||"").trim().toUpperCase();const obs=String(r?.observacion||"").trim().toUpperCase();const txt=`${motivo} ${obs}`;let derived=rt;if(txt.includes("SE CAMBIA EQUIPO")||txt.includes("CAMBIO_EQUIPO")||r?.internoEntra)derived="CAMBIO_EQUIPO";else if(txt.includes("SE BAJA")||txt.includes("TALLER_BAJA"))derived="BAJA";else if(txt.includes("SE MOVILIZA")||txt.includes("TALLER_MOVILIZACION"))derived="MOVILIZACION";else if(txt.includes("SUBIDA DE EQUIPO")||txt.includes("TALLER_SUBIDA"))derived="SUBIDA";return derived===tipo;});const title=tipo==="SUBIDA"?"Registrar subida":tipo==="BAJA"?"Registrar bajada":tipo==="MOVILIZACION"?"Registrar movilización":"Registrar cambio de equipo";'
        );
        s=s.replace('{rows.map((r,i)=><tr key={r.id||i}>','{visibleRows.map((r,i)=><tr key={r.id||i}>');
        s=s.replace('{!rows.length&&<tr><td colSpan={9}','{!visibleRows.length&&<tr><td colSpan={9}');
      }

      // Atrasos is implemented directly in OficinaTecnicaRoute.jsx. Do not inject a second route implementation at build time.


      if(id.endsWith('/src/modules/oficina-tecnica/OficinaTecnicaModule.jsx')){
        const pattern=/function ViewTallerCentral\(\{listaEquipos=\[\],rop02All=\[\],onReloadLista\}\)\{[\s\S]*?\n\}\n\n\nconst OFFICE_VIEW_NAMES/;
        if(pattern.test(s)){
          const replacement=`function ViewTallerCentral({listaEquipos=[],rop02All=[],onReloadLista}){\n  const rows=Array.isArray(listaEquipos)?listaEquipos:[];\n  return(\n    <div style={{display:"flex",flexDirection:"column",gap:14}}>\n      <TallerCentralSummary rows={rows}/>\n      {rows.length>0\n        ?<ViewListaMaestraEquipos rows={rows} rop02All={rop02All} onReloadLista={onReloadLista}/>\n        :<Card><div style={{padding:20,color:C.textMuted}}>Sin equipos cargados en Lista Maestra.</div></Card>}\n    </div>\n  );\n}\n\n\nconst OFFICE_VIEW_NAMES`;
          s=s.replace(pattern,replacement);
        }
      }

      return s===code?null:{code:s,map:null};
    }
  };
}
