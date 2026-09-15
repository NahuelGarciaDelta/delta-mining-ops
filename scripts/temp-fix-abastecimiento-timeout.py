from pathlib import Path
import re

# 1) Aumenta timeout de red como red de seguridad.
read_api=Path('src/services/raba03ReadApi.js')
s=read_api.read_text()
if 'const TIMEOUT_MS=12000;' not in s:
    raise SystemExit('TIMEOUT_MS esperado no encontrado')
s=s.replace('const TIMEOUT_MS=12000;','const TIMEOUT_MS=30000;',1)
s=s.replace('throw new Error("RABA03 no respondió dentro de 12 segundos")','throw new Error(`RABA03 no respondió dentro de ${Math.round(TIMEOUT_MS/1000)} segundos`)',1)
s=s.replace('throw new Error("Abastecimiento no respondió dentro de 12 segundos")','throw new Error(`Abastecimiento no respondió dentro de ${Math.round(TIMEOUT_MS/1000)} segundos`)',1)
read_api.write_text(s)

# 2) Separa RABA03 del snapshot grande de remitos/estados.
service=Path('src/services/abastecimientoSupabase.js')
s=service.read_text()
s=s.replace('import { fetchAbastecimientoSnapshot } from "./raba03ReadApi.js";','import { fetchAbastecimientoSnapshot, fetchRaba03FromSupabase } from "./raba03ReadApi.js";',1)
old='let snapshotPromise=null,snapshotCache=null,snapshotAt=0;\nconst SNAPSHOT_TTL_MS=5000;'
new='let snapshotPromise=null,snapshotCache=null,snapshotAt=0;\nlet raba03Promise=null,raba03Cache=null,raba03At=0;\nconst SNAPSHOT_TTL_MS=5000;'
if old not in s: raise SystemExit('variables de cache esperadas no encontradas')
s=s.replace(old,new,1)
s=s.replace('export function invalidateAbastecimientoSnapshot(){snapshotCache=null;snapshotAt=0;}','export function invalidateAbastecimientoSnapshot(){snapshotCache=null;snapshotAt=0;raba03Cache=null;raba03At=0;}',1)
marker='export async function getAbastecimientoSnapshot({force=false}={}){'
if marker not in s: raise SystemExit('getAbastecimientoSnapshot no encontrado')
raba03_fn='''export async function getAbastecimientoRaba03({force=false}={}){\n  const now=Date.now();\n  if(!force&&raba03Cache&&now-raba03At<SNAPSHOT_TTL_MS)return raba03Cache;\n  if(raba03Promise&&!force)return raba03Promise;\n  raba03Promise=fetchRaba03FromSupabase().then(value=>{\n    const data={ok:true,data:Array.isArray(value?.data)?value.data:[],meta:value?.meta||{},source:"supabase"};\n    raba03Cache=data;raba03At=Date.now();return data;\n  });\n  try{return await raba03Promise;}finally{raba03Promise=null;}\n}\n'''
s=s.replace(marker,raba03_fn+marker,1)
service.write_text(s)

# 3) El módulo carga RABA03 directo y en paralelo con remitos/estados.
module=Path('src/modules/abastecimiento/AbastecimientoModule.jsx')
s=module.read_text()
s=s.replace('configureAbastecimientoBackend, getAbastecimientoSnapshot, saveAbastecimientoRemito','configureAbastecimientoBackend, getAbastecimientoSnapshot, getAbastecimientoRaba03, saveAbastecimientoRemito',1)

load_pattern=re.compile(r'''  const loadRaba03=useCallback\(async\(\{silent=false,remitosOverride=null\}=\{\}\)=>\{.*?\n  \},\[mapRaba03Rows\]\);''',re.S)
load_repl='''  const loadRaba03=useCallback(async({silent=false}={})=>{\n    if(!silent){\n      setLoading(true);\n      setError(null);\n    }\n    try{\n      const json=await getAbastecimientoRaba03();\n      if(!json?.ok)throw new Error("No se pudo leer RABA03 desde Supabase");\n      const raw=Array.isArray(json.data)?json.data:[];\n      rawRaba03RowsRef.current=raw;\n      const normalizedRows=mapRaba03Rows(raw);\n      setRows(normalizedRows);\n      writeCachedSource(RABA03_DATA_CACHE_KEY,{ok:true,data:normalizedRows,meta:{updatedAt:new Date().toISOString(),rows:normalizedRows.length}}).catch(()=>{});\n    }catch(err){\n      if(!silent){\n        setError(err.message||String(err));\n        setRows([]);\n      }else{\n        console.warn("No se pudo actualizar RABA03 silenciosamente:",err);\n      }\n    }finally{\n      if(!silent)setLoading(false);\n    }\n  },[mapRaba03Rows]);'''
s,n=load_pattern.subn(load_repl,s,count=1)
if n!=1: raise SystemExit(f'loadRaba03 reemplazos={n}')

init_pattern=re.compile(r'''  // Carga inicial stale-while-revalidate:.*?\n  \},\[loadRaba03,loadRemitosCompartidos,loadEstadosSolicitudesCompartidos\]\);''',re.S)
init_repl='''  // Carga inicial stale-while-revalidate: pinta primero la última copia local y\n  // actualiza RABA03, remitos y estados EN PARALELO. Una demora del snapshot\n  // grande de remitos/estados nunca vuelve a bloquear la tabla RABA03.\n  useEffect(()=>{\n    if(raba03InitialLoadDoneRef.current)return;\n    raba03InitialLoadDoneRef.current=true;\n    let cancelled=false;\n    let completed=false;\n    const run=async()=>{\n      let hasCachedRows=false;\n      try{\n        const cached=await readCachedSource(RABA03_DATA_CACHE_KEY);\n        const cachedPayload=cached?.data||cached?.value||null;\n        const cachedRows=cachedPayload?.ok&&Array.isArray(cachedPayload.data)?cachedPayload.data:[];\n        if(cachedRows.length&&!cancelled){\n          hasCachedRows=true;\n          setRows(cachedRows);\n          setLoading(false);\n        }\n      }catch(_){}\n\n      await Promise.allSettled([\n        loadRaba03({silent:hasCachedRows}),\n        loadRemitosCompartidos({silent:true}),\n        loadEstadosSolicitudesCompartidos({silent:true})\n      ]);\n      if(cancelled)return;\n      completed=true;\n      setLoading(false);\n    };\n    run().catch(err=>{\n      if(!cancelled){\n        completed=true;\n        setError(err?.message||String(err));\n        setLoading(false);\n      }\n    });\n    return()=>{\n      cancelled=true;\n      if(!completed)raba03InitialLoadDoneRef.current=false;\n    };\n  },[loadRaba03,loadRemitosCompartidos,loadEstadosSolicitudesCompartidos]);'''
s,n=init_pattern.subn(init_repl,s,count=1)
if n!=1: raise SystemExit(f'carga inicial reemplazos={n}')

refresh_pattern=re.compile(r'''  // Registro en el motor único de actualización de la aplicación\.\n  useEffect\(\(\)=>registerRefreshTask\("abastecimiento",async\(\)=>\{.*?\n  \},\{views:''',re.S)
refresh_repl='''  // Registro en el motor único de actualización de la aplicación.\n  useEffect(()=>registerRefreshTask("abastecimiento",async()=>{\n    await Promise.allSettled([\n      loadRaba03({silent:true}),\n      loadRemitosCompartidos({silent:true}),\n      loadEstadosSolicitudesCompartidos({silent:true})\n    ]);\n  },{views:'''
s,n=refresh_pattern.subn(refresh_repl,s,count=1)
if n!=1: raise SystemExit(f'refresh reemplazos={n}')
module.write_text(s)

# 4) Regresión específica: evita volver a acoplar RABA03 al snapshot grande.
test=Path('tests/abastecimiento-timeout-regression.test.mjs')
test.write_text('''import test from "node:test";\nimport assert from "node:assert/strict";\nimport fs from "node:fs";\n\nconst moduleSource=fs.readFileSync(new URL("../src/modules/abastecimiento/AbastecimientoModule.jsx",import.meta.url),"utf8");\nconst service=fs.readFileSync(new URL("../src/services/abastecimientoSupabase.js",import.meta.url),"utf8");\nconst readApi=fs.readFileSync(new URL("../src/services/raba03ReadApi.js",import.meta.url),"utf8");\n\ntest("RABA03 usa lectura directa y no el snapshot grande",()=>{\n  assert.match(service,/fetchRaba03FromSupabase/);\n  assert.match(service,/export async function getAbastecimientoRaba03/);\n  const load=moduleSource.split("const loadRaba03=useCallback")[1]?.split("// Carga inicial stale-while-revalidate")[0]||"";\n  assert.match(load,/getAbastecimientoRaba03\(\)/);\n  assert.doesNotMatch(load,/getAbastecimientoSnapshot\(\)/);\n});\n\ntest("carga inicial dispara RABA03, remitos y estados en paralelo",()=>{\n  const init=moduleSource.split("// Carga inicial stale-while-revalidate")[1]?.split("// Registro en el motor único")[0]||"";\n  assert.match(init,/Promise\.allSettled\(\[/);\n  assert.match(init,/loadRaba03\(\{silent:hasCachedRows\}\)/);\n  assert.match(init,/loadRemitosCompartidos\(\{silent:true\}\)/);\n  assert.match(init,/loadEstadosSolicitudesCompartidos\(\{silent:true\}\)/);\n});\n\ntest("timeout de red deja margen de 30 segundos",()=>{\n  assert.match(readApi,/const TIMEOUT_MS=30000/);\n  assert.doesNotMatch(readApi,/dentro de 12 segundos/);\n});\n''')

print('Fix de timeout/paralelismo preparado.')
