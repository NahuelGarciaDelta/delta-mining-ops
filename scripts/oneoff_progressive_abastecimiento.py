from pathlib import Path
p=Path('src/modules/abastecimiento/AbastecimientoModule.jsx')
s=p.read_text(encoding='utf-8')

def rep(old,new,count=1):
    global s
    n=s.count(old)
    if n < count:
        raise SystemExit(f'Expected at least {count} occurrences, found {n}: {old[:120]!r}')
    s=s.replace(old,new,count)

# Main solicitudes table: make the existing progressive behavior explicitly 100 by 100.
rep('const progressiveMainRows=useProgressiveRows(sortedRows,{resetKey:tab});','const progressiveMainRows=useProgressiveRows(sortedRows,{resetKey:tab,initialLimit:100,increment:100});')
rep('>Mostrar 250 más</button>','>Mostrar 100 más</button>')

# RABA03 downloadable/preview table: paginate the rendered preview, while keeping the full dataset for download/export.
anchor='  },[sortedRows,remitosByCode,normCode,normalizeCentroCosto,calcularIndicadorRABA03]);\n\n  const raba03DashboardRows=useMemo(()=>{'
insert='  },[sortedRows,remitosByCode,normCode,normalizeCentroCosto,calcularIndicadorRABA03]);\n  const progressiveRaba03Rows=useProgressiveRows(raba03DownloadRows,{resetKey:`raba03-${rabaFilterMode}-${rabaDate}-${rabaDateFrom}-${rabaDateTo}-${project}-${company}-${supervisor}-${query}`,initialLimit:100,increment:100});\n\n  const raba03DashboardRows=useMemo(()=>{'
rep(anchor,insert)
rep('{raba03DownloadRows.length?raba03DownloadRows.map((r,idx)=>(', '{progressiveRaba03Rows.totalCount?progressiveRaba03Rows.visibleRows.map((r,idx)=>(')
rep('<div style={{padding:"10px 12px",fontSize:11,color:C.textSub,borderTop:`1px solid ${C.border}22`}}>{fmtNum(raba03DownloadRows.length)} filas listas para descargar</div>', '<div style={{padding:"10px 12px",fontSize:11,color:C.textSub,borderTop:`1px solid ${C.border}22`,display:"flex",alignItems:"center",justifyContent:"center",gap:10,flexWrap:"wrap"}}><span>Mostrando {fmtNum(progressiveRaba03Rows.visibleCount)} de {fmtNum(progressiveRaba03Rows.totalCount)} registros · {fmtNum(raba03DownloadRows.length)} filas listas para descargar</span>{progressiveRaba03Rows.hasMore&&<button type="button" onClick={progressiveRaba03Rows.showMore} style={{height:30,border:`1px solid ${C.blue}55`,background:C.blueDim,color:C.blue,borderRadius:8,padding:"0 10px",fontSize:11,fontWeight:900,cursor:"pointer"}}>Mostrar 100 más</button>}</div>')

# Remitos cargados: 100 remitos initially, then 100 more on demand.
anchor='  const filteredRemitos=useMemo(()=>{\n    const q=norm(remitoSearch);\n    if(!q)return remitos;\n    return (remitos||[]).filter(rem=>norm(rem.comprobante).includes(q));\n  },[remitos,remitoSearch,norm]);'
insert=anchor+'\n  const progressiveRemitos=useProgressiveRows(filteredRemitos,{resetKey:`remitos-${remitoSearch}`,initialLimit:100,increment:100});'
rep(anchor,insert)
rep('{filteredRemitos.length?filteredRemitos.map(rem=>(', '{progressiveRemitos.totalCount?progressiveRemitos.visibleRows.map(rem=>(')
old='''        )):(\n          <div style={{padding:18,color:C.textSub,fontWeight:700}}>{remitos.length?"No hay remitos que coincidan con la búsqueda.":"Todavía no hay remitos cargados."}</div>\n        )}\n      </div>'''
new='''        )):(\n          <div style={{padding:18,color:C.textSub,fontWeight:700}}>{remitos.length?"No hay remitos que coincidan con la búsqueda.":"Todavía no hay remitos cargados."}</div>\n        )}\n        {progressiveRemitos.totalCount>0&&<div style={{padding:"10px 12px",fontSize:11,color:C.textSub,borderTop:`1px solid ${C.border}22`,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}><span>Mostrando {fmtNum(progressiveRemitos.visibleCount)} de {fmtNum(progressiveRemitos.totalCount)} remitos</span>{progressiveRemitos.hasMore&&<button type="button" onClick={progressiveRemitos.showMore} style={{height:30,border:`1px solid ${C.blue}55`,background:C.blueDim,color:C.blue,borderRadius:8,padding:"0 10px",fontSize:11,fontWeight:900,cursor:"pointer"}}>Mostrar 100 más</button>}</div>}\n      </div>'''
rep(old,new)

p.write_text(s,encoding='utf-8')
print('Progressive loading applied to RABA03 preview, Remitos and Solicitudes.')
