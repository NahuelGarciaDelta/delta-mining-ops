from pathlib import Path
p=Path('src/modules/mantenimiento/MantenimientoProgramadoView.jsx')
s=p.read_text(encoding='utf-8')
old='''    } catch (err) {\n      appAlert?.(err.message);\n    } finally {\n      if (!silent) setLoading(false);\n    }\n'''
new='''    } catch (err) {\n      if (!silent) appAlert?.(err.message);\n      else console.warn("No se pudo completar la recarga silenciosa de Mantenimiento Programado:", err);\n    } finally {\n      if (!silent) setLoading(false);\n    }\n'''
if old not in s:
    raise SystemExit('No se encontró el catch de load esperado')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')
print('PM silent refresh patched')
