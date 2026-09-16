const normalizeId=id=>String(id||"").replace(/\\/g,"/").split("?")[0];
const APP_FILE="/src/App.jsx";

const replacement=`  // Normalización incremental por dataset.
  // Una actualización silenciosa de una fuente ya no vuelve a procesar ROP02,
  // ROP05, RMA15, insumos y Lista Maestra completos si sus objetos no cambiaron.
  const normalizedSourcesRef=useRef({
    proyectoUsuario:undefined,
    rop05Source:undefined,
    rop05Raw:[],
    rop02_fs:undefined,
    rop02_jm:undefined,
    rop02_filosur:undefined,
    rop02_zorro:undefined,
    normalizedRop02:[],
    insumosSource:undefined,
    insumosMap:{},
    rma15_fs:undefined,
    rma15_jm:undefined,
    lista_equipos:undefined,
  });
  useEffect(()=>{
    const src=rawSources||{};
    const cache=normalizedSourcesRef.current;
    const errs=[];
    const projectChanged=cache.proyectoUsuario!==proyectoUsuario;

    if(src.rop05&&!src.rop05.ok)errs.push({source:"ROP05",...src.rop05.error});
    if(src.rop02_fs&&!src.rop02_fs.ok)errs.push({source:"ROP02 — Filo del Sol",...src.rop02_fs.error});
    if(src.rop02_jm&&!src.rop02_jm.ok)errs.push({source:"ROP02 — José María",...src.rop02_jm.error});
    if(src.rop02_filosur&&!src.rop02_filosur.ok)errs.push({source:"ROP02 — Filo Sur",...src.rop02_filosur.error});
    if(src.rop02_zorro&&!src.rop02_zorro.ok)errs.push({source:"ROP02 — El Zorro",...src.rop02_zorro.error});
    if(src.rma15_fs&&!src.rma15_fs.ok)errs.push({source:"RMA15 — Filo del Sol",...src.rma15_fs.error});
    if(src.rma15_jm&&!src.rma15_jm.ok)errs.push({source:"RMA15 — José María",...src.rma15_jm.error});
    if(src.lista_equipos&&!src.lista_equipos.ok)errs.push({source:"Lista Maestra de Equipos",...src.lista_equipos.error});

    const rop05Changed=cache.rop05Source!==src.rop05;
    let rop05Raw=cache.rop05Raw||[];
    if(rop05Changed){
      rop05Raw=src.rop05?.ok&&src.rop05.data?normalizeROP05(src.rop05.data):[];
      cache.rop05Source=src.rop05;
      cache.rop05Raw=rop05Raw;
      if(rop05Raw.length)buildTareaMap(rop05Raw.map(r=>r.tarea).filter(Boolean));
    }
    if(rop05Changed||projectChanged){
      if(rop05Raw.length){
        setRop05(rop05Raw.filter(r=>dmProjectMatches(r.proyecto,proyectoUsuario)).map(r=>({...r,maquina:resolveEquipmentCodeAlias(r.maquina),tarea:normTarea(r.tarea)})));
      }else if(src.rop05){
        setRop05([]);
      }
    }

    const rop02Changed=rop05Changed||
      cache.rop02_fs!==src.rop02_fs||cache.rop02_jm!==src.rop02_jm||
      cache.rop02_filosur!==src.rop02_filosur||cache.rop02_zorro!==src.rop02_zorro;
    let normalizedRop02=cache.normalizedRop02||[];
    if(rop02Changed){
      const rFS=src.rop02_fs?.ok&&src.rop02_fs.data?normalizeROP02(src.rop02_fs.data,"FILO DEL SOL"):[];
      const rJM=src.rop02_jm?.ok&&src.rop02_jm.data?normalizeROP02(src.rop02_jm.data,"JOSE MARIA"):[];
      const rFSur=src.rop02_filosur?.ok&&src.rop02_filosur.data?normalizeROP02(src.rop02_filosur.data,"FILO SUR"):[];
      const rZorro=src.rop02_zorro?.ok&&src.rop02_zorro.data?normalizeROP02(src.rop02_zorro.data,"EL ZORRO"):[];
      const allRop02=[...rFS,...rJM,...rFSur,...rZorro];
      if(allRop02.length||src.rop02_fs||src.rop02_jm||src.rop02_filosur||src.rop02_zorro){
        const allNames=[...allRop02.map(r=>r.supervisor),...allRop02.map(r=>r.operario),...rop05Raw.map(r=>r.supervisor)].filter(Boolean);
        buildCanonicalMap(allNames);
        normalizedRop02=allRop02.map(r=>({...r,maquina:resolveEquipmentCodeAlias(r.maquina),supervisor:normName(r.supervisor),operario:normName(r.operario)}));
        setRop02ControlAll(normalizedRop02);
      }else normalizedRop02=[];
      cache.normalizedRop02=normalizedRop02;
      cache.rop02_fs=src.rop02_fs;
      cache.rop02_jm=src.rop02_jm;
      cache.rop02_filosur=src.rop02_filosur;
      cache.rop02_zorro=src.rop02_zorro;
    }
    if(rop02Changed||projectChanged){
      setRop02All(normalizedRop02.filter(r=>dmProjectMatches(r.proyecto,proyectoUsuario)));
    }

    const insumosChanged=cache.insumosSource!==src.insumos;
    let insumosMap=cache.insumosMap||{};
    if(insumosChanged){
      insumosMap={};
      if(src.insumos?.ok&&src.insumos.data){
        src.insumos.data.forEach(r=>{
          const cod=normalizeInsumoCode(getValue(r,["CODIGO","Codigo","Código","codigo","código","Cod","cod"])||"");
          if(cod){
            const descripcion=String(getValue(r,["DESCRIPCIÓN","DESCRIPCION","Descripción","Descripcion","descripcion","Artículo","Articulo","ARTICULO","Insumo","Nombre"])||"").trim();
            insumosMap[cod]={
              descripcion,
              descripcionAdicional:getInsumoExtra(r,descripcion),
              costoUnitario:toMoneyNumber(getValue(r,["COSTO UNITARIO","Costo Unitario","Costo unitario","Precio unitario con IVA","PRECIO UNITARIO CON IVA","precio unitario con IVA","Precio unitario","PRECIO UNITARIO","Precio","PRECIO","Costo","COSTO"])),
            };
          }
        });
        setInsumos(insumosMap);
      }
      cache.insumosSource=src.insumos;
      cache.insumosMap=insumosMap;
    }

    const rmaChanged=insumosChanged||cache.rma15_fs!==src.rma15_fs||cache.rma15_jm!==src.rma15_jm;
    if(rmaChanged||projectChanged){
      const rmaFS=src.rma15_fs?.ok&&src.rma15_fs.data?src.rma15_fs.data:[];
      const rmaJM=src.rma15_jm?.ok&&src.rma15_jm.data?src.rma15_jm.data:[];
      if(rmaFS.length||rmaJM.length||src.rma15_fs||src.rma15_jm){
        setRma15([
          ...rmaFS.map(r=>normalizeRMA15({...r,_proyectoForzado:"FILO DEL SOL"},insumosMap)),
          ...rmaJM.map(r=>normalizeRMA15({...r,_proyectoForzado:"JOSE MARIA"},insumosMap)),
        ].filter(r=>dmProjectMatches(r.proyecto,proyectoUsuario)).map(r=>({...r,maquina:resolveEquipmentCodeAlias(r.maquina)})));
      }
      cache.rma15_fs=src.rma15_fs;
      cache.rma15_jm=src.rma15_jm;
    }

    const listaChanged=cache.lista_equipos!==src.lista_equipos;
    if(listaChanged){
      if(src.lista_equipos?.ok&&src.lista_equipos.data){
        setListaEquipos(src.lista_equipos.data.map(row=>Object.fromEntries(
          Object.entries(row||{}).map(([key,value])=>[
            key,
            /codigo|código|interno|equipo/i.test(key)?resolveEquipmentCodeAlias(value):value
          ])
        )));
      }else if(src.lista_equipos&&!src.lista_equipos.ok){
        setListaEquipos([]);
      }
      cache.lista_equipos=src.lista_equipos;
    }

    cache.proyectoUsuario=proyectoUsuario;
    setErrors(errs);
    setDataHydrated(true);
  },[rawSources,proyectoUsuario]);`;

export function localFirstNormalizationVitePlugin(){
  return {
    name:"delta-local-first-normalization",
    enforce:"pre",
    transform(code,id){
      const file=normalizeId(id);
      if(!file.endsWith(APP_FILE))return null;
      const start=code.indexOf("  // Normaliza todo cada vez que llega una fuente nueva.");
      const end=code.indexOf("\n\n  const loadInitial=useCallback",start);
      if(start<0||end<0)throw new Error("[delta-local-first-normalization] No se encontró el bloque de normalización de App.jsx");
      const next=code.slice(0,start)+replacement+code.slice(end);
      return {code:next,map:null};
    }
  };
}
