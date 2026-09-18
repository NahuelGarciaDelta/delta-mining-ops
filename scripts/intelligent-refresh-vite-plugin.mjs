export function intelligentRefreshVitePlugin(){
  return {
    name:'delta-intelligent-refresh',
    enforce:'pre',
    transform(code,id){
      if(!id.endsWith('/src/App.jsx'))return null;
      let next=code;

      // Política por fuente: ROP02 se considera viejo rápido; ROP05/RMA15 un poco
      // más tarde; catálogos pesados cambian menos y no hace falta descargarlos seguido.
      next=next.replace(
        'const SYNC_FRESH_MS=5*60*1000;',
        `const sourceFreshMs=(key)=>{\n    if(String(key||"").startsWith("rop02_"))return 45*1000;\n    if(key==="rop05"||String(key||"").startsWith("rma15_"))return 2*60*1000;\n    if(key==="lista_equipos"||key==="insumos")return 10*60*1000;\n    return 5*60*1000;\n  };\n  const AUTO_REFRESH_TICK_MS=30*1000;`
      );
      next=next.replace(
        'const fresh=now-Number(lastCheckedBySourceRef.current[key]||0)<SYNC_FRESH_MS;',
        'const fresh=now-Number(lastCheckedBySourceRef.current[key]||0)<sourceFreshMs(key);'
      );

      // El botón manual sí debe forzar una consulta real. Los refrescos automáticos
      // respetan el TTL por fuente y por eso no martillan la red cada 30 segundos.
      next=next.replace(
        'if(sources.length)await loadSources(sources,{force:true,background});',
        'if(sources.length)await loadSources(sources,{force:reason==="manual",background});'
      );

      // Las fuentes independientes se consultan en paralelo, pero se publican en un
      // solo batch. Esto evita 4-9 renders seguidos con normalización de miles de filas.
      next=next.replace(
        'const results=await runWithConcurrency_(toCheck,2,key=>fetchOneSource(key,{force,cacheRecords}));',
        'const results=await runWithConcurrency_(toCheck,3,key=>fetchOneSource(key,{force,cacheRecords}));'
      );

      // El proxy ya resuelve un HTTP transitorio. Reintentar nuevamente desde React
      // duplicaba ejecuciones y empeoraba la saturación.
      next=next.replace(
        'retries:isRop02Source?0:1,timeoutMs:isRop02Source?45000:20000',
        'retries:0,timeoutMs:isRop02Source?45000:20000'
      );

      // IndexedDB es la fuente de arranque. Actualizamos refs ANTES de iniciar red para
      // que la UI pueda pintarse inmediatamente sin bloquearse por la revalidación.
      const cacheNeedle='const valid=records.filter(([,rec])=>rec?.value?.ok&&Array.isArray(rec.value.data));\n    if(!valid.length)return recordMap;';
      const cacheReplacement=`const valid=records.filter(([,rec])=>rec?.value?.ok&&Array.isArray(rec.value.data));\n    if(!valid.length)return recordMap;\n\n    const cachedRaw={...rawSourcesRef.current};\n    const cachedLoaded={...loadedSourcesRef.current};\n    valid.forEach(([key,rec])=>{\n      cachedRaw[key]=rec.value;\n      cachedLoaded[key]=true;\n      const cachedAt=new Date(rec.updatedAt||0).getTime();\n      if(Number.isFinite(cachedAt)&&cachedAt>0)lastCheckedBySourceRef.current[key]=cachedAt;\n    });\n    rawSourcesRef.current=cachedRaw;\n    loadedSourcesRef.current=cachedLoaded;`;
      next=next.replace(cacheNeedle,cacheReplacement);

      // Si una actualización falla, NO marcar la fuente como fresca. Dejar el último
      // timestamp real permite reintentar pronto y evita el "cache pegado" por 5 min.
      next=next.replace(
        'lastCheckedBySourceRef.current[key]=Date.now();\n            console.warn(`No se pudo actualizar ${key}; se mantiene la copia local.`,result.reason);',
        'console.warn(`No se pudo actualizar ${key}; se mantiene la copia local.`,result.reason);'
      );
      next=next.replace(
        'requested.forEach(key=>{lastCheckedBySourceRef.current[key]=Date.now();});\n        console.warn("No se pudo completar la actualización; se mantiene la copia local.",err);',
        'console.warn("No se pudo completar la actualización; se mantiene la copia local y se reintentará pronto.",err);'
      );

      // Revisar frecuentemente la vista activa es barato porque loadSources decide por
      // TTL qué fuente realmente necesita red. Así ROP02 puede refrescarse ~1 min sin
      // obligar a ROP05/RMA15/catálogos a descargarse con esa frecuencia.
      next=next.replace(
        'const AUTO_REFRESH_MS=5*60*1000; // 5 minutos',
        'const AUTO_REFRESH_MS=AUTO_REFRESH_TICK_MS; // tick liviano; cada fuente aplica su propio TTL'
      );

      // No esperar requestIdleCallback para leer la cache de la vista actual.
      // El trabajo de red sigue siendo asíncrono; la cache local se pinta primero.
      const idleNeedle=`const id=typeof window.requestIdleCallback==="function"\n      ?window.requestIdleCallback(run,{timeout:250})\n      :window.setTimeout(run,60);\n    return()=>{\n      cancelled=true;\n      if(typeof window.cancelIdleCallback==="function")window.cancelIdleCallback(id);\n      else window.clearTimeout(id);\n    };`;
      const idleReplacement=`const id=window.setTimeout(run,0);\n    return()=>{\n      cancelled=true;\n      window.clearTimeout(id);\n    };`;
      next=next.replace(idleNeedle,idleReplacement);

      if(next===code)return null;
      return {code:next,map:null};
    }
  };
}
