import {normalizeProjectName,projectLabel} from "../../shared/projects.js";

/**
 * Fuente de verdad: catálogo dinámico de fuentes ROP02 de Supabase (cargado
 * antes de montar la aplicación), más proyectos presentes en partes cargados.
 * La lista NO depende de que el proyecto ya tenga registros.
 */
export function qualityProjectsFromSources(sources=[],rop02Rows=[]){
  const found=new Map();
  const add=value=>{
    const project=normalizeProjectName(value,{empty:""});
    if(project&&!["S/D","SIN PROYECTO"].includes(project)&&!found.has(project)){
      found.set(project,{project,label:projectLabel(project)});
    }
  };
  for(const source of Array.isArray(sources)?sources:[])add(source?.project);
  for(const row of Array.isArray(rop02Rows)?rop02Rows:[])add(row?.proyecto??row?.Proyecto??row?._proyectoForzado);
  return [...found.values()];
}

/**
 * Compatibilidad con preferencias previas: principal mezclaba JM/FDS,
 * mientras FILO SUR y EL ZORRO eran pestañas individuales.
 * Las nuevas preferencias usan SIEMPRE el nombre del proyecto.
 */
export function selectedQualityProject(state={},projects=[]){
  const projectList=projects.map(p=>typeof p==="string"?normalizeProjectName(p,{empty:""}):p?.project);
  const isAvailable=p=>Boolean(p&&projectList.includes(p));
  const chosen=normalizeProjectName(state?.chcProject,{empty:""});
  if(isAvailable(chosen))return chosen;

  const legacy=String(state?.chcTab??"principal").toLowerCase();
  if(legacy==="filosur"&&isAvailable("FILO SUR"))return"FILO SUR";
  if(legacy==="zorro"&&isAvailable("EL ZORRO"))return"EL ZORRO";
  if(legacy==="principal"){
    const wanted=Array.isArray(state?.proyecto)?state.proyecto[0]:state?.proyecto;
    const oldProject=normalizeProjectName(wanted,{empty:""});
    if(isAvailable(oldProject)&&oldProject!=="FILO SUR"&&oldProject!=="EL ZORRO")return oldProject;
  }
  return projectList[0]||"";
}

// Conserva las convenciones históricas en los proyectos que las usaban.
// Los proyectos futuros comienzan con el corte contractual 26–25.
export function qualityPeriodMode(project){
  const normalized=normalizeProjectName(project,{empty:""});
  return normalized==="FILO SUR"||normalized==="EL ZORRO"?"calendar":"contract";
}

export function qualityMonthPeriod(project,year,monthIndex){
  const y=Number(year),m=Number(monthIndex);
  if(!Number.isInteger(y)||y<2020||y>2100||!Number.isInteger(m)||m<0||m>11)
    throw new RangeError("Mes o año no válido para Calidad");
  const iso=(yy,mm,day)=>`${yy}-${String(mm).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  if(qualityPeriodMode(project)==="calendar"){
    const lastDay=new Date(Date.UTC(y,m+1,0)).getUTCDate();
    return{fechaD:iso(y,m+1,1),fechaH:iso(y,m+1,lastDay),diasPeriodo:lastDay,mode:"calendar"};
  }
  const fromYear=m===0?y-1:y;
  const fromMonth=m===0?12:m;
  const fechaD=iso(fromYear,fromMonth,26),fechaH=iso(y,m+1,25);
  const diasPeriodo=Math.round((Date.parse(fechaH+"T00:00:00Z")-Date.parse(fechaD+"T00:00:00Z"))/86400000)+1;
  return{fechaD,fechaH,diasPeriodo,mode:"contract"};
}

export function qualityRowsForProject(rows=[],project,fechaD,fechaH){
  const selected=normalizeProjectName(project,{empty:""});
  if(!selected)return[];
  return(Array.isArray(rows)?rows:[]).filter(row=>
    !row?._excluded &&
    normalizeProjectName(row?.proyecto??row?.Proyecto??row?._proyectoForzado,{empty:""})===selected &&
    Boolean(row.fecha&&row.fecha>=fechaD&&row.fecha<=fechaH)
  );
}
