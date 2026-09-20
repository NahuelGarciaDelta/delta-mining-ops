import test from 'node:test'
import assert from 'node:assert/strict'
import { informeCostosResumenCategoriasVitePlugin } from '../scripts/informe-costos-resumen-categorias-vite-plugin.mjs'

const source = `
function Demo(){
  const resumenFiltroRows=React.useMemo(()=>{
    return (rowsAmortizacionOrdenadas||[]).map(x=>{
      const tipoLabel=normalizarCategoriaTexto(x?.tipo)||"";
      if(!tipoLabel||!categoriasAmortizacionSet.has(tipoLabel))return null;
      return {...x,_resumenTipoValue:tipoLabel};
    }).filter(Boolean);
  },[]);

  const resumenTipoOptions=React.useMemo(()=>[
    {value:"todos",label:"Todos los tipos"},
    ...(categoriasAmortizacionDisponibles||[]).map(categoria=>({value:categoria,label:categoria}))
  ],[categoriasAmortizacionDisponibles]);

  for(const row of rowsHistoricas){
    const maquinaResumen=normalizarCategoriaTexto(row.tipo)||"";
      if(!maquinaResumen||!categoriasAmortizacionSet.has(maquinaResumen))continue;
    salida.push(row);
  }
  return salida;
}
`

test('los resúmenes conservan categorías efectivas de Amortización', () => {
  const plugin=informeCostosResumenCategoriasVitePlugin()
  const result=plugin.transform(source,'C:/repo/src/modules/informe-costos/InformeCostosView.jsx')
  assert.ok(result?.code)
  assert.equal(result.code.includes('categoriasAmortizacionSet.has(tipoLabel)'),false)
  assert.equal(result.code.includes('categoriasAmortizacionSet.has(maquinaResumen)'),false)
  assert.match(result.code,/if\(!tipoLabel\)return null;/)
  assert.match(result.code,/if\(!maquinaResumen\)continue;/)
  assert.match(result.code,/\.\.\.\(resumenFiltroRows\|\|\[\]\)\.map\(x=>x\._resumenTipoValue\)/)
  assert.match(result.code,/categoriasAmortizacionDisponibles,resumenFiltroRows,normalizarCategoriaTexto/)
})

test('no modifica archivos ajenos al Informe de Costos', () => {
  const plugin=informeCostosResumenCategoriasVitePlugin()
  assert.equal(plugin.transform(source,'C:/repo/src/App.jsx'),null)
})

test('falla explícitamente si cambia la estructura esperada', () => {
  const plugin=informeCostosResumenCategoriasVitePlugin()
  assert.throws(
    ()=>plugin.transform('const x=1','/repo/src/modules/informe-costos/InformeCostosView.jsx'),
    /No se encontró el bloque esperado/
  )
})
