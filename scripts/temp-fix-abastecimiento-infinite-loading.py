from pathlib import Path

p=Path('src/modules/abastecimiento/AbastecimientoModule.jsx')
s=p.read_text()

# 1) Timeout real de cliente: nunca dejar un fetch pendiente indefinidamente.
needle='const RABA03_CLOSED_STORAGE_KEY = "dm_raba03_solicitudes_cerradas_manual_v1";\n'
insert='''const RABA03_CLOSED_STORAGE_KEY = "dm_raba03_solicitudes_cerradas_manual_v1";\nconst fetchWithTimeout=async(url,options={},timeoutMs=20000,label="Solicitud")=>{\n  const controller=new AbortController();\n  const timer=setTimeout(()=>controller.abort(),timeoutMs);\n  try{\n    return await fetch(url,{...options,signal:controller.signal});\n  }catch(err){\n    if(err?.name==="AbortError")throw new Error(`${label} no respondió dentro de ${Math.round(timeoutMs/1000)} segundos`);\n    throw err;\n  }finally{\n    clearTimeout(timer);\n  }\n};\n'''
if needle not in s:
    raise SystemExit('No se encontró RABA03_CLOSED_STORAGE_KEY')
s=s.replace(needle,insert,1)

# 2) Mantener el último estado de remitos en un ref para que loadRaba03 sea estable.
needle='''  const [remitos,setRemitos]=useState(()=>{\n    try{return JSON.parse(window.localStorage.getItem(RABA08_STORAGE_KEY)||"[]");}\n    catch(_){return [];} \n  });\n'''
replace=needle+'''  const remitosRef=useRef(remitos);\n  useEffect(()=>{remitosRef.current=remitos;},[remitos]);\n'''
if needle not in s:
    raise SystemExit('No se encontró el estado remitos')
s=s.replace(needle,replace,1)

# 3) Cortar las tres lecturas críticas con timeout corto y explícito.
repls={
'''      const res=await fetch(url,{method:"GET",cache:"no-store",redirect:"follow"});''':'''      const res=await fetchWithTimeout(url,{method:"GET",cache:"no-store",redirect:"follow"},15000,"Remitos");''',
'''      const res=await fetch(`${APPS_SCRIPT_URL}?action=estados_solicitudes&force=1&_=${Date.now()}`,{cache:"no-store",redirect:"follow"});''':'''      const res=await fetchWithTimeout(`${APPS_SCRIPT_URL}?action=estados_solicitudes&force=1&_=${Date.now()}`,{cache:"no-store",redirect:"follow"},15000,"Estados de solicitudes");''',
'''      const res=await fetch(url,{cache:"no-store"});''':'''      const res=await fetchWithTimeout(url,{cache:"no-store"},20000,"RABA03");''',
'''      const sourceRemitos=Array.isArray(remitosOverride)?remitosOverride:remitos;''':'''      const sourceRemitos=Array.isArray(remitosOverride)?remitosOverride:remitosRef.current;''',
'''  },[mapRaba03Rows,remitos]);''':'''  },[mapRaba03Rows]);'''
}
for old,new in repls.items():
    if old not in s:
        raise SystemExit('No se encontró bloque esperado: '+old[:80])
    s=s.replace(old,new,1)

# 4) La carga principal de RABA03 NO espera a remitos/estados. Esos datos se refrescan en paralelo.
old='''    const run=async()=>{\n      let sharedRemitos=null;\n      try{sharedRemitos=await loadRemitosCompartidos({silent:true});}catch(_){}\n      try{await loadEstadosSolicitudesCompartidos({silent:true});}catch(_){}\n      if(cancelled)return;\n      await loadRaba03({silent:false,remitosOverride:sharedRemitos});\n    };'''
new='''    const run=async()=>{\n      const remitosTask=loadRemitosCompartidos({silent:true}).catch(err=>{\n        console.warn("No se pudieron actualizar remitos al iniciar Abastecimiento:",err);\n        return null;\n      });\n      const estadosTask=loadEstadosSolicitudesCompartidos({silent:true}).catch(err=>{\n        console.warn("No se pudieron actualizar estados al iniciar Abastecimiento:",err);\n        return null;\n      });\n\n      // RABA03 es la vista principal: cargarla ya, sin esperar llamadas auxiliares.\n      try{await loadRaba03({silent:false});}catch(_){}\n      if(cancelled)return;\n\n      const [sharedRemitos]=await Promise.all([remitosTask,estadosTask]);\n      if(cancelled)return;\n      if(Array.isArray(sharedRemitos)){\n        // Reconciliar trazabilidad/dashboard en segundo plano, sin volver a bloquear la UI.\n        await loadRaba03({silent:true,remitosOverride:sharedRemitos}).catch(err=>{\n          console.warn("No se pudo reconciliar RABA03 con remitos:",err);\n        });\n      }\n    };'''
if old not in s:
    raise SystemExit('No se encontró el bloque run inicial de Abastecimiento')
s=s.replace(old,new,1)

p.write_text(s)

# Test de regresión estructural.
t=Path('tests/abastecimiento-loading-regression.test.mjs')
t.write_text('''import test from "node:test";\nimport assert from "node:assert/strict";\nimport fs from "node:fs";\n\nconst source=fs.readFileSync(new URL("../src/modules/abastecimiento/AbastecimientoModule.jsx",import.meta.url),"utf8");\n\ntest("Abastecimiento no puede quedar cargando por esperar remitos/estados",()=>{\n  assert.match(source,/const remitosTask=loadRemitosCompartidos\\(\\{silent:true\\}\\)/);\n  assert.match(source,/try\\{await loadRaba03\\(\\{silent:false\\}\\);\\}catch\\(_\\)\\{\\}/);\n  assert.match(source,/const \\[sharedRemitos\\]=await Promise\\.all\\(\\[remitosTask,estadosTask\\]\\)/);\n});\n\ntest("lecturas críticas tienen timeout y loadRaba03 no cambia por setRemitos",()=>{\n  assert.match(source,/fetchWithTimeout\\(url,\\{method:"GET",cache:"no-store",redirect:"follow"\\},15000,"Remitos"\\)/);\n  assert.match(source,/fetchWithTimeout\\(`\\$\\{APPS_SCRIPT_URL\\}\\?action=estados_solicitudes/);\n  assert.match(source,/fetchWithTimeout\\(url,\\{cache:"no-store"\\},20000,"RABA03"\\)/);\n  assert.match(source,/remitosOverride\\)\\?remitosOverride:remitosRef\\.current/);\n  assert.match(source,/\\},\\[mapRaba03Rows\\]\\);/);\n  assert.doesNotMatch(source,/\\},\\[mapRaba03Rows,remitos\\]\\);/);\n});\n''')
print('Fix de carga infinita aplicado.')
