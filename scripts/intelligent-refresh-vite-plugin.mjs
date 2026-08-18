export function intelligentRefreshVitePlugin(){
  return {
    name:'delta-intelligent-refresh',
    enforce:'pre',
    transform(code,id){
      if(!id.endsWith('/src/App.jsx'))return null;
      const oldCall='if(sources.length)await loadSources(sources,{force:true,background});';
      const newCall='if(sources.length)await loadSources(sources,{force:reason==="manual",background});';
      if(!code.includes(oldCall))return null;
      const next=code.replace(oldCall,newCall);
      return {code:next,map:null};
    }
  };
}
