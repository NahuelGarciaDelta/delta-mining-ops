import { collectProjects, normalizeProjectName } from "../../shared/projects.js";

// Selector principal del control: los mismos proyectos se aplican a ambas
// fuentes ANTES del cruce. "todos" conserva el comportamiento anterior.
// [] implica ninguno; no debe interpretarse como "todos".
export function availableControlProjects(rop02Rows,rop05Rows){
  return collectProjects(rop02Rows,rop05Rows);
}

export function filterControlProjects(rows,selected="todos"){
  const safe=Array.isArray(rows)?rows:[];
  if(selected==="todos"||selected===undefined||selected===null)return safe;
  const choices=Array.isArray(selected)?selected:[selected];
  const allowed=new Set(choices.map(project=>normalizeProjectName(project,{empty:""})).filter(Boolean));
  if(!allowed.size)return [];
  return safe.filter(row=>allowed.has(normalizeProjectName(row?.proyecto??row?.Proyecto??row?.lugar??row?.Lugar,{empty:""})));
}

export function noControlProjectsSelected(value){
  return Array.isArray(value)&&value.length===0;
}
