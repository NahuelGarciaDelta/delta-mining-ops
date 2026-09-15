from pathlib import Path

p=Path('scripts/abastecimiento-instant-vite-plugin.mjs')
s=p.read_text()
old="""      if(!next.includes('sol.descripcion===descripcionNormalizada')||!next.includes('sol.fechaMs<=fechaMs')){
        throw new Error('Envíos sin solicitud perdió su clave histórica o la barrera temporal');
      }"""
new="""      if(next.includes('sol.descripcion===descripcionNormalizada')||!next.includes('sol.fechaMs<=fechaMs')||!next.includes('(!proyecto||!sol.proyecto||sol.proyecto===proyecto)')){
        throw new Error('Envíos sin solicitud debe conservar código + proyecto + barrera temporal, sin exigir descripción exacta');
      }"""
if old not in s:
    raise SystemExit('No se encontró la guarda histórica del plugin')
s=s.replace(old,new,1)
p.write_text(s)

# Ajustar el assertion del test histórico al contrato nuevo de la guarda.
p=Path('tests/abastecimiento-allocation-regression.test.mjs')
s=p.read_text()
s=s.replace("assert.match(plugin,/Envíos sin solicitud perdió su clave histórica/);","assert.match(plugin,/Envíos sin solicitud debe conservar código \\+ proyecto \\+ barrera temporal/);",1)
p.write_text(s)

# Este test quedó de la etapa Supabase y debe validar el transporte Apps Script actual.
p=Path('tests/abastecimiento-envios-parity.test.mjs')
p.write_text('''import test from "node:test";\nimport assert from "node:assert/strict";\nimport fs from "node:fs";\nimport path from "node:path";\nimport { fileURLToPath } from "node:url";\nimport { abastecimientoInstantVitePlugin } from "../scripts/abastecimiento-instant-vite-plugin.mjs";\n\nconst __dirname = path.dirname(fileURLToPath(import.meta.url));\nconst modulePath = path.resolve(__dirname, "../src/modules/abastecimiento/AbastecimientoModule.jsx");\n\ntest("OPS mantiene Envíos sin solicitud por código + proyecto + fecha sobre Apps Script", () => {\n  const source = fs.readFileSync(modulePath, "utf8");\n  const plugin = abastecimientoInstantVitePlugin();\n  const transformed = plugin.transform(source, modulePath.replace(/\\\\/g, "/"));\n  const code = transformed?.code || source;\n\n  assert.match(code, /action=raba03/);\n  assert.match(code, /action=remitos_cargados/);\n  assert.match(code, /sol\\.fechaMs<=fechaMs/);\n  assert.match(code, /\\(!proyecto\\|\\|!sol\\.proyecto\\|\\|sol\\.proyecto===proyecto\\)/);\n  assert.doesNotMatch(code, /sol\\.descripcion===descripcionNormalizada/);\n  assert.doesNotMatch(code, /fetchRaba03FromSupabase/);\n  assert.doesNotMatch(code, /fetchAbastecimientoSnapshot/);\n  assert.match(code, /RABA03_VIEW_CACHE_KEY/);\n});\n''')
print('Guardas y tests de paridad Apps Script actualizados.')
