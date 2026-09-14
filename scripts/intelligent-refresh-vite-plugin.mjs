export function intelligentRefreshVitePlugin(){
  return {
    name:'delta-intelligent-refresh',
    enforce:'pre',
    transform(code,id){
      if(!id.endsWith('/src/App.jsx'))return null;
      let next=code;

      // El refresco automático nunca fuerza Sheets; sólo el botón manual puede hacerlo.
      next=next.replace(
        'if(sources.length)await loadSources(sources,{force:true,background});',
        'if(sources.length)await loadSources(sources,{force:reason==="manual",background});'
      );

      // Cuatro lecturas concurrentes fue validado con las cuatro fuentes ROP02 y evita
      // las tandas secuenciales de 20-45 s sin lanzar toda la app de golpe contra GAS.
      next=next.replace(
        'const results=await runWithConcurrency_(toCheck,2,key=>fetchOneSource(key,{force,cacheRecords}));',
        'const results=await runWithConcurrency_(toCheck,4,key=>fetchOneSource(key,{force,cacheRecords}));'
      );

      // IndexedDB es la fuente de arranque. Actualizamos refs ANTES de iniciar red para
      // que loadSources reconozca esos datos como visibles/frescos en el mismo tick.
      const cacheNeedle='const valid=records.filter(([,rec])=>rec?.value?.ok&&Array.isArray(rec.value.data));\n    if(!valid.length)return recordMap;';
      const cacheReplacement=`const valid=records.filter(([,rec])=>rec?.value?.ok&&Array.isArray(rec.value.data));\n    if(!valid.length)return recordMap;\n\n    const cachedRaw={...rawSourcesRef.current};\n    const cachedLoaded={...loadedSourcesRef.current};\n    valid.forEach(([key,rec])=>{\n      cachedRaw[key]=rec.value;\n      cachedLoaded[key]=true;\n      const cachedAt=new Date(rec.updatedAt||0).getTime();\n      if(Number.isFinite(cachedAt)&&cachedAt>0)lastCheckedBySourceRef.current[key]=cachedAt;\n    });\n    rawSourcesRef.current=cachedRaw;\n    loadedSourcesRef.current=cachedLoaded;`;
      next=next.replace(cacheNeedle,cacheReplacement);

      // No esperar requestIdleCallback para leer la cache de la vista actual.
      // El trabajo pesado de red sigue siendo asíncrono; la cache local se pinta primero.
      const idleNeedle=`const id=typeof window.requestIdleCallback==="function"\n      ?window.requestIdleCallback(run,{timeout:250})\n      :window.setTimeout(run,60);\n    return()=>{\n      cancelled=true;\n      if(typeof window.cancelIdleCallback==="function")window.cancelIdleCallback(id);\n      else window.clearTimeout(id);\n    };`;
      const idleReplacement=`const id=window.setTimeout(run,0);\n    return()=>{\n      cancelled=true;\n      window.clearTimeout(id);\n    };`;
      next=next.replace(idleNeedle,idleReplacement);

      if(next===code)return null;
      return {code:next,map:null};
    }
  };
}
