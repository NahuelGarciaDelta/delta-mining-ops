export const DASHBOARD_SNAPSHOT_CACHE_VERSION=8;
export const DASHBOARD_SNAPSHOT_BACKEND_MARK="DASHBOARD-SNAPSHOT-V1";

export const DASHBOARD_PROJECT_DEFS=Object.freeze([
  {id:"JOSE MARIA",source:"rop02_jm"},
  {id:"FILO DEL SOL",source:"rop02_fs"},
  {id:"FILO SUR",source:"rop02_filosur"},
  {id:"EL ZORRO",source:"rop02_zorro"},
]);

const safe=value=>Array.isArray(value)?value:[];
const norm=value=>String(value??"")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"")
  .replace(/[._/\\-]+/g," ")
  .replace(/\s+/g," ")
  .trim()
  .toUpperCase();

export function dashboardDateKey(value){
  if(value instanceof Date&&!Number.isNaN(value.getTime())){
    return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`;
  }
  const raw=String(value??"").trim();
  if(!raw)return"";
  let m=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(m)return`${m[1]}-${String(m[2]).padStart(2,"0")}-${String(m[3]).padStart(2,"0")}`;
  m=raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})/);
  if(m){
    let year=Number(m[3]);
    if(year<100)year+=2000;
    return`${year}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`;
  }
  const parsed=new Date(raw);
  if(Number.isNaN(parsed.getTime()))return"";
  return`${parsed.getFullYear()}-${String(parsed.getMonth()+1).padStart(2,"0")}-${String(parsed.getDate()).padStart(2,"0")}`;
}

export function dashboardProjectId(value){
  const text=norm(value);
  if(!text)return"";
  if(text.includes("FILO SUR")||text==="FILOSUR"||text==="FSUR"||text==="F SUR")return"FILO SUR";
  if(text.includes("EL ZORRO")||text==="ZORRO")return"EL ZORRO";
  if((text.includes("JOSE")&&text.includes("MARIA"))||text==="JM"||text==="J M")return"JOSE MARIA";
  if(text.includes("FILO DEL SOL")||text==="FDS"||text==="FS"||text==="FILO"||text.includes("VICUNA"))return"FILO DEL SOL";
  return text;
}

function addProject_(list,id){if(id&&!list.includes(id))list.push(id);}

export function resolveDashboardScope(projectValue){
  const raw=norm(projectValue);
  if(!raw||["TODO","TODOS","ALL","GLOBAL"].includes(raw)){
    const projects=DASHBOARD_PROJECT_DEFS.map(item=>item.id);
    return{global:true,projects,requiredSources:DASHBOARD_PROJECT_DEFS.map(item=>item.source),scopeKey:"GLOBAL",rawProject:raw||"TODO"};
  }

  const projects=[];
  if((raw.includes("JOSE")&&raw.includes("MARIA"))||/(^|\s)JM(\s|$)/.test(raw))addProject_(projects,"JOSE MARIA");
  if(raw.includes("FILO SUR")||raw.includes("FILOSUR")||/(^|\s)FSUR(\s|$)/.test(raw))addProject_(projects,"FILO SUR");
  if(raw.includes("EL ZORRO")||/(^|\s)ZORRO(\s|$)/.test(raw))addProject_(projects,"EL ZORRO");
  if(raw.includes("FILO DEL SOL")||/(^|\s)FDS(\s|$)/.test(raw)||/(^|\s)FS(\s|$)/.test(raw)||raw.includes("VICUNA"))addProject_(projects,"FILO DEL SOL");

  if(!projects.length)addProject_(projects,dashboardProjectId(raw));
  const requiredSources=DASHBOARD_PROJECT_DEFS.filter(item=>projects.includes(item.id)).map(item=>item.source);
  const scopeKey=projects.map(id=>id.replace(/[^A-Z0-9]+/g,"_")).join("+")||"RESTRICTED";
  return{global:false,projects,requiredSources,scopeKey,rawProject:raw};
}

export function dashboardRowProject(row){
  return dashboardProjectId(row?.proyecto??row?.Proyecto??row?.PROYECTO??row?.lugar??row?.Lugar??row?.LUGAR??"");
}

export function applyDashboardScope(rows,scope){
  const list=safe(rows);
  if(scope?.global)return list;
  const allowed=new Set(safe(scope?.projects));
  return list.filter(row=>allowed.has(dashboardRowProject(row)));
}

export function operationalDashboardMonthKey(value){
  const date=dashboardDateKey(value);
  const m=date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m)return"";
  let year=Number(m[1]),month=Number(m[2]);
  if(Number(m[3])>=26){
    month+=1;
    if(month===13){month=1;year+=1;}
  }
  return`${year}-${String(month).padStart(2,"0")}`;
}

export function historicalDashboardDistribution(rows){
  const out={};
  safe(rows).forEach(row=>{
    if(row?._excluded)return;
    const key=operationalDashboardMonthKey(row?.fecha??row?.Fecha??row?.FECHA);
    if(!key)return;
    if(!out[key])out[key]={rows:0,hours:0};
    out[key].rows+=1;
    const hours=Number(row?.horas??row?.Hs??row?.["Cant. Hs."]??0);
    if(Number.isFinite(hours)&&hours>0)out[key].hours+=hours;
  });
  return out;
}

export function summarizeDashboardProjects(rows){
  const result={};
  DASHBOARD_PROJECT_DEFS.forEach(({id,source})=>{result[id]={project:id,source,rows:0,min:"",max:""};});
  safe(rows).forEach(row=>{
    const id=dashboardRowProject(row);
    if(!result[id])result[id]={project:id||"S/D",source:"",rows:0,min:"",max:""};
    const entry=result[id];
    entry.rows+=1;
    const date=dashboardDateKey(row?.fecha??row?.Fecha??row?.FECHA);
    if(date){
      if(!entry.min||date<entry.min)entry.min=date;
      if(!entry.max||date>entry.max)entry.max=date;
    }
  });
  return result;
}

function sourceRows_(value){
  if(typeof value==="number")return Number(value)||0;
  if(!value||typeof value!=="object")return null;
  for(const key of ["rows","count","total","registros","returnedRows"]){
    const number=Number(value[key]);
    if(Number.isFinite(number))return number;
  }
  return null;
}

function validateRequiredProjects_(rows,scope){
  const diagnostics=summarizeDashboardProjects(rows);
  for(const project of safe(scope?.projects)){
    const info=diagnostics[project];
    if(!info||info.rows<=0)throw new Error(`ROP02_ATOMICO_INCOMPLETO: falta ${project}. Se conserva el último snapshot completo.`);
  }
  return diagnostics;
}

function validateHistoricalCoverage_(rows,year,scope){
  const distribution=historicalDashboardDistribution(rows);
  if(Number(year)!==2026)return distribution;

  // José María y Filo del Sol tienen histórico continuo durante 2026. Si alguno
  // forma parte del alcance, Febrero→Agosto no puede desaparecer sin que la carga
  // sea considerada parcial. Filo Sur y El Zorro tienen ventanas más acotadas.
  const continuous=safe(scope?.projects).some(project=>project==="JOSE MARIA"||project==="FILO DEL SOL");
  if(continuous){
    for(const period of ["2026-02","2026-03","2026-04","2026-05","2026-06","2026-07","2026-08"]){
      const item=distribution[period];
      if(!item||item.rows<20||item.hours<=0){
        throw new Error(`HISTORICO_INCOMPLETO: ${period} no contiene registros/horas suficientes. Se conserva el snapshot anterior.`);
      }
    }
  }
  return distribution;
}

export function validateDashboardSnapshotResponse(response,year,scope){
  if(!response?.ok||response?.action!=="dashboard_snapshot")throw new Error("El backend no devolvió un snapshot atómico del Dashboard.");
  const backendVersion=String(response?.backendVersion||"");
  if(!backendVersion.includes(DASHBOARD_SNAPSHOT_BACKEND_MARK))throw new Error(`BACKEND_DESACTUALIZADO: ${backendVersion||"sin versión"}.`);
  if(!Array.isArray(response?.rop02)||!Array.isArray(response?.rma15))throw new Error("El snapshot llegó sin ROP02/RMA15 completos.");

  const scopedRop02=applyDashboardScope(response.rop02,scope);
  const scopedRma15=applyDashboardScope(response.rma15,scope);
  const projectStats=validateRequiredProjects_(scopedRop02,scope);
  const distribution=validateHistoricalCoverage_(scopedRop02,year,scope);

  // Cuando el backend informa estadística por fuente, la usamos como segunda
  // barrera. Una fuente requerida con 0 filas invalida toda la transacción.
  const sourceStats=response?.stats?.rop02Fuentes||{};
  for(const source of safe(scope?.requiredSources)){
    if(!Object.prototype.hasOwnProperty.call(sourceStats,source))continue;
    const count=sourceRows_(sourceStats[source]);
    if(count!==null&&count<=0)throw new Error(`ROP02_ATOMICO_INCOMPLETO: ${source} respondió vacío. Se conserva el snapshot anterior.`);
  }

  if(Number(year)===2026&&scope?.global&&scopedRop02.length<5000){
    throw new Error(`ROP02 incompleto: ${scopedRop02.length} registros para el alcance global.`);
  }

  const needsRma=safe(scope?.projects).some(project=>project==="JOSE MARIA"||project==="FILO DEL SOL");
  if(needsRma&&scopedRma15.length===0)throw new Error("RMA15 incompleto para el alcance seleccionado. Se conserva el snapshot anterior.");
  if(Number(year)===2026&&scope?.global&&scopedRma15.length<1000)throw new Error(`RMA15 incompleto: ${scopedRma15.length} registros.`);
  if(Number(response?.stats?.rma15ConCodigos||0)>0&&Number(response?.stats?.rma15Valorizados||0)<=0){
    throw new Error("RMA15 tiene insumos pero el snapshot no contiene costos valorizados.");
  }

  return{
    rop02:scopedRop02,
    rma15:scopedRma15,
    projectStats,
    distribution,
    coverage:response?.coverage||null,
    stats:response?.stats||null,
    backendVersion,
  };
}

export function validateCachedDashboardSnapshot(value,year,scope){
  if(!value?.ok)return null;
  if(Number(value.cacheVersion)!==DASHBOARD_SNAPSHOT_CACHE_VERSION)return null;
  if(Number(value.year)!==Number(year))return null;
  if(String(value.scopeKey||"")!==String(scope?.scopeKey||""))return null;
  if(!Array.isArray(value.rop02)||!Array.isArray(value.rma15))return null;
  try{
    const projectStats=validateRequiredProjects_(value.rop02,scope);
    const distribution=validateHistoricalCoverage_(value.rop02,year,scope);
    return{...value,projectStats,distribution};
  }catch(_){return null;}
}
