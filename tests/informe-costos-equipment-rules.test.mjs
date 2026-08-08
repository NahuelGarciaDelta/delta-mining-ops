import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalEquipmentCode,
  resolveEquipmentCodeAlias,
  isCompactorEquipmentCode,
  isCompactorEquipment,
  isExcludedFromMaintenanceCostReport,
  isMaintenanceCostMachine,
  isMaintenanceCostTruck,
  maintenanceCostTypeFromFamily,
} from "../src/modules/equipment/equipmentCode.js";
import {
  handleInformeCostosCommand,
  resetInformeCostosEngine,
} from "../src/modules/informe-costos/engine/InformeCostosEngine.js";
import fs from "node:fs";
import { buildVisibleCategoryRowSpans } from "../src/modules/informe-costos/utils/categoryRowSpan.js";
import { sumRoundedMonthlyTotals } from "../src/modules/informe-costos/utils/monthlyCostTotals.js";

test("CFN01010 y sus variantes quedan excluidos por la clave canónica", () => {
  ["CFN01010", "CFN-01010", "CFN 01010", "cfn-01010-jm"].forEach(code => {
    assert.equal(isExcludedFromMaintenanceCostReport(code), true, code);
  });
  assert.equal(isExcludedFromMaintenanceCostReport("CFN-01011"), false);
});

test("CFN0101 y sus variantes se resuelven globalmente como PCA0101", () => {
  ["CFN0101","CFN-0101","CFN 0101","cfn-0101-jm"].forEach(code=>{
    assert.equal(resolveEquipmentCodeAlias(code),"PCA-0101",code);
    assert.equal(isExcludedFromMaintenanceCostReport(code),false,code);
  });
  assert.equal(resolveEquipmentCodeAlias("PCA-0101"),"PCA-0101");
});

test("todos los internos históricos se consolidan en sus equipos actuales", () => {
  const aliases={
    "CFN-0041":"PCA-0081","CFN-0043":"PCA-0093","CFN-0044":"PCA-0095","CFN-0045":"PCA-0095",
    "EXC-0014":"EXC-0034","EXC-0019":"EXC-0048","MOT-0024":"MOT-0047",
    "RTP-0010":"RTP-0016","RTP-0012":"RTP-0024","TOP-0014":"TOP-0032","TOP-0059":"TOP-0058",
  };
  Object.entries(aliases).forEach(([oldCode,currentCode])=>{
    assert.equal(resolveEquipmentCodeAlias(oldCode),currentCode,oldCode);
    assert.equal(resolveEquipmentCodeAlias(`${oldCode}-JM`),currentCode,`${oldCode}-JM`);
  });
});

test("CAC0048 se reconoce como camión por código aunque el tipo esté incompleto", () => {
  ["CAC0048","CAC-0048","CAC 0048","CAC-0048-JM"].forEach(code=>
    assert.equal(isMaintenanceCostTruck({code,type:"OTROS"}),true,code));
});

test("Familia manda sobre el prefijo y CAT Generador no se clasifica como camión", () => {
  assert.equal(maintenanceCostTypeFromFamily({code:"CAT",family:"Generador"}),"OTROS");
  assert.equal(isMaintenanceCostTruck({code:"CAT",family:"Generador"}),false);
  assert.equal(isMaintenanceCostMachine({code:"CAT",family:"Generador"}),true);
  assert.equal(maintenanceCostTypeFromFamily({code:"CAT-0073",family:"Camión tractor"}),"CAMIONES");
  assert.equal(isMaintenanceCostTruck({code:"CAT-0073",family:"Camión tractor"}),true);
});

test("sólo CAMION como primera palabra de Familia corresponde a camión", () => {
  ["Camión regador","CAMION DE COMBUSTIBLE","camion tractor","Camión volcador"].forEach(familia=>{
    assert.equal(maintenanceCostTypeFromFamily({family:familia}),"CAMIONES",familia);
    assert.equal(isMaintenanceCostTruck({family:familia}),true,familia);
  });
  assert.equal(maintenanceCostTypeFromFamily({family:"Camioneta pickup"}),"CAMIONETAS");
  assert.equal(isMaintenanceCostTruck({family:"Camioneta pickup"}),false);
  assert.equal(isMaintenanceCostTruck({family:"Equipo camión auxiliar"}),false);
});

test("RPC y ROD se reconocen como rodillos y conservan la unificación -JM", () => {
  ["RPC-0001", "RPC0001", "RPC-0001-JM", "ROD-0001", "ROD0001", "ROD-0001-JM"]
    .forEach(code => assert.equal(isCompactorEquipmentCode(code), true, code));
  assert.equal(canonicalEquipmentCode("RPC-0001-JM"), canonicalEquipmentCode("RPC-0001"));
  assert.equal(canonicalEquipmentCode("ROD-0001-JM"), canonicalEquipmentCode("ROD-0001"));
});

test("todos los rodillos se clasifican centralmente como Máquinas y no como tipos incompatibles", () => {
  ["RPC-0001","RPC0001","RPC 0001","RPC-0001-JM","ROD-0001","ROD0001","ROD 0001","ROD-0001-JM"]
    .forEach(code=>assert.equal(isMaintenanceCostMachine({code}),true,code));
  ["RODILLO","RODILLO COMPACTADOR","COMPACTADOR","compactación"]
    .forEach(type=>assert.equal(isCompactorEquipment({type}),true,type));
  assert.equal(isMaintenanceCostMachine({type:"CAMION"}),false);
  assert.equal(isMaintenanceCostMachine({type:"CAMIONETA"}),false);
  assert.equal(isMaintenanceCostMachine({type:"EXCAVADORA"}),true);
});

test("el motor excluye CFN antes de totales e incluye RPC/ROD en Máquinas y mano de obra", () => {
  resetInformeCostosEngine();
  const dynamicMO = [
    { maquina:"RPC-0001", proyecto:"FILO DEL SOL", section:"FS", mes:"2026-05", costo:100 },
    { maquina:"RPC-0001", proyecto:"FILO DEL SOL", section:"FS", mes:"2026-05", costo:50 },
    { maquina:"ROD-0001-JM", proyecto:"JOSE MARIA", section:"JM", mes:"2026-05", costo:80 },
    { maquina:"CFN-01010", proyecto:"FILO DEL SOL", section:"FS", mes:"2026-05", costo:10000 },
  ];
  const meta = {
    "RPC-0001": {display:"RPC-0001", propiedad:"DELTA", tipo:"VIBROCOMPACTADOR"},
    "ROD-0001-JM": {display:"ROD-0001", propiedad:"DELTA", tipo:"COMPACTACION"},
    "CFN-01010": {display:"CFN-01010", propiedad:"DELTA", tipo:"CARGADORA FRONTAL"},
  };
  const init = handleInformeCostosCommand("INIT_COST_MONTHLY_ENGINE", {
    historicalRows:[], dynamicMonthly:dynamicMO, dynamicMO, meta,
  });
  assert.equal(init.counts.mo, 3);
  const result = handleInformeCostosCommand("QUERY_COST_MONTHLY", {
    months:[{key:"2026-05"}], monthsAccum:[{key:"2026-05"}], rates:{"2026-05":1}, baseRate:1,
    filters:{proyecto:"todos",propiedad:"todos",maquina:"todos",tipo:["MAQUINAS"]},
    filtersMO:{proyecto:"todos",propiedad:"todos",maquina:"todos",tipo:["MAQUINAS"]},
  });
  assert.deepEqual(result.monthlyMO.map(row=>row.equipo).sort(), ["ROD-0001","RPC-0001"]);
  assert.equal(result.monthlyMO.reduce((sum,row)=>sum+row.total,0), 230);

  const labor = handleInformeCostosCommand("PROCESS_MANO_OBRA", {
    monthlyRows:result.monthlyMO, months:[{key:"2026-05"}], subtotalFS:150, subtotalJM:80,
    equipmentMeta:{"RPC-0001":{propiedad:"DELTA"},"ROD-0001":{propiedad:"DELTA"}},
  });
  assert.equal(labor.rows.length, 2);
  assert.equal(new Set(labor.rows.map(row=>row.equipo)).size, 2);
  labor.rows.forEach(row => {
    assert.ok(row.manoObra > 0);
    assert.equal(row.total, row.mantenimiento + row.manoObra);
  });
  assert.equal(labor.rows.some(row=>canonicalEquipmentCode(row.equipo)==="CFN01010"), false);
});

test("una máquina vial no relacionada conserva su resultado", () => {
  const result = handleInformeCostosCommand("PROCESS_MANO_OBRA", {
    monthlyRows:[{equipo:"MOT-0001",section:"FS",months:{"2026-05":{total:40}}}],
    months:[{key:"2026-05"}], subtotalFS:20,
    equipmentMeta:{"MOT-0001":{propiedad:"DELTA"}},
  });
  assert.equal(result.rows[0].mantenimiento, 40);
  assert.equal(result.rows[0].manoObra, 20);
  assert.equal(result.rows[0].total, 60);
});

test("el Web Worker delega en el mismo motor probado por el cálculo principal", () => {
  const worker = fs.readFileSync(new URL("../src/workers/informeCostos.worker.js", import.meta.url), "utf8");
  assert.match(worker, /import\s*\{\s*handleInformeCostosCommand\s*\}\s*from\s*["']\.\.\/modules\/informe-costos\/engine\/InformeCostosEngine\.js["']/);
  assert.match(worker, /handleInformeCostosCommand\(type,payload\)/);
});

test("Promedio por tipo genera una sola celda con rowSpan sobre las filas visibles", () => {
  const rows = buildVisibleCategoryRowSpans([
    {equipo:"MCA-1",tipo:" Minicargadora ",promTipo:.09},
    {equipo:"MCA-2",tipo:"MINICARGADORA",promTipo:.09},
    {equipo:"MCA-3",tipo:"minicargadóra",promTipo:.09},
    {equipo:"RTP-1",tipo:"RETROPALA",promTipo:0},
  ]);
  assert.equal(rows.filter(row=>row._firstTipoDisplay).length, 2);
  assert.equal(rows[0]._grupoSizeDisplay, 3);
  assert.equal(rows[1]._grupoSizeDisplay, 0);
  assert.equal(rows[2]._grupoSizeDisplay, 0);
  assert.equal(rows[3]._grupoSizeDisplay, 1);
  assert.equal(rows[3].promTipo, 0);
  const filtered = buildVisibleCategoryRowSpans(rows.slice(1,3));
  assert.equal(filtered[0]._firstTipoDisplay, true);
  assert.equal(filtered[0]._grupoSizeDisplay, 2);
  const component = fs.readFileSync(new URL("../src/modules/analytics/CostosUnitariosView.jsx", import.meta.url), "utf8");
  assert.match(component, /x\._firstTipoDisplay&&<td rowSpan=\{x\._grupoSizeDisplay\|\|1\}/);
});

test("Mano de obra hace left join canónico desde Costo mensual acumulado", () => {
  const universeRows = [
    {equipo:"TOP0032",section:"FS",months:{"2026-05":{total:120}}},
    {equipo:"TOP-0032-JM",section:"FS",months:{"2026-05":{total:120}}},
    {equipo:"EXC-0001",section:"FS",months:{"2026-05":{total:50}}},
  ];
  const result = handleInformeCostosCommand("PROCESS_MANO_OBRA", {
    universeRows,
    monthlyRows:[
      {equipo:"EXC-0001",section:"FS",months:{"2026-05":{total:30}}},
      {equipo:"EXC0001-JM",section:"FS",months:{"2026-05":{total:20}}},
    ],
    months:[{key:"2026-05"}], subtotalFS:25,
    equipmentMeta:{"EXC-0001":{propiedad:"DELTA"},"TOP0032":{propiedad:"DELTA"}},
  });
  const equipmentKeys=result.rows.map(row=>canonicalEquipmentCode(row.equipo));
  assert.deepEqual(equipmentKeys.sort(),["EXC0001","TOP0032"]);
  assert.equal(new Set(equipmentKeys).size,equipmentKeys.length);
  assert.equal(result.rows.find(row=>canonicalEquipmentCode(row.equipo)==="EXC0001").mantenimiento,50);
  const top=result.rows.find(row=>canonicalEquipmentCode(row.equipo)==="TOP0032");
  assert.ok(top);
  assert.equal(top.mantenimiento,0);
  assert.equal(top.manoObra,0);
  assert.equal(top.total,0);
  assert.equal(result.rows.every(row=>result.sortedRows.includes(row)),true);
});

test("el motor reutiliza consultas idénticas e invalida caché al cambiar fuentes", () => {
  resetInformeCostosEngine();
  const payload={
    historicalRows:[],
    dynamicMonthly:[{maquina:"RPC 0001",proyecto:"FILO DEL SOL",mes:"2026-06",costo:75}],
    dynamicMO:[],
    meta:{"RPC-0001":{display:"RPC-0001",propiedad:"DELTA",tipo:"RODILLO COMPACTADOR"}},
  };
  handleInformeCostosCommand("INIT_COST_MONTHLY_ENGINE",payload);
  const query={months:[{key:"2026-06"}],monthsAccum:[{key:"2026-06"}],rates:{"2026-06":1},baseRate:1,filters:{tipo:["MAQUINAS"]},filtersMO:{tipo:["MAQUINAS"]}};
  const first=handleInformeCostosCommand("QUERY_COST_MONTHLY",query);
  const cached=handleInformeCostosCommand("QUERY_COST_MONTHLY",query);
  assert.equal(cached,first);
  assert.deepEqual(first.monthly.map(row=>row.equipo),["RPC-0001"]);
  const incompatible=handleInformeCostosCommand("QUERY_COST_MONTHLY",{...query,filters:{tipo:["CAMIONES"]}});
  assert.equal(incompatible.monthly.length,0);
  handleInformeCostosCommand("INIT_COST_MONTHLY_ENGINE",{...payload,dynamicMonthly:[]});
  const afterInvalidation=handleInformeCostosCommand("QUERY_COST_MONTHLY",query);
  assert.notEqual(afterInvalidation,first);
  assert.equal(afterInvalidation.monthly.length,0);
});

test("el universo de Mano de Obra usa Costo mensual aunque no haya registro MO", () => {
  resetInformeCostosEngine();
  handleInformeCostosCommand("INIT_COST_MONTHLY_ENGINE",{
    historicalRows:[],
    dynamicMonthly:[
      {maquina:"TOP0032",proyecto:"FILO DEL SOL",mes:"2026-06",costo:120},
      {maquina:"RPC-0039",proyecto:"FILO DEL SOL",mes:"2026-06",costo:75},
    ],
    dynamicMO:[],
    meta:{
      TOP0032:{display:"TOP0032",propiedad:"DELTA",tipo:"TOPADORA"},
      "RPC-0039":{display:"RPC-0039",propiedad:"DELTA",tipo:"OTROS"},
    },
  });
  const result=handleInformeCostosCommand("QUERY_COST_MONTHLY",{
    months:[{key:"2026-06"}],monthsAccum:[{key:"2026-06"}],rates:{"2026-06":1},baseRate:1,
    filters:{tipo:"todos"},filtersMO:{tipo:["MAQUINAS"]},
  });
  assert.deepEqual(result.monthlyMO,[]);
  assert.deepEqual(result.monthlyMOUniverse.map(row=>canonicalEquipmentCode(row.equipo)).sort(),["RPC0039","TOP0032"]);
  const labor=handleInformeCostosCommand("PROCESS_MANO_OBRA",{
    universeRows:result.monthlyMOUniverse,monthlyRows:result.monthlyMO,months:[{key:"2026-06"}],
    equipmentMeta:{TOP0032:{propiedad:"DELTA"},"RPC-0039":{propiedad:"DELTA"}},
  });
  assert.deepEqual(labor.rows.map(row=>canonicalEquipmentCode(row.equipo)).sort(),["RPC0039","TOP0032"]);
  assert.equal(labor.rows.every(row=>row.total===0),true);
});

test("el filtro CAMIONES incluye CAC0048 por código", () => {
  resetInformeCostosEngine();
  handleInformeCostosCommand("INIT_COST_MONTHLY_ENGINE",{
    historicalRows:[],
    dynamicMonthly:[
      {maquina:"CAC0048",proyecto:"FILO DEL SOL",mes:"2026-06",costo:75},
    ],
    dynamicMO:[],
    meta:{
      CAC0048:{display:"CAC0048",propiedad:"DELTA",tipo:"OTROS"},
    },
  });
  const result=handleInformeCostosCommand("QUERY_COST_MONTHLY",{
    months:[{key:"2026-06"}],monthsAccum:[{key:"2026-06"}],rates:{"2026-06":1},baseRate:1,
    filters:{tipo:["CAMIONES"]},filtersMO:{tipo:["CAMIONES"]},
  });
  assert.deepEqual(result.monthly.map(row=>canonicalEquipmentCode(row.equipo)),["CAC0048"]);
});

test("los filtros del motor respetan Familia antes que el código", () => {
  resetInformeCostosEngine();
  handleInformeCostosCommand("INIT_COST_MONTHLY_ENGINE",{
    historicalRows:[],
    dynamicMonthly:[
      {maquina:"CAT",proyecto:"FILO DEL SOL",mes:"2026-06",costo:25},
      {maquina:"CAT-0073",proyecto:"FILO DEL SOL",mes:"2026-06",costo:50},
      {maquina:"CTA-0848",proyecto:"FILO DEL SOL",mes:"2026-06",costo:75},
    ],
    dynamicMO:[],
    meta:{
      CAT:{display:"CAT",tipo:"OTROS",familia:"GENERADOR"},
      "CAT-0073":{display:"CAT-0073",tipo:"CAMIONES",familia:"CAMION TRACTOR"},
      "CTA-0848":{display:"CTA-0848",tipo:"CAMIONETAS",familia:"CAMIONETA PICKUP"},
    },
  });
  const query=filters=>handleInformeCostosCommand("QUERY_COST_MONTHLY",{
    months:[{key:"2026-06"}],monthsAccum:[{key:"2026-06"}],rates:{"2026-06":1},baseRate:1,
    filters,filtersMO:filters,
  });
  assert.deepEqual(query({tipo:["CAMIONES"]}).monthly.map(row=>row.equipo),["CAT-0073"]);
  assert.deepEqual(query({tipo:["CAMIONETAS"]}).monthly.map(row=>row.equipo),["CTA-0848"]);
  assert.deepEqual(query({tipo:["MAQUINAS"]}).monthly.map(row=>row.equipo),["CAT"]);
});

test("el motor acumula todos los datos CFN0101 dentro de PCA0101", () => {
  resetInformeCostosEngine();
  handleInformeCostosCommand("INIT_COST_MONTHLY_ENGINE",{
    historicalRows:[{equipo:"CFN-0101",section:"FS",months:{"2026-03":{total:20}}}],
    dynamicMonthly:[
      {maquina:"CFN0101",proyecto:"FILO DEL SOL",mes:"2026-06",costo:30},
      {maquina:"PCA-0101",proyecto:"FILO DEL SOL",mes:"2026-06",costo:70},
    ],
    dynamicMO:[{maquina:"CFN-0101-JM",proyecto:"FILO DEL SOL",mes:"2026-06",costo:15}],
    meta:{
      "CFN-0101":{display:"CFN-0101",propiedad:"DELTA",tipo:"CARGADORA FRONTAL"},
      "PCA-0101":{display:"PCA-0101",propiedad:"DELTA",tipo:"CARGADORA FRONTAL"},
    },
  });
  const result=handleInformeCostosCommand("QUERY_COST_MONTHLY",{
    months:[{key:"2026-03"},{key:"2026-06"}],fixedMonths:[{key:"2026-03"}],
    monthsAccum:[{key:"2026-03"},{key:"2026-06"}],rates:{"2026-06":1},baseRate:1,
    filters:{tipo:"todos"},filtersMO:{tipo:"todos"},
  });
  assert.deepEqual(result.monthly.map(row=>row.equipo),["PCA-0101"]);
  assert.equal(result.monthly[0].total,120);
  assert.deepEqual(result.monthlyMO.map(row=>row.equipo),["PCA-0101"]);
  assert.equal(result.monthlyMO[0].total,35);
  assert.equal(result.monthly.some(row=>canonicalEquipmentCode(row.equipo)==="CFN0101"),false);
});

test("el histórico no reincorpora equipos que no tienen registros actuales", () => {
  resetInformeCostosEngine();
  const init=handleInformeCostosCommand("INIT_COST_MONTHLY_ENGINE",{
    historicalRows:[
      {equipo:"EXC-0017",section:"FS",months:{"2026-03":{total:100}}},
      {equipo:"MOT-0014",section:"FS",months:{"2026-03":{total:40}}},
    ],
    dynamicMonthly:[
      {maquina:"EXC-0017",proyecto:"FILO DEL SOL",mes:"2025-11",costo:25},
      {maquina:"MOT-0014",proyecto:"FILO DEL SOL",mes:"2026-06",costo:60},
    ],
    dynamicMO:[],
    meta:{
      "EXC-0017":{display:"EXC-0017",tipo:"EXCAVADORA"},
      "MOT-0014":{display:"MOT-0014",tipo:"MOTONIVELADORA"},
    },
  });
  assert.equal(init.counts.historical,1);
  const result=handleInformeCostosCommand("QUERY_COST_MONTHLY",{
    months:[{key:"2026-03"},{key:"2026-06"}],fixedMonths:[{key:"2026-03"}],
    monthsAccum:[{key:"2026-03"},{key:"2026-06"}],rates:{"2026-06":1},baseRate:1,
    filters:{tipo:"todos"},filtersMO:{tipo:"todos"},
  });
  assert.deepEqual(result.monthly.map(row=>row.equipo),["MOT-0014"]);
  assert.equal(result.monthly[0].total,100);
  assert.equal(result.monthly.some(row=>canonicalEquipmentCode(row.equipo)==="EXC0017"),false);
  assert.equal(result.monthlyMO.some(row=>canonicalEquipmentCode(row.equipo)==="EXC0017"),false);
  assert.equal(result.acumulado.some(row=>canonicalEquipmentCode(row.equipo)==="EXC0017"),false);
});

test("un equipo vigente conserva 2025 desde la app y evita duplicar el histórico fijo", () => {
  resetInformeCostosEngine();
  handleInformeCostosCommand("INIT_COST_MONTHLY_ENGINE",{
    historicalRows:[
      {equipo:"MOT-0014",section:"FS",months:{"2025-09":{prev:10,corr:30,total:40}}},
    ],
    dynamicMonthly:[
      {maquina:"MOT-0014",proyecto:"FILO DEL SOL",mes:"2025-08",costo:20,esPrev:true},
      {maquina:"MOT-0014",proyecto:"FILO DEL SOL",mes:"2025-09",costo:60},
      {maquina:"MOT-0014",proyecto:"FILO DEL SOL",mes:"2026-06",costo:10},
    ],
    dynamicMO:[],
    meta:{"MOT-0014":{display:"MOT-0014",tipo:"MOTONIVELADORA"}},
  });
  const result=handleInformeCostosCommand("QUERY_COST_MONTHLY",{
    months:[{key:"2025-08"},{key:"2025-09"},{key:"2026-06"}],
    fixedMonths:[{key:"2025-09"}],monthsAccum:[{key:"2026-06"}],
    rates:{"2025-08":1,"2025-09":1,"2026-06":1},baseRate:1,
    filters:{tipo:"todos"},filtersMO:{tipo:"todos"},
  });
  assert.deepEqual(result.monthly.map(row=>row.equipo),["MOT-0014"]);
  assert.equal(result.monthly[0].months["2025-08"].total,20);
  assert.equal(result.monthly[0].months["2025-09"].total,40);
  assert.equal(result.monthly[0].total,70);
});

test("el motor vuelca preventivos y correctivos históricos al interno actual", () => {
  resetInformeCostosEngine();
  handleInformeCostosCommand("INIT_COST_MONTHLY_ENGINE",{
    historicalRows:[
      {equipo:"EXC-0019",section:"FS",months:{"2026-01":{prev:12,corr:34,total:46}}},
    ],
    dynamicMonthly:[
      {maquina:"EXC-0048",proyecto:"FILO DEL SOL",mes:"2026-04",costo:10},
    ],
    dynamicMO:[],
    meta:{"EXC-0048":{display:"EXC-0048",tipo:"EXCAVADORA",familia:"EXCAVADORA"}},
  });
  const result=handleInformeCostosCommand("QUERY_COST_MONTHLY",{
    months:[{key:"2026-01"},{key:"2026-04"}],fixedMonths:[{key:"2026-01"}],
    monthsAccum:[{key:"2026-04"}],rates:{"2026-04":1},baseRate:1,
    filters:{tipo:"todos"},filtersMO:{tipo:"todos"},
  });
  assert.deepEqual(result.monthly.map(row=>row.equipo),["EXC-0048"]);
  assert.deepEqual(result.monthly[0].months["2026-01"],{prev:12,corr:34,total:46});
});

test("TOP0036 y TOP0051 de marzo se trasladan de FS a JM y se suman al histórico existente", () => {
  resetInformeCostosEngine();
  handleInformeCostosCommand("INIT_COST_MONTHLY_ENGINE",{
    historicalRows:[
      {equipo:"TOP-0036",section:"JM",months:{"2026-03":{prev:10,corr:20,total:30}}},
      {equipo:"TOP-0051",section:"JM",months:{"2026-03":{prev:5,corr:15,total:20}}},
    ],
    dynamicMonthly:[
      {maquina:"TOP-0036",proyecto:"FILO DEL SOL",mes:"2026-03",costo:100,esPrev:true},
      {maquina:"TOP-0051",proyecto:"FILO DEL SOL",mes:"2026-03",costo:50,esPrev:false},
    ],
    dynamicMO:[],
    meta:{
      "TOP-0036":{display:"TOP-0036",tipo:"TOPADORA",familia:"TOPADORA"},
      "TOP-0051":{display:"TOP-0051",tipo:"TOPADORA",familia:"TOPADORA"},
    },
  });
  const result=handleInformeCostosCommand("QUERY_COST_MONTHLY",{
    months:[{key:"2026-03"}],fixedMonths:[{key:"2026-03"}],monthsAccum:[{key:"2026-03"}],
    rates:{"2026-03":1},baseRate:1,filters:{tipo:"todos"},filtersMO:{tipo:"todos"},
  });
  assert.equal(result.monthly.some(row=>row.section==="FS"),false);
  assert.deepEqual(result.monthly.map(row=>({equipo:row.equipo,section:row.section,month:row.months["2026-03"]})),[
    {equipo:"TOP-0036",section:"JM",month:{prev:110,corr:20,total:130}},
    {equipo:"TOP-0051",section:"JM",month:{prev:5,corr:65,total:70}},
  ]);
});

test("PCA0101 de marzo se traslada de FS a JM y se suma al histórico existente", () => {
  resetInformeCostosEngine();
  handleInformeCostosCommand("INIT_COST_MONTHLY_ENGINE",{
    historicalRows:[
      {equipo:"PCA-0101",section:"JM",months:{"2026-03":{prev:15,corr:25,total:40}}},
    ],
    dynamicMonthly:[
      {maquina:"PCA-0101",proyecto:"FILO DEL SOL",mes:"2026-03",costo:60,esPrev:false},
    ],
    dynamicMO:[],
    meta:{"PCA-0101":{display:"PCA-0101",tipo:"CARGADORA FRONTAL",familia:"CARGADORA FRONTAL"}},
  });
  const result=handleInformeCostosCommand("QUERY_COST_MONTHLY",{
    months:[{key:"2026-03"}],fixedMonths:[{key:"2026-03"}],monthsAccum:[{key:"2026-03"}],
    rates:{"2026-03":1},baseRate:1,filters:{tipo:"todos"},filtersMO:{tipo:"todos"},
  });
  assert.equal(result.monthly.some(row=>row.section==="FS"),false);
  assert.deepEqual(result.monthly.map(row=>({equipo:row.equipo,section:row.section,month:row.months["2026-03"]})),[
    {equipo:"PCA-0101",section:"JM",month:{prev:15,corr:85,total:100}},
  ]);
});

test("TOTAL 2025 suma los valores mensuales redondeados mostrados", () => {
  const months=["2025-09","2025-10","2025-11","2025-12"].map(key=>({key}));
  const rowMonths={
    "2025-09":{total:707.0002898550724},"2025-10":{total:167.9630797101449},
    "2025-11":{total:138.43582068965517},"2025-12":{total:34.20503496503497},
  };
  assert.equal(sumRoundedMonthlyTotals(months,rowMonths),1047);
});

test("TOTAL 2025 considera todos los meses disponibles en la app", () => {
  const view=fs.readFileSync(new URL("../src/modules/informe-costos/InformeCostosView.jsx",import.meta.url),"utf8");
  assert.match(view,/startsWith\("2025-"\)/);
  assert.doesNotMatch(view,/clavesTotal2025=new Set/);
});

test("Amortización no agrega equipos sin registros sólo por existir en Lista Maestra", () => {
  const view=fs.readFileSync(new URL("../src/modules/informe-costos/InformeCostosView.jsx",import.meta.url),"utf8");
  assert.doesNotMatch(view,/_fromLista:true/);
  assert.doesNotMatch(view,/Agregar también los equipos que existen en Lista Maestra/);
});

test("Amortización calcula el rowSpan sobre la colección completa, no sobre una ventana virtual", () => {
  const view=fs.readFileSync(new URL("../src/modules/informe-costos/InformeCostosView.jsx",import.meta.url),"utf8");
  assert.match(view,/buildVisibleCategoryRowSpans\(rowsAmortizacionDeferred\|\|\[\]\)/);
  assert.doesNotMatch(view,/buildVisibleCategoryRowSpans\(amortizacionVirtual\.visibleRows/);
});

test("las respuestas obsoletas están protegidas por tokens de solicitud", () => {
  const view=fs.readFileSync(new URL("../src/modules/informe-costos/InformeCostosView.jsx",import.meta.url),"utf8");
  assert.match(view,/const token=\+\+costoMensualWorkerQueryRef\.current/);
  assert.match(view,/if\(token!==costoMensualWorkerQueryRef\.current\)return/);
  assert.match(view,/const requestToken=\+\+amortizacionWorkerRequestRef\.current/);
  assert.match(view,/if\(requestToken!==amortizacionWorkerRequestRef\.current\)return/);
});
