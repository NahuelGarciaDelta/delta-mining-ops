from pathlib import Path
import re


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"No se encontró patrón: {label}")
    return text.replace(old, new, 1)

# 1) Dominio de movimientos
p = Path("src/services/equipmentMovementsDomain.js")
s = p.read_text(encoding="utf-8")
anchor = '''export const normalizeEquipmentMovementCode=value=>{\n  const raw=String(value||"").trim().toUpperCase().replace(/\\s*\\(.*?\\)/g,"").replace(/[-_\\s]+JM$/i,"");\n  const match=raw.replace(/[^A-Z0-9]/g,"").match(/^([A-Z]{2,4})(\\d{1,6})$/);\n  const formatted=match?`${match[1]}-${match[2].padStart(4,"0")}`:raw;\n  return resolveEquipmentCodeAlias(formatted);\n};\n'''
addition = anchor + '''\nconst DEST_CODE_RE=/\\[DM_INTERNO_DESTINO:([^\\]]+)\\]/i;\nconst DEST_DATE_RE=/\\[DM_FECHA_DESTINO:(\\d{4}-\\d{2}-\\d{2})\\]/i;\n\nexport function getEquipmentMovementDestinationCode(movement={}){\n  const direct=String(movement?.internoDestino||movement?.internoDestinoNormalizado||"").trim();\n  if(direct)return normalizeEquipmentMovementCode(direct);\n  const match=String(movement?.observacion||"").match(DEST_CODE_RE);\n  return match?normalizeEquipmentMovementCode(match[1]):"";\n}\n\nexport function getEquipmentMovementDestinationFirstDate(movement={}){\n  const direct=String(movement?.fechaPrimerRop02Destino||"").slice(0,10);\n  if(/^\\d{4}-\\d{2}-\\d{2}$/.test(direct))return direct;\n  const match=String(movement?.observacion||"").match(DEST_DATE_RE);\n  return match?match[1]:"";\n}\n\nexport function appendEquipmentMovementLinkMetadata(observation="",destinationCode="",destinationDate=""){\n  const clean=String(observation||"").replace(DEST_CODE_RE,"").replace(DEST_DATE_RE,"").trim();\n  const code=normalizeEquipmentMovementCode(destinationCode);\n  const date=String(destinationDate||"").slice(0,10);\n  const metadata=[code?`[DM_INTERNO_DESTINO:${code}]`:"",/^\\d{4}-\\d{2}-\\d{2}$/.test(date)?`[DM_FECHA_DESTINO:${date}]`:""].filter(Boolean).join(" ");\n  return [clean,metadata].filter(Boolean).join(" ").trim();\n}\n\nexport function buildEquipmentMovementAliasMap(movements=[]){\n  const out=new Map();\n  for(const movement of Array.isArray(movements)?movements:[]){\n    if(String(movement?.tipoMovimiento||"").toUpperCase()!=="CAMBIO_PROYECTO")continue;\n    if(String(movement?.estado||"").toUpperCase()==="CANCELADO")continue;\n    const origin=normalizeEquipmentMovementCode(movement?.internoNormalizado||movement?.interno);\n    const destination=getEquipmentMovementDestinationCode(movement);\n    if(origin&&destination&&origin!==destination)out.set(origin,destination);\n  }\n  return out;\n}\n'''
s = replace_once(s, anchor, addition, "helpers movement domain")
p.write_text(s, encoding="utf-8")

# 2) Servicio de movimientos
p = Path("src/services/equipmentMovements.js")
s = p.read_text(encoding="utf-8")
s = replace_once(
    s,
    'import {getMovimientoVigentePorEquipo,movementsToAtrasoMap,normalizeEquipmentMovementCode} from "./equipmentMovementsDomain.js";',
    'import {appendEquipmentMovementLinkMetadata,getMovimientoVigentePorEquipo,movementsToAtrasoMap,normalizeEquipmentMovementCode} from "./equipmentMovementsDomain.js";',
    "equipment movements import",
)
s = replace_once(
    s,
    '''export async function saveEquipmentMovement(movement){\n  const response=await postToAppsScript({action:"save_equipment_movement",movement});''',
    '''export async function saveEquipmentMovement(movement){\n  const prepared={...movement};\n  if(String(prepared.tipoMovimiento||"").toUpperCase()==="CAMBIO_PROYECTO"&&prepared.internoDestino){\n    prepared.observacion=appendEquipmentMovementLinkMetadata(prepared.observacion,prepared.internoDestino,prepared.fechaPrimerRop02Destino);\n  }\n  const response=await postToAppsScript({action:"save_equipment_movement",movement:prepared});''',
    "save movement metadata",
)
p.write_text(s, encoding="utf-8")

# 3) Historial de movimientos
p = Path("src/modules/equipment/equipmentMovementHistory.js")
s = p.read_text(encoding="utf-8")
s = replace_once(
    s,
    'import {normalizeRop02Project} from "../home/homeAvailability.js";',
    'import {normalizeRop02Project} from "../home/homeAvailability.js";\nimport {getEquipmentMovementDestinationCode,getEquipmentMovementDestinationFirstDate} from "../../services/equipmentMovementsDomain.js";',
    "movement history imports",
)
pattern = r'export function persistedProjectMovements\(movements=\[\],equipmentCode=""\)\{.*?\n\}'
replacement = '''export function persistedProjectMovements(movements=[],equipmentCode=""){\n  const selected=canonicalEquipmentCode(equipmentCode);\n  return (Array.isArray(movements)?movements:[]).filter(movement=>{\n    const origin=canonicalEquipmentCode(movement.internoNormalizado||movement.interno);\n    const destination=canonicalEquipmentCode(getEquipmentMovementDestinationCode(movement));\n    return origin===selected||destination===selected;\n  }).map(movement=>{\n    const type=String(movement.tipoMovimiento||"").toUpperCase(),origin=normalizeRop02Project(movement.proyectoOrigen);\n    const destination=normalizeRop02Project(movement.proyectoDestino)||(type==="BAJO_SAN_JUAN"?"SAN JUAN":type==="DESMOVILIZADO"?"DESMOVILIZADO":"");\n    const destinationCode=getEquipmentMovementDestinationCode(movement);\n    const destinationDate=getEquipmentMovementDestinationFirstDate(movement);\n    const iso=dateISO(type==="CAMBIO_PROYECTO"&&destinationDate?destinationDate:movement.fechaHora);\n    return{fechaISO:iso,fecha:displayDate(iso),desdeRaw:origin,hastaRaw:destination,desde:displayProject(origin),hasta:displayProject(destination),source:"MANUAL",motivo:movement.motivo||type,observacion:movement.observacion||"",usuario:movement.usuario||"",id:movement.id||"",internoOrigen:canonicalEquipmentCode(movement.internoNormalizado||movement.interno),internoDestino:destinationCode};\n  }).filter(movement=>movement.fechaISO&&(movement.desdeRaw||movement.hastaRaw));\n}'''
s, n = re.subn(pattern, replacement, s, count=1, flags=re.S)
if n != 1:
    raise SystemExit("No se reemplazó persistedProjectMovements")
pattern = r'export function indexPersistedMovementsByEquipment\(movements=\[\]\)\{.*?\n\}'
replacement = '''export function indexPersistedMovementsByEquipment(movements=[]){\n  const index=new Map();\n  const add=(code,movement)=>{const key=canonicalEquipmentCode(code);if(!key)return;if(!index.has(key))index.set(key,[]);index.get(key).push(movement);};\n  for(const movement of Array.isArray(movements)?movements:[]){\n    add(movement.internoNormalizado||movement.interno,movement);\n    const destination=getEquipmentMovementDestinationCode(movement);\n    if(destination)add(destination,movement);\n  }\n  return index;\n}'''
s, n = re.subn(pattern, replacement, s, count=1, flags=re.S)
if n != 1:
    raise SystemExit("No se reemplazó indexPersistedMovementsByEquipment")
p.write_text(s, encoding="utf-8")

# 4) Ficha única: alias por movimiento
p = Path("src/modules/equipment/EquipmentProfileWithLastRop02.jsx")
s = p.read_text(encoding="utf-8")
s = replace_once(
    s,
    'import {canonicalEquipmentCode,cleanEquipmentCode} from "./equipmentCode.js";',
    'import {canonicalEquipmentCode,cleanEquipmentCode} from "./equipmentCode.js";\nimport {useEquipmentMovements} from "../../services/equipmentMovements.js";\nimport {buildEquipmentMovementAliasMap} from "../../services/equipmentMovementsDomain.js";',
    "profile movement imports",
)
s = replace_once(
    s,
    '''  const [selectedCode,setSelectedCode]=useState(()=>cleanEquipmentCode(props.initialCode||""));\n\n  // Una fila de Lista Maestra puede contener código nuevo, Drusila, interno y viejo.''',
    '''  const [selectedCode,setSelectedCode]=useState(()=>cleanEquipmentCode(props.initialCode||""));\n  const {movements:sharedMovements}=useEquipmentMovements(props.rop02All,["equipmentProfile"]);\n\n  // Una fila de Lista Maestra puede contener código nuevo, Drusila, interno y viejo.''',
    "profile movement hook",
)
pattern = r'  const codeAliases=useMemo\(\(\)=>\{.*?  \},\[props\.listaEquipos\]\);\n\n  const resolveCode=React\.useCallback\(raw=>\{.*?  \},\[codeAliases\]\);'
replacement = '''  const codeAliases=useMemo(()=>{\n    const aliases=new Map();\n    for(const row of Array.isArray(props.listaEquipos)?props.listaEquipos:[]){\n      const codes=masterCodes(row);\n      if(!codes.length)continue;\n      const preferred=cleanEquipmentCode(codes[0]);\n      for(const raw of codes){\n        const key=canonicalEquipmentCode(raw);\n        if(key)aliases.set(key,preferred);\n      }\n    }\n    return aliases;\n  },[props.listaEquipos]);\n  const movementAliases=useMemo(()=>buildEquipmentMovementAliasMap(sharedMovements),[sharedMovements]);\n\n  const resolveCode=React.useCallback(raw=>{\n    let current=cleanEquipmentCode(raw);\n    const seen=new Set();\n    for(let i=0;i<10;i++){\n      const key=canonicalEquipmentCode(current);\n      if(!key||seen.has(key))break;\n      seen.add(key);\n      const masterPreferred=codeAliases.get(key)||current;\n      const masterKey=canonicalEquipmentCode(masterPreferred);\n      const moved=movementAliases.get(masterKey)||movementAliases.get(key);\n      const next=cleanEquipmentCode(moved||masterPreferred);\n      if(!next||canonicalEquipmentCode(next)===key){current=next||current;break;}\n      current=next;\n    }\n    return current;\n  },[codeAliases,movementAliases]);'''
s, n = re.subn(pattern, replacement, s, count=1, flags=re.S)
if n != 1:
    raise SystemExit("No se reemplazó resolveCode")
p.write_text(s, encoding="utf-8")

# 5) Modal Atraso
p = Path("src/modules/oficina-tecnica/OficinaTecnicaModule.jsx")
s = p.read_text(encoding="utf-8")
s = replace_once(
    s,
    'import {cancelEquipmentMovement,saveEquipmentMovement,useEquipmentMovements} from "../../services/equipmentMovements.js";',
    'import {cancelEquipmentMovement,saveEquipmentMovement,useEquipmentMovements} from "../../services/equipmentMovements.js";\nimport {normalizeEquipmentMovementCode} from "../../services/equipmentMovementsDomain.js";',
    "atraso domain import",
)
s = replace_once(
    s,
    '''  const [proyectoDestino,setProyectoDestino]=useState("");\n  const [savingMovimiento,setSavingMovimiento]=useState(false);''',
    '''  const [proyectoDestino,setProyectoDestino]=useState("");\n  const [internoDestinoModo,setInternoDestinoModo]=useState("MISMO");\n  const [internoDestino,setInternoDestino]=useState("");\n  const [savingMovimiento,setSavingMovimiento]=useState(false);''',
    "destination states",
)
s = replace_once(
    s,
    '''    setMotivoOtro("");\n    setProyectoDestino("");\n    setMovimientoMsg("");''',
    '''    setMotivoOtro("");\n    setProyectoDestino("");\n    setInternoDestinoModo("MISMO");\n    setInternoDestino("");\n    setMovimientoMsg("");''',
    "destination reset",
)
marker = '''  const confirmarJustificacion=async()=>{'''
helper = '''  const internosDestinoDisponibles=useMemo(()=>{\n    if(!proyectoDestino)return[];\n    const destination=normalizeRop02Project(proyectoDestino);\n    const byCode=new Map();\n    for(const row of rop02Prod||[]){\n      if(normalizeRop02Project(row?.proyecto||row?.lugar)!==destination)continue;\n      const code=normalizeEquipmentMovementCode(row?.maquina||row?._internoRaw);\n      const fecha=String(row?.fecha||"").slice(0,10);\n      if(!code||!fecha)continue;\n      const current=byCode.get(code);\n      if(!current||fecha<current.primera)byCode.set(code,{code,primera:fecha});\n    }\n    return [...byCode.values()].sort((a,b)=>a.code.localeCompare(b.code,"es",{numeric:true}));\n  },[rop02Prod,proyectoDestino]);\n\n  const internoDestinoValidado=useMemo(()=>{\n    if(internoDestinoModo!=="NUEVO"||!internoDestino)return null;\n    const code=normalizeEquipmentMovementCode(internoDestino);\n    const lastOrigin=String(modalAtraso?.ultimaCarga||"").slice(0,10);\n    const candidates=(rop02Prod||[]).filter(row=>normalizeEquipmentMovementCode(row?.maquina||row?._internoRaw)===code&&normalizeRop02Project(row?.proyecto||row?.lugar)===normalizeRop02Project(proyectoDestino)&&String(row?.fecha||"").slice(0,10)>=lastOrigin).sort((a,b)=>String(a.fecha||"").localeCompare(String(b.fecha||"")));\n    if(!candidates.length)return{ok:false,code,fecha:""};\n    return{ok:true,code,fecha:String(candidates[0].fecha||"").slice(0,10)};\n  },[internoDestinoModo,internoDestino,modalAtraso,rop02Prod,proyectoDestino]);\n\n'''
s = replace_once(s, marker, helper + marker, "destination verification")
s = replace_once(
    s,
    '''    if(motivoTipo==="Cambio de proyecto"&&!proyectoDestino){appAlert("Seleccioná el proyecto destino.");return;}\n    const usuario=sessionStorage.getItem("dm_user")||"Usuario";''',
    '''    if(motivoTipo==="Cambio de proyecto"&&!proyectoDestino){appAlert("Seleccioná el proyecto destino.");return;}\n    let internoDestinoGuardado="";\n    let fechaPrimerRop02Destino="";\n    if(motivoTipo==="Cambio de proyecto"){\n      if(internoDestinoModo==="MISMO"){\n        internoDestinoGuardado=normalizeEquipmentMovementCode(modalAtraso.codigo||modalAtraso.maquina);\n      }else{\n        if(!String(internoDestino||"").trim()){appAlert("Ingresá el nuevo interno del equipo en el proyecto destino.");return;}\n        if(!internoDestinoValidado?.ok){appAlert(`No encontré una carga ROP02 de ${normalizeEquipmentMovementCode(internoDestino)} en ${proyectoDestino} posterior a la última carga del equipo origen.`);return;}\n        internoDestinoGuardado=internoDestinoValidado.code;\n        fechaPrimerRop02Destino=internoDestinoValidado.fecha;\n        if(internoDestinoGuardado===normalizeEquipmentMovementCode(modalAtraso.codigo||modalAtraso.maquina)){appAlert("El interno nuevo coincide con el actual. Elegí ‘Mantiene el mismo interno’.");return;}\n      }\n    }\n    const usuario=sessionStorage.getItem("dm_user")||"Usuario";''',
    "confirm destination validation",
)
s = replace_once(
    s,
    '''      await saveEquipmentMovement({interno:modalAtraso.maquina,internoNormalizado:modalAtraso.codigo,proyectoOrigen:modalAtraso.proyecto,proyectoDestino:tipoMovimiento==="BAJO_SAN_JUAN"?"SAN JUAN":proyectoDestino,tipoMovimiento,motivo:causa,observacion:motivoTipo==="Otro"?motivoOtro:"",usuario,fechaUltimoRop02:modalAtraso.ultimaCarga});''',
    '''      await saveEquipmentMovement({interno:modalAtraso.maquina,internoNormalizado:modalAtraso.codigo,proyectoOrigen:modalAtraso.proyecto,proyectoDestino:tipoMovimiento==="BAJO_SAN_JUAN"?"SAN JUAN":proyectoDestino,tipoMovimiento,motivo:causa,observacion:motivoTipo==="Otro"?motivoOtro:"",usuario,fechaUltimoRop02:modalAtraso.ultimaCarga,internoDestino:internoDestinoGuardado,fechaPrimerRop02Destino});''',
    "save destination fields",
)
old_ui = '''          {motivoTipo==="Cambio de proyecto"&&<label style={{display:"flex",flexDirection:"column",gap:7,fontSize:12,fontWeight:800,color:C.textSub}}>Proyecto destino<select value={proyectoDestino} onChange={e=>setProyectoDestino(e.target.value)} style={{background:C.bg,border:`1px solid ${C.border}`,color:C.text,borderRadius:8,padding:"10px 12px"}}><option value="">Seleccionar...</option>{uniq(["JOSE MARIA","FILO DEL SOL","FILO SUR","EL ZORRO",...proyectosFiltro]).map(p=><option key={p} value={p}>{p}</option>)}</select></label>}'''
new_ui = '''          {motivoTipo==="Cambio de proyecto"&&<>\n            <label style={{display:"flex",flexDirection:"column",gap:7,fontSize:12,fontWeight:800,color:C.textSub}}>Proyecto destino<select value={proyectoDestino} onChange={e=>{setProyectoDestino(e.target.value);setInternoDestino("");}} style={{background:C.bg,border:`1px solid ${C.border}`,color:C.text,borderRadius:8,padding:"10px 12px"}}><option value="">Seleccionar...</option>{uniq([...proyectosFiltro]).map(p=><option key={p} value={p}>{p}</option>)}</select></label>\n            <label style={{display:"flex",flexDirection:"column",gap:7,fontSize:12,fontWeight:800,color:C.textSub}}>Interno en proyecto destino<select value={internoDestinoModo} onChange={e=>{setInternoDestinoModo(e.target.value);setInternoDestino("");}} style={{background:C.bg,border:`1px solid ${C.border}`,color:C.text,borderRadius:8,padding:"10px 12px"}}><option value="MISMO">Mantiene el mismo interno ({normalizeEquipmentMovementCode(modalAtraso.codigo||modalAtraso.maquina)})</option><option value="NUEVO">Cambió de interno</option></select></label>\n            {internoDestinoModo==="NUEVO"&&<label style={{display:"flex",flexDirection:"column",gap:7,fontSize:12,fontWeight:800,color:C.textSub}}>Nuevo interno<input list="dm-internos-destino" value={internoDestino} onChange={e=>setInternoDestino(e.target.value.toUpperCase())} placeholder="Ej.: TOP-0067" style={{background:C.bg,border:`1px solid ${internoDestino&&internoDestinoValidado?.ok?C.green:C.border}`,color:C.text,borderRadius:8,padding:"10px 12px"}}/><datalist id="dm-internos-destino">{internosDestinoDisponibles.map(item=><option key={item.code} value={item.code}/>)}</datalist>{internoDestino&&<span style={{fontSize:11,color:internoDestinoValidado?.ok?C.green:C.red,fontWeight:800}}>{internoDestinoValidado?.ok?`✓ Verificado en ROP02 ${proyectoDestino} · primera carga posterior: ${fmtFecha(internoDestinoValidado.fecha)}`:`No se encontró una carga posterior con ese interno en ${proyectoDestino||"el proyecto destino"}`}</span>}</label>}\n          </>}'''
s = replace_once(s, old_ui, new_ui, "destination UI")
p.write_text(s, encoding="utf-8")

# 6) Test
test = Path("tests/equipment-movement-link.test.mjs")
test.write_text('''import test from "node:test";\nimport assert from "node:assert/strict";\nimport {appendEquipmentMovementLinkMetadata,buildEquipmentMovementAliasMap,getEquipmentMovementDestinationCode,getEquipmentMovementDestinationFirstDate} from "../src/services/equipmentMovementsDomain.js";\n\ntest("persiste y recupera vínculo de interno destino",()=>{\n  const observation=appendEquipmentMovementLinkMetadata("Cambio real","TOP-0067","2026-08-10");\n  const movement={interno:"TOP-0029",internoNormalizado:"TOP-0029",tipoMovimiento:"CAMBIO_PROYECTO",observacion};\n  assert.equal(getEquipmentMovementDestinationCode(movement),"TOP-0067");\n  assert.equal(getEquipmentMovementDestinationFirstDate(movement),"2026-08-10");\n  assert.equal(buildEquipmentMovementAliasMap([movement]).get("TOP-0029"),"TOP-0067");\n});\n''', encoding="utf-8")

print("Migración de vínculo de internos aplicada")
