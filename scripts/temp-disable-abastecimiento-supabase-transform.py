from pathlib import Path
import re

p=Path('scripts/abastecimiento-instant-vite-plugin.mjs')
s=p.read_text()
original=s

# 1) No inyectar imports de lectura Supabase en Abastecimiento.
s,n=re.subn(
    r'''\n      next=next\.replace\(\n        'import \{ registerRefreshTask \} from "\.\./\.\./services/refreshManager\.js";',\n        'import \{ registerRefreshTask \} from "\.\./\.\./services/refreshManager\.js";\\nimport \{ fetchRaba03FromSupabase, fetchAbastecimientoSnapshot \} from "\.\./\.\./services/raba03ReadApi\.js";'\n      \);''',
    '',s,count=1)
if n!=1: raise SystemExit(f'import Supabase replacement count={n}')

# 2) Conservar la lectura RABA03 original por Apps Script.
s,n=re.subn(
    r'''\n      next=next\.replace\(\n        'const url=`\$\{APPS_SCRIPT_URL\}\?action=raba03&limit=all&_=`?[^\n]*?\n.*?fetchRaba03FromSupabase\(\);'\n      \);''',
    '',s,count=1,flags=re.S)
# El patrón anterior puede variar por escapes; fallback delimitado por contenido.
if n!=1:
    start=s.find("      next=next.replace(\n        'const url=`${APPS_SCRIPT_URL}?action=raba03&limit=all&_=${Date.now()}`;")
    if start<0: raise SystemExit('No se encontró replacement RABA03->Supabase')
    end=s.find("      );",start)
    if end<0: raise SystemExit('No se encontró fin replacement RABA03->Supabase')
    block=s[start:end+8]
    if 'fetchRaba03FromSupabase' not in block: raise SystemExit('Bloque RABA03 inesperado')
    s=s[:start]+s[end+8:]

# 3) Conservar la lectura de remitos original por Apps Script.
start=s.find("      next=next.replace(\n        '      const url=`${APPS_SCRIPT_URL}?action=remitos_cargados")
if start<0: raise SystemExit('No se encontró replacement remitos->Supabase')
end=s.find("      );",start)
if end<0: raise SystemExit('No se encontró fin replacement remitos->Supabase')
block=s[start:end+8]
if 'fetchAbastecimientoSnapshot' not in block: raise SystemExit('Bloque remitos inesperado')
s=s[:start]+s[end+8:]

# 4) Cambiar las guardas finales: Apps Script debe permanecer en el código transformado.
old='''      if(!next.includes('fetchRaba03FromSupabase')||!next.includes('fetchAbastecimientoSnapshot')||!next.includes('RABA03_VIEW_CACHE_KEY')){\n        throw new Error('No se pudo aplicar la optimización Supabase/cache de Abastecimiento');\n      }\n      if(next.includes('action=remitos_cargados')){\n        throw new Error('Abastecimiento no debe volver a leer remitos pesados desde Apps Script');\n      }'''
new='''      if(!next.includes('RABA03_VIEW_CACHE_KEY')){\n        throw new Error('No se pudo aplicar la caché local de Abastecimiento');\n      }\n      if(!next.includes('action=raba03')||!next.includes('action=remitos_cargados')||!next.includes('action=estados_solicitudes')){\n        throw new Error('Abastecimiento debe conservar todas sus lecturas por Apps Script');\n      }\n      if(next.includes('fetchRaba03FromSupabase')||next.includes('fetchAbastecimientoSnapshot')){\n        throw new Error('Abastecimiento no debe reinyectar lecturas Supabase');\n      }'''
if old not in s: raise SystemExit('No se encontró guarda Supabase final')
s=s.replace(old,new,1)

if s==original: raise SystemExit('No hubo cambios')
p.write_text(s)
print('Plugin Abastecimiento: Supabase read transforms removidos; dashboard/cache conservados.')
