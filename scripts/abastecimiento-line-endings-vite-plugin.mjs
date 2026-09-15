const normalizeId=id=>String(id||"").replace(/\\/g,"/").split("?")[0];

export function abastecimientoLineEndingsVitePlugin(){
  return {
    name:"delta-abastecimiento-line-endings",
    enforce:"pre",
    transform(code,id){
      const file=normalizeId(id);
      if(!file.endsWith("/src/modules/abastecimiento/AbastecimientoModule.jsx"))return null;
      const next=String(code||"").replace(/\r\n?/g,"\n");
      if(next===code)return null;
      return {code:next,map:null};
    }
  };
}
