import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateAtrasoRop02,
  calculateHomeAvailabilityFromRop02,
  calculateOpenOtItems,
  currentAtrasoJustificationForEquipment,
  getBajoSanJuanExclusionMap,
  getMaxRop02Date,
  isBajoSanJuanJustification,
} from "../src/modules/home/homeAvailability.js";

const row=(maquina,fecha,horas,estado="TRABAJO")=>({maquina,fecha,horas,estado});

test("sin ROP02 devuelve colecciones completas y seguras para el primer render",()=>{
  const result=calculateHomeAvailabilityFromRop02(undefined,undefined);
  assert.deepEqual(result.items,[]);
  assert.deepEqual(result.fsItems,[]);
  assert.equal(result.disponibles,0);
  assert.equal(result.noDisponibles,0);
  assert.equal(result.disponibilidad,null);
});

test("disponibilidad usa la fecha maxima ROP02 como referencia y no el dia actual",()=>{
  const result=calculateHomeAvailabilityFromRop02([
    row("EXC-0001","2026-08-10",8),
    row("EXC-0002","2026-08-11",0,"OD"),
  ]);
  assert.equal(getMaxRop02Date([row("EXC-0001","2026-08-10",8),row("EXC-0002","2026-08-11",0,"OD")]),"2026-08-11");
  assert.equal(result.fechaMaximaROP02,"2026-08-11");
  assert.equal(result.ventanaDesde,"2026-08-05");
  assert.equal(result.ventanaHasta,"2026-08-11");
});

test("horas positivas y OD cuentan como disponibles, FS como no disponible",()=>{
  const result=calculateHomeAvailabilityFromRop02([
    row("EXC-0001","2026-08-10",8,"FS"),
    row("EXC-0002","2026-08-10",0,"OD"),
    row("EXC-0003","2026-08-10",0,"FS"),
  ]);
  assert.equal(result.elegiblesDespuesExclusiones,3);
  assert.equal(result.disponibles,2);
  assert.equal(result.noDisponibles,1);
  assert.equal(result.items.length,3);
  assert.equal(result.fsItems.length,1);
  assert.equal(result.fsItems[0].interno,"EXC-0003");
  assert.equal(result.disponibilidad,67);
});

test("equipos sin registro dentro de la ventana de 7 dias no participan",()=>{
  const result=calculateHomeAvailabilityFromRop02([
    row("EXC-0001","2026-08-11",8),
    row("EXC-0002","2026-08-04",0,"FS"),
  ]);
  assert.equal(result.elegiblesAntesExclusiones,1);
  assert.equal(result.disponibles,1);
  assert.equal(result.noDisponibles,0);
});

test("la justificacion vigente Bajo a San Juan excluye del numerador y denominador",()=>{
  const admitidos={
    "atrasado_EXC-0001_2026-08-10":{causa:"Bajó a San Juan"},
  };
  const result=calculateHomeAvailabilityFromRop02([
    row("EXC-0001","2026-08-10",0,"FS"),
    row("EXC-0002","2026-08-10",8),
  ],admitidos);
  assert.equal(result.elegiblesAntesExclusiones,2);
  assert.equal(result.excluidosBajoSanJuan,1);
  assert.equal(result.elegiblesDespuesExclusiones,1);
  assert.deepEqual(result.fsItems,[]);
  assert.equal(result.items.some(item=>item.interno==="EXC-0001"),false);
  assert.equal(result.disponibilidad,100);
  assert.equal(isBajoSanJuanJustification("BAJO A SAN JUAN"),true);
  assert.equal(isBajoSanJuanJustification("bajó a san juan"),true);
  assert.equal(isBajoSanJuanJustification("bajo san juan"),false);
});

test("una justificacion vieja no excluye si el equipo tiene ROP02 normal posterior",()=>{
  const admitidos={
    "atrasado_EXC-0001_2026-08-08":{causa:"Bajo a San Juan"},
  };
  const result=calculateHomeAvailabilityFromRop02([
    row("EXC-0001","2026-08-10",8),
  ],admitidos);
  assert.equal(currentAtrasoJustificationForEquipment(admitidos,"EXC-0001","2026-08-10"),"");
  assert.equal(result.excluidosBajoSanJuan,0);
  assert.equal(result.elegiblesDespuesExclusiones,1);
  assert.equal(result.disponibilidad,100);
});

test("un equipo con TD/TN el mismo dia no se duplica y horas positivas dominan",()=>{
  const result=calculateHomeAvailabilityFromRop02([
    row("RPC-0016-JM","2026-08-10",0,"FS"),
    row("RPC-0016","2026-08-10",4,"TRABAJO"),
  ]);
  assert.equal(result.elegiblesAntesExclusiones,1);
  assert.equal(result.disponibles,1);
  assert.equal(result.disponibilidad,100);
});

test("TOP-0036 y PCA-0021 siguen visibles como atrasados aunque no cargaron en los ultimos 7 dias",()=>{
  const result=calculateAtrasoRop02([
    row("TOP-0036-JM","2026-08-01",8),
    row("PCA-0021","2026-07-30",8),
    row("EXC-0001","2026-08-11",8),
  ],{}, {normalizeEquipmentCode:code=>String(code).replace(/-JM$/i,"")});
  assert.equal(result.fechaMaximaROP02,"2026-08-11");
  assert.deepEqual(result.atrasados.map(item=>item.codigo).sort(),["PCA-0021","TOP-0036"]);
  assert.equal(result.atrasados.find(item=>item.codigo==="TOP-0036").diasSinCarga,10);
  assert.equal(result.atrasados.find(item=>item.codigo==="TOP-0036").diasConCarga,0);
});

test("Atraso separa equipo y proyecto y conserva supervisor y ventana del origen",()=>{
  const result=calculateAtrasoRop02([
    {...row("TOP-0072","2026-07-18",8),proyecto:"EL ZORRO",supervisor:"Supervisor Zorro"},
    {...row("TOP-0072","2026-08-11",8),proyecto:"FDS",supervisor:"Supervisor FDS"},
  ]);
  assert.equal(result.atrasados.length,1);
  assert.equal(result.atrasados[0].codigo,"TOP-0072");
  assert.equal(result.atrasados[0].proyecto,"EL ZORRO");
  assert.equal(result.atrasados[0].ultimaCarga,"2026-07-18");
  assert.equal(result.atrasados[0].diasConCarga,0);
  assert.equal(result.atrasados[0].supervisor,"Supervisor Zorro");
  assert.equal(result.recordsByEquipmentProject.has("TOP-0072|FILO DEL SOL"),true);
});

test("Atraso no inventa equipos sin historial y conserva los justificados como aceptados",()=>{
  const admitidos={
    "atrasado_PCA-0021_2026-07-30":{admitido:true,causa:"Bajó a San Juan",fechaAdmitido:"2026-08-11T12:00:00.000Z"},
  };
  const result=calculateAtrasoRop02([
    row("PCA-0021","2026-07-30",8),
    row("EXC-0001","2026-08-11",8),
  ],admitidos);
  assert.equal(result.atrasados.some(item=>item.codigo==="SIN-HISTORIAL"),false);
  assert.equal(result.atrasados.find(item=>item.codigo==="PCA-0021")?.admitido,true);
});

test("Bajo a San Juan vigente excluye OT y una carga posterior reactiva el equipo",()=>{
  const admitidos={
    "atrasado_TOP-0036_2026-08-01":{admitido:true,causa:"BAJO A SAN JUAN",fechaAdmitido:"2026-08-11T12:00:00.000Z"},
  };
  const otRecords=[
    {interno:"TOP-0036",time:1,index:0,noOperativo:true,fechaISO:"2026-08-02",lugar:"JOSE MARIA",ot:"OT-1",estado:"No"},
    {interno:"PCA-0021",time:1,index:1,noOperativo:true,fechaISO:"2026-08-03",lugar:"JOSE MARIA",ot:"OT-2",estado:"No"},
  ];
  const vigente=getBajoSanJuanExclusionMap(admitidos,new Map([["TOP-0036","2026-08-01"],["PCA-0021","2026-07-30"]]));
  const items=calculateOpenOtItems(otRecords,vigente);
  assert.equal(items.length,1);
  assert.deepEqual(items.map(item=>item.interno),["PCA-0021"]);
  assert.equal(items.length,items.filter(Boolean).length);

  const reactivado=getBajoSanJuanExclusionMap(admitidos,new Map([["TOP-0036","2026-08-12"]]));
  assert.equal(reactivado.has("TOP-0036"),false);
  assert.equal(calculateOpenOtItems(otRecords,reactivado).some(item=>item.interno==="TOP-0036"),true);
});
