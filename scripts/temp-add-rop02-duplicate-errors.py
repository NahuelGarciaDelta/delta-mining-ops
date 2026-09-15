from pathlib import Path

p=Path('src/modules/oficina-tecnica/OficinaTecnicaModule.jsx')
s=p.read_text(encoding='utf-8')

def rep(old,new,label):
    global s
    if old not in s:
        raise SystemExit(f'No se encontró bloque esperado: {label}')
    s=s.replace(old,new,1)

rep(
'import {normalizeROP02,normalizeROP05,calcControl} from "../../shared/domain/index.jsx";\n',
'import {normalizeROP02,normalizeROP05,calcControl} from "../../shared/domain/index.jsx";\nimport {detectRop02DuplicateLoads} from "./rop02DuplicateLoads.js";\n',
'import helper'
)

rep(
'  const erroresPartes=[];\n  const erroresHoro=[];\n',
'  const erroresPartes=[];\n  const erroresHoro=[];\n  const erroresDuplicados=detectRop02DuplicateLoads(rows);\n',
'errores duplicados init'
)

rep(
'  return{erroresPartes,erroresHoro};\n',
'  return{erroresPartes,erroresHoro,erroresDuplicados};\n',
'return duplicate errors'
)

rep(
'''  const todosErrores=useMemo(()=>[\n    ...control.erroresPartes.map(error=>({...error,_tipo:"Numeración"})),\n    ...control.erroresHoro.map(error=>({...error,_tipo:"Horómetro"})),\n  ].sort((a,b)=>(a.fecha||"").localeCompare(b.fecha||"")||String(a.maquina||"").localeCompare(String(b.maquina||""))),[control]);\n''',
'''  const todosErrores=useMemo(()=>[\n    ...control.erroresPartes.map(error=>({...error,_tipo:"Numeración"})),\n    ...control.erroresHoro.map(error=>({...error,_tipo:"Horómetro"})),\n    ...control.erroresDuplicados.map(error=>({...error,_tipo:"Carga duplicada"})),\n  ].sort((a,b)=>(a.fecha||"").localeCompare(b.fecha||"")||String(a.maquina||"").localeCompare(String(b.maquina||""))),[control]);\n''',
'todos errores'
)

rep(
'''  const erroresTabla=tipo==="numeracion"\n    ?control.erroresPartes.map(error=>({...error,_tipo:"Numeración"}))\n    :tipo==="horometros"\n      ?control.erroresHoro.map(error=>({...error,_tipo:"Horómetro"}))\n      :todosErrores;\n''',
'''  const erroresTabla=tipo==="numeracion"\n    ?control.erroresPartes.map(error=>({...error,_tipo:"Numeración"}))\n    :tipo==="horometros"\n      ?control.erroresHoro.map(error=>({...error,_tipo:"Horómetro"}))\n      :tipo==="duplicadas"\n        ?control.erroresDuplicados.map(error=>({...error,_tipo:"Carga duplicada"}))\n        :todosErrores;\n''',
'filtro tipo'
)

rep(
'  const pendientesHorometro=useMemo(()=>control.erroresHoro.filter(error=>!aceptadosPorClave.has(errorAcceptanceKey({...error,_tipo:"Horómetro"}))).length,[control.erroresHoro,aceptadosPorClave]);\n',
'  const pendientesHorometro=useMemo(()=>control.erroresHoro.filter(error=>!aceptadosPorClave.has(errorAcceptanceKey({...error,_tipo:"Horómetro"}))).length,[control.erroresHoro,aceptadosPorClave]);\n  const pendientesDuplicados=useMemo(()=>control.erroresDuplicados.filter(error=>!aceptadosPorClave.has(errorAcceptanceKey({...error,_tipo:"Carga duplicada"}))).length,[control.erroresDuplicados,aceptadosPorClave]);\n',
'contador duplicados'
)

rep(
'''    if(tipo==="numeracion"&&error.tipo!=="Numeración")return false;\n    if(tipo==="horometros"&&error.tipo!=="Horómetro")return false;\n''',
'''    if(tipo==="numeracion"&&error.tipo!=="Numeración")return false;\n    if(tipo==="horometros"&&error.tipo!=="Horómetro")return false;\n    if(tipo==="duplicadas"&&error.tipo!=="Carga duplicada")return false;\n''',
'accepted duplicate filter'
)

rep(
'''          <Sel label="Tipo de error" value={tipo} onChange={value=>set("tipo",value)} options={[{value:"todos",label:"Todos"},{value:"numeracion",label:"Numeración"},{value:"horometros",label:"Horómetros"}]}/>\n''',
'''          <Sel label="Tipo de error" value={tipo} onChange={value=>set("tipo",value)} options={[{value:"todos",label:"Todos"},{value:"numeracion",label:"Numeración"},{value:"horometros",label:"Horómetros"},{value:"duplicadas",label:"Cargas duplicadas"}]}/>\n''',
'select duplicate filter'
)

rep(
'''        <StatCard icon="hours" label="Horómetros pendientes" value={fmtNum(pendientesHorometro)} sub="Cortes entre días registrados" color={pendientesHorometro?C.red:C.green} small/>\n        <StatCard icon="check" label="Errores aceptados" value={fmtNum(erroresAceptadosTabla.length)} sub="Con justificación registrada" color={C.green} small/>\n''',
'''        <StatCard icon="hours" label="Horómetros pendientes" value={fmtNum(pendientesHorometro)} sub="Cortes entre días registrados" color={pendientesHorometro?C.red:C.green} small/>\n        <StatCard icon="warn" label="Cargas duplicadas" value={fmtNum(pendientesDuplicados)} sub="Máximo TD + TN por equipo/día" color={pendientesDuplicados?C.red:C.green} small/>\n        <StatCard icon="check" label="Errores aceptados" value={fmtNum(erroresAceptadosTabla.length)} sub="Con justificación registrada" color={C.green} small/>\n''',
'duplicate stat card'
)

rep(
'''                <tbody>{erroresPendientes.map((error,index)=>{\n                  const esParte=error._tipo==="Numeración";\n                  return <tr key={errorAcceptanceKey(error)} style={{background:index%2===0?C.red+"0a":"transparent"}}>\n''',
'''                <tbody>{erroresPendientes.map((error,index)=>{\n                  const esParte=error._tipo==="Numeración";\n                  const esDuplicada=error._tipo==="Carga duplicada";\n                  const datoInformado=esParte?"#"+error.numeroIncorrecto:esDuplicada?`${error.cargasDetectadas||error.numeroIncorrecto} cargas (${error.turnosDetectados||error.turno||"—"})`:fmtNum(error.hiActual);\n                  const datoEsperado=esParte?"#"+error.numeroCorrecto:esDuplicada?"TD + TN (máx. 2)":fmtNum(error.hfAnterior);\n                  const diferencia=esDuplicada?(Number(error.diff)>0?`+${error.diff} carga${Number(error.diff)===1?"":"s"}`:"Turno repetido"):(error.diff>0?"+"+fmtNum(error.diff):fmtNum(error.diff));\n                  const referencia=esDuplicada?`Partes: ${error.partesDetectados||error.parteAnterior||"—"}`:`${fmtFecha(error.fechaAnterior)} · ${error.turnoAnterior||"—"} · #${error.parteAnterior||"—"}`;\n                  return <tr key={errorAcceptanceKey(error)} style={{background:index%2===0?C.red+"0a":"transparent"}}>\n''',
'duplicate row variables'
)

rep(
'''                    <td style={{...td,color:C.red,fontWeight:900}}>{esParte?"#"+error.numeroIncorrecto:fmtNum(error.hiActual)}</td>\n                    <td style={{...td,color:C.yellow,fontWeight:900}}>{esParte?"#"+error.numeroCorrecto:fmtNum(error.hfAnterior)}</td>\n                    <td style={td}><Badge color={error.diff>0?C.yellow:C.red}>{error.diff>0?"+"+fmtNum(error.diff):fmtNum(error.diff)}</Badge></td>\n                    <td style={td}>{fmtFecha(error.fechaAnterior)} · {error.turnoAnterior||"—"} · #{error.parteAnterior||"—"}</td>\n''',
'''                    <td style={{...td,color:C.red,fontWeight:900}}>{datoInformado}</td>\n                    <td style={{...td,color:C.yellow,fontWeight:900}}>{datoEsperado}</td>\n                    <td style={td}><Badge color={esDuplicada?C.red:error.diff>0?C.yellow:C.red}>{diferencia}</Badge></td>\n                    <td style={td}>{referencia}</td>\n''',
'duplicate row values'
)

rep(
'''    const data=[cols,...erroresPendientes.map(error=>[error._tipo,error.proyecto,error.maquina,error.fecha,error.turno,error.supervisor,error.numeroIncorrecto||error.parte||"",error.numeroIncorrecto||error.hiActual||"",error.numeroCorrecto||error.hfAnterior||"",error.diff,error.fechaAnterior||"",error.turnoAnterior||"",error.parteAnterior||"",error.detalle||""])];\n''',
'''    const data=[cols,...erroresPendientes.map(error=>{\n      const duplicada=error._tipo==="Carga duplicada";\n      return [error._tipo,error.proyecto,error.maquina,error.fecha,error.turno,error.supervisor,error.numeroIncorrecto||error.parte||"",duplicada?`${error.cargasDetectadas||error.numeroIncorrecto} cargas (${error.turnosDetectados||error.turno||"—"})`:error.numeroIncorrecto||error.hiActual||"",duplicada?"TD + TN (máx. 2)":error.numeroCorrecto||error.hfAnterior||"",duplicada&&Number(error.diff)===0?"Turno repetido":error.diff,error.fechaAnterior||"",error.turnoAnterior||"",error.parteAnterior||"",error.detalle||""];\n    })];\n''',
'export duplicate rows'
)

p.write_text(s,encoding='utf-8')
print('patched OficinaTecnicaModule.jsx')
