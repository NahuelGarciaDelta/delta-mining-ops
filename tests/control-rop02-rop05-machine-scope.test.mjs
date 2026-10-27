import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  availableControlMachines,filterControlMachines,noControlMachinesSelected,
  calculateControlIssueRows
} from "../src/modules/oficina-tecnica/controlMachineScope.js";
import {filterControlProjects} from "../src/modules/oficina-tecnica/controlProjectScope.js";

const canon=x=>({"CFN-0041":"PCA-0081"}[x]||x);
const rop02=[
  {proyecto:"JOSE MARIA",maquina:"EXC-0001",fecha:"2026-10-26",supervisor:"A"},
  {proyecto:"FILO SUR",maquina:"CFN-0041",fecha:"2026-10-26",supervisor:"B"}
];
const rop05=[
  {proyecto:"JM",maquina:"EXC-0001",fecha:"2026-10-26",supervisor:"X"},
  {proyecto:"FILO SUR",maquina:"TOP-0002",fecha:"2026-10-26",supervisor:"Y"}
];
const deps={
  normDate:x=>String(x||"").slice(0,10),
  machineLookupVariants:x=>[String(x||"")],
  cleanMachine:x=>x,
  matchMulti:(v,selected)=>selected==="todos"||selected.includes(v),
  multiIsAll:v=>v==="todos"
};

test("las máquinas se enumeran desde ambas fuentes y sus alias canónicos",()=>{
  assert.deepEqual(availableControlMachines(rop02,rop05,canon),["EXC-0001","PCA-0081","TOP-0002"]);
});
test("la configuración aplica proyectos y máquinas a ambos lados y es reversible",()=>{
  const left=filterControlMachines(filterControlProjects(rop02,["FILO SUR"]),["PCA-0081"],canon);
  const right=filterControlMachines(filterControlProjects(rop05,["FILO SUR"]),["PCA-0081"],canon);
  assert.equal(left.length,1);
  assert.equal(right.length,0);
  assert.equal(left[0].maquina,"CFN-0041");
  assert.equal(rop02.length,2);
  assert.equal(rop05.length,2);
  assert.equal(filterControlMachines(rop02,"todos",canon),rop02);
});
test("ningún equipo seleccionado no equivale a todos",()=>{
  assert.deepEqual(filterControlMachines(rop02,[],canon),[]);
  assert.equal(noControlMachinesSelected([]),true);
  assert.equal(noControlMachinesSelected("todos"),false);
});
test("el cruce no compara el supervisor para decidir la contraparte",()=>{
  const issues=calculateControlIssueRows([rop02[0]],[rop05[0]],"todos",deps);
  assert.equal(issues.problemas,0);
});
test("el cruce detecta faltantes en ambos sentidos",()=>{
  const issues=calculateControlIssueRows(rop02,rop05,"todos",deps);
  assert.equal(issues.problemas,2);
  assert.equal(issues.faltanEn05.length,1);
  assert.equal(issues.faltanEn02.length,1);
});
test("el filtro supervisor se aplica a las inconsistencias luego del cruce",()=>{
  const issues=calculateControlIssueRows(rop02,rop05,["B"],deps);
  assert.equal(issues.problemas,1);
});
test("el contador lateral usa el mismo alcance y el resultado de la vista abierta",()=>{
  const app=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
  const view=readFileSync(new URL("../src/modules/oficina-tecnica/OficinaTecnicaModule.jsx",import.meta.url),"utf8");
  assert.match(app,/const controlSidebarBadge=useMemo\(/);
  assert.match(app,/filterControlMachines\(filterControlProjects\(control\.productivos,projects\),machines/);
  assert.match(app,/filterControlMachines\(filterControlProjects\(control\.prod05,projects\),machines/);
  assert.match(app,/badge:badgeControlVisible>0\?badgeControlVisible:null/);
  assert.match(app,/onControlIssuesChange=\{setControlLiveIssues\}/);
  assert.match(view,/calculateControlIssueRows\(filtered02Match,filtered05Match/);
  assert.match(view,/label="Equipos a considerar"/);
  assert.match(view,/label="Proyectos a considerar"/);
});
