const normalizeId=id=>String(id||"").replace(/\\/g,"/").split("?")[0];

function replaceOnce(source,oldText,newText,label){
  if(!source.includes(oldText)){
    console.warn(`[progressive-rows] No se encontró patrón: ${label}`);
    return source;
  }
  return source.replace(oldText,newText);
}

function transformCommonUi(code){
  return code.replace(/>Mostrar 250 más<\/button>/g,">Ver 100 más</button>");
}

function transformAbastecimiento(code){
  let s=code;

  s=s.replace("const [stockVisibleLimit,setStockVisibleLimit]=useState(250);","const [stockVisibleLimit,setStockVisibleLimit]=useState(100);");
  s=s.replace(/setStockVisibleLimit\(250\);/g,"setStockVisibleLimit(100);");
  s=s.replace(/setStockVisibleLimit\(v=>v\+250\)/g,"setStockVisibleLimit(v=>v+100)");
  s=s.replace(">Mostrar 250 más ({fmtNum(sortedStockRows.length-visibleStockRows.length)} restantes)</button>",">Ver 100 más ({fmtNum(sortedStockRows.length-visibleStockRows.length)} restantes)</button>");
  s=s.replace(/>Mostrar 250 más<\/button>/g,">Ver 100 más</button>");

  if(!s.includes("const progressiveRemitos=useProgressiveRows(filteredRemitos")){
    s=replaceOnce(
      s,
      "\n  const buildSentByCode=useCallback((sourceRemitos=[])=>{",
      "\n  const progressiveRemitos=useProgressiveRows(filteredRemitos,{resetKey:remitoSearch});\n\n  const buildSentByCode=useCallback((sourceRemitos=[])=>{",
      "progressiveRemitos",
    );
  }
  s=s.replace("{filteredRemitos.length?filteredRemitos.map(rem=>(","{filteredRemitos.length?progressiveRemitos.visibleRows.map(rem=>(");

  const remitoEnd=`        )):(\n          <div style={{padding:18,color:C.textSub,fontWeight:700}}>{remitos.length?"No hay remitos que coincidan con la búsqueda.":"Todavía no hay remitos cargados."}</div>\n        )}\n      </div>\n    </div>\n  );\n\n  const renderEnviosSinSolicitud`;
  const remitoNew=`        )):(\n          <div style={{padding:18,color:C.textSub,fontWeight:700}}>{remitos.length?"No hay remitos que coincidan con la búsqueda.":"Todavía no hay remitos cargados."}</div>\n        )}\n        {progressiveRemitos.totalCount>100&&<div style={{padding:"10px 12px",fontSize:11,color:C.textSub,borderTop:\`1px solid \${C.border}22\`,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}><span>Mostrando {fmtNum(progressiveRemitos.visibleCount)} de {fmtNum(progressiveRemitos.totalCount)} remitos</span>{progressiveRemitos.hasMore&&<button type="button" onClick={progressiveRemitos.showMore} style={{height:30,border:\`1px solid \${C.blue}55\`,background:C.blueDim,color:C.blue,borderRadius:8,padding:"0 10px",fontSize:11,fontWeight:900,cursor:"pointer"}}>Ver 100 más</button>}</div>}\n      </div>\n    </div>\n  );\n\n  const renderEnviosSinSolicitud`;
  s=replaceOnce(s,remitoEnd,remitoNew,"footer remitos");

  if(!s.includes("const progressiveEnviosSinSolicitud=useProgressiveRows(enviosSinSolicitudRows")){
    s=replaceOnce(
      s,
      "\n  const exportarEnviosSinSolicitud=useCallback(()=>{",
      "\n  const progressiveEnviosSinSolicitud=useProgressiveRows(enviosSinSolicitudRows,{resetKey:tab});\n\n  const exportarEnviosSinSolicitud=useCallback(()=>{",
      "progressiveEnviosSinSolicitud",
    );
  }
  s=s.replace("{enviosSinSolicitudRows.length?enviosSinSolicitudRows.map(r=>(","{enviosSinSolicitudRows.length?progressiveEnviosSinSolicitud.visibleRows.map(r=>(");

  const enviosEnd=`            </tbody>\n          </table>\n        </div>\n      </Card>\n    );\n  };\n\n  return (`;
  const enviosNew=`            </tbody>\n          </table>\n        </div>\n        {progressiveEnviosSinSolicitud.totalCount>100&&<div style={{padding:"10px 12px",fontSize:11,color:C.textSub,borderTop:\`1px solid \${C.border}22\`,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}><span>Mostrando {fmtNum(progressiveEnviosSinSolicitud.visibleCount)} de {fmtNum(progressiveEnviosSinSolicitud.totalCount)} registros</span>{progressiveEnviosSinSolicitud.hasMore&&<button type="button" onClick={progressiveEnviosSinSolicitud.showMore} style={{height:30,border:\`1px solid \${C.blue}55\`,background:C.blueDim,color:C.blue,borderRadius:8,padding:"0 10px",fontSize:11,fontWeight:900,cursor:"pointer"}}>Ver 100 más</button>}</div>}\n      </Card>\n    );\n  };\n\n  return (`;
  s=replaceOnce(s,enviosEnd,enviosNew,"footer envíos sin solicitud");

  s=s.replace("const editRows=sortedRows;","const editRows=progressiveMainRows.visibleRows;");
  const editFooter='<div style={{padding:"10px 12px",fontSize:11,color:C.textSub,borderTop:`1px solid ${C.border}22`}}>{fmtNum(editRows.length)} solicitudes mostradas</div>';
  const editFooterNew='<div style={{padding:"10px 12px",fontSize:11,color:C.textSub,borderTop:`1px solid ${C.border}22`,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}><span>Mostrando {fmtNum(progressiveMainRows.visibleCount)} de {fmtNum(progressiveMainRows.totalCount)} solicitudes</span>{progressiveMainRows.hasMore&&<button type="button" onClick={progressiveMainRows.showMore} style={{height:30,border:`1px solid ${C.blue}55`,background:C.blueDim,color:C.blue,borderRadius:8,padding:"0 10px",fontSize:11,fontWeight:900,cursor:"pointer"}}>Ver 100 más</button>}</div>';
  s=s.replace(editFooter,editFooterNew);

  return s;
}

export function progressiveRowsVitePlugin(){
  return{
    name:"delta-progressive-rows-100",
    enforce:"pre",
    transform(code,id){
      const file=normalizeId(id);
      if(file.endsWith("/src/components/ui/index.jsx"))return{code:transformCommonUi(code),map:null};
      if(file.endsWith("/src/modules/abastecimiento/AbastecimientoModule.jsx"))return{code:transformAbastecimiento(code),map:null};
      return null;
    },
  };
}
