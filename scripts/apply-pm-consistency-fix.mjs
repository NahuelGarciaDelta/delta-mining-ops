import fs from "node:fs";

function patchFile(path, operations) {
  let source = fs.readFileSync(path, "utf8");
  for (const [label, before, after] of operations) {
    if (!source.includes(before)) throw new Error(`${path}: no se encontró bloque ${label}`);
    source = source.replace(before, after);
  }
  fs.writeFileSync(path, source, "utf8");
}

patchFile("src/services/supabaseReadApi.js", [
  [
    "PM snapshot RPC",
    "export async function fetchSupabaseHealth(){\n",
    `export async function fetchSupabasePmSnapshot(){\n  const {data}=await request("/rest/v1/rpc/app_pm_snapshot",{method:"POST",body:{},timeoutMs:12000});\n  return data||{ok:false,error:{message:"Supabase no devolvió Mantenimiento Programado."}};\n}\n\nexport async function fetchSupabaseHealth(){\n`
  ],
]);

patchFile("src/services/appsScriptApi.js", [
  [
    "import PM snapshot",
    'import {SUPABASE_TYPED_SOURCES,fetchSupabaseDatasetQuery,fetchSupabaseHealth,fetchSupabaseSource,fetchSupabaseVersions} from "./supabaseReadApi.js";',
    'import {SUPABASE_TYPED_SOURCES,fetchSupabaseDatasetQuery,fetchSupabaseHealth,fetchSupabasePmSnapshot,fetchSupabaseSource,fetchSupabaseVersions} from "./supabaseReadApi.js";'
  ],
  [
    "route PM reads to Supabase",
    'export async function fetchAction(url,action,{force=false,compact=true,retries=2,since="",timeoutMs=45000,params:extraParams={}}={}){\n  if(SUPABASE_TYPED_SOURCES.has(String(action||"")))return fetchSupabaseSource(String(action||""));',
    'export async function fetchAction(url,action,{force=false,compact=true,retries=2,since="",timeoutMs=45000,params:extraParams={}}={}){\n  if(String(action||"")==="mantenimiento_programado")return fetchSupabasePmSnapshot();\n  if(SUPABASE_TYPED_SOURCES.has(String(action||"")))return fetchSupabaseSource(String(action||""));'
  ],
]);

patchFile("src/modules/mantenimiento/MantenimientoProgramadoView.jsx", [
  [
    "imports",
    'import { registerRefreshTask } from "../../services/refreshManager.js";',
    `import { registerRefreshTask } from "../../services/refreshManager.js";\nimport { fetchAction } from "../../services/appsScriptApi.js";\nimport {\n  TRUCK_PM_ALERT_FROM_HOURS,\n  TRUCK_PM_INTERVAL_HOURS,\n  TRUCK_PM_OVERDUE_FROM_HOURS,\n  getNextTruckPmHour,\n  hasInconsistentPmReadings,\n  isCanonicalTruckFamily,\n  positiveOr,\n  selectMaintenanceCounter,\n} from "./pmRules.js";`
  ],
  [
    "truck helper",
    `function categoriaPM(equipo) {\n  return esCamionetaPM(equipo) ? "vehiculos" : "pesados";\n}`,
    `function esCamionPM(equipo) {\n  return isCanonicalTruckFamily(equipo?.familia || equipo?.tipoEquipo || equipo?.equipo || "");\n}\n\nfunction categoriaPM(equipo) {\n  return esCamionetaPM(equipo) ? "vehiculos" : "pesados";\n}`
  ],
  [
    "ROP counter",
    `function ropHoras(row) {\n  // Compatibilidad con datos normalizados (\`horometroFinal\`) y datos crudos (\`HF\`).\n  return Math.max(\n    num(row?.horometroFinal),\n    num(row?.horometroInicial),\n    num(pick(row, ["hf", "horometro final", "horómetro final", "km final", "kilometraje final"])),\n    num(pick(row, ["hi", "horometro inicial", "horómetro inicial"])),\n    num(row?.horas),\n    num(pick(row, ["horas", "hs"]))\n  );\n}`,
    `function ropHoras(row, esCamion = false) {\n  return selectMaintenanceCounter({\n    horometerCandidates: [\n      row?.horometroFinal, row?.horometroInicial,\n      pick(row, ["hf", "horometro final", "horómetro final"]),\n      pick(row, ["hi", "horometro inicial", "horómetro inicial"]),\n      row?.horas, pick(row, ["horas", "hs"]),\n    ],\n    mileageCandidates: [\n      row?.kilometrajeFinal, row?.kmFinal,\n      pick(row, ["km final", "kilometraje final"]),\n    ],\n  }, { isTruck: esCamion });\n}`
  ],
  [
    "status",
    `function statusFor(row) {\n  const actual = num(row.horometroActual);\n  const ultimo = num(row.horometroUltimoPM);\n  const transcurridas = ultimo > 0 ? Math.max(0, actual - ultimo) : 0;\n  const alerta = num(row.alertaDesde) || DEFAULTS.alertaDesde;\n  const atrasado = num(row.atrasadoDesde) || DEFAULTS.atrasadoDesde;\n  const intervalo = num(row.intervalo) || DEFAULTS.intervalo;\n  let estado = "AL DÍA", color = "ok";\n  const margenUrgente = Math.max(20, Math.min(50, atrasado - intervalo));\n  if (!ultimo) { estado = "SIN BASE"; color = "muted"; }\n  else if (transcurridas >= atrasado) { estado = "PM ATRASADO"; color = "danger"; }\n  else if (transcurridas >= intervalo || transcurridas >= atrasado - margenUrgente) { estado = "PM URGENTE"; color = "danger"; }\n  else if (transcurridas >= alerta) { estado = "PM PRÓXIMO"; color = "warn"; }\n  return {\n    ...row,\n    transcurridas,\n    proximoPM: ultimo ? ultimo + intervalo : 0,\n    faltan: ultimo ? Math.max(0, (ultimo + intervalo) - actual) : 0,\n    estado,\n    color,\n  };\n}`,
    `function statusFor(row) {\n  const actual = num(row.horometroActual);\n  const ultimo = num(row.horometroUltimoPM);\n  const esCamion = Boolean(row.pmEsCamion);\n  const intervalo = esCamion ? TRUCK_PM_INTERVAL_HOURS : positiveOr(row.intervalo, DEFAULTS.intervalo);\n  const alerta = esCamion ? TRUCK_PM_ALERT_FROM_HOURS : positiveOr(row.alertaDesde, DEFAULTS.alertaDesde);\n  const atrasado = esCamion ? TRUCK_PM_OVERDUE_FROM_HOURS : positiveOr(row.atrasadoDesde, DEFAULTS.atrasadoDesde);\n  const inconsistente = hasInconsistentPmReadings(actual, ultimo);\n  const transcurridas = ultimo > 0 && !inconsistente ? Math.max(0, actual - ultimo) : 0;\n  let proximoPM = 0;\n  if (ultimo && !inconsistente) proximoPM = esCamion ? getNextTruckPmHour(actual, ultimo) : ultimo + intervalo;\n  let estado = "AL DÍA", color = "ok";\n  const margenUrgente = Math.max(20, Math.min(50, Math.max(0, atrasado - intervalo)));\n  if (!ultimo) { estado = "SIN BASE"; color = "muted"; }\n  else if (inconsistente) { estado = "REVISAR DATOS"; color = "danger"; }\n  else if (transcurridas >= atrasado) { estado = "PM ATRASADO"; color = "danger"; }\n  else if (transcurridas >= intervalo || transcurridas >= atrasado - margenUrgente) { estado = "PM URGENTE"; color = "danger"; }\n  else if (transcurridas >= alerta) { estado = "PM PRÓXIMO"; color = "warn"; }\n  return {\n    ...row, intervalo, alertaDesde: alerta, atrasadoDesde: atrasado,\n    unidadMantenimiento: esCamion ? "h" : row.unidadMantenimiento,\n    inconsistente, transcurridas, proximoPM,\n    faltan: proximoPM ? Math.max(0, proximoPM - actual) : 0,\n    estado, color,\n  };\n}`
  ],
  [
    "Supabase load",
    `      if (!APPS_SCRIPT_URL) throw new Error("No está configurada la URL del Apps Script.");\n      const response = await fetch(\`${'${APPS_SCRIPT_URL}'}?action=mantenimiento_programado&ts=${'${Date.now()}'}\`, { cache: "no-store" });\n      const json = await readJsonResponse(response, "Carga de Mantenimiento Programado");`,
    `      const json = await fetchAction(APPS_SCRIPT_URL, "mantenimiento_programado", { force: true });`
  ],
  [
    "truck set",
    `  const actividad7Dias = useMemo(() => {`,
    `  const truckInternos = useMemo(() => {\n    const set = new Set();\n    (listaEquipos || []).forEach(raw => {\n      const e = equipoFromLista(raw);\n      const key = norm(e.interno);\n      if (key && esCamionPM(e)) set.add(key);\n    });\n    return set;\n  }, [listaEquipos]);\n\n  const actividad7Dias = useMemo(() => {`
  ],
  [
    "truck counter invocation",
    `      const horas = ropHoras(row);`,
    `      const horas = ropHoras(row, truckInternos.has(key));`
  ],
  [
    "activity deps",
    `  }, [rop02All, fechaDesde, fechaHasta]);`,
    `  }, [rop02All, fechaDesde, fechaHasta, truckInternos]);`
  ],
  [
    "equipment truck flag",
    `      const cfg = configMap.get(key) || {};\n      base.push(statusFor({`,
    `      const cfg = configMap.get(key) || {};\n      const pmEsCamion = esCamionPM(e);\n      base.push(statusFor({`
  ],
  [
    "equipment PM fields",
    `        proyecto: actividad.proyecto || cfg.proyecto || e.proyecto,\n        intervalo: num(cfg.intervalo) || DEFAULTS.intervalo,\n        alertaDesde: num(cfg.alertaDesde) || DEFAULTS.alertaDesde,\n        atrasadoDesde: num(cfg.atrasadoDesde) || DEFAULTS.atrasadoDesde,`,
    `        proyecto: actividad.proyecto || cfg.proyecto || e.proyecto,\n        pmEsCamion,\n        intervalo: pmEsCamion ? TRUCK_PM_INTERVAL_HOURS : positiveOr(cfg.intervalo, DEFAULTS.intervalo),\n        alertaDesde: pmEsCamion ? TRUCK_PM_ALERT_FROM_HOURS : positiveOr(cfg.alertaDesde, DEFAULTS.alertaDesde),\n        atrasadoDesde: pmEsCamion ? TRUCK_PM_OVERDUE_FROM_HOURS : positiveOr(cfg.atrasadoDesde, DEFAULTS.atrasadoDesde),`
  ],
  [
    "status rank",
    `    const rank = { "PM ATRASADO": 0, "PM URGENTE": 1, "PM PRÓXIMO": 2, "SIN BASE": 3, "AL DÍA": 4 };`,
    `    const rank = { "REVISAR DATOS": 0, "PM ATRASADO": 1, "PM URGENTE": 2, "PM PRÓXIMO": 3, "SIN BASE": 4, "AL DÍA": 5 };`
  ],
]);

patchFile("src/modules/equipment/EquipmentProfileView.jsx", [
  [
    "PM rules import",
    'import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";',
    `import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";\nimport { getNextTruckPmHour, hasInconsistentPmReadings, isCanonicalTruckFamily, positiveOr } from "../mantenimiento/pmRules.js";`
  ],
  [
    "profile PM calculation",
    `  const pmInfo=useMemo(()=>{\n    const cfg=pmCfgIndex.get(selectedKey)||{};\n    const latestReg=pmReg[0]||null;\n    const lastH=Number(latestReg?pick(latestReg,["Horometro","Horómetro","Km / hs"]):pick(cfg,["horometroUltimoPM","Horómetro último PM"]))||0;\n    const lastDate=latestReg?pick(latestReg,["Fecha","Fecha PM"]):pick(cfg,["fechaUltimoPM","Fecha último PM"]);\n    const interval=Number(pick(cfg,["intervalo","Intervalo"]))||250;\n    const next=lastH?lastH+interval:0;\n    const since=lastH&&summary.currentH?Math.max(0,summary.currentH-lastH):0;\n    const remaining=next&&summary.currentH?next-summary.currentH:null;\n    let status="SIN BASE";if(lastH){status=remaining!=null&&remaining<0?"ATRASADO":remaining!=null&&remaining<=50?"PRÓXIMO":"AL DÍA";}\n    return{lastH,lastDate,interval,next,since,remaining,status};\n  },[pmCfgIndex,selectedKey,pmReg,summary.currentH]);`,
    `  const pmInfo=useMemo(()=>{\n    const cfg=pmCfgIndex.get(selectedKey)||{};\n    const latestReg=pmReg[0]||null;\n    const lastH=Number(latestReg?pick(latestReg,["Horometro","Horómetro","Km / hs"]):pick(cfg,["horometroUltimoPM","Horómetro último PM"]))||0;\n    const lastDate=latestReg?pick(latestReg,["Fecha","Fecha PM"]):pick(cfg,["fechaUltimoPM","Fecha último PM"]);\n    const latestOp=op[op.length-1]||{};\n    const currentH=Number(latestOp.horometroFinal??latestOp.hf??latestOp.horometro??0)||0;\n    const isTruck=isCanonicalTruckFamily(pick(master||{},["Familia","Tipo","Equipo"]));\n    const interval=isTruck?500:positiveOr(pick(cfg,["intervalo","Intervalo"]),250);\n    const inconsistent=hasInconsistentPmReadings(currentH,lastH);\n    const next=lastH&&!inconsistent?(isTruck?getNextTruckPmHour(currentH,lastH):lastH+interval):0;\n    const since=lastH&&currentH&&!inconsistent?Math.max(0,currentH-lastH):0;\n    const remaining=next&&currentH?next-currentH:null;\n    let status="SIN BASE";\n    if(inconsistent)status="REVISAR DATOS";\n    else if(lastH)status=remaining!=null&&remaining<0?"ATRASADO":remaining!=null&&remaining<=Math.min(100,interval*.2)?"PRÓXIMO":"AL DÍA";\n    return{lastH,lastDate,interval,next,since,remaining,status,currentH,isTruck,inconsistent,latestOp};\n  },[pmCfgIndex,selectedKey,pmReg,op,master]);`
  ],
  [
    "profile current card",
    `{compactMetric("Horómetro actual",summary.currentH?\`${'${fmt(summary.currentH)}'} h\`:"—",C.blue,"Último horómetro final registrado en ROP02.",summary.lastOp?.fecha?\`Última lectura: ${'${shortDate(summary.lastOp.fecha)}'}\`:undefined,"hours")}`,
    `{compactMetric("Horómetro actual",pmInfo.currentH?\`${'${fmt(pmInfo.currentH)}'} h\`:"—",pmInfo.inconsistent?C.red:C.blue,"Último horómetro final real registrado en ROP02, independiente del filtro visual.",pmInfo.latestOp?.fecha?\`Última lectura: ${'${shortDate(pmInfo.latestOp.fecha)}'}\`:undefined,"hours")}`
  ],
  [
    "profile PM status color",
    `pmInfo.status==="ATRASADO"?C.red:pmInfo.status==="PRÓXIMO"?C.yellow:C.green`,
    `pmInfo.status==="ATRASADO"||pmInfo.status==="REVISAR DATOS"?C.red:pmInfo.status==="PRÓXIMO"?C.yellow:C.green`
  ],
]);

console.log("PM consistency patch applied");
