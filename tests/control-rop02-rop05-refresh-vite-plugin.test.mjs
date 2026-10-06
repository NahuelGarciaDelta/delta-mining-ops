import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { controlRop02Rop05RefreshVitePlugin } from '../scripts/control-rop02-rop05-refresh-vite-plugin.mjs'

const source = `
import {getRop02,getRop05,getRop02LatestByEquipmentProject} from "../../data/historicalDataService.js";
function Demo(){
  const loadFullDataset=useCallback(async(dataset,{force=false}={})=>{
    const task=(async()=>{
      const getter=dataset==="rop02"?getRop02:getRop05;
      const result=await getter({
        limit:"all",
        offset:0,
        sortBy:"fecha",
        sortDirection:"desc"
      });
      return result.data;
    })();
    return task;
  },[]);
  const [controlRemote,setControlRemote]=useState({loaded:false,rop02:[],rop05:[]});
  const controlLive=useMemo(
    ()=>controlRemote.loaded?calcControl(controlRemote.rop02,controlRemote.rop05):control,
    [controlRemote,control]
  );
}
`

function assertRefreshInjection(out){
  assert.match(out,/refreshHistoricalDataset\(dataset,query\)/)
  assert.match(out,/registerRefreshTask\("oficina-control-rop02-rop05-refresh"/)
  assert.match(out,/loadFullDataset\("rop02",\{force:true\}\)/)
  assert.match(out,/loadFullDataset\("rop05",\{force:true\}\)/)
  assert.match(out,/setControlRemote\(\{loaded:true,rop02:next02,rop05:next05\}\)/)
}

test('Actualizar fuerza ROP02 y ROP05 desde la fuente y actualiza controlRemote',()=>{
  const plugin=controlRop02Rop05RefreshVitePlugin()
  const out=plugin.transform(source,'C:/repo/src/modules/oficina-tecnica/OficinaTecnicaModule.jsx')?.code||''
  assertRefreshInjection(out)
})

test('acepta checkout CRLF sin cambiar la semántica inyectada',()=>{
  const plugin=controlRop02Rop05RefreshVitePlugin()
  const crlf=source.replace(/\n/g,'\r\n')
  const out=plugin.transform(crlf,'C:\\repo\\src\\modules\\oficina-tecnica\\OficinaTecnicaModule.jsx')?.code||''
  assert.equal(out.includes('\r\n'),false)
  assertRefreshInjection(out)
})

test('transforma el OficinaTecnicaModule real del repositorio',async()=>{
  const plugin=controlRop02Rop05RefreshVitePlugin()
  const actual=await readFile(new URL('../src/modules/oficina-tecnica/OficinaTecnicaModule.jsx',import.meta.url),'utf8')
  const out=plugin.transform(actual,'/repo/src/modules/oficina-tecnica/OficinaTecnicaModule.jsx')?.code||''
  assertRefreshInjection(out)
})

test('no toca otros módulos',()=>{
  const plugin=controlRop02Rop05RefreshVitePlugin()
  assert.equal(plugin.transform(source,'C:/repo/src/App.jsx'),null)
})

test('falla si cambia la estructura esperada',()=>{
  const plugin=controlRop02Rop05RefreshVitePlugin()
  assert.throws(()=>plugin.transform('const x=1','/repo/src/modules/oficina-tecnica/OficinaTecnicaModule.jsx'),/No se encontró el bloque esperado/)
})
