const REQUIRED_COLUMNS = [
  {key:"codigoArticulo",labels:["cod articulo","codigo articulo"]},
  {key:"descripcion",labels:["descripcion"]},
  {key:"descripcionAdicional",labels:["desc adicional","descripcion adicional"]},
  {key:"descripcionDeposito",labels:["descripcion deposito"]},
  {key:"controlStock",labels:["um control stock","u m control stock","u.m. control stock","u.m control stock","unidad control stock","unidad medida control stock","control stock"]},
  {key:"saldoControlStock",labels:["saldo control stock"],numeric:true},
  {key:"stockMaximo",labels:["stock maximo"],numeric:true},
  {key:"stockMinimo",labels:["stock minimo"],numeric:true},
];

export const STOCK_DEPOSITS = new Set(["DEPOSITO CENTRAL","DEPOSITO BATIDERO","DEPOSITO FILO DEL SOL"]);
const normalize=value=>String(value??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
const isBlankRow=row=>!Array.isArray(row)||row.every(value=>String(value??"").trim()==="");
const strictNumber=value=>{
  if(typeof value==="number")return Number.isFinite(value)?value:null;
  const text=String(value??"").trim();
  if(!text)return 0;
  const normalized=text.includes(",")?text.replace(/\./g,"").replace(",","."):text;
  if(!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(normalized))return null;
  const number=Number(normalized);return Number.isFinite(number)?number:null;
};

export function validateStockWorkbook(XLSX,buffer,fileName){
  if(!/\.(xlsx|xls)$/i.test(String(fileName||"")))throw new Error("El archivo debe ser .xlsx o .xls.");
  const workbook=XLSX.read(buffer,{type:"array",cellDates:true});
  let sourceSheet="",data=[],headerIndex=-1,headerMap=null,missingHeaders=REQUIRED_COLUMNS.map(c=>c.key);
  for(const name of workbook.SheetNames){
    const rows=XLSX.utils.sheet_to_json(workbook.Sheets[name],{header:1,defval:"",raw:true});
    for(let index=0;index<Math.min(rows.length,100);index++){
      const headers=rows[index].map(value=>normalize(String(value||"").replace(/c[oó]d\.?/i,"codigo")));
      const map={},missing=[];
      REQUIRED_COLUMNS.forEach(column=>{const found=headers.findIndex(header=>column.labels.includes(header));if(found<0)missing.push(column.key);else map[column.key]=found;});
      if(missing.length<missingHeaders.length)missingHeaders=missing;
      if(!missing.length){sourceSheet=name;data=rows;headerIndex=index;headerMap=map;break;}
    }
    if(headerMap)break;
  }
  if(!headerMap)return {fileName,sourceSheet,rows:[],report:{foundRows:0,validRows:0,rejectedRows:0,duplicateCodes:0,invalidValues:0,missingHeaders,rejections:[]},blocked:true};
  const candidates=data.slice(headerIndex+1).filter(row=>!isBlankRow(row));
  if(candidates.length>50000)throw new Error("El Excel supera el máximo de 50.000 filas.");
  const seen=new Set(),rows=[],rejections=[];let duplicateCodes=0,invalidValues=0;
  candidates.forEach((raw,index)=>{
    const get=key=>raw[headerMap[key]],code=String(get("codigoArticulo")||"").trim(),deposit=String(get("descripcionDeposito")||"").trim().toUpperCase();
    const reasons=[];if(!code)reasons.push("Código vacío");if(code&&seen.has(code.toUpperCase())){reasons.push("Código duplicado");duplicateCodes++;}if(code)seen.add(code.toUpperCase());
    if(!STOCK_DEPOSITS.has(deposit))reasons.push("Depósito no reconocido");
    const saldo=strictNumber(get("saldoControlStock")),maximo=strictNumber(get("stockMaximo")),minimo=strictNumber(get("stockMinimo"));
    if(saldo===null||maximo===null||minimo===null){reasons.push("Valor numérico inválido");invalidValues++;}
    if(minimo!==null&&maximo!==null&&minimo>maximo)reasons.push("Stock mínimo mayor al máximo");
    if(reasons.length){rejections.push({row:headerIndex+index+2,code,reasons});return;}
    rows.push({id:`stock-${index+1}`,codigoArticulo:code,descripcion:String(get("descripcion")||"").trim(),descripcionAdicional:String(get("descripcionAdicional")||"").trim(),descripcionDeposito:deposit,controlStock:String(get("controlStock")||"").trim(),saldoControlStock:saldo,stockMaximo:maximo,stockMinimo:minimo});
  });
  return {fileName,sourceSheet,rows,report:{foundRows:candidates.length,validRows:rows.length,rejectedRows:rejections.length,duplicateCodes,invalidValues,missingHeaders:[],rejections},blocked:rows.length===0};
}

export function stockValidationSummary(result){const r=result.report;return [`Filas encontradas: ${r.foundRows}`,`Filas válidas: ${r.validRows}`,`Filas rechazadas: ${r.rejectedRows}`,`Códigos duplicados: ${r.duplicateCodes}`,`Valores inválidos: ${r.invalidValues}`,r.missingHeaders.length?`Encabezados faltantes: ${r.missingHeaders.join(", ")}`:""].filter(Boolean).join("\n");}
