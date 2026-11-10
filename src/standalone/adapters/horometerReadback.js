// Pure module so confirmation can be unit-tested without a Supabase/browser session.
function readbackMeterNumber(value){
 if(value===""||value===null||value===undefined)return null;
 const raw=String(value).trim();
 const normalized=raw.includes(",")?raw.replace(/\./g,"").replace(",","."):raw;
 const number=Number(normalized);
 return Number.isFinite(number)&&number>=0?number:NaN;
}
// Reconcile unknown relay responses against current cells in the ORIGINAL
// Lista Maestra. This is read-only: it never resends a timed-out mutation.
export function reconcileHorometerReadback(results,rows){
 const normCode=v=>String(v??"").toUpperCase().replace(/[^A-Z0-9]/g,"");
 const codeIndex=new Map();
 for(const row of rows||[]){
  const values=[row["Código nuevo"],row["Codigo nuevo "],row.codigo_nuevo,row["Código de Drusila"],row["Código Drusila"],row["Codigo de Drusila"],row.codigo_drusila];
  for(const raw of values){
   const key=normCode(raw);if(!key)continue;
   if(!codeIndex.has(key))codeIndex.set(key,[]);
   const candidates=codeIndex.get(key);if(!candidates.includes(row))candidates.push(row);
  }
 }
 return results.map(result=>{
  if(result.status!=="pending")return result;
  const update=result._requested;
  if(!update||!Number.isFinite(readbackMeterNumber(update.value)))return result;
  const identity=update.identity||{};
  const keys=[identity.codigoNuevo,identity.codigoDrusila].map(normCode).filter(Boolean);
  if(!keys.length)return result;
  const matches=keys.map(k=>codeIndex.get(k)||[]);
  if(matches.some(arr=>arr.length!==1))return result;
  const row=matches[0][0];
  if(matches.some(arr=>arr[0]!==row))return result;
  const meterKey=["HORAS","Horas","horas","Horómetro","Horometro"].find(k=>Object.prototype.hasOwnProperty.call(row,k));
  if(!meterKey)return result;
  const stored=readbackMeterNumber(row[meterKey]),expected=readbackMeterNumber(update.value);
  if(!Number.isFinite(stored)||stored!==expected)return result;
  return {...result,status:"confirmed",changed:readbackMeterNumber(update.expectedValue)!==expected,
    column:meterKey,currentValue:row[meterKey],value:update.value,confirmation:"original_sheet_readback",
    verificationWarning:null,code:undefined,message:undefined};
 });
}

