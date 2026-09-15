from pathlib import Path
import shutil
orig=Path('scripts/temp-migrate-abastecimiento-original.py')
code=orig.read_text()
orig.unlink()
old="""if old_card not in s: raise SystemExit('No se encontró tarjeta Ítems con salida')\ns=s.replace(old_card,new_card,1)"""
new="""if old_card in s: s=s.replace(old_card,new_card,1)\nif new_card not in s: raise SystemExit('La referencia no contiene la tarjeta Ítems con salida corregida')"""
if old not in code: raise SystemExit('No se pudo ajustar la validación de la tarjeta')
code=code.replace(old,new,1)
exec(compile(code,'scripts/temp-migrate-abastecimiento-original.py','exec'))
ref_test=Path('/tmp/delta-supabase/tests/abastecimiento-fifo.test.mjs')
if not ref_test.exists(): raise SystemExit('Falta test FIFO de referencia')
shutil.copy2(ref_test,Path('tests/enviosSinSolicitud.test.mjs'))
print('Test histórico de envíos actualizado a la API FIFO de Supabase.')
