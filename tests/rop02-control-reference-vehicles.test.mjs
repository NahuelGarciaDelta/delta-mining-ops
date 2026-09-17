import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  rop02ControlTurnoKey,
  rop02ControlTurnoOrder,
  rop02ControlVehicleKind,
  rop02ControlRowEligible,
  rop02ControlTipoOptions,
  rop02ControlTipoMatches,
} from "../src/modules/oficina-tecnica/rop02ControlRules.js";
import { patchRop02ControlReferenceAndVehicles } from "../scripts/rop02-control-last-shift-vehicles-vite-plugin.mjs";

test("Control ROP02 toma TN como último turno del día cuando existe",()=>{
  const rows=[
    {fecha:"2026-09-15",turno:"TD",parte:"21",horometroInicial:1526,horometroFinal:1533},
    {fecha:"2026-09-15",turno:"TN",parte:"22",horometroInicial:1533,horometroFinal:1538},
  ];
  const day={TD:null,TN:null};
  for(const row of rows)day[rop02ControlTurnoKey(row.turno)]=row;
  const referencia=day.TN||day.TD;

  assert.equal(referencia.turno,"TN");
  assert.equal(referencia.parte,"22");
  assert.equal(referencia.horometroFinal,1538);
  assert.equal(Number(referencia.parte)+1,23);
  assert.equal(rop02ControlTurnoOrder("TN"),1);
  assert.equal(rop02ControlTurnoOrder("Turno Noche"),1);
  assert.equal(rop02ControlTurnoOrder("TD"),0);
});

test("Control ROP02 usa TD cuando el día no tiene TN",()=>{
  const td={fecha:"2026-09-15",turno:"TD",parte:"21",horometroFinal:1533};
  const day={TD:td,TN:null};
  assert.equal((day.TN||day.TD).parte,"21");
  assert.equal((day.TN||day.TD).horometroFinal,1533);
});

test("camionetas y camiones excluidos de productividad siguen siendo elegibles en Control ROP02",()=>{
  assert.equal(rop02ControlVehicleKind("CTA-0848"),"CAMIONETA");
  assert.equal(rop02ControlVehicleKind("AH045UV"),"CAMIONETA");
  assert.equal(rop02ControlVehicleKind("CAV-0078"),"CAMION");
  assert.equal(rop02ControlVehicleKind("CAR-0101"),"CAMION");
  assert.equal(rop02ControlVehicleKind("CAA-0002"),"CAMION");
  assert.equal(rop02ControlVehicleKind("AG816QB"),"CAMION");

  assert.equal(rop02ControlRowEligible({_excluded:true,maquina:"CTA-0848"}),true);
  assert.equal(rop02ControlRowEligible({_excluded:true,maquina:"CAV-0078"}),true);
  assert.equal(rop02ControlRowEligible({_excluded:true,maquina:"CAA-0002"}),true);
  assert.equal(rop02ControlRowEligible({_excluded:true,maquina:"GENERADOR"}),false);
  assert.equal(rop02ControlRowEligible({_excluded:false,maquina:"PCA-0117"}),true);
});

test("el filtro Tipo de Máquina ofrece Camionetas y Camiones sólo en este control",()=>{
  const base=[{value:"todas",label:"Todas"},{value:"PCA",label:"Cargadora Frontal"}];
  const options=rop02ControlTipoOptions(base);
  assert.ok(options.some(option=>option.value==="CAMIONETA"));
  assert.ok(options.some(option=>option.value==="CAMION"));

  const baseMatcher=(maquina,seleccion)=>seleccion==="PCA"&&String(maquina).startsWith("PCA");
  assert.equal(rop02ControlTipoMatches("CTA-0848","CAMIONETA",baseMatcher),true);
  assert.equal(rop02ControlTipoMatches("CAV-0078","CAMION",baseMatcher),true);
  assert.equal(rop02ControlTipoMatches("CAA-0002","CAMION",baseMatcher),true);
  assert.equal(rop02ControlTipoMatches("PCA-0117","PCA",baseMatcher),true);
  assert.equal(rop02ControlTipoMatches("PCA-0117","CAMION",baseMatcher),false);
});

test("el parche del build reemplaza la clasificación antigua y amplía sólo Control ROP02",async()=>{
  const source=await readFile(new URL("../src/modules/oficina-tecnica/OficinaTecnicaModule.jsx",import.meta.url),"utf8");
  const patched=patchRop02ControlReferenceAndVehicles(source);

  assert.ok(patched.includes('const turnoKey=rop02ControlTurnoKey(r.turno);'));
  assert.ok(patched.includes('const turnoOrden=r=>rop02ControlTurnoOrder(r?.turno);'));
  assert.ok(patched.includes('rop02All.filter(r=>(typeof isRop02HourlyEquipment==="function"&&isRop02HourlyEquipment(r))||rop02ControlRowEligible(r))'));
  assert.ok(patched.includes('options={rop02ControlTipoOptions(dmTipoMaquinaOptions())}'));
  assert.ok(patched.includes('rop02ControlTipoMatches(row.maquina,tipoMaquina,dmMatchTipoMaquinaSeleccion)'));
});
