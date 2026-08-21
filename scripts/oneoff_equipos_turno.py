from pathlib import Path

path = Path('src/modules/oficina-tecnica/OficinaTecnicaModule.jsx')
s = path.read_text(encoding='utf-8')

start = s.find('function ViewROP02(')
if start < 0:
    raise SystemExit('ViewROP02 not found')
end = s.find('\nfunction ', start + 1)
if end < 0:
    end = len(s)
section = s[start:end]

# 1) Turno participa del mismo motor facetado que Proyecto/Maquina/Supervisor/Operario.
turno_field = '    {key:"turno",defaultVal:"todos"},\n'
if turno_field not in section:
    anchor = '    {key:"proyecto",defaultVal:"todos"},\n'
    if section.count(anchor) != 1:
        raise SystemExit(f'Unexpected proyecto filter anchors in ViewROP02: {section.count(anchor)}')
    section = section.replace(anchor, anchor + turno_field, 1)

# 2) Mostrar el selector en la barra principal de filtros de Equipos.
turno_ui = '            <MultiSel label="Turno" value={vals.turno} onChange={v=>{set("turno",v);setEstado("todos");}} options={[{value:"todos",label:"Todos"},...opts.turno.map(t=>{const u=String(t||"").trim().toUpperCase();return{value:t,label:(u.includes("NOCHE")||u==="TN")?"Turno Noche":(u.includes("DIA")||u==="TD")?"Turno Día":t};})]}/>\n'
if 'label="Turno" value={vals.turno}' not in section:
    anchor = '            <MultiSel label="Proyecto" value={vals.proyecto} onChange={v=>{set("proyecto",v);setEstado("todos");}} options={[{value:"todos",label:"Todos"},...opts.proyecto.map(p=>({value:p,label:p}))]}/>\n'
    if section.count(anchor) != 1:
        raise SystemExit(f'Unexpected Proyecto UI anchors in ViewROP02: {section.count(anchor)}')
    section = section.replace(anchor, anchor + turno_ui, 1)

# Safety checks before writing.
if '{key:"turno",defaultVal:"todos"}' not in section:
    raise SystemExit('Turno field was not added to faceted filters')
if 'label="Turno" value={vals.turno}' not in section:
    raise SystemExit('Turno selector was not added to Equipos UI')

s = s[:start] + section + s[end:]
path.write_text(s, encoding='utf-8')
print('Equipos turno filter added successfully.')
