const strip=value=>String(value??"")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"")
  .replace(/[._/\\-]+/g," ")
  .replace(/\s+/g," ")
  .trim()
  .toUpperCase();

const ALIASES=new Map([
  ["JM","JOSE MARIA"],["J M","JOSE MARIA"],["JOSE MARIA","JOSE MARIA"],["PROYECTO JOSE MARIA","JOSE MARIA"],
  ["FS","FILO DEL SOL"],["FDS","FILO DEL SOL"],["FILO","FILO DEL SOL"],["FILO DEL SOL","FILO DEL SOL"],["FILO DE SOL","FILO DEL SOL"],["VICUNA","FILO DEL SOL"],
  ["FILO SUR","FILO SUR"],["FILOSUR","FILO SUR"],["F SUR","FILO SUR"],["FSUR","FILO SUR"],
  ["EL ZORRO","EL ZORRO"],["ZORRO","EL ZORRO"],["PROYECTO EL ZORRO","EL ZORRO"],
]);

export function normalizeProjectName(value,{empty="S/D"}={}){
  const key=strip(value);
  if(!key)return empty;
  // Importante: sólo aliases explícitos. Un proyecto futuro como FILO NORTE
  // debe conservarse como proyecto independiente y nunca caer en FILO DEL SOL.
  return ALIASES.get(key)||key;
}

export function projectFromRow(row){
  if(!row)return "S/D";
  return normalizeProjectName(
    row.proyecto??row.Proyecto??row.lugar??row.Lugar??row["Proyecto/Lugar"]??row._proyectoForzado??row.centroCosto??row.centro_costo??""
  );
}

export function collectProjects(...sources){
  const set=new Set();
  for(const source of sources){
    for(const row of Array.isArray(source)?source:[]){
      const value=projectFromRow(row);
      if(value&&value!=="S/D"&&value!=="SIN PROYECTO")set.add(value);
    }
  }
  return [...set].sort((a,b)=>a.localeCompare(b,"es",{numeric:true,sensitivity:"base"}));
}

export function projectLabel(value){
  const p=normalizeProjectName(value,{empty:""});
  if(p==="JOSE MARIA")return "JM";
  if(p==="FILO DEL SOL")return "FDS";
  if(p==="FILO SUR")return "Filo Sur";
  if(p==="EL ZORRO")return "El Zorro";
  return String(p||value||"").replace(/\b\w/g,ch=>ch.toUpperCase()).replace(/\B\w/g,ch=>ch.toLowerCase());
}

export function projectMatches(a,b){
  const aa=normalizeProjectName(a,{empty:""});
  const bb=normalizeProjectName(b,{empty:""});
  return Boolean(aa&&bb&&aa===bb);
}
