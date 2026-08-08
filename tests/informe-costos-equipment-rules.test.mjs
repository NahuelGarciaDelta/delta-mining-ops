import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalEquipmentCode,
  isGloballyExcludedEquipmentCode,
  isCompactorEquipmentCode,
  isCompactorEquipment,
  isExcludedFromMaintenanceCostReport,
  isMaintenanceCostMachine,
  isMaintenanceCostTruck,
} from "../src/modules/equipment/equipmentCode.js";
import {
  handleInformeCostosCommand,
  resetInformeCostosEngine,
} from "../src/modules/informe-costos/engine/InformeCostosEngine.js";
import fs from "node:fs";
import { buildVisibleCategoryRowSpans } from "../src/modules/informe-costos/utils/categoryRowSpan.js";

test("CFN01010 y sus variantes quedan excluidos por la clave canónica", () => {
  ["CFN01010", "CFN-01010", "CFN 01010", "cfn-01010-jm"].forEach(code => {
    assert.equal(isExcludedFromMaintenanceCostReport(code), true, code);
  });
  assert.equal(isExcludedFromMaintenanceCostReport("CFN-01011"), false);
});

test("CFN0101 queda excluido globalmente sin excluir PCA0101", () => {
  ["CFN0101","CFN-0101","CFN 0101","cfn-0101-jm"].forEach(code=>{
    assert.equal(isGloballyExcludedEquipmentCode(code),true,code);
    assert.equal(isExcludedFromMaintenanceCostReport(code),true,code);
  });
  assert.equal(isGloballyExcludedEquipmentCode("PCA-0101"),false);
});

test("CAC0048 se reconoce como camión por código aunque el tipo esté incompleto", () => {
  ["CAC0048","CAC-0048","CAC 0048","CAC-0048-JM"].forEach(code=>
    assert.equal(isMaintenanceCostTruck({code,type:"OTROS"}),true,code));
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

test("el filtro CAMIONES incluye CAC0048 por código y elimina CFN0101", () => {
  resetInformeCostosEngine();
  handleInformeCostosCommand("INIT_COST_MONTHLY_ENGINE",{
    historicalRows:[],
    dynamicMonthly:[
      {maquina:"CAC0048",proyecto:"FILO DEL SOL",mes:"2026-06",costo:75},
      {maquina:"CFN-0101",proyecto:"FILO DEL SOL",mes:"2026-06",costo:999},
    ],
    dynamicMO:[],
    meta:{
      CAC0048:{display:"CAC0048",propiedad:"DELTA",tipo:"OTROS"},
      "CFN-0101":{display:"CFN-0101",propiedad:"DELTA",tipo:"CARGADORA FRONTAL"},
    },
  });
  const result=handleInformeCostosCommand("QUERY_COST_MONTHLY",{
    months:[{key:"2026-06"}],monthsAccum:[{key:"2026-06"}],rates:{"2026-06":1},baseRate:1,
    filters:{tipo:["CAMIONES"]},filtersMO:{tipo:["CAMIONES"]},
  });
  assert.deepEqual(result.monthly.map(row=>canonicalEquipmentCode(row.equipo)),["CAC0048"]);
  assert.equal(result.monthly.some(row=>canonicalEquipmentCode(row.equipo)==="CFN0101"),false);
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
