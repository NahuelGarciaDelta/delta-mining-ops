export function dmNormalizeArea(value){
  return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toUpperCase();
}
export function dmCanEditArea(requiredArea){
  if(!requiredArea)return true;
  const userArea=dmNormalizeArea(sessionStorage.getItem("dm_area"));
  const targetArea=dmNormalizeArea(requiredArea);
  if(userArea===dmNormalizeArea("OFICINA TÉCNICA"))return true;
  return userArea===targetArea;
}
