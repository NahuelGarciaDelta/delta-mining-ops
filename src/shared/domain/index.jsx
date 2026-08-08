import * as XLSX from "xlsx";
import { C, multiIsAll } from "../../components/ui/index.jsx";
import { appAlert } from "../../services/dialogService.js";
import { LOGIN_BACKGROUND_URL } from "../../config/assets.js";
import { cleanEquipmentCode, isCompactorEquipment, isMaintenanceCostMachine, isMaintenanceCostTruck } from "../../modules/equipment/equipmentCode.js";

const IMG_LOGIN_FONDO=LOGIN_BACKGROUND_URL;

// ─── Máquinas excluidas (camionetas, camiones, auxiliares) ────────────────────
const EXCLUDED_TYPES = new Set([
  "CAMIONETA","CAMION CISTERNA","CAMION","CAMION VOLCADOR",
  "GRUPO ELECTROGENO","GENERADOR","CAT-GENERADOR","GENERADOR CAT",
  "PREDIO","CONTENEDOR","OXICORTE","PERTIGA","TALLER DELTA","PREDIO DELTA",
  "N/A","OFICINA","REORGANIZACION","REPARACION","TALLER",
]);
const MACHINE_TYPE_MAP = {
  // Camionetas y vehículos (excluidos de producción)
  "1088":"PERTIGA",
  "AG201HG":"CAMIONETA","AG201HO":"CAMIONETA","AG458MM":"CAMIONETA",
  "AG575LJ":"CAMIONETA","AG575MX":"CAMIONETA","AG469HA":"CAMIONETA",
  "AG600JG":"CAMIONETA","AH045UV":"CAMIONETA","AH106YK":"CAMIONETA",
  "AH619FB":"CAMIONETA","CTA-0848":"CAMIONETA","CTA-1267":"CAMIONETA",
  "CTA0848":"CAMIONETA","CTA-0451":"CAMIONETA","CTA-0541":"CAMIONETA",
  "CTA-0787":"CAMIONETA","CTA-0825":"CAMIONETA","CTA-0879":"CAMIONETA",
  "CTA-0888":"CAMIONETA","CTA-1067":"CAMIONETA","CTA-1131":"CAMIONETA",
  "CTA-1410":"CAMIONETA","CTA-1411":"CAMIONETA","CTA-1418":"CAMIONETA",
  "CTA-1435":"CAMIONETA",
  "AG611LL":"CAMION CISTERNA","AG661LL":"CAMION CISTERNA",
  "AG816QB":"CAMION CISTERNA","AG818QB":"CAMION CISTERNA",
  "CAR-0073":"CAMION REGADOR",
  "CAR-0089":"CAMION REGADOR","CAR-0101":"CAMION REGADOR",
  "CAC-0048":"CAMION DE COMBUSTIBLE",
  "CAT-0073":"CAMION",
  "CAV-0078":"CAMION VOLCADOR","CAV-0114":"CAMION VOLCADOR",
  "CATERPILLAR":"GENERADOR","CAT":"GRUPO ELECTROGENO",
  "CX21067":"GRUPO ELECTROGENO","DE-169":"GRUPO ELECTROGENO","DE169":"GENERADOR CAT",
  "DELTA":"PREDIO",
};

// Tipos canónicos por prefijo de 3 letras
const PREFIX_TYPE_MAP = {
  "CFN":"CARGADORA FRONTAL",
  "PCA":"CARGADORA FRONTAL",
  "MOT":"MOTONIVELADORA",
  "TOP":"TOPADORA",
  "RTP":"RETROPALA",
  "RPC":"VIBROCOMPACTADOR",
  "ROD":"VIBROCOMPACTADOR",
  "EXC":"EXCAVADORA",
  "MNC":"MINICARGADORA",
  "MCA":"MINICARGADORA",
  "CAC":"CAMION DE COMBUSTIBLE",
};

function normalizeMachineCode(code){
  return String(code||"").replace(/\s*\(.*?\)/g,"").replace(/[-_\/\s]+JM$/i,"").trim().toUpperCase();
}
function getMachineType(maquina){
  const norm=normalizeMachineCode(maquina);
  // 1. Buscar en mapa exacto
  if(MACHINE_TYPE_MAP[norm])return MACHINE_TYPE_MAP[norm];
  // 2. Derivar del prefijo de 3 letras del código
  const prefix=norm.replace(/[-_].*/,"").slice(0,3);
  if(PREFIX_TYPE_MAP[prefix])return PREFIX_TYPE_MAP[prefix];
  return null;
}
function isExcluded(maquina){
  const compact=String(maquina||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
  if(compact==="CAA0002"||compact==="CAA0002JM")return true;
  const raw=String(maquina||"").trim().toUpperCase();
  const norm=normalizeMachineCode(raw);
  // Patentes argentinas: formato AA000AA (vieja) o AAA000 o AAA000AA (nueva)
  // Ej: AD098OU, AE015PW, AF374DO, AI100VX, AI158AO, AG611LL, etc.
  if(/^[A-Z]{2}[0-9]{3}[A-Z]{2}$/.test(compact))return true; // vieja: AB123CD
  if(/^[A-Z]{3}[0-9]{3}[A-Z]{2}$/.test(compact))return true; // nueva: ABC123DE
  if(/^[A-Z]{3}[0-9]{3}$/.test(compact))return true;          // moto vieja: ABC123
  // Probar ambas variantes: con y sin sufijo -JM
  const toCheck=[norm, raw];
  for(const c of toCheck){
    // Camionetas CTA-* (con o sin guion, con o sin -JM)
    if(/^CTA/.test(c))return true;
    // Patentes argentinas AG + número (AG611LL, AG201HG, etc.)
    if(/^AG[0-9]/.test(c))return true;
    // Patentes AH + número
    if(/^AH[0-9]/.test(c))return true;
    // Camiones regadores, volcadores, cisternas
    if(/^CAR/.test(c))return true;
    if(/^CAV/.test(c))return true;
    if(/^CAC/.test(c))return true;
    if(/^AG[0-9A-Z]{5,}$/.test(c))return true; // patentes largas AG*
    // Camión CAT con número
    if(/^CAT-[0-9]/.test(c))return true;
    // Lookup en el mapa
    const t=MACHINE_TYPE_MAP[c]||null;
    if(t){
      const tu=t.toUpperCase();
      for(const e of EXCLUDED_TYPES){if(tu.includes(e)||e.includes(tu))return true;}
    }
  }
  return false;
}

function isRop02ControlMachineExcluded(maquina){
  const raw=String(maquina||"").trim().toUpperCase();
  const compact=raw.replace(/[^A-Z0-9]/g,"");
  const norm=normalizeMachineCode(raw);
  return norm==="CAA-0002" || compact==="CAA0002" || /^CAA[-_\s]*0002(?:[-_\s]*JM)?$/i.test(raw);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtNum(n){return(n||0).toLocaleString("es-AR",{maximumFractionDigits:1});}
function fmtPct(n){return`${n}%`;}
function fmtFecha(f){
  if(!f)return"—";
  const[y,m,d]=String(f).slice(0,10).split("-");
  if(!y||!m||!d)return f;
  return`${d}/${m}/${y}`;
}
function uniq(arr){const s=new Set();const r=[];for(const v of arr){const c=typeof v==="string"?v.trim():v;if(c&&!s.has(c)){s.add(c);r.push(c);}}return r.sort();}
function semaforo(pct){
  if(pct>=90)return{color:C.green,label:"ÓPTIMO",dim:C.greenDim};
  if(pct>=70)return{color:C.yellow,label:"ATENCIÓN",dim:C.yellowDim};
  return{color:C.red,label:"CRÍTICO",dim:C.redDim};
}


// ─── Normalización centralizada ──────────────────────────────────────────────
// Capa única para que reportes, filtros y cruces no separen datos por diferencias
// de tildes, mayúsculas, espacios, guiones o nombres equivalentes.
const DM_ALIAS_MAPS={
  proyecto:{
    "JM":"JOSE MARIA","J M":"JOSE MARIA","JOSE MARIA":"JOSE MARIA","JOSÉ MARÍA":"JOSE MARIA","PROYECTO JOSE MARIA":"JOSE MARIA",
    "FS":"FILO DEL SOL","FDS":"FILO DEL SOL","FILO":"FILO DEL SOL","FILO DEL SOL":"FILO DEL SOL","FILO DE SOL":"FILO DEL SOL","VICUNA":"FILO DEL SOL","VICUÑA":"FILO DEL SOL",
    "FILO SUR":"FILO SUR","FILOSUR":"FILO SUR","F SUR":"FILO SUR","FSUR":"FILO SUR",
    "EL ZORRO":"EL ZORRO","ZORRO":"EL ZORRO","PROYECTO EL ZORRO":"EL ZORRO"
  },
  tipoEquipo:{
    "CARGADOR FRONTAL":"CARGADORA FRONTAL","CARGADORA":"CARGADORA FRONTAL","CARGADORA FRONTAL":"CARGADORA FRONTAL","PALA CARGADORA":"CARGADORA FRONTAL",
    "MOTONIVELADORA":"MOTONIVELADORA","MOTO NIVELADORA":"MOTONIVELADORA",
    "RETRO PALA":"RETROPALA","RETROPALA":"RETROPALA",
    "RODILLO":"RODILLO COMPACTADOR","RODILLO COMPACTADOR":"RODILLO COMPACTADOR","VIBROCOMPACTADOR":"RODILLO COMPACTADOR",
    "EXCAVADORA":"EXCAVADORA","MINICARGADORA":"MINICARGADORA","MINI CARGADORA":"MINICARGADORA","TOPADORA":"TOPADORA",
    "VOLCADOR":"CAMIÓN VOLCADOR","CAMION VOLCADOR":"CAMIÓN VOLCADOR","CAMIÓN VOLCADOR":"CAMIÓN VOLCADOR",
    "REGADOR":"CAMIÓN REGADOR","CAMION REGADOR":"CAMIÓN REGADOR","CAMIÓN REGADOR":"CAMIÓN REGADOR",
    "COMBUSTIBLE":"CAMIÓN DE COMBUSTIBLE","CAMION COMBUSTIBLE":"CAMIÓN DE COMBUSTIBLE","CAMIÓN COMBUSTIBLE":"CAMIÓN DE COMBUSTIBLE","CAMION DE COMBUSTIBLE":"CAMIÓN DE COMBUSTIBLE",
    "GRUPO ELECTROGENO":"GRUPO ELECTRÓGENO","GRUPO ELECTRÓGENO":"GRUPO ELECTRÓGENO","GENERADOR":"GRUPO ELECTRÓGENO",
    "CAMIONETA":"CAMIONETA","CAMIONETAS":"CAMIONETA"
  },
  tarea:{
    "PERFILADO CAMINO":"PERFILADO DE CAMINO","PERFILADO DE CAMINO":"PERFILADO DE CAMINO","PERFILADO DE CAMINOS":"PERFILADO DE CAMINO",
    "LIMPIEZA NIEVE":"LIMPIEZA DE NIEVE","LIMPIEZA DE NIEVE":"LIMPIEZA DE NIEVE",
    "LIMPIEZA CAMINO PLATAFORMA":"LIMPIEZA DE CAMINO/PLATAFORMA","LIMPIEZA DE CAMINO PLATAFORMA":"LIMPIEZA DE CAMINO/PLATAFORMA","LIMPIEZA DE CAMINO/PLATAFORMA":"LIMPIEZA DE CAMINO/PLATAFORMA",
    "CONSTRUCCION PLATAFORMA":"CONSTRUCCIÓN DE PLATAFORMA","CONSTRUCCIÓN PLATAFORMA":"CONSTRUCCIÓN DE PLATAFORMA","CONSTRUCCION DE PLATAFORMA":"CONSTRUCCIÓN DE PLATAFORMA","CONSTRUCCIÓN DE PLATAFORMA":"CONSTRUCCIÓN DE PLATAFORMA",
    "CONSTRUCCION CAMINO":"CONSTRUCCIÓN DE CAMINO","CONSTRUCCION DE CAMINO":"CONSTRUCCIÓN DE CAMINO","CONSTRUCCIÓN DE CAMINO":"CONSTRUCCIÓN DE CAMINO",
    "CONSTRUCCION BERMA":"CONSTRUCCIÓN DE BERMA","CONSTRUCCION DE BERMA":"CONSTRUCCIÓN DE BERMA","CONSTRUCCIÓN DE BERMA":"CONSTRUCCIÓN DE BERMA",
    "CARGA DESCARGA CAMION":"CARGA/DESCARGA DE CAMIÓN","CARGA/DESCARGA CAMION":"CARGA/DESCARGA DE CAMIÓN","CARGA/DESCARGA DE CAMION":"CARGA/DESCARGA DE CAMIÓN","CARGA/DESCARGA DE CAMIÓN":"CARGA/DESCARGA DE CAMIÓN",
    "TRABAJO HORA":"TRABAJO POR HORA","TRABAJO POR HORA":"TRABAJO POR HORA","TRABAJO A TERCERO":"TRABAJO A TERCERO",
    "COMPACTACION CAMINO":"COMPACTACIÓN DE CAMINO","COMPACTACION DE CAMINO":"COMPACTACIÓN DE CAMINO","COMPACTACIÓN DE CAMINO":"COMPACTACIÓN DE CAMINO",
    "COMPACTACION PLATAFORMA":"COMPACTACIÓN DE PLATAFORMA","COMPACTACION DE PLATAFORMA":"COMPACTACIÓN DE PLATAFORMA","COMPACTACIÓN DE PLATAFORMA":"COMPACTACIÓN DE PLATAFORMA"
  },
  unidad:{
    "HS":"HS","H":"HS","HORA":"HS","HORAS":"HS","HRS":"HS",
    "ML":"ML","M LINEALES":"ML","METROS LINEALES":"ML","METRO LINEAL":"ML","MTS LINEALES":"ML",
    "KML":"KML","KM":"KML","KILOMETROS LINEALES":"KML","KILÓMETROS LINEALES":"KML","KM LINEALES":"KML",
    "M2":"M2","M²":"M2","METROS CUADRADOS":"M2",
    "M3":"M3","M³":"M3","METROS CUBICOS":"M3","METROS CÚBICOS":"M3"
  }
};
function dmNormKey(v){return String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[._/\\-]+/g," ").replace(/\s+/g," ").trim().toUpperCase();}
function dmApplyAlias(kind,value,def="S/D"){
  const raw=String(value??"").replace(/\s+/g," ").trim();
  if(!raw)return def;
  const map=DM_ALIAS_MAPS[kind]||{};
  const key=dmNormKey(raw);
  return map[key]||raw.replace(/[.]/g,"").replace(/\s+/g," ").trim();
}
function dmNormalizeProject(v){
  const key=dmNormKey(v);
  if(!key)return "S/D";
  if(key.includes("FILO SUR")||key==="FSUR"||key==="F SUR")return "FILO SUR";
  if(key.includes("EL ZORRO")||key==="ZORRO")return "EL ZORRO";
  if(key.includes("JOSE")||key.includes("MARIA")||key==="JM"||key==="J M")return "JOSE MARIA";
  if(key.includes("FILO")||key.includes("VICU")||key==="FS"||key==="FDS")return "FILO DEL SOL";
  return dmApplyAlias("proyecto",v,"S/D");
}
function dmNormalizeTipoEquipo(v){return dmApplyAlias("tipoEquipo",v,"");}

const ROP05_TIPOS_MAQUINA=[
  {label:"Todas",value:"todas",prefijos:[]},
  {label:"Cargadora Frontal",value:"CFN",prefijos:["CFN","PCA"]},
  {label:"Minicargadora",value:"MCA",prefijos:["MCA","MNC"]},
  {label:"Excavadora",value:"EXC",prefijos:["EXC"]},
  {label:"Topadora",value:"TOP",prefijos:["TOP"]},
  {label:"Motoniveladora",value:"MOT",prefijos:["MOT"]},
  {label:"Retropala",value:"RTP",prefijos:["RTP"]},
  {label:"Rodillo Compactador",value:"ROD",prefijos:["ROD","RPC","RCP"]},
];

function tipoMatchMachineROP05(tipoValue,maquina){
  if(multiIsAll(tipoValue,"todas"))return true;
  const arr=Array.isArray(tipoValue)?tipoValue:[tipoValue];
  return arr.some(v=>{
    const t=ROP05_TIPOS_MAQUINA.find(x=>x.value===v);
    return t?.prefijos?.some(p=>maquina?.startsWith(p));
  });
}

function dmTipoMaquinaOptions(){
  return ROP05_TIPOS_MAQUINA.map(t=>({value:t.value,label:t.label}));
}
function dmMatchTipoMaquinaSeleccion(maquina,seleccion){
  return multiIsAll(seleccion,"todas")||tipoMatchMachineROP05(seleccion,maquina);
}
function dmTitleCaseText(value){
  const txt=String(value??"").replace(/[._]+/g," ").replace(/\s+/g," ").trim();
  if(!txt)return "";
  const lower=txt.toLocaleLowerCase("es-AR");
  const keepLower=new Set(["de","del","la","las","el","los","y","e","a","al","en","por","para","con","sin"]);
  return lower.split(" ").map((word,idx)=>{
    if(!word)return word;
    if(idx>0&&keepLower.has(word))return word;
    return word.charAt(0).toLocaleUpperCase("es-AR")+word.slice(1);
  }).join(" ");
}
function dmDisplayTarea(value){
  const raw=String(value??"").replace(/\s+/g," ").trim();
  if(!raw)return "";
  if(dmNormKey(raw)==="OTROS")return "Otros";
  if(dmNormKey(raw)==="NO SE DESCRIBE TAREA")return "No se describe tarea";
  return dmTitleCaseText(raw);
}
function dmNormalizeTarea(v){return dmDisplayTarea(dmApplyAlias("tarea",v,""));}
function dmNormalizeUnidad(v){return dmApplyAlias("unidad",v,"").toUpperCase();}
function cleanKey(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[\r\n]+/g," ").replace(/\s+/g," ").trim().toLowerCase();}
function cleanKeyLoose(v){return cleanKey(v).replace(/[^a-z0-9]+/g,"");}
function getValue(row,keys){
  const rk=Object.keys(row||{});
  const wk=keys.map(cleanKey);
  const wkLoose=keys.map(cleanKeyLoose);

  // 1) Coincidencia exacta normalizada.
  for(const k of rk){
    if(wk.includes(cleanKey(k)))return row[k];
  }

  // 2) Coincidencia exacta ignorando saltos de línea, tildes, puntos, paréntesis, etc.
  for(const k of rk){
    if(wkLoose.includes(cleanKeyLoose(k)))return row[k];
  }

  // 3) Coincidencia parcial normalizada.
  for(const k of rk){
    const nk=cleanKey(k);
    if(wk.some(w=>nk.includes(w)||w.includes(nk)))return row[k];
  }

  // 4) Coincidencia parcial laxa, útil para encabezados largos como ROP05.
  for(const k of rk){
    const nk=cleanKeyLoose(k);
    if(wkLoose.some(w=>nk.includes(w)||w.includes(nk)))return row[k];
  }

  return"";
}
function toNumber(v){
  if(v===null||v===undefined||v==="")return 0;
  if(typeof v==="number")return Number.isFinite(v)?v:0;
  let s=String(v).trim().replace(/[^\d,.-]/g,"");
  if(!s)return 0;
  const lastComma=s.lastIndexOf(",");
  const lastDot=s.lastIndexOf(".");
  if(lastComma!==-1&&lastDot!==-1){
    if(lastComma>lastDot){
      s=s.replace(/\./g,"").replace(",",".");
    }else{
      s=s.replace(/,/g,"");
    }
  }else if(lastComma!==-1){
    const dec=s.length-lastComma-1;
    s=dec>0&&dec<=2?s.replace(/\./g,"").replace(",","."):s.replace(/,/g,"");
  }else if(lastDot!==-1){
    const dec=s.length-lastDot-1;
    s=dec>0&&dec<=2?s.replace(/,/g,""):s.replace(/\./g,"");
  }
  return parseFloat(s)||0;
}
function normalizeInflatedMoneyValue(n){
  if(!Number.isFinite(n))return 0;
  const sign=n<0?-1:1;
  let abs=Math.abs(n);

  // Rescate para valores ya inflados por parseos anteriores.
  // La causa real queda corregida en toMoneyNumber, pero esto evita que un
  // valor guardado como 57099999999999990 siga rompiendo la tabla.
  if(abs>=1000000000000){
    abs=abs/1000000000000;
    const rounded=Math.round(abs);
    if(Math.abs(abs-rounded)<0.01){
      if(rounded>50000&&rounded%100===0)abs=rounded/1000;
      else if(rounded>20000)abs=rounded/100;
    }
  }

  return sign*Math.round(abs*100)/100;
}
function toMoneyNumber(v){
  if(v===null||v===undefined||v==="")return 0;

  // La columna "Precio unitario" de la base viene como NÚMERO.
  // Si Sheets/Excel lo entrega numérico, no se toca ningún separador.
  if(typeof v==="number"){
    const n=Number.isFinite(v)?v:0;
    return Math.round(n*100)/100;
  }

  let s=String(v).trim();
  if(!s)return 0;
  s=s.replace(/\s/g,"").replace(/[^\d,.-]/g,"");
  if(!s)return 0;

  const neg=s.includes("-")?-1:1;
  s=s.replace(/-/g,"");

  const commaCount=(s.match(/,/g)||[]).length;
  const dotCount=(s.match(/\./g)||[]).length;
  const lastComma=s.lastIndexOf(",");
  const lastDot=s.lastIndexOf(".");

  if(commaCount>0&&dotCount>0){
    // Mixto: el último separador es decimal.
    // 15,296.77 -> 15296.77 | 15.296,77 -> 15296.77
    if(lastComma>lastDot)s=s.replace(/\./g,"").replace(",",".");
    else s=s.replace(/,/g,"");
  }else if(commaCount>0){
    const parts=s.split(",");
    if(commaCount===1){
      const left=parts[0], right=parts[1]||"";
      // En la base argentina la coma siempre es separador decimal,
      // incluso cuando el precio con IVA tiene 3 decimales: 979,374 = 979.374.
      // Antes se interpretaba erróneamente como 979374.
      s=left+"."+right;
    }else{
      const last=parts[parts.length-1]||"";
      if(last.length<=2)s=parts.slice(0,-1).join("")+"."+last;
      else s=parts.join("");
    }
  }else if(dotCount>0){
    const parts=s.split(".");
    if(dotCount===1){
      const left=parts[0], right=parts[1]||"";
      // Un único punto en precios unitarios se conserva como separador decimal.
      // Ejemplo real de la base: 979.374 significa 979,374 y NO 979.374 pesos.
      // Los importes con miles y decimales (134.360,40) ya se resuelven arriba
      // en la rama que contiene punto y coma simultáneamente.
      s=left+"."+right;
    }else{
      const last=parts[parts.length-1]||"";
      if(last.length<=2)s=parts.slice(0,-1).join("")+"."+last;
      else s=parts.join("");
    }
  }

  const n=Number(s);
  return Number.isFinite(n)?normalizeInflatedMoneyValue(neg*n):0;
}
function getExactValue(row,keys){
  const rk=Object.keys(row||{});
  const wk=keys.map(cleanKey);
  for(const k of rk){if(wk.includes(cleanKey(k)))return row[k];}
  return"";
}
function getInsumoExtra(row,descripcion){
  // La base de costos tiene columnas fijas:
  // A Codigo · B Descripcion · C Precio unitario · D Descripcion adicional.
  // NO buscar en otras columnas porque en la hoja existen columnas auxiliares
  // a la derecha y eso hacía que "Descripción adicional" trajera cualquier dato.
  const exact=String(getExactValue(row,[
    "Descripcion adicional","DESCRIPCION ADICIONAL","Descripción adicional","DESCRIPCIÓN ADICIONAL",
    "descripcion adicional","descripción adicional"
  ])||"").trim();
  if(exact&&cleanKey(exact)!==cleanKey(descripcion))return exact;
  return "";
}
function normDate(d){
  if(!d)return"";const t=String(d).trim();
  let iso="";
  const m1=t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(m1)iso=`${m1[3]}-${m1[2].padStart(2,"0")}-${m1[1].padStart(2,"0")}`;
  else{
    const m2=t.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(m2)iso=t.slice(0,10);
    else{
      const p=new Date(t);
      if(!Number.isNaN(p.getTime()))iso=p.toISOString().slice(0,10);
    }
  }
  if(!iso)return"";
  // Validar y corregir: año (1900-2100), mes (1-12), día (1-31).
  // Si el mes quedó fuera de rango pero el día sí es un mes válido,
  // probablemente vinieron invertidos (ej: "2026-31-05" → "2026-05-31").
  let[y,mo,da]=iso.split("-").map(Number);
  if(mo>12&&da>=1&&da<=12){const tmp=mo;mo=da;da=tmp;}
  if(y<1900||y>2100||mo<1||mo>12||da<1||da>31)return"";
  return`${y}-${String(mo).padStart(2,"0")}-${String(da).padStart(2,"0")}`;
}
function cleanMachine(v){
  return String(v||"").trim().toUpperCase().replace(/\s+/g,"-")
    .replace(/([A-Z]{2,4})-?(\d{1,3})$/,(_,a,n)=>`${a}-${String(n).padStart(4,"0")}`)
    .replace(/([A-Z]{2,4})-?(\d{4,})/,(_,a,n)=>`${a}-${n}`)
    .replace(/[-_]JM$/,"");
}
// Equivalencias internas confirmadas entre códigos históricos y vigentes.
// CFN-0101 y todas sus variantes se consolidan en el código vigente PCA-0101.
function canonicalEquivalentMachineCode(code){
  const c=cleanMachine(String(code||"").replace(/\s*\(.*?\)/g,""));
  // Equivalencias históricas confirmadas. Se usa el código vigente como
  // identidad única en todas las tablas, incluida Amortización.
  const equivalencias={
    "CFN-0101":"PCA-0101",
    "CFN-0041":"PCA-0081",
    "CFN-0043":"PCA-0093",
    "CFN-0044":"PCA-0095",
    "CFN-0045":"PCA-0095",
    "EXC-0014":"EXC-0034",
    "EXC-0019":"EXC-0048",
    "MOT-0024":"MOT-0047",
    "RTP-0010":"RTP-0016",
    "RTP-0012":"RTP-0024",
    "TOP-0014":"TOP-0032",
    "TOP-0059":"TOP-0058",
  };
  if(equivalencias[c])return equivalencias[c];
  return c;
}
function machineCodeOutsideParentheses(code){
  // Para códigos tipo "CFN-0041 (PCA-0081)", la correlación de propiedad
  // se hace por el código que está FUERA del paréntesis, igual que en Informe de Costos.
  const raw=String(code||"").replace(/\s*\(.*?\)/g,"").trim();
  return cleanMachine(raw);
}
function validPropiedadValue(v){
  const p=String(v||"").trim().toUpperCase();
  return p&&p!=="S/D"&&p!=="-"&&p!=="—"?p:"";
}


// ─── Normalización de vehículos desde Lista Maestra ───────────────────────────
function normalizeVehicleFamily(raw){
  const f=cleanKey(raw).toUpperCase();
  if(!f)return"";
  if(f.includes("CAMION CISTERNA")||f.includes("CAMIÓN CISTERNA")||f.includes("COMBUSTIBLE"))return"CAMION DE COMBUSTIBLE";
  if(f.includes("TRACTOR"))return"CAMION TRACTOR";
  if(f.includes("VOLCADOR")||f.includes("VOLQUETE"))return"CAMION VOLCADOR";
  if(f.includes("REGADOR")||f.includes("RIEGO"))return"CAMION REGADOR";
  if(f.includes("CAMIONETA")||f.includes("PICK"))return"CAMIONETA";
  if(f.includes("GENERADOR")&&f.includes("CAT"))return"GENERADOR-CAT";
  return String(raw||"").trim().toUpperCase();
}
function getListaVehicleVal(eq,label,aliases=[]){
  const keys=Object.keys(eq||{});
  const k=findColumnKey(keys,label,aliases);
  return k?eq[k]:"";
}
function getVehicleTipoFromListaRow(eq){
  const fam=getListaVehicleVal(eq,"Familia",["FAMILIA","Familia Equipo","Familia de equipo","Tipo","Tipo de equipo","Tipo Equipo","Equipo","Clase","Categoría","Categoria"]);
  return normalizeVehicleFamily(fam);
}
function getProyectoVehiculoFromListaRow(eq){
  return normProject(getListaVehicleVal(eq,"Lugar de alquiler",["Lugar Alquiler","Lugar de Alquiler","Sitio","Ubicación","Ubicacion","Lugar","Proyecto","Proyecto/Lugar","Proyecto Lugar"]));
}
function getSitioVehiculoFromListaRow(eq){
  const sitio=getListaVehicleVal(eq,"Lugar de alquiler",["Lugar Alquiler","Lugar de Alquiler","Sitio","Ubicación","Ubicacion","Lugar","Proyecto","Proyecto/Lugar","Proyecto Lugar"]);
  return String(sitio||"").trim();
}
function getPropiedadVehiculoFromListaRow(eq){
  const keys=Object.keys(eq||{});
  let prop=getListaVehicleVal(eq,"Propiedad",["PROPIEDAD","Propiedad Equipo","Propiedad del equipo","Propiedad de equipo","Condición","Condicion","Dueño","Dueno","Empresa","Proveedor","Propietario","Titular","Empresa Propietaria","Empresa propietaria","Owner","Rental","Arrendadora"]);
  // Respaldo robusto: en algunas listas el encabezado viene con espacios, acentos o texto extra.
  if(!String(prop||"").trim()){
    const k=keys.find(x=>{
      const c=cleanKey(x);
      return c.includes("propied")||c.includes("dueno")||c.includes("duenio")||c.includes("propietario")||c.includes("arrendadora");
    });
    if(k)prop=eq[k];
  }
  const out=String(prop||"S/D").trim().toUpperCase();
  return out&&out!=="-"&&out!=="—"?out:"S/D";
}
function getCodigoNuevoFromListaRow(eq){
  // Sólo Código Nuevo real. No se usa Código Interno/Drusila acá para no pisar vehículos sin código nuevo.
  const cod=getListaVehicleVal(eq,"Código Nuevo",["Codigo Nuevo","Código nuevo","Codigo nuevo","CODIGO NUEVO","Cdogio nuevo","Cdogio Nuevo","Codigo Nvo","Código Nvo","Cod Nuevo","Cod. Nuevo","Código Actual","Codigo Actual"]);
  const c=cleanMachine(cod);
  return c==="-"?"":c;
}
function getCodigoViejoFromListaRow(eq){
  // Si no hay Código Nuevo, el vehículo queda identificado por Código Drusila.
  const cod=getListaVehicleVal(eq,"Código Drusila",["Codigo Drusila","Código drusila","Codigo drusila","Codigo Drusilla","Código Drusilla","DRUSILA","Drusila","Cod Drusila","Cod. Drusila","Código de Drusila","Codigo de Drusila","Código Viejo","Codigo Viejo","Código viejo","Codigo viejo","Código Interno","Codigo Interno","CODIGO N° INTERNO","Interno","Código Anterior","Codigo Anterior","Patente","Dominio"]);
  const c=cleanMachine(cod);
  return c==="-"?"":c;
}
function buildVehicleListaIndex(listaEquipos){
  const byAny={};
  const vehicles=[];
  (listaEquipos||[]).forEach((eq,idx)=>{
    const codigoNuevo=getCodigoNuevoFromListaRow(eq);
    const codigoViejo=getCodigoViejoFromListaRow(eq);
    const familia=getVehicleTipoFromListaRow(eq);
    const proyecto=getProyectoVehiculoFromListaRow(eq);
    const sitioAlquiler=getSitioVehiculoFromListaRow(eq);
    const propiedad=getPropiedadVehiculoFromListaRow(eq);
    if(!codigoNuevo&&!codigoViejo)return;
    const codigo=codigoNuevo||codigoViejo;
    const codes=uniq([codigoNuevo,codigoViejo,codigo,...getListaEquipoAllCodes(eq)].map(cleanMachine).filter(Boolean));
    const item={...eq,_idx:idx,codigo,codigoNuevo,codigoViejo,codigoDrusila:codigoViejo,codes,familia,proyecto,sitioAlquiler,ubicacion:proyecto||sitioAlquiler||"S/D",propiedad};
    if(familia.includes("CAMION")||familia.includes("CAMIONETA")||/^CTA/.test(codigo)||/^CAT/.test(codigo)||/^CAV/.test(codigo)||/^CAR/.test(codigo)||/^(AG|AI|AH)[0-9A-Z]/.test(codigoViejo||codigo)){
      vehicles.push(item);
      [codigoNuevo,codigoViejo,codigo].filter(Boolean).forEach(c=>{
        const k=cleanMachine(c);
        byAny[k]=item;
        byAny[k.replace(/[^A-Z0-9]/g,"")]=item;
      });
    }
  });
  const unique=[]; const seen=new Set();
  vehicles.forEach(v=>{
    const k=(v.codigoNuevo||v.codigo||v.codigoViejo||"").replace(/[^A-Z0-9]/g,"");
    if(!k||seen.has(k))return;
    seen.add(k); unique.push(v);
  });
  return{byAny,vehicles:unique};
}
function getListaVehicleMatch(index,code){
  const k=cleanMachine(code);
  return index?.byAny?.[k]||index?.byAny?.[k.replace(/[^A-Z0-9]/g,"")]||null;
}

function getListaEquipoAllCodes(eq){
  const vals=[
    getListaVehicleVal(eq,"Código Nuevo",["Codigo Nuevo","Código nuevo","Codigo nuevo","CODIGO NUEVO","Cdogio nuevo","Cdogio Nuevo","Codigo Nvo","Código Nvo","Cod Nuevo","Cod. Nuevo","Código Actual","Codigo Actual"]),
    getListaVehicleVal(eq,"Código Drusila",["Codigo Drusila","Código drusila","Codigo drusila","Codigo Drusilla","Código Drusilla","DRUSILA","Drusila","Cod Drusila","Cod. Drusila","Código de Drusila","Codigo de Drusila"]),
    getListaVehicleVal(eq,"Código Viejo",["Codigo Viejo","Código viejo","Codigo viejo","Código Anterior","Codigo Anterior","Cod Viejo","Cod. Viejo","Cod viejo","Cod. viejo","Código Antiguo","Codigo Antiguo","Código Alternativo","Codigo Alternativo"]),
    getListaVehicleVal(eq,"Código Interno",["Codigo Interno","CODIGO N° INTERNO","Interno","Interno Equipo","Equipo","Código Equipo","Codigo Equipo","Cod Equipo"]),
    getListaVehicleVal(eq,"Patente",["Dominio","PATENTE","DOMINIO"]),
  ];
  return uniq(vals.map(cleanMachine).filter(c=>c&&c!=="-"&&c!=="—"));
}
function addListaEquipoIndexKey(map,key,item){
  const k=cleanMachine(key);
  if(!k)return;
  [k,k.replace(/[^A-Z0-9]/g,""),canonicalEquivalentMachineCode(k)].filter(Boolean).forEach(x=>{
    if(!map[x])map[x]=[];
    map[x].push(item);
  });
}
function buildListaEquipoInfoIndex(listaEquipos){
  const byAny={};
  const all=[];
  (listaEquipos||[]).forEach((eq,idx)=>{
    const codigoNuevo=getCodigoNuevoFromListaRow(eq);
    const codigoDrusila=getCodigoViejoFromListaRow(eq);
    const codes=getListaEquipoAllCodes(eq);
    if(codigoNuevo&&!codes.includes(codigoNuevo))codes.unshift(codigoNuevo);
    if(codigoDrusila&&!codes.includes(codigoDrusila))codes.push(codigoDrusila);
    if(!codes.length)return;
    const familia=getVehicleTipoFromListaRow(eq);
    const proyecto=getProyectoVehiculoFromListaRow(eq);
    const sitioAlquiler=getSitioVehiculoFromListaRow(eq);
    const propiedad=getPropiedadVehiculoFromListaRow(eq);
    const item={...eq,_idx:idx,codigo:codigoNuevo||codigoDrusila||codes[0],codigoNuevo,codigoViejo:codigoDrusila,codigoDrusila,codes,familia,proyecto,sitioAlquiler,ubicacion:proyecto||sitioAlquiler||"S/D",propiedad};
    all.push(item);
    codes.forEach(c=>addListaEquipoIndexKey(byAny,c,item));
    if(codigoNuevo)addListaEquipoIndexKey(byAny,codigoNuevo,item);
    if(codigoDrusila)addListaEquipoIndexKey(byAny,codigoDrusila,item);
  });
  return{byAny,all};
}
function getListaEquipoInfoMatch(index,code){
  const keys=machineLookupVariants(code);
  for(const key of keys){
    const arr=index?.byAny?.[key];
    if(arr&&arr.length){
      const real=arr.find(x=>x.propiedad&&x.propiedad!=="S/D"&&x.propiedad!=="-"&&x.propiedad!=="—");
      return real||arr[0];
    }
  }
  return null;
}
const COL_STOPWORDS=new Set(["de","del","la","el","los","las","en","y","al","con","sin","un","una"]);
function tokenizeLabel(label){
  return cleanKey(label).split(/[^a-z0-9]+/).filter(t=>t.length>1&&!COL_STOPWORDS.has(t));
}
function findColumnKey(allKeys,label,extraAliases=[]){
  const variants=[label,...extraAliases];
  for(const v of variants){
    const target=cleanKey(v);
    const exact=allKeys.find(k=>cleanKey(k)===target);
    if(exact)return exact;
  }
  for(const v of variants){
    const target=cleanKey(v);
    const found=allKeys.find(k=>{const ck=cleanKey(k);return ck.includes(target)||target.includes(ck);});
    if(found)return found;
  }
  let best=null,bestScore=0;
  for(const v of variants){
    const tokens=tokenizeLabel(v);
    if(!tokens.length)continue;
    allKeys.forEach(k=>{
      const ck=cleanKey(k);
      const score=tokens.filter(t=>ck.includes(t)).length;
      const need=Math.max(1,Math.ceil(tokens.length*0.6));
      if(score>=need&&score>bestScore){bestScore=score;best=k;}
    });
  }
  return best;
}
// Código "principal" de una máquina ROP02 cuando viene con un alterno entre
// paréntesis, ej. "MOT-0024-(MOT-0047)" → "MOT-0024" (la parte fuera del
// paréntesis, que es la que se cruza contra "Código Drusila").
function mainMachineCode(maquina){
  const s=String(maquina||"");
  const i=s.indexOf("(");
  if(i===-1)return s;
  return s.slice(0,i).replace(/[-\s]+$/,"");
}


// Valores que aparecen en planillas pero NO son equipos. Se excluyen de
// "Equipos sin información" para que la correlación tome solamente códigos reales.
const EQUIPO_SIN_INFO_EXCLUDED_CODES = new Set([
  "PREDIODELTA",
  "REORGANIZACION",
  "REPARACION",
  "MANTENIMIENTO",
  "BANDEJAMARTILLO",
  "1088",
  "TALLER",
  "",
]);
function isValidEquipoCodigoParaCorrelacion(rawValue){
  const raw=String(rawValue||"").trim().toUpperCase();
  if(!raw)return false;
  const compact=raw.replace(/[^A-Z0-9]/g,"");
  if(EQUIPO_SIN_INFO_EXCLUDED_CODES.has(compact))return false;
  // Si viene con paréntesis, se acepta sólo si alguna de las partes contiene
  // un código real tipo CFN-0043, PCA-0093, CAV-0078, etc.
  const candidates=[raw,mainMachineCode(raw),...([...raw.matchAll(/\(([^)]+)\)/g)].map(m=>m[1]))];
  return candidates.some(v=>{
    const c=cleanMachine(v);
    const cc=String(c||"").replace(/[^A-Z0-9]/g,"");
    if(EQUIPO_SIN_INFO_EXCLUDED_CODES.has(cc))return false;
    return /^[A-Z]{2,4}-?\d{3,5}$/.test(c)||/^[A-Z]{2,4}\d{3,5}$/.test(cc);
  });
}

// Claves equivalentes para cruzar Lista Maestra ↔ ROP02.
// Sirve para máquinas, camiones y camionetas: prueba Código Drusila,
// Código Nuevo y cualquier variante con/sin paréntesis, guiones o espacios.
function machineLookupVariants(...values){
  const out=[];
  const addKey=(k)=>{
    const kk=String(k||"").trim().toUpperCase();
    if(kk&&!out.includes(kk))out.push(kk);
  };
  const addCandidate=(x)=>{
    const raw=String(x||"").trim();
    if(!raw)return;
    const a=cleanMachine(raw);
    const b=normalizeMachineCode(raw);
    const ca=canonicalEquivalentMachineCode(a);
    const cb=canonicalEquivalentMachineCode(b);
    [a,b,ca,cb,
      String(a).replace(/[-_\s]/g,""),
      String(b).replace(/[-_\s]/g,""),
      String(ca).replace(/[-_\s]/g,""),
      String(cb).replace(/[-_\s]/g,"")
    ].forEach(addKey);
  };
  const add=(v)=>{
    const raw=String(v||"").trim();
    if(!raw)return;

    // Equipos cargados como "CFN-0043-(PCA-0093)":
    // - afuera del paréntesis = Código Drusila / viejo
    // - dentro del paréntesis = Código Nuevo
    // La Lista Maestra puede tener cualquiera de los dos, por eso se indexan
    // y se comparan ambas partes por separado.
    addCandidate(raw);
    addCandidate(mainMachineCode(raw));

    const parens=[...raw.matchAll(/\(([^)]+)\)/g)].map(m=>m[1]).filter(Boolean);
    parens.forEach(x=>{
      addCandidate(x);
      String(x).split(/[\/;,|]+/).forEach(addCandidate);
    });

    // Variante con paréntesis reemplazado por espacio, como respaldo para
    // nombres que traen ambos códigos sin separadores claros.
    addCandidate(raw.replace(/\((.*?)\)/g," $1 "));
  };
  values.forEach(add);
  return out;
}
function turnoOrder(turno){
  return String(turno||"").toUpperCase().includes("NOCHE")?1:0;
}
function buildHorometroMapForLista(rop02All, fechaFiltro){
  const allGroups={};
  const dayGroups={};
  const previousGroups={};

  (rop02All||[]).forEach(r=>{
    if(!r.maquina||!(Number(r.horometroFinal)>0))return;
    const keys=machineLookupVariants(r.maquina);
    if(!keys.length)return;
    keys.forEach(code=>{
      (allGroups[code]=allGroups[code]||[]).push(r);
      if(fechaFiltro){
        if(r.fecha===fechaFiltro)(dayGroups[code]=dayGroups[code]||[]).push(r);
        if(r.fecha&&r.fecha<=fechaFiltro)(previousGroups[code]=previousGroups[code]||[]).push(r);
      }
    });
  });

  const pickLast=(list)=>{
    const ordenadas=[...(list||[])].sort((a,b)=>
      String(a.fecha||"").localeCompare(String(b.fecha||""))||
      (turnoOrder(a.turno)-turnoOrder(b.turno))
    );
    return ordenadas[ordenadas.length-1]||null;
  };

  const map={};
  Object.keys(allGroups).forEach(code=>{
    const exacta=fechaFiltro?pickLast(dayGroups[code]):null;
    const anterior=fechaFiltro&&!exacta?pickLast(previousGroups[code]):null;
    const historica=!exacta&&!anterior?pickLast(allGroups[code]):null;
    const ultima=exacta||anterior||historica;
    if(!ultima)return;
    map[code]={
      horometroFinal:Number(ultima.horometroFinal)||0,
      fecha:ultima.fecha||"",
      turno:ultima.turno||"",
      modo:fechaFiltro?(exacta?"dia":(anterior?"fallback_ultimo":"fallback_historico")):"ultimo"
    };
  });
  return map;
}
function detectEstado(trabajo,obs,hs){
  // La fuente de verdad es la columna Cant. Hs.:
  // "FS" o "FUERA DE SERVICIO" → FS
  // "OD" u "ORDEN DEL DIA" → OD (Operativo a Disposición)
  // "EM" → Equipo en mantenimiento
  // cualquier número (o vacío) → TRABAJO efectivo
  const hsStr=String(hs||"").trim().toUpperCase();
  if(/\bFS\b/.test(hsStr)||hsStr.includes("FUERA DE SERVICIO"))return"FS";
  if(/\bOD\b/.test(hsStr)||hsStr.includes("ORDEN DEL DIA")||hsStr.includes("ORDEN DEL DÍA"))return"OD";
  if(/\bEM\b/.test(hsStr)||hsStr.includes("EQUIPO EN MANTENIMIENTO")||hsStr.includes("EN MANTENIMIENTO"))return"EM";
  return"TRABAJO";
}
// Normaliza nombres de proyecto: VICUÑA y sus variantes → FILO DEL SOL
// ─── Normalización de nombres de personas ────────────────────────────────────
const _canonicalMap={};
const _tareaMap={};

// Mapeo de emails de supervisores a nombres canónicos
const SUPERVISOR_EMAIL_MAP={
  "carlos.sisterna@deltaming.com.ar":"Sisterna Carlos",
  "alfredo.vedia@deltamining.com.ar":"Vedia Alfredo",
  "marcoaguilera@deltaming.com.ar":"Aguilera Marco",
  "gilberto.eseiza@deltamining.com.ar":"Eseiza Gilberto",
  "marcelo.vedia@deltamining.com.ar":"Vedia Marcelo",
  "adrian.ovalles@deltamining.com":"Ovalles Adrian",
  "ssma.fds@deltamining.com":"Unamuno Federico",
};

// Normalización base: quita tildes, puntos, espacios extra
function normalizeName(s){
  // eslint-disable-next-line no-control-regex
  return String(s||"")
    .normalize("NFD").replace(/[̀-ͯ]/g,"")
    .replace(/[.]/g,"").replace(/[ ]+/g," ").trim().toLowerCase();
}

// Distancia de Levenshtein entre dos strings
function levenshtein(a,b){
  const m=a.length,n=b.length;
  const dp=Array.from({length:m+1},(_,i)=>Array.from({length:n+1},(_,j)=>i===0?j:j===0?i:0));
  for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)
    dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
  return dp[m][n];
}

// Construye mapa canónico agrupando por:
// 1. Normalización exacta (tildes, puntos, espacios)
// 2. Distancia de edición <= 2 entre nombres normalizados
function buildTareaMap(tareas){
  const freq={};
  tareas.forEach(t=>{if(t){const k=normalizeName(t);freq[k]=(freq[k]||0)+1;}});
  const groups=[];
  const assigned={};
  tareas.filter(Boolean).forEach(t=>{
    const norm=normalizeName(t);
    if(assigned[norm])return;
    let found=false;
    for(const g of groups){
      const gNorm=normalizeName(g[0]);
      if(levenshtein(norm,gNorm)<=2){g.push(t);assigned[norm]=true;found=true;break;}
    }
    if(!found){groups.push([t]);assigned[norm]=true;}
  });
  groups.forEach(variants=>{
    const canonical=variants.reduce((best,cur)=>{
      const bf=freq[normalizeName(best)]||0;
      const cf=freq[normalizeName(cur)]||0;
      if(cf>bf)return cur;
      if(cf===bf&&cur.length>best.length)return cur;
      return best;
    });
    variants.forEach(v=>{_tareaMap[normalizeName(v)]=canonical;});
  });
}

function normTarea(raw){
  const s=String(raw||"").trim();
  if(!s)return s;
  const alias=dmNormalizeTarea(s);
  const norm=normalizeName(alias||s);
  if(_tareaMap[norm])return dmDisplayTarea(_tareaMap[norm]);
  return dmDisplayTarea((alias||s).replace(/[.]/g,"").replace(/[ ]+/g," ").trim());
}

function buildCanonicalMap(names){
  const freq={};
  names.forEach(n=>{if(n){const k=normalizeName(n);freq[k]=(freq[k]||0)+1;}});

  // Grupos: cada elemento es un array de variantes del mismo nombre
  const groups=[];
  const assigned={};

  names.filter(Boolean).forEach(n=>{
    const norm=normalizeName(n);
    if(assigned[norm])return;
    // Buscar grupo existente donde encaje (distancia <= 2)
    let found=false;
    for(const g of groups){
      const gNorm=normalizeName(g[0]);
      // Misma cantidad de palabras (para no unir "Lopez" con "Lopez Carlos")
      if(norm.split(" ").length!==gNorm.split(" ").length)continue;
      if(levenshtein(norm,gNorm)<=2){g.push(n);assigned[norm]=true;found=true;break;}
    }
    if(!found){groups.push([n]);assigned[norm]=true;}
  });

  // Para cada grupo elegir el canónico = el más frecuente (desempate: más largo)
  groups.forEach(variants=>{
    const canonical=variants.reduce((best,cur)=>{
      const bf=freq[normalizeName(best)]||0;
      const cf=freq[normalizeName(cur)]||0;
      if(cf>bf)return cur;
      if(cf===bf&&cur.length>best.length)return cur;
      return best;
    });
    variants.forEach(v=>{_canonicalMap[normalizeName(v)]=canonical;});
  });
}

function normName(raw){
  const s=String(raw||"").trim();
  if(!s)return s;
  // Si es un email conocido de supervisor, mapear a nombre
  const emailKey=s.toLowerCase();
  if(SUPERVISOR_EMAIL_MAP[emailKey])return SUPERVISOR_EMAIL_MAP[emailKey];
  const norm=normalizeName(s);
  if(_canonicalMap[norm])return _canonicalMap[norm];
  // Fallback: limpiar puntos y espacios
  return s.replace(/[.]/g,"").replace(/[ ]+/g," ").trim();
}

function normProject(raw){
  return dmNormalizeProject(raw);
}
// Color distintivo por proyecto, usado en badges, bordes y gráficos
function proyColor(p){
  const s=String(p||"").toUpperCase();
  if(s==="FILO DEL SOL")return C.accent;
  if(s==="FILO SUR")return C.yellow;
  if(s==="EL ZORRO")return C.teal;
  if(s==="JOSE MARIA")return C.teal;
  return C.purple;
}
function byDateFilter(rows,mode,fecha,fechaD,fechaH){
  // Sin filtro de fecha activo: devolver todo sin iterar.
  // En modo acumulado el rango NO depende de Mes/Desde/Hasta,
  // sino de Verano/Invierno + Año; ese filtro se aplica en cada vista.
  // Si no se corta acá, al entrar a Acumulado quedaba limitado por el mes
  // que venía seleccionado y no traía registros del período real.
  if(mode==="acumulado")return rows;
  if(mode==="dia"&&!fecha)return rows;
  if(mode==="periodo"&&!fechaD&&!fechaH)return rows;
  return rows.filter(r=>{
    const f=r.fecha||"";
    if(mode==="dia")return f===fecha;
    if(fechaD&&f<fechaD)return false;
    if(fechaH&&f>fechaH)return false;
    return true;
  });
}

// ─── Normalización ────────────────────────────────────────────────────────────
function normalizeROP02(rows,proyectoDefault){
  return(rows||[]).map(r=>{
    // ROP02 estructura actual:
    // A Fecha · B Interno · C Equipo · D Operador · E Supervisor Delta · F Supervisor Vial Cliente
    // G Turno · H N° Parte · I Proyecto · J HI · K HF · L Cant. Hs. · M Combustible
    // N Aceite · O Trabajo · P Desgaste · Q Observaciones.
    // Se usa getValue para tolerar tildes, espacios finales y respuestas ya normalizadas por Apps Script.
    const fechaRaw=getValue(r,["Fecha","Fecha:","col_0"]);
    const internoRaw=String(getValue(r,["Interno","Código Interno","Codigo Interno","CODIGO N° INTERNO","col_1"])).trim();
    const equipoRaw=String(getValue(r,["Equipo","EQUIPO","Tipo Equipo","Tipo de equipo","col_2"])).trim();
    const operadorRaw=getValue(r,["Operador","col_3"]);
    const supervisorRaw=getValue(r,["Supervisor Delta","Supervisor","col_4"]);
    const supervisorClienteRaw=getValue(r,["Supervisor Vial Cliente","Supervisor Cliente","col_5"]);
    const turnoRaw=getValue(r,["Turno de trabajo","Turno","col_6"]);
    const parteRaw=getValue(r,["N° Parte","Nº Parte","N Parte","Parte","col_7"]);
    const proyectoRaw=getValue(r,["Proyecto","Proyecto ","proyecto","col_8"]);
    const hiRaw=getValue(r,["Horómetro inicial","Horometro inicial","HI","col_9"]);
    const hfRaw=getValue(r,["Horómetro final","Horometro final","HF","col_10"]);
    const cantHs=getValue(r,["Cant. Hs.","Cant.Hs/ KM","Cant.Hs","Cant Hs","Cantidad de horas","col_11"]);
    const combustibleRaw=getValue(r,["Combustible","col_12"]);
    const aceiteRaw=getValue(r,["Aceite","col_13"]);
    const trabajo=String(getValue(r,["Descripción de los trabajos realizados","Descripcion de los trabajos realizados","Trabajos realizados","Descripción","Descripcion","col_14"])).trim();
    const desgasteRaw=getValue(r,["Información sobre Desgaste","Informacion sobre Desgaste","Desgaste","col_15"]);
    const obs=String(getValue(r,["Observaciones","OBSERVACIONES","col_16"])).trim();

    const maquina=cleanMachine(internoRaw);
    const tipoEquipoROP02=dmNormalizeTipoEquipo(equipoRaw||getMachineType(maquina)||"");

    return{
      fecha:normDate(fechaRaw),maquina,equipo:equipoRaw,
      _internoRaw:internoRaw,_equipoRaw:equipoRaw,
      operario:normName(operadorRaw),supervisor:normName(supervisorRaw),
      supervisorCliente:String(supervisorClienteRaw||"").trim(),
      turno:String(turnoRaw||"").trim(),parte:String(parteRaw||"").trim(),
      proyecto:normProject(proyectoRaw||proyectoDefault),
      horometroInicial:toNumber(hiRaw),horometroFinal:toNumber(hfRaw),
      horasRaw:String(cantHs||"").trim(),horas:toNumber(cantHs),combustible:toNumber(combustibleRaw),
      aceite:String(aceiteRaw||"").trim(),tipo_trabajo:trabajo,
      desgaste:String(desgasteRaw||"").trim(),observaciones:obs,
      estado:detectEstado(trabajo,obs,cantHs),
      _excluded:isExcluded(maquina),_tipo:tipoEquipoROP02,
    };
  }).filter(r=>r.fecha&&r.maquina);
}

function normSupervisorROP05(raw){
  const s=String(raw||"").trim().toLowerCase();
  if(!s)return"";
  // Mapeo de mails conocidos a nombres canónicos
  if(s.startsWith("carlos.sisterna")||s.startsWith("carlossisterna"))return"Sisterna Carlos";
  if(s.startsWith("marcelovedia")||s.startsWith("marcelo.vedia"))return"Vedia Marcelo";
  if(s.startsWith("alfredo.vedia")||s.startsWith("alfredovedia"))return"Vedia Alfredo";
  if(s.startsWith("marcoaguilera")||s.startsWith("marco.aguilera"))return"Aguilera Marco";
  if(s.startsWith("gilberto.eseiza")||s.startsWith("gilbertoeseiza"))return"Eseiza Gilberto";
  if(s.startsWith("adrian.ovalles")||s.startsWith("adrianovalles"))return"Ovalles Adrian";
  if(s.startsWith("ssma.fds")||s.startsWith("ssmafds"))return"Unamuno Federico";
  // Si no es mail, normalizar como nombre normal
  return normName(raw);
}

function fmtARS(v){return v>0?"$"+fmtNum(v):"—";}
function fmtUSD(v,rate){if(!v||v<=0||!rate)return"—";const usd=Math.round(v/rate);return"U$S "+fmtNum(usd);}

function normalizeInsumoCode(value){
  return String(value??"")
    .trim()
    .toUpperCase()
    .replace(/\s+/g,"")
    .replace(/[–—]/g,"-");
}

function normalizeRMA15(r, insumosMap){
  const fecha=normDate(r["Fecha de OT"]||"");
  const maquina=cleanMachine(r["CODIGO N° INTERNO"]||"");
  const proyecto=r["_proyectoForzado"]||"S/D"; // Proyecto siempre viene forzado desde la fuente
  // Insumos: cruzar codigo con base de datos
  const insumos=[];
  for(let i=1;i<=10;i++){
    const cant=parseFloat(String(r["cantidad "+i]||"0").replace(/[^0-9.]/g,""))||0;
    const cod=normalizeInsumoCode(r["codigo "+i]||"");
    const nombre=String(r["nombre "+i]||"").trim();
    if(cod||cant>0){
      const infoInsumo=insumosMap[cod]||{};
      insumos.push({
        cantidad:cant,
        codigo:cod,
        nombre:nombre||infoInsumo.descripcion||cod,
        costoUnitario:infoInsumo.costoUnitario||0,
        costoTotal:(infoInsumo.costoUnitario||0)*cant,
      });
    }
  }
  const costoTotal=insumos.reduce((s,i)=>s+i.costoTotal,0);
  return{
    fecha,
    maquina,
    proyecto,
    tipoEquipo:dmNormalizeTipoEquipo(r["EQUIPO"]||""),
    turno:String(r["TURNO EN QUE SE HIZO LA OT"]||"").trim(),
    tipoMant:String(r["TIPO DE MANTENIMIENTO"]||"").trim(),
    kmHs:parseFloat(String(r["Km / hs"]||"0").replace(/[^0-9.]/g,""))||0,
    intervencion:String(r["INTERVENCIÓN O REPARACIÓN REALIZADA (Si es PM, especificar cual) LOS SOPLETEOS DE FILTROS VAN EN ESTA SECCION O CUALQUIER SERVICIO QUE SE REALICE)"]||"").trim(),
    operativo:String(r["¿EQUIPO QUEDO OPERATIVO?"]||"").trim().toUpperCase()==="SI",
    observaciones:String(r["OBSERVACIONES"]||"").trim(),
    insumos,
    costoTotal,
  };
}

function normalizeROP05(rows){
  return(rows||[]).map(r=>{
    // Estructura real de ROP05 nuevo:
    // A Fecha del Parte Diario · B Supervisor · C Proyecto · D Codigo Int · E N° de Parte
    // F Tipo Equipo · G Tarea · H CANTIDAD DE HS PRODUCTIVAS EFECTIVAS (SOLO CANTIDAD)
    // I Largo · J Ancho · K Profundidad · L CANTIDAD DE PRODUCCIÓN DE LA TAREA REALIZADA
    // M UNIDAD DE PRODUCTIVIDAD · N Observación · O Mes.
    const pickExact=(keys)=>{
      for(const k of keys){
        if(Object.prototype.hasOwnProperty.call(r,k))return r[k];
      }
      return"";
    };

    const fechaParte=pickExact(["Fecha del Parte Diario","FechaParte","Fecha Parte","Fecha","col_0"])||getValue(r,["Fecha del Parte Diario","FechaParte","Fecha Parte","Fecha","col_0"]);
    const codigoInt=pickExact(["Codigo Int","Código Int","Código Interno del Equipo","Codigo Interno","Interno","col_3"])||getValue(r,["Codigo Int","Código Int","Código Interno del Equipo","Codigo Interno","Interno","Equipo","col_3"]);
    const maquina=cleanMachine(codigoInt);

    // IMPORTANTE:
    // En Google Sheets la columna H es la columna 8 visualmente, pero en JS es índice 7 / col_7.
    // Se prioriza col_7 y encabezados reales. Si el Apps Script viejo todavía mandó Hs=0 y Largo=8,
    // se usa Largo como respaldo para no mostrar horas en 0.
    const hsDirect=pickExact([
      "col_7",
      "CANTIDAD DE HS PRODUCTIVAS EFECTIVAS\n(SOLO CANTIDAD)",
      "CANTIDAD DE HS PRODUCTIVAS EFECTIVAS (SOLO CANTIDAD)",
      "CANTIDAD DE HS PRODUCTIVAS EFECTIVAS",
      "HS PRODUCTIVAS EFECTIVAS",
      "HorasProductivas",
      "Hs",
      "Horas"
    ])||getValue(r,[
      "col_7",
      "CANTIDAD DE HS PRODUCTIVAS EFECTIVAS\n(SOLO CANTIDAD)",
      "CANTIDAD DE HS PRODUCTIVAS EFECTIVAS (SOLO CANTIDAD)",
      "CANTIDAD DE HS PRODUCTIVAS EFECTIVAS",
      "HS PRODUCTIVAS EFECTIVAS",
      "HorasProductivas",
      "Hs",
      "Horas"
    ]);

    const largoDirect=pickExact(["col_8","LARGO","Largo"]);
    const anchoDirect=pickExact(["col_9","ANCHO","Ancho"]);
    const profundidadDirect=pickExact(["col_10","PROFUNDIDAD","Profundidad"]);

    const hsNum=toNumber(hsDirect);
    const largoNum=toNumber(largoDirect);
    const usarLargoComoHoras=(hsNum===0&&largoNum>0);
    const cantHs=usarLargoComoHoras?largoDirect:hsDirect;

    const cantProd=pickExact([
      "col_11",
      "CANTIDAD DE PRODUCCIÓN DE LA TAREA REALIZADA\n(SIN UNIDADES DE MEDIDA)",
      "CANTIDAD DE PRODUCCION DE LA TAREA REALIZADA (SIN UNIDADES DE MEDIDA)",
      "CANTIDAD DE PRODUCCIÓN DE LA TAREA REALIZADA",
      "CANTIDAD DE PRODUCCION DE LA TAREA REALIZADA",
      "CANTIDAD DE PRODUCCIÓN",
      "CANTIDAD DE PRODUCCION",
      "CantidadProduccion",
      "Cantidad"
    ])||getValue(r,[
      "col_11",
      "CANTIDAD DE PRODUCCIÓN DE LA TAREA REALIZADA\n(SIN UNIDADES DE MEDIDA)",
      "CANTIDAD DE PRODUCCION DE LA TAREA REALIZADA (SIN UNIDADES DE MEDIDA)",
      "CANTIDAD DE PRODUCCIÓN DE LA TAREA REALIZADA",
      "CANTIDAD DE PRODUCCION DE LA TAREA REALIZADA",
      "CANTIDAD DE PRODUCCIÓN",
      "CANTIDAD DE PRODUCCION",
      "CantidadProduccion",
      "Cantidad"
    ]);

    const unidadRaw=pickExact([
      "col_12",
      "UNIDAD DE PRODUCTIVIDAD",
      "Unidad de productividad",
      "Unidad"
    ])||getValue(r,[
      "col_12",
      "UNIDAD DE PRODUCTIVIDAD",
      "Unidad de productividad",
      "Unidad"
    ]);

    const tareaRaw=String(pickExact(["Tarea","col_6"])||getValue(r,[
      "Tarea",
      "TAREAS PRODUCTIVAS CON TOPADORAS",
      "TAREAS PRODUCTIVAS CON EXCAVADORAS",
      "TAREAS PRODUCTIVAS CON CARGADORA FRONTAL",
      "TAREAS PRODUCTIVAS CON MOTONIVELADORA",
      "TAREAS PRODUCTIVAS CON RETROPALA",
      "col_6"
    ])||"").trim();

    const tarea=normTarea(tareaRaw);

    return{
      fecha:normDate(fechaParte),
      fechaCarga:normDate(getValue(r,["FechaCarga","Marca Tmeporal","Marca Temporal"])),
      maquina,
      tipo_maquina:dmNormalizeTipoEquipo(pickExact(["Tipo Equipo","TipoEquipo","Tipo de máquina","Tipo de maquina","col_5"])||getValue(r,["Tipo Equipo","TipoEquipo","Tipo de máquina","Tipo de maquina","Equipo","col_5"])||""),
      tarea,
      horas:toNumber(cantHs),
      cantidad:toNumber(cantProd),
      unidad:dmNormalizeUnidad(unidadRaw),
      proyecto:normProject(pickExact(["Proyecto","col_2"])||getValue(r,["Proyecto","col_2"])),
      supervisor:normSupervisorROP05(pickExact(["Supervisor","CorreoSupervisor","col_1"])||getValue(r,["Supervisor","CorreoSupervisor","col_1"])),
      parte:String(pickExact(["N° de Parte","Nº de Parte","NroParte","Nro Parte","N de Parte","Parte","col_4"])||getValue(r,["N° de Parte","Nº de Parte","NroParte","Nro Parte","N de Parte","Parte","col_4"])||"").trim(),
      grupo:String(getValue(r,["GrupoTrabajo","Grupo de trabajo"])||"").trim(),
      largo:usarLargoComoHoras?0:toNumber(largoDirect||getValue(r,["LARGO","Largo","col_8"])),
      ancho:toNumber(anchoDirect||getValue(r,["ANCHO","Ancho","col_9"])),
      profundidad:toNumber(profundidadDirect||getValue(r,["PROFUNDIDAD","Profundidad","col_10"])),
      mes:String(pickExact(["Mes","col_14"])||getValue(r,["Mes","col_14"])||"").trim(),
      observaciones:String(pickExact(["col_13","Observación","Observacion","Observaciones","OBSERVACION","OBSERVACIONES"])||getValue(r,[
        "OBSERVACION DE LA TAREA SEGUN LA SELECCIONADA\n-Tipo de suelo (duro,blando)\n-Dimensiones\n-Nombre de lugar de trabajo\n-Etc.",
        "OBSERVACION DE LA TAREA SEGUN LA SELECCIONADA",
        "OBSERVACION DE LA TAREA",
        "OBSERVACIONES DE LA TAREA",
        "Observacion",
        "Observación",
        "OBSERVACION",
        "OBSERVACIONES",
        "Observaciones",
        "Obs",
        "OBS",
        "col_13"
      ])||"").trim(),
      _excluded:isExcluded(maquina),
      _tipo:getMachineType(maquina)||"",
    };
  }).filter(r=>r.fecha&&r.maquina);
}

function esNoProductivo(e){const s=String(e||"").toUpperCase();return s==="FS"||s==="OD"||s==="EM"||s.includes("FUERA")||s.includes("OTRO")||s.includes("MANTENIMIENTO");}
function calcControl(rop02All,rop05){
  const productivos=(rop02All||[]).filter(r=>r.proyecto!=="EL ZORRO"&&!esNoProductivo(r.estado)&&!r._excluded);
  const prod05=(rop05||[]).filter(r=>!r._excluded);
  const key=r=>`${r.fecha}__${r.maquina}`;
  const set05=new Set(prod05.map(key));const set02=new Set(productivos.map(key));
  const faltanEn05=productivos.filter(r=>!set05.has(key(r)));
  const faltanEn02=prod05.filter(r=>!set02.has(key(r)));
  const total=productivos.length+prod05.length;
  const problemas=faltanEn05.length+faltanEn02.length;
  const FECHA_CORTE_CONTROL_ROP="2026-06-01"; // después del 31/05
  const problemasPost31=faltanEn05.filter(r=>r.fecha>=FECHA_CORTE_CONTROL_ROP).length+faltanEn02.filter(r=>r.fecha>=FECHA_CORTE_CONTROL_ROP).length;
  const consistencia=total>0?Math.round(((total-problemas)/total)*100):100;
  return{faltanEn05,faltanEn02,consistencia,total,problemas,problemasPost31,productivos,prod05};
}

// ─── Smart tooltip positioning ───────────────────────────────────────────────


// ─── Íconos ───────────────────────────────────────────────────────────────────

// ─── ViewListaMaestraEquipos ──────────────────────────────────────────────────
// Columnas en el orden solicitado, con alias para encontrar el encabezado real
// de la planilla aunque varíe ligeramente en redacción/acentos.
const LISTA_COLUMNS=[
  {label:"Código Drusila",aliases:["Codigo Drusila","Código de Drusila","Cod Drusila"],group:"id"},
  {label:"Código Nuevo",aliases:["Codigo Nuevo","Codigo Interno","Código Interno","CODIGO N° INTERNO","Interno"],group:"id"},
  {label:"Familia",aliases:["Familia","Tipo de equipo","Tipo"],group:"id"},
  {label:"Marca",aliases:["Marca"],group:"id"},
  {label:"Modelo",aliases:["Modelo","Modelo Equipo","Modelo de Equipo","Modelo Maquina","Modelo Máquina","Marca / Modelo","Marca Modelo","Marca y Modelo"],group:"id"},
  {label:"Propiedad",aliases:["Propiedad"],group:"id"},
  {label:"N° Serie",aliases:["N Serie","Nro Serie","Numero de Serie","N° de Serie"],group:"id"},
  {label:"Potencia",aliases:["Potencia"],group:"tec"},
  {label:"Año Fabricación",aliases:["Año de Fabricacion","Anio de Fabricacion","Año Fabricacion"],group:"tec"},
  {label:"Fecha Ingreso",aliases:["Fecha de Ingreso a la Empresa","Fecha de Ingreso","Ingreso a la Empresa"],group:"tec"},
  {label:"Horómetro",special:"horometro",aliases:[],group:"tec"},
  {label:"Costo Local USD (s/IVA)",aliases:["Costo Local en Dolares sin IVA","Costo Local USD sin IVA","Costo Local Dolares"],group:"costo"},
  {label:"Tipo Combustible",aliases:["Tipo de Combustible"],group:"tec"},
  {label:"Capacidad",aliases:["Capacidad"],group:"tec"},
  {label:"Tarifa Mensual Alquiler",aliases:["Tarifa Mensual de Alquiler","Tarifa de Alquiler Mensual"],group:"costo"},
  {label:"Horas Trab. x Mes",aliases:["Horas Trabajadas por Mes","Horas Trab por Mes","Horas de Trabajo por Mes"],group:"costo"},
  {label:"Cant. Neumáticos",aliases:["Cantidad de Neumaticos","Cantidad Neumaticos"],group:"neum",width:95,align:"center",compact:true},
  {label:"Costo Neumático USD/u",aliases:["Costo de Neumaticos en Dolares por Unidad","Costo Neumatico USD Unidad","Costo Neumaticos Dolares"],group:"neum",width:112,align:"center",compact:true},
  {label:"Combustible (lts/hs y km/hs)",aliases:["Combustible lts hs y km hs","Consumo Combustible lts hs km hs"],group:"uso",width:110,align:"center",compact:true},
  {label:"Vida Útil hs/km",aliases:["Vida Util hs km","Vida Util"],group:"tec"},
  {label:"Horas Hombre (Mecánico)",aliases:["Horas Hombre Mecanico","Horas Hombre"],group:"uso",width:105,align:"center",compact:true},
  {label:"Lugar de Alquiler",aliases:["Lugar de Alquiler","Lugar Alquiler"],group:"uso"},
];

const LISTA_EQUIPOS_YEAR_OPTIONS=Array.from(
  {length:Math.max(1,new Date().getFullYear()-1979)},
  (_,i)=>String(new Date().getFullYear()-i)
);
function normalizeYearValue(v){
  const m=String(v||"").match(/(19|20)\d{2}/);
  return m?m[0]:"";
}
function isYearOnlyListaField(label){
  const k=cleanKey(label);
  return (
    k.includes("fecha ingreso") ||
    k.includes("ingreso a la empresa") ||
    k.includes("ano fabricacion") ||
    k.includes("anio fabricacion") ||
    k.includes("fabricacion")
  );
}
function ListaEquipoFieldInput({field,value,onChange,placeholder}){
  const commonStyle={background:C.card,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,padding:"8px 10px",fontSize:12,outline:"none"};
  if(field.inputType==="year"){
    return(
      <select value={normalizeYearValue(value)} onChange={e=>onChange(e.target.value)} style={commonStyle}>
        <option value="">Seleccionar año...</option>
        {LISTA_EQUIPOS_YEAR_OPTIONS.map(y=><option key={y} value={y}>{y}</option>)}
      </select>
    );
  }
  return <input type={field.inputType} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder||""} style={commonStyle}/>;
}

// ─── Export Excel Lista Maestra de Equipos ────────────────────────────────────
function generarExcelListaMaestra(rows, cols, label){
  const wb=XLSX.utils.book_new();
  const headers=cols.map(c=>c.label);
  const data=[headers];
  rows.forEach(r=>{
    data.push(cols.map(c=>{
      if(c.key==="_horometroDisplay")return r._horometroValue!=null?r._horometroValue:"";
      const v=r[c.key];
      return v==null?"":v;
    }));
  });
  const ws=XLSX.utils.aoa_to_sheet(data);
  ws["!cols"]=cols.map(c=>({wch:c.wrap?24:14}));
  XLSX.utils.book_append_sheet(wb,ws,"Lista Equipos");
  XLSX.writeFile(wb,`Lista_Maestra_Equipos_${label}.xlsx`);
}

// ─── Reporte PDF Consistencia ROP02 vs ROP05 ─────────────────────────────────
// Genera el reporte del botón "Guardar Reporte" de la vista de Consistencia.
// Abre una ventana con el reporte formateado y lanza el diálogo de impresión
// del navegador, desde donde se guarda como PDF (Destino: "Guardar como PDF").
// faltanEn05: registros de ROP02 sin producción cargada en ROP05.
// faltanEn02: registros de ROP05 sin parte diario en ROP02.
function generarReporteControl(periodoLabel,faltanEn05,faltanEn02){
  const esc=(v)=>String(v==null||v===""?"—":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const total=(faltanEn05?.length||0)+(faltanEn02?.length||0);
  const totalReg=total; // problemas totales
  const generado=new Date().toLocaleString("es-AR");

  const filas05=(faltanEn05||[]).map(r=>`<tr>
    <td>${esc(fmtFecha(r.fecha))}</td><td>${esc(r.proyecto)}</td><td>${esc(r.maquina)}</td>
    <td>${esc(r.parte)}</td><td>${esc(r.operario)}</td><td>${esc(r.supervisor)}</td>
    <td class="num">${esc(fmtNum(Number(r.horas)||0))}</td><td>${esc(r.estado)}</td><td>${esc(r.tipo_trabajo)}</td>
  </tr>`).join("");

  const filas02=(faltanEn02||[]).map(r=>`<tr>
    <td>${esc(fmtFecha(r.fecha))}</td><td>${esc(r.proyecto)}</td><td>${esc(r.maquina)}</td>
    <td>${esc(r.supervisor)}</td><td>${esc(r.tarea)}</td>
    <td class="num">${esc(fmtNum(Number(r.horas)||0))}</td><td class="num">${esc(fmtNum(Number(r.cantidad)||0))}</td><td>${esc(r.unidad)}</td>
  </tr>`).join("");

  const html=`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
  <title>Reporte Consistencia ROP02 vs ROP05</title>
  <style>
    *{box-sizing:border-box;}
    body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px;font-size:12px;}
    h1{font-size:18px;margin:0 0 2px;}
    h2{font-size:14px;margin:22px 0 6px;padding-bottom:4px;border-bottom:2px solid #333;}
    .meta{color:#555;font-size:11px;margin-bottom:14px;}
    .resumen{display:flex;gap:12px;margin:12px 0 4px;}
    .stat{border:1px solid #bbb;border-radius:6px;padding:8px 14px;text-align:center;}
    .stat .v{font-size:20px;font-weight:bold;}
    .stat .l{font-size:10px;color:#555;text-transform:uppercase;letter-spacing:.04em;}
    table{width:100%;border-collapse:collapse;margin-top:6px;page-break-inside:auto;}
    tr{page-break-inside:avoid;}
    th{background:#eee;border:1px solid #999;padding:4px 6px;text-align:left;font-size:10px;text-transform:uppercase;}
    td{border:1px solid #ccc;padding:4px 6px;vertical-align:top;}
    td.num{text-align:right;}
    tbody tr:nth-child(even){background:#f6f6f6;}
    .vacio{color:#777;font-style:italic;padding:8px 0;}
    @media print{body{margin:10mm;} .stat{-webkit-print-color-adjust:exact;print-color-adjust:exact;} th,tbody tr:nth-child(even){-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
  </style></head><body>
    <h1>Reporte de Consistencia ROP02 vs ROP05</h1>
    <div class="meta">Período: <b>${esc(periodoLabel||"Todo el período")}</b> &nbsp;·&nbsp; Generado: ${esc(generado)}</div>
    <div class="resumen">
      <div class="stat"><div class="v">${faltanEn05?.length||0}</div><div class="l">Sin producción en ROP05</div></div>
      <div class="stat"><div class="v">${faltanEn02?.length||0}</div><div class="l">Sin parte diario en ROP02</div></div>
      <div class="stat"><div class="v">${totalReg}</div><div class="l">Total de problemas</div></div>
    </div>
    <h2>Sin producción en ROP05 (${faltanEn05?.length||0})</h2>
    ${filas05?`<table><thead><tr><th>Fecha</th><th>Proyecto</th><th>Máquina</th><th>N° Parte</th><th>Operario</th><th>Supervisor</th><th>Horas</th><th>Estado</th><th>Tarea (ROP02)</th></tr></thead><tbody>${filas05}</tbody></table>`:`<div class="vacio">No hay registros para el período seleccionado.</div>`}
    <h2>Sin parte diario en ROP02 (${faltanEn02?.length||0})</h2>
    ${filas02?`<table><thead><tr><th>Fecha</th><th>Proyecto</th><th>Máquina</th><th>Supervisor</th><th>Tarea</th><th>Horas</th><th>Cantidad</th><th>Unidad</th></tr></thead><tbody>${filas02}</tbody></table>`:`<div class="vacio">No hay registros para el período seleccionado.</div>`}
  </body></html>`;

  // Impresión en la misma página: el reporte se carga en un iframe oculto y se
  // dispara el diálogo de imprimir sin abrir pestañas ni ventanas nuevas.
  const prev=document.getElementById("reporte-control-print-frame");
  if(prev)prev.remove();
  const iframe=document.createElement("iframe");
  iframe.id="reporte-control-print-frame";
  iframe.style.cssText="position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);
  const doc=iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  const lanzarPrint=()=>{
    try{
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }catch(err){
      appAlert("No se pudo abrir el diálogo de impresión: "+err.message);
    }
    // Limpiar el iframe después de que se cierre el diálogo de impresión
    setTimeout(()=>{try{iframe.remove();}catch(_){}},60000);
  };
  // Esperar a que el iframe termine de renderizar antes de imprimir
  if(doc.readyState==="complete")setTimeout(lanzarPrint,150);
  else iframe.onload=()=>setTimeout(lanzarPrint,150);
}

// Oficina Técnica fue modularizada en src/modules/oficina-tecnica/.


// ─── ParamInput — input numérico fluido
// No recalcula la pantalla pesada mientras se escribe: guarda el número al salir del campo
// o al presionar Enter. Así los parámetros no tildan el Informe de Costos.

// ─── ViewMantenimiento ────────────────────────────────────────────────────────

// ─── ViewDistribucionMantenimientos ──────────────────────────────────────────
// ─── Login ────────────────────────────────────────────────────────────────────
// Login modularizado en src/modules/auth/.


// ─── App ──────────────────────────────────────────────────────────────────────
const IMG_CARGADORA_FRONTAL="/img/embedded/app-img-cargadora-frontal-7b127bf2.webp";
const IMG_EXCAVADORA="/img/embedded/app-img-excavadora-d00a08fb.webp";
const IMG_TOPADORA="/img/embedded/app-img-topadora-ee1491f2.webp";
const IMG_MOTONIVELADORA="/img/embedded/app-img-motoniveladora-2008324c.webp";
const IMG_RETROPALA="/img/embedded/app-img-retropala-9c5489b6.webp";
const IMG_RODILLO_COMPACTADOR="/img/embedded/app-img-rodillo-compactador-86b8e677.webp";
const IMG_MINICARGADORA="/img/embedded/app-img-minicargadora-091ef630.webp";
const VEH_COMBUSTIBLE="/img/embedded/app-veh-combustible-77100a8a.webp";
const VEH_CAMIONETA="/img/embedded/app-veh-camioneta-6527c962.webp";
const VEH_VOLCADOR="/img/embedded/app-veh-volcador-65b2cf01.webp";
const VEH_REGADOR="/img/embedded/app-veh-regador-55a9b9d7.webp";
const VEH_TRACTOR="/img/embedded/app-veh-tractor-147468cc.webp";
const LOGO="/img/embedded/app-logo-7fab0f62.webp";
function generarExcelICHC(rows, totales, label){
  const wb=XLSX.utils.book_new();
  const headers=["Máquina","Proyecto","Hs Efectivas","Fecha Inicio","Fecha Fin","Días Efect.+OD","Días FS","Días OD","Hs Op. a Disposición","Hs Contratadas","% CHC"];
  const data=[headers];
  rows.forEach(r=>data.push([r.maquina,r.proyecto,r.horasTrabajo,r.fechaInicio,r.fechaFin,r.diasEfectivos,r.diasFS,r.diasOD,r.hsOD,r.hsContratadas,r.pct]));
  data.push(["TOTAL","",totales.horasTrabajo,"","","",totales.diasFS,totales.diasOD,totales.hsOD,totales.hsContratadas,totales.pct]);
  const ws=XLSX.utils.aoa_to_sheet(data);
  ws["!cols"]=[{wch:12},{wch:14},{wch:13},{wch:13},{wch:13},{wch:14},{wch:9},{wch:9},{wch:20},{wch:14},{wch:8}];
  XLSX.utils.book_append_sheet(wb,ws,"ICHC");
  XLSX.writeFile(wb,`ICHC_${label}.xlsx`);
}

// ─── Export Excel Mantenimiento ───────────────────────────────────────────────
function generarExcelMantenimiento(rows, usdRate, label){
  const wb=XLSX.utils.book_new();
  const data=[["Fecha","Máquina","Proyecto","Tipo","Intervención","Operativo","Costo ARS","Costo USD"]];
  rows.forEach(r=>data.push([
    r.fecha,r.maquina,r.proyecto,r.tipoMant,r.intervencion,r.operativo?"SÍ":"NO",
    r.costoTotal>0?r.costoTotal:0,
    r.costoTotal>0&&usdRate?Math.round(r.costoTotal/usdRate):0,
  ]));
  const ws=XLSX.utils.aoa_to_sheet(data);
  ws["!cols"]=[{wch:12},{wch:12},{wch:14},{wch:13},{wch:40},{wch:10},{wch:14},{wch:12}];
  XLSX.utils.book_append_sheet(wb,ws,"Mantenimiento");
  XLSX.writeFile(wb,`Mantenimiento_${label}.xlsx`);
}


// ─── Export específico: Códigos sin precio con detalle de uso ─────────────────
function generarExcelCodigosSinPrecio(rows){
  const wb=XLSX.utils.book_new();

  const fmtFechaISO=iso=>{
    const f=normDate(iso);
    if(!f)return "";
    const [y,m,d]=String(f).split("-");
    return `${d}/${m}/${y}`;
  };

  const detalleTexto=usosDetalle=>{
    const detalles=[...(usosDetalle||[])]
      .sort((a,b)=>String(b.fecha||"").localeCompare(String(a.fecha||"")));
    if(!detalles.length)return "";
    return detalles.map(d=>{
      const fecha=fmtFechaISO(d.fecha)||"S/F";
      const equipo=String(d.equipo||"—").trim()||"—";
      const proyecto=String(d.proyecto||"—").trim()||"—";
      return `${fecha} - ${equipo} - ${proyecto}`;
    }).join(" | ");
  };

  const resumen=[[
    "Código",
    "Descripción",
    "Usos",
    "Detalle de uso"
  ]];

  (rows||[]).forEach(r=>{
    resumen.push([
      r.codigo||"",
      r.descripcion||"",
      Number(r.usos)||0,
      detalleTexto(r.usosDetalle)
    ]);
  });

  const wsResumen=XLSX.utils.aoa_to_sheet(resumen);
  wsResumen["!cols"]=[{wch:16},{wch:45},{wch:10},{wch:95}];
  XLSX.utils.book_append_sheet(wb,wsResumen,"Resumen");

  const detalle=[[
    "Código",
    "Descripción",
    "Día",
    "Equipo",
    "Proyecto"
  ]];

  (rows||[]).forEach(r=>{
    const detalles=[...(r.usosDetalle||[])]
      .sort((a,b)=>String(b.fecha||"").localeCompare(String(a.fecha||"")));
    if(!detalles.length){
      detalle.push([r.codigo||"",r.descripcion||"","","",""]);
      return;
    }
    detalles.forEach(d=>{
      detalle.push([
        r.codigo||"",
        r.descripcion||"",
        fmtFechaISO(d.fecha),
        d.equipo||"—",
        d.proyecto||"—"
      ]);
    });
  });

  const wsDetalle=XLSX.utils.aoa_to_sheet(detalle);
  wsDetalle["!cols"]=[{wch:16},{wch:45},{wch:14},{wch:22},{wch:18}];
  XLSX.utils.book_append_sheet(wb,wsDetalle,"Detalle de uso");

  XLSX.writeFile(wb,"Codigos_Sin_Precio.xlsx");
}

// ─── Helper universal: genera Excel desde cols/rows igual que la tabla de la app ──
function excelFromCols(cols, rows, filename){
  const wb=XLSX.utils.book_new();
  // Extraer sólo las columnas que tienen label (las que se ven en la tabla)
  const visCols=cols.filter(c=>c.label);
  const headers=visCols.map(c=>c.label);
  // Construir filas: usar el valor raw (sin render) para que sea numéricamente correcto
  const dataRows=rows.map(r=>visCols.map(c=>{
    const v=r[c.key];
    // Si es null/undefined devolver vacío
    if(v===null||v===undefined)return "";
    // Mantener números como números
    if(typeof v==="number")return v;
    return String(v);
  }));
  const ws=XLSX.utils.aoa_to_sheet([headers,...dataRows]);
  // Ancho automático por contenido (hasta 50 chars)
  ws["!cols"]=visCols.map(c=>({wch:Math.min(50,Math.max(c.label.length+2,12))}));
  XLSX.utils.book_append_sheet(wb,ws,"Datos");
  XLSX.writeFile(wb,`${filename}.xlsx`);
}

// Botón Excel reutilizable

function tipoEquipoCosto(maquina){
  const tipo=String(getMachineType(maquina)||"").toUpperCase();
  const code=cleanMachine(String(maquina||"")).toUpperCase();

  if(isCompactorEquipment({code,type:tipo}))return "COMPACTACION";

  if(tipo.includes("CAMIONETA")||/^CTA/.test(code)||/^AG[0-9]/.test(code)||/^AH[0-9]/.test(code))return "CAMIONETAS";
  if(isMaintenanceCostTruck({code,type:tipo}))return "CAMIONES";

  // IMPORTANTE: MINICARGADORA va antes que CARGADORA FRONTAL.
  if(tipo.includes("MINICARGADORA")||/^MCA-/.test(code)||/^MNC-/.test(code))return "MINICARGADORA";

  if(tipo.includes("EXCAVADORA")||/^EXC-/.test(code))return "EXCAVADORA";
  if(tipo.includes("CARGADORA FRONTAL")||tipo==="CARGADORA"||/^PCA-/.test(code)||/^CFN-/.test(code))return "CARGADORA FRONTAL";
  if(tipo.includes("MOTONIVELADORA")||/^MOT-/.test(code))return "MOTONIVELADORA";
  if(tipo.includes("TOPADORA")||/^TOP-/.test(code))return "TOPADORA";
  if(tipo.includes("RETROPALA")||/^RTP-/.test(code))return "RETROPALA";
  return "OTROS";
}
function esMaquinaCosto(tipo,maquina=""){
  return isMaintenanceCostMachine({code:maquina,type:tipo});
}

const MESES_ES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
function monthKeyCosto(fecha){
  const f=String(fecha||"").slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(f))return "";
  return f.slice(0,7);
}
function monthLabelCosto(key){
  const m=Number(String(key||"").slice(5,7));
  return MESES_ES[m-1]||key;
}
function addMonthCosto(key){
  const y=Number(key.slice(0,4));
  const m=Number(key.slice(5,7));
  const d=new Date(y,m,1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function buildMonthKeysCosto(rows,modoFecha,fechaDia,fechaD,fechaH){
  let minKey="",maxKey="";

  if(modoFecha==="dia"&&fechaDia){
    minKey=maxKey=monthKeyCosto(fechaDia);
  }else if(modoFecha==="periodo"&&(fechaD||fechaH)){
    const keys=(rows||[]).map(r=>monthKeyCosto(r.fecha)).filter(Boolean).sort();
    minKey=fechaD?monthKeyCosto(fechaD):(keys[0]||"");
    maxKey=fechaH?monthKeyCosto(fechaH):(keys[keys.length-1]||"");
  }else{
    const keys=[...new Set((rows||[]).map(r=>monthKeyCosto(r.fecha)).filter(Boolean))].sort();
    return keys.map(k=>({key:k,label:monthLabelCosto(k)}));
  }

  if(!minKey||!maxKey)return [];
  const out=[];
  for(let k=minKey;k<=maxKey;k=addMonthCosto(k)){
    out.push({key:k,label:monthLabelCosto(k)});
    if(out.length>36)break;
  }
  return out;
}



export {
  IMG_LOGIN_FONDO,
  EXCLUDED_TYPES,
  MACHINE_TYPE_MAP,
  PREFIX_TYPE_MAP,
  normalizeMachineCode,
  getMachineType,
  isExcluded,
  isRop02ControlMachineExcluded,
  fmtNum,
  fmtPct,
  fmtFecha,
  uniq,
  semaforo,
  DM_ALIAS_MAPS,
  dmNormKey,
  dmApplyAlias,
  dmNormalizeProject,
  dmNormalizeTipoEquipo,
  ROP05_TIPOS_MAQUINA,
  tipoMatchMachineROP05,
  dmTipoMaquinaOptions,
  dmMatchTipoMaquinaSeleccion,
  dmTitleCaseText,
  dmDisplayTarea,
  dmNormalizeTarea,
  dmNormalizeUnidad,
  cleanKey,
  cleanKeyLoose,
  getValue,
  toNumber,
  normalizeInflatedMoneyValue,
  toMoneyNumber,
  getExactValue,
  getInsumoExtra,
  normDate,
  cleanMachine,
  canonicalEquivalentMachineCode,
  machineCodeOutsideParentheses,
  validPropiedadValue,
  normalizeVehicleFamily,
  getListaVehicleVal,
  getVehicleTipoFromListaRow,
  getProyectoVehiculoFromListaRow,
  getSitioVehiculoFromListaRow,
  getPropiedadVehiculoFromListaRow,
  getCodigoNuevoFromListaRow,
  getCodigoViejoFromListaRow,
  buildVehicleListaIndex,
  getListaVehicleMatch,
  getListaEquipoAllCodes,
  addListaEquipoIndexKey,
  buildListaEquipoInfoIndex,
  getListaEquipoInfoMatch,
  COL_STOPWORDS,
  tokenizeLabel,
  findColumnKey,
  mainMachineCode,
  EQUIPO_SIN_INFO_EXCLUDED_CODES,
  isValidEquipoCodigoParaCorrelacion,
  machineLookupVariants,
  turnoOrder,
  buildHorometroMapForLista,
  detectEstado,
  _canonicalMap,
  _tareaMap,
  SUPERVISOR_EMAIL_MAP,
  normalizeName,
  levenshtein,
  buildTareaMap,
  normTarea,
  buildCanonicalMap,
  normName,
  normProject,
  proyColor,
  byDateFilter,
  normalizeROP02,
  normSupervisorROP05,
  fmtARS,
  fmtUSD,
  normalizeInsumoCode,
  normalizeRMA15,
  normalizeROP05,
  esNoProductivo,
  calcControl,
  LISTA_COLUMNS,
  LISTA_EQUIPOS_YEAR_OPTIONS,
  normalizeYearValue,
  isYearOnlyListaField,
  ListaEquipoFieldInput,
  generarExcelListaMaestra,
  generarReporteControl,
  IMG_CARGADORA_FRONTAL,
  IMG_EXCAVADORA,
  IMG_TOPADORA,
  IMG_MOTONIVELADORA,
  IMG_RETROPALA,
  IMG_RODILLO_COMPACTADOR,
  IMG_MINICARGADORA,
  VEH_COMBUSTIBLE,
  VEH_CAMIONETA,
  VEH_VOLCADOR,
  VEH_REGADOR,
  VEH_TRACTOR,
  LOGO,
  generarExcelICHC,
  generarExcelMantenimiento,
  generarExcelCodigosSinPrecio,
  excelFromCols,
  tipoEquipoCosto,
  esMaquinaCosto,
  MESES_ES,
  monthKeyCosto,
  monthLabelCosto,
  addMonthCosto,
  buildMonthKeysCosto
};
