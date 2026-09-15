const normalizeId=id=>String(id||"").replace(/\\/g,"/").split("?")[0];

export function abastecimientoLineEndingsVitePlugin(){
  return {
    name:"delta-source-line-endings",
    enforce:"pre",
    transform(code,id){
      const file=normalizeId(id);
      if(!file.includes("/src/"))return null;
      if(!/\.(jsx?|tsx?)$/i.test(file))return null;
      const next=String(code||"").replace(/\r\n?/g,"\n");
      if(next===code)return null;
      return {code:next,map:null};
    }
  };
}
