const TARGET = '/src/modules/oficina-tecnica/OficinaTecnicaModule.jsx'

function replaceExactlyOnce(source, before, after, label) {
  const first = source.indexOf(before)
  if (first === -1) throw new Error(`[control-rop02-rop05-refresh] No se encontró el bloque esperado: ${label}`)
  if (source.indexOf(before, first + before.length) !== -1) {
    throw new Error(`[control-rop02-rop05-refresh] El bloque aparece más de una vez: ${label}`)
  }
  return source.slice(0, first) + after + source.slice(first + before.length)
}

export function controlRop02Rop05RefreshVitePlugin() {
  return {
    name: 'control-rop02-rop05-refresh',
    enforce: 'pre',
    transform(code, id) {
      const file = String(id || '').replace(/\\/g, '/')
      if (!file.endsWith(TARGET)) return null

      let next = code

      next = replaceExactlyOnce(
        next,
        'import {getRop02,getRop05,getRop02LatestByEquipmentProject} from "../../data/historicalDataService.js";',
        'import {getRop02,getRop05,getRop02LatestByEquipmentProject,refreshHistoricalDataset} from "../../data/historicalDataService.js";\nimport {registerRefreshTask} from "../../services/refreshManager.js";',
        'imports de históricos/refresco'
      )

      const oldLoad = `      const getter=dataset==="rop02"?getRop02:getRop05;\n      const result=await getter({\n        limit:"all",\n        offset:0,\n        sortBy:"fecha",\n        sortDirection:"desc"\n      });`
      const newLoad = `      const getter=dataset==="rop02"?getRop02:getRop05;\n      const query={\n        limit:"all",\n        offset:0,\n        sortBy:"fecha",\n        sortDirection:"desc"\n      };\n      // force=true debe saltar tanto el cache local como el snapshot hidratado de la vista.\n      // refreshHistoricalDataset va directo a la fuente Supabase del dataset.\n      const result=force\n        ? await refreshHistoricalDataset(dataset,query)\n        : await getter(query);`
      next = replaceExactlyOnce(next, oldLoad, newLoad, 'carga forzada de dataset completo')

      const anchor = `  const controlLive=useMemo(\n    ()=>controlRemote.loaded?calcControl(controlRemote.rop02,controlRemote.rop05):control,`
      const injected = `  // El botón global Actualizar debe refrescar esta vista con ambas bases reales.\n  // Se registra sólo para view=control y no cambia ninguna otra pestaña.\n  useEffect(()=>registerRefreshTask("oficina-control-rop02-rop05-refresh",async()=>{\n    if(view!=="control")return;\n    const [rows02,rows05]=await Promise.all([\n      loadFullDataset("rop02",{force:true}),\n      loadFullDataset("rop05",{force:true})\n    ]);\n    const allowedProjects=new Set((rop02All||[]).map(r=>r.proyecto).filter(Boolean));\n    const restrict=allowedProjects.size>0;\n    const next02=restrict?rows02.filter(r=>allowedProjects.has(r.proyecto)):rows02;\n    const next05=restrict?rows05.filter(r=>allowedProjects.has(r.proyecto)):rows05;\n    setControlRemote({loaded:true,rop02:next02,rop05:next05});\n    return {ok:true,rop02:next02.length,rop05:next05.length};\n  },{views:["control"],priority:30}),[view,loadFullDataset,rop02All]);\n\n${anchor}`
      next = replaceExactlyOnce(next, anchor, injected, 'registro del botón Actualizar en control ROP02 vs ROP05')

      return { code: next, map: null }
    }
  }
}
