import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOperatorEquipmentSummary,
  buildOperatorProfile,
  buildOperatorSummary,
  filterOperatorActivity,
  gestionHumanaMatchTipoMaquina,
  gestionHumanaTipoMaquinaOptions,
  gestionHumanaVehicleType,
  isOperatingRecord,
  latestOperatorEquipmentRows,
  operatorIdentityKey,
  operatorShiftCode,
  titleCaseDisplay,
} from "../src/modules/gestion-humana/gestionHumanaData.js";

const rows=[
  {fecha:"2026-10-03",maquina:"MOT-001",operario:"Juan Pérez",supervisor:"Supervisor A",proyecto:"FILO DEL SOL",turno:"TD",parte:"100",horas:8,estado:"TRABAJO",_excluded:false,_tipo:"MOTONIVELADORA"},
  {fecha:"2026-10-03",maquina:"MOT-001",operario:"Juan Pérez",supervisor:"Supervisor A",proyecto:"FILO DEL SOL",turno:"TN",parte:"101",horas:7,estado:"TRABAJO",_excluded:false,_tipo:"MOTONIVELADORA"},
  {fecha:"2026-10-04",maquina:"MOT-001",operario:"Juan Pérez",supervisor:"Supervisor B",proyecto:"FILO DEL SOL",turno:"TD",parte:"102",horas:9,estado:"TRABAJO",_excluded:false,_tipo:"MOTONIVELADORA"},
  {fecha:"2026-10-04",maquina:"EXC-002",operario:"María López",supervisor:"Supervisor B",proyecto:"JOSE MARIA",turno:"Turno Noche",parte:"88",horas:6,estado:"TRABAJO",_excluded:false,_tipo:"EXCAVADORA"},
  {fecha:"2026-10-04",maquina:"CTA-001",operario:"Chofer Uno",supervisor:"Supervisor B",proyecto:"JOSE MARIA",turno:"TD",parte:"1",horas:5,estado:"TRABAJO",_excluded:true,_tipo:"CAMIONETA"},
  {fecha:"2026-10-04",maquina:"MOT-003",operario:"Operador OD",supervisor:"Supervisor B",proyecto:"JOSE MARIA",turno:"TD",parte:"2",horas:0,estado:"OD",_excluded:false,_tipo:"MOTONIVELADORA"},
];

test("normaliza identidad sin fusionar por coincidencia parcial",()=>{
  assert.equal(operatorIdentityKey("  Juan   Pérez "),"JUAN PEREZ");
  assert.notEqual(operatorIdentityKey("Juan Pérez"),operatorIdentityKey("Juan Pérez Soto"));
});

test("normaliza TD/TN",()=>{
  assert.equal(operatorShiftCode("Turno Noche"),"TN");
  assert.equal(operatorShiftCode("TN"),"TN");
  assert.equal(operatorShiftCode("Turno Día"),"TD");
});

test("operadores en sitio toma el registro más reciente y TN gana a TD el mismo día",()=>{
  const dayRows=filterOperatorActivity(rows,{mode:"dia",fecha:"2026-10-03"});
  const latest=latestOperatorEquipmentRows(dayRows,{useLatestDateWhenUnbounded:false});
  assert.equal(latest.length,1);
  assert.equal(latest[0].parte,"101");
  assert.equal(operatorShiftCode(latest[0].turno),"TN");
});

test("sin rango explícito operadores en sitio incluye camionetas y usa la última fecha disponible",()=>{
  const latest=latestOperatorEquipmentRows(rows);
  assert.equal(latest.length,3);
  assert.ok(latest.every(row=>row.fecha==="2026-10-04"));
  assert.deepEqual(latest.map(row=>row.operario).sort(),["Juan Pérez","María López","Chofer Uno"].sort());
});

test("historial filtra operador y período sin incluir estados no operativos ni excluidos",()=>{
  const filtered=filterOperatorActivity(rows,{
    mode:"periodo",fechaD:"2026-10-03",fechaH:"2026-10-04",
    operario:"Juan Pérez",
  });
  assert.equal(filtered.length,3);
  assert.ok(filtered.every(row=>row.operario==="Juan Pérez"));
});

test("resumen incluye vehículos operativos al sumar horas, días, equipos, proyectos y registros",()=>{
  const summary=buildOperatorSummary(rows);
  assert.equal(summary.hours,35);
  assert.equal(summary.days,2);
  assert.equal(summary.machines,3);
  assert.equal(summary.projects,2);
  assert.equal(summary.records,5);
});

test("resumen por equipo ordena por horas y conserva última fecha",()=>{
  const summary=buildOperatorEquipmentSummary(rows);
  assert.equal(summary[0].maquina,"MOT-001");
  assert.equal(summary[0].horas,24);
  assert.equal(summary[0].dias,2);
  assert.equal(summary[0].ultimaFecha,"2026-10-04");
});


test("ficha del operador conserva última actividad y resumen del período",()=>{
  const enriched=rows.filter(row=>row.operario==="Juan Pérez").map(row=>({
    ...row,
    tipoEquipo:row._tipo,
    sitio:row.fecha==="2026-10-04"?"JOSE MARIA LA BREA":"FILO CAMPAMENTO",
  }));
  const profile=buildOperatorProfile(enriched);
  assert.equal(profile.operario,"Juan Pérez");
  assert.equal(profile.hours,24);
  assert.equal(profile.days,2);
  assert.equal(profile.currentMachine,"MOT-001");
  assert.equal(profile.currentSite,"JOSE MARIA LA BREA");
  assert.equal(profile.latestDate,"2026-10-04");
  assert.equal(profile.equipment[0].sitio,"JOSE MARIA LA BREA");
});


test("selector singular de operador filtra sólo la persona elegida con matchMulti de UI",()=>{
  const uiMatchMulti=(item,value,def="todos")=>{
    if(!Array.isArray(value))return true;
    return value.includes(item)||value.includes(def);
  };
  const selected="Juan Pérez";
  const filtered=filterOperatorActivity(rows,{
    mode:"periodo",
    operario:[selected],
    matchMulti:uiMatchMulti,
  });
  assert.equal(filtered.length,3);
  assert.ok(filtered.every(row=>row.operario===selected));
});


test("normaliza nombres y tipos para presentación sin alterar códigos de equipo",()=>{
  assert.equal(titleCaseDisplay("PIERSANTINI GASTON"),"Piersantini Gaston");
  assert.equal(titleCaseDisplay("GODOY JORGE ELIAZAR"),"Godoy Jorge Eliazar");
  assert.equal(titleCaseDisplay("CARGADOR FRONTAL"),"Cargador Frontal");
  assert.equal(titleCaseDisplay("MOTONIVELADORA"),"Motoniveladora");
  assert.equal(titleCaseDisplay("PCA-0101"),"PCA-0101");
  assert.equal(titleCaseDisplay("mot-0047"),"MOT-0047");
});


test("Gestión Humana incluye camionetas y camiones aunque ROP02 los marque _excluded",()=>{
  const camioneta={fecha:"2026-10-04",maquina:"CTA-0848",operario:"Chofer Pickup",proyecto:"JOSE MARIA",turno:"TD",horas:8,estado:"TRABAJO",_excluded:true,_tipo:"CAMIONETA"};
  const camion={fecha:"2026-10-04",maquina:"CAR-0101",operario:"Chofer Camion",proyecto:"JOSE MARIA",turno:"TD",horas:9,estado:"TRABAJO",_excluded:true,_tipo:"CAMION REGADOR"};
  assert.equal(gestionHumanaVehicleType(camioneta),"CAMIONETAS");
  assert.equal(gestionHumanaVehicleType(camion),"CAMIONES");
  assert.equal(isOperatingRecord(camioneta),true);
  assert.equal(isOperatingRecord(camion),true);
  const filtered=filterOperatorActivity([camioneta,camion],{mode:"periodo"});
  assert.equal(filtered.length,2);
});

test("Gestión Humana conserva excluido CAA-0002",()=>{
  const row={fecha:"2026-10-04",maquina:"CAA-0002",operario:"Operador",proyecto:"JOSE MARIA",turno:"TD",horas:8,estado:"TRABAJO",_excluded:true};
  assert.equal(gestionHumanaVehicleType(row),"");
  assert.equal(isOperatingRecord(row),false);
});

test("filtro Tipo de Máquina ofrece y reconoce Camiones y Camionetas",()=>{
  const opts=gestionHumanaTipoMaquinaOptions([{value:"todas",label:"Todas"}]);
  assert.ok(opts.some(x=>x.value==="CAMIONES"));
  assert.ok(opts.some(x=>x.value==="CAMIONETAS"));
  assert.equal(gestionHumanaMatchTipoMaquina("CTA-0848",["CAMIONETAS"]),true);
  assert.equal(gestionHumanaMatchTipoMaquina("CAR-0101",["CAMIONES"]),true);
  assert.equal(gestionHumanaMatchTipoMaquina("MOT-0047",["CAMIONES"]),false);
});
