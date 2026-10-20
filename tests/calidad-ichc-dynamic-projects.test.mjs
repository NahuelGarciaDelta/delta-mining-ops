import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {registerRop02Source,ROP02_SOURCES} from "../src/config/rop02Sources.js";
import {qualityProjectsFromSources,selectedQualityProject,qualityPeriodMode,qualityMonthPeriod,qualityRowsForProject} from "../src/modules/oficina-tecnica/chcQualityProjects.js";

const projects=()=>qualityProjectsFromSources(ROP02_SOURCES,[]);
test("Calidad muestra JM, FDS, Filo Sur, El Zorro y El Fierro por separado aunque estén vacíos",()=>{
 const names=projects().map(x=>x.project);
 for(const name of ["JOSE MARIA","FILO DEL SOL","FILO SUR","EL ZORRO","EL FIERRO"])
   assert.equal(names.filter(x=>x===name).length,1,name);
 assert.equal(names.length,5);
 assert.ok(!names.includes("JOSE MARIA / FILO DEL SOL"));
});
test("un proyecto nuevo registrado en catálogo genera una pestaña sin deploy adicional",()=>{
 assert.equal(registerRop02Source({dataset:"rop02_nuevo_frente",project:"NUEVO FRENTE"}),true);
 let q=projects();
 assert.equal(q.some(p=>p.project==="NUEVO FRENTE"&&p.label==="Nuevo Frente"),true);
 assert.equal(registerRop02Source({dataset:"rop02_nuevo_frente",project:"NUEVO FRENTE"}),false);
 assert.equal(projects().filter(p=>p.project==="NUEVO FRENTE").length,1);
});
test("proyectos observados también aparecen sin reemplazar el catálogo",()=>{
 const list=qualityProjectsFromSources(ROP02_SOURCES,[{proyecto:"OTRO FRENTE"},{proyecto:"FDS"},{proyecto:"OTRO FRENTE"}]);
 assert.equal(list.filter(p=>p.project==="OTRO FRENTE").length,1);
 assert.equal(list.filter(p=>p.project==="FILO DEL SOL").length,1);
});
test("conserva la selección de proyecto y migra las preferencias anteriores",()=>{
 const list=projects();
 assert.equal(selectedQualityProject({chcProject:"EL FIERRO"},list),"EL FIERRO");
 assert.equal(selectedQualityProject({chcTab:"filosur"},list),"FILO SUR");
 assert.equal(selectedQualityProject({chcTab:"zorro"},list),"EL ZORRO");
 assert.equal(selectedQualityProject({chcTab:"principal",proyecto:"FDS"},list),"FILO DEL SOL");
 assert.equal(selectedQualityProject({chcTab:"principal",proyecto:"JM"},list),"JOSE MARIA");
 assert.equal(selectedQualityProject({chcProject:"NO EXISTE"},list),list[0].project);
});
test("períodos históricos: JM y FDS 26–25; Filo Sur y Zorro calendario; nuevo 26–25",()=>{
 const monthly=qualityMonthPeriod("FILO SUR","2026",9);
 assert.deepEqual(monthly,{fechaD:"2026-10-01",fechaH:"2026-10-31",diasPeriodo:31,mode:"calendar"});
 assert.deepEqual(qualityMonthPeriod("EL ZORRO","2026",1),{fechaD:"2026-02-01",fechaH:"2026-02-28",diasPeriodo:28,mode:"calendar"});
 for(const name of ["JOSE MARIA","FILO DEL SOL","EL FIERRO","NUEVO FRENTE"]){
   assert.deepEqual(qualityMonthPeriod(name,"2026",9),{fechaD:"2026-09-26",fechaH:"2026-10-25",diasPeriodo:30,mode:"contract"});
 }
 assert.deepEqual(qualityMonthPeriod("JOSE MARIA",2026,0),{fechaD:"2025-12-26",fechaH:"2026-01-25",diasPeriodo:31,mode:"contract"});
 assert.equal(qualityPeriodMode("PROYECTO NUEVO"),"contract");
 assert.throws(()=>qualityMonthPeriod("JOSE MARIA",2026,12),RangeError);
});
test("no mezcla filas del mismo equipo entre proyectos, ni incluye excluidos o fuera de fecha",()=>{
 const rows=[
   {proyecto:"JOSE MARIA",fecha:"2026-10-13",maquina:"TOP-0001",horas:9},
   {proyecto:"FILO DEL SOL",fecha:"2026-10-13",maquina:"TOP-0001",horas:8},
   {proyecto:"EL FIERRO",fecha:"2026-10-13",maquina:"TOP-0001",horas:7},
   {proyecto:"JM",fecha:"2026-10-12",maquina:"TOP-0002",horas:6},
   {proyecto:"JOSE MARIA",fecha:"2026-09-20",maquina:"TOP-0003",horas:5},
   {proyecto:"JOSE MARIA",fecha:"2026-10-14",maquina:"TOP-0004",horas:4,_excluded:true}
 ];
 assert.deepEqual(qualityRowsForProject(rows,"JOSE MARIA","2026-09-26","2026-10-25").map(x=>x.horas),[9,6]);
 assert.deepEqual(qualityRowsForProject(rows,"FILO DEL SOL","2026-09-26","2026-10-25").map(x=>x.horas),[8]);
 assert.deepEqual(qualityRowsForProject(rows,"EL FIERRO","2026-09-26","2026-10-25").map(x=>x.horas),[7]);
 assert.deepEqual(qualityRowsForProject(rows,"PROYECTO VACIO","2026-09-26","2026-10-25"),[]);
});
test("Calidad presenta cada proyecto sin pestañas fijas ni selector agrupado",()=>{
 const src=readFileSync(new URL("../src/modules/oficina-tecnica/OficinaTecnicaModule.jsx",import.meta.url),"utf8");
 const start=src.indexOf("function ViewCHC({rop02All,extState,setExtState})");
 const end=src.indexOf("function TallerCentralSummary(",start);
 assert.ok(start>0&&end>start);
 const view=src.slice(start,end);
 assert.match(view,/proyectosDisponibles\.map\(\(\{project,label\}\)=>/);
 assert.match(view,/qualityRowsForProject\(rop02All,proyectoActual,fechaD,fechaH\)/);
 assert.match(view,/qualityMonthPeriod\(proyectoActual,añoSelec,mesIdx\)/);
 assert.match(view,/generarExcelICHC\(rows,totales,label\)/);
 assert.match(view,/Sin partes ROP02 para/);
 assert.ok(!view.includes("José María / Filo del Sol"));
 assert.ok(!view.includes("chcTab==="));
 assert.ok(!view.includes("matchMulti(r.proyecto,proyecto"));
});
