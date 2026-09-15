from pathlib import Path

def replace_once(path, old, new, label):
    p=Path(path)
    s=p.read_text(encoding='utf-8')
    if old not in s:
        raise SystemExit(f'{label}: bloque esperado no encontrado')
    s=s.replace(old,new,1)
    p.write_text(s,encoding='utf-8')

# Abastecimiento: las relecturas completas posteriores a una escritura confirmada
# pasan a segundo plano. Remitos mantienen en el camino critico las dos escrituras
# necesarias: remito + recalculo RABA03.
p='src/modules/abastecimiento/AbastecimientoModule.jsx'
s=Path(p).read_text(encoding='utf-8')

# Importacion RABA03: el POST ya confirma la escritura.
old='''      setSuccessAlert({message:msg});\n      setTab("solicitudes");\n      await loadRaba03();\n'''
new='''      setSuccessAlert({message:msg});\n      setTab("solicitudes");\n      loadRaba03({silent:true}).catch(err=>console.warn("La carga se guardó, pero falló la resincronización de RABA03:",err));\n'''
if old not in s: raise SystemExit('Abastecimiento import: bloque no encontrado')
s=s.replace(old,new,1)

# Guardar datos RABA03: no esperar otra lectura completa.
old='''      setSuccessAlert({message:`${Number(json.updatedRows||0)} filas guardadas en RABA03 base`});\n      await loadRaba03();\n'''
new='''      setSuccessAlert({message:`${Number(json.updatedRows||0)} filas guardadas en RABA03 base`});\n      loadRaba03({silent:true}).catch(err=>console.warn("Los datos se guardaron, pero falló la resincronización de RABA03:",err));\n'''
if old not in s: raise SystemExit('Abastecimiento guardar datos: bloque no encontrado')
s=s.replace(old,new,1)

# Guardar codigos: reflejo local inmediato + verificacion de fondo.
old='''      setCodigoEdits({});\n      setSuccessAlert({message:`${Number(json.updatedRows||0)} códigos actualizados en RABA03 base`});\n      await loadRaba03();\n'''
new='''      const codigoByPedido=new Map(payloadRows.map(r=>[String(r.nSolicitud||"").trim(),r.codigoArticulo]));\n      setRows(prev=>(prev||[]).map(row=>{\n        const codigo=codigoByPedido.get(String(row.nSolicitud||"").trim());\n        return codigo===undefined?row:{...row,codigoArticulo:codigo};\n      }));\n      setCodigoEdits({});\n      setSuccessAlert({message:`${Number(json.updatedRows||0)} códigos actualizados en RABA03 base`});\n      loadRaba03({silent:true}).catch(err=>console.warn("Los códigos se guardaron, pero falló la resincronización de RABA03:",err));\n'''
if old not in s: raise SystemExit('Abastecimiento guardar codigos: bloque no encontrado')
s=s.replace(old,new,1)

# Reemplazar el flujo completo de alta de remitos para evitar GET de verificacion.
start=s.index('  const registerRemito=async()=>{')
end=s.index('\n\n  const deleteRemito=async(id)=>{',start)
new_register='''  const registerRemito=async()=>{\n    const actual=buildRemitoDesdeFormulario(remitoForm);\n    const formularios=[...remitosPendientes];\n    if(actual)formularios.push(remitoForm);\n    if(!formularios.length){\n      appAlert("Cargá al menos un remito con artículos antes de guardar.");\n      return;\n    }\n\n    const remitosAEnviar=formularios.map(buildRemitoDesdeFormulario).filter(Boolean);\n    if(!remitosAEnviar.length){\n      appAlert("No hay remitos válidos para guardar.");\n      return;\n    }\n\n    const affectedPairs=collectRemitoPairKeys(remitosAEnviar);\n    const guardados=[];\n    try{\n      setActionLoading("Guardando remito y actualizando Google Sheets...");\n      setError(null);\n      for(const nuevo of remitosAEnviar){\n        await saveRemitoCompartido(nuevo);\n        guardados.push({...nuevo,shared:true});\n      }\n\n      // El POST de cada remito ya retorna después de escribir Google Sheets.\n      // Reflejar esos remitos localmente sin una segunda lectura completa.\n      const seen=new Set();\n      const nextRemitos=[...(remitosRef.current||[]),...guardados].filter(rem=>{\n        const key=String(rem.id||rem.comprobante||"").trim();\n        if(!key)return true;\n        if(seen.has(key))return false;\n        seen.add(key);\n        return true;\n      });\n      remitosRef.current=nextRemitos;\n      setRemitos(nextRemitos);\n      try{window.localStorage.setItem(RABA08_STORAGE_KEY,JSON.stringify(nextRemitos));}catch(_){}\n\n      // Esta segunda escritura sí es parte de la operación: actualizar cantidades RABA03.\n      await persistRaba03AllocationForPairs(nextRemitos,affectedPairs);\n\n      setSuccessAlert({message:`${guardados.length} ${guardados.length===1?"remito guardado":"remitos guardados"} y RABA03 actualizado para todos los usuarios`});\n      setRemitosPendientes([]);\n      limpiarRemitoForm();\n      setRemitoSearch("");\n\n      // Sólo verificación/corrección eventual; nunca bloquea ni convierte un guardado confirmado en error.\n      loadRemitosCompartidos({silent:true}).catch(err=>console.warn("Los remitos se guardaron, pero falló la verificación en segundo plano:",err));\n    }catch(err){\n      const msg=err?.message||String(err);\n      setError(msg);\n      if(guardados.length){\n        appAlert(`Se guardaron ${guardados.length} remito(s) en Google Sheets, pero no se pudo completar toda la sincronización de RABA03: ${msg}`);\n        loadRemitosCompartidos({silent:true}).catch(()=>{});\n      }else{\n        appAlert("No se pudo guardar el remito: "+msg);\n      }\n    }finally{\n      setActionLoading("");\n    }\n  };'''
s=s[:start]+new_register+s[end:]

# Reemplazar eliminacion: confirmacion del POST + recalculo RABA03, sin GET completo en medio.
start=s.index('  const deleteRemito=async(id)=>{')
end=s.index('\n\n  const badgeStyle=',start)
new_delete='''  const deleteRemito=async(id)=>{\n    if(!(await appConfirm("¿Eliminar este remito cargado?")))return;\n    const targetRemito=(remitosRef.current||[]).find(r=>r.id===id)||null;\n    const affectedPairs=collectRemitoPairKeys(targetRemito?[targetRemito]:[]);\n    setActionLoading("Eliminando remito y actualizando Google Sheets...");\n    let deletedConfirmed=false;\n    try{\n      const res=await fetch(APPS_SCRIPT_URL,{\n        method:"POST",\n        cache:"no-store",\n        redirect:"follow",\n        headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},\n        body:new URLSearchParams({payload:JSON.stringify({action:"delete_remito_cargado",idRemito:id})}).toString()\n      });\n      if(!res.ok)throw new Error(`Error HTTP ${res.status}`);\n      const json=await res.json();\n      if(!json.ok)throw new Error(json?.error?.message||"No se pudo eliminar el remito compartido.");\n      deletedConfirmed=true;\n\n      // Google ya confirmó la eliminación: quitarlo inmediatamente de la UI/cache.\n      const nextRemitos=(remitosRef.current||[]).filter(r=>r.id!==id);\n      remitosRef.current=nextRemitos;\n      setRemitos(nextRemitos);\n      try{window.localStorage.setItem(RABA08_STORAGE_KEY,JSON.stringify(nextRemitos));}catch(_){}\n\n      // Recalcular sólo las parejas código+proyecto afectadas.\n      await persistRaba03AllocationForPairs(nextRemitos,affectedPairs);\n      setSuccessAlert({message:"Remito eliminado y RABA03 recalculado correctamente."});\n\n      loadRemitosCompartidos({silent:true}).catch(err=>console.warn("El remito se eliminó, pero falló la verificación en segundo plano:",err));\n    }catch(err){\n      const msg=err?.message||String(err);\n      console.warn("No se pudo completar la operación de eliminación:",err);\n      if(deletedConfirmed){\n        appAlert("El remito fue eliminado de Google Sheets, pero no se pudo completar el recálculo de RABA03: "+msg);\n        loadRemitosCompartidos({silent:true}).catch(()=>{});\n      }else{\n        appAlert("No se pudo eliminar el remito: "+msg);\n      }\n    }finally{\n      setActionLoading("");\n    }\n  };'''
s=s[:start]+new_delete+s[end:]
Path(p).write_text(s,encoding='utf-8')

# Lista Maestra: liberar el spinner tras confirmación del POST; reload en fondo.
p='src/modules/oficina-tecnica/OficinaTecnicaModule.jsx'
s=Path(p).read_text(encoding='utf-8')
needle='if(onReloadLista)await onReloadLista();'
count=s.count(needle)
if count<3: raise SystemExit(f'Lista Maestra: se esperaban >=3 reloads, hay {count}')
s=s.replace(needle,'if(onReloadLista)Promise.resolve().then(()=>onReloadLista()).catch(err=>console.warn("La escritura se confirmó, pero falló la recarga de Lista Maestra:",err));')
Path(p).write_text(s,encoding='utf-8')

# Mantenimiento Programado: no esperar la relectura completa después del POST.
p='src/modules/mantenimiento/MantenimientoProgramadoView.jsx'
s=Path(p).read_text(encoding='utf-8')
count=s.count('      await load();')
if count!=2: raise SystemExit(f'Mantenimiento PM: se esperaban 2 await load(), hay {count}')
s=s.replace('      await load();','      load({ silent: true }).catch(err=>console.warn("La escritura PM se confirmó, pero falló la recarga en segundo plano:",err));')
Path(p).write_text(s,encoding='utf-8')

# Taller Central: historial silencioso de fondo después de guardar/editar/eliminar.
p='src/modules/taller-central/TallerCentralMovementPage.jsx'
s=Path(p).read_text(encoding='utf-8')
old=''' const load=async()=>{try{const all=await getTallerMovements();setRows(all.map(apiRow).filter(r=>r.tipo===tipo).sort((a,b)=>String(b.fechaHora).localeCompare(String(a.fechaHora))).slice(0,100));}catch(e){setMsg(e?.message||"No se pudo cargar el historial.");}};'''
new=''' const load=async({silent=false}={})=>{try{const all=await getTallerMovements();setRows(all.map(apiRow).filter(r=>r.tipo===tipo).sort((a,b)=>String(b.fechaHora).localeCompare(String(a.fechaHora))).slice(0,100));}catch(e){if(!silent)setMsg(e?.message||"No se pudo cargar el historial.");}};'''
if old not in s: raise SystemExit('Taller MovementPage load no encontrado')
s=s.replace(old,new,1)
s=s.replace('setMsg(editingId?"Movimiento actualizado correctamente.":"Movimiento guardado correctamente.");await load();','setMsg(editingId?"Movimiento actualizado correctamente.":"Movimiento guardado correctamente.");load({silent:true});',1)
s=s.replace('setMsg("Movimiento eliminado.");await load();','setRows(prev=>prev.filter(item=>item.id!==row.id));setMsg("Movimiento eliminado.");load({silent:true});',1)
Path(p).write_text(s,encoding='utf-8')

# Vista legacy Taller Central: save/cancel ya actualizan cache local; reload queda de fondo.
p='src/modules/taller-central/TallerCentralMovements.jsx'
s=Path(p).read_text(encoding='utf-8')
old='''      await reload();setMsg("Movimiento guardado correctamente.");reset();'''
new='''      reload().catch(err=>console.warn("El movimiento se guardó, pero falló la recarga en segundo plano:",err));setMsg("Movimiento guardado correctamente.");reset();'''
if old not in s: raise SystemExit('TallerCentralMovements reload no encontrado')
s=s.replace(old,new,1)
Path(p).write_text(s,encoding='utf-8')

print('fast sheet mutation patch applied')
