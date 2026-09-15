from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'No se encontró bloque: {label}')
    return text.replace(old, new, 1)

# -----------------------------------------------------------------------------
# Proxy: RABA03 normal puede usar CacheService. force=1 sólo si el caller lo pide.
# -----------------------------------------------------------------------------
p=Path('api/apps-script.js')
s=p.read_text()
s=replace_once(s, '''  if (req.method === "GET" && String(query.action || "").trim().toLowerCase() === "raba03") {
    query.force = "1";
    query.limit = "all";
  }''', '''  if (req.method === "GET" && String(query.action || "").trim().toLowerCase() === "raba03") {
    // Siempre traer la tabla completa, pero NO forzar una lectura física de Sheets
    // en cada navegación. El Apps Script invalida su CacheService después de cada
    // escritura; los callers pueden enviar force=1 sólo cuando necesiten un hard refresh.
    query.limit = "all";
  }''', 'proxy RABA03 force')
s=s.replace('setTimeout(() => controller.abort(), 40000)', 'setTimeout(() => controller.abort(), 55000)', 1)
s=s.replace('Apps Script no respondió dentro de 40 segundos', 'Apps Script no respondió dentro de 55 segundos', 1)
p.write_text(s)

# -----------------------------------------------------------------------------
# Abastecimiento source
# -----------------------------------------------------------------------------
p=Path('src/modules/abastecimiento/AbastecimientoModule.jsx')
s=p.read_text()

# Matching: código + proyecto + fecha/FIFO. La descripción no bloquea.
s=replace_once(s, '''      const insumoKey=norm(row.descripcion);
      if(!code||!proyecto||!insumoKey)return;
      // Clave de asignación: código + proyecto + nombre normalizado del insumo.
      // La fecha NO se usa para mezclar períodos: se valida abajo como límite temporal.
      const key=[code,proyecto,insumoKey].join("__");''', '''      const insumoKey=norm(row.descripcion);
      if(!code||!proyecto)return;
      // Clave operativa: código + proyecto. La descripción del remito suele ser más
      // detallada que la de la solicitud (ej. 1527ALT), por lo que no debe bloquear
      // un match válido. La barrera temporal se valida abajo y el consumo es FIFO.
      const key=[code,proyecto].join("__");''', 'request allocation key')
s=replace_once(s, '''        const code=normCode(item.codigo);
        const insumoKey=norm(item.descripcion);
        const cantidad=toNumber(item.cantidad);
        if(!code||!insumoKey||cantidad<=0)return;''', '''        const code=normCode(item.codigo);
        const insumoKey=norm(item.descripcion);
        const cantidad=toNumber(item.cantidad);
        if(!code||cantidad<=0)return;''', 'shipment validation')
s=replace_once(s, '''      const key=shipment.proyecto&&shipment.insumoKey?[shipment.code,shipment.proyecto,shipment.insumoKey].join("__"):"";''', '''      const key=shipment.proyecto?[shipment.code,shipment.proyecto].join("__"):"";''', 'shipment allocation key')

# Envíos sin solicitud: también código+proyecto+fecha, no descripción exacta.
s=replace_once(s, '''      .filter(r=>r.codigo&&r.descripcion);''', '''      .filter(r=>r.codigo&&r.proyecto);''', 'historical requests filter')
s=replace_once(s, '''        if(!codigoNormalizado||!descripcionNormalizada||cantidad<=0)return;''', '''        if(!codigoNormalizado||cantidad<=0)return;''', 'unmatched shipment validation')
s=replace_once(s, '''          (!proyecto||!sol.proyecto||sol.proyecto===proyecto)&&
          sol.descripcion===descripcionNormalizada&&
          (!sol.fechaMs||!fechaMs||sol.fechaMs<=fechaMs)''', '''          (!proyecto||!sol.proyecto||sol.proyecto===proyecto)&&
          (!sol.fechaMs||!fechaMs||sol.fechaMs<=fechaMs)''', 'unmatched description barrier')

# Helpers de sincronización dirigida RABA03, insertados después de buildSolicitudKey.
anchor='''  const existingSolicitudKeys=useMemo(()=>new Set(rows.map(buildSolicitudKey)),[rows,buildSolicitudKey]);
'''
helper=r'''  const existingSolicitudKeys=useMemo(()=>new Set(rows.map(buildSolicitudKey)),[rows,buildSolicitudKey]);

  const remitoPairKey=useCallback((codigo,proyecto)=>{
    const code=normCode(codigo);
    const projectKey=normalizeCentroCosto(proyecto);
    return code&&projectKey?`${code}__${projectKey}`:"";
  },[normCode,normalizeCentroCosto]);

  const collectRemitoPairKeys=useCallback((sourceRemitos=[])=>{
    const pairs=new Set();
    (sourceRemitos||[]).forEach(remito=>{
      const proyecto=normalizeCentroCosto(remito.proyecto||remito.observaciones||remito.destino||remito.centroCosto||remito.origen||"");
      (remito.items||[]).forEach(item=>{
        const key=remitoPairKey(item.codigo,proyecto);
        if(key)pairs.add(key);
      });
    });
    return pairs;
  },[normalizeCentroCosto,remitoPairKey]);

  const persistRaba03AllocationForPairs=useCallback(async(sourceRemitos,pairKeys)=>{
    const targetPairs=pairKeys instanceof Set?pairKeys:new Set(pairKeys||[]);
    if(!targetPairs.size)return {updatedRows:0,payloadRows:[]};

    const activas=(rows||[]).filter(row=>!rejectedSolicitudes?.[buildSolicitudKey(row)]);
    const allocated=allocateRemitosToRequests(activas,sourceRemitos).rows;
    const payloadRows=allocated
      .filter(row=>targetPairs.has(remitoPairKey(row.codigoArticulo,row.centroCosto)))
      .filter(row=>String(row.nSolicitud||"").trim())
      .map(row=>{
        const matched=Array.isArray(row._matchedRemitos)?row._matchedRemitos:[];
        const ordered=[...matched].sort((a,b)=>parseChronoDateMs(a.fecha)-parseChronoDateMs(b.fecha));
        const numeros=[...new Set(ordered.map(m=>String(m.numero||"").trim()).filter(Boolean))];
        const last=ordered.length?ordered[ordered.length-1]:null;
        return {
          nSolicitud:row.nSolicitud,
          cantidadEnviada:toNumber(row.cantidadEnviada),
          numeroRemito:numeros.join(" / "),
          fechaSalida:String(last?.fecha||"").trim(),
          cantidad:ordered.reduce((acc,m)=>acc+toNumber(m.cantidad),0)
        };
      });

    if(!payloadRows.length)return {updatedRows:0,payloadRows:[]};
    const res=await fetch(APPS_SCRIPT_URL,{
      method:"POST",
      cache:"no-store",
      redirect:"follow",
      headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},
      body:new URLSearchParams({payload:JSON.stringify({action:"save_raba03_cant_enviada",rows:payloadRows})}).toString()
    });
    if(!res.ok)throw new Error(`Error HTTP ${res.status}`);
    const json=await res.json();
    if(!json.ok)throw new Error(json?.error?.message||"No se pudo sincronizar RABA03 con los remitos.");

    // El POST ya terminó después de escribir Google Sheets. Reflejar la misma
    // confirmación localmente sin obligar a otra lectura física de toda RABA03.
    const byPedido=new Map(payloadRows.map(r=>[String(r.nSolicitud||"").trim(),r]));
    setRows(prev=>(prev||[]).map(row=>{
      const patch=byPedido.get(String(row.nSolicitud||"").trim());
      if(!patch)return row;
      const enviada=toNumber(patch.cantidadEnviada);
      return {
        ...row,
        cantidadEnviada:enviada,
        cantidadRestante:Math.max(0,toNumber(row.cantidadSolicitada)-enviada),
        numeroRemitoFuente:patch.numeroRemito||"",
        fechaSalidaFuente:patch.fechaSalida||""
      };
    }));
    return {...json,payloadRows};
  },[rows,rejectedSolicitudes,buildSolicitudKey,allocateRemitosToRequests,remitoPairKey,toNumber]);
'''
s=replace_once(s, anchor, helper, 'RABA targeted sync helpers')

# Importaciones y edición: action loader hasta confirmación.
s=replace_once(s, '''    try{
      setImportModal(prev=>({...prev,loading:true,error:""}));''', '''    try{
      setActionLoading("Cargando solicitudes en Google Sheets...");
      setImportModal(prev=>({...prev,loading:true,error:""}));''', 'import loader start')
s=replace_once(s, '''    }catch(err){
      const msg=err?.message||String(err);
      setImportModal(prev=>({...prev,loading:false,error:"Error cargando solicitudes: "+msg}));
      setError(msg);
    }
  },[importModal.rows,loadRaba03]);''', '''    }catch(err){
      const msg=err?.message||String(err);
      setImportModal(prev=>({...prev,loading:false,error:"Error cargando solicitudes: "+msg}));
      setError(msg);
    }finally{
      setActionLoading("");
    }
  },[importModal.rows,loadRaba03]);''', 'import loader finally')

# Guardar RABA03 manual: usar actionLoading visible.
s=s.replace('''      setLoading(true);\n      setError(null);\n      const res=await fetch(APPS_SCRIPT_URL,{\n        method:"POST",\n        body:new URLSearchParams({payload:JSON.stringify({action:"save_raba03_cant_enviada",rows:payloadRows})}).toString()\n      });'''.replace('\\n','\n'), '''      setActionLoading("Guardando cambios en Google Sheets...");
      setError(null);
      const res=await fetch(APPS_SCRIPT_URL,{
        method:"POST",
        body:new URLSearchParams({payload:JSON.stringify({action:"save_raba03_cant_enviada",rows:payloadRows})}).toString()
      });''', 1)
s=s.replace('''    }finally{
      setLoading(false);
    }
  },[rows,toNumber,loadRaba03]);''', '''    }finally{
      setActionLoading("");
    }
  },[rows,toNumber,loadRaba03]);''', 1)

# Guardar códigos manual.
old='''    try{
      setLoading(true);
      setError(null);
      const res=await fetch(APPS_SCRIPT_URL,{
        method:"POST",
        body:new URLSearchParams({payload:JSON.stringify({action:"save_raba03_codigos",rows:payloadRows})}).toString()
      });'''
new='''    try{
      setActionLoading("Guardando códigos en Google Sheets...");
      setError(null);
      const res=await fetch(APPS_SCRIPT_URL,{
        method:"POST",
        body:new URLSearchParams({payload:JSON.stringify({action:"save_raba03_codigos",rows:payloadRows})}).toString()
      });'''
s=replace_once(s,old,new,'codes loader start')
old='''    }finally{
      setLoading(false);
    }
  },[codigoEdits,loadRaba03]);'''
new='''    }finally{
      setActionLoading("");
    }
  },[codigoEdits,loadRaba03]);'''
s=replace_once(s,old,new,'codes loader finally')

# Reject / restore loaders.
s=replace_once(s, '''    const key=buildSolicitudKey(row);
    try{
      await postEstadoSolicitud("save_estado_solicitud",{estado:{''', '''    const key=buildSolicitudKey(row);
    setActionLoading("Guardando rechazo en Google Sheets...");
    try{
      await postEstadoSolicitud("save_estado_solicitud",{estado:{''', 'reject loader start')
s=replace_once(s, '''      setRejectModal({open:false,row:null,observacion:""});
    }catch(err){appAlert("No se pudo guardar el rechazo para todos: "+(err?.message||err));}
  },[rejectModal,buildSolicitudKey,postEstadoSolicitud,loadEstadosSolicitudesCompartidos]);''', '''      setRejectModal({open:false,row:null,observacion:""});
    }catch(err){appAlert("No se pudo guardar el rechazo para todos: "+(err?.message||err));}
    finally{setActionLoading("");}
  },[rejectModal,buildSolicitudKey,postEstadoSolicitud,loadEstadosSolicitudesCompartidos]);''', 'reject loader finally')
s=replace_once(s, '''    const key=buildSolicitudKey(row);
    try{
      await postEstadoSolicitud("delete_estado_solicitud",{clave:key});
      await loadEstadosSolicitudesCompartidos({silent:true});
    }catch(err){appAlert("No se pudo restaurar la solicitud para todos: "+(err?.message||err));}
  },[buildSolicitudKey,postEstadoSolicitud,loadEstadosSolicitudesCompartidos]);''', '''    const key=buildSolicitudKey(row);
    setActionLoading("Restaurando solicitud en Google Sheets...");
    try{
      await postEstadoSolicitud("delete_estado_solicitud",{clave:key});
      await loadEstadosSolicitudesCompartidos({silent:true});
    }catch(err){appAlert("No se pudo restaurar la solicitud para todos: "+(err?.message||err));}
    finally{setActionLoading("");}
  },[buildSolicitudKey,postEstadoSolicitud,loadEstadosSolicitudesCompartidos]);''', 'restore rejected loader')

# Guardar remito: confirmar remitos + sincronizar sólo pares afectados.
old=r'''    try{
      setLoading(true);
      setError(null);
      let guardados=0;
      for(const nuevo of remitosAEnviar){
        await saveRemitoCompartido(nuevo);
        guardados++;
      }
      await loadRemitosCompartidos({silent:false});
      setSuccessAlert({message:`${guardados} ${guardados===1?"remito guardado":"remitos guardados"} y sincronizados para todos los usuarios`});
      setRemitosPendientes([]);
      limpiarRemitoForm();
      setRemitoSearch("");
    }catch(err){
      const msg=err?.message||String(err);
      setError(msg);
      appAlert("No se pudieron guardar todos los remitos. Los que Google Sheets confirmó antes del error sí quedaron registrados: "+msg);
      await loadRemitosCompartidos({silent:true}).catch(()=>{});
    }finally{
      setLoading(false);
    }
  };'''
new=r'''    const affectedPairs=collectRemitoPairKeys(remitosAEnviar);
    try{
      setActionLoading("Guardando remito y actualizando Google Sheets...");
      setError(null);
      let guardados=0;
      for(const nuevo of remitosAEnviar){
        await saveRemitoCompartido(nuevo);
        guardados++;
      }
      const confirmedRemitos=await loadRemitosCompartidos({silent:false});
      await persistRaba03AllocationForPairs(confirmedRemitos,affectedPairs);
      setSuccessAlert({message:`${guardados} ${guardados===1?"remito guardado":"remitos guardados"} y RABA03 actualizado para todos los usuarios`});
      setRemitosPendientes([]);
      limpiarRemitoForm();
      setRemitoSearch("");
    }catch(err){
      const msg=err?.message||String(err);
      setError(msg);
      appAlert("No se pudieron guardar/sincronizar todos los remitos. Se verificará lo confirmado por Google Sheets: "+msg);
      try{
        const confirmedRemitos=await loadRemitosCompartidos({silent:true});
        await persistRaba03AllocationForPairs(confirmedRemitos,affectedPairs);
      }catch(_){}
    }finally{
      setActionLoading("");
    }
  };'''
s=replace_once(s,old,new,'register remito flow')

# Eliminar: no quitar optimísticamente; esperar confirmación real y RABA03.
old=r'''  const deleteRemito=async(id)=>{
    if(!(await appConfirm("¿Eliminar este remito cargado?")))return;
    setRemitos(prev=>prev.filter(r=>r.id!==id));
    try{
      const res=await fetch(APPS_SCRIPT_URL,{
        method:"POST",
        cache:"no-store",
        redirect:"follow",
        headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},
        body:new URLSearchParams({payload:JSON.stringify({action:"delete_remito_cargado",idRemito:id})}).toString()
      });
      const json=await res.json();
      if(!json.ok)throw new Error(json?.error?.message||"No se pudo eliminar el remito compartido.");
      await loadRemitosCompartidos({silent:false});
    }catch(err){
      console.warn("No se pudo eliminar el remito en la hoja compartida:",err);
    }
  };'''
new=r'''  const deleteRemito=async(id)=>{
    if(!(await appConfirm("¿Eliminar este remito cargado?")))return;
    const targetRemito=(remitos||[]).find(r=>r.id===id)||null;
    const affectedPairs=collectRemitoPairKeys(targetRemito?[targetRemito]:[]);
    setActionLoading("Eliminando remito y actualizando Google Sheets...");
    try{
      const res=await fetch(APPS_SCRIPT_URL,{
        method:"POST",
        cache:"no-store",
        redirect:"follow",
        headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},
        body:new URLSearchParams({payload:JSON.stringify({action:"delete_remito_cargado",idRemito:id})}).toString()
      });
      if(!res.ok)throw new Error(`Error HTTP ${res.status}`);
      const json=await res.json();
      if(!json.ok)throw new Error(json?.error?.message||"No se pudo eliminar el remito compartido.");
      const confirmedRemitos=await loadRemitosCompartidos({silent:false});
      if((confirmedRemitos||[]).some(r=>r.id===id))throw new Error("Google Sheets todavía informa el remito como existente.");
      await persistRaba03AllocationForPairs(confirmedRemitos,affectedPairs);
      setSuccessAlert({message:"Remito eliminado y RABA03 recalculado correctamente."});
    }catch(err){
      const msg=err?.message||String(err);
      console.warn("No se pudo eliminar el remito en la hoja compartida:",err);
      appAlert("No se pudo confirmar la eliminación del remito: "+msg);
      await loadRemitosCompartidos({silent:true}).catch(()=>{});
    }finally{
      setActionLoading("");
    }
  };'''
s=replace_once(s,old,new,'delete remito confirmation')

p.write_text(s)

# -----------------------------------------------------------------------------
# Vite plugin: invalidar cache vieja y usar fecha final de remitos vinculados.
# -----------------------------------------------------------------------------
p=Path('scripts/abastecimiento-instant-vite-plugin.mjs')
s=p.read_text()
s=s.replace('dm_raba03_view_rows_v3','dm_raba03_view_rows_v4')
old='''    const indicadoresCerrados=filasActivas.filter(r=>toNumber(r.cantidadSolicitada)>0&&(toNumber(r.cantidadRestante)<=0||closedSolicitudes?.[buildSolicitudKey(r)])).map(r=>{\\n      const fechaSalida=String(r.fechaSalidaFuente||"").trim();\\n      const indicador=fechaSalida?calcularIndicadorRABA03(r.fechaSolicitud,fechaSalida):"";\\n      const indicadorNum=indicador===""?NaN:Number(indicador);\\n      return {...r,numeroRemito:r.numeroRemitoFuente||"",fechaSalida,indicador,indicadorNum};\\n    }).filter(r=>Number.isFinite(r.indicadorNum)&&r.indicadorNum>=0);'''
new='''    const indicadoresCerrados=filasActivas.filter(r=>toNumber(r.cantidadSolicitada)>0&&(toNumber(r.cantidadRestante)<=0||closedSolicitudes?.[buildSolicitudKey(r)])).map(r=>{\\n      const matched=Array.isArray(r._matchedRemitos)?r._matchedRemitos:[];\\n      const ordered=[...matched].sort((a,b)=>(parseRabaDateMs(a.fecha)||0)-(parseRabaDateMs(b.fecha)||0));\\n      const last=ordered.length?ordered[ordered.length-1]:null;\\n      const fechaSalida=String(last?.fecha||"").trim();\\n      const numerosRemito=[...new Set(ordered.map(m=>String(m.numero||"").trim()).filter(Boolean))];\\n      const indicador=fechaSalida?calcularIndicadorRABA03(r.fechaSolicitud,fechaSalida):"";\\n      const indicadorNum=indicador===""?NaN:Number(indicador);\\n      return {...r,numeroRemito:numerosRemito.join(" / "),fechaSalida,indicador,indicadorNum};\\n    }).filter(r=>Number.isFinite(r.indicadorNum)&&r.indicadorNum>=0);'''
s=replace_once(s,old,new,'plugin closed indicators')
s=s.replace('''      if(!next.includes('numeroRemito:r.numeroRemitoFuente||"",fechaSalida,indicador,indicadorNum')){
        throw new Error('Más demorados debe conservar remito, fecha e indicador del ítem');
      }''','''      if(!next.includes('numeroRemito:numerosRemito.join(" / "),fechaSalida,indicador,indicadorNum')){
        throw new Error('Más demorados debe conservar remitos vinculados, fecha final e indicador del ítem');
      }''',1)
p.write_text(s)

# -----------------------------------------------------------------------------
# Update existing regression expectations.
# -----------------------------------------------------------------------------
p=Path('tests/abastecimiento-allocation-regression.test.mjs')
s=p.read_text()
s=s.replace('''  assert.match(source,/descripcion:norm\\(r\\.descripcion\\)/);\n  assert.match(source,/sol\\.descripcion===descripcionNormalizada/);\n  assert.match(source,/sol\\.fechaMs<=fechaMs/);'''.replace('\\n','\n'), '''  assert.match(source,/proyecto:normalizeCentroCosto\\(r\\.centroCosto\\)/);
  assert.doesNotMatch(source,/sol\\.descripcion===descripcionNormalizada/);
  assert.match(source,/sol\\.fechaMs<=fechaMs/);''')
s=s.replace('dm_raba03_view_rows_v3','dm_raba03_view_rows_v4')
s=s.replace('''  assert.match(result.code,/numeroRemito:r\\.numeroRemitoFuente\\|\\|"",fechaSalida,indicador,indicadorNum/);''','''  assert.match(result.code,/numeroRemito:numerosRemito\\.join\\(" \\/ "\\),fechaSalida,indicador,indicadorNum/);''')
p.write_text(s)

# New regressions focused on this incident.
p=Path('tests/abastecimiento-remito-sync-regression.test.mjs')
p.write_text(r'''import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { abastecimientoInstantVitePlugin } from '../scripts/abastecimiento-instant-vite-plugin.mjs';

const source=fs.readFileSync(new URL('../src/modules/abastecimiento/AbastecimientoModule.jsx',import.meta.url),'utf8');
const proxy=fs.readFileSync(new URL('../api/apps-script.js',import.meta.url),'utf8');

test('1527ALT puede vincular por código + proyecto aunque cambie la descripción',()=>{
  assert.match(source,/const key=\[code,proyecto\]\.join\("__"\)/);
  assert.match(source,/const key=shipment\.proyecto\?\[shipment\.code,shipment\.proyecto\]\.join\("__"\):""/);
  assert.doesNotMatch(source,/\[code,proyecto,insumoKey\]\.join\("__"\)/);
  assert.doesNotMatch(source,/sol\.descripcion===descripcionNormalizada/);

  const request={codigo:'1527ALT',proyecto:'JOSE MARIA',descripcion:'FILTRO DE COMBUSTIBLE',fecha:'14/9/2026',solicitada:3};
  const remito={codigo:'1527ALT',proyecto:'JOSE MARIA',descripcion:'FILTRO COMBUS FF5488 600-319-3750',fecha:'14/9/2026',cantidad:3};
  const normCode=v=>String(v).toUpperCase().replace(/[^A-Z0-9]/g,'');
  assert.equal(`${normCode(request.codigo)}__${request.proyecto}`,`${normCode(remito.codigo)}__${remito.proyecto}`);
  assert.notEqual(request.descripcion,remito.descripcion);
});

test('eliminar remito espera confirmación de Google Sheets y no elimina optimísticamente',()=>{
  const start=source.indexOf('const deleteRemito=async(id)=>{');
  const end=source.indexOf('\n  const badgeStyle=',start);
  assert.ok(start>=0&&end>start);
  const block=source.slice(start,end);
  assert.match(block,/setActionLoading\("Eliminando remito y actualizando Google Sheets\.\.\."\)/);
  assert.match(block,/await loadRemitosCompartidos\(\{silent:false\}\)/);
  assert.match(block,/some\(r=>r\.id===id\)/);
  assert.match(block,/await persistRaba03AllocationForPairs\(confirmedRemitos,affectedPairs\)/);
  assert.doesNotMatch(block,/setRemitos\(prev=>prev\.filter/);
  assert.match(block,/finally\{\s*setActionLoading\(""\)/);
});

test('guardar remito sincroniza RABA03 antes de quitar Cargando',()=>{
  const start=source.indexOf('const registerRemito=async()=>{');
  const end=source.indexOf('\n  const deleteRemito=',start);
  const block=source.slice(start,end);
  assert.match(block,/setActionLoading\("Guardando remito y actualizando Google Sheets\.\.\."\)/);
  assert.match(block,/const confirmedRemitos=await loadRemitosCompartidos/);
  assert.match(block,/await persistRaba03AllocationForPairs\(confirmedRemitos,affectedPairs\)/);
  assert.match(block,/finally\{\s*setActionLoading\(""\)/);
});

test('RABA03 normal usa CacheService; proxy no fuerza lectura física',()=>{
  const rabaBlock=proxy.match(/if \(req\.method === "GET" && String\(query\.action[\s\S]*?\n  \}/)?.[0]||'';
  assert.match(rabaBlock,/query\.limit = "all"/);
  assert.doesNotMatch(rabaBlock,/query\.force = "1"/);
});

test('dashboard usa fecha final del remito vinculado y no depende de Fecha de salida persistida',()=>{
  const result=abastecimientoInstantVitePlugin().transform(source,'/repo/src/modules/abastecimiento/AbastecimientoModule.jsx');
  assert.ok(result?.code);
  assert.match(result.code,/const matched=Array\.isArray\(r\._matchedRemitos\)\?r\._matchedRemitos:\[\]/);
  assert.match(result.code,/const last=ordered\.length\?ordered\[ordered\.length-1\]:null/);
  assert.match(result.code,/const fechaSalida=String\(last\?\.fecha\|\|""\)\.trim\(\)/);
  assert.match(result.code,/dm_raba03_view_rows_v4/);
});
''')

print('Abastecimiento remito sync fix aplicado.')
