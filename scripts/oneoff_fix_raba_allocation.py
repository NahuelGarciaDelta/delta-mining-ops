from pathlib import Path
import re

p=Path('src/modules/abastecimiento/AbastecimientoModule.jsx')
s=p.read_text(encoding='utf-8')

# 1) normalizeRow must not use a global sent-by-code map.
s=s.replace('  const normalizeRow=useCallback((r,idx,sentMap={})=>{', '  const normalizeRow=useCallback((r,idx)=>{', 1)
s=s.replace('    const enviada=(sentMap[`${codeNorm}__${centroCostoNorm}`]||0)+(sentMap[`${codeNorm}__*`]||0);\n    const restante=Math.max(0,solicitada-enviada);', '    const enviada=0;\n    const restante=Math.max(0,solicitada);', 1)

# 2) Insert centralized chronological FIFO allocation helper before buildSolicitudKey.
marker='  const buildSolicitudKey=useCallback((row)=>{\n'
helper=r'''  const allocateRemitosToRequests=useCallback((requestRows=[],sourceRemitos=[])=>{
    const rowsAllocated=(requestRows||[]).map(row=>({...row,cantidadEnviada:0,cantidadRestante:Math.max(0,toNumber(row.cantidadSolicitada)),_matchedRemitos:[]}));
    const byKey=new Map();
    rowsAllocated.forEach((row,index)=>{
      const code=normCode(row.codigoArticulo);
      const proyecto=normalizeCentroCosto(row.centroCosto);
      if(!code||!proyecto)return;
      const key=`${code}__${proyecto}`;
      if(!byKey.has(key))byKey.set(key,[]);
      byKey.get(key).push({row,index,fechaMs:parseChronoDateMs(row.fechaSolicitud)});
    });
    byKey.forEach(queue=>queue.sort((a,b)=>(a.fechaMs||0)-(b.fechaMs||0)||a.index-b.index));

    const shipments=[];
    (sourceRemitos||[]).forEach((remito,remitoIndex)=>{
      const proyecto=normalizeCentroCosto(remito.proyecto||remito.observaciones||remito.destino||remito.centroCosto||remito.origen||"");
      const fecha=remito.fecha||"";
      const fechaMs=parseChronoDateMs(fecha);
      (remito.items||[]).forEach((item,itemIndex)=>{
        const code=normCode(item.codigo);
        const cantidad=toNumber(item.cantidad);
        if(!code||cantidad<=0)return;
        shipments.push({
          id:`${remito.id||remito.comprobante||"remito"}-${itemIndex}-${code}`,
          code,proyecto,fecha,fechaMs,cantidad,
          numero:remito.comprobante||"",
          lugar:remito.destino||remito.observaciones||remito.origen||"",
          insumo:item.descripcion||"",
          remitoIndex,itemIndex,
        });
      });
    });
    shipments.sort((a,b)=>(a.fechaMs||0)-(b.fechaMs||0)||a.remitoIndex-b.remitoIndex||a.itemIndex-b.itemIndex);

    const unmatched=[];
    shipments.forEach(shipment=>{
      let restanteEnvio=shipment.cantidad;
      const key=shipment.proyecto?`${shipment.code}__${shipment.proyecto}`:"";
      const queue=key?(byKey.get(key)||[]):[];
      for(const req of queue){
        if(restanteEnvio<=0)break;
        // A shipment can only satisfy a request that already existed on shipment date.
        if(req.fechaMs&&shipment.fechaMs&&req.fechaMs>shipment.fechaMs)continue;
        const row=rowsAllocated[req.index];
        const pendiente=Math.max(0,toNumber(row.cantidadSolicitada)-toNumber(row.cantidadEnviada));
        if(pendiente<=0)continue;
        const aplicado=Math.min(pendiente,restanteEnvio);
        if(aplicado<=0)continue;
        row.cantidadEnviada=toNumber(row.cantidadEnviada)+aplicado;
        row.cantidadRestante=Math.max(0,toNumber(row.cantidadSolicitada)-row.cantidadEnviada);
        row._matchedRemitos.push({numero:shipment.numero,fecha:formatDateLocal(shipment.fecha),cantidad:aplicado,lugar:shipment.lugar,insumo:shipment.insumo});
        restanteEnvio-=aplicado;
      }
      if(restanteEnvio>0){
        unmatched.push({
          id:shipment.id,
          codigoArticulo:shipment.code,
          descripcion:shipment.insumo,
          proyecto:shipment.proyecto||"SIN PROYECTO",
          cantidadEnviada:restanteEnvio,
          fechaEnvio:shipment.fecha,
          numeroRemito:shipment.numero,
        });
      }
    });
    return {rows:rowsAllocated,unmatched};
  },[normCode,toNumber,normalizeCentroCosto,formatDateLocal]);

'''
assert marker in s
s=s.replace(marker, helper+marker, 1)

# 3) Replace mapRaba03Rows with allocation-based mapping.
old='''  const mapRaba03Rows=useCallback((raw=[],sentMap={})=>raw.map((row,index)=>normalizeRow(row,index,sentMap)).filter(r=>\n    [r.empresa,r.fechaSolicitud,r.fechaRequerida,r.pedidoPor,r.centroCosto,r.codigoArticulo,r.descripcion,r.cantidadSolicitada]\n      .some(v=>String(v||"").trim()) &&\n    !String(r.empresa||"").toLowerCase().includes("aprobado") &&\n    !String(r.empresa||"").toLowerCase().includes("empresa")\n  ),[normalizeRow]);'''
new='''  const mapRaba03Rows=useCallback((raw=[],sourceRemitos=[])=>{\n    const base=raw.map((row,index)=>normalizeRow(row,index)).filter(r=>\n      [r.empresa,r.fechaSolicitud,r.fechaRequerida,r.pedidoPor,r.centroCosto,r.codigoArticulo,r.descripcion,r.cantidadSolicitada]\n        .some(v=>String(v||"").trim()) &&\n      !String(r.empresa||"").toLowerCase().includes("aprobado") &&\n      !String(r.empresa||"").toLowerCase().includes("empresa")\n    );\n    return allocateRemitosToRequests(base,sourceRemitos).rows;\n  },[normalizeRow,allocateRemitosToRequests]);'''
assert old in s
s=s.replace(old,new,1)

# 4) loadRaba03 should feed actual remitos, not global sent map.
s=s.replace('      const sentMap=Array.isArray(remitosOverride)?buildSentByCode(remitosOverride):sentByCodeRef.current;\n      setRows(mapRaba03Rows(raw,sentMap));', '      const sourceRemitos=Array.isArray(remitosOverride)?remitosOverride:remitos;\n      setRows(mapRaba03Rows(raw,sourceRemitos));', 1)
s=s.replace('  },[mapRaba03Rows,buildSentByCode]);', '  },[mapRaba03Rows,remitos]);', 1)

# 5) Recompute when remitos change using allocation directly.
s=s.replace('    const refresh=()=>setRows(mapRaba03Rows(rawRaba03RowsRef.current,sentByCode));', '    const refresh=()=>setRows(mapRaba03Rows(rawRaba03RowsRef.current,remitos));', 1)
s=s.replace('  },[remitos,mapRaba03Rows]);', '  },[remitos,mapRaba03Rows]);', 1)

# 6) guardarDatosRABA03 must use per-request matched remitos.
pattern=re.compile(r'''        const code=normCode\(r\.codigoArticulo\);\n        const proyecto=normalizeCentroCosto\(r\.centroCosto\);\n        const matches=\[\.\.\.\(remitosByCode\[`\$\{code\}__\$\{proyecto\}`\]\|\|\[\]\)\]\.filter\(m=>\{\n          const solicitudMs=parseChronoDateMs\(r\.fechaSolicitud\);\n          const remitoMs=parseChronoDateMs\(m\.fecha\);\n          return !solicitudMs\|\|!remitoMs\|\|remitoMs>=solicitudMs;\n        \}\);\n        const seen=new Set\(\);\n        const unique=matches\.filter\(m=>\{\n          const k=`\$\{m\.numero\}__\$\{m\.fecha\}__\$\{m\.cantidad\}`;\n          if\(seen\.has\(k\)\)return false;\n          seen\.add\(k\);\n          return true;\n        \}\);''')
m=pattern.search(s)
assert m, 'guardar allocation block not found'
s=s[:m.start()]+'        const unique=Array.isArray(r._matchedRemitos)?r._matchedRemitos:[];'+s[m.end():]
s=s.replace('  },[rows,toNumber,loadRaba03,normCode,normalizeCentroCosto,remitosByCode]);', '  },[rows,toNumber,loadRaba03]);', 1)

# 7) Downloads: use row-specific matches. Two sections (download + dashboard).
for rowvar in ['row','row']:
    old_block='''      const code=normCode(row.codigoArticulo);\n      const proyecto=normalizeCentroCosto(row.centroCosto);\n      const matches=[...(remitosByCode[`${code}__${proyecto}`]||[])].filter(m=>{\n          const solicitudMs=parseChronoDateMs(row.fechaSolicitud);\n          const remitoMs=parseChronoDateMs(m.fecha);\n          return !solicitudMs||!remitoMs||remitoMs>=solicitudMs;\n        });\n      const seen=new Set();\n      const unique=matches.filter(m=>{\n        const k=`${m.numero}__${m.fecha}__${m.cantidad}`;\n        if(seen.has(k))return false;\n        seen.add(k);\n        return true;\n      });'''
    assert old_block in s
    s=s.replace(old_block,'      const unique=Array.isArray(row._matchedRemitos)?row._matchedRemitos:[];',1)
s=s.replace('  },[sortedRows,remitosByCode,normCode,normalizeCentroCosto,calcularIndicadorRABA03]);', '  },[sortedRows,calcularIndicadorRABA03]);', 1)
s=s.replace('  },[assignedRows,remitosByCode,normCode,normalizeCentroCosto,calcularIndicadorRABA03]);', '  },[assignedRows,calcularIndicadorRABA03]);', 1)

# 8) Envíos sin solicitud comes from the exact same allocator, so historical unmatched shipments never disappear.
pat=re.compile(r'''  const enviosSinSolicitudRows=useMemo\(\(\)=>\{.*?\n  \},\[rows,remitos,normCode,toNumber,normalizeCentroCosto\]\);''',re.S)
m=pat.search(s)
assert m, 'enviosSinSolicitudRows not found'
replacement='''  const enviosSinSolicitudRows=useMemo(()=>{\n    const base=(rows||[]).map(r=>({...r,cantidadEnviada:0,cantidadRestante:Math.max(0,toNumber(r.cantidadSolicitada)),_matchedRemitos:[]}));\n    return allocateRemitosToRequests(base,remitos).unmatched.sort((a,b)=>{\n      const fa=parseChronoDateMs(a.fechaEnvio),fb=parseChronoDateMs(b.fechaEnvio);\n      if(fa!==fb)return fb-fa;\n      return String(a.codigoArticulo||"").localeCompare(String(b.codigoArticulo||""),"es",{numeric:true,sensitivity:"base"});\n    });\n  },[rows,remitos,toNumber,allocateRemitosToRequests]);'''
s=s[:m.start()]+replacement+s[m.end():]

p.write_text(s,encoding='utf-8')
print('patched',p)
