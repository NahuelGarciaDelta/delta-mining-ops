from pathlib import Path
import re

p = Path('src/modules/abastecimiento/AbastecimientoModule.jsx')
s = p.read_text(encoding='utf-8')

marker = 'const RABA03_CLOSED_STORAGE_KEY = "dm_raba03_solicitudes_cerradas_manual_v1";\n'
helper = '''const parseChronoDateMs=(value)=>{\n  const raw=String(value||"").trim();\n  if(!raw)return 0;\n  let m=raw.match(/^(\\d{4})-(\\d{1,2})-(\\d{1,2})/);\n  if(m)return new Date(Number(m[1]),Number(m[2])-1,Number(m[3])).getTime();\n  m=raw.match(/^(\\d{1,2})[\\/-](\\d{1,2})[\\/-](\\d{2}|\\d{4})/);\n  if(m){let y=Number(m[3]);if(y<100)y+=2000;return new Date(y,Number(m[2])-1,Number(m[1])).getTime();}\n  const d=new Date(raw);\n  return Number.isNaN(d.getTime())?0:d.getTime();\n};\n'''
if 'const parseChronoDateMs=' not in s:
    assert marker in s
    s = s.replace(marker, marker + helper, 1)

def patch_section(text, start_marker, end_marker, row_var):
    a = text.find(start_marker)
    assert a >= 0, start_marker
    b = text.find(end_marker, a)
    assert b > a, end_marker
    section = text[a:b]
    old = 'const matches=[...(remitosByCode[`${code}__${proyecto}`]||[])];'
    assert old in section, f'matches not found in {start_marker}'
    new = '''const matches=[...(remitosByCode[`${code}__${proyecto}`]||[])].filter(m=>{\n          const solicitudMs=parseChronoDateMs(__ROW__.fechaSolicitud);\n          const remitoMs=parseChronoDateMs(m.fecha);\n          return !solicitudMs||!remitoMs||remitoMs>=solicitudMs;\n        });'''.replace('__ROW__', row_var)
    section = section.replace(old, new, 1)
    return text[:a] + section + text[b:]

s = patch_section(s, 'const guardarDatosRABA03=useCallback', 'const guardarCodigosRABA03=useCallback', 'r')
s = patch_section(s, 'const raba03DownloadRows=useMemo', 'const progressiveRaba03Rows=', 'row')
s = patch_section(s, 'const raba03DashboardRows=useMemo', 'const abastecimientoDashboardData=useMemo', 'row')

pattern = re.compile(r'  const enviosSinSolicitudRows=useMemo\(\(\)=>\{.*?\n  \},\[rows,remitos,normCode,toNumber,parseRabaDateMs\]\);', re.S)
m = pattern.search(s)
assert m, 'enviosSinSolicitudRows block not found'
replacement = '''  const enviosSinSolicitudRows=useMemo(()=>{\n    const solicitudesHistoricas=(rows||[]).map(r=>({\n      codigo:normCode(r.codigoArticulo),\n      proyecto:normalizeCentroCosto(r.centroCosto),\n      fechaMs:parseChronoDateMs(r.fechaSolicitud)\n    })).filter(r=>r.codigo);\n    const out=[];\n    (remitos||[]).forEach(rem=>{\n      const fecha=rem.fecha||"";\n      const fechaMs=parseChronoDateMs(fecha);\n      const proyecto=normalizeCentroCosto(rem.proyecto||rem.observaciones||rem.destino||rem.centroCosto||rem.origen||"");\n      (rem.items||[]).forEach((item,index)=>{\n        const codigoNormalizado=normCode(item.codigo);\n        if(!codigoNormalizado)return;\n        const teniaSolicitudAlEnviar=solicitudesHistoricas.some(sol=>\n          sol.codigo===codigoNormalizado&&\n          (!proyecto||!sol.proyecto||sol.proyecto===proyecto)&&\n          (!sol.fechaMs||!fechaMs||sol.fechaMs<=fechaMs)\n        );\n        if(teniaSolicitudAlEnviar)return;\n        out.push({\n          id:`${rem.id||rem.comprobante||"remito"}-${index}-${codigoNormalizado}`,\n          codigoArticulo:String(item.codigo||"").trim(),\n          descripcion:String(item.descripcion||"").trim(),\n          proyecto:proyecto||"SIN PROYECTO",\n          cantidadEnviada:toNumber(item.cantidad),\n          fechaEnvio:fecha,\n          numeroRemito:rem.comprobante||""\n        });\n      });\n    });\n    return out.sort((a,b)=>{\n      const fa=parseChronoDateMs(a.fechaEnvio),fb=parseChronoDateMs(b.fechaEnvio);\n      if(fa!==fb)return fb-fa;\n      return String(a.codigoArticulo||"").localeCompare(String(b.codigoArticulo||""),"es",{numeric:true,sensitivity:"base"});\n    });\n  },[rows,remitos,normCode,toNumber,normalizeCentroCosto]);'''
s = s[:m.start()] + replacement + s[m.end():]

old = '''      ["Código de artículo","Descripción","Remito","Cant. enviada","Fecha de envío"],\n      ...enviosSinSolicitudRows.map(r=>[r.codigoArticulo,r.descripcion,r.numeroRemito||"",r.cantidadEnviada,formatDateLocal(r.fechaEnvio)])'''
new = '''      ["Código de artículo","Descripción","Proyecto","Remito","Cant. enviada","Fecha de envío"],\n      ...enviosSinSolicitudRows.map(r=>[r.codigoArticulo,r.descripcion,r.proyecto||"SIN PROYECTO",r.numeroRemito||"",r.cantidadEnviada,formatDateLocal(r.fechaEnvio)])'''
assert old in s
s = s.replace(old, new, 1)
s = s.replace('ws["!cols"]=[{wch:18},{wch:52},{wch:20},{wch:16},{wch:16}];', 'ws["!cols"]=[{wch:18},{wch:46},{wch:18},{wch:20},{wch:16},{wch:16}];', 1)

old = '''      {key:"codigoArticulo",label:"Código de artículo",width:"16%"},\n      {key:"descripcion",label:"Descripción",width:"47%"},\n      {key:"numeroRemito",label:"Remito",width:"15%"},'''
new = '''      {key:"codigoArticulo",label:"Código de artículo",width:"13%"},\n      {key:"descripcion",label:"Descripción",width:"34%"},\n      {key:"proyecto",label:"Proyecto",width:"15%"},\n      {key:"numeroRemito",label:"Remito",width:"15%"},'''
assert old in s
s = s.replace(old, new, 1)

old = '''                  <td style={{...tdStyle,paddingLeft:10,paddingRight:10,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}} title={r.descripcion||""}>{r.descripcion||"—"}</td>\n                  <td style={{...tdStyle,paddingLeft:10,paddingRight:10,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontWeight:800}} title={r.numeroRemito||""}>{r.numeroRemito||"—"}</td>'''
new = '''                  <td style={{...tdStyle,paddingLeft:10,paddingRight:10,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}} title={r.descripcion||""}>{r.descripcion||"—"}</td>\n                  <td style={{...tdStyle,paddingLeft:10,paddingRight:10,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontWeight:800}} title={r.proyecto||""}>{r.proyecto||"SIN PROYECTO"}</td>\n                  <td style={{...tdStyle,paddingLeft:10,paddingRight:10,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontWeight:800}} title={r.numeroRemito||""}>{r.numeroRemito||"—"}</td>'''
assert old in s
s = s.replace(old, new, 1)
s = s.replace('Artículos cargados mediante remitos cuyo código no existe en ninguna solicitud RABA03.', 'Artículos cargados mediante remitos para los que no existía una solicitud RABA03 previa al momento del envío.', 1)

for check in ['parseChronoDateMs', 'proyecto:proyecto||"SIN PROYECTO"', 'sol.fechaMs<=fechaMs', 'remitoMs>=solicitudMs', '{key:"proyecto",label:"Proyecto"']:
    assert check in s, check

p.write_text(s, encoding='utf-8')
print('Historical unmatched shipment fix applied.')
